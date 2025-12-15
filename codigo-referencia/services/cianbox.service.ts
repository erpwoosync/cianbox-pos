/**
 * Cianbox API Service
 * Servicio para conectar con la API de Cianbox y sincronizar pedidos/productos
 *
 * This service handles:
 * - Authentication with Cianbox API
 * - Fetching orders, products, and statuses
 * - Syncing orders to local database
 *
 * Este servicio maneja:
 * - Autenticación con API de Cianbox
 * - Obtención de pedidos, productos y estados
 * - Sincronización de pedidos a la base de datos local
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Type definitions for Cianbox API responses
// Definiciones de tipos para respuestas de API Cianbox

interface CianboxTokenResponse {
  status: string;
  body: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  message?: string;
}

interface CianboxOrderItem {
  id: number;
  id_producto: number;
  cantidad: number;
  detalle: string;
  precio?: number;
  codigo_barras?: string;
  ubicacion?: string;
}

interface CianboxOrder {
  id: number;
  numero_pedido?: string;  // Número de pedido (ej: "00000093")
  fecha: string;
  cliente: string;
  localidad?: string;
  direccion?: string;
  id_estado: number;
  estado?: string;
  id_cliente?: number;
  observaciones?: string;
  detalles?: CianboxOrderItem[];
  total?: number;
  canal?: string;
  vigente?: boolean;   // false = eliminado en Cianbox
  anulado?: boolean;   // true = anulado en Cianbox
}

interface CianboxProduct {
  id: number;
  codigo: string;
  producto: string;
  codigo_barras?: string;
  ubicacion?: string;
  stock?: number;
  precio?: number;
}

interface CianboxApiResponse {
  status: string;
  body: any;
  message?: string;
  page?: string;
  total_pages?: number;
}

// Token cache for each tenant to avoid re-authenticating
// Cache de tokens por tenant para evitar re-autenticar
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

/**
 * Gets a valid access token for Cianbox
 * Obtiene un access token válido para Cianbox
 */
export async function getAccessToken(tenantId: string): Promise<string> {
  // Check cache first / Verificar cache primero
  const cached = tokenCache.get(tenantId);
  if (cached && new Date() < cached.expiresAt) {
    return cached.token;
  }

  // Get tenant's Cianbox connection credentials
  // Obtener credenciales de conexión Cianbox del tenant
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada para este tenant');
  }

  if (!connection.isActive) {
    throw new Error('La conexión Cianbox está desactivada');
  }

  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // Request access token / Solicitar token de acceso
  const response = await fetch(`${baseUrl}/auth/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_name: connection.appName,
      app_code: connection.appCode,
      user: connection.user,
      password: connection.password,
    }),
  });

  const data = (await response.json()) as CianboxTokenResponse;

  if (data.status !== 'ok' || !data.body?.access_token) {
    throw new Error(`Error de autenticación Cianbox: ${data.message || 'Respuesta inválida'}`);
  }

  // Cache token with 5-minute safety margin
  // Guardar en cache con margen de seguridad de 5 minutos
  const expiresAt = new Date(Date.now() + (data.body.expires_in - 300) * 1000);
  tokenCache.set(tenantId, {
    token: data.body.access_token,
    expiresAt,
  });

  return data.body.access_token;
}

/**
 * Fetches order statuses from Cianbox
 * Obtiene los estados de pedidos de Cianbox
 */
export async function fetchCianboxOrderStatuses(tenantId: string): Promise<any[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  const response = await fetch(`${baseUrl}/pedidos/estados?access_token=${token}`);
  const data = (await response.json()) as CianboxApiResponse;

  if (data.status !== 'ok') {
    throw new Error(`Error al obtener estados: ${data.message}`);
  }

  return data.body || [];
}

/**
 * Fetches orders from Cianbox with optional filters
 * Obtiene pedidos de Cianbox con filtros opcionales
 *
 * @param options.statusId - Single status ID / ID de estado único
 * @param options.statusIds - Multiple status IDs (comma-separated in API) / Múltiples IDs de estado
 */
export async function fetchCianboxOrders(
  tenantId: string,
  options: {
    statusId?: number;
    statusIds?: number[];
    limit?: number;
    page?: number;
    fechaDesde?: string;
    fechaHasta?: string;
  } = {}
): Promise<CianboxOrder[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // Build query params / Construir parámetros de consulta
  const params = new URLSearchParams({
    access_token: token,
  });

  // Support multiple status IDs with comma-separated format: id_estado=1,2,3
  // Soportar múltiples IDs de estado con formato separado por comas
  if (options.statusIds && options.statusIds.length > 0) {
    params.append('id_estado', options.statusIds.join(','));
  } else if (options.statusId) {
    params.append('id_estado', options.statusId.toString());
  }

  if (options.limit) params.append('limit', options.limit.toString());
  if (options.page) params.append('page', options.page.toString());
  if (options.fechaDesde) params.append('fecha_desde', options.fechaDesde);
  if (options.fechaHasta) params.append('fecha_hasta', options.fechaHasta);

  // Fetch first page to get total_pages
  // Obtener primera página para saber total_pages
  params.append('page', '1');

  const url = `${baseUrl}/pedidos/lista?${params.toString()}`;
  console.log(`[Cianbox API] Calling: ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);

  const response = await fetch(url);
  const data = (await response.json()) as CianboxApiResponse;

  if (data.status !== 'ok') {
    throw new Error(`Error al obtener pedidos: ${data.message}`);
  }

  let allOrders: CianboxOrder[] = data.body || [];
  const totalPages = data.total_pages || 1;

  console.log(`[Cianbox API] Page 1/${totalPages}, orders: ${allOrders.length}`);

  // Fetch remaining pages if there are more
  // Obtener páginas restantes si hay más
  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page++) {
      params.set('page', page.toString());
      const pageUrl = `${baseUrl}/pedidos/lista?${params.toString()}`;

      const pageResponse = await fetch(pageUrl);
      const pageData = (await pageResponse.json()) as CianboxApiResponse;

      if (pageData.status === 'ok' && pageData.body) {
        allOrders = allOrders.concat(pageData.body);
        console.log(`[Cianbox API] Page ${page}/${totalPages}, total orders: ${allOrders.length}`);
      }
    }
  }

  console.log(`[Cianbox API] Total orders fetched: ${allOrders.length}`);

  // Filter out orders that are not active (vigente=false or anulado=true)
  // Filtrar pedidos que no están activos (vigente=false o anulado=true)
  const activeOrders = allOrders.filter((order: CianboxOrder) => {
    const isVigente = order.vigente !== false; // true or undefined = vigente
    const isNotAnulado = order.anulado !== true; // false or undefined = no anulado
    return isVigente && isNotAnulado;
  });

  const filteredCount = allOrders.length - activeOrders.length;
  if (filteredCount > 0) {
    console.log(`[Cianbox API] Filtered out ${filteredCount} orders (vigente=false or anulado=true)`);
  }

  return activeOrders;
}

/**
 * Fetches product details from Cianbox
 * Obtiene detalles de productos de Cianbox
 */
export async function fetchCianboxProducts(
  tenantId: string,
  productIds: number[]
): Promise<Map<number, CianboxProduct>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // Cianbox accepts up to 200 IDs per request
  // Cianbox acepta hasta 200 IDs por request
  const idsString = productIds.slice(0, 200).join(',');
  const params = new URLSearchParams({
    access_token: token,
    id: idsString,
    fields: 'id,codigo,producto,codigo_barras,ubicacion',
  });

  const response = await fetch(`${baseUrl}/productos/lista?${params.toString()}`);
  const data = (await response.json()) as CianboxApiResponse;

  const productsMap = new Map<number, CianboxProduct>();

  if (data.status === 'ok' && Array.isArray(data.body)) {
    data.body.forEach((product: CianboxProduct) => {
      productsMap.set(product.id, product);
    });
  }

  return productsMap;
}

