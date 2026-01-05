import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('backoffice_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('backoffice_token');
      localStorage.removeItem('backoffice_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string, tenantSlug: string) => {
    const response = await api.post('/auth/login', { email, password, tenantSlug });
    return response.data.data;
  },
  logout: () => {
    localStorage.removeItem('backoffice_token');
    localStorage.removeItem('backoffice_user');
    localStorage.removeItem('backoffice_tenant');
  },
};

// Categories API
export const categoriesApi = {
  getAll: async () => {
    const response = await api.get('/backoffice/categories');
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/categories/${id}`);
    return response.data.data;
  },
  create: async (data: { name: string; parentId?: string }) => {
    const response = await api.post('/backoffice/categories', data);
    return response.data.data;
  },
  update: async (id: string, data: { name?: string; parentId?: string; isActive?: boolean }) => {
    const response = await api.put(`/backoffice/categories/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/categories/${id}`);
    return response.data;
  },
  // Quick Access
  getQuickAccess: async () => {
    const response = await api.get('/products/categories/quick-access');
    return response.data.data;
  },
  updateQuickAccess: async (
    id: string,
    data: {
      isQuickAccess: boolean;
      quickAccessOrder?: number;
      quickAccessColor?: string | null;
      quickAccessIcon?: string | null;
      isDefaultQuickAccess?: boolean;
    }
  ) => {
    const response = await api.put(`/products/categories/${id}/quick-access`, data);
    return response.data.data;
  },
  reorderQuickAccess: async (categoryIds: string[]) => {
    const response = await api.put('/products/categories/quick-access/reorder', { categoryIds });
    return response.data;
  },
};

// Brands API
export const brandsApi = {
  getAll: async () => {
    const response = await api.get('/backoffice/brands');
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/brands/${id}`);
    return response.data.data;
  },
  create: async (data: { name: string; description?: string }) => {
    const response = await api.post('/backoffice/brands', data);
    return response.data.data;
  },
  update: async (id: string, data: { name?: string; description?: string; isActive?: boolean }) => {
    const response = await api.put(`/backoffice/brands/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/brands/${id}`);
    return response.data;
  },
};

// Products API
export interface ProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const productsApi = {
  getAll: async (params?: {
    categoryId?: string;
    brandId?: string;
    search?: string;
    parentsOnly?: boolean;  // Solo productos padre con variantes
    hideVariants?: boolean; // Ocultar variantes, mostrar padres y simples
    page?: number;
    limit?: number;
  }): Promise<ProductsResponse> => {
    const response = await api.get('/backoffice/products', { params });
    return {
      data: response.data.data,
      pagination: response.data.pagination || { page: 1, limit: 50, total: response.data.data.length, totalPages: 1, hasMore: false },
    };
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/products/${id}`);
    return response.data.data;
  },
  create: async (data: CreateProductDto) => {
    const response = await api.post('/backoffice/products', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdateProductDto) => {
    const response = await api.put(`/backoffice/products/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/products/${id}`);
    return response.data;
  },
  // Curva de talles para productos padre
  getSizeCurve: async (productId: string, branchId?: string) => {
    const params = branchId ? { branchId } : undefined;
    const response = await api.get(`/backoffice/products/${productId}/size-curve`, { params });
    return response.data.data as SizeCurveData;
  },
  // Obtener variantes con precios
  getVariantsPrices: async (productId: string) => {
    const response = await api.get(`/backoffice/products/${productId}/variants-prices`);
    return response.data.data as VariantWithPrices[];
  },
  // Obtener variantes con stock
  getVariantsStock: async (productId: string) => {
    const response = await api.get(`/backoffice/products/${productId}/variants-stock`);
    return response.data.data as VariantWithStock[];
  },
};

export interface VariantWithPrices {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  size: string | null;
  color: string | null;
  isActive: boolean;
  prices: Array<{
    id: string;
    price: number;
    priceListId: string;
  }>;
}

export interface VariantWithStock {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  size: string | null;
  color: string | null;
  isActive: boolean;
  stock: Array<{
    id: string;
    branchId: string;
    quantity: number;
    reserved: number;
    available: number;
  }>;
}

// Tipos para curva de talles
export interface SizeCurveData {
  parent: {
    id: string;
    name: string;
    sku: string | null;
    imageUrl: string | null;
  };
  sizes: string[];
  colors: string[];
  variants: Array<{
    id: string;
    size: string | null;
    color: string | null;
    sku: string | null;
    barcode: string | null;
    isActive: boolean;
    stock: number;
  }>;
  matrix: Record<string, {
    variantId: string;
    sku: string | null;
    barcode: string | null;
    isActive: boolean;
    stock: number;
    reserved: number;
    available: number;
  }>;
  totals: {
    bySize: Record<string, number>;
    byColor: Record<string, number>;
    total: number;
  };
}

// Prices API
export const pricesApi = {
  getByProduct: async (productId: string) => {
    const response = await api.get(`/backoffice/products/${productId}/prices`);
    return response.data.data;
  },
  update: async (productId: string, prices: { priceListId: string; price: number }[]) => {
    const response = await api.put(`/backoffice/products/${productId}/prices`, { prices });
    return response.data.data;
  },
  getPriceLists: async () => {
    const response = await api.get('/backoffice/price-lists');
    return response.data.data;
  },
};

// Stock API
export interface StockResponse {
  data: ProductStock[];
  isAggregated: boolean;
  variantCount?: number;
  message?: string;
}

export const stockApi = {
  getByProduct: async (productId: string): Promise<StockResponse> => {
    const response = await api.get(`/backoffice/products/${productId}/stock`);
    return {
      data: response.data.data,
      isAggregated: response.data.isAggregated || false,
      variantCount: response.data.variantCount,
      message: response.data.message,
    };
  },
  getAll: async (params?: { lowStock?: boolean; search?: string }) => {
    const response = await api.get('/backoffice/stock', { params });
    return response.data.data;
  },
  adjust: async (productId: string, data: { quantity: number; reason: string }) => {
    const response = await api.post(`/backoffice/products/${productId}/stock/adjust`, data);
    return response.data.data;
  },
  getBranches: async () => {
    const response = await api.get('/backoffice/branches');
    return response.data.data;
  },
  cleanupUnmappedBranches: async () => {
    const response = await api.delete('/backoffice/branches/cleanup-unmapped');
    return response.data;
  },
  getBranchDiagnostics: async () => {
    const response = await api.get('/backoffice/diagnostics/branch-stock');
    return response.data.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getStats: async () => {
    const response = await api.get('/backoffice/dashboard');
    return response.data.data;
  },
};

// Points of Sale API
export const pointsOfSaleApi = {
  getAll: async () => {
    const response = await api.get('/backoffice/points-of-sale');
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/points-of-sale/${id}`);
    return response.data.data;
  },
  create: async (data: CreatePointOfSaleDto) => {
    const response = await api.post('/backoffice/points-of-sale', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdatePointOfSaleDto) => {
    const response = await api.put(`/backoffice/points-of-sale/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/points-of-sale/${id}`);
    return response.data;
  },
};

