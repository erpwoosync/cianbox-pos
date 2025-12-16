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
      const productData = {
        sku,
        barcode: product.codigo_barras || null,
        name: product.producto,
        description: product.descripcion || null,
        categoryId,
        brandId,
        basePrice: product.precio_neto || 0,
        baseCost: product.costo || 0,
        taxRate: product.alicuota_iva || 21,
        taxIncluded: true,
        trackStock: product.afecta_stock ?? true,
        allowNegativeStock: false,
        minStock: product.cantidad_minima || null,
        location: product.ubicacion || null,
        imageUrl: product.imagenes?.[0] || null,
        isActive: product.vigente ?? true,
        isService: !product.afecta_stock,
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
          // Buscar o crear sucursal por cianboxBranchId
          let branch = await prisma.branch.findFirst({
            where: { tenantId, cianboxBranchId: stockItem.id_sucursal },
          });

          if (!branch) {
            // Crear sucursal si no existe
            branch = await prisma.branch.create({
              data: {
                tenantId,
                cianboxBranchId: stockItem.id_sucursal,
                code: `SUC-${stockItem.id_sucursal}`,
                name: `Sucursal ${stockItem.id_sucursal}`,
                isActive: true,
              },
            });
          }

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

    // Actualizar última sincronización
    await prisma.cianboxConnection.update({
      where: { id: this.connection.id },
      data: {
        lastSync: new Date(),
        syncStatus: `Sincronizados ${synced} productos con precios y stock`,
      },
    });

    console.log(`[Cianbox] Sincronización de productos completada: ${synced} productos`);
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
   */
  async syncBranches(tenantId: string): Promise<number> {
    const branches = await this.getBranches();
    let synced = 0;

    console.log(`[Cianbox] Sincronizando ${branches.length} sucursales`);

    for (const branch of branches) {
      // Mapear campos de Cianbox a nuestro modelo
      const name = branch.sucursal || `Sucursal ${branch.id}`;
      const code = `SUC-${branch.id}`;
      const isDefault = branch.id === 1; // La primera sucursal es la default

      // Usar vigente directamente (default true si no viene)
      const isActive = branch.vigente !== false;

      await prisma.branch.upsert({
        where: {
          tenantId_cianboxBranchId: {
            tenantId,
            cianboxBranchId: branch.id,
          },
        },
        update: {
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
        create: {
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

      synced++;
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
  // WEBHOOKS
  // =============================================

  /**
   * Procesa un webhook de Cianbox
   */
  async processWebhook(
    tenantId: string,
    event: string,
    data: unknown
  ): Promise<void> {
    switch (event) {
      case 'product.created':
      case 'product.updated':
        await this.syncProducts(tenantId);
        break;

      case 'product.deleted':
        // Marcar producto como inactivo
        const productData = data as { id: number };
        await prisma.product.updateMany({
          where: {
            tenantId,
            cianboxProductId: productData.id,
          },
          data: {
            isActive: false,
          },
        });
        break;

      case 'customer.created':
      case 'customer.updated':
        await this.syncCustomers(tenantId);
        break;

      case 'stock.updated':
        // Re-sincronizar productos para actualizar stock
        await this.syncProducts(tenantId);
        break;

      default:
        console.log(`Evento de webhook no manejado: ${event}`);
    }
  }
}

export default CianboxService;
