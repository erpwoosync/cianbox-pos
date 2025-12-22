/**
 * Rutas API para Facturación Electrónica AFIP
 *
 * Endpoints para configuración y emisión de comprobantes
 */

import { Router, Response } from 'express';
import { PrismaClient, AfipVoucherType, AfipTaxCategory } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { afipService, DOC_TYPES, IVA_CONDITIONS, IVA_RATES, CONCEPTS, VOUCHER_TYPE_CODES } from '../services/afip.service.js';

const router = Router();
const prisma = new PrismaClient();

// Todos los endpoints requieren autenticación
router.use(authenticate);

// ==============================================
// CONFIGURACIÓN AFIP
// ==============================================

/**
 * GET /afip/config
 * Obtiene la configuración AFIP del tenant
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const config = await prisma.afipConfig.findUnique({
      where: { tenantId },
      include: {
        salesPoints: {
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!config) {
      return res.json({ configured: false, config: null });
    }

    // No exponer certificados ni claves
    const { afipCert, afipKey, afipAccessToken, ...safeConfig } = config;

    res.json({
      configured: true,
      config: {
        ...safeConfig,
        hasCertificate: !!afipCert,
        hasKey: !!afipKey,
        hasAccessToken: !!afipAccessToken,
      },
    });
  } catch (error: any) {
    console.error('Error al obtener configuración AFIP:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

/**
 * POST /afip/config
 * Crea o actualiza la configuración AFIP del tenant
 */
const configSchema = z.object({
  cuit: z.string().min(11).max(13),
  businessName: z.string().min(1),
  tradeName: z.string().optional().nullable().transform(v => v || undefined),
  taxCategory: z.nativeEnum(AfipTaxCategory),
  address: z.string().optional().nullable().transform(v => v || undefined),
  city: z.string().optional().nullable().transform(v => v || undefined),
  state: z.string().optional().nullable().transform(v => v || undefined),
  zipCode: z.string().optional().nullable().transform(v => v || undefined),
  activityStartDate: z.string().optional().nullable().transform(v => v || undefined),
  afipAccessToken: z.string().optional().nullable().transform(v => v || undefined),
  afipCert: z.string().optional().nullable().transform(v => v || undefined),
  afipKey: z.string().optional().nullable().transform(v => v || undefined),
  isProduction: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

router.post('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = configSchema.parse(req.body);

    // Parsear fecha si existe
    const activityStartDate = data.activityStartDate ? new Date(data.activityStartDate) : null;

    // No sobrescribir credenciales si vienen vacías
    const { afipAccessToken, afipCert, afipKey, ...restData } = data;
    const credentialsUpdate: Record<string, string> = {};
    if (afipAccessToken) credentialsUpdate.afipAccessToken = afipAccessToken;
    if (afipCert) credentialsUpdate.afipCert = afipCert;
    if (afipKey) credentialsUpdate.afipKey = afipKey;

    const config = await prisma.afipConfig.upsert({
      where: { tenantId },
      update: {
        ...restData,
        ...credentialsUpdate,
        activityStartDate,
      },
      create: {
        tenantId,
        ...restData,
        afipAccessToken: afipAccessToken || null,
        afipCert: afipCert || null,
        afipKey: afipKey || null,
        activityStartDate,
      },
    });

    // Invalidar cache de la instancia
    afipService.invalidateInstance(tenantId);

    // No exponer certificados ni claves
    const { afipCert: savedCert, afipKey: savedKey, afipAccessToken: savedToken, ...safeConfig } = config;

    res.json({
      success: true,
      config: {
        ...safeConfig,
        hasCertificate: !!savedCert,
        hasKey: !!savedKey,
        hasAccessToken: !!savedToken,
      },
    });
  } catch (error: any) {
    console.error('Error al guardar configuración AFIP:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// ==============================================
// PUNTOS DE VENTA
// ==============================================

/**
 * GET /afip/sales-points
 * Lista los puntos de venta del tenant
 */
router.get('/sales-points', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const config = await prisma.afipConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuración AFIP no encontrada' });
    }

    const salesPoints = await prisma.afipSalesPoint.findMany({
      where: { afipConfigId: config.id },
      orderBy: { number: 'asc' },
      include: {
        pointOfSale: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(salesPoints);
  } catch (error: any) {
    console.error('Error al obtener puntos de venta:', error);
    res.status(500).json({ error: 'Error al obtener puntos de venta' });
  }
});

/**
 * POST /afip/sales-points
 * Crea un nuevo punto de venta
 */
const salesPointSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().optional(),
  pointOfSaleId: z.string().optional(),
});

router.post('/sales-points', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = salesPointSchema.parse(req.body);

    const config = await prisma.afipConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuración AFIP no encontrada' });
    }

    // Verificar si ya existe
    const existing = await prisma.afipSalesPoint.findFirst({
      where: {
        afipConfigId: config.id,
        number: data.number,
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un punto de venta con ese número' });
    }

    const salesPoint = await prisma.afipSalesPoint.create({
      data: {
        tenantId,
        afipConfigId: config.id,
        ...data,
      },
    });

    res.json(salesPoint);
  } catch (error: any) {
    console.error('Error al crear punto de venta:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Error al crear punto de venta' });
  }
});

