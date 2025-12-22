/**
 * Servicio de clientes
 * - Conecta con backend API
 * - Usa IndexedDB como cache local para modo offline
 */

import { api } from './api';
import db, { STORES, addPendingSync } from './indexedDB';

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
  syncedAt?: string;
  _isLocal?: boolean; // Flag para indicar que fue creado offline
}

// Cliente genérico "Consumidor Final"
export const CONSUMIDOR_FINAL: Customer = {
  id: 'consumidor-final',
  name: 'Consumidor Final',
  customerType: 'CONSUMER',
  taxIdType: 'DNI',
  taxId: '00000000',
};

// Verificar si hay conexión
const isOnline = () => navigator.onLine;

// Sincronizar clientes del backend al IndexedDB
export const syncCustomersToLocal = async (): Promise<void> => {
  if (!isOnline()) return;

  try {
    const response = await api.get('/customers', {
      params: { pageSize: 500, isActive: 'true' },
    });

    if (response.data.success && response.data.data) {
      const customers = response.data.data.map((c: Customer) => ({
        ...c,
        syncedAt: new Date().toISOString(),
      }));

      // Guardar en IndexedDB
      await db.putMany(STORES.CUSTOMERS, customers);
      console.log(`Synced ${customers.length} customers to IndexedDB`);
    }
  } catch (error) {
    console.error('Error syncing customers:', error);
  }
};

// Obtener clientes (primero intenta backend, fallback a IndexedDB)
export const getCustomers = async (): Promise<Customer[]> => {
  try {
    if (isOnline()) {
      const response = await api.get('/customers', {
        params: { pageSize: 100, isActive: 'true' },
      });

      if (response.data.success) {
        const customers = response.data.data.map((c: Customer) => ({
          ...c,
          syncedAt: new Date().toISOString(),
        }));

        // Actualizar cache local
        await db.putMany(STORES.CUSTOMERS, customers);
        return customers;
      }
    }
  } catch (error) {
    console.warn('Error fetching customers from API, using local cache:', error);
  }

  // Fallback a IndexedDB
  return db.getAll<Customer>(STORES.CUSTOMERS);
};

// Buscar clientes
export const searchCustomers = async (query: string): Promise<Customer[]> => {
  if (!query || query.length < 2) {
    return getCustomers();
  }

  try {
    if (isOnline()) {
      const response = await api.get('/customers/search', {
        params: { q: query },
      });

      if (response.data.success) {
        return response.data.data;
      }
    }
  } catch (error) {
    console.warn('Error searching customers from API:', error);
  }

  // Búsqueda local en IndexedDB
  const allCustomers = await db.getAll<Customer>(STORES.CUSTOMERS);
  const lowerQuery = query.toLowerCase();

  return allCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.taxId?.toLowerCase().includes(lowerQuery) ||
      c.email?.toLowerCase().includes(lowerQuery) ||
      c.phone?.includes(query)
  );
};

