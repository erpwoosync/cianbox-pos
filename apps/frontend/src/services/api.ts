import axios from 'axios';
import { useAuthStore } from '../context/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Crear instancia de axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es 401 y no es un retry, intentar refrescar token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const newToken = response.data.data.token;
          useAuthStore.getState().updateToken(newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Si falla el refresh, cerrar sesión
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

// Tipos de respuesta
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Servicios de autenticación
export const authService = {
  login: async (email: string, password: string, tenantSlug: string) => {
    const response = await api.post<ApiResponse<{
      token: string;
      refreshToken: string;
      user: unknown;
      tenant: unknown;
      sessionId: string;
    }>>('/auth/login', {
      email,
      password,
      tenantSlug,
    });
    return response.data;
  },

  loginWithPin: async (pin: string, tenantSlug: string) => {
    const response = await api.post('/auth/login/pin', {
      pin,
      tenantSlug,
    });
    return response.data;
  },

  logout: async (sessionId?: string) => {
    const response = await api.post('/auth/logout', { sessionId });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Servicios de productos
export const productsService = {
  list: async (params?: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  search: async (query: string, priceListId?: string, branchId?: string) => {
    const response = await api.get('/products/search', {
      params: { q: query, priceListId, branchId },
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/products/categories');
    return response.data;
  },

  getBrands: async () => {
    const response = await api.get('/products/brands');
    return response.data;
  },
};

// Servicios de ventas
export const salesService = {
  create: async (saleData: {
    branchId: string;
    pointOfSaleId: string;
    customerId?: string;
    receiptType?: string;
    items: Array<{
      productId?: string;
      comboId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      taxRate?: number;
      promotionId?: string;
      promotionName?: string;
    }>;
    payments: Array<{
      method: string;
      amount: number;
      reference?: string;
      cardBrand?: string;
      cardLastFour?: string;
      installments?: number;
      amountTendered?: number;
      transactionId?: string;
      // Campos de Mercado Pago
      mpPaymentId?: string;
      mpOrderId?: string;
      mpOperationType?: string;
      mpPointType?: string;
      cardFirstSix?: string;
      cardExpirationMonth?: number;
      cardExpirationYear?: number;
      cardholderName?: string;
      cardType?: string;
      payerEmail?: string;
      payerIdType?: string;
      payerIdNumber?: string;
      authorizationCode?: string;
      mpFeeAmount?: number;
      mpFeeRate?: number;
      netReceivedAmount?: number;
      bankOriginId?: string;
      bankOriginName?: string;
      bankTransferId?: string;
      mpDeviceId?: string;
      mpPosId?: string;
      mpStoreId?: string;
      providerData?: Record<string, unknown>;
    }>;
    notes?: string;
  }) => {
    const response = await api.post('/sales', saleData);
    return response.data;
  },

  list: async (params?: {
    branchId?: string;
    pointOfSaleId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  cancel: async (id: string, reason: string) => {
    const response = await api.post(`/sales/${id}/cancel`, { reason });
    return response.data;
  },

  getDailySummary: async (branchId?: string, pointOfSaleId?: string) => {
    const response = await api.get('/sales/reports/daily-summary', {
      params: { branchId, pointOfSaleId },
    });
    return response.data;
  },
};

// Servicios de promociones
export const promotionsService = {
  getActive: async () => {
    const response = await api.get('/promotions/active');
    return response.data;
  },

  getCombosActive: async () => {
    const response = await api.get('/promotions/combos/active');
    return response.data;
  },

  calculate: async (items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>, customerId?: string) => {
    const response = await api.post('/promotions/calculate', {
      items,
      customerId,
    });
    return response.data;
  },
};

// Servicios de Puntos de Venta
export const pointsOfSaleService = {
  list: async (branchId?: string) => {
    const response = await api.get('/backoffice/points-of-sale', {
      params: branchId ? { branchId } : undefined,
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/backoffice/points-of-sale/${id}`);
    return response.data;
  },
};

// Servicios de Cianbox
export const cianboxService = {
  getConnection: async () => {
    const response = await api.get('/cianbox/connection');
    return response.data;
  },

  syncAll: async () => {
    const response = await api.post('/cianbox/sync/all');
    return response.data;
  },

  getSyncStatus: async () => {
    const response = await api.get('/cianbox/sync/status');
    return response.data;
  },
};

// Tipos de Mercado Pago
export interface MPOrderResult {
  orderId: string;
  status: string;
  paymentId?: string;
  paymentMethod?: string;
  cardBrand?: string;
  cardLastFour?: string;
  installments?: number;
  amount?: number;
}

export interface MPQRData {
  qrData: string;
  qrBase64?: string;
  orderId: string;
  externalReference: string;
}

// Servicios de Mercado Pago
export const mercadoPagoService = {
  // Verificar si MP Point está configurado para el POS
  checkPointConfig: async (pointOfSaleId: string) => {
    const response = await api.get(`/backoffice/points-of-sale/${pointOfSaleId}`);
    return {
      success: response.data.success,
      hasDevice: !!response.data.data?.mpDeviceId,
      deviceId: response.data.data?.mpDeviceId,
      deviceName: response.data.data?.mpDeviceName,
    };
  },

  // Crear orden en terminal Point
  createPointOrder: async (data: {
    pointOfSaleId: string;
    amount: number;
    externalReference: string;
    description?: string;
  }): Promise<ApiResponse<{ orderId: string; status: string }>> => {
    const response = await api.post('/mercadopago/orders', data);
    return response.data;
  },

  // Consultar estado de orden
  getOrderStatus: async (orderId: string): Promise<ApiResponse<MPOrderResult>> => {
    const response = await api.get(`/mercadopago/orders/${orderId}`);
    return response.data;
  },

  // Cancelar orden
  cancelOrder: async (orderId: string): Promise<ApiResponse<void>> => {
    const response = await api.post(`/mercadopago/orders/${orderId}/cancel`);
    return response.data;
  },

  // Verificar si MP QR está configurado
  checkQRConfig: async () => {
    const response = await api.get('/mercadopago/config?appType=QR');
    return {
      success: response.data.success,
      isConnected: response.data.isConnected,
    };
  },

  // Crear orden QR
  createQROrder: async (data: {
    pointOfSaleId: string;
    amount: number;
    externalReference: string;
    description?: string;
    items?: Array<{
      title: string;
      quantity: number;
      unit_price: number;
    }>;
  }): Promise<ApiResponse<MPQRData>> => {
    const response = await api.post('/mercadopago/qr/orders', data);
    return response.data;
  },

  // Consultar estado de orden QR
  getQROrderStatus: async (externalReference: string): Promise<ApiResponse<MPOrderResult>> => {
    const response = await api.get(`/mercadopago/qr/status/${encodeURIComponent(externalReference)}`);
    return response.data;
  },

  // Obtener detalles completos de un pago de MP
  getPaymentDetails: async (paymentId: string, appType: 'POINT' | 'QR' = 'POINT'): Promise<ApiResponse<MPPaymentDetails>> => {
    const response = await api.get(`/mercadopago/payments/${paymentId}/details?appType=${appType}`);
    return response.data;
  },
};

// Detalles completos de un pago de MP
export interface MPPaymentDetails {
  mpPaymentId?: string;
  mpOrderId?: string;
  mpOperationType?: string;
  mpPointType?: string;
  cardBrand?: string;
  cardLastFour?: string;
  cardFirstSix?: string;
  cardExpirationMonth?: number;
  cardExpirationYear?: number;
  cardholderName?: string;
  cardType?: string;
  paymentMethodType?: string;
  installments?: number;
  payerEmail?: string;
  payerIdType?: string;
  payerIdNumber?: string;
  authorizationCode?: string;
  transactionAmount?: number;
  netReceivedAmount?: number;
  mpFeeAmount?: number;
  mpFeeRate?: number;
  bankOriginId?: string;
  bankOriginName?: string;
  bankTransferId?: string;
  mpDeviceId?: string;
  mpPosId?: string;
  mpStoreId?: string;
  status?: string;
  statusDetail?: string;
  dateApproved?: string;
  dateCreated?: string;
}

export default api;
