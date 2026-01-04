import { Router, Request, Response } from 'express';
import { PrismaClient, MercadoPagoAppType } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { mercadoPagoService } from '../services/mercadopago.service';

// Clave secreta para validar webhooks de MP
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

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
 * GET /api/mercadopago/qr/status/:externalReference
 * Consulta el estado de una orden QR por external_reference
 */
router.get('/qr/status/:externalReference', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { externalReference } = req.params;

    const result = await mercadoPagoService.getQROrderStatus(tenantId, externalReference);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error consultando orden QR:', error);
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

/**
 * GET /api/mercadopago/payments/:paymentId/details
 * Obtiene los detalles completos de un pago de MP
 * Query params: appType=POINT|QR (default: POINT)
 */
router.get('/payments/:paymentId/details', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { paymentId } = req.params;
    const appType = appTypeSchema.parse(req.query.appType) as MercadoPagoAppType;

    const details = await mercadoPagoService.getPaymentDetails(tenantId, paymentId, appType);

    res.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Error obteniendo detalles del pago:', error);
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

const changeOperatingModeSchema = z.object({
  operatingMode: z.enum(['PDV', 'STANDALONE']),
});

// NOTA: La asociación terminal→POS NO se puede hacer vía API de MP.
// Se debe configurar desde el dispositivo físico: Más opciones > Ajustes > Modo de vinculación
// Solo se puede tener UNA terminal en modo PDV por caja. Para múltiples terminales, crear múltiples cajas.

/**
 * PATCH /api/mercadopago/devices/:deviceId/operating-mode
 * Cambia el modo de operación de un dispositivo Point (PDV <-> STANDALONE)
 *
 * IMPORTANTE: El dispositivo debe reiniciarse después del cambio para que tome efecto
 */
router.patch('/devices/:deviceId/operating-mode', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { deviceId } = req.params;
    const { operatingMode } = changeOperatingModeSchema.parse(req.body);

    const device = await mercadoPagoService.changeDeviceOperatingMode(tenantId, deviceId, operatingMode);

    res.json({
      success: true,
      data: device,
      message: `Modo de operación cambiado a ${operatingMode}. Reinicia el dispositivo para aplicar el cambio.`,
    });
  } catch (error) {
    console.error('Error cambiando modo de operación:', error);

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
 * POST /api/mercadopago/devices/:deviceId/test-payment
 * Envía un pago de prueba de $50 al dispositivo para verificar la conexión
 */
router.post('/devices/:deviceId/test-payment', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { deviceId } = req.params;

    // Generar referencia única para el test
    const externalReference = `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const result = await mercadoPagoService.createPointOrder({
      tenantId,
      deviceId,
      amount: 50, // $50 pesos de prueba
      externalReference,
      description: 'Pago de prueba - Verificación de conexión',
    });

    res.json({
      success: true,
      data: {
        orderId: result.orderId,
        amount: 50,
        externalReference,
        message: 'Pago de prueba enviado al dispositivo. Cancélalo desde la terminal.',
      },
    });
  } catch (error) {
    console.error('Error enviando pago de prueba:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar pago de prueba',
    });
  }
});

/**
 * GET /api/mercadopago/test-payment/:orderId/status
 * Consulta el estado de un pago de prueba (para verificar si fue cancelado)
 */
router.get('/test-payment/:orderId/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { orderId } = req.params;

    // Buscar la orden en nuestra BD
    const order = await prisma.mercadoPagoOrder.findFirst({
      where: {
        orderId,
        tenantId,
      },
      select: {
        orderId: true,
        status: true,
        externalReference: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada',
      });
    }

    // Consultar el estado actual en Mercado Pago para obtener actualización en tiempo real
    try {
      const mpStatus = await mercadoPagoService.getOrderStatus(tenantId, orderId);

      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          status: mpStatus.status,
          externalReference: order.externalReference,
          isTestPayment: order.externalReference?.startsWith('TEST-'),
          isCancelled: mpStatus.status === 'CANCELED',
          isFailed: mpStatus.status === 'FAILED',
          isCompleted: mpStatus.status === 'CANCELED' || mpStatus.status === 'FAILED' || mpStatus.status === 'EXPIRED',
        },
      });
    } catch {
      // Si falla la consulta a MP, devolver el estado de nuestra BD
      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          status: order.status,
          externalReference: order.externalReference,
          isTestPayment: order.externalReference?.startsWith('TEST-'),
          isCancelled: order.status === 'CANCELED',
          isFailed: order.status === 'FAILED',
          isCompleted: order.status === 'CANCELED' || order.status === 'FAILED' || order.status === 'EXPIRED',
        },
      });
    }
  } catch (error) {
    console.error('Error consultando estado de pago de prueba:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al consultar estado',
    });
  }
});

// Rutas de asociación terminal→POS eliminadas - no soportado por API de MP
// La asociación se hace desde el dispositivo físico: Más opciones > Ajustes > Modo de vinculación

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

const updateQRCashierSchema = z.object({
  mpQrPosId: z.number().nullable(),
  mpQrPosExternalId: z.string().nullable().optional(),
});

/**
 * PUT /api/mercadopago/points-of-sale/:id/qr-cashier
 * Vincula una caja QR de MP a un punto de venta del sistema
 */
router.put('/points-of-sale/:id/qr-cashier', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = updateQRCashierSchema.parse(req.body);

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
        mpQrPosId: data.mpQrPosId,
        mpQrExternalId: data.mpQrPosExternalId,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error vinculando QR cashier a POS:', error);

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

const createQRStoreSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  external_id: z.string().min(1, 'El ID externo es requerido').max(60),
  location: z.object({
    street_name: z.string().min(1, 'La calle es requerida'),
    street_number: z.string().min(1, 'El número es requerido'),
    city_name: z.string().min(1, 'La ciudad es requerida'),
    state_name: z.string().min(1, 'La provincia es requerida'),
  }),
});

/**
 * POST /api/mercadopago/qr/stores
 * Crea una sucursal/local en MP para QR
 */
router.post('/qr/stores', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = createQRStoreSchema.parse(req.body);

    const store = await mercadoPagoService.createQRStore(tenantId, data);

    res.json({
      success: true,
      data: store,
      message: 'Local creado exitosamente en Mercado Pago',
    });
  } catch (error) {
    console.error('Error creando store QR:', error);

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
// RUTAS DE BRANCHES CON MP STORES
// ============================================

/**
 * GET /api/mercadopago/qr/branches-status
 * Lista las sucursales del tenant con su estado de MP
 */
router.get('/qr/branches-status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const branches = await mercadoPagoService.getBranchesWithMPStatus(tenantId);

    res.json({
      success: true,
      data: branches,
    });
  } catch (error) {
    console.error('Error obteniendo estado de branches:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/mercadopago/qr/stores/from-branch/:branchId
 * Crea un Store en MP usando los datos de una Branch del sistema
 */
router.post('/qr/stores/from-branch/:branchId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { branchId } = req.params;

    const result = await mercadoPagoService.createStoreFromBranch(tenantId, branchId);

    res.json({
      success: true,
      data: result,
      message: 'Local creado exitosamente en Mercado Pago y vinculado a la sucursal',
    });
  } catch (error) {
    console.error('Error creando store desde branch:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/mercadopago/qr/sync-stores
 * Sincroniza Stores existentes en MP con las Branches del sistema
 */
router.post('/qr/sync-stores', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await mercadoPagoService.syncExistingStores(tenantId);

    res.json({
      success: true,
      data: result,
      message: `${result.synced} sucursales vinculadas. ${result.notMatched.length} stores sin coincidencia.`,
    });
  } catch (error) {
    console.error('Error sincronizando stores:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/qr/unlinked-stores
 * Lista Stores de MP que no están vinculados a ninguna Branch
 */
router.get('/qr/unlinked-stores', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const stores = await mercadoPagoService.getUnlinkedStores(tenantId);

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error('Error obteniendo stores no vinculados:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * PUT /api/mercadopago/qr/branches/:branchId/link-store
 * Vincula manualmente un Store existente de MP a una Branch
 */
router.put('/qr/branches/:branchId/link-store', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { branchId } = req.params;
    const { storeId, externalId } = req.body;

    if (!storeId || !externalId) {
      return res.status(400).json({
        success: false,
        error: 'storeId y externalId son requeridos',
      });
    }

    const result = await mercadoPagoService.linkStoreToBranch(tenantId, branchId, storeId, externalId);

    res.json({
      success: true,
      data: result,
      message: 'Local vinculado exitosamente a la sucursal',
    });
  } catch (error) {
    console.error('Error vinculando store a branch:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * DELETE /api/mercadopago/qr/branches/:branchId/unlink-store
 * Desvincula un Store de MP de una Branch
 */
router.delete('/qr/branches/:branchId/unlink-store', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { branchId } = req.params;

    const result = await mercadoPagoService.unlinkStoreFromBranch(tenantId, branchId);

    res.json({
      success: true,
      data: result,
      message: 'Local desvinculado de la sucursal',
    });
  } catch (error) {
    console.error('Error desvinculando store de branch:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// CACHE LOCAL DE STORES Y CASHIERS
// ============================================

/**
 * GET /api/mercadopago/qr/local/stores
 * Lista stores desde la DB local (cache)
 */
router.get('/qr/local/stores', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const stores = await mercadoPagoService.getLocalStores(tenantId);

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error('Error listando stores locales:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/qr/local/cashiers
 * Lista cashiers desde la DB local (cache)
 */
router.get('/qr/local/cashiers', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { storeId } = req.query;
    const cashiers = await mercadoPagoService.getLocalCashiers(tenantId, storeId as string | undefined);

    res.json({
      success: true,
      data: cashiers,
    });
  } catch (error) {
    console.error('Error listando cashiers locales:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/mercadopago/qr/sync-data
 * Sincroniza stores y cashiers desde MP a la DB local
 */
router.post('/qr/sync-data', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await mercadoPagoService.syncQRDataFromMP(tenantId);

    res.json({
      success: true,
      data: result,
      message: `Sincronización completada: ${result.storesAdded} stores nuevos, ${result.cashiersAdded} cajas nuevas`,
    });
  } catch (error) {
    console.error('Error sincronizando datos QR:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

const createQRCashierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  external_id: z.string().min(1, 'El ID externo es requerido'),
  store_id: z.string().min(1, 'El ID del local es requerido'),
});

/**
 * POST /api/mercadopago/qr/cashiers
 * Crea una caja/POS en MP para QR
 */
router.post('/qr/cashiers', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = createQRCashierSchema.parse(req.body);

    const cashier = await mercadoPagoService.createQRCashier(tenantId, data);

    res.json({
      success: true,
      data: cashier,
      message: 'Caja creada exitosamente en Mercado Pago',
    });
  } catch (error) {
    console.error('Error creando cashier QR:', error);

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

    // Verificar que el POS tiene una caja QR vinculada
    if (!pointOfSale.mpQrExternalId) {
      return res.status(400).json({
        success: false,
        error: 'El punto de venta no tiene una caja QR vinculada. Configure la caja QR desde Integraciones.',
      });
    }

    // Usar el external_id de la caja QR vinculada
    const externalPosId = pointOfSale.mpQrExternalId;

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

/**
 * DELETE /api/mercadopago/qr/orders/:pointOfSaleId
 * Cancela/elimina una orden QR pendiente
 */
router.delete('/qr/orders/:pointOfSaleId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { pointOfSaleId } = req.params;

    // Verificar que el POS existe y tiene QR configurado
    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: {
        id: pointOfSaleId,
        tenantId,
      },
    });

    if (!pointOfSale) {
      return res.status(404).json({
        success: false,
        error: 'Punto de venta no encontrado',
      });
    }

    if (!pointOfSale.mpQrExternalId) {
      return res.status(400).json({
        success: false,
        error: 'El punto de venta no tiene una caja QR vinculada',
      });
    }

    await mercadoPagoService.deleteQROrder(tenantId, pointOfSale.mpQrExternalId);

    res.json({
      success: true,
      message: 'Orden QR cancelada exitosamente',
    });
  } catch (error) {
    console.error('Error cancelando orden QR:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// PAGOS HUÉRFANOS PARA POS
// ============================================

/**
 * GET /api/mercadopago/orphan-payments
 * Lista pagos huérfanos disponibles para el POS actual
 * Filtra por sucursal/POS basándose en el externalReference
 */
router.get('/orphan-payments', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const branchId = req.user!.branchId;
    const { pointOfSaleId } = req.query;

    // Obtener info de la sucursal y POS para filtrar
    let branchCode: string | null = null;
    let posCode: string | null = null;

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { code: true },
      });
      branchCode = branch?.code || null;
    }

    if (pointOfSaleId) {
      const pos = await prisma.pointOfSale.findFirst({
        where: { id: pointOfSaleId as string, tenantId },
        select: { code: true },
      });
      posCode = pos?.code || null;
    }

    // Buscar pagos huérfanos (PROCESSED sin saleId)
    const orphanOrders = await prisma.mercadoPagoOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PROCESSED', 'COMPLETED', 'APPROVED'] },
        saleId: null,
      },
      orderBy: { processedAt: 'desc' },
      take: 20,
    });

    // Filtrar por externalReference que coincida con el patrón de la sucursal/POS
    // Formato: POS-{BRANCH_CODE}-CAJA-{NUMBER}-{TIMESTAMP}
    const filteredOrders = orphanOrders.filter((order) => {
      const ref = order.externalReference;
      if (!ref.startsWith('POS-')) return false;

      // Si tenemos código de sucursal, verificar que coincida
      if (branchCode) {
        // El patrón puede ser POS-SUC-1-CAJA-01 o similar
        // Extraer la parte de sucursal del externalReference
        const parts = ref.split('-');
        // Buscar si el código de sucursal está en el ref
        if (!ref.includes(branchCode)) {
          return false;
        }
      }

      return true;
    });

    // Verificar que no tengan Payment vinculado por transactionId
    const trueOrphans = [];
    for (const order of filteredOrders) {
      if (order.paymentId) {
        const existingPayment = await prisma.payment.findFirst({
          where: {
            transactionId: order.paymentId,
            sale: { tenantId },
          },
        });
        if (existingPayment) continue;
      }
      trueOrphans.push(order);
    }

    res.json({
      success: true,
      data: trueOrphans,
      count: trueOrphans.length,
    });
  } catch (error) {
    console.error('Error listando pagos huérfanos:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/mercadopago/orphan-payments/:orderId/apply
 * Aplica un pago huérfano a una venta nueva
 * Body: { items, customerId?, notes? }
 */
const applyOrphanPaymentSchema = z.object({
  pointOfSaleId: z.string().min(1, 'El punto de venta es requerido'),
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().min(0).optional().default(0),
    promotionId: z.string().optional(),
    promotionName: z.string().optional(),
  })).min(1, 'Debe incluir al menos un producto'),
  customerId: z.string().optional(),
  notes: z.string().optional(),
  ticketNumber: z.number().optional(),
});

router.post('/orphan-payments/:orderId/apply', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const branchId = req.user!.branchId;
    const { orderId } = req.params;

    const validation = applyOrphanPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(422).json({
        success: false,
        error: 'Datos inválidos',
        details: validation.error.errors,
      });
    }

    const { pointOfSaleId, items, customerId, notes, ticketNumber } = validation.data;

    // Buscar la orden huérfana
    const mpOrder = await prisma.mercadoPagoOrder.findFirst({
      where: {
        orderId,
        tenantId,
        status: { in: ['PROCESSED', 'COMPLETED', 'APPROVED'] },
        saleId: null,
      },
    });

    if (!mpOrder) {
      return res.status(404).json({
        success: false,
        error: 'Pago huérfano no encontrado o ya tiene venta asociada',
      });
    }

    // Verificar que el POS existe y obtener datos de sucursal
    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: { id: pointOfSaleId, tenantId },
      include: { branch: true },
    });

    if (!pointOfSale) {
      return res.status(400).json({
        success: false,
        error: 'Punto de venta no encontrado',
      });
    }

    // Obtener nombres de productos si no vienen
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map(p => [p.id, p.name]));

    // Generar número de venta: SUC-CODE-POS-CODE-YYYYMMDD-NNNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const salesCount = await prisma.sale.count({
      where: {
        tenantId,
        pointOfSaleId,
        createdAt: { gte: startOfDay },
      },
    });

    const sequence = String(salesCount + 1).padStart(4, '0');
    const nextSaleNumber = `${pointOfSale.branch.code}-${pointOfSale.code}-${dateStr}-${sequence}`;

    // Calcular totales
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal - totalDiscount;

    // Determinar método de pago
    let paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'TRANSFER' = 'QR';
    if (mpOrder.paymentMethod === 'credit_card') {
      paymentMethod = 'CREDIT_CARD';
    } else if (mpOrder.paymentMethod === 'debit_card') {
      paymentMethod = 'DEBIT_CARD';
    } else if (mpOrder.paymentMethod === 'bank_transfer' || mpOrder.paymentMethod === 'interop_transfer') {
      paymentMethod = 'TRANSFER';
    }

    // Crear venta con transacción
    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          branchId: branchId!,
          pointOfSaleId,
          userId,
          saleNumber: nextSaleNumber,
          status: 'COMPLETED',
          subtotal,
          discount: totalDiscount,
          tax: 0,
          total,
          customerId: customerId || null,
          notes: notes
            ? `${notes} | Pago huérfano: ${mpOrder.orderId}${ticketNumber ? ` | Ticket: ${ticketNumber}` : ''}`
            : `Pago huérfano: ${mpOrder.orderId}${ticketNumber ? ` | Ticket: ${ticketNumber}` : ''}`,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: item.productName || productMap.get(item.productId) || 'Producto',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              subtotal: item.unitPrice * item.quantity - (item.discount || 0),
              promotionId: item.promotionId || null,
              promotionName: item.promotionName || null,
            })),
          },
          payments: {
            create: {
              method: paymentMethod,
              amount: mpOrder.amount.toNumber(),
              transactionId: mpOrder.paymentId || mpOrder.orderId,
              cardBrand: mpOrder.cardBrand || undefined,
              cardLastFour: mpOrder.cardLastFour || undefined,
              installments: mpOrder.installments || undefined,
            },
          },
        },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
        },
      });

      // Vincular la orden MP a la venta
      await tx.mercadoPagoOrder.update({
        where: { id: mpOrder.id },
        data: { saleId: newSale.id },
      });

      return newSale;
    });

    res.status(201).json({
      success: true,
      data: sale,
      message: 'Venta creada exitosamente desde pago huérfano',
    });
  } catch (error) {
    console.error('Error aplicando pago huérfano:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

// ============================================
// SINCRONIZACIÓN DE PAGOS EXISTENTES
// ============================================

/**
 * POST /api/mercadopago/payments/sync
 * Sincroniza los pagos existentes con los datos de MP
 * Busca pagos que tengan transactionId (paymentId de MP) pero no tengan mpPaymentId
 */
router.post('/payments/sync', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { paymentIds } = req.body as { paymentIds?: string[] };

    // Buscar pagos que tienen transactionId pero no tienen mpPaymentId
    // Si se pasan paymentIds específicos, filtrar por ellos
    const paymentsToSync = await prisma.payment.findMany({
      where: {
        sale: { tenantId },
        transactionId: { not: null },
        // Si hay paymentIds específicos, ignorar el filtro de mpPaymentId para forzar re-sync
        ...(paymentIds && paymentIds.length > 0
          ? { id: { in: paymentIds } }
          : { mpPaymentId: null }),
        // Solo pagos con métodos de MP
        method: { in: ['CREDIT_CARD', 'DEBIT_CARD', 'QR', 'TRANSFER', 'MP_POINT'] },
      },
      include: {
        sale: { select: { id: true, saleNumber: true } },
      },
      take: 100, // Limitar para no sobrecargar
    });

    if (paymentsToSync.length === 0) {
      return res.json({
        success: true,
        message: 'No hay pagos pendientes de sincronizar',
        synced: 0,
        errors: 0,
      });
    }

    let synced = 0;
    let errors = 0;
    const results: Array<{ paymentId: string; saleNumber: string; status: string; error?: string }> = [];

    for (const payment of paymentsToSync) {
      try {
        // Determinar si es QR o Point basándose en el método
        const isQR = payment.method === 'QR' || payment.method === 'TRANSFER';
        const appType = isQR ? 'QR' : 'POINT';

        // Obtener detalles del pago desde MP
        console.log(`[MP Sync] Sincronizando pago ${payment.id}, método: ${payment.method}, transactionId: ${payment.transactionId}, appType: ${appType}`);

        const details = await mercadoPagoService.getPaymentDetails(
          tenantId,
          payment.transactionId!,
          appType as 'POINT' | 'QR'
        );

        console.log(`[MP Sync] Detalles obtenidos:`, {
          mpPaymentId: details.mpPaymentId,
          mpOrderId: details.mpOrderId,
          mpFeeAmount: details.mpFeeAmount,
          netReceivedAmount: details.netReceivedAmount,
          cardholderName: details.cardholderName,
          status: details.status,
        });

        // Actualizar el pago con los datos de MP
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            mpPaymentId: details.mpPaymentId,
            mpOrderId: details.mpOrderId,
            mpOperationType: details.mpOperationType,
            mpPointType: details.mpPointType,
            cardBrand: details.cardBrand || payment.cardBrand,
            cardLastFour: details.cardLastFour || payment.cardLastFour,
            cardFirstSix: details.cardFirstSix,
            cardExpirationMonth: details.cardExpirationMonth,
            cardExpirationYear: details.cardExpirationYear,
            cardholderName: details.cardholderName,
            cardType: details.cardType,
            payerEmail: details.payerEmail,
            payerIdType: details.payerIdType,
            payerIdNumber: details.payerIdNumber,
            authorizationCode: details.authorizationCode,
            mpFeeAmount: details.mpFeeAmount,
            mpFeeRate: details.mpFeeRate,
            netReceivedAmount: details.netReceivedAmount,
            bankOriginId: details.bankOriginId,
            bankOriginName: details.bankOriginName,
            bankTransferId: details.bankTransferId,
            mpDeviceId: details.mpDeviceId,
            mpPosId: details.mpPosId,
            mpStoreId: details.mpStoreId,
            installments: details.installments || payment.installments,
          },
        });

        synced++;
        results.push({
          paymentId: payment.id,
          saleNumber: payment.sale.saleNumber,
          status: 'synced',
        });

        console.log(`[MP Sync] Pago ${payment.id} sincronizado (Venta: ${payment.sale.saleNumber})`);
      } catch (err) {
        errors++;
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        results.push({
          paymentId: payment.id,
          saleNumber: payment.sale.saleNumber,
          status: 'error',
          error: errorMsg,
        });
        console.error(`[MP Sync] Error sincronizando pago ${payment.id}:`, errorMsg);
      }
    }

    res.json({
      success: true,
      message: `Sincronización completada: ${synced} exitosos, ${errors} errores`,
      synced,
      errors,
      total: paymentsToSync.length,
      results,
    });
  } catch (error) {
    console.error('Error sincronizando pagos MP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    });
  }
});

/**
 * GET /api/mercadopago/payments/pending-sync
 * Lista los pagos que necesitan sincronización
 */
router.get('/payments/pending-sync', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const pendingPayments = await prisma.payment.findMany({
      where: {
        sale: { tenantId },
        transactionId: { not: null },
        mpPaymentId: null,
        method: { in: ['CREDIT_CARD', 'DEBIT_CARD', 'QR', 'TRANSFER', 'MP_POINT'] },
      },
      select: {
        id: true,
        method: true,
        amount: true,
        transactionId: true,
        cardBrand: true,
        cardLastFour: true,
        createdAt: true,
        sale: {
          select: {
            id: true,
            saleNumber: true,
            total: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: pendingPayments,
      count: pendingPayments.length,
    });
  } catch (error) {
    console.error('Error listando pagos pendientes:', error);
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
 * Valida la firma del webhook de Mercado Pago
 * Según documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
function validateWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined
): boolean {
  if (!MP_WEBHOOK_SECRET) {
    console.warn('[Webhook MP] MP_WEBHOOK_SECRET no configurado, saltando validación de firma');
    return true; // Si no hay secret configurado, permitir (para desarrollo)
  }

  if (!xSignature) {
    console.warn('[Webhook MP] Header x-signature no presente');
    return false;
  }

  // Parsear x-signature: ts=1234567890,v1=abc123...
  const signatureParts: Record<string, string> = {};
  xSignature.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      signatureParts[key.trim()] = value.trim();
    }
  });

  const ts = signatureParts['ts'];
  const v1 = signatureParts['v1'];

  if (!ts || !v1) {
    console.warn('[Webhook MP] Firma incompleta, falta ts o v1');
    return false;
  }

  // Construir el manifest para verificar
  // Formato: id:{data.id};request-id:{x-request-id};ts:{ts};
  const manifest = `id:${dataId || ''};request-id:${xRequestId || ''};ts:${ts};`;

  // Calcular HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  const isValid = calculatedHash === v1;

  if (!isValid) {
    console.warn('[Webhook MP] Firma inválida', {
      manifest,
      expected: v1,
      calculated: calculatedHash,
    });
  }

  return isValid;
}

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

    console.log('[Webhook MP] Recibido:', {
      headers: {
        'x-signature': xSignature ? `${xSignature.substring(0, 30)}...` : undefined,
        'x-request-id': xRequestId,
      },
      query: req.query,
      body: req.body,
    });

    // Validar firma del webhook
    if (!validateWebhookSignature(xSignature, xRequestId, dataId)) {
      console.error('[Webhook MP] Firma inválida, ignorando webhook');
      // Respondemos 200 igual para que MP no reintente
      return res.status(200).send('OK');
    }

    console.log('[Webhook MP] Firma válida, procesando...');

    // Procesar el webhook
    await mercadoPagoService.processWebhook(req.body);

    // Siempre responder 200 para que MP no reintente
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook MP] Error procesando:', error);
    // Aun con error, respondemos 200 para evitar reintentos
    res.status(200).send('OK');
  }
});

export default router;
