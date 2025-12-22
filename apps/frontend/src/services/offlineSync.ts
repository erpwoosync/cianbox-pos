/**
 * Servicio de sincronización offline
 * Sincroniza productos, categorías, marcas, promociones y acceso rápido
 */

import { api } from './api';
import db, { STORES } from './indexedDB';

// Verificar si hay conexión
const isOnline = () => navigator.onLine;

// Sincronizar productos
export const syncProducts = async (): Promise<number> => {
  if (!isOnline()) return 0;

  try {
    const response = await api.get('/products', {
      params: { pageSize: 1000, isActive: 'true' },
    });

    if (response.data.success && response.data.data) {
      const products = response.data.data.map((p: Record<string, unknown>) => ({
        ...p,
        syncedAt: new Date().toISOString(),
      }));

      await db.clear(STORES.PRODUCTS);
      await db.putMany(STORES.PRODUCTS, products);
      console.log(`Synced ${products.length} products to IndexedDB`);
      return products.length;
    }
  } catch (error) {
    console.error('Error syncing products:', error);
  }
  return 0;
};

// Sincronizar categorías
export const syncCategories = async (): Promise<number> => {
  if (!isOnline()) return 0;

  try {
    const response = await api.get('/products/categories');

    if (response.data.success && response.data.data) {
      const categories = response.data.data.map((c: Record<string, unknown>) => ({
        ...c,
        syncedAt: new Date().toISOString(),
      }));

      await db.clear(STORES.CATEGORIES);
      await db.putMany(STORES.CATEGORIES, categories);
      console.log(`Synced ${categories.length} categories to IndexedDB`);
      return categories.length;
    }
  } catch (error) {
    console.error('Error syncing categories:', error);
  }
  return 0;
};

// Sincronizar marcas
export const syncBrands = async (): Promise<number> => {
  if (!isOnline()) return 0;

  try {
    const response = await api.get('/products/brands');

    if (response.data.success && response.data.data) {
      const brands = response.data.data.map((b: Record<string, unknown>) => ({
        ...b,
        syncedAt: new Date().toISOString(),
      }));

      await db.clear(STORES.BRANDS);
      await db.putMany(STORES.BRANDS, brands);
      console.log(`Synced ${brands.length} brands to IndexedDB`);
      return brands.length;
    }
  } catch (error) {
    console.error('Error syncing brands:', error);
  }
  return 0;
};

// Sincronizar promociones activas
export const syncPromotions = async (): Promise<number> => {
  if (!isOnline()) return 0;

  try {
    const response = await api.get('/promotions/active');

    if (response.data.success && response.data.data) {
      const promotions = response.data.data.map((p: Record<string, unknown>) => ({
        ...p,
        syncedAt: new Date().toISOString(),
      }));

      await db.clear(STORES.PROMOTIONS);
      await db.putMany(STORES.PROMOTIONS, promotions);
      console.log(`Synced ${promotions.length} promotions to IndexedDB`);
      return promotions.length;
    }
  } catch (error) {
    console.error('Error syncing promotions:', error);
  }
  return 0;
};

// Sincronizar acceso rápido
export const syncQuickAccess = async (): Promise<number> => {
  if (!isOnline()) return 0;

  try {
    const response = await api.get('/products/categories/quick-access');

    if (response.data.success && response.data.data) {
      const quickAccess = response.data.data.map((q: Record<string, unknown>) => ({
        ...q,
        syncedAt: new Date().toISOString(),
      }));

      await db.clear(STORES.QUICK_ACCESS);
      await db.putMany(STORES.QUICK_ACCESS, quickAccess);
      console.log(`Synced ${quickAccess.length} quick access items to IndexedDB`);
      return quickAccess.length;
    }
  } catch (error) {
    console.error('Error syncing quick access:', error);
  }
  return 0;
};

// Sincronizar todo
export const syncAll = async (): Promise<{
  products: number;
  categories: number;
  brands: number;
  promotions: number;
  quickAccess: number;
}> => {
  console.log('Starting full sync to IndexedDB...');

  const [products, categories, brands, promotions, quickAccess] = await Promise.all([
    syncProducts(),
    syncCategories(),
    syncBrands(),
    syncPromotions(),
    syncQuickAccess(),
  ]);

  console.log('Full sync completed:', { products, categories, brands, promotions, quickAccess });

  return { products, categories, brands, promotions, quickAccess };
};

// Obtener productos desde IndexedDB
export const getLocalProducts = async (): Promise<unknown[]> => {
  return db.getAll(STORES.PRODUCTS);
};

// Obtener categorías desde IndexedDB
export const getLocalCategories = async (): Promise<unknown[]> => {
  return db.getAll(STORES.CATEGORIES);
};

// Obtener marcas desde IndexedDB
export const getLocalBrands = async (): Promise<unknown[]> => {
  return db.getAll(STORES.BRANDS);
};

// Obtener promociones desde IndexedDB
export const getLocalPromotions = async (): Promise<unknown[]> => {
  return db.getAll(STORES.PROMOTIONS);
};

// Obtener acceso rápido desde IndexedDB
export const getLocalQuickAccess = async (): Promise<unknown[]> => {
  return db.getAll(STORES.QUICK_ACCESS);
};

// Buscar producto por código de barras en local
export const findProductByBarcode = async (barcode: string): Promise<unknown | null> => {
  const products = await db.getAll<{ barcode?: string }>(STORES.PRODUCTS);
  return products.find(p => p.barcode === barcode) || null;
};

// Buscar producto por SKU en local
export const findProductBySku = async (sku: string): Promise<unknown | null> => {
  const products = await db.getAll<{ sku?: string }>(STORES.PRODUCTS);
  return products.find(p => p.sku === sku) || null;
};

// Buscar productos por texto en local
export const searchLocalProducts = async (query: string): Promise<unknown[]> => {
  const products = await db.getAll<{ name?: string; sku?: string; barcode?: string }>(STORES.PRODUCTS);
  const lowerQuery = query.toLowerCase();

  return products.filter(p =>
    p.name?.toLowerCase().includes(lowerQuery) ||
    p.sku?.toLowerCase().includes(lowerQuery) ||
    p.barcode?.includes(query)
  );
};

// Escuchar cambios de conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Connection restored, syncing all data...');
    syncAll();
  });
}

export const offlineSyncService = {
  syncProducts,
  syncCategories,
  syncBrands,
  syncPromotions,
  syncQuickAccess,
  syncAll,
  getLocalProducts,
  getLocalCategories,
  getLocalBrands,
  getLocalPromotions,
  getLocalQuickAccess,
  findProductByBarcode,
  findProductBySku,
  searchLocalProducts,
};

export default offlineSyncService;
