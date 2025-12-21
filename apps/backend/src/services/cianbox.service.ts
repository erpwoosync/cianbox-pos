/**
 * Servicio de integración con Cianbox API
 * Maneja autenticación, sincronización y comunicación con Cianbox ERP
 */

import { PrismaClient, CianboxConnection } from '@prisma/client';
import { CianboxError } from '../utils/errors.js';

const prisma = new PrismaClient();

// Tipos para respuestas de Cianbox
interface CianboxAuthResponse {
  status: string;
  statusMessage?: string;
  body?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

interface CianboxPaginatedResponse<T> {
  status: string;
  body: T[];
  // Paginación de Cianbox viene en la raíz de la respuesta
  page?: number;
  total_pages?: number;
}

// Campos reales de la API de Cianbox para productos
interface CianboxProduct {
  id: number;
  updated: string;
  producto: string;           // nombre del producto
  id_marca: number;
  marca: string;
  id_categoria: number;
  categoria: string;
  id_producto_padre: number;
  es_padre: boolean;
  descripcion: string;
  precio_actualizado: string;
  codigo_interno: string;     // SKU
  codigo_barras: string;      // barcode
  costo: number;
  costo_neto_calculado: number;
  costo_final_calculado: number;
  afecta_stock: boolean;      // trackStock
  stock_total: number;
  stock_sucursal: Array<{
    id_sucursal: number;
    stock: number;
    reservado: number;
    disponible: number;
  }>;
  reservado: number;
  cantidad_minima: number;    // minStock
  cantidad_critica: number;
  precio_neto: number;
  precio_oferta: number;
  precio_oferta_calculado: number;
  oferta: boolean;
  detalle_oferta: object;
  precios: Array<{
    id_lista_precio: number;
    updated: string;
    id_moneda: number;
    neto: number;
    final: number;
    redondeo: number;
    neto_calculado: number;
    final_calculado: number;
  }>;
  alicuota_iva: number;       // taxRate (21, 10.5, etc.)
  ubicacion: string;          // location
  talle: string;
  color: string;
  genero: string;
  temporada: string;
  material: string;
  estado: string;
  garantia: string;
  imagenes: string[];
  detalle_imagenes: object[];
  vigente: boolean;           // isActive
  alto: number;
  ancho: number;
  profundidad: number;
  peso: number;
}

// Campos reales de la API de Cianbox según documentación
interface CianboxCategory {
  id: number;
  categoria: string;  // nombre de la categoría
  padre: number;      // id de categoría padre (0 = sin padre)
}

interface CianboxBrand {
  id: number;
  marca: string;  // nombre de la marca
}

// Campos reales de la API de Cianbox para listas de precios
interface CianboxPriceList {
  id: number;
  lista: string;        // nombre de la lista
  vencimiento: string | null;
  vigente: boolean;     // isActive
}

// Campos reales de la API de Cianbox para sucursales
interface CianboxBranch {
  id: number;
  sucursal: string;    // nombre de la sucursal
  telefono: string;
  domicilio: string;   // dirección
  localidad: string;   // ciudad
  provincia: string;   // estado/provincia
  vigente: boolean;    // isActive
}

// Campos reales de la API de Cianbox para clientes
interface CianboxCustomer {
  id: number;
  updated: string;
  razon: string;              // nombre del cliente
  condicion: string;          // condición fiscal (CF, RI, etc.)
  tipo_documento: string;     // DNI, CUIT, etc.
  numero_documento: string;   // número de documento
  domicilio: string;          // dirección
  id_localidad: number;
  localidad: string;          // ciudad
  provincia: string;          // estado
  telefono: string;
  celular: string;
  email: string;
  ctacte: boolean;            // tiene cuenta corriente
  plazo: number;              // plazo de pago en días
  limite: number;             // límite de crédito
  saldo: number;              // saldo cuenta corriente
  descuento: number;          // descuento global
  listas_precio: number[];    // IDs de listas de precio
  observaciones: string;
  usuarios: object[];
  id_categoria: number;
  vendedor: string;
  estado: string;
  vigente: boolean;           // isActive
}

/**
 * Servicio principal de Cianbox
 */
export class CianboxService {
  private connection: CianboxConnection;
  private baseUrl: string;

  constructor(connection: CianboxConnection) {
    this.connection = connection;
    // URL formato: https://cianbox.org/{empresa}/api/v2
    this.baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;
  }

  /**
   * Crea una instancia del servicio para un tenant
   */
  static async forTenant(tenantId: string): Promise<CianboxService> {
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      throw new CianboxError('Conexión a Cianbox no configurada');
    }

    if (!connection.isActive) {
      throw new CianboxError('Conexión a Cianbox desactivada');
    }

    return new CianboxService(connection);
  }

  /**
   * Testea la conexión a Cianbox intentando autenticarse
   * Retorna información del resultado
   */
  static async testConnection(tenantId: string): Promise<{
    success: boolean;
    message: string;
    expiresIn?: number;
  }> {
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      return {
        success: false,
        message: 'Conexión no configurada',
      };
    }

    // Construir URL de la API: https://cianbox.org/{empresa}/api/v2
    const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;
    const authUrl = `${baseUrl}/auth/credentials`;

    // Usar form-urlencoded como indica la documentación de Cianbox
    const formData = new URLSearchParams();
    formData.append('app_name', connection.appName);
    formData.append('app_code', connection.appCode);
    formData.append('user', connection.user);
    formData.append('password', connection.password);

    console.log(`[Cianbox] Testing connection to: ${authUrl}`);

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const responseText = await response.text();
      console.log(`[Cianbox] Response status: ${response.status}, body: ${responseText.substring(0, 500)}`);

