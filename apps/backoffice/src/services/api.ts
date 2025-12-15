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
