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

// ==============================================
// TIPOS DE CAJA
// ==============================================

export interface CashSession {
  id: string;
  sessionNumber: string;
  pointOfSaleId: string;
  branchId: string;
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
  withdrawalsTotal: number;
  depositsTotal: number;
  pointOfSale?: { id: string; code: string; name: string };
  branch?: { id: string; name: string };
  user?: { id: string; name: string; email: string };
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'CHANGE_FUND';
  amount: number;
  reason: string;
  description?: string;
  reference?: string;
  createdAt: string;
  createdBy?: { id: string; name: string };
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
}

export interface BillsCount {
  10000?: number;
  5000?: number;
  2000?: number;
  1000?: number;
  500?: number;
  200?: number;
  100?: number;
  50?: number;
  20?: number;
  10?: number;
}

export interface CoinsCount {
  500?: number;
  200?: number;
  100?: number;
  50?: number;
  25?: number;
  10?: number;
  5?: number;
  2?: number;
  1?: number;
}

// ==============================================
// SERVICIOS DE CAJA
// ==============================================

export const cashService = {
  // Obtener turno actual del usuario
  getCurrent: async (): Promise<ApiResponse<{ session: CashSession | null; hasOpenSession: boolean; expectedCash?: number }>> => {
    const response = await api.get('/cash/current');
    return response.data;
  },

  // Obtener estado de caja por punto de venta
  getStatus: async (posId: string): Promise<ApiResponse<{
    pointOfSale: { id: string; code: string; name: string };
    currentSession: CashSession | null;
    isOpen: boolean;
    isSuspended: boolean;
    isCounting: boolean;
  }>> => {
    const response = await api.get(`/cash/status/${posId}`);
    return response.data;
  },

  // Abrir turno de caja
  open: async (data: {
    pointOfSaleId: string;
    openingAmount: number;
    notes?: string;
  }): Promise<ApiResponse<{ session: CashSession }>> => {
    const response = await api.post('/cash/open', data);
    return response.data;
  },

  // Cerrar turno de caja
  close: async (data: {
    count?: {
      bills?: BillsCount;
      coins?: CoinsCount;
      vouchers?: number;
      checks?: number;
      otherValues?: number;
      otherValuesNote?: string;
    };
    notes?: string;
  }): Promise<ApiResponse<{
    session: CashSession;
    summary: {
      openingAmount: number;
      closingAmount: number;
      expectedAmount: number;
      difference: number;
      differenceType?: 'SURPLUS' | 'SHORTAGE';
      salesCount: number;
      salesTotal: number;
      totalCash: number;
      totalDebit: number;
      totalCredit: number;
      totalQr: number;
      totalMpPoint: number;
      withdrawalsTotal: number;
      depositsTotal: number;
    };
    count?: CashCount;
  }>> => {
    const response = await api.post('/cash/close', data);
    return response.data;
  },

  // Suspender turno
  suspend: async (): Promise<ApiResponse<{ session: CashSession }>> => {
    const response = await api.post('/cash/suspend');
    return response.data;
  },

  // Reanudar turno
  resume: async (): Promise<ApiResponse<{ session: CashSession }>> => {
    const response = await api.post('/cash/resume');
    return response.data;
  },

  // Relevo de turno
  transfer: async (data: {
    toUserId: string;
    transferAmount: number;
    count?: {
      type?: string;
      bills?: BillsCount;
      coins?: CoinsCount;
      vouchers?: number;
      checks?: number;
      otherValues?: number;
    };
    notes?: string;
  }): Promise<ApiResponse<{
    closedSession: CashSession;
    newSession: CashSession;
  }>> => {
    const response = await api.post('/cash/transfer', data);
    return response.data;
  },

  // Registrar ingreso
  deposit: async (data: {
    amount: number;
    reason: string;
    description?: string;
    reference?: string;
  }): Promise<ApiResponse<{ movement: CashMovement }>> => {
    const response = await api.post('/cash/deposit', data);
    return response.data;
  },

  // Registrar retiro
  withdraw: async (data: {
    amount: number;
    reason: string;
    description?: string;
    reference?: string;
    destinationType?: string;
  }): Promise<ApiResponse<{ movement: CashMovement }>> => {
    const response = await api.post('/cash/withdraw', data);
    return response.data;
  },

  // Listar movimientos del turno actual
  getMovements: async (): Promise<ApiResponse<{ movements: CashMovement[]; sessionId: string }>> => {
    const response = await api.get('/cash/movements');
    return response.data;
  },

  // Registrar arqueo
  count: async (data: {
    type?: 'OPENING' | 'PARTIAL' | 'CLOSING' | 'AUDIT' | 'TRANSFER';
    bills: BillsCount;
    coins: CoinsCount;
    vouchers?: number;
    checks?: number;
    otherValues?: number;
    otherValuesNote?: string;
    notes?: string;
  }): Promise<ApiResponse<{
    count: CashCount;
    summary: {
      totalBills: number;
      totalCoins: number;
      totalCash: number;
      vouchers: number;
      checks: number;
      otherValues: number;
      totalWithOthers: number;
      expectedAmount: number;
      difference: number;
      differenceType?: 'SURPLUS' | 'SHORTAGE';
    };
  }>> => {
    const response = await api.post('/cash/count', data);
    return response.data;
  },

  // Ver arqueos de un turno
  getCounts: async (sessionId: string): Promise<ApiResponse<{ counts: CashCount[]; session: CashSession }>> => {
    const response = await api.get(`/cash/counts/${sessionId}`);
    return response.data;
  },

  // Reporte de un turno
  getSessionReport: async (sessionId: string): Promise<ApiResponse<{ session: CashSession }>> => {
    const response = await api.get(`/cash/report/session/${sessionId}`);
    return response.data;
  },

  // Reporte diario
  getDailyReport: async (date?: string, branchId?: string): Promise<ApiResponse<{
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
      totalWithdrawals: number;
      totalDeposits: number;
    };
  }>> => {
    const response = await api.get('/cash/report/daily', { params: { date, branchId } });
    return response.data;
  },

  // Listar todas las sesiones
  getSessions: async (params?: {
    branchId?: string;
    pointOfSaleId?: string;
    userId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    sessions: CashSession[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get('/cash/sessions', { params });
    return response.data;
  },
};

// ==============================================
// SERVICIOS DE CATEGORIAS
// ==============================================

export const categoriesService = {
  // Obtener categorias de acceso rapido
  getQuickAccess: async (): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    quickAccessColor?: string | null;
    quickAccessOrder?: number;
    isDefaultQuickAccess?: boolean;
    _count?: { products: number };
  }>>> => {
    const response = await api.get('/products/categories/quick-access');
    return response.data;
  },

  // Actualizar acceso rapido de una categoria
  updateQuickAccess: async (categoryId: string, data: {
    isQuickAccess?: boolean;
    quickAccessColor?: string | null;
    quickAccessOrder?: number;
  }): Promise<ApiResponse<{ category: { id: string; name: string } }>> => {
    const response = await api.put(`/products/categories/${categoryId}/quick-access`, data);
    return response.data;
  },

  // Reordenar categorias de acceso rapido
  reorderQuickAccess: async (categoryIds: string[]): Promise<ApiResponse<{ updated: number }>> => {
    const response = await api.put('/products/categories/quick-access/reorder', { categoryIds });
    return response.data;
  },
};

export default api;
