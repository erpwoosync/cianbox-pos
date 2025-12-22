/**
 * IndexedDB service para almacenamiento local
 * Usado para cache de datos y modo offline
 */

const DB_NAME = 'cianbox-pos';
const DB_VERSION = 3;

// Stores disponibles
export const STORES = {
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  BRANDS: 'brands',
  PROMOTIONS: 'promotions',
  QUICK_ACCESS: 'quick_access',
  PENDING_SYNC: 'pending_sync',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;

// Inicializar la base de datos
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store de clientes
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customersStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        customersStore.createIndex('name', 'name', { unique: false });
        customersStore.createIndex('taxId', 'taxId', { unique: false });
        customersStore.createIndex('email', 'email', { unique: false });
        customersStore.createIndex('phone', 'phone', { unique: false });
        customersStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Store de productos
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const productsStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        productsStore.createIndex('sku', 'sku', { unique: false });
        productsStore.createIndex('barcode', 'barcode', { unique: false });
        productsStore.createIndex('name', 'name', { unique: false });
        productsStore.createIndex('categoryId', 'categoryId', { unique: false });
        productsStore.createIndex('brandId', 'brandId', { unique: false });
        productsStore.createIndex('isActive', 'isActive', { unique: false });
        productsStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Store de categorías
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        const categoriesStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
        categoriesStore.createIndex('name', 'name', { unique: false });
        categoriesStore.createIndex('parentId', 'parentId', { unique: false });
        categoriesStore.createIndex('isActive', 'isActive', { unique: false });
        categoriesStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Store de marcas
      if (!db.objectStoreNames.contains(STORES.BRANDS)) {
        const brandsStore = db.createObjectStore(STORES.BRANDS, { keyPath: 'id' });
        brandsStore.createIndex('name', 'name', { unique: false });
        brandsStore.createIndex('isActive', 'isActive', { unique: false });
        brandsStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Store de promociones
      if (!db.objectStoreNames.contains(STORES.PROMOTIONS)) {
        const promotionsStore = db.createObjectStore(STORES.PROMOTIONS, { keyPath: 'id' });
        promotionsStore.createIndex('name', 'name', { unique: false });
        promotionsStore.createIndex('type', 'type', { unique: false });
        promotionsStore.createIndex('isActive', 'isActive', { unique: false });
        promotionsStore.createIndex('startDate', 'startDate', { unique: false });
        promotionsStore.createIndex('endDate', 'endDate', { unique: false });
        promotionsStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Store de acceso rápido (categorías del menú rápido)
      if (!db.objectStoreNames.contains(STORES.QUICK_ACCESS)) {
        const quickAccessStore = db.createObjectStore(STORES.QUICK_ACCESS, { keyPath: 'id' });
        quickAccessStore.createIndex('name', 'name', { unique: false });
        quickAccessStore.createIndex('order', 'quickAccessOrder', { unique: false });
        quickAccessStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Store para operaciones pendientes de sincronización
      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const pendingStore = db.createObjectStore(STORES.PENDING_SYNC, {
          keyPath: 'id',
          autoIncrement: true
        });
        pendingStore.createIndex('store', 'store', { unique: false });
        pendingStore.createIndex('operation', 'operation', { unique: false });
        pendingStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// Obtener todos los registros de un store
export const getAll = async <T>(storeName: StoreName): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
};

// Obtener un registro por ID
export const getById = async <T>(storeName: StoreName, id: string): Promise<T | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as T | null);
    request.onerror = () => reject(request.error);
  });
};

// Agregar o actualizar un registro
export const put = async <T>(storeName: StoreName, data: T): Promise<T> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
};

// Agregar múltiples registros
export const putMany = async <T>(storeName: StoreName, items: T[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    items.forEach(item => store.put(item));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Eliminar un registro
export const remove = async (storeName: StoreName, id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Limpiar todo el store
export const clear = async (storeName: StoreName): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Buscar por índice
export const searchByIndex = async <T>(
  storeName: StoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange
): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(query);

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
};

// Agregar operación pendiente de sync
export interface PendingSyncOperation {
  id?: number;
  store: StoreName;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: string;
}

export const addPendingSync = async (
  store: StoreName,
  operation: 'create' | 'update' | 'delete',
  data: unknown
): Promise<void> => {
  await put<PendingSyncOperation>(STORES.PENDING_SYNC, {
    store,
    operation,
    data,
    createdAt: new Date().toISOString(),
  });
};

// Obtener operaciones pendientes
export const getPendingSyncs = async (): Promise<PendingSyncOperation[]> => {
  return getAll<PendingSyncOperation>(STORES.PENDING_SYNC);
};

// Limpiar operación pendiente
export const clearPendingSync = async (id: number): Promise<void> => {
  await remove(STORES.PENDING_SYNC, String(id));
};

export default {
  initDB,
  getAll,
  getById,
  put,
  putMany,
  remove,
  clear,
  searchByIndex,
  addPendingSync,
  getPendingSyncs,
  clearPendingSync,
  STORES,
};
