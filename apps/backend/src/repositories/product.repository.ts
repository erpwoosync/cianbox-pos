/**
 * ProductRepository - Operaciones de base de datos para productos
 */

import { Product } from '@prisma/client';
import { BaseRepository, PaginatedResult } from './base.repository.js';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
}

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('Producto', 'product');
  }

  /**
   * Buscar productos con filtros específicos
   */
  async findWithFilters(
    tenantId: string,
    filters: ProductFilters,
    pagination: { page?: number; pageSize?: number } = {},
    include?: Record<string, unknown>
  ): Promise<PaginatedResult<Product>> {
    const where: Record<string, unknown> = {};

    // Filtro por búsqueda (nombre, SKU, código de barras)
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
        { internalCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.findMany(tenantId, {
      where,
      include,
      pagination,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Buscar producto por código de barras
   */
  async findByBarcode(
    tenantId: string,
    barcode: string,
    include?: Record<string, unknown>
  ): Promise<Product | null> {
    return this.model.findFirst({
      where: { tenantId, barcode },
      include,
    });
  }

  /**
   * Buscar producto por SKU
   */
  async findBySku(
    tenantId: string,
    sku: string,
    include?: Record<string, unknown>
  ): Promise<Product | null> {
    return this.model.findFirst({
      where: { tenantId, sku },
      include,
    });
  }

  /**
   * Buscar producto por código interno
   */
  async findByInternalCode(
    tenantId: string,
    internalCode: string,
    include?: Record<string, unknown>
  ): Promise<Product | null> {
    return this.model.findFirst({
      where: { tenantId, internalCode },
      include,
    });
  }

  /**
   * Buscar por cualquier código (barcode, sku o internalCode)
   */
  async findByAnyCode(
    tenantId: string,
    code: string,
    include?: Record<string, unknown>
  ): Promise<Product | null> {
    return this.model.findFirst({
      where: {
        tenantId,
        OR: [
          { barcode: code },
          { sku: code },
          { internalCode: code },
        ],
      },
      include,
    });
  }
}

// Instancia singleton para usar en las rutas
export const productRepository = new ProductRepository();
export default productRepository;
