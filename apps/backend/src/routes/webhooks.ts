/**
 * Cianbox Webhooks Router
 * Recibe notificaciones de Cianbox cuando se actualizan productos, categorías, marcas, etc.
 *
 * Formato de notificación de Cianbox:
 * {
 *   "event": "productos",
 *   "created": "2024-01-15T10:30:00Z",
 *   "id": ["123", "456", "789"],
 *   "endpoint": "productos"
 * }
 *
 * Eventos soportados: productos, categorias, marcas, listas_precio, sucursales, clientes
 * Debe responder HTTP 200 en menos de 30 segundos
 */

import { Router, Request, Response } from 'express';
import CianboxService from '../services/cianbox.service.js';
import prisma from '../lib/prisma.js';

const router = Router();

// Interfaz para el payload del webhook de Cianbox
interface CianboxWebhookPayload {
  event: string;
  created: string;
  id: string[] | number[];
  endpoint: string;
}

/**
 * POST /api/cianboxwebhooks/:tenantId
 * Recibe notificaciones de Cianbox para un tenant específico
 */
router.post('/:tenantId', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const payload = req.body as CianboxWebhookPayload;

  // Log de la notificación recibida
  console.log(`[Webhook Cianbox] Notificación recibida para tenant ${tenantId}:`, {
    event: payload.event,
    created: payload.created,
    idCount: payload.id?.length || 0,
    ids: payload.id?.slice(0, 10), // Solo mostrar los primeros 10 IDs en el log
  });

  // Responder inmediatamente con 200 (requisito de Cianbox: < 30 segundos)
  res.status(200).json({
    success: true,
    message: 'Webhook recibido',
    received: {
      event: payload.event,
      count: payload.id?.length || 0,
    }
  });

  // Procesar el webhook de forma asíncrona
  processWebhook(tenantId, payload).catch(err => {
    console.error(`[Webhook Cianbox] Error procesando webhook para tenant ${tenantId}:`, err);
  });
});

/**
 * Procesa el webhook de forma asíncrona después de responder al cliente
 */
async function processWebhook(tenantId: string, payload: CianboxWebhookPayload): Promise<void> {
  try {
    // Verificar que el tenant existe y tiene conexión a Cianbox
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { cianboxConnection: true },
    });

    if (!tenant) {
      console.error(`[Webhook Cianbox] Tenant ${tenantId} no encontrado`);
      return;
    }

    if (!tenant.cianboxConnection) {
      console.error(`[Webhook Cianbox] Tenant ${tenantId} no tiene conexión a Cianbox configurada`);
      return;
    }

    // Convertir IDs a números
    const ids = payload.id.map(id => typeof id === 'string' ? parseInt(id, 10) : id);

    if (ids.length === 0) {
      console.log(`[Webhook Cianbox] No hay IDs para procesar en evento ${payload.event}`);
      return;
    }

    // Crear instancia del servicio Cianbox usando el método estático
    const cianboxService = await CianboxService.forTenant(tenantId);

    // Procesar según el tipo de evento
    let processed = 0;

    switch (payload.event) {
      case 'productos':
        console.log(`[Webhook Cianbox] Procesando ${ids.length} productos...`);
        processed = await cianboxService.upsertProductsByIds(tenantId, ids);
        console.log(`[Webhook Cianbox] ${processed} productos actualizados`);
        break;

      case 'categorias':
        console.log(`[Webhook Cianbox] Procesando ${ids.length} categorías...`);
        processed = await cianboxService.upsertCategoriesByIds(tenantId, ids);
        console.log(`[Webhook Cianbox] ${processed} categorías actualizadas`);
        break;

      case 'marcas':
        console.log(`[Webhook Cianbox] Procesando ${ids.length} marcas...`);
        processed = await cianboxService.upsertBrandsByIds(tenantId, ids);
        console.log(`[Webhook Cianbox] ${processed} marcas actualizadas`);
        break;

      case 'listas_precio':
        console.log(`[Webhook Cianbox] Procesando ${ids.length} listas de precio...`);
        processed = await cianboxService.upsertPriceListsByIds(tenantId, ids);
        console.log(`[Webhook Cianbox] ${processed} precios actualizados`);
        break;

      case 'sucursales':
        console.log(`[Webhook Cianbox] Procesando ${ids.length} sucursales...`);
        processed = await cianboxService.upsertBranchesByIds(tenantId, ids);
        console.log(`[Webhook Cianbox] ${processed} sucursales actualizadas`);
        break;

      case 'clientes':
        console.log(`[Webhook Cianbox] Procesando ${ids.length} clientes...`);
        processed = await cianboxService.upsertCustomersByIds(tenantId, ids);
        console.log(`[Webhook Cianbox] ${processed} clientes actualizados`);
        break;

      default:
        console.log(`[Webhook Cianbox] Evento no soportado: ${payload.event}`);
    }

  } catch (error) {
    console.error(`[Webhook Cianbox] Error procesando webhook:`, error);
  }
}

/**
 * GET /api/cianboxwebhooks/:tenantId/test
 * Endpoint de prueba para verificar que el webhook está configurado correctamente
 */
router.get('/:tenantId/test', async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: 'Tenant no encontrado',
    });
  }

  res.json({
    success: true,
    message: 'Webhook endpoint activo',
    tenant: {
      id: tenant.id,
      name: tenant.name,
    },
    supportedEvents: ['productos', 'categorias', 'marcas', 'listas_precio', 'sucursales', 'clientes'],
    timestamp: new Date().toISOString(),
  });
});

export default router;