      let data: {
        status?: string;
        statusMessage?: string;
        body?: {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        error?: string;
        message?: string;
      };

      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          message: `Respuesta inválida de Cianbox: ${responseText.substring(0, 100)}`,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: data.message || data.error || data.statusMessage || `Error HTTP ${response.status}`,
        };
      }

      // La respuesta de Cianbox tiene estructura: { status: "ok", body: { access_token, ... } }
      const accessToken = data.body?.access_token;
      const refreshToken = data.body?.refresh_token;
      const expiresIn = data.body?.expires_in;

      if (accessToken) {
        // Guardar el token obtenido
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (expiresIn || 86400) - 300);

        await prisma.cianboxConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: accessToken,
            refreshToken: refreshToken,
            tokenExpiresAt: expiresAt,
          },
        });

        return {
          success: true,
          message: 'Conexión exitosa',
          expiresIn: expiresIn,
        };
      }

      // Si status no es "ok", mostrar el error
      if (data.status !== 'ok') {
        return {
          success: false,
          message: data.statusMessage || data.message || `Estado: ${data.status}`,
        };
      }

      return {
        success: false,
        message: data.statusMessage || data.message || 'Error de autenticación - respuesta sin token',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
      console.error(`[Cianbox] Connection error:`, error);
      return {
        success: false,
        message: `No se pudo conectar: ${errorMessage}`,
      };
    }
  }

  /**
   * Refresca tokens de todas las conexiones activas
   * Se ejecuta desde un cron job para mantener tokens vigentes
   */
  static async refreshAllTokens(): Promise<{
    total: number;
    refreshed: number;
    failed: number;
    errors: string[];
  }> {
    const connections = await prisma.cianboxConnection.findMany({
      where: {
        isActive: true,
        refreshToken: { not: null },
      },
      include: {
        tenant: { select: { name: true, slug: true } },
      },
    });

    const results = {
      total: connections.length,
      refreshed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const connection of connections) {
      try {
        // Verificar si el token expira en las próximas 2 horas
        const twoHoursFromNow = new Date();
        twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);

        if (connection.tokenExpiresAt && connection.tokenExpiresAt > twoHoursFromNow) {
          // Token aún válido por más de 2 horas, no refrescar
          continue;
        }

        console.log(`[Cianbox] Refreshing token for tenant: ${connection.tenant?.name || connection.tenantId}`);

        const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;
        const formData = new URLSearchParams();
        formData.append('refresh_token', connection.refreshToken!);

        const response = await fetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const data = await response.json() as {
          status: string;
          body?: { access_token: string; expires_in: number };
          statusMessage?: string;
        };

        if (data.status === 'ok' && data.body?.access_token) {
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + (data.body.expires_in || 86400) - 300);

          await prisma.cianboxConnection.update({
            where: { id: connection.id },
            data: {
              accessToken: data.body.access_token,
              tokenExpiresAt: expiresAt,
            },
          });

          results.refreshed++;
          console.log(`[Cianbox] Token refreshed for tenant: ${connection.tenant?.name || connection.tenantId}`);
        } else {
          results.failed++;
          const error = `${connection.tenant?.name || connection.tenantId}: ${data.statusMessage || 'Error desconocido'}`;
          results.errors.push(error);
          console.error(`[Cianbox] Failed to refresh token: ${error}`);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        results.errors.push(`${connection.tenant?.name || connection.tenantId}: ${errorMsg}`);
        console.error(`[Cianbox] Error refreshing token:`, error);
      }
    }

    console.log(`[Cianbox] Token refresh completed: ${results.refreshed} refreshed, ${results.failed} failed`);
    return results;
  }

  /**
   * Obtiene un token de acceso válido
   * Si el token actual está expirado, intenta refrescar primero, luego re-autenticar
   */
  private async getAccessToken(): Promise<string> {
    // Verificar si el token actual es válido (con 5 min de margen)
    const fiveMinutesFromNow = new Date();
    fiveMinutesFromNow.setMinutes(fiveMinutesFromNow.getMinutes() + 5);

    if (
      this.connection.accessToken &&
      this.connection.tokenExpiresAt &&
      this.connection.tokenExpiresAt > fiveMinutesFromNow
    ) {
      return this.connection.accessToken;
    }

    // Intentar refrescar con refresh_token primero
    if (this.connection.refreshToken) {
      try {
        const newToken = await this.refreshToken();
        return newToken;
      } catch (error) {
        console.log(`[Cianbox] Refresh token failed, will re-authenticate:`, error);
      }
    }

    // Si no hay refresh_token o falló, re-autenticar
    const newToken = await this.authenticate();
    return newToken;
  }

  /**
   * Refresca el access_token usando el refresh_token
   */
  private async refreshToken(): Promise<string> {
    if (!this.connection.refreshToken) {
      throw new CianboxError('No hay refresh token disponible');
    }

    console.log(`[Cianbox] Refreshing access token...`);

    const formData = new URLSearchParams();
    formData.append('refresh_token', this.connection.refreshToken);

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new CianboxError(`Error al refrescar token: ${response.status}`);
    }

    const data = await response.json() as {
      status: string;
      body?: { access_token: string; expires_in: number };
      statusMessage?: string;
    };

    if (data.status !== 'ok' || !data.body?.access_token) {
      throw new CianboxError(data.statusMessage || 'Error al refrescar token');
    }

    // Calcular fecha de expiración (restamos 5 minutos de margen)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.body.expires_in || 86400) - 300);

    // Actualizar conexión con nuevo token
    await prisma.cianboxConnection.update({
      where: { id: this.connection.id },
      data: {
        accessToken: data.body.access_token,
        tokenExpiresAt: expiresAt,
      },
    });

    this.connection.accessToken = data.body.access_token;
    this.connection.tokenExpiresAt = expiresAt;

    console.log(`[Cianbox] Access token refreshed, expires at: ${expiresAt.toISOString()}`);
    return data.body.access_token;
  }

  /**
   * Autentica con Cianbox y obtiene nuevo token (usa credenciales)
   */
  private async authenticate(): Promise<string> {
    console.log(`[Cianbox] Authenticating with credentials...`);

    // Usar form-urlencoded como requiere Cianbox
    const formData = new URLSearchParams();
    formData.append('app_name', this.connection.appName);
    formData.append('app_code', this.connection.appCode);
    formData.append('user', this.connection.user);
    formData.append('password', this.connection.password);

    const response = await fetch(`${this.baseUrl}/auth/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new CianboxError(`Error de autenticación: ${response.status}`);
    }

    const data = (await response.json()) as CianboxAuthResponse;

    if (data.status !== 'ok' || !data.body?.access_token) {
      throw new CianboxError(data.statusMessage || 'Error de autenticación');
    }

    // Calcular fecha de expiración (restamos 5 minutos de margen)
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + (data.body.expires_in || 3600) - 300
    );

    // Actualizar conexión con nuevo token
    await prisma.cianboxConnection.update({
      where: { id: this.connection.id },
      data: {
        accessToken: data.body.access_token,
        refreshToken: data.body.refresh_token,
        tokenExpiresAt: expiresAt,
      },
    });

    this.connection.accessToken = data.body.access_token;
    this.connection.refreshToken = data.body.refresh_token;
    this.connection.tokenExpiresAt = expiresAt;

    console.log(`[Cianbox] Authenticated, token expires at: ${expiresAt.toISOString()}`);
    return data.body.access_token;
  }

  /**
   * Realiza una petición autenticada a Cianbox
   * El token se envía como query parameter según la API de Cianbox
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    // Cianbox requiere el token como query parameter, no como header
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${separator}access_token=${token}`;

    console.log(`[Cianbox] Request: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const responseText = await response.text();
    console.log(`[Cianbox] Response status: ${response.status}, body length: ${responseText.length}`);

    if (response.status === 401) {
      // Token inválido, intentar re-autenticar
      console.log('[Cianbox] Token inválido, re-autenticando...');
      await this.authenticate();
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      throw new CianboxError(`Error Cianbox: ${response.status} - ${responseText}`);
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new CianboxError(`Respuesta inválida de Cianbox: ${responseText.substring(0, 200)}`);
    }
  }

  /**
   * Obtiene todos los registros paginados
   */
  private async fetchAllPaginated<T>(
    endpoint: string,
    limit: number = 50
  ): Promise<T[]> {
    const allData: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[Cianbox] Fetching ${endpoint}?page=${page}&limit=${limit}`);

      const response = await this.request<CianboxPaginatedResponse<T>>(
        `${endpoint}?page=${page}&limit=${limit}`
      );

      console.log(`[Cianbox] Response status: ${response.status}, items: ${response.body?.length || 0}, page: ${response.page || 1}/${response.total_pages || 1}`);

      if (response.body && Array.isArray(response.body)) {
        allData.push(...response.body);
      }

      // Verificar si hay más páginas usando total_pages de Cianbox
      if (response.total_pages && response.total_pages > 1) {
        hasMore = page < response.total_pages;
      } else {
        // Si no hay paginación, asumir que vino todo en una página
        hasMore = false;
      }
      page++;
    }

    return allData;
  }

  // =============================================
  // PRODUCTOS
  // =============================================

  /**
   * Obtiene todos los productos de Cianbox
   */
  async getProducts(): Promise<CianboxProduct[]> {
    return this.fetchAllPaginated<CianboxProduct>(
      '/productos/lista',
      this.connection.syncPageSize
    );
  }

  /**
   * Obtiene un producto por ID
   */
  async getProduct(id: number): Promise<CianboxProduct> {
    const response = await this.request<{ data: CianboxProduct }>(
      `/productos/${id}`
    );
    return response.data;
  }

  /**
   * Sincroniza productos desde Cianbox
   * Incluye precios y stock
   */
  async syncProducts(tenantId: string): Promise<number> {
    const products = await this.getProducts();
    let synced = 0;

    console.log(`[Cianbox] Sincronizando ${products.length} productos con precios y stock`);

    for (const product of products) {
      // Buscar categoría por cianboxCategoryId
      let categoryId: string | null = null;
      if (product.id_categoria) {
        const category = await prisma.category.findFirst({
          where: { tenantId, cianboxCategoryId: product.id_categoria },
        });
        categoryId = category?.id || null;
      }

      // Buscar marca por cianboxBrandId
      let brandId: string | null = null;
      if (product.id_marca) {
        const brand = await prisma.brand.findFirst({
          where: { tenantId, cianboxBrandId: product.id_marca },
        });
        brandId = brand?.id || null;
      }

      // Usar codigo_interno de Cianbox directamente como SKU
      // Si está vacío, dejarlo null (no inventar valores)
      const sku = product.codigo_interno?.trim() || null;

      // Mapear campos de Cianbox a nuestro modelo
      // Calcular precio final con IVA desde precio_neto
      const taxRate = this.normalizeTaxRate(product.alicuota_iva);
      const precioNeto = product.precio_neto || 0;
      const precioFinal = precioNeto * (1 + taxRate / 100);

      const productData = {
        sku,
        barcode: product.codigo_barras || null,
        name: product.producto,
        description: product.descripcion || null,
        categoryId,
        brandId,
        basePrice: precioFinal,
        baseCost: product.costo || 0,
        taxRate,
        taxIncluded: true,
        trackStock: product.afecta_stock ?? true,
        allowNegativeStock: false,
        minStock: product.cantidad_minima || null,
        location: product.ubicacion || null,
        imageUrl: product.imagenes?.[0] || null,
        // Productos padres siempre activos (sus variantes determinan disponibilidad)
        isActive: product.es_padre ? true : (product.vigente ?? true),
        isService: !product.afecta_stock,
        // Curva de talles (productos variables)
        isParent: product.es_padre ?? false,
        size: product.talle || null,
        color: product.color || null,
        lastSyncedAt: new Date(),
        cianboxData: product as unknown as object,
      };

      // Upsert producto
      const savedProduct = await prisma.product.upsert({
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

      // Sincronizar precios
      if (product.precios && Array.isArray(product.precios)) {
        for (const precio of product.precios) {
          // Buscar lista de precios por cianboxPriceListId
          const priceList = await prisma.priceList.findFirst({
            where: { tenantId, cianboxPriceListId: precio.id_lista_precio },
          });

          if (priceList && precio.final_calculado > 0) {
            await prisma.productPrice.upsert({
              where: {
                productId_priceListId: {
                  productId: savedProduct.id,
                  priceListId: priceList.id,
                },
              },
              update: {
                price: precio.final_calculado,
                priceNet: precio.neto_calculado || precio.neto || null,
                cost: product.costo_final_calculado || product.costo || 0,
                updatedAt: new Date(),
              },
              create: {
                productId: savedProduct.id,
                priceListId: priceList.id,
                price: precio.final_calculado,
                priceNet: precio.neto_calculado || precio.neto || null,
                cost: product.costo_final_calculado || product.costo || 0,
              },
            });
          }
        }
      }

      // Sincronizar stock por sucursal
      if (product.stock_sucursal && Array.isArray(product.stock_sucursal)) {
        for (const stockItem of product.stock_sucursal) {
          // Buscar o crear sucursal usando el método helper
          const branch = await this.getOrCreateBranchForStock(tenantId, stockItem.id_sucursal);

          // Upsert stock
          const available = stockItem.disponible ?? (stockItem.stock - (stockItem.reservado || 0));
          await prisma.productStock.upsert({
            where: {
              productId_branchId: {
                productId: savedProduct.id,
                branchId: branch.id,
              },
            },
            update: {
              quantity: stockItem.stock,
              reserved: stockItem.reservado || 0,
              available: available,
              updatedAt: new Date(),
            },
            create: {
              productId: savedProduct.id,
              branchId: branch.id,
              quantity: stockItem.stock,
              reserved: stockItem.reservado || 0,
              available: available,
            },
          });
        }
      }

      synced++;

      // Log progreso cada 100 productos
      if (synced % 100 === 0) {
        console.log(`[Cianbox] Sincronizados ${synced}/${products.length} productos`);
      }
    }

    // === SEGUNDA PASADA: Resolver relaciones padre-hijo para curva de talles ===
    console.log(`[Cianbox] Resolviendo relaciones padre-hijo de productos variables...`);
    let parentRelationsResolved = 0;
    let virtualParentsCreated = 0;

    // 1. Recopilar todos los id_producto_padre únicos de las variantes
    const parentIdsNeeded = new Set<number>();
    const variantsByParentId = new Map<number, typeof products>();

    for (const product of products) {
      if (product.id_producto_padre && product.id_producto_padre > 0) {
        parentIdsNeeded.add(product.id_producto_padre);

        // Agrupar variantes por padre para crear padre virtual si es necesario
        if (!variantsByParentId.has(product.id_producto_padre)) {
          variantsByParentId.set(product.id_producto_padre, []);
        }
        variantsByParentId.get(product.id_producto_padre)!.push(product);
      }
    }

    console.log(`[Cianbox] Encontrados ${parentIdsNeeded.size} productos padre referenciados`);

    // 2. Para cada id_producto_padre, verificar si existe o crear padre virtual
    for (const cianboxParentId of parentIdsNeeded) {
      // Buscar si el padre existe en nuestra BD
      let parentProduct = await prisma.product.findFirst({
        where: { tenantId, cianboxProductId: cianboxParentId },
        select: { id: true, isVirtualParent: true },
      });

      // Si no existe, crear padre virtual
      if (!parentProduct) {
        const variants = variantsByParentId.get(cianboxParentId) || [];
        if (variants.length === 0) continue;

        // Usar la primera variante como referencia para crear el padre
        const refVariant = variants[0];

        // Extraer nombre del padre quitando talle y color del nombre de la variante
        let parentName = refVariant.producto || 'Producto Variable';
        // Quitar patrones comunes de talle/color del final
        // Ej: "JEAN RECTO CELESTE - 38 Beige" -> "JEAN RECTO CELESTE"
        // Ej: "Remera Básica T.M Negro" -> "Remera Básica"
        parentName = parentName
          .replace(/\s*[-–]\s*\d+\s*\w*$/i, '')  // " - 38 Beige"
          .replace(/\s+T\.\s*\w+\s*\w*$/i, '')    // " T.M Negro"
          .replace(/\s+Talle\s*\w+\s*\w*$/i, '')  // " Talle M Negro"
          .replace(/\s+\d{2,3}\s*\w*$/i, '')     // " 38 Beige" (talle numérico al final)
          .trim();

        // Si el nombre quedó vacío, usar el original
        if (!parentName) {
          parentName = refVariant.producto || 'Producto Variable';
        }

        // Buscar categoría y marca de la variante
        let categoryId: string | null = null;
        let brandId: string | null = null;

        if (refVariant.id_categoria) {
          const category = await prisma.category.findFirst({
            where: { tenantId, cianboxCategoryId: refVariant.id_categoria },
          });
          categoryId = category?.id || null;
        }

        if (refVariant.id_marca) {
          const brand = await prisma.brand.findFirst({
            where: { tenantId, cianboxBrandId: refVariant.id_marca },
          });
          brandId = brand?.id || null;
        }

        // Crear el padre virtual
        const virtualParent = await prisma.product.create({
          data: {
            tenantId,
            cianboxProductId: cianboxParentId,
            name: parentName,
            sku: refVariant.codigo_interno ? `${refVariant.codigo_interno}-PADRE` : null,
            barcode: null, // El padre virtual no tiene código de barras propio
            categoryId,
            brandId,
            basePrice: refVariant.precio_neto || 0,
            baseCost: refVariant.costo || 0,
            taxRate: this.normalizeTaxRate(refVariant.alicuota_iva),
            taxIncluded: true,
            isParent: true,
            isVirtualParent: true, // ← Marcado como virtual
            isActive: true,
            lastSyncedAt: new Date(),
            // No hay data de Cianbox para padres virtuales
          },
        });

        parentProduct = { id: virtualParent.id, isVirtualParent: true };
        virtualParentsCreated++;
        console.log(`[Cianbox] Creado padre virtual: "${parentName}" (cianboxId: ${cianboxParentId})`);
      }

      // 3. Asignar la relación a todas las variantes de este padre
      const updateResult = await prisma.product.updateMany({
        where: {
          tenantId,
          cianboxProductId: { in: (variantsByParentId.get(cianboxParentId) || []).map(v => v.id) },
        },
        data: { parentProductId: parentProduct.id },
      });

      parentRelationsResolved += updateResult.count;
    }

    if (virtualParentsCreated > 0 || parentRelationsResolved > 0) {
      console.log(`[Cianbox] Resueltas ${parentRelationsResolved} relaciones padre-hijo`);
      console.log(`[Cianbox] Creados ${virtualParentsCreated} padres virtuales`);
    }

    // Actualizar última sincronización
    await prisma.cianboxConnection.update({
      where: { id: this.connection.id },
      data: {
        lastSync: new Date(),
        syncStatus: `Sincronizados ${synced} productos, ${parentRelationsResolved} variantes vinculadas, ${virtualParentsCreated} padres virtuales`,
      },
    });

    console.log(`[Cianbox] Sincronización de productos completada: ${synced} productos, ${virtualParentsCreated} padres virtuales`);
    return synced;
  }

  // =============================================
  // CATEGORÍAS
  // =============================================

  /**
   * Obtiene todas las categorías
   */
  async getCategories(): Promise<CianboxCategory[]> {
    return this.fetchAllPaginated<CianboxCategory>('/productos/categorias');
  }

  /**
   * Sincroniza categorías desde Cianbox
   * API Cianbox devuelve: { id, categoria, padre }
   */
  async syncCategories(tenantId: string): Promise<number> {
    const categories = await this.getCategories();
    let synced = 0;

    console.log(`[Cianbox] Sincronizando ${categories.length} categorías`);

    // Primero las categorías sin padre (padre = 0), luego las hijas
    const sortedCategories = categories.sort((a, b) => a.padre - b.padre);

    for (const category of sortedCategories) {
      // Buscar categoría padre si existe (padre > 0)
      let parentId: string | null = null;
      if (category.padre && category.padre > 0) {
        const parent = await prisma.category.findFirst({
          where: {
            tenantId,
            cianboxCategoryId: category.padre,
          },
        });
        parentId = parent?.id || null;
      }

      // Mapear campos de Cianbox a nuestro modelo
      const categoryName = category.categoria || `Categoría ${category.id}`;

      await prisma.category.upsert({
        where: {
          tenantId_cianboxCategoryId: {
            tenantId,
            cianboxCategoryId: category.id,
          },
        },
        update: {
          name: categoryName,
          parentId,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxCategoryId: category.id,
          name: categoryName,
          parentId,
          lastSyncedAt: new Date(),
        },
      });

      synced++;
    }

    return synced;
  }

  // =============================================
  // MARCAS
  // =============================================

  /**
   * Obtiene todas las marcas
   */
  async getBrands(): Promise<CianboxBrand[]> {
    return this.fetchAllPaginated<CianboxBrand>('/productos/marcas');
  }

  /**
   * Sincroniza marcas desde Cianbox
   * API Cianbox devuelve: { id, marca }
   */
  async syncBrands(tenantId: string): Promise<number> {
    const brands = await this.getBrands();
    let synced = 0;

    console.log(`[Cianbox] Sincronizando ${brands.length} marcas`);

    for (const brand of brands) {
      // Mapear campos de Cianbox a nuestro modelo
      const brandName = brand.marca || `Marca ${brand.id}`;

      await prisma.brand.upsert({
        where: {
          tenantId_cianboxBrandId: {
            tenantId,
            cianboxBrandId: brand.id,
          },
        },
        update: {
          name: brandName,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxBrandId: brand.id,
          name: brandName,
          lastSyncedAt: new Date(),
        },
      });

      synced++;
    }

    return synced;
  }

  // =============================================
  // LISTAS DE PRECIOS
  // =============================================

  /**
   * Obtiene todas las listas de precios
   */
  async getPriceLists(): Promise<CianboxPriceList[]> {
    return this.fetchAllPaginated<CianboxPriceList>('/productos/listas');
  }

  /**
   * Sincroniza listas de precios desde Cianbox
   * API devuelve: { id, lista, vencimiento, vigente }
   */
  async syncPriceLists(tenantId: string): Promise<number> {
    const priceLists = await this.getPriceLists();
    let synced = 0;

    console.log(`[Cianbox] Sincronizando ${priceLists.length} listas de precios`);

    for (const priceList of priceLists) {
      // Mapear campos de Cianbox a nuestro modelo
      const name = priceList.lista || `Lista ${priceList.id}`;
      const isDefault = priceList.id === 0; // La lista "General" (id=0) es la default

      await prisma.priceList.upsert({
        where: {
          tenantId_cianboxPriceListId: {
            tenantId,
            cianboxPriceListId: priceList.id,
          },
        },
        update: {
          name,
          isDefault,
          isActive: priceList.vigente,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxPriceListId: priceList.id,
          name,
          currency: 'ARS',
          isDefault,
          isActive: priceList.vigente,
          lastSyncedAt: new Date(),
        },
      });

      synced++;
    }

    return synced;
  }

  // =============================================
  // SUCURSALES
  // =============================================

  /**
   * Obtiene todas las sucursales
   * Endpoint correcto: /productos/sucursales
   */
  async getBranches(): Promise<CianboxBranch[]> {
    return this.fetchAllPaginated<CianboxBranch>('/productos/sucursales');
  }

  /**
   * Sincroniza sucursales desde Cianbox
   * API devuelve: { id, sucursal, telefono, domicilio, localidad, provincia, vigente }
   *
   * IMPORTANTE: Si hay sucursales existentes sin cianboxBranchId, intenta matchear por nombre
   * para asignarles el ID de Cianbox y permitir la sincronización de stock.
   */
  async syncBranches(tenantId: string): Promise<number> {
    const branches = await this.getBranches();
    let synced = 0;
    let matched = 0;

    console.log(`[Cianbox] Sincronizando ${branches.length} sucursales`);

    for (const branch of branches) {
      // Mapear campos de Cianbox a nuestro modelo
      const name = branch.sucursal || `Sucursal ${branch.id}`;
      const code = `SUC-${branch.id}`;
      const isDefault = branch.id === 1; // La primera sucursal es la default

      // Usar vigente directamente (default true si no viene)
      const isActive = branch.vigente !== false;

      // Primero buscar si ya existe una sucursal con este cianboxBranchId
      let existingBranch = await prisma.branch.findFirst({
        where: { tenantId, cianboxBranchId: branch.id },
      });

      // Si no existe por cianboxBranchId, buscar por nombre similar (sin cianboxBranchId asignado)
      if (!existingBranch) {
        // Buscar sucursales sin cianboxBranchId que coincidan por nombre
        let branchByName = await prisma.branch.findFirst({
          where: {
            tenantId,
            cianboxBranchId: null,
            OR: [
              { name: { equals: name, mode: 'insensitive' } },
              { name: { contains: branch.sucursal, mode: 'insensitive' } },
            ],
          },
        });

        // Si no encontramos por nombre y es la primera sucursal de Cianbox (id=1),
        // buscar si hay una única sucursal sin mapear y usarla
        if (!branchByName && branch.id === 1) {
          const unmappedBranches = await prisma.branch.findMany({
            where: { tenantId, cianboxBranchId: null },
          });

          // Si hay exactamente una sucursal sin mapear, usarla
          if (unmappedBranches.length === 1) {
            branchByName = unmappedBranches[0];
            console.log(`[Cianbox] Usando única sucursal sin mapear "${branchByName.name}" para Cianbox ID ${branch.id}`);
          }
        }

        if (branchByName) {
          // Actualizar la sucursal existente con el cianboxBranchId
          existingBranch = await prisma.branch.update({
            where: { id: branchByName.id },
            data: {
              cianboxBranchId: branch.id,
              address: branch.domicilio || branchByName.address,
              city: branch.localidad || branchByName.city,
              state: branch.provincia || branchByName.state,
              phone: branch.telefono || branchByName.phone,
              lastSyncedAt: new Date(),
            },
          });
          matched++;
          console.log(`[Cianbox] Sucursal existente "${branchByName.name}" mapeada a Cianbox ID ${branch.id}`);
        }
      }

      // Si encontramos una existente, actualizarla; si no, crear nueva
      if (existingBranch) {
        await prisma.branch.update({
          where: { id: existingBranch.id },
          data: {
            name, // Actualizar nombre también
            address: branch.domicilio || existingBranch.address,
            city: branch.localidad || existingBranch.city,
            state: branch.provincia || existingBranch.state,
            phone: branch.telefono || existingBranch.phone,
            isActive,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        // Crear nueva sucursal
        await prisma.branch.create({
          data: {
            tenantId,
            cianboxBranchId: branch.id,
            code,
            name,
            address: branch.domicilio || null,
            city: branch.localidad || null,
            state: branch.provincia || null,
            phone: branch.telefono || null,
            isDefault,
            isActive,
            lastSyncedAt: new Date(),
          },
        });
      }

      synced++;
    }

    if (matched > 0) {
      console.log(`[Cianbox] ${matched} sucursales existentes fueron mapeadas a Cianbox`);
    }

    return synced;
  }

  // =============================================
  // CLIENTES
  // =============================================

  /**
   * Obtiene todos los clientes
   */
  async getCustomers(): Promise<CianboxCustomer[]> {
    return this.fetchAllPaginated<CianboxCustomer>('/clientes');
  }

  /**
   * Sincroniza clientes desde Cianbox
   * API devuelve: { id, razon, condicion, tipo_documento, numero_documento, etc. }
   */
  async syncCustomers(tenantId: string): Promise<number> {
    const customers = await this.getCustomers();
    let synced = 0;

    console.log(`[Cianbox] Sincronizando ${customers.length} clientes`);

    for (const customer of customers) {
      // Buscar primera lista de precios asignada
      let priceListId: string | null = null;
      if (customer.listas_precio && customer.listas_precio.length > 0) {
        const priceList = await prisma.priceList.findFirst({
          where: {
            tenantId,
            cianboxPriceListId: customer.listas_precio[0],
          },
        });
        priceListId = priceList?.id || null;
      }

      // Mapear condición fiscal a tipo de cliente
      const customerType = this.mapCondicionToCustomerType(customer.condicion);

      // Mapear campos de Cianbox a nuestro modelo
      const customerData = {
        customerType,
        taxId: customer.numero_documento || null,
        taxIdType: customer.tipo_documento || null,
        taxCategory: customer.condicion || null,
        name: customer.razon || `Cliente ${customer.id}`,
        email: customer.email || null,
        phone: customer.telefono || null,
        mobile: customer.celular || null,
        address: customer.domicilio || null,
        city: customer.localidad || null,
        state: customer.provincia || null,
        priceListId,
        creditLimit: customer.limite || 0,
        creditBalance: customer.saldo || 0,
        paymentTermDays: customer.plazo || 0,
        globalDiscount: customer.descuento || 0,
        isActive: customer.vigente ?? true,
        lastSyncedAt: new Date(),
        cianboxData: customer as unknown as object,
      };

      await prisma.customer.upsert({
        where: {
          tenantId_cianboxCustomerId: {
            tenantId,
            cianboxCustomerId: customer.id,
          },
        },
        update: customerData,
        create: {
          tenantId,
          cianboxCustomerId: customer.id,
          ...customerData,
        },
      });

      synced++;
    }

    return synced;
  }

  /**
   * Normaliza el taxRate de Cianbox al formato porcentaje
   * Cianbox puede enviar 1.21 (multiplicador) o 21 (porcentaje)
   */
  private normalizeTaxRate(alicuotaIva: number | undefined | null): number {
    if (!alicuotaIva || alicuotaIva === 0) return 21; // Default 21%

    // Si es menor a 2, está en formato multiplicador (1.21 = 21%)
    if (alicuotaIva > 0 && alicuotaIva < 2) {
      return Math.round((alicuotaIva - 1) * 1000) / 10; // 1.21 -> 21, 1.105 -> 10.5
    }

    return alicuotaIva; // Ya está en formato porcentaje
  }

  /**
   * Busca o crea una sucursal para sincronizar stock.
   * Primero busca por cianboxBranchId, si no encuentra busca una sin mapear.
   */
  private async getOrCreateBranchForStock(
    tenantId: string,
    cianboxBranchId: number
  ): Promise<{ id: string }> {
    // Primero buscar por cianboxBranchId
    let branch = await prisma.branch.findFirst({
      where: { tenantId, cianboxBranchId },
    });

    if (branch) {
      return branch;
    }

    // Si no existe, buscar sucursales sin mapear
    const unmappedBranches = await prisma.branch.findMany({
      where: { tenantId, cianboxBranchId: null },
    });

    // Si hay exactamente una sucursal sin mapear, usarla y asignarle el ID
    if (unmappedBranches.length === 1) {
      branch = await prisma.branch.update({
        where: { id: unmappedBranches[0].id },
        data: { cianboxBranchId },
      });
      console.log(`[Cianbox] Sucursal "${branch.name}" mapeada a Cianbox ID ${cianboxBranchId} durante sync de stock`);
      return branch;
    }

    // Si no hay sucursales o hay múltiples, crear una nueva
    branch = await prisma.branch.create({
      data: {
        tenantId,
        cianboxBranchId,
        code: `SUC-${cianboxBranchId}`,
        name: `Sucursal ${cianboxBranchId}`,
        isActive: true,
      },
    });
    console.log(`[Cianbox] Creada nueva sucursal para Cianbox ID ${cianboxBranchId}`);

    return branch;
  }

  /**
   * Mapea condición fiscal de Cianbox a tipo de cliente
   */
  private mapCondicionToCustomerType(condicion: string): 'CONSUMER' | 'INDIVIDUAL' | 'BUSINESS' | 'GOVERNMENT' | 'RESELLER' {
    switch (condicion?.toUpperCase()) {
      case 'CF':
      case 'CONSUMIDOR FINAL':
        return 'CONSUMER';
      case 'RI':
      case 'RESPONSABLE INSCRIPTO':
        return 'BUSINESS';
      case 'MO':
      case 'MONOTRIBUTO':
        return 'INDIVIDUAL';
      case 'EX':
      case 'EXENTO':
        return 'BUSINESS';
      default:
        return 'CONSUMER';
    }
  }

  // =============================================
  // SINCRONIZACIÓN COMPLETA
  // =============================================

  /**
   * Sincroniza todos los datos desde Cianbox
   */
  async syncAll(tenantId: string): Promise<{
    branches: number;
    priceLists: number;
    categories: number;
    brands: number;
    products: number;
    customers: number;
  }> {
    // Sincronizar en orden de dependencia
    const branches = await this.syncBranches(tenantId);
    const priceLists = await this.syncPriceLists(tenantId);
    const categories = await this.syncCategories(tenantId);
    const brands = await this.syncBrands(tenantId);
    const products = await this.syncProducts(tenantId);
    const customers = await this.syncCustomers(tenantId);

    // Actualizar estado de conexión
    await prisma.cianboxConnection.update({
      where: { id: this.connection.id },
      data: {
        lastSync: new Date(),
        syncStatus: 'Sincronización completa exitosa',
      },
    });

    return {
      branches,
      priceLists,
      categories,
      brands,
      products,
      customers,
    };
  }

  // =============================================
  // CONSULTAS POR IDS ESPECÍFICOS
  // =============================================

  /**
   * Obtiene productos por IDs específicos (máx 200 por llamada)
   */
  async getProductsByIds(ids: number[]): Promise<CianboxProduct[]> {
    if (ids.length === 0) return [];
    const idsParam = ids.slice(0, 200).join(',');
    const response = await this.request<CianboxPaginatedResponse<CianboxProduct>>(
      `/productos?id=${idsParam}`
    );
    return response.body || [];
  }

  /**
   * Obtiene categorías por IDs específicos
   */
  async getCategoriesByIds(ids: number[]): Promise<CianboxCategory[]> {
    if (ids.length === 0) return [];
    const idsParam = ids.slice(0, 200).join(',');
    const response = await this.request<CianboxPaginatedResponse<CianboxCategory>>(
      `/productos/categorias?id=${idsParam}`
    );
    return response.body || [];
  }

  /**
   * Obtiene marcas por IDs específicos
   */
  async getBrandsByIds(ids: number[]): Promise<CianboxBrand[]> {
    if (ids.length === 0) return [];
    const idsParam = ids.slice(0, 200).join(',');
    const response = await this.request<CianboxPaginatedResponse<CianboxBrand>>(
      `/productos/marcas?id=${idsParam}`
    );
    return response.body || [];
  }

  /**
   * Obtiene listas de precios por IDs específicos
   */
  async getPriceListsByIds(ids: number[]): Promise<CianboxPriceList[]> {
    if (ids.length === 0) return [];
    const idsParam = ids.slice(0, 200).join(',');
    const response = await this.request<CianboxPaginatedResponse<CianboxPriceList>>(
      `/productos/listas?id=${idsParam}`
    );
    return response.body || [];
  }

  /**
   * Obtiene sucursales por IDs específicos
   */
  async getBranchesByIds(ids: number[]): Promise<CianboxBranch[]> {
    if (ids.length === 0) return [];
    const idsParam = ids.slice(0, 200).join(',');
    const response = await this.request<CianboxPaginatedResponse<CianboxBranch>>(
      `/productos/sucursales?id=${idsParam}`
    );
    return response.body || [];
  }

  // =============================================
  // UPSERT POR IDS (para webhooks)
  // =============================================

  /**
   * Sincroniza productos específicos por IDs
   */
  async upsertProductsByIds(tenantId: string, ids: number[]): Promise<number> {
    const products = await this.getProductsByIds(ids);
    let synced = 0;

    console.log(`[Cianbox Webhook] Procesando ${products.length} productos`);

    for (const product of products) {
      // Buscar categoría por cianboxCategoryId
      let categoryId: string | null = null;
      if (product.id_categoria) {
        const category = await prisma.category.findFirst({
          where: { tenantId, cianboxCategoryId: product.id_categoria },
        });
        categoryId = category?.id || null;
      }

      // Buscar marca por cianboxBrandId
      let brandId: string | null = null;
      if (product.id_marca) {
        const brand = await prisma.brand.findFirst({
          where: { tenantId, cianboxBrandId: product.id_marca },
        });
        brandId = brand?.id || null;
      }

      const sku = product.codigo_interno?.trim() || null;

      // Calcular precio final con IVA desde precio_neto
      const taxRate = this.normalizeTaxRate(product.alicuota_iva);
      const precioNeto = product.precio_neto || 0;
      const precioFinal = precioNeto * (1 + taxRate / 100);

      const productData = {
        sku,
        barcode: product.codigo_barras || null,
        name: product.producto,
        description: product.descripcion || null,
        categoryId,
        brandId,
        basePrice: precioFinal,
        baseCost: product.costo || 0,
        taxRate,
        taxIncluded: true,
        trackStock: product.afecta_stock ?? true,
        allowNegativeStock: false,
        minStock: product.cantidad_minima || null,
        location: product.ubicacion || null,
        imageUrl: product.imagenes?.[0] || null,
        // Productos padres siempre activos (sus variantes determinan disponibilidad)
        isActive: product.es_padre ? true : (product.vigente ?? true),
        isService: !product.afecta_stock,
        // Curva de talles (productos variables)
        isParent: product.es_padre ?? false,
        size: product.talle || null,
        color: product.color || null,
        lastSyncedAt: new Date(),
        cianboxData: product as unknown as object,
      };

      const savedProduct = await prisma.product.upsert({
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

      // Sincronizar precios
      if (product.precios && Array.isArray(product.precios)) {
        for (const precio of product.precios) {
          const priceList = await prisma.priceList.findFirst({
            where: { tenantId, cianboxPriceListId: precio.id_lista_precio },
          });

          if (priceList && precio.final_calculado > 0) {
            await prisma.productPrice.upsert({
              where: {
                productId_priceListId: {
                  productId: savedProduct.id,
                  priceListId: priceList.id,
                },
              },
              update: {
                price: precio.final_calculado,
                priceNet: precio.neto_calculado || precio.neto || null,
                cost: product.costo_final_calculado || product.costo || 0,
                updatedAt: new Date(),
              },
              create: {
                productId: savedProduct.id,
                priceListId: priceList.id,
                price: precio.final_calculado,
                priceNet: precio.neto_calculado || precio.neto || null,
                cost: product.costo_final_calculado || product.costo || 0,
              },
            });
          }
        }
      }

      // Sincronizar stock por sucursal
      if (product.stock_sucursal && Array.isArray(product.stock_sucursal)) {
        for (const stockItem of product.stock_sucursal) {
          // Buscar o crear sucursal usando el método helper
          const branch = await this.getOrCreateBranchForStock(tenantId, stockItem.id_sucursal);

          const available = stockItem.disponible ?? (stockItem.stock - (stockItem.reservado || 0));
          await prisma.productStock.upsert({
            where: {
              productId_branchId: {
                productId: savedProduct.id,
                branchId: branch.id,
              },
            },
            update: {
              quantity: stockItem.stock,
              reserved: stockItem.reservado || 0,
              available: available,
              updatedAt: new Date(),
            },
            create: {
              productId: savedProduct.id,
              branchId: branch.id,
              quantity: stockItem.stock,
              reserved: stockItem.reservado || 0,
              available: available,
            },
          });
        }
      }

      synced++;
    }

    console.log(`[Cianbox Webhook] Sincronizados ${synced} productos`);
    return synced;
  }

  /**
   * Sincroniza categorías específicas por IDs
   */
  async upsertCategoriesByIds(tenantId: string, ids: number[]): Promise<number> {
    const categories = await this.getCategoriesByIds(ids);
    let synced = 0;

    console.log(`[Cianbox Webhook] Procesando ${categories.length} categorías`);

    const sortedCategories = categories.sort((a, b) => a.padre - b.padre);

    for (const category of sortedCategories) {
      let parentId: string | null = null;
      if (category.padre && category.padre > 0) {
        const parent = await prisma.category.findFirst({
          where: { tenantId, cianboxCategoryId: category.padre },
        });
        parentId = parent?.id || null;
      }

      const categoryName = category.categoria || `Categoría ${category.id}`;

      await prisma.category.upsert({
        where: {
          tenantId_cianboxCategoryId: {
            tenantId,
            cianboxCategoryId: category.id,
          },
        },
        update: {
          name: categoryName,
          parentId,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxCategoryId: category.id,
          name: categoryName,
          parentId,
          lastSyncedAt: new Date(),
        },
      });

      synced++;
    }

    console.log(`[Cianbox Webhook] Sincronizadas ${synced} categorías`);
    return synced;
  }

  /**
   * Sincroniza marcas específicas por IDs
   */
  async upsertBrandsByIds(tenantId: string, ids: number[]): Promise<number> {
    const brands = await this.getBrandsByIds(ids);
    let synced = 0;

    console.log(`[Cianbox Webhook] Procesando ${brands.length} marcas`);

    for (const brand of brands) {
      const brandName = brand.marca || `Marca ${brand.id}`;

      await prisma.brand.upsert({
        where: {
          tenantId_cianboxBrandId: {
            tenantId,
            cianboxBrandId: brand.id,
          },
        },
        update: {
          name: brandName,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxBrandId: brand.id,
          name: brandName,
          lastSyncedAt: new Date(),
        },
      });

      synced++;
    }

    console.log(`[Cianbox Webhook] Sincronizadas ${synced} marcas`);
    return synced;
  }

  /**
   * Sincroniza listas de precios específicas por IDs
   */
  async upsertPriceListsByIds(tenantId: string, ids: number[]): Promise<number> {
    const priceLists = await this.getPriceListsByIds(ids);
    let synced = 0;

    console.log(`[Cianbox Webhook] Procesando ${priceLists.length} listas de precios`);

    for (const priceList of priceLists) {
      const name = priceList.lista || `Lista ${priceList.id}`;
      const isDefault = priceList.id === 0;

      await prisma.priceList.upsert({
        where: {
          tenantId_cianboxPriceListId: {
            tenantId,
            cianboxPriceListId: priceList.id,
          },
        },
        update: {
          name,
          isDefault,
          isActive: priceList.vigente,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxPriceListId: priceList.id,
          name,
          currency: 'ARS',
          isDefault,
          isActive: priceList.vigente,
          lastSyncedAt: new Date(),
        },
      });

      synced++;
    }

    console.log(`[Cianbox Webhook] Sincronizadas ${synced} listas de precios`);
    return synced;
  }

  /**
   * Sincroniza sucursales específicas por IDs (para webhooks)
   */
  async upsertBranchesByIds(tenantId: string, ids: number[]): Promise<number> {
    const branches = await this.getBranchesByIds(ids);
    let synced = 0;

    console.log(`[Cianbox Webhook] Procesando ${branches.length} sucursales`);

    for (const branch of branches) {
      const name = branch.sucursal || `Sucursal ${branch.id}`;
      const code = `SUC-${branch.id}`;
      const isDefault = branch.id === 1;
      const isActive = branch.vigente !== false;

      // Buscar si ya existe una sucursal con este cianboxBranchId
      let existingBranch = await prisma.branch.findFirst({
        where: { tenantId, cianboxBranchId: branch.id },
      });

      // Si no existe por cianboxBranchId, buscar por nombre similar (sin cianboxBranchId asignado)
      if (!existingBranch) {
        const branchByName = await prisma.branch.findFirst({
          where: {
            tenantId,
            cianboxBranchId: null,
            OR: [
              { name: { equals: name, mode: 'insensitive' } },
              { name: { contains: branch.sucursal, mode: 'insensitive' } },
            ],
          },
        });

        if (branchByName) {
          existingBranch = await prisma.branch.update({
            where: { id: branchByName.id },
            data: {
              cianboxBranchId: branch.id,
              address: branch.domicilio || branchByName.address,
              city: branch.localidad || branchByName.city,
              state: branch.provincia || branchByName.state,
              phone: branch.telefono || branchByName.phone,
              isActive,
              lastSyncedAt: new Date(),
            },
          });
          console.log(`[Cianbox Webhook] Sucursal existente "${branchByName.name}" mapeada a Cianbox ID ${branch.id}`);
        }
      }

      if (existingBranch) {
        // Actualizar sucursal existente
        await prisma.branch.update({
          where: { id: existingBranch.id },
          data: {
            name, // Actualizar nombre también
            address: branch.domicilio || existingBranch.address,
            city: branch.localidad || existingBranch.city,
            state: branch.provincia || existingBranch.state,
            phone: branch.telefono || existingBranch.phone,
            isActive,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        // Crear nueva sucursal
        await prisma.branch.create({
          data: {
            tenantId,
            cianboxBranchId: branch.id,
            code,
            name,
            address: branch.domicilio || null,
            city: branch.localidad || null,
            state: branch.provincia || null,
            phone: branch.telefono || null,
            isDefault,
            isActive,
            lastSyncedAt: new Date(),
          },
        });
        console.log(`[Cianbox Webhook] Nueva sucursal creada: "${name}" (Cianbox ID: ${branch.id})`);
      }

      synced++;
    }

    console.log(`[Cianbox Webhook] Sincronizadas ${synced} sucursales`);
    return synced;
  }

  // =============================================
  // GESTIÓN DE WEBHOOKS EN CIANBOX
  // =============================================

  /**
   * Lista los webhooks configurados en Cianbox
   */
  async listWebhooks(): Promise<Array<{ id: number; evento: string; url: string; creado: string }>> {
    const response = await this.request<{
      status: string;
      body: Array<{ id: number; evento: string; url: string; creado: string; updated: string }>;
    }>('/general/notificaciones');
    return response.body || [];
  }

  /**
   * Registra un webhook en Cianbox
   * @param events Lista de eventos: productos, categorias, marcas, listas_precio, etc.
   * @param url URL del webhook
   */
  async registerWebhook(events: string[], url: string): Promise<{ success: boolean; message: string }> {
    const response = await this.request<{
      status: string;
      body: { status: string; descripcion: string };
    }>('/general/notificaciones/alta', {
      method: 'POST',
      body: JSON.stringify({ evento: events, url }),
    });

    return {
      success: response.status === 'ok',
      message: response.body?.descripcion || 'Webhook registrado',
    };
  }

  /**
   * Elimina webhooks de Cianbox
   * @param events Lista de eventos a dar de baja
   */
  async deleteWebhook(events: string[]): Promise<{ success: boolean; message: string }> {
    const response = await this.request<{
      status: string;
      body: { status: string; descripcion: string };
    }>('/general/notificaciones/eliminar', {
      method: 'DELETE',
      body: JSON.stringify({ evento: events }),
    });

    return {
      success: response.status === 'ok',
      message: response.body?.descripcion || 'Webhook eliminado',
    };
  }
}

export default CianboxService;