// Types
export interface CreateProductDto {
  sku: string;
  barcode?: string;
  name: string;
  shortName?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  unit?: string;
  isActive?: boolean;
}

export interface UpdateProductDto {
  sku?: string;
  barcode?: string;
  name?: string;
  shortName?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  unit?: string;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  parent?: Category;
  children?: Category[];
  isActive: boolean;
  isQuickAccess?: boolean;
  quickAccessOrder?: number;
  quickAccessColor?: string | null;
  quickAccessIcon?: string | null;
  isDefaultQuickAccess?: boolean;
  _count?: { products: number };
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  _count?: { products: number };
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  shortName?: string;
  description?: string;
  category?: Category;
  brand?: Brand;
  unit: string;
  isActive: boolean;
  prices?: ProductPrice[];
  stock?: ProductStock[];
  // Productos variables (curva de talles)
  isParent?: boolean;
  parentProductId?: string | null;
  size?: string | null;
  color?: string | null;
  _count?: {
    variants: number;
  };
}

export interface ProductPrice {
  id: string;
  priceListId: string;
  priceList?: { id: string; name: string };
  price: number;
}

export interface ProductStock {
  id: string;
  branchId: string;
  branch?: { id: string; name: string };
  quantity: number;
  reserved: number;
  available: number;
}

// Point of Sale Types
export interface PointOfSale {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  priceListId?: string;
  priceList?: { id: string; name: string; currency: string };
  mpDeviceId?: string | null;
  mpDeviceName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePointOfSaleDto {
  branchId: string;
  code: string;
  name: string;
  description?: string;
  priceListId?: string;
  isActive?: boolean;
  mpDeviceId?: string | null;
  mpDeviceName?: string | null;
}

export interface UpdatePointOfSaleDto {
  branchId?: string;
  code?: string;
  name?: string;
  description?: string;
  priceListId?: string | null;
  isActive?: boolean;
  mpDeviceId?: string | null;
  mpDeviceName?: string | null;
}

// Permissions API
export const permissionsApi = {
  getAll: async () => {
    const response = await api.get('/backoffice/permissions');
    return response.data.data;
  },
};

// Roles API
export const rolesApi = {
  getAll: async () => {
    const response = await api.get('/backoffice/roles');
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/roles/${id}`);
    return response.data.data;
  },
  create: async (data: CreateRoleDto) => {
    const response = await api.post('/backoffice/roles', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdateRoleDto) => {
    const response = await api.put(`/backoffice/roles/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/roles/${id}`);
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async () => {
    const response = await api.get('/backoffice/users');
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/users/${id}`);
    return response.data.data;
  },
  create: async (data: CreateUserDto) => {
    const response = await api.post('/backoffice/users', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdateUserDto) => {
    const response = await api.put(`/backoffice/users/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/users/${id}`);
    return response.data;
  },
};

// Permission Types
export interface Permission {
  code: string;
  name: string;
  category: string;
}

// Role Types
export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
  users?: User[];
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  roleId: string;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
  role?: { id: string; name: string; permissions?: string[] };
  branch?: { id: string; name: string; code: string };
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  roleId: string;
  branchId?: string;
  pin?: string;
  status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  roleId?: string;
  branchId?: string | null;
  pin?: string | null;
  status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
}

// ============ PROMOTIONS ============

