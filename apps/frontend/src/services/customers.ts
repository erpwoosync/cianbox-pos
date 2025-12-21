// Servicio de clientes - conecta con backend API

import { api } from './api';

export interface Customer {
  id: string;
  name: string;
  tradeName?: string;
  customerType?: 'CONSUMER' | 'INDIVIDUAL' | 'BUSINESS' | 'GOVERNMENT';
  taxId?: string;
  taxIdType?: 'DNI' | 'CUIT' | 'CUIL' | 'PASSPORT' | 'OTHER';
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  globalDiscount?: number;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
}

// Cliente genérico "Consumidor Final"
export const CONSUMIDOR_FINAL: Customer = {
  id: 'consumidor-final',
  name: 'Consumidor Final',
  customerType: 'CONSUMER',
  taxIdType: 'DNI',
  taxId: '00000000',
};

// Obtener todos los clientes desde el backend
export const getCustomers = async (): Promise<Customer[]> => {
  try {
    const response = await api.get('/customers', {
      params: { pageSize: 100, isActive: 'true' },
    });
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
  }
  return [];
};

// Buscar clientes
export const searchCustomers = async (query: string): Promise<Customer[]> => {
  if (!query || query.length < 2) {
    return getCustomers();
  }

  try {
    const response = await api.get('/customers/search', {
      params: { q: query },
    });
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('Error searching customers:', error);
  }
  return [];
};

// Obtener cliente por ID
export const getCustomerById = async (id: string): Promise<Customer | null> => {
  if (id === CONSUMIDOR_FINAL.id) {
    return CONSUMIDOR_FINAL;
  }

  try {
    const response = await api.get(`/customers/${id}`);
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('Error fetching customer:', error);
  }
  return null;
};

// Crear nuevo cliente
export const createCustomer = async (data: {
  name: string;
  customerType?: Customer['customerType'];
  taxId?: string;
  taxIdType?: Customer['taxIdType'];
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  notes?: string;
}): Promise<Customer | null> => {
  try {
    const response = await api.post('/customers', data);
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
  return null;
};

// Actualizar cliente
export const updateCustomer = async (
  id: string,
  data: Partial<Omit<Customer, 'id'>>
): Promise<Customer | null> => {
  try {
    const response = await api.put(`/customers/${id}`, data);
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
  return null;
};

// Eliminar cliente
export const deleteCustomer = async (id: string): Promise<boolean> => {
  try {
    const response = await api.delete(`/customers/${id}`);
    return response.data.success;
  } catch (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
};

// Obtener todos los clientes incluyendo Consumidor Final
export const getAllCustomers = async (): Promise<Customer[]> => {
  const customers = await getCustomers();
  return [CONSUMIDOR_FINAL, ...customers];
};

export const customersService = {
  getAll: getCustomers,
  getAllWithDefault: getAllCustomers,
  search: searchCustomers,
  getById: getCustomerById,
  create: createCustomer,
  update: updateCustomer,
  delete: deleteCustomer,
  CONSUMIDOR_FINAL,
};

export default customersService;
