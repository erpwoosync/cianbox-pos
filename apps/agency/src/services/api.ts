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
  const token = localStorage.getItem('agency_token');
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
      localStorage.removeItem('agency_token');
      localStorage.removeItem('agency_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/agency/login', { email, password });
    return response.data.data; // Backend devuelve { success, data: { token, user } }
  },
  logout: () => {
    localStorage.removeItem('agency_token');
    localStorage.removeItem('agency_user');
  },
};

// Tenants API
export const tenantsApi = {
  getAll: async () => {
    const response = await api.get('/agency/tenants');
    return response.data.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/agency/tenants/${id}`);
    return response.data.data;
  },
  create: async (data: CreateTenantDto) => {
    const response = await api.post('/agency/tenants', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdateTenantDto) => {
    const response = await api.put(`/agency/tenants/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/agency/tenants/${id}`);
    return response.data;
  },
  updateStatus: async (id: string, status: string) => {
    const response = await api.put(`/agency/tenants/${id}/status`, { status });
    return response.data.data;
  },
  syncProducts: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/products`);
    return response.data;
  },
  syncCategories: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/categories`);
    return response.data;
  },
  syncBrands: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/brands`);
    return response.data;
  },
  syncBranches: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/branches`);
    return response.data;
  },
  syncPriceLists: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/price-lists`);
    return response.data;
  },
  syncCustomers: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/customers`);
    return response.data;
  },
  syncAll: async (id: string) => {
    const response = await api.post(`/agency/tenants/${id}/sync/all`);
    return response.data;
  },
  getSyncStatus: async (id: string) => {
    const response = await api.get(`/agency/tenants/${id}/sync/status`);
    return response.data.data;
  },
};

// Cianbox Connections API
export const connectionsApi = {
  getByTenant: async (tenantId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/connection`);
    return response.data.data;
  },
  update: async (tenantId: string, data: UpdateConnectionDto) => {
    const response = await api.put(`/agency/tenants/${tenantId}/connection`, data);
    return response.data.data;
  },
  test: async (tenantId: string) => {
    const response = await api.post(`/agency/tenants/${tenantId}/connection/test`);
    return response.data;
  },
};

// Database Servers API
export const dbServersApi = {
  getAll: async () => {
    const response = await api.get('/agency/database-servers');
    return response.data.data;
  },
  create: async (data: CreateDbServerDto) => {
    const response = await api.post('/agency/database-servers', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdateDbServerDto) => {
    const response = await api.put(`/agency/database-servers/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/agency/database-servers/${id}`);
    return response.data;
  },
  testConnection: async (id: string) => {
    const response = await api.post(`/agency/database-servers/${id}/test`);
    return response.data;
  },
};

// Agency Users API
export const agencyUsersApi = {
  getAll: async () => {
    const response = await api.get('/agency/users');
    return response.data.data;
  },
  create: async (data: CreateAgencyUserDto) => {
    const response = await api.post('/agency/users', data);
    return response.data.data;
  },
  update: async (id: string, data: UpdateAgencyUserDto) => {
    const response = await api.put(`/agency/users/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/agency/users/${id}`);
    return response.data;
  },
};

// Dashboard Stats API
export const dashboardApi = {
  getStats: async () => {
    const response = await api.get('/agency/dashboard');
    return response.data.data;
  },
};

// Tenant Catalog API (para ver catálogo de cada tenant)
export const catalogApi = {
  // Categorías
  getCategories: async (tenantId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/catalog/categories`);
    return response.data.data;
  },
  // Marcas
  getBrands: async (tenantId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/catalog/brands`);
    return response.data.data;
  },
  // Productos
  getProducts: async (tenantId: string, params?: { categoryId?: string; brandId?: string; search?: string }) => {
    const response = await api.get(`/agency/tenants/${tenantId}/catalog/products`, { params });
    return response.data.data;
  },
  // Producto por ID con precios y stock
  getProduct: async (tenantId: string, productId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/catalog/products/${productId}`);
    return response.data.data;
  },
  // Listas de precios
  getPriceLists: async (tenantId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/catalog/price-lists`);
    return response.data.data;
  },
  // Sucursales
  getBranches: async (tenantId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/catalog/branches`);
    return response.data.data;
  },
  // Puntos de Venta
  getPointsOfSale: async (tenantId: string) => {
    const response = await api.get(`/agency/tenants/${tenantId}/points-of-sale`);
    return response.data.data;
  },
  createPointOfSale: async (tenantId: string, data: CreatePointOfSaleDto) => {
    const response = await api.post(`/agency/tenants/${tenantId}/points-of-sale`, data);
    return response.data.data;
  },
  updatePointOfSale: async (tenantId: string, posId: string, data: UpdatePointOfSaleDto) => {
    const response = await api.put(`/agency/tenants/${tenantId}/points-of-sale/${posId}`, data);
    return response.data.data;
  },
  deletePointOfSale: async (tenantId: string, posId: string) => {
    const response = await api.delete(`/agency/tenants/${tenantId}/points-of-sale/${posId}`);
    return response.data;
  },
};

// Types
export interface CreateTenantDto {
  name: string;
  slug: string;
  dbServerId?: string;
  cianboxApiUrl?: string;
  cianboxApiKey?: string;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  status?: string;
  plan?: string;
  dbServerId?: string;
}

export interface UpdateConnectionDto {
  cuenta?: string;
  appName?: string;
  appCode?: string;
  user?: string;
  password?: string;
  syncPageSize?: number;
  isActive?: boolean;
  webhookUrl?: string;
}

export interface CreateDbServerDto {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface UpdateDbServerDto {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  isActive?: boolean;
}

export interface CreateAgencyUserDto {
  email: string;
  password: string;
  name: string;
}

export interface UpdateAgencyUserDto {
  email?: string;
  password?: string;
  name?: string;
  isActive?: boolean;
}

// Catalog Types
export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  children?: Category[];
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
  category?: { id: string; name: string };
  brand?: { id: string; name: string };
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

export interface PriceList {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

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
}

export interface UpdatePointOfSaleDto {
  branchId?: string;
  code?: string;
  name?: string;
  description?: string;
  priceListId?: string | null;
  isActive?: boolean;
}

export default api;
