import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { mercadoPagoService } from '../services/mercadopago.service';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const createOrderSchema = z.object({
  pointOfSaleId: z.string().min(1, 'El punto de venta es requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  externalReference: z.string().min(1, 'La referencia externa es requerida'),
  description: z.string().optional(),
});

const saveConfigSchema = z.object({
  accessToken: z.string().min(1, 'El access token es requerido'),
  publicKey: z.string().optional(),
  userId: z.string().optional(),
  webhookSecret: z.string().optional(),
  environment: z.enum(['sandbox', 'production']).optional(),
  isActive: z.boolean().optional(),
});

const updateDeviceSchema = z.object({
  mpDeviceId: z.string().nullable(),
  mpDeviceName: z.string().nullable().optional(),
});

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

/**
 * POST /api/mercadopago/orders
 * Crea una orden de pago en un terminal Point
 */
router.post('/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = createOrderSchema.parse(req.body);

    // Verificar que el punto de venta existe y tiene device configurado
    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: {
        id: data.pointOfSaleId,
        tenantId,
      },
    });

    if (!pointOfSale) {
      return res.status(404).json({
        success: false,
        error: 'Punto de venta no encontrado',
      });
    }

    if (!pointOfSale.mpDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'Este punto de venta no tiene un dispositivo Mercado Pago Point configurado',
      });
    }

    const result = await mercadoPagoService.createPointOrder({
      tenantId,
      deviceId: pointOfSale.mpDeviceId,
      amount: data.amount,
      externalReference: data.externalReference,
      description: data.description,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creando orden MP:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/orders/:orderId
 * Consulta el estado de una orden
 */
router.get('/orders/:orderId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { orderId } = req.params;

    const result = await mercadoPagoService.getOrderStatus(tenantId, orderId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error consultando orden MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/mercadopago/orders/:orderId/cancel
 * Cancela una orden pendiente
 */
router.post('/orders/:orderId/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { orderId } = req.params;

    await mercadoPagoService.cancelOrder(tenantId, orderId);

    res.json({
      success: true,
      message: 'Orden cancelada exitosamente',
    });
  } catch (error) {
    console.error('Error cancelando orden MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/devices
 * Lista los dispositivos Point disponibles
 */
router.get('/devices', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const devices = await mercadoPagoService.listDevices(tenantId);

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    console.error('Error listando dispositivos MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/orders/pending
 * Lista las órdenes pendientes del tenant
 */
router.get('/orders-pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const orders = await mercadoPagoService.listPendingOrders(tenantId);

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Error listando órdenes pendientes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// RUTAS DE CONFIGURACIÓN (Backoffice)
// ============================================

/**
 * GET /api/mercadopago/config
 * Obtiene la configuración de MP del tenant
 */
router.get('/config', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        publicKey: true,
        userId: true,
        isActive: true,
        environment: true,
        createdAt: true,
        updatedAt: true,
        // No devolver accessToken ni webhookSecret por seguridad
      },
    });

    res.json({
      success: true,
      data: config,
      hasConfig: !!config,
      hasAccessToken: !!(config && await prisma.mercadoPagoConfig.findUnique({
        where: { tenantId },
        select: { accessToken: true },
      }))?.accessToken,
    });
  } catch (error) {
    console.error('Error obteniendo config MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/mercadopago/config
 * Guarda la configuración de MP del tenant
 */
router.post('/config', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = saveConfigSchema.parse(req.body);

    const config = await mercadoPagoService.saveConfig(tenantId, data);

    res.json({
      success: true,
      data: {
        id: config.id,
        tenantId: config.tenantId,
        publicKey: config.publicKey,
        userId: config.userId,
        isActive: config.isActive,
        environment: config.environment,
      },
    });
  } catch (error) {
    console.error('Error guardando config MP:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * PUT /api/mercadopago/points-of-sale/:id/device
 * Asocia un dispositivo MP Point a un punto de venta
 */
router.put('/points-of-sale/:id/device', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = updateDeviceSchema.parse(req.body);

    // Verificar que el POS pertenece al tenant
    const pos = await prisma.pointOfSale.findFirst({
      where: { id, tenantId },
    });

    if (!pos) {
      return res.status(404).json({
        success: false,
        error: 'Punto de venta no encontrado',
      });
    }

    const updated = await prisma.pointOfSale.update({
      where: { id },
      data: {
        mpDeviceId: data.mpDeviceId,
        mpDeviceName: data.mpDeviceName,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error actualizando device en POS:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// WEBHOOK (público, sin autenticación)
// ============================================

/**
 * POST /api/webhooks/mercadopago
 * Recibe notificaciones de Mercado Pago
 */
export const webhookRouter = Router();

webhookRouter.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;
    const dataId = req.query['data.id'] as string || req.body?.data?.id;

    console.log('Webhook MP recibido:', {
      headers: {
        'x-signature': xSignature,
        'x-request-id': xRequestId,
      },
      query: req.query,
      body: req.body,
    });

    // Si tenemos firma, intentar validarla
    // Por ahora procesamos sin validación para testing
    // En producción deberíamos validar

    await mercadoPagoService.processWebhook(req.body);

    // Siempre responder 200 para que MP no reintente
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook MP:', error);
    // Aun con error, respondemos 200 para evitar reintentos
    res.status(200).send('OK');
  }
});

export default router;