// Promotion Types
export type PromotionType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'BUY_X_GET_Y'
  | 'SECOND_UNIT_DISCOUNT'
  | 'BUNDLE_PRICE'
  | 'FREE_SHIPPING'
  | 'COUPON'
  | 'FLASH_SALE'
  | 'LOYALTY';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';

export type PromotionApplyTo =
  | 'ALL_PRODUCTS'
  | 'SPECIFIC_PRODUCTS'
  | 'CATEGORIES'
  | 'BRANDS'
  | 'CART_TOTAL';

export interface Promotion {
  id: string;
  code?: string;
  name: string;
  description?: string;
  type: PromotionType;
  discountType: DiscountType;
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  minPurchase?: number;
  maxDiscount?: number;
  applyTo: PromotionApplyTo;
  categoryIds: string[];
  brandIds: string[];
  startDate?: string;
  endDate?: string;
  daysOfWeek: number[];
  startTime?: string;
  endTime?: string;
  maxUses?: number;
  maxUsesPerCustomer?: number;
  currentUses: number;
  isActive: boolean;
  priority: number;
  stackable: boolean;
  badgeColor?: string | null;
  metadata?: Record<string, unknown>;
  applicableProducts?: { productId: string; product?: Product }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionDto {
  code?: string;
  name: string;
  description?: string;
  type: PromotionType;
  discountType: DiscountType;
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  minPurchase?: number;
  maxDiscount?: number;
  applyTo: PromotionApplyTo;
  categoryIds?: string[];
  brandIds?: string[];
  productIds?: string[];
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  maxUses?: number;
  maxUsesPerCustomer?: number;
  isActive?: boolean;
  priority?: number;
  stackable?: boolean;
  badgeColor?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdatePromotionDto extends Partial<CreatePromotionDto> {}

export interface SimulateItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface SimulationResult {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    promotion?: { id: string; name: string; type: PromotionType };
    subtotal: number;
  }>;
  totalDiscount: number;
}

// Promotions API
export const promotionsApi = {
  getAll: async (params?: { isActive?: boolean; type?: PromotionType; search?: string }) => {
    const response = await api.get('/promotions', { params });
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/promotions/${id}`);
    return response.data.data;
  },
  create: async (data: CreatePromotionDto) => {
    const response = await api.post('/promotions', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdatePromotionDto) => {
    const response = await api.put(`/promotions/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/promotions/${id}`);
    return response.data;
  },
  simulate: async (items: SimulateItem[]) => {
    const response = await api.post('/promotions/calculate', { items });
    return response.data.data as SimulationResult;
  },
  getActive: async () => {
    const response = await api.get('/promotions/active');
    return response.data.data;
  },
};

// ============ MERCADO PAGO ============

// Tipo de aplicación de Mercado Pago
export type MercadoPagoAppType = 'POINT' | 'QR';

// Mercado Pago Config Types
export interface MercadoPagoConfig {
  id: string;
  tenantId: string;
  appType: MercadoPagoAppType;
  mpUserId?: string;
  publicKey?: string;
  scope?: string;
  isActive: boolean;
  environment: string;
  tokenExpiresAt?: string;
  isTokenExpiringSoon?: boolean;
  isConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

// Respuesta de configuración con ambas apps
export interface MercadoPagoConfigResponse {
  success: boolean;
  data: {
    point: MercadoPagoConfig | null;
    qr: MercadoPagoConfig | null;
  };
  isPointConnected: boolean;
  isQrConnected: boolean;
}

export interface MercadoPagoDevice {
  id: string;
  operating_mode: string;
  pos_id?: number;
  store_id?: string;
  external_pos_id?: string;
}

// Mercado Pago API (OAuth) con soporte para dos apps
export const mercadoPagoApi = {
  // Obtener configuración de ambas apps (Point y QR)
  getConfig: async (): Promise<MercadoPagoConfigResponse> => {
    const response = await api.get('/mercadopago/config');
    return response.data;
  },

  // Obtener configuración de una app específica
  getConfigByApp: async (appType: MercadoPagoAppType): Promise<{ data: MercadoPagoConfig | null; isConnected: boolean }> => {
    const response = await api.get(`/mercadopago/config?appType=${appType}`);
    return response.data;
  },

  // Obtener URL de autorización OAuth para una app específica
  getAuthorizationUrl: async (appType: MercadoPagoAppType = 'POINT'): Promise<string> => {
    const response = await api.get(`/mercadopago/oauth/authorize?appType=${appType}`);
    return response.data.data.authorizationUrl;
  },

  // Desvincular cuenta de MP para una app específica
  disconnect: async (appType: MercadoPagoAppType = 'POINT') => {
    const response = await api.delete(`/mercadopago/oauth/disconnect?appType=${appType}`);
    return response.data;
  },

  // Renovar token manualmente para una app específica
  refreshToken: async (appType: MercadoPagoAppType = 'POINT') => {
    const response = await api.post(`/mercadopago/refresh-token?appType=${appType}`);
    return response.data;
  },

  // Listar dispositivos Point (solo funciona con app POINT)
  listDevices: async () => {
    const response = await api.get('/mercadopago/devices');
    return response.data.data as MercadoPagoDevice[];
  },

  // Actualizar dispositivo en POS
  updatePOSDevice: async (posId: string, data: { mpDeviceId: string | null; mpDeviceName?: string | null }) => {
    const response = await api.put(`/mercadopago/points-of-sale/${posId}/device`, data);
    return response.data.data;
  },

  // Cambiar modo de operación de un dispositivo Point (PDV <-> STANDALONE)
  changeDeviceOperatingMode: async (deviceId: string, operatingMode: 'PDV' | 'STANDALONE') => {
    const response = await api.patch(`/mercadopago/devices/${deviceId}/operating-mode`, { operatingMode });
    return response.data;
  },

  // Enviar pago de prueba de $50 a un dispositivo Point
  sendTestPayment: async (deviceId: string): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      amount: number;
      externalReference: string;
      message: string;
    };
    error?: string;
  }> => {
    const response = await api.post(`/mercadopago/devices/${deviceId}/test-payment`);
    return response.data;
  },

  // Consultar estado de un pago de prueba
  getTestPaymentStatus: async (orderId: string): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      status: string;
      externalReference: string;
      isTestPayment: boolean;
      isCancelled: boolean;
      isFailed: boolean;
      isCompleted: boolean;
    };
    error?: string;
  }> => {
    const response = await api.get(`/mercadopago/test-payment/${orderId}/status`);
    return response.data;
  },

  // NOTA: La asociación terminal→POS NO se puede hacer vía API de MP.
  // Se configura desde el panel web de MP o desde el dispositivo físico:
  // Más opciones > Ajustes > Modo de vinculación

  // Listar sucursales/locales de MP QR
  listQRStores: async (): Promise<Array<{ id: string; name: string; external_id: string }>> => {
    const response = await api.get('/mercadopago/qr/stores');
    return response.data.data;
  },

  // Crear sucursal/local en MP QR
  createQRStore: async (data: {
    name: string;
    external_id: string;
    location: {
      street_name: string;
      street_number: string;
      city_name: string;
      state_name: string;
    };
  }) => {
    const response = await api.post('/mercadopago/qr/stores', data);
    return response.data;
  },

  // Listar cajas/POS de MP QR
  listQRCashiers: async (storeId?: string): Promise<Array<{
    id: number;
    name: string;
    external_id: string;
    store_id: string;
    qr?: {
      image: string;
      template_document: string;
      template_image: string;
    };
  }>> => {
    const params = storeId ? `?storeId=${storeId}` : '';
    const response = await api.get(`/mercadopago/qr/cashiers${params}`);
    return response.data.data;
  },

  // Crear caja/POS en MP QR
  createQRCashier: async (data: {
    name: string;
    external_id: string;
    store_id: string;
  }) => {
    const response = await api.post('/mercadopago/qr/cashiers', data);
    return response.data;
  },

  // Vincular caja QR a un PointOfSale del sistema
  linkQRCashierToPOS: async (posId: string, data: { mpQrPosId: number | null; mpQrPosExternalId?: string | null }) => {
    const response = await api.put(`/mercadopago/points-of-sale/${posId}/qr-cashier`, data);
    return response.data.data;
  },

  // ============ BRANCHES CON MP STORES ============

  // Obtener sucursales con estado de MP (vinculadas/pendientes)
  getBranchesWithMPStatus: async (): Promise<Array<{
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    state: string | null;
    hasStore: boolean;
    mpStoreId: string | null;
    mpExternalId: string | null;
  }>> => {
    const response = await api.get('/mercadopago/qr/branches-status');
    return response.data.data;
  },

  // Crear Store en MP desde una Branch del sistema (1 click)
  createStoreFromBranch: async (branchId: string): Promise<{
    branch: { id: string; name: string; code: string; mpStoreId: string | null; mpExternalId: string | null };
    store: { id: string; name: string; external_id: string };
  }> => {
    const response = await api.post(`/mercadopago/qr/stores/from-branch/${branchId}`);
    return response.data.data;
  },

  // Sincronizar Stores existentes de MP con Branches del sistema
  syncMPStores: async (): Promise<{
    synced: number;
    notMatched: Array<{ id: string; name: string; external_id: string }>;
  }> => {
    const response = await api.post('/mercadopago/qr/sync-stores');
    return response.data.data;
  },

  // Obtener Stores de MP que no están vinculados a ninguna Branch
  getUnlinkedStores: async (): Promise<Array<{ id: string; name: string; external_id: string }>> => {
    const response = await api.get('/mercadopago/qr/unlinked-stores');
    return response.data.data;
  },

  // Vincular manualmente un Store existente a una Branch
  linkStoreToBranch: async (branchId: string, storeId: string, externalId: string): Promise<void> => {
    await api.put(`/mercadopago/qr/branches/${branchId}/link-store`, { storeId, externalId });
  },

  // Desvincular un Store de una Branch
  unlinkStoreFromBranch: async (branchId: string): Promise<void> => {
    await api.delete(`/mercadopago/qr/branches/${branchId}/unlink-store`);
  },

  // ============ CACHE LOCAL DE STORES Y CASHIERS ============

  // Obtener stores desde cache local (DB)
  getLocalStores: async (): Promise<Array<{
    id: string;
    mpStoreId: string;
    name: string;
    externalId: string;
    streetName: string | null;
    streetNumber: string | null;
    cityName: string | null;
    stateName: string | null;
    cashierCount: number;
  }>> => {
    const response = await api.get('/mercadopago/qr/local/stores');
    return response.data.data;
  },

  // Obtener cashiers desde cache local (DB)
  getLocalCashiers: async (storeId?: string): Promise<Array<{
    id: string;
    mpCashierId: number;
    name: string;
    externalId: string;
    mpStoreId: string;
    qrImage: string | null;
    qrTemplate: string | null;
  }>> => {
    const params = storeId ? `?storeId=${storeId}` : '';
    const response = await api.get(`/mercadopago/qr/local/cashiers${params}`);
    return response.data.data;
  },

  // Sincronizar stores y cashiers desde MP a cache local
  syncQRData: async (): Promise<{
    storesAdded: number;
    storesUpdated: number;
    cashiersAdded: number;
    cashiersUpdated: number;
  }> => {
    const response = await api.post('/mercadopago/qr/sync-data');
    return response.data.data;
  },
};

// ============ CAJA / TURNOS ============

export interface CashSession {
  id: string;
  sessionNumber: string;
  tenantId: string;
  branchId: string;
  pointOfSaleId: string;
  userId: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'OPEN' | 'SUSPENDED' | 'COUNTING' | 'CLOSED' | 'TRANSFERRED';
  openedAt: string;
  closedAt?: string;
  openingNotes?: string;
  closingNotes?: string;
  totalCash: number;
  totalDebit: number;
  totalCredit: number;
  totalQr: number;
  totalMpPoint: number;
  totalTransfer: number;
  totalOther: number;
  salesCount: number;
  salesTotal: number;
  refundsCount: number;
  refundsTotal: number;
  cancelsCount: number;
  withdrawalsTotal: number;
  depositsTotal: number;
  pointOfSale?: { id: string; code: string; name: string };
  branch?: { id: string; name: string };
  user?: { id: string; name: string; email: string };
  openedBy?: { id: string; name: string };
  closedBy?: { id: string; name: string };
  _count?: { sales: number; movements: number; counts: number };
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'CHANGE_FUND';
  amount: number;
  reason: string;
  description?: string;
  reference?: string;
  destinationType?: string;
  createdAt: string;
  createdBy?: { id: string; name: string };
  authorizedBy?: { id: string; name: string };
}

export interface CashCount {
  id: string;
  cashSessionId: string;
  type: 'OPENING' | 'PARTIAL' | 'CLOSING' | 'AUDIT' | 'TRANSFER';
  totalBills: number;
  totalCoins: number;
  totalCash: number;
  expectedAmount: number;
  difference: number;
  differenceType?: 'SURPLUS' | 'SHORTAGE';
  vouchers: number;
  checks: number;
  otherValues: number;
  notes?: string;
  countedAt: string;
  countedBy?: { id: string; name: string };
  verifiedBy?: { id: string; name: string };
}

export const cashApi = {
  // Listar sesiones de caja
  getSessions: async (params?: {
    branchId?: string;
    pointOfSaleId?: string;
    userId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    sessions: CashSession[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get('/backoffice/cash-sessions', { params });
    return response.data.data || response.data;
  },

  // Reporte diario
  getDailyReport: async (date?: string, branchId?: string): Promise<{
    date: string;
    sessions: CashSession[];
    summary: {
      totalSessions: number;
      openSessions: number;
      closedSessions: number;
      totalSales: number;
      totalCash: number;
      totalDebit: number;
      totalCredit: number;
      totalQr: number;
      totalMpPoint: number;
      totalTransfer: number;
      totalOther: number;
      totalWithdrawals: number;
      totalDeposits: number;
    };
  }> => {
    const response = await api.get('/backoffice/cash-sessions/report/daily', { params: { date, branchId } });
    return response.data.data || response.data;
  },

  // Detalle de sesion con movimientos, arqueos y ventas
  getSessionReport: async (sessionId: string): Promise<{
    session: CashSession & {
      movements: CashMovement[];
      counts: CashCount[];
      sales: Array<{
        id: string;
        saleNumber: string;
        saleDate: string;
        total: number;
        status: string;
        payments: Array<{ method: string; amount: number }>;
      }>;
    };
  }> => {
    const response = await api.get(`/backoffice/cash-sessions/${sessionId}`);
    return response.data.data || response.data;
  },
};

// ============ PAGOS MP HUÉRFANOS ============

export interface OrphanMPOrder {
  id: string;
  orderId: string;
  externalReference: string;
  deviceId: string;
  amount: number;
  status: string;
  paymentId?: string;
  paymentMethod?: string;
  cardBrand?: string;
  cardLastFour?: string;
  installments?: number;
  createdAt: string;
  processedAt?: string;
}

export interface CreateSaleFromOrphanDto {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  customerId?: string;
  notes?: string;
}

export interface SyncResult {
  totalFound: number;
  alreadyExists: number;
  imported: number;
  payments: Array<{ paymentId: string; externalReference: string; amount: number }>;
}

export const orphanOrdersApi = {
  getAll: async (): Promise<OrphanMPOrder[]> => {
    const response = await api.get('/backoffice/mp-orphan-orders');
    return response.data.data;
  },
  createSale: async (orderId: string, data: CreateSaleFromOrphanDto) => {
    const response = await api.post(`/backoffice/mp-orphan-orders/${orderId}/create-sale`, data);
    return response.data;
  },
  linkSale: async (orderId: string, saleId: string) => {
    const response = await api.post(`/backoffice/mp-orphan-orders/${orderId}/link-sale`, { saleId });
    return response.data;
  },
  dismiss: async (orderId: string) => {
    const response = await api.delete(`/backoffice/mp-orphan-orders/${orderId}`);
    return response.data;
  },
  syncFromMP: async (): Promise<{ success: boolean; message: string; data: SyncResult }> => {
    const response = await api.post('/backoffice/mp-orphan-orders/sync');
    return response.data;
  },
};

// Sales API
export const salesApi = {
  getAll: async (params?: { page?: number; pageSize?: number; status?: string; dateFrom?: string; dateTo?: string }) => {
    const response = await api.get('/backoffice/sales', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/sales/${id}`);
    return response.data.data;
  },
};

