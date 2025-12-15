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

export default api;