/**
 * Fetches current observations from a Cianbox order
 * Obtiene las observaciones actuales de un pedido en Cianbox
 */
export async function fetchCianboxOrderObservations(
  tenantId: string,
  cianboxOrderId: number
): Promise<string | null> {
  const order = await fetchCianboxOrderById(tenantId, cianboxOrderId);
  return order?.observaciones || null;
}

/**
 * Updates order observations in Cianbox (concatenates to existing)
 * Actualiza las observaciones de un pedido en Cianbox (concatena a las existentes)
 *
 * @param tenantId - ID del tenant
 * @param cianboxOrderId - ID del pedido en Cianbox
 * @param newObservation - Nueva observación a agregar (se concatena a las existentes)
 * @param concatenate - Si es true, concatena a las observaciones existentes (default: true)
 */
export async function updateCianboxOrderObservations(
  tenantId: string,
  cianboxOrderId: number,
  newObservation: string,
  concatenate: boolean = true
): Promise<boolean> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // Si concatenate es true, obtener observaciones actuales primero
  let finalObservation = newObservation;
  if (concatenate) {
    const currentObservations = await fetchCianboxOrderObservations(tenantId, cianboxOrderId);
    if (currentObservations) {
      finalObservation = `${currentObservations}\n\n--------------------\n\n${newObservation}`;
    }
  }

  const url = `${baseUrl}/pedidos/editar-observaciones?id=${cianboxOrderId}&access_token=${token}`;
  const payload = { observaciones: finalObservation };

  console.log(`[Cianbox API] PUT ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);
  console.log(`[Cianbox API] Payload observaciones length: ${finalObservation.length} chars`);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CianboxApiResponse;

  console.log(`[Cianbox API] Response: ${JSON.stringify(data)}`);

  if (data.status !== 'ok') {
    throw new Error(`Error al actualizar observaciones: ${data.message || JSON.stringify(data)}`);
  }

  return true;
}

/**
 * Updates order status in Cianbox
 * Actualiza el estado de un pedido en Cianbox
 */
export async function updateCianboxOrderStatus(
  tenantId: string,
  cianboxOrderId: number,
  newStatusId: number
): Promise<boolean> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  const url = `${baseUrl}/pedidos/editar-estado?id=${cianboxOrderId}&access_token=${token}`;
  const payload = { id_estado: newStatusId };

  console.log(`[Cianbox API] PUT ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);
  console.log(`[Cianbox API] Payload: ${JSON.stringify(payload)}`);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CianboxApiResponse;

  console.log(`[Cianbox API] Response: ${JSON.stringify(data)}`);

  if (data.status !== 'ok') {
    throw new Error(`Error al actualizar estado: ${data.message || JSON.stringify(data)}`);
  }

  return true;
}

// Channel mapping type / Tipo de mapeo de canal
type OrderChannelType = 'ECOMMERCE' | 'ML' | 'DIRECTO' | 'B2B';
type OrderPriorityType = 'ALTA' | 'MEDIA' | 'BAJA';

/**
 * Maps Cianbox channel to our enum
 * Mapea canal de Cianbox a nuestro enum
 */
function mapChannel(cianboxCanal?: string): OrderChannelType {
  if (!cianboxCanal) return 'DIRECTO';

  const canal = cianboxCanal.toLowerCase();
  if (canal.includes('mercado') || canal.includes('ml')) return 'ML';
  if (canal.includes('ecommerce') || canal.includes('tienda')) return 'ECOMMERCE';
  if (canal.includes('b2b') || canal.includes('mayorista')) return 'B2B';
  return 'DIRECTO';
}

/**
 * Determines priority based on order data
 * Determina prioridad basada en datos del pedido
 */
function determinePriority(order: CianboxOrder): OrderPriorityType {
  // Default to MEDIA, can be customized per client logic
  // Por defecto MEDIA, se puede customizar según lógica del cliente
  const clientName = order.cliente?.toLowerCase() || '';
  if (clientName.includes('urgente') || clientName.includes('alta')) return 'ALTA';
  if (clientName.includes('baja')) return 'BAJA';
  return 'MEDIA';
}

/**
 * Syncs orders from Cianbox to local database
 * Sincroniza pedidos de Cianbox a la base de datos local
 *
 * @param tenantId - ID of the tenant / ID del tenant
 * @param options - Sync options / Opciones de sincronización
 * @returns Sync result with counts / Resultado de sincronización con conteos
 */
