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
  paging?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface CianboxProduct {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  shortName: string;
  description: string;
  categoryId: number;
  brandId: number;
  basePrice: number;
  cost: number;
  taxRate: number;
  taxIncluded: boolean;
  trackStock: boolean;
  allowNegativeStock: boolean;
  minStock: number;
  sellFractions: boolean;
  unitOfMeasure: string;
  imageUrl: string;
  isActive: boolean;
  isService: boolean;
  prices: Array<{
    priceListId: number;
    price: number;
    cost: number;
  }>;
  stock: Array<{
    branchId: number;
    quantity: number;
    reserved: number;
  }>;
}

interface CianboxCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  parentId: number | null;
  level: number;
  sortOrder: number;
  imageUrl: string;
  isActive: boolean;
}

interface CianboxBrand {
  id: number;
  name: string;
  description: string;
  logoUrl: string;
  isActive: boolean;
}

interface CianboxPriceList {
  id: number;
  name: string;
  description: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

interface CianboxBranch {
  id: number;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  isDefault: boolean;
  isActive: boolean;
}

interface CianboxCustomer {
  id: number;
  customerType: string;
  taxId: string;
  taxIdType: string;
  taxCategory: string;
  name: string;
  tradeName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  priceListId: number;
  creditLimit: number;
  creditBalance: number;
  paymentTermDays: number;
  globalDiscount: number;
  isActive: boolean;
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
   * Obtiene un token de acceso válido
   * Si el token actual está expirado, lo renueva
   */
  private async getAccessToken(): Promise<string> {
    // Verificar si el token actual es válido
    if (
      this.connection.accessToken &&
      this.connection.tokenExpiresAt &&
      this.connection.tokenExpiresAt > new Date()
    ) {
      return this.connection.accessToken;
    }

    // Renovar token
    const newToken = await this.authenticate();
    return newToken;
  }

  /**
   * Autentica con Cianbox y obtiene nuevo token
   */
  private async authenticate(): Promise<string> {
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
    this.connection.tokenExpiresAt = expiresAt;

    return data.body.access_token;
  }