/**
 * PUT /afip/sales-points/:id
 * Actualiza un punto de venta
 */
router.put('/sales-points/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = salesPointSchema.partial().parse(req.body);

    // Verificar pertenencia al tenant
    const salesPoint = await prisma.afipSalesPoint.findFirst({
      where: {
        id,
        afipConfig: { tenantId },
      },
    });

    if (!salesPoint) {
      return res.status(404).json({ error: 'Punto de venta no encontrado' });
    }

    const updated = await prisma.afipSalesPoint.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error al actualizar punto de venta:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Error al actualizar punto de venta' });
  }
});

/**
 * DELETE /afip/sales-points/:id
 * Desactiva un punto de venta
 */
router.delete('/sales-points/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar pertenencia al tenant
    const salesPoint = await prisma.afipSalesPoint.findFirst({
      where: {
        id,
        afipConfig: { tenantId },
      },
    });

    if (!salesPoint) {
      return res.status(404).json({ error: 'Punto de venta no encontrado' });
    }

    // Solo desactivar, no eliminar (los comprobantes dependen)
    await prisma.afipSalesPoint.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error al desactivar punto de venta:', error);
    res.status(500).json({ error: 'Error al desactivar punto de venta' });
  }
});

// ==============================================
// EMISIÓN DE COMPROBANTES
// ==============================================

/**
 * POST /afip/invoices
 * Emite un nuevo comprobante electrónico
 */
const invoiceSchema = z.object({
  salesPointId: z.string(),
  voucherType: z.nativeEnum(AfipVoucherType),
  concept: z.number().int().min(1).max(3).default(1),
  receiverDocType: z.number().int(),
  receiverDocNum: z.string(),
  receiverName: z.string().optional(),
  receiverTaxCategory: z.number().int().optional(),
  netAmount: z.number().positive(),
  exemptAmount: z.number().optional(),
  taxAmount: z.number(),
  otherTaxes: z.number().optional(),
  totalAmount: z.number().positive(),
  ivaDetails: z.array(z.object({
    id: z.number(),
    baseImp: z.number(),
    importe: z.number(),
  })).optional(),
  relatedVoucher: z.object({
    type: z.nativeEnum(AfipVoucherType),
    ptoVta: z.number().int(),
    number: z.number().int(),
    cuit: z.string().optional(),
  }).optional(),
  saleId: z.string().optional(),
});

router.post('/invoices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = invoiceSchema.parse(req.body);

    const result = await afipService.createVoucher(tenantId, data);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error al emitir comprobante:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Error al emitir comprobante' });
  }
});

/**
 * POST /afip/invoices/factura-b
 * Emite una Factura B simplificada (consumidor final)
 */
const facturaBSchema = z.object({
  salesPointId: z.string(),
  totalAmount: z.number().positive(),
  receiverDocType: z.number().int().optional(),
  receiverDocNum: z.string().optional(),
  receiverName: z.string().optional(),
  taxRate: z.number().optional(),
  saleId: z.string().optional(),
});

router.post('/invoices/factura-b', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = facturaBSchema.parse(req.body);

    const result = await afipService.createInvoiceB(
      tenantId,
      data.salesPointId,
      data.totalAmount,
      {
        receiverDocType: data.receiverDocType,
        receiverDocNum: data.receiverDocNum,
        receiverName: data.receiverName,
        taxRate: data.taxRate,
        saleId: data.saleId,
      }
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error al emitir factura B:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Error al emitir factura B' });
  }
});

/**
 * POST /afip/invoices/nota-credito-b
 * Emite una Nota de Crédito B
 */
const notaCreditoBSchema = z.object({
  salesPointId: z.string(),
  originalInvoiceId: z.string(),
  amount: z.number().positive().optional(),
});

