/**
 * ProductRepository - Operaciones de base de datos para productos
 */

import { Product } from '@prisma/client';
import { BaseRepository, PaginatedResult } from './base.repository.js';
import { ApiError } from '../utils/errors.js';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  parentProductId?: string | null;
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

  /**
   * Verificar si existe un producto con el mismo SKU
   */
  async existsBySku(
    tenantId: string,
    sku: string,
    excludeId?: string
  ): Promise<boolean> {
    const where: Record<string, unknown> = { tenantId, sku };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Crear producto con validación de SKU
   */
  async createWithValidation(
    tenantId: string,
    data: Record<string, unknown>,
    include?: Record<string, unknown>
  ): Promise<Product> {
    // Verificar SKU único si se proporciona
    if (data.sku) {
      const exists = await this.existsBySku(tenantId, data.sku as string);
      if (exists) {
        throw ApiError.conflict('Ya existe un producto con ese SKU');
      }
    }

    return this.create(tenantId, data, include);
  }

  /**
   * Actualizar producto con validaciones
   * - Verifica SKU único si cambió
   * - No permite modificar productos de Cianbox
   */
  async updateWithValidation(
    id: string,
    tenantId: string,
    data: Record<string, unknown>,
    include?: Record<string, unknown>
  ): Promise<Product> {
    // Obtener producto actual
    const existing = await this.findByIdOrFail(id, tenantId);

    // No permitir modificar productos de Cianbox
    if ((existing as Record<string, unknown>).cianboxProductId) {
      throw ApiError.forbidden('No se pueden modificar productos sincronizados con Cianbox');
    }

    // Verificar SKU único si cambió
    if (data.sku && data.sku !== (existing as Record<string, unknown>).sku) {
      const exists = await this.existsBySku(tenantId, data.sku as string, id);
      if (exists) {
        throw ApiError.conflict('Ya existe un producto con ese SKU');
      }
    }

    return this.update(id, tenantId, data, include);
  }

  /**
   * Soft delete (desactivar producto)
   */
  async softDelete(id: string, tenantId: string): Promise<{ message: string }> {
    await this.findByIdOrFail(id, tenantId);

    await this.update(id, tenantId, { isActive: false });

    return { message: 'Producto desactivado' };
  }
}

// Instancia singleton para usar en las rutas
export const productRepository = new ProductRepository();
export default productRepository;