  /**
   * Realiza una petición autenticada a Cianbox
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token inválido, intentar re-autenticar
      await this.authenticate();
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new CianboxError(`Error Cianbox: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
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

      console.log(`[Cianbox] Response status: ${response.status}, items: ${response.body?.length || 0}`);

      if (response.body && Array.isArray(response.body)) {
        allData.push(...response.body);
      }

      // Si hay paginación, verificar si hay más páginas
      if (response.paging) {
        hasMore = page < response.paging.pages;
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
   */
  async syncProducts(tenantId: string): Promise<number> {
    const products = await this.getProducts();
    let synced = 0;

    for (const product of products) {
      await prisma.product.upsert({
        where: {
          tenantId_cianboxProductId: {
            tenantId,
            cianboxProductId: product.id,
          },
        },
        update: {
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          shortName: product.shortName,
          description: product.description,
          basePrice: product.basePrice,
          baseCost: product.cost,
          taxRate: product.taxRate,
          taxIncluded: product.taxIncluded,
          trackStock: product.trackStock,
          allowNegativeStock: product.allowNegativeStock,
          minStock: product.minStock,
          sellFractions: product.sellFractions,
          unitOfMeasure: product.unitOfMeasure,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
          isService: product.isService,
          lastSyncedAt: new Date(),
          cianboxData: product as unknown as object,
        },
        create: {
          tenantId,
          cianboxProductId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          shortName: product.shortName,
          description: product.description,
          basePrice: product.basePrice,
          baseCost: product.cost,
          taxRate: product.taxRate,
          taxIncluded: product.taxIncluded,
          trackStock: product.trackStock,
          allowNegativeStock: product.allowNegativeStock,
          minStock: product.minStock,
          sellFractions: product.sellFractions,
          unitOfMeasure: product.unitOfMeasure,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
          isService: product.isService,
          lastSyncedAt: new Date(),
          cianboxData: product as unknown as object,
        },
      });

      synced++;
    }

    // Actualizar última sincronización
    await prisma.cianboxConnection.update({
      where: { id: this.connection.id },
      data: {
        lastSync: new Date(),
        syncStatus: `Sincronizados ${synced} productos`,
      },
    });

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
   */
  async syncCategories(tenantId: string): Promise<number> {
    const categories = await this.getCategories();
    let synced = 0;

    // Primero las categorías padre (level 0)
    const sortedCategories = categories.sort((a, b) => a.level - b.level);

    for (const category of sortedCategories) {
      // Buscar categoría padre si existe
      let parentId: string | null = null;
      if (category.parentId) {
        const parent = await prisma.category.findFirst({
          where: {
            tenantId,
            cianboxCategoryId: category.parentId,
          },
        });
        parentId = parent?.id || null;
      }

      await prisma.category.upsert({
        where: {
          tenantId_cianboxCategoryId: {
            tenantId,
            cianboxCategoryId: category.id,
          },
        },
        update: {
          code: category.code,
          name: category.name,
          description: category.description,
          parentId,
          level: category.level,
          sortOrder: category.sortOrder,
          imageUrl: category.imageUrl,
          isActive: category.isActive,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxCategoryId: category.id,
          code: category.code,
          name: category.name,
          description: category.description,
          parentId,
          level: category.level,
          sortOrder: category.sortOrder,
          imageUrl: category.imageUrl,
          isActive: category.isActive,
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
   */
  async syncBrands(tenantId: string): Promise<number> {
    const brands = await this.getBrands();
    let synced = 0;

    for (const brand of brands) {
      await prisma.brand.upsert({
        where: {
          tenantId_cianboxBrandId: {
            tenantId,
            cianboxBrandId: brand.id,
          },
        },
        update: {
          name: brand.name,
          description: brand.description,
          logoUrl: brand.logoUrl,
          isActive: brand.isActive,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxBrandId: brand.id,
          name: brand.name,
          description: brand.description,
          logoUrl: brand.logoUrl,
          isActive: brand.isActive,
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
   */
  async syncPriceLists(tenantId: string): Promise<number> {
    const priceLists = await this.getPriceLists();
    let synced = 0;

    for (const priceList of priceLists) {
      await prisma.priceList.upsert({
        where: {
          tenantId_cianboxPriceListId: {
            tenantId,
            cianboxPriceListId: priceList.id,
          },
        },
        update: {
          name: priceList.name,
          description: priceList.description,
          currency: priceList.currency,
          isDefault: priceList.isDefault,
          isActive: priceList.isActive,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxPriceListId: priceList.id,
          name: priceList.name,
          description: priceList.description,
          currency: priceList.currency,
          isDefault: priceList.isDefault,
          isActive: priceList.isActive,
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
   */
  async getBranches(): Promise<CianboxBranch[]> {
    return this.fetchAllPaginated<CianboxBranch>('/sucursales');
  }

  /**
   * Sincroniza sucursales desde Cianbox
   */
  async syncBranches(tenantId: string): Promise<number> {
    const branches = await this.getBranches();
    let synced = 0;

    for (const branch of branches) {
      await prisma.branch.upsert({
        where: {
          tenantId_cianboxBranchId: {
            tenantId,
            cianboxBranchId: branch.id,
          },
        },
        update: {
          code: branch.code,
          name: branch.name,
          address: branch.address,
          city: branch.city,
          state: branch.state,
          zipCode: branch.zipCode,
          phone: branch.phone,
          email: branch.email,
          isDefault: branch.isDefault,
          isActive: branch.isActive,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          cianboxBranchId: branch.id,
          code: branch.code,
          name: branch.name,
          address: branch.address,
          city: branch.city,
          state: branch.state,
          zipCode: branch.zipCode,
          phone: branch.phone,
          email: branch.email,
          isDefault: branch.isDefault,
          isActive: branch.isActive,
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
   */
  async syncCustomers(tenantId: string): Promise<number> {
    const customers = await this.getCustomers();
    let synced = 0;

    for (const customer of customers) {
      // Buscar lista de precios asignada
      let priceListId: string | null = null;
      if (customer.priceListId) {
        const priceList = await prisma.priceList.findFirst({
          where: {
            tenantId,
            cianboxPriceListId: customer.priceListId,
          },
        });
        priceListId = priceList?.id || null;
      }

      await prisma.customer.upsert({
        where: {
          tenantId_cianboxCustomerId: {
            tenantId,
            cianboxCustomerId: customer.id,
          },
        },
        update: {
          customerType: customer.customerType as 'CONSUMER' | 'INDIVIDUAL' | 'BUSINESS' | 'GOVERNMENT' | 'RESELLER',
          taxId: customer.taxId,
          taxIdType: customer.taxIdType,
          taxCategory: customer.taxCategory,
          name: customer.name,
          tradeName: customer.tradeName,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          mobile: customer.mobile,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
          country: customer.country,
          priceListId,
          creditLimit: customer.creditLimit,
          creditBalance: customer.creditBalance,
          paymentTermDays: customer.paymentTermDays,
          globalDiscount: customer.globalDiscount,
          isActive: customer.isActive,
          lastSyncedAt: new Date(),
          cianboxData: customer as unknown as object,
        },
        create: {
          tenantId,
          cianboxCustomerId: customer.id,
          customerType: customer.customerType as 'CONSUMER' | 'INDIVIDUAL' | 'BUSINESS' | 'GOVERNMENT' | 'RESELLER',
          taxId: customer.taxId,
          taxIdType: customer.taxIdType,
          taxCategory: customer.taxCategory,
          name: customer.name,
          tradeName: customer.tradeName,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          mobile: customer.mobile,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
          country: customer.country,
          priceListId,
          creditLimit: customer.creditLimit,
          creditBalance: customer.creditBalance,
          paymentTermDays: customer.paymentTermDays,
          globalDiscount: customer.globalDiscount,
          isActive: customer.isActive,
          lastSyncedAt: new Date(),
          cianboxData: customer as unknown as object,
        },
      });

      synced++;
    }

    return synced;
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