router.post('/invoices/nota-credito-b', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = notaCreditoBSchema.parse(req.body);

    const result = await afipService.createCreditNoteB(
      tenantId,
      data.salesPointId,
      data.originalInvoiceId,
      data.amount
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error al emitir nota de crédito B:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Error al emitir nota de crédito B' });
  }
});

// ==============================================
// CONSULTAS
// ==============================================

/**
 * GET /afip/invoices
 * Lista los comprobantes emitidos
 */
router.get('/invoices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', limit = '20', salesPointId, voucherType, from, to } = req.query;

    const where: any = { tenantId };

    if (salesPointId) where.salesPointId = salesPointId;
    if (voucherType) where.voucherType = voucherType as AfipVoucherType;
    if (from || to) {
      where.issueDate = {};
      if (from) where.issueDate.gte = new Date(from as string);
      if (to) where.issueDate.lte = new Date(to as string);
    }

    const [invoices, total] = await Promise.all([
      prisma.afipInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        include: {
          salesPoint: {
            select: { number: true, name: true },
          },
        },
      }),
      prisma.afipInvoice.count({ where }),
    ]);

    res.json({
      data: invoices,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error('Error al listar comprobantes:', error);
    res.status(500).json({ error: 'Error al listar comprobantes' });
  }
});

/**
 * GET /afip/invoices/:id
 * Obtiene detalle de un comprobante
 */
router.get('/invoices/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const invoice = await prisma.afipInvoice.findFirst({
      where: { id, tenantId },
      include: {
        salesPoint: true,
        afipConfig: {
          select: {
            cuit: true,
            businessName: true,
            tradeName: true,
            taxCategory: true,
            address: true,
            city: true,
            state: true,
          },
        },
        sale: {
          select: { id: true, createdAt: true, total: true },
        },
        relatedInvoice: {
          select: { id: true, voucherType: true, number: true, cae: true },
        },
        creditDebitNotes: {
          select: { id: true, voucherType: true, number: true, cae: true, totalAmount: true },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    res.json(invoice);
  } catch (error: any) {
    console.error('Error al obtener comprobante:', error);
    res.status(500).json({ error: 'Error al obtener comprobante' });
  }
});

/**
 * GET /afip/invoices/:id/qr
 * Obtiene la URL del QR para un comprobante
 */
router.get('/invoices/:id/qr', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const qrUrl = await afipService.getInvoiceQrUrl(tenantId, id);

    if (!qrUrl) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    res.json({ qrUrl });
  } catch (error: any) {
    console.error('Error al obtener QR:', error);
    res.status(500).json({ error: 'Error al obtener QR' });
  }
});

// ==============================================
// ESTADO DEL SERVIDOR AFIP
// ==============================================

/**
 * GET /afip/status
 * Consulta el estado de los servidores de AFIP
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const status = await afipService.checkServerStatus(tenantId);
    res.json(status);
  } catch (error: any) {
    console.error('Error al consultar estado AFIP:', error);
    res.status(500).json({
      error: 'Error al consultar estado',
      message: error.message,
    });
  }
});

/**
 * GET /afip/afip-sales-points
 * Obtiene los puntos de venta habilitados directamente de AFIP
 */
router.get('/afip-sales-points', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const salesPoints = await afipService.getSalesPointsFromAfip(tenantId);
    res.json(salesPoints);
  } catch (error: any) {
    console.error('Error al obtener puntos de venta de AFIP:', error);
    res.status(500).json({
      error: 'Error al obtener puntos de venta',
      message: error.message,
    });
  }
});

/**
 * GET /afip/last-voucher
 * Obtiene el último número de comprobante desde AFIP
 */
router.get('/last-voucher', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { salesPointNumber, voucherType } = req.query;

    if (!salesPointNumber || !voucherType) {
      return res.status(400).json({ error: 'Faltan parámetros salesPointNumber y voucherType' });
    }

    const lastNumber = await afipService.getLastVoucherNumber(
      tenantId,
      parseInt(salesPointNumber as string),
      voucherType as AfipVoucherType
    );

    res.json({ lastNumber });
  } catch (error: any) {
    console.error('Error al obtener último comprobante:', error);
    res.status(500).json({ error: 'Error al obtener último comprobante' });
  }
});

// ==============================================
// CONSTANTES (para el frontend)
// ==============================================

/**
 * GET /afip/constants
 * Retorna las constantes para configuración en el frontend
 */
router.get('/constants', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    DOC_TYPES,
    IVA_CONDITIONS,
    IVA_RATES,
    CONCEPTS,
    VOUCHER_TYPE_CODES,
    TAX_CATEGORIES: Object.values(AfipTaxCategory),
  });
});

export default router;
