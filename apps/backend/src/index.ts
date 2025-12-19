/**
 * Cianbox POS - Backend API
 * Servidor Express con autenticación JWT y multi-tenant
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Cargar variables de entorno
dotenv.config();

// Importar rutas
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import promotionsRoutes from './routes/promotions.js';
import cianboxRoutes from './routes/cianbox.js';
import agencyRoutes from './routes/agency.js';
import backofficeRoutes from './routes/backoffice.js';
import mercadoPagoRoutes, { webhookRouter as mpWebhookRouter } from './routes/mercadopago.js';
import cashRoutes from './routes/cash.js';
import cianboxWebhookRoutes from './routes/webhooks.js';

// Importar servicios
import CianboxService from './services/cianbox.service.js';

// Importar utilidades
import { ApiError } from './utils/errors.js';

// Configuración
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:5173',  // POS Frontend
  'http://localhost:5174',  // Client Backoffice
  'http://localhost:5175',  // Agency Backoffice
  'http://localhost:3000',
];

// Crear aplicación Express
const app = express();
const httpServer = createServer(app);

// Configurar Socket.IO para tiempo real
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

// Middleware de seguridad
app.use(helmet());

// Configurar CORS
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Agregar io a request para uso en rutas
app.use((req: Request & { io?: SocketIOServer }, _res, next) => {
  req.io = io;
  next();
});

// Logging de requests en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API root
app.get('/api', (_req, res) => {
  res.json({
    success: true,
    message: 'Cianbox POS API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      sales: '/api/sales',
      promotions: '/api/promotions',
      cianbox: '/api/cianbox',
      agency: '/api/agency',
      backoffice: '/api/backoffice',
      mercadopago: '/api/mercadopago',
      cash: '/api/cash',
      webhooks: '/api/webhooks',
      cianboxwebhooks: '/api/cianboxwebhooks',
    },
  });
});

// Montar rutas API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/cianbox', cianboxRoutes);
app.use('/api/agency', agencyRoutes); // Super admin / gestión de DB servers
app.use('/api/backoffice', backofficeRoutes); // Client backoffice - gestión de catálogo
app.use('/api/mercadopago', mercadoPagoRoutes); // Mercado Pago Point integration
app.use('/api/cash', cashRoutes); // Gestión de turnos de caja y arqueos
app.use('/api/webhooks', mpWebhookRouter); // Webhooks Mercado Pago (público, sin auth)
app.use('/api/cianboxwebhooks', cianboxWebhookRoutes); // Webhooks Cianbox (público, sin auth)

// DEBUG TEMPORAL - Buscar órdenes MP sin autenticación - TODO: ELIMINAR
import { PrismaClient } from '@prisma/client';
const debugPrisma = new PrismaClient();
app.get('/api/debug/mp-orders', async (req, res) => {
  try {
    const { paymentId, reference, all } = req.query;
    let where: Record<string, unknown> = {};
    if (paymentId) {
      where.paymentId = paymentId as string;
    } else if (reference) {
      where.externalReference = { contains: reference as string };
    } else if (all === 'orphans') {
      where = { status: { in: ['PROCESSED', 'COMPLETED', 'APPROVED'] }, saleId: null };
    }
    const orders = await debugPrisma.mercadoPagoOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Ruta 404
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada',
    },
  });
});

// Manejador global de errores
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  // Error conocido de la API
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Error de Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Ya existe un registro con esos datos',
          details: prismaError.meta?.target,
        },
      });
    }

    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Registro no encontrado',
        },
      });
    }
  }

  // Error de validación de Zod
  if (err.name === 'ZodError') {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación',
        details: err,
      },
    });
  }

  // Error genérico
  const statusCode = 500;
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// Configurar Socket.IO
io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);

  // Unirse a sala del tenant
  socket.on('join:tenant', (tenantId: string) => {
    socket.join(`tenant:${tenantId}`);
    console.log(`Socket ${socket.id} unido a tenant:${tenantId}`);
  });

  // Unirse a sala de punto de venta
  socket.on('join:pos', (posId: string) => {
    socket.join(`pos:${posId}`);
    console.log(`Socket ${socket.id} unido a pos:${posId}`);
  });

  // Notificar nueva venta
  socket.on('sale:created', (data: { tenantId: string; sale: unknown }) => {
    io.to(`tenant:${data.tenantId}`).emit('sale:new', data.sale);
  });

  // Notificar actualización de stock
  socket.on('stock:updated', (data: { tenantId: string; product: unknown }) => {
    io.to(`tenant:${data.tenantId}`).emit('stock:change', data.product);
  });

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
  });
});

// =============================================
// CRON JOBS
// =============================================

// Refrescar tokens de Cianbox cada hora
// El token de acceso vence cada 24 horas, refrescamos antes
cron.schedule('0 * * * *', async () => {
  console.log(`[Cron] ${new Date().toISOString()} - Iniciando refresh de tokens Cianbox...`);
  try {
    const result = await CianboxService.refreshAllTokens();
    console.log(`[Cron] Token refresh completado: ${result.refreshed} actualizados, ${result.failed} fallidos`);
  } catch (error) {
    console.error('[Cron] Error en refresh de tokens:', error);
  }
});

console.log('[Cron] Cianbox token refresh programado (cada hora)');

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🛒 Cianbox POS Backend                               ║
║                                                        ║
║   Servidor corriendo en: http://localhost:${PORT}        ║
║   Entorno: ${process.env.NODE_ENV || 'development'}                             ║
║   Cron: Token refresh cada hora                        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

// Manejo de señales de cierre
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  httpServer.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido. Cerrando servidor...');
  httpServer.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});

export { app, httpServer, io };