// POS Terminals
export interface PosTerminal {
  id: string;
  tenantId: string;
  hostname: string;
  macAddress: string;
  deviceId: string;
  osVersion: string | null;
  appVersion: string | null;
  ipAddress: string | null;
  name: string | null;
  description: string | null;
  pointOfSaleId: string | null;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'BLOCKED';
  registeredAt: string;
  lastSeenAt: string;
  lastLoginUserId: string | null;
  isOnline?: boolean;
  pointOfSale?: {
    id: string;
    code: string;
    name: string;
    branch: { id: string; name: string };
    priceList?: { id: string; name: string } | null;
  } | null;
  lastLoginUser?: { id: string; name: string; email: string } | null;
}

export interface UpdateTerminalDto {
  name?: string;
  description?: string;
  status?: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'BLOCKED';
  pointOfSaleId?: string | null;
}

export interface TerminalsStats {
  total: number;
  active: number;
  pending: number;
  disabled: number;
  blocked: number;
  online: number;
}

export const terminalsApi = {
  getAll: async (params?: { status?: string; branchId?: string; search?: string }) => {
    const response = await api.get('/backoffice/terminals', { params });
    return response.data as { success: boolean; data: PosTerminal[]; stats: TerminalsStats };
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/terminals/${id}`);
    return response.data.data as PosTerminal;
  },
  update: async (id: string, data: UpdateTerminalDto) => {
    const response = await api.patch(`/backoffice/terminals/${id}`, data);
    return response.data.data as PosTerminal;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/backoffice/terminals/${id}`);
    return response.data;
  },
};