// Obtener cliente por ID
export const getCustomerById = async (id: string): Promise<Customer | null> => {
  if (id === CONSUMIDOR_FINAL.id) {
    return CONSUMIDOR_FINAL;
  }

  // Primero buscar en cache local (más rápido)
  const cached = await db.getById<Customer>(STORES.CUSTOMERS, id);
  if (cached) return cached;

  // Si no está en cache y hay conexión, buscar en backend
  if (isOnline()) {
    try {
      const response = await api.get(`/customers/${id}`);
      if (response.data.success) {
        const customer = { ...response.data.data, syncedAt: new Date().toISOString() };
        await db.put(STORES.CUSTOMERS, customer);
        return customer;
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
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
  if (isOnline()) {
    try {
      const response = await api.post('/customers', data);
      if (response.data.success) {
        const customer = { ...response.data.data, syncedAt: new Date().toISOString() };
        await db.put(STORES.CUSTOMERS, customer);
        return customer;
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  } else {
    // Crear localmente y marcar para sync posterior
    const localCustomer: Customer = {
      ...data,
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      _isLocal: true,
    };

    await db.put(STORES.CUSTOMERS, localCustomer);
    await addPendingSync(STORES.CUSTOMERS, 'create', localCustomer);

    return localCustomer;
  }

  return null;
};

// Actualizar cliente
export const updateCustomer = async (
  id: string,
  data: Partial<Omit<Customer, 'id'>>
): Promise<Customer | null> => {
  if (isOnline()) {
    try {
      const response = await api.put(`/customers/${id}`, data);
      if (response.data.success) {
        const customer = { ...response.data.data, syncedAt: new Date().toISOString() };
        await db.put(STORES.CUSTOMERS, customer);
        return customer;
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  } else {
    // Actualizar localmente y marcar para sync
    const existing = await db.getById<Customer>(STORES.CUSTOMERS, id);
    if (existing) {
      const updated = { ...existing, ...data, _isLocal: true };
      await db.put(STORES.CUSTOMERS, updated);
      await addPendingSync(STORES.CUSTOMERS, 'update', { id, ...data });
      return updated;
    }
  }

  return null;
};

// Eliminar cliente
export const deleteCustomer = async (id: string): Promise<boolean> => {
  if (isOnline()) {
    try {
      const response = await api.delete(`/customers/${id}`);
      if (response.data.success) {
        await db.remove(STORES.CUSTOMERS, id);
        return true;
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  } else {
    // Marcar para eliminar cuando haya conexión
    await addPendingSync(STORES.CUSTOMERS, 'delete', { id });
    await db.remove(STORES.CUSTOMERS, id);
    return true;
  }

  return false;
};

// Obtener todos los clientes incluyendo Consumidor Final
export const getAllCustomers = async (): Promise<Customer[]> => {
  const customers = await getCustomers();
  return [CONSUMIDOR_FINAL, ...customers];
};

// Sincronizar operaciones pendientes al backend
export const syncPendingOperations = async (): Promise<void> => {
  if (!isOnline()) return;

  const pending = await db.getPendingSyncs();
  const customerOps = pending.filter((p) => p.store === STORES.CUSTOMERS);

  for (const op of customerOps) {
    try {
      const data = op.data as Customer | { id: string };

      switch (op.operation) {
        case 'create': {
          const customerData = data as Customer;
          const response = await api.post('/customers', {
            name: customerData.name,
            customerType: customerData.customerType,
            taxId: customerData.taxId,
            taxIdType: customerData.taxIdType,
            email: customerData.email,
            phone: customerData.phone,
            address: customerData.address,
            notes: customerData.notes,
          });

          if (response.data.success) {
            // Reemplazar el registro local con el del servidor
            await db.remove(STORES.CUSTOMERS, customerData.id);
            await db.put(STORES.CUSTOMERS, {
              ...response.data.data,
              syncedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'update': {
          const updateData = data as { id: string };
          await api.put(`/customers/${updateData.id}`, data);
          break;
        }

        case 'delete': {
          const deleteData = data as { id: string };
          await api.delete(`/customers/${deleteData.id}`);
          break;
        }
      }

      // Limpiar operación completada
      if (op.id) {
        await db.clearPendingSync(op.id);
      }
    } catch (error) {
      console.error('Error syncing pending operation:', op, error);
    }
  }
};

// Escuchar cambios de conexión para sincronizar
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Connection restored, syncing pending operations...');
    syncPendingOperations();
    syncCustomersToLocal();
  });
}

export const customersService = {
  getAll: getCustomers,
  getAllWithDefault: getAllCustomers,
  search: searchCustomers,
  getById: getCustomerById,
  create: createCustomer,
  update: updateCustomer,
  delete: deleteCustomer,
  syncToLocal: syncCustomersToLocal,
  syncPending: syncPendingOperations,
  CONSUMIDOR_FINAL,
};

export default customersService;