export async function syncOrdersFromCianbox(
  tenantId: string,
  options: {
    statusId?: number;
    limit?: number;
  } = {}
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    // Get tenant's initial status (Pendiente)
    // Obtener estado inicial del tenant (Pendiente)
    const initialStatus = await prisma.orderStatus.findFirst({
      where: {
        tenantId,
        isInitial: true,
      },
    });

    if (!initialStatus) {
      throw new Error('No hay estado inicial configurado para el tenant');
    }

    // Get tenant settings to check syncStatusIds
    // Obtener configuración del tenant para verificar syncStatusIds
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = typeof tenant?.settings === 'string'
      ? JSON.parse(tenant.settings)
      : tenant?.settings || {};

    // Determine which Cianbox status IDs to sync
    // Determinar qué IDs de estado de Cianbox sincronizar
    let cianboxStatusIdsToSync: number[] = [];

    if (options.statusId) {
      // If specific statusId provided, use it
      cianboxStatusIdsToSync = [options.statusId];
    } else if (settings.syncStatusIds && settings.syncStatusIds.length > 0) {
      // If tenant has syncStatusIds configured, get their cianboxStatusId
      // Si el tenant tiene syncStatusIds configurados, obtener sus cianboxStatusId
      const localStatuses = await prisma.orderStatus.findMany({
        where: {
          id: { in: settings.syncStatusIds },
          cianboxStatusId: { not: null },
        },
        select: { cianboxStatusId: true },
      });
      cianboxStatusIdsToSync = localStatuses
        .map(s => s.cianboxStatusId)
        .filter((id): id is number => id !== null);

      console.log('[Cianbox Sync] Using configured syncStatusIds, Cianbox IDs:', cianboxStatusIdsToSync);
    }

    // If no status IDs to sync, use default 44
    // Si no hay IDs de estado para sincronizar, usar default 44
    if (cianboxStatusIdsToSync.length === 0) {
      cianboxStatusIdsToSync = [44];
      console.log('[Cianbox Sync] No syncStatusIds configured, using default: 44');
    }

    // Fetch orders in a single API call using comma-separated status IDs
    // Obtener pedidos en una sola llamada API usando IDs de estado separados por comas
    console.log(`[Cianbox Sync] Fetching orders with Cianbox status IDs: ${cianboxStatusIdsToSync.join(',')}`);
    const cianboxOrders = await fetchCianboxOrders(tenantId, {
      statusIds: cianboxStatusIdsToSync,
      limit: options.limit || 100,
    });
    console.log(`[Cianbox Sync] Found ${cianboxOrders.length} orders total`);

    // Build maps from local statuses table (already has cianboxStatusId mapped)
    // Construir mapas desde tabla de estados locales (ya tiene cianboxStatusId mapeado)
    const allLocalStatuses = await prisma.orderStatus.findMany({
      where: { tenantId },
      select: { id: true, name: true, cianboxStatusId: true },
    });

    // Map: status name (uppercase) -> { localId, cianboxStatusId }
    const statusNameToLocal = new Map<string, { id: string; cianboxStatusId: number | null }>();
    allLocalStatuses.forEach(s => {
      statusNameToLocal.set(s.name.toUpperCase(), { id: s.id, cianboxStatusId: s.cianboxStatusId });
    });

    if (cianboxOrders.length === 0) {
      return result;
    }

    // Deduplicate orders by ID (same order may appear in multiple pages)
    // Deduplicar pedidos por ID (el mismo pedido puede aparecer en múltiples páginas)
    const uniqueOrdersMap = new Map<number, CianboxOrder>();
    cianboxOrders.forEach(order => {
      uniqueOrdersMap.set(order.id, order);
    });
    const uniqueOrders = Array.from(uniqueOrdersMap.values());
    console.log(`[Cianbox Sync] Deduplicated: ${cianboxOrders.length} -> ${uniqueOrders.length} unique orders`);

    // Collect product IDs to look up in local database
    // Recolectar IDs de productos para buscar en base de datos local
    const productIds = new Set<number>();
    uniqueOrders.forEach((order: CianboxOrder) => {
      (order.detalles || []).forEach((item: CianboxOrderItem) => {
        if (item.id_producto) {
          productIds.add(item.id_producto);
        }
      });
    });

    // Fetch product details from LOCAL database (normalized data)
    // Obtener detalles de productos de la base de datos LOCAL (datos normalizados)
    const localProducts = await prisma.product.findMany({
      where: {
        tenantId,
        cianboxProductId: { in: Array.from(productIds) },
      },
      select: {
        id: true,
        cianboxProductId: true,
        sku: true,
        name: true,
        ean: true,
        location: true,
      },
    });

    // Create map for quick lookup by cianboxProductId
    // Crear mapa para búsqueda rápida por cianboxProductId
    const localProductsMap = new Map<number, typeof localProducts[0]>();
    localProducts.forEach(p => {
      if (p.cianboxProductId) {
        localProductsMap.set(p.cianboxProductId, p);
      }
    });

    // Process each order / Procesar cada pedido
    for (const cianboxOrder of uniqueOrders) {
      try {
        // Check if already exists / Verificar si ya existe
        const existingOrder = await prisma.order.findUnique({
          where: {
            tenantId_cianboxOrderId: {
              tenantId,
              cianboxOrderId: cianboxOrder.id,
            },
          },
        });

        if (existingOrder) {
          // Update existing order / Actualizar pedido existente
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              syncedAt: new Date(),
              orderNumber: cianboxOrder.numero_pedido || existingOrder.orderNumber,
            },
          });

          // Update items from LOCAL product data (normalized)
          // Actualizar items desde datos de producto LOCAL (normalizados)
          const detalles = cianboxOrder.detalles || [];
          for (const item of detalles) {
            if (item.id_producto > 0 && item.id) {
              const localProduct = localProductsMap.get(item.id_producto);

              // Use local product data if available, otherwise keep existing
              // Usar datos del producto local si está disponible, sino mantener existentes
              if (localProduct) {
                await prisma.orderItem.updateMany({
                  where: {
                    orderId: existingOrder.id,
                    cianboxItemId: item.id,
                  },
                  data: {
                    productId: localProduct.id,
                    sku: localProduct.sku,
                    name: localProduct.name,
                    ean: localProduct.ean,
                    location: localProduct.location,
                  },
                });
              }
            }
          }

          result.updated++;
          continue;
        }

        // Create new order with items using LOCAL product data
        // Crear nuevo pedido con items usando datos de producto LOCAL
        // Filter out items with id_producto = 0 (shipping, discounts, etc.)
        // Filtrar items con id_producto = 0 (envíos, descuentos, etc.)
        const items = (cianboxOrder.detalles || [])
          .filter((item: CianboxOrderItem) => item.id_producto > 0)
          .map((item: CianboxOrderItem) => {
            const localProduct = localProductsMap.get(item.id_producto);

            // Use local product data if available, otherwise use Cianbox detalle as fallback
            // Usar datos del producto local si está disponible, sino usar detalle de Cianbox como fallback
            const name = localProduct?.name || item.detalle || 'Producto sin nombre';
            const sku = localProduct?.sku || null;
            const ean = localProduct?.ean || null;
            const location = localProduct?.location || null;
            const productId = localProduct?.id || null;

            return {
              cianboxItemId: item.id,
              productId,
              sku,
              name,
              ean,
              location,
              quantityRequired: item.cantidad || 1,
              quantityPicked: 0,
              status: 'PENDIENTE' as const,
            };
          });

        // Find local status that matches Cianbox estado by name
        // Buscar estado local que coincida con el nombre de estado de Cianbox
        let orderStatusId = initialStatus.id;
        let orderCianboxStatusId: number | null = null;

        if (cianboxOrder.estado) {
          const matchedStatus = statusNameToLocal.get(cianboxOrder.estado.toUpperCase());
          if (matchedStatus) {
            orderStatusId = matchedStatus.id;
            orderCianboxStatusId = matchedStatus.cianboxStatusId;
          }
        }

        await prisma.order.create({
          data: {
            tenantId,
            cianboxOrderId: cianboxOrder.id,
            orderNumber: cianboxOrder.numero_pedido || null,
            clientName: cianboxOrder.cliente || 'Sin cliente',
            clientAddress: cianboxOrder.direccion || cianboxOrder.localidad || null,
            channel: mapChannel(cianboxOrder.canal),
            priority: determinePriority(cianboxOrder),
            slaDate: cianboxOrder.fecha && !isNaN(new Date(cianboxOrder.fecha).getTime())
              ? new Date(cianboxOrder.fecha)
              : null,
            statusId: orderStatusId,
            notes: cianboxOrder.observaciones || null,
            syncedAt: new Date(),
            metadata: {
              cianboxEstado: cianboxOrder.estado,
              cianboxStatusId: orderCianboxStatusId,
              cianboxIdCliente: cianboxOrder.id_cliente,
              cianboxTotal: cianboxOrder.total,
              cianboxVigente: cianboxOrder.vigente,
              cianboxAnulado: cianboxOrder.anulado,
            },
            items: {
              create: items,
            },
          },
        });

        result.imported++;
      } catch (orderError: any) {
        result.errors.push(`Pedido ${cianboxOrder.id}: ${orderError.message}`);
      }
    }

    // Update lastSync in connection / Actualizar lastSync de la conexión
    await prisma.cianboxConnection.update({
      where: { tenantId },
      data: {
        lastSync: new Date(),
        syncStatus: `Importados: ${result.imported}, Actualizados: ${result.updated}`,
      },
    });

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Syncs order statuses from Cianbox to local database
 * Sincroniza estados de pedidos desde Cianbox a la base de datos local
 *
 * @param tenantId - ID of the tenant / ID del tenant
 * @returns Sync result with counts / Resultado de sincronización con conteos
 */
