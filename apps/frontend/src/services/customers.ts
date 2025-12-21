// Servicio de clientes con almacenamiento local

export interface Customer {
  id: string;
  name: string;
  documentType?: 'DNI' | 'CUIT' | 'CUIL' | 'PASSPORT' | 'OTHER';
  documentNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const CUSTOMERS_STORAGE_KEY = 'pos_customers';

// Generar ID único
const generateId = () => {
  return `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Obtener todos los clientes del localStorage
export const getCustomers = (): Customer[] => {
  try {
    const stored = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Customer[];
    }
  } catch (error) {
    console.error('Error loading customers from localStorage:', error);
  }
  return [];
};

// Guardar clientes en localStorage
const saveCustomers = (customers: Customer[]): void => {
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
  } catch (error) {
    console.error('Error saving customers to localStorage:', error);
  }
};

// Buscar clientes por nombre, documento o email
export const searchCustomers = (query: string): Customer[] => {
  const customers = getCustomers();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return customers;
  }

  return customers.filter(customer =>
    customer.name.toLowerCase().includes(lowerQuery) ||
    customer.documentNumber?.toLowerCase().includes(lowerQuery) ||
    customer.email?.toLowerCase().includes(lowerQuery) ||
    customer.phone?.includes(lowerQuery)
  );
};

// Obtener cliente por ID
export const getCustomerById = (id: string): Customer | null => {
  const customers = getCustomers();
  return customers.find(c => c.id === id) || null;
};

// Crear nuevo cliente
export const createCustomer = (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer => {
  const customers = getCustomers();
  const now = new Date().toISOString();

  const newCustomer: Customer = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  customers.push(newCustomer);
  saveCustomers(customers);

  return newCustomer;
};

// Actualizar cliente
export const updateCustomer = (id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): Customer | null => {
  const customers = getCustomers();
  const index = customers.findIndex(c => c.id === id);

  if (index === -1) {
    return null;
  }

  customers[index] = {
    ...customers[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  saveCustomers(customers);
  return customers[index];
};

// Eliminar cliente
export const deleteCustomer = (id: string): boolean => {
  const customers = getCustomers();
  const filtered = customers.filter(c => c.id !== id);

  if (filtered.length === customers.length) {
    return false;
  }

  saveCustomers(filtered);
  return true;
};

// Cliente genérico "Consumidor Final"
export const CONSUMIDOR_FINAL: Customer = {
  id: 'consumidor-final',
  name: 'Consumidor Final',
  documentType: 'DNI',
  documentNumber: '00000000',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Obtener todos los clientes incluyendo Consumidor Final
export const getAllCustomers = (): Customer[] => {
  return [CONSUMIDOR_FINAL, ...getCustomers()];
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
