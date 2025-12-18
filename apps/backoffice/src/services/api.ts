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
export const productsApi = {
  getAll: async (params?: { categoryId?: string; brandId?: string; search?: string }) => {
    const response = await api.get('/backoffice/products', { params });
    return response.data.data;
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
};

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
export const stockApi = {
  getByProduct: async (productId: string) => {
    const response = await api.get(`/backoffice/products/${productId}/stock`);
    return response.data.data;
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
};

export default api;