export async function syncOrderStatusesFromCianbox(
  tenantId: string
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    // Fetch statuses from Cianbox / Obtener estados de Cianbox
    const cianboxStatuses = await fetchCianboxOrderStatuses(tenantId);

    if (cianboxStatuses.length === 0) {
      return result;
    }

    // Generate a color based on status ID / Generar color basado en ID de estado
    const generateColor = (id: number): string => {
      const colors = [
        '#F59E0B', // Amarillo
        '#3B82F6', // Azul
        '#10B981', // Verde
        '#8B5CF6', // Púrpura
        '#EF4444', // Rojo
        '#EC4899', // Rosa
        '#06B6D4', // Cyan
        '#F97316', // Naranja
        '#84CC16', // Lima
        '#6366F1', // Indigo
      ];
      return colors[id % colors.length];
    };

    // Process each status / Procesar cada estado
    for (const cianboxStatus of cianboxStatuses) {
      try {
        // Check if status already exists by cianboxStatusId
        // Verificar si el estado ya existe por cianboxStatusId
        const existingStatus = await prisma.orderStatus.findFirst({
          where: {
            tenantId,
            cianboxStatusId: cianboxStatus.id,
          },
        });

        if (existingStatus) {
          // Check if updating the name would cause a conflict
          // Verificar si actualizar el nombre causaría conflicto
          const existingByName = await prisma.orderStatus.findFirst({
            where: {
              tenantId,
              name: cianboxStatus.estado,
              id: { not: existingStatus.id }, // Exclude current record
            },
          });

          const statusName = existingByName
            ? `${cianboxStatus.estado} (${cianboxStatus.id})`
            : cianboxStatus.estado;

          // Update existing status / Actualizar estado existente
          await prisma.orderStatus.update({
            where: { id: existingStatus.id },
            data: {
              name: statusName,
              isActive: cianboxStatus.vigente === 1 || cianboxStatus.vigente === true,
            },
          });
          result.updated++;
        } else {
          // Get max sortOrder for new status
          // Obtener máximo sortOrder para nuevo estado
          const maxSortOrder = await prisma.orderStatus.aggregate({
            where: { tenantId },
            _max: { sortOrder: true },
          });

          // Check if name already exists (duplicate in Cianbox)
          // Verificar si el nombre ya existe (duplicado en Cianbox)
          const existingByName = await prisma.orderStatus.findFirst({
            where: { tenantId, name: cianboxStatus.estado },
          });

          // If name exists, append Cianbox ID to make it unique
          // Si el nombre existe, agregar ID de Cianbox para hacerlo único
          const statusName = existingByName
            ? `${cianboxStatus.estado} (${cianboxStatus.id})`
            : cianboxStatus.estado;

          // Create new status / Crear nuevo estado
          await prisma.orderStatus.create({
            data: {
              tenantId,
              name: statusName,
              cianboxStatusId: cianboxStatus.id,
              color: generateColor(cianboxStatus.id),
              isActive: cianboxStatus.vigente === 1 || cianboxStatus.vigente === true,
              sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
              isInitial: false,
              isFinal: false,
            },
          });
          result.imported++;
        }
      } catch (statusError: any) {
        result.errors.push(`Estado ${cianboxStatus.id}: ${statusError.message}`);
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Fetches a single order from Cianbox by ID
 * Obtiene un pedido individual de Cianbox por ID
 */
export async function fetchCianboxOrderById(
  tenantId: string,
  cianboxOrderId: number
): Promise<CianboxOrder | null> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  const params = new URLSearchParams({
    access_token: token,
    id: cianboxOrderId.toString(),
  });

  const response = await fetch(`${baseUrl}/pedidos/lista?${params.toString()}`);
  const data = (await response.json()) as CianboxApiResponse;

  if (data.status !== 'ok' || !Array.isArray(data.body) || data.body.length === 0) {
    return null;
  }

  return data.body[0] as CianboxOrder;
}

/**
 * Cleans up orders that are no longer valid in Cianbox (vigente=false or anulado=true)
 * Limpia pedidos que ya no son válidos en Cianbox (vigente=false o anulado=true)
 *
 * @param tenantId - ID of the tenant / ID del tenant
 * @returns Cleanup result / Resultado de la limpieza
 */
export async function cleanupInvalidCianboxOrders(
  tenantId: string
): Promise<{
  checked: number;
  deleted: number;
  errors: string[];
}> {
  const result = { checked: 0, deleted: 0, errors: [] as string[] };

  try {
    // Get all orders with cianboxOrderId for this tenant
    // Obtener todos los pedidos con cianboxOrderId para este tenant
    const localOrders = await prisma.order.findMany({
      where: {
        tenantId,
        cianboxOrderId: { not: null },
      },
      select: {
        id: true,
        cianboxOrderId: true,
        clientName: true,
      },
    });

    console.log(`[Cianbox Cleanup] Checking ${localOrders.length} orders for tenant ${tenantId}`);

    for (const localOrder of localOrders) {
      result.checked++;

      try {
        // Fetch order from Cianbox
        const cianboxOrder = await fetchCianboxOrderById(tenantId, localOrder.cianboxOrderId!);

        // If order doesn't exist in Cianbox or is vigente=false or anulado=true, delete it
        if (!cianboxOrder || cianboxOrder.vigente === false || cianboxOrder.anulado === true) {
          const reason = !cianboxOrder ? 'no existe en Cianbox'
            : cianboxOrder.anulado ? 'anulado'
            : 'vigente=false';

          console.log(`[Cianbox Cleanup] Deleting order ${localOrder.cianboxOrderId} (${localOrder.clientName}): ${reason}`);

          // Delete order and all related data (cascade)
          await prisma.order.delete({
            where: { id: localOrder.id },
          });

          result.deleted++;
        }
      } catch (orderError: any) {
        result.errors.push(`Pedido ${localOrder.cianboxOrderId}: ${orderError.message}`);
      }
    }

    console.log(`[Cianbox Cleanup] Finished: checked ${result.checked}, deleted ${result.deleted}`);

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Tests the connection to Cianbox
 * Prueba la conexión con Cianbox
 */
export async function testCianboxConnection(tenantId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const token = await getAccessToken(tenantId);

    // Try to fetch statuses as a test / Intentar obtener estados como prueba
    const statuses = await fetchCianboxOrderStatuses(tenantId);

    return {
      success: true,
      message: 'Conexión exitosa',
      details: {
        tokenObtained: !!token,
        orderStatusesCount: statuses.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

// ============================================
// MERCADOLIBRE SALES (Ventas de MercadoLibre)
// ============================================

interface CianboxMeliSale {
  id: number;
  id_venta_ml?: string;
  id_envio_ml?: string;
  id_pack_ml?: string;
  id_publicacion_ml?: string;
  razon: string;                  // Nombre del comprador
  email?: string;
  tel?: string;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string;
  fecha_creacion: string;
  fecha_cierre?: string;
  fecha_vencimiento?: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  comision?: number;
  impuesto?: number;
  costo_envio?: number;
  cobrado: boolean;
  despachado: boolean;
  recibido?: boolean;
  completado?: boolean;
  cancelada: boolean;
  vigente: boolean;
  logistica?: string;
  tracking_number?: string;
  detalle?: string;               // Variante/SKU del producto
  detalle_cuenta_ml?: {
    id?: string;
    nombre?: string;
  };
  detalles_cuenta_ml?: {
    id?: string;
    nombre?: string;
  };
}

/**
 * Fetches MercadoLibre sales from Cianbox
 * Obtiene ventas de MercadoLibre desde Cianbox
 *
 * Cianbox API returns 50 items per page by default without total_pages info
 * Strategy: Paginate using order=create-date-desc and stop when we find sales older than cutoffDays
 *
 * La API de Cianbox retorna 50 items por página por defecto sin info de total_pages
 * Estrategia: Paginar usando order=create-date-desc y detenerse cuando encontremos ventas más antiguas que cutoffDays
 *
 * Available params for /mercadolibre/ventas/lista:
 * - despachado: 0|1
 * - cobrado: 0|1
 * - vigente: 0|1
 * - order: create-date-asc|create-date-desc|update-date-asc|update-date-desc|id-asc|id-desc|id_venta_ml-asc|id_venta_ml-desc
 * - page: number
 */
export async function fetchMeliVentas(
  tenantId: string,
  options: {
    despachado?: boolean;
    cobrado?: boolean;
    vigente?: boolean;
    order?: string;
    cutoffDays?: number; // Stop fetching sales older than this (default: 30 days = 1 month)
    onFetchProgress?: (progress: {
      page: number;
      salesInPage: number;
      withinCutoff: number;
      totalSoFar: number;
    }) => void;
  } = {}
): Promise<CianboxMeliSale[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // Build query params / Construir parámetros de consulta
  const params = new URLSearchParams({
    access_token: token,
  });

  // Add filters / Agregar filtros
  if (options.despachado !== undefined) {
    params.append('despachado', options.despachado ? '1' : '0');
  }
  if (options.cobrado !== undefined) {
    params.append('cobrado', options.cobrado ? '1' : '0');
  }
  if (options.vigente !== undefined) {
    params.append('vigente', options.vigente ? '1' : '0');
  }

  // Order by create date descending to get recent sales first
  // Ordenar por fecha de creación descendente para obtener ventas recientes primero
  params.append('order', options.order || 'create-date-desc');

  // Calculate cutoff date (default: 30 days ago = 1 month)
  // Calcular fecha de corte (default: 30 días atrás = 1 mes)
  const cutoffDays = options.cutoffDays ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
  console.log(`[Cianbox MELI] Cutoff date: ${cutoffDate.toISOString().split('T')[0]} (${cutoffDays} days ago)`);

  // Cianbox defaults to 50 per page
  // Cianbox usa 50 por página por defecto
  const perPage = 50;

  let allSales: CianboxMeliSale[] = [];
  let currentPage = 1;
  const maxPages = 100; // Safety limit: 100 pages x 50 = 5000 sales max
  let hasMoreData = true;
  let reachedCutoff = false;

  console.log(`[Cianbox MELI] Starting fetch with order=${options.order || 'create-date-desc'}`);

  // Use /lista endpoint with pagination
  // Usar endpoint /lista con paginación
  while (hasMoreData && currentPage <= maxPages && !reachedCutoff) {
    params.set('page', currentPage.toString());
    const url = `${baseUrl}/mercadolibre/ventas/lista?${params.toString()}`;

    if (currentPage === 1) {
      console.log(`[Cianbox MELI] Calling: ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);
    }

    const response = await fetch(url);
    const data = (await response.json()) as CianboxApiResponse;

    if (data.status !== 'ok') {
      throw new Error(`Error al obtener ventas MELI: ${data.message}`);
    }

    const pageSales: CianboxMeliSale[] = data.body || [];

    if (pageSales.length === 0) {
      // No more data / No hay más datos
      hasMoreData = false;
      console.log(`[Cianbox MELI] Page ${currentPage}, no more sales`);
    } else {
      // Filter sales that are within the cutoff period
      // Filtrar ventas que están dentro del período de corte
      const salesWithinCutoff: CianboxMeliSale[] = [];

      for (const sale of pageSales) {
        const saleDate = new Date(sale.fecha_creacion);
        if (saleDate >= cutoffDate) {
          salesWithinCutoff.push(sale);
        } else {
          // Found a sale older than cutoff, stop after this page
          // Encontramos una venta más antigua que el corte, detenerse después de esta página
          reachedCutoff = true;
          console.log(`[Cianbox MELI] Page ${currentPage}, found sale from ${sale.fecha_creacion} (older than cutoff), stopping`);
          break;
        }
      }

      allSales = allSales.concat(salesWithinCutoff);
      console.log(`[Cianbox MELI] Page ${currentPage}, sales in page: ${pageSales.length}, within cutoff: ${salesWithinCutoff.length}, total so far: ${allSales.length}`);

      // Call progress callback if provided / Llamar callback de progreso si está disponible
      if (options.onFetchProgress) {
        options.onFetchProgress({
          page: currentPage,
          salesInPage: pageSales.length,
          withinCutoff: salesWithinCutoff.length,
          totalSoFar: allSales.length,
        });
      }

      currentPage++;

      // If we got less than perPage, we've reached the last page
      // Si recibimos menos de perPage, llegamos a la última página
      if (pageSales.length < perPage) {
        hasMoreData = false;
      }
    }
  }

  if (reachedCutoff) {
    console.log(`[Cianbox MELI] Stopped at cutoff date (${cutoffDays} days ago)`);
  } else if (currentPage > maxPages) {
    console.warn(`[Cianbox MELI] Reached max pages limit (${maxPages}), there may be more data`);
  }

  console.log(`[Cianbox MELI] Total sales fetched (last ${cutoffDays} days): ${allSales.length}`);

  return allSales;
}

/**
 * Maps Cianbox logistica string to our enum
 * Mapea string de logística de Cianbox a nuestro enum
 */
function mapMeliLogistica(logistica?: string): 'ME2' | 'ME1' | 'CROSS_DOCKING' | 'DROP_OFF' | 'CUSTOM' {
  if (!logistica) return 'CUSTOM';

  const log = logistica.toLowerCase();
  if (log.includes('fulfillment') || log.includes('me2') || log.includes('full')) return 'ME2';
  if (log.includes('mercado envio') || log.includes('me1')) return 'ME1';
  if (log.includes('cross') || log.includes('docking')) return 'CROSS_DOCKING';
  if (log.includes('drop') || log.includes('off')) return 'DROP_OFF';
  return 'CUSTOM';
}

// Helper functions to convert Cianbox string values to proper types
// Funciones helper para convertir valores string de Cianbox a tipos correctos
const toInt = (val: any): number => {
  if (typeof val === 'number') return Math.floor(val);
  if (typeof val === 'string') return parseInt(val, 10) || 0;
  return 0;
};

const toFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
};

const toBool = (val: any): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
  if (typeof val === 'number') return val === 1;
  return false;
};

// Handle detalle field which can be string or object
// Manejar campo detalle que puede ser string u objeto
const getProductoVariante = (detalle: any): string | null => {
  if (!detalle) return null;
  if (typeof detalle === 'string') return detalle;
  if (typeof detalle === 'object') return JSON.stringify(detalle);
  return String(detalle);
};

/**
 * Extracts cianboxProductId from productoVariante JSON
 * Extrae cianboxProductId del JSON productoVariante
 */
const extractCianboxProductId = (detalle: any): number | null => {
  if (!detalle) return null;

  try {
    const parsed = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;

    // Primero intentar con productos_publicacion
    if (parsed?.productos_publicacion?.[0]?.id_producto) {
      return parsed.productos_publicacion[0].id_producto;
    }
    // Si no, usar id_variante como cianboxProductId
    if (parsed?.id_variante) {
      const varianteId = parseInt(parsed.id_variante, 10);
      if (!isNaN(varianteId)) return varianteId;
    }
  } catch (e) {
    // Ignorar errores de parsing
  }
  return null;
};

/**
 * Saves a batch of MercadoLibre sales to the database
 * Guarda un lote de ventas de MercadoLibre en la base de datos
 * Now also extracts cianboxProductId and links to Product automatically
 * Ahora también extrae cianboxProductId y vincula a Product automáticamente
 */
async function saveMeliSalesBatch(
  tenantId: string,
  sales: CianboxMeliSale[],
  result: { imported: number; updated: number; errors: string[] },
  productCache?: Map<number, { id: string; sku: string | null } | null>
): Promise<void> {
  // Build product cache if not provided (for batch optimization)
  // Construir cache de productos si no se proporciona (para optimización de lotes)
  if (!productCache) {
    productCache = new Map();
    // Extract all cianboxProductIds from sales
    const cianboxIds: number[] = [];
    for (const sale of sales) {
      const cianboxProductId = extractCianboxProductId(sale.detalle);
      if (cianboxProductId && !cianboxIds.includes(cianboxProductId)) {
        cianboxIds.push(cianboxProductId);
      }
    }
    // Fetch all products in one query
    if (cianboxIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { tenantId, cianboxProductId: { in: cianboxIds } },
        select: { id: true, sku: true, cianboxProductId: true },
      });
      for (const p of products) {
        if (p.cianboxProductId) {
          productCache.set(p.cianboxProductId, { id: p.id, sku: p.sku });
        }
      }
    }
  }

  for (const sale of sales) {
    try {
      // Check if already exists / Verificar si ya existe
      const existingSale = await prisma.meliSale.findUnique({
        where: {
          tenantId_cianboxMeliId: {
            tenantId,
            cianboxMeliId: sale.id,
          },
        },
      });

      // Get account info from either detalle_cuenta_ml or detalles_cuenta_ml
      const accountInfo = sale.detalle_cuenta_ml || sale.detalles_cuenta_ml;

      // Extract cianboxProductId and find linked product
      // Extraer cianboxProductId y buscar producto vinculado
      const cianboxProductId = extractCianboxProductId(sale.detalle);
      const linkedProduct = cianboxProductId ? productCache.get(cianboxProductId) : null;

      const saleData = {
        idVentaMl: sale.id_venta_ml || null,
        idEnvioMl: sale.id_envio_ml || null,
        idPackMl: sale.id_pack_ml || null,
        idPublicacionMl: sale.id_publicacion_ml || null,
        compradorNombre: sale.razon || 'Sin nombre',
        compradorEmail: sale.email || null,
        compradorTelefono: sale.tel || null,
        direccion: sale.domicilio || null,
        localidad: sale.localidad || null,
        provincia: sale.provincia || null,
        codigoPostal: sale.codigo_postal || null,
        fechaCreacion: new Date(sale.fecha_creacion),
        fechaCierre: sale.fecha_cierre ? new Date(sale.fecha_cierre) : null,
        fechaVencimiento: sale.fecha_vencimiento ? new Date(sale.fecha_vencimiento) : null,
        cantidad: toInt(sale.cantidad) || 1,
        precioUnitario: toFloat(sale.precio_unitario) || 0,
        total: toFloat(sale.total) || 0,
        comision: sale.comision != null ? toFloat(sale.comision) : null,
        impuesto: sale.impuesto != null ? toFloat(sale.impuesto) : null,
        costoEnvio: sale.costo_envio != null ? toFloat(sale.costo_envio) : null,
        cobrado: toBool(sale.cobrado),
        despachado: toBool(sale.despachado),
        recibido: toBool(sale.recibido),
        completado: toBool(sale.completado),
        cancelada: toBool(sale.cancelada),
        vigente: sale.vigente == null ? true : toBool(sale.vigente),
        logistica: mapMeliLogistica(sale.logistica),
        trackingNumber: sale.tracking_number || null,
        cuentaMlId: accountInfo?.id ? String(accountInfo.id) : null,
        cuentaMlNombre: accountInfo?.nombre || null,
        productoTitulo: null as string | null,
        productoSku: linkedProduct?.sku || null,
        productoVariante: getProductoVariante(sale.detalle),
        cianboxProductId: cianboxProductId,
        productId: linkedProduct?.id || null,
        lastSyncedAt: new Date(),
      };

      if (existingSale) {
        // Update existing sale / Actualizar venta existente
        await prisma.meliSale.update({
          where: { id: existingSale.id },
          data: saleData,
        });
        result.updated++;
      } else {
        // Create new sale / Crear nueva venta
        await prisma.meliSale.create({
          data: {
            tenantId,
            cianboxMeliId: sale.id,
            ...saleData,
          },
        });
        result.imported++;
      }
    } catch (saleError: any) {
      result.errors.push(`Venta MELI ${sale.id}: ${saleError.message}`);
    }
  }
}

/**
 * Syncs MercadoLibre sales from Cianbox to local database - INCREMENTAL VERSION
 * Sincroniza ventas de MercadoLibre de Cianbox a la base de datos local - VERSION INCREMENTAL
 *
 * Fetches and SAVES each page of 50 sales immediately (no waiting for all pages)
 * This prevents frontend timeouts for large datasets
 *
 * Obtiene y GUARDA cada página de 50 ventas inmediatamente (sin esperar todas las páginas)
 * Esto previene timeouts del frontend para grandes volúmenes de datos
 */
export async function syncMeliVentasFromCianbox(
  tenantId: string,
  options: {
    despachado?: boolean;
    cobrado?: boolean;
    vigente?: boolean;
    order?: string;
    cutoffDays?: number; // Default: 30 days (1 month)
    onPageProgress?: (progress: {
      page: number;
      salesInPage: number;
      savedInPage: number;
      totalFetched: number;
      totalImported: number;
      totalUpdated: number;
    }) => void;
  } = {}
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      throw new Error('No hay conexión Cianbox configurada');
    }

    const token = await getAccessToken(tenantId);
    const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

    // Build query params / Construir parámetros de consulta
    const params = new URLSearchParams({
      access_token: token,
    });

    // Add filters / Agregar filtros
    if (options.despachado !== undefined) {
      params.append('despachado', options.despachado ? '1' : '0');
    }
    if (options.cobrado !== undefined) {
      params.append('cobrado', options.cobrado ? '1' : '0');
    }
    if (options.vigente !== undefined) {
      params.append('vigente', options.vigente ? '1' : '0');
    }

    // Order by create date descending to get recent sales first
    params.append('order', options.order || 'create-date-desc');

    // Calculate cutoff date (default: 30 days ago = 1 month)
    const cutoffDays = options.cutoffDays ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
    console.log(`[Cianbox MELI Incremental] Cutoff date: ${cutoffDate.toISOString().split('T')[0]} (${cutoffDays} days ago)`);

    const perPage = 50;
    let currentPage = 1;
    const maxPages = 100; // Safety limit
    let hasMoreData = true;
    let reachedCutoff = false;
    let totalFetched = 0;

    console.log(`[Cianbox MELI Incremental] Starting incremental fetch+save...`);

    // INCREMENTAL: Fetch each page and save immediately
    // INCREMENTAL: Obtener cada página y guardar inmediatamente
    while (hasMoreData && currentPage <= maxPages && !reachedCutoff) {
      params.set('page', currentPage.toString());
      const url = `${baseUrl}/mercadolibre/ventas/lista?${params.toString()}`;

      if (currentPage === 1) {
        console.log(`[Cianbox MELI Incremental] Calling: ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);
      }

      const response = await fetch(url);
      const data = (await response.json()) as CianboxApiResponse;

      if (data.status !== 'ok') {
        throw new Error(`Error al obtener ventas MELI: ${data.message}`);
      }

      const pageSales: CianboxMeliSale[] = data.body || [];

      if (pageSales.length === 0) {
        hasMoreData = false;
        console.log(`[Cianbox MELI Incremental] Page ${currentPage}, no more sales`);
      } else {
        // Filter sales within cutoff period
        const salesWithinCutoff: CianboxMeliSale[] = [];

        for (const sale of pageSales) {
          const saleDate = new Date(sale.fecha_creacion);
          if (saleDate >= cutoffDate) {
            salesWithinCutoff.push(sale);
          } else {
            reachedCutoff = true;
            console.log(`[Cianbox MELI Incremental] Page ${currentPage}, found sale from ${sale.fecha_creacion} (older than cutoff), stopping after this page`);
            break;
          }
        }

        totalFetched += salesWithinCutoff.length;

        // SAVE THIS PAGE IMMEDIATELY / GUARDAR ESTA PÁGINA INMEDIATAMENTE
        const prevImported = result.imported;
        const prevUpdated = result.updated;

        if (salesWithinCutoff.length > 0) {
          await saveMeliSalesBatch(tenantId, salesWithinCutoff, result);
        }

        const savedInPage = (result.imported - prevImported) + (result.updated - prevUpdated);

        console.log(`[Cianbox MELI Incremental] Page ${currentPage}: fetched ${salesWithinCutoff.length}, saved ${savedInPage}, total: fetched=${totalFetched}, imported=${result.imported}, updated=${result.updated}`);

        // Call progress callback after each page saved
        // Llamar callback de progreso después de guardar cada página
        if (options.onPageProgress) {
          options.onPageProgress({
            page: currentPage,
            salesInPage: pageSales.length,
            savedInPage,
            totalFetched,
            totalImported: result.imported,
            totalUpdated: result.updated,
          });
        }

        currentPage++;

        // If we got less than perPage, we've reached the last page
        if (pageSales.length < perPage) {
          hasMoreData = false;
        }
      }
    }

    if (reachedCutoff) {
      console.log(`[Cianbox MELI Incremental] Stopped at cutoff date (${cutoffDays} days ago)`);
    } else if (currentPage > maxPages) {
      console.warn(`[Cianbox MELI Incremental] Reached max pages limit (${maxPages}), there may be more data`);
    }

    console.log(`[Cianbox MELI Incremental] COMPLETED: total fetched=${totalFetched}, imported=${result.imported}, updated=${result.updated}`);

    // Update lastSync in connection / Actualizar lastSync de la conexión
    await prisma.cianboxConnection.update({
      where: { tenantId },
      data: {
        lastSync: new Date(),
        syncStatus: `MELI - Importados: ${result.imported}, Actualizados: ${result.updated}`,
      },
    });

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

// ============================================
// CATEGORÍAS Y MARCAS (Categories & Brands)
// ============================================

interface CianboxCategory {
  id: number;
  categoria: string;
  padre?: number; // ID de categoría padre (0 = root)
}

interface CianboxBrand {
  id: number;
  marca: string;
}

interface CianboxProductFull {
  id: number;
  codigo: string;
  codigo_interno?: string; // This is the actual SKU/code in Cianbox
  producto: string;
  descripcion?: string;
  codigo_barras?: string;
  ubicacion?: string;
  stock?: number;
  precio?: number;
  id_categoria?: number;
  categoria?: string;
  id_marca?: number;
  marca?: string;
  imagen?: string;
  vigente?: boolean;
}

/**
 * Fetches categories from Cianbox
 * Obtiene categorías desde Cianbox
 */
export async function fetchCianboxCategories(tenantId: string): Promise<CianboxCategory[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  let allCategories: CianboxCategory[] = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    const params = new URLSearchParams({
      access_token: token,
      page: currentPage.toString(),
      limit: '100',
    });

    const response = await fetch(`${baseUrl}/productos/categorias?${params.toString()}`);
    const data = (await response.json()) as CianboxApiResponse;

    if (data.status !== 'ok') {
      throw new Error(`Error al obtener categorías: ${data.message}`);
    }

    const pageCategories: CianboxCategory[] = data.body || [];
    if (pageCategories.length === 0) {
      hasMoreData = false;
    } else {
      allCategories = allCategories.concat(pageCategories);
      currentPage++;
      if (pageCategories.length < 100) {
        hasMoreData = false;
      }
    }
  }

  console.log(`[Cianbox Categories] Fetched ${allCategories.length} categories`);
  return allCategories;
}

/**
 * Fetches brands from Cianbox
 * Obtiene marcas desde Cianbox
 */
export async function fetchCianboxBrands(tenantId: string): Promise<CianboxBrand[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexión Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  let allBrands: CianboxBrand[] = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    const params = new URLSearchParams({
      access_token: token,
      page: currentPage.toString(),
      limit: '100',
    });

    const response = await fetch(`${baseUrl}/productos/marcas?${params.toString()}`);
    const data = (await response.json()) as CianboxApiResponse;

    if (data.status !== 'ok') {
      throw new Error(`Error al obtener marcas: ${data.message}`);
    }

    const pageBrands: CianboxBrand[] = data.body || [];
    if (pageBrands.length === 0) {
      hasMoreData = false;
    } else {
      allBrands = allBrands.concat(pageBrands);
      currentPage++;
      if (pageBrands.length < 100) {
        hasMoreData = false;
      }
    }
  }

  console.log(`[Cianbox Brands] Fetched ${allBrands.length} brands`);
  return allBrands;
}

/**
 * Syncs categories from Cianbox to local database
 * Sincroniza categorías desde Cianbox a la base de datos local
 */
export async function syncCategoriesFromCianbox(
  tenantId: string
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const cianboxCategories = await fetchCianboxCategories(tenantId);

    if (cianboxCategories.length === 0) {
      return result;
    }

    // First pass: Create/update all categories without parent relationship
    // Primer paso: Crear/actualizar todas las categorías sin relación de padre
    const cianboxIdToLocalId = new Map<number, string>();

    for (const category of cianboxCategories) {
      try {
        const existing = await prisma.category.findUnique({
          where: {
            tenantId_cianboxCategoryId: {
              tenantId,
              cianboxCategoryId: category.id,
            },
          },
        });

        if (existing) {
          await prisma.category.update({
            where: { id: existing.id },
            data: {
              name: category.categoria,
              lastSyncedAt: new Date(),
            },
          });
          cianboxIdToLocalId.set(category.id, existing.id);
          result.updated++;
        } else {
          const created = await prisma.category.create({
            data: {
              tenantId,
              cianboxCategoryId: category.id,
              name: category.categoria,
              lastSyncedAt: new Date(),
            },
          });
          cianboxIdToLocalId.set(category.id, created.id);
          result.imported++;
        }
      } catch (catError: any) {
        result.errors.push(`Categoría ${category.id}: ${catError.message}`);
      }
    }

    // Second pass: Update parent relationships
    // Segundo paso: Actualizar relaciones de padre
    for (const category of cianboxCategories) {
      if (category.padre && category.padre > 0) {
        const localId = cianboxIdToLocalId.get(category.id);
        const parentLocalId = cianboxIdToLocalId.get(category.padre);

        if (localId && parentLocalId) {
          try {
            await prisma.category.update({
              where: { id: localId },
              data: { parentId: parentLocalId },
            });
          } catch (parentError: any) {
            result.errors.push(`Padre de categoría ${category.id}: ${parentError.message}`);
          }
        }
      }
    }

    console.log(`[Cianbox Categories Sync] Imported: ${result.imported}, Updated: ${result.updated}`);
    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Syncs brands from Cianbox to local database
 * Sincroniza marcas desde Cianbox a la base de datos local
 */
export async function syncBrandsFromCianbox(
  tenantId: string
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const cianboxBrands = await fetchCianboxBrands(tenantId);

    if (cianboxBrands.length === 0) {
      return result;
    }

    for (const brand of cianboxBrands) {
      try {
        const existing = await prisma.brand.findUnique({
          where: {
            tenantId_cianboxBrandId: {
              tenantId,
              cianboxBrandId: brand.id,
            },
          },
        });

        if (existing) {
          await prisma.brand.update({
            where: { id: existing.id },
            data: {
              name: brand.marca,
              lastSyncedAt: new Date(),
            },
          });
          result.updated++;
        } else {
          await prisma.brand.create({
            data: {
              tenantId,
              cianboxBrandId: brand.id,
              name: brand.marca,
              lastSyncedAt: new Date(),
            },
          });
          result.imported++;
        }
      } catch (brandError: any) {
        result.errors.push(`Marca ${brand.id}: ${brandError.message}`);
      }
    }

    console.log(`[Cianbox Brands Sync] Imported: ${result.imported}, Updated: ${result.updated}`);
    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Syncs products from Cianbox to local database (with SSE progress)
 * Sincroniza productos desde Cianbox a la base de datos local (con progreso SSE)
 */
export async function syncProductsFromCianbox(
  tenantId: string,
  options: {
    onPageProgress?: (progress: {
      page: number;
      totalPages: number;
      productsInPage: number;
      savedInPage: number;
      totalFetched: number;
      totalImported: number;
      totalUpdated: number;
    }) => void;
  } = {}
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      throw new Error('No hay conexión Cianbox configurada');
    }

    // First sync categories and brands to have the relationships ready
    // Primero sincronizar categorías y marcas para tener las relaciones listas
    console.log(`[Cianbox Products Sync] Syncing categories and brands first...`);
    await syncCategoriesFromCianbox(tenantId);
    await syncBrandsFromCianbox(tenantId);

    // Build maps from cianbox IDs to local IDs
    // Construir mapas de IDs de cianbox a IDs locales
    const categories = await prisma.category.findMany({
      where: { tenantId },
      select: { id: true, cianboxCategoryId: true },
    });
    const categoryMap = new Map<number, string>();
    categories.forEach(c => categoryMap.set(c.cianboxCategoryId, c.id));

    const brands = await prisma.brand.findMany({
      where: { tenantId },
      select: { id: true, cianboxBrandId: true },
    });
    const brandMap = new Map<number, string>();
    brands.forEach(b => brandMap.set(b.cianboxBrandId, b.id));

    const token = await getAccessToken(tenantId);
    const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

    let currentPage = 1;
    let totalPages = 1;
    // Use syncPageSize from connection config, default 20, max 200
    const perPage = Math.min(connection.syncPageSize || 20, 200);
    let totalFetched = 0;

    console.log(`[Cianbox Products Sync] Starting incremental product sync (batch size: ${perPage})...`);

    // INCREMENTAL: Fetch each page and save with batch upserts
    // INCREMENTAL: Obtener cada página y guardar con upserts en batch
    while (currentPage <= totalPages) {
      const params = new URLSearchParams({
        access_token: token,
        page: currentPage.toString(),
        limit: perPage.toString(),
      });

      const response = await fetch(`${baseUrl}/productos/lista?${params.toString()}`);
      const data = (await response.json()) as CianboxApiResponse;

      if (data.status !== 'ok') {
        throw new Error(`Error al obtener productos: ${data.message}`);
      }

      // Get total pages from first response
      // Obtener total de páginas de la primera respuesta
      if (currentPage === 1 && data.total_pages) {
        totalPages = data.total_pages;
        console.log(`[Cianbox Products Sync] Total pages to sync: ${totalPages}`);
      }

      const pageProducts: CianboxProductFull[] = data.body || [];

      if (pageProducts.length === 0) {
        break; // No more products
      } else {
        totalFetched += pageProducts.length;

        // Save this page with batch upserts in a transaction
        // Guardar esta página con upserts en batch dentro de una transacción
        const prevImported = result.imported;
        const prevUpdated = result.updated;

        // Prepare upsert operations
        const upsertOperations = pageProducts.map(product => {
          // Use codigo_interno (SKU) from API, or extract from product name if it has pattern [CODIGO]
          let sku = product.codigo_interno?.trim() || null;
          if (!sku && product.producto) {
            const match = product.producto.match(/^\[([^\]]+)\]/);
            if (match) {
              sku = match[1];
            }
          }

          const productData = {
            sku,
            name: product.producto || 'Producto sin nombre',
            description: product.descripcion || null,
            ean: product.codigo_barras || null,
            location: product.ubicacion || null,
            imageUrl: product.imagen || null,
            stock: product.stock != null ? toInt(product.stock) : null,
            price: product.precio != null ? toFloat(product.precio) : null,
            categoryId: product.id_categoria ? categoryMap.get(product.id_categoria) || null : null,
            brandId: product.id_marca ? brandMap.get(product.id_marca) || null : null,
            isActive: product.vigente !== false,
            lastSyncedAt: new Date(),
          };

          return prisma.product.upsert({
            where: {
              tenantId_cianboxProductId: {
                tenantId,
                cianboxProductId: product.id,
              },
            },
            update: productData,
            create: {
              tenantId,
              cianboxProductId: product.id,
              ...productData,
            },
          });
        });

        try {
          // Execute all upserts in a single transaction
          await prisma.$transaction(upsertOperations);
          // Count all as updated (upsert doesn't tell us which were created vs updated)
          result.updated += pageProducts.length;
        } catch (batchError: any) {
          result.errors.push(`Batch page ${currentPage}: ${batchError.message}`);
        }

        const savedInPage = (result.imported - prevImported) + (result.updated - prevUpdated);

        console.log(`[Cianbox Products Sync] Page ${currentPage}/${totalPages}: fetched ${pageProducts.length}, saved ${savedInPage}, total: fetched=${totalFetched}, imported=${result.imported}, updated=${result.updated}`);

        if (options.onPageProgress) {
          options.onPageProgress({
            page: currentPage,
            totalPages,
            productsInPage: pageProducts.length,
            savedInPage,
            totalFetched,
            totalImported: result.imported,
            totalUpdated: result.updated,
          });
        }

        currentPage++;
      }
    }

    console.log(`[Cianbox Products Sync] COMPLETED: total fetched=${totalFetched}, imported=${result.imported}, updated=${result.updated}`);

    // Update lastSync in connection / Actualizar lastSync de la conexión
    await prisma.cianboxConnection.update({
      where: { tenantId },
      data: {
        lastSync: new Date(),
        syncStatus: `Productos - Importados: ${result.imported}, Actualizados: ${result.updated}`,
      },
    });

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Links MeliSales to Products by cianboxProductId
 * Vincula MeliSales a Products por cianboxProductId (id_producto de Cianbox)
 *
 * IMPORTANTE: La vinculación SIEMPRE debe ser por cianboxProductId, nunca por SKU
 */
export async function linkMeliSalesToProducts(
  tenantId: string
): Promise<{
  linked: number;
  notFound: number;
  errors: string[];
}> {
  const result = { linked: 0, notFound: 0, errors: [] as string[] };

  try {
    // Get all MeliSales without productId but with cianboxProductId
    // Obtener todas las MeliSales sin productId pero con cianboxProductId
    const unlinkedSales = await prisma.meliSale.findMany({
      where: {
        tenantId,
        productId: null,
        cianboxProductId: { not: null },
      },
      select: {
        id: true,
        cianboxProductId: true,
      },
    });

    console.log(`[Link MELI->Products] Found ${unlinkedSales.length} unlinked sales with cianboxProductId`);

    // Build cianboxProductId to product ID map
    // Construir mapa de cianboxProductId a ID de producto
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        cianboxProductId: { not: null },
      },
      select: { id: true, sku: true, cianboxProductId: true },
    });
    const cianboxIdMap = new Map<number, { id: string; sku: string | null }>();
    products.forEach(p => {
      if (p.cianboxProductId) {
        cianboxIdMap.set(p.cianboxProductId, { id: p.id, sku: p.sku });
      }
    });

    for (const sale of unlinkedSales) {
      try {
        if (sale.cianboxProductId) {
          const product = cianboxIdMap.get(sale.cianboxProductId);
          if (product) {
            await prisma.meliSale.update({
              where: { id: sale.id },
              data: {
                productId: product.id,
                productoSku: product.sku,
              },
            });
            result.linked++;
          } else {
            result.notFound++;
          }
        }
      } catch (linkError: any) {
        result.errors.push(`Sale ${sale.id}: ${linkError.message}`);
      }
    }

    console.log(`[Link MELI->Products] Linked: ${result.linked}, Not found: ${result.notFound}`);
    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}
