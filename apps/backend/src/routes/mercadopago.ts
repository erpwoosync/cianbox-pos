import { Router, Request, Response } from 'express';
import { PrismaClient, MercadoPagoAppType } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { mercadoPagoService } from '../services/mercadopago.service';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const appTypeSchema = z.enum(['POINT', 'QR']).default('POINT');

const createOrderSchema = z.object({
  pointOfSaleId: z.string().min(1, 'El punto de venta es requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  externalReference: z.string().min(1, 'La referencia externa es requerida'),
  description: z.string().optional(),
});

const updateDeviceSchema = z.object({
  mpDeviceId: z.string().nullable(),
  mpDeviceName: z.string().nullable().optional(),
});

// ============================================
// RUTAS OAUTH 2.0
// ============================================

/**
 * GET /api/mercadopago/oauth/authorize
 * Genera la URL de autorización para vincular cuenta de MP
 * Query params: appType=POINT|QR (default: POINT)
 */
router.get('/oauth/authorize', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const appType = appTypeSchema.parse(req.query.appType) as MercadoPagoAppType;

    const authUrl = mercadoPagoService.getAuthorizationUrl(tenantId, appType);

    res.json({
      success: true,
      data: {
        authorizationUrl: authUrl,
        appType,
      },
    });
  } catch (error) {
    console.error('Error generando URL de autorización:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/oauth/callback
 * Callback de OAuth - recibe el código de autorización
 * Esta ruta es llamada por Mercado Pago después de que el usuario autoriza
 * El state contiene tenantId y appType codificados en base64
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;
    const backofficeUrl = process.env.BACKOFFICE_URL || 'http://localhost:5174';

    // Si MP devuelve un error
    if (error) {
      console.error('Error de OAuth MP:', error, error_description);
      return res.redirect(`${backofficeUrl}/integrations?mp_error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Código o estado faltante',
      });
    }

    // Decodificar el state para obtener tenantId y appType
    let tenantId: string;
    let appType: MercadoPagoAppType = 'POINT';
    try {
      const stateData = JSON.parse(Buffer.from(String(state), 'base64').toString());
      tenantId = stateData.tenantId;
      appType = stateData.appType || 'POINT';
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido',
      });
    }

    // Intercambiar código por tokens
    await mercadoPagoService.exchangeCodeForTokens(String(code), tenantId, appType);

    // Redirigir al backoffice con éxito e indicar qué app se conectó
    res.redirect(`${backofficeUrl}/integrations?mp_success=true&mp_app=${appType}`);
  } catch (error) {
    console.error('Error en callback OAuth:', error);
    const backofficeUrl = process.env.BACKOFFICE_URL || 'http://localhost:5174';
    res.redirect(`${backofficeUrl}/integrations?mp_error=${encodeURIComponent('Error al vincular cuenta')}`);
  }
});

/**
 * DELETE /api/mercadopago/oauth/disconnect
 * Desvincula la cuenta de MP del tenant para un tipo de app específico
 * Query params: appType=POINT|QR (default: POINT)
 */
router.delete('/oauth/disconnect', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const appType = appTypeSchema.parse(req.query.appType) as MercadoPagoAppType;

    await mercadoPagoService.disconnectAccount(tenantId, appType);

    res.json({
      success: true,
      message: `Cuenta de Mercado Pago ${appType} desvinculada exitosamente`,
      appType,
    });
  } catch (error) {
    console.error('Error desvinculando cuenta MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// RUTAS DE ÓRDENES DE PAGO
// ============================================

/**
 * POST /api/mercadopago/orders
 * Crea una orden de pago en un terminal Point
 */
router.post('/orders', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
router.get('/orders/:orderId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/orders/:orderId/cancel', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
 * GET /api/mercadopago/orders-pending
 * Lista las órdenes pendientes del tenant
 */
router.get('/orders-pending', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
// RUTAS DE DISPOSITIVOS
// ============================================

/**
 * GET /api/mercadopago/devices
 * Lista los dispositivos Point disponibles
 */
router.get('/devices', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
 * PUT /api/mercadopago/points-of-sale/:id/device
 * Asocia un dispositivo MP Point a un punto de venta
 */
router.put('/points-of-sale/:id/device', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
// RUTAS DE CONFIGURACIÓN
// ============================================

/**
 * GET /api/mercadopago/config
 * Obtiene la configuración de MP del tenant (OAuth)
 * Si no se especifica appType, devuelve ambas configuraciones (Point y QR)
 * Query params: appType=POINT|QR (opcional)
 */
router.get('/config', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { appType } = req.query;

    // Helper para formatear config
    const formatConfig = (config: {
      id: string;
      tenantId: string;
      appType: MercadoPagoAppType;
      mpUserId: string | null;
      publicKey: string | null;
      scope: string | null;
      isActive: boolean;
      environment: string;
      tokenExpiresAt: Date | null;
      accessToken: string;
      createdAt: Date;
      updatedAt: Date;
    }) => {
      const isTokenExpiringSoon = config.tokenExpiresAt
        ? config.tokenExpiresAt < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : false;

      return {
        id: config.id,
        tenantId: config.tenantId,
        appType: config.appType,
        mpUserId: config.mpUserId,
        publicKey: config.publicKey,
        scope: config.scope,
        isActive: config.isActive,
        environment: config.environment,
        tokenExpiresAt: config.tokenExpiresAt,
        isTokenExpiringSoon,
        isConnected: config.isActive && !!config.accessToken,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    };

    // Si se especifica appType, devolver solo esa config
    if (appType) {
      const validAppType = appTypeSchema.parse(appType) as MercadoPagoAppType;
      const config = await mercadoPagoService.getConfigSafe(tenantId, validAppType);

      if (!config) {
        return res.json({
          success: true,
          data: null,
          isConnected: false,
          appType: validAppType,
        });
      }

      return res.json({
        success: true,
        data: formatConfig(config),
        isConnected: config.isActive && !!config.accessToken,
      });
    }

    // Si no se especifica appType, devolver ambas configuraciones
    const configs = await mercadoPagoService.getAllConfigs(tenantId);

    const pointConfig = configs.find(c => c.appType === 'POINT');
    const qrConfig = configs.find(c => c.appType === 'QR');

    res.json({
      success: true,
      data: {
        point: pointConfig ? formatConfig(pointConfig) : null,
        qr: qrConfig ? formatConfig(qrConfig) : null,
      },
      isPointConnected: pointConfig ? pointConfig.isActive && !!pointConfig.accessToken : false,
      isQrConnected: qrConfig ? qrConfig.isActive && !!qrConfig.accessToken : false,
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
 * POST /api/mercadopago/refresh-token
 * Fuerza la renovación del token (manual)
 * Query params: appType=POINT|QR (default: POINT)
 */
router.post('/refresh-token', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const appType = appTypeSchema.parse(req.query.appType) as MercadoPagoAppType;

    await mercadoPagoService.refreshAccessToken(tenantId, appType);

    res.json({
      success: true,
      message: `Token de ${appType} renovado exitosamente`,
      appType,
    });
  } catch (error) {
    console.error('Error renovando token MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// RUTAS DE QR
// ============================================

/**
 * GET /api/mercadopago/qr/stores
 * Lista las sucursales de MP para QR
 */
router.get('/qr/stores', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const stores = await mercadoPagoService.listQRStores(tenantId);

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error('Error listando stores QR:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/qr/cashiers
 * Lista las cajas de MP para QR
 */
router.get('/qr/cashiers', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { storeId } = req.query;
    const cashiers = await mercadoPagoService.listQRCashiers(tenantId, storeId as string | undefined);

    res.json({
      success: true,
      data: cashiers,
    });
  } catch (error) {
    console.error('Error listando cashiers QR:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

const createQROrderSchema = z.object({
  pointOfSaleId: z.string().min(1, 'El punto de venta es requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  externalReference: z.string().min(1, 'La referencia externa es requerida'),
  description: z.string().optional(),
  items: z.array(z.object({
    title: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
  })).optional(),
});

/**
 * POST /api/mercadopago/qr/orders
 * Crea una orden QR dinámica
 */
router.post('/qr/orders', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = createQROrderSchema.parse(req.body);

    // Verificar que el POS existe y tiene QR configurado
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

    // Usar el código del POS como external_id (alfanumérico, sin guiones)
    const externalPosId = pointOfSale.code.replace(/[^a-zA-Z0-9]/g, '');

    const result = await mercadoPagoService.createQROrder({
      tenantId,
      externalPosId,
      amount: data.amount,
      externalReference: data.externalReference,
      description: data.description,
      items: data.items,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creando orden QR:', error);

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

    // Procesar el webhook
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