// =============================================
// CUSTOMERS (Clientes)
// =============================================

export interface Customer {
  id: string;
  cianboxCustomerId?: number | null;
  name: string;
  taxId?: string | null;
  taxIdType?: string | null;
  taxCategory?: string | null;
  customerType: 'CONSUMER' | 'BUSINESS' | 'GOVERNMENT' | 'RESELLER';
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  creditLimit?: number | null;
  creditBalance?: number | null;
  paymentTermDays?: number | null;
  globalDiscount?: number | null;
  isActive: boolean;
  priceList?: { id: string; name: string } | null;
  lastSyncedAt?: string | null;
  // For detail view
  sales?: Array<{
    id: string;
    saleNumber: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
  _count?: { sales: number };
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  withCredit: number;
  fromCianbox: number;
}

export interface CustomersResponse {
  success: boolean;
  data: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const customersApi = {
  getAll: async (params?: { search?: string; page?: number; pageSize?: number; isActive?: boolean }) => {
    const response = await api.get('/backoffice/customers', { params });
    return response.data as CustomersResponse;
  },
  getById: async (id: string) => {
    const response = await api.get(`/backoffice/customers/${id}`);
    return response.data.data as Customer;
  },
  getStats: async () => {
    const response = await api.get('/backoffice/customers-stats');
    return response.data.data as CustomerStats;
  },
};

// ==============================================
// AFIP Facturación Electrónica
// ==============================================

export interface AfipConfig {
  id: string;
  tenantId: string;
  cuit: string;
  businessName: string;
  tradeName?: string;
  taxCategory: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  activityStartDate?: string;
  isProduction: boolean;
  isActive: boolean;
  hasCertificate?: boolean;
  hasKey?: boolean;
  hasAccessToken?: boolean;
  lastSync?: string;
  salesPoints?: AfipSalesPoint[];
}

export interface AfipSalesPoint {
  id: string;
  tenantId: string;
  afipConfigId: string;
  number: number;
  name?: string;
  lastInvoiceA: number;
  lastInvoiceB: number;
  lastInvoiceC: number;
  lastCreditNoteA: number;
  lastCreditNoteB: number;
  lastCreditNoteC: number;
  lastDebitNoteA: number;
  lastDebitNoteB: number;
  lastDebitNoteC: number;
  pointOfSaleId?: string;
  isActive: boolean;
  pointOfSale?: { id: string; name: string };
}

export interface AfipInvoice {
  id: string;
  tenantId: string;
  afipConfigId: string;
  salesPointId: string;
  voucherType: string;
  number: number;
  cae: string;
  caeExpiration: string;
  issueDate: string;
  receiverDocType: string;
  receiverDocNum: string;
  receiverName?: string;
  receiverTaxCategory?: string;
  netAmount: number;
  exemptAmount: number;
  taxAmount: number;
  otherTaxes: number;
  totalAmount: number;
  concept: number;
  status: string;
  salesPoint?: { number: number; name?: string };
}

export interface AfipConstants {
  DOC_TYPES: Record<string, number>;
  IVA_CONDITIONS: Record<string, number>;
  IVA_RATES: Record<string, { id: number; rate: number }>;
  CONCEPTS: Record<string, number>;
  VOUCHER_TYPE_CODES: Record<string, number>;
  TAX_CATEGORIES: string[];
}

export const afipApi = {
  // Configuración
  getConfig: async () => {
    const response = await api.get('/afip/config');
    return response.data as { configured: boolean; config: AfipConfig | null };
  },
  saveConfig: async (data: Partial<AfipConfig>) => {
    const response = await api.post('/afip/config', data);
    return response.data as { success: boolean; config: AfipConfig };
  },

  // Puntos de venta
  getSalesPoints: async () => {
    const response = await api.get('/afip/sales-points');
    return response.data as AfipSalesPoint[];
  },
  createSalesPoint: async (data: { number: number; name?: string; pointOfSaleId?: string }) => {
    const response = await api.post('/afip/sales-points', data);
    return response.data as AfipSalesPoint;
  },
  updateSalesPoint: async (id: string, data: Partial<AfipSalesPoint>) => {
    const response = await api.put(`/afip/sales-points/${id}`, data);
    return response.data as AfipSalesPoint;
  },
  deleteSalesPoint: async (id: string) => {
    const response = await api.delete(`/afip/sales-points/${id}`);
    return response.data as { success: boolean };
  },

  // Comprobantes
  getInvoices: async (params?: { page?: number; limit?: number; salesPointId?: string; voucherType?: string; from?: string; to?: string }) => {
    const response = await api.get('/afip/invoices', { params });
    return response.data as { data: AfipInvoice[]; pagination: { page: number; limit: number; total: number; pages: number } };
  },
  getInvoice: async (id: string) => {
    const response = await api.get(`/afip/invoices/${id}`);
    return response.data as AfipInvoice;
  },
  getInvoiceQr: async (id: string) => {
    const response = await api.get(`/afip/invoices/${id}/qr`);
    return response.data as { qrUrl: string };
  },
  createInvoice: async (data: {
    salesPointId: string;
    voucherType: string;
    concept?: number;
    receiverDocType: number;
    receiverDocNum: string;
    receiverName?: string;
    receiverTaxCategory?: number;
    netAmount: number;
    exemptAmount?: number;
    taxAmount: number;
    otherTaxes?: number;
    totalAmount: number;
    saleId?: string;
  }) => {
    const response = await api.post('/afip/invoices', data);
    return response.data;
  },
  createFacturaB: async (data: {
    salesPointId: string;
    totalAmount: number;
    receiverDocType?: number;
    receiverDocNum?: string;
    receiverName?: string;
    taxRate?: number;
    saleId?: string;
  }) => {
    const response = await api.post('/afip/invoices/factura-b', data);
    return response.data;
  },
  createNotaCreditoB: async (data: {
    salesPointId: string;
    originalInvoiceId: string;
    amount?: number;
  }) => {
    const response = await api.post('/afip/invoices/nota-credito-b', data);
    return response.data;
  },

  // Estado y utilidades
  getServerStatus: async () => {
    const response = await api.get('/afip/status');
    return response.data as { appserver: string; dbserver: string; authserver: string };
  },
  getAfipSalesPoints: async () => {
    const response = await api.get('/afip/afip-sales-points');
    return response.data as {
      salesPoints: Array<{ number: number; type: string; blocked: string; dropDate: string | null }>;
      isProduction: boolean;
      message: string | null;
    };
  },
  getLastVoucher: async (salesPointNumber: number, voucherType: string) => {
    const response = await api.get('/afip/last-voucher', { params: { salesPointNumber, voucherType } });
    return response.data as { lastNumber: number };
  },
  getConstants: async () => {
    const response = await api.get('/afip/constants');
    return response.data as AfipConstants;
  },

  // Wizard de certificados
  generateCertificate: async (data: {
    username: string;
    password: string;
    alias: string;
    isProduction: boolean;
  }) => {
    const response = await api.post('/afip/generate-certificate', data);
    return response.data as { success: boolean; message: string; hasCertificate: boolean; hasKey: boolean };
  },

  authorizeWebService: async (data: {
    username: string;
    password: string;
    wsId?: string;
    isProduction: boolean;
  }) => {
    const response = await api.post('/afip/authorize-webservice', data);
    return response.data as { success: boolean; message: string };
  },
};

// =============================================
// TREASURY (Tesorería)
// =============================================

export type TreasuryStatus = 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'REJECTED';

export interface TreasuryPending {
  id: string;
  amount: number;
  currency: string;
  status: TreasuryStatus;
  createdAt: string;
  cashMovement: {
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
  };
  cashSession: {
    id: string;
    openedAt?: string;
    closedAt?: string;
    pointOfSale: { id: string; name: string };
    user: { id: string; name: string; email: string };
  };
  confirmedAt?: string;
  confirmedBy?: { id: string; name: string; email: string };
  confirmedAmount?: number | null;
  differenceNotes?: string;
  receiptNumber?: string;
}

export interface TreasurySummary {
  currency: string;
  pending: { count: number; amount: number };
  confirmed: { count: number; expectedAmount: number; confirmedAmount: number };
  partial: { count: number; expectedAmount: number; confirmedAmount: number };
  rejected: { count: number; amount: number };
  totals: { totalExpected: number; totalReceived: number; totalDifference: number };
}

// Tipos para saldo y movimientos de tesorería
export type TreasuryMovementType = 'BANK_DEPOSIT' | 'SUPPLIER_PAYMENT' | 'EXPENSE' | 'TRANSFER' | 'OTHER';

export interface TreasuryBalance {
  currency: string;
  currentBalance: number;
  totalIncomes: number;
  totalExpenses: number;
}

export interface TreasuryMovement {
  id: string;
  type: TreasuryMovementType;
  amount: number;
  currency: string;
  description?: string;
  reference?: string;
  bankName?: string;
  bankAccount?: string;
  depositNumber?: string;
  supplierName?: string;
  invoiceNumber?: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

export interface CreateTreasuryMovementDto {
  type: TreasuryMovementType;
  amount: number;
  currency?: string;
  description?: string;
  reference?: string;
  bankName?: string;
  bankAccount?: string;
  depositNumber?: string;
  supplierName?: string;
  invoiceNumber?: string;
}

export const treasuryApi = {
  // Obtener saldo actual de tesorería
  getBalance: async (currency?: string): Promise<TreasuryBalance> => {
    const response = await api.get('/treasury/balance', { params: { currency } });
    return response.data.balance;
  },

  // Historial de movimientos (egresos)
  getMovements: async (params?: {
    type?: TreasuryMovementType;
    currency?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ movements: TreasuryMovement[]; total: number }> => {
    const response = await api.get('/treasury/movements', { params });
    return { movements: response.data.movements, total: response.data.total };
  },

  // Crear movimiento (egreso de tesorería)
  createMovement: async (data: CreateTreasuryMovementDto): Promise<{ success: boolean; message: string; movement: TreasuryMovement }> => {
    const response = await api.post('/treasury/movements', data);
    return response.data;
  },

  getPending: async (params?: {
    status?: TreasuryStatus;
    currency?: string;
    branchId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ pending: TreasuryPending[]; total: number }> => {
    const response = await api.get('/treasury/pending', { params });
    return { pending: response.data.pending, total: response.data.total };
  },

  getPendingById: async (id: string): Promise<TreasuryPending> => {
    const response = await api.get(`/treasury/pending/${id}`);
    return response.data.pending;
  },

  confirm: async (id: string, data: { receivedAmount: number; notes?: string }) => {
    const response = await api.post(`/treasury/pending/${id}/confirm`, data);
    return response.data;
  },

  reject: async (id: string, data: { reason: string }) => {
    const response = await api.post(`/treasury/pending/${id}/reject`, data);
    return response.data;
  },

  getSummary: async (params?: { fromDate?: string; toDate?: string; currency?: string }): Promise<TreasurySummary> => {
    const response = await api.get('/treasury/summary', { params });
    return response.data.summary;
  },
};

// =============================================
// GIFT CARDS (Tarjetas de Regalo)
// =============================================

export type GiftCardStatus = 'INACTIVE' | 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'CANCELLED';

export interface GiftCard {
  id: string;
  code: string;
  initialAmount: number;
  currentBalance: number;
  currency: string;
  status: GiftCardStatus;
  expiresAt?: string;
  activatedAt?: string;
  isExpired?: boolean;
  generatedBy?: { id: string; name: string };
  activatedBy?: { id: string; name: string };
  createdAt: string;
}

export interface GiftCardTransaction {
  id: string;
  type: 'ACTIVATION' | 'REDEMPTION' | 'REFUND' | 'CANCELLATION';
  amount: number;
  balanceAfter: number;
  notes?: string;
  user?: { id: string; name: string };
  sale?: { id: string; saleNumber: string };
  createdAt: string;
}

export const giftCardsApi = {
  generate: async (data: { quantity: number; amount: number; currency?: string; expiresAt?: string }): Promise<GiftCard[]> => {
    const response = await api.post('/gift-cards/generate', data);
    return response.data.giftCards;
  },

  getAll: async (params?: {
    status?: GiftCardStatus;
    currency?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ giftCards: GiftCard[]; total: number }> => {
    const response = await api.get('/gift-cards', { params });
    return { giftCards: response.data.giftCards, total: response.data.total };
  },

  getTransactions: async (id: string): Promise<{ giftCard: GiftCard; transactions: GiftCardTransaction[] }> => {
    const response = await api.get(`/gift-cards/${id}/transactions`);
    return { giftCard: response.data.giftCard, transactions: response.data.transactions };
  },

  checkBalance: async (code: string): Promise<GiftCard> => {
    const response = await api.post('/gift-cards/balance', { code });
    return response.data.giftCard;
  },

  cancel: async (code: string, reason?: string): Promise<{ success: boolean; giftCard: { id: string; code: string; status: string } }> => {
    const response = await api.post('/gift-cards/cancel', { code, reason });
    return response.data;
  },

  activate: async (code: string): Promise<{ success: boolean; giftCard: GiftCard }> => {
    const response = await api.post('/gift-cards/activate', { code });
    return response.data;
  },
};

export default api;
