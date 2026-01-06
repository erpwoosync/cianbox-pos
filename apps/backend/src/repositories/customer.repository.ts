/**
 * CustomerRepository - Operaciones de base de datos para clientes
 */

import { Customer } from '@prisma/client';
import { BaseRepository, PaginatedResult } from './base.repository.js';
import { ApiError } from '../utils/errors.js';

export interface CustomerFilters {
  search?: string;
  customerType?: 'CONSUMER' | 'INDIVIDUAL' | 'BUSINESS' | 'GOVERNMENT';
  isActive?: boolean;
}

export class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('Cliente', 'customer');
  }

  /**
   * Buscar clientes con filtros específicos
   */
  async findWithFilters(
    tenantId: string,
    filters: CustomerFilters,
    pagination: { page?: number; pageSize?: number } = {}
  ): Promise<PaginatedResult<Customer>> {
    const where: Record<string, unknown> = {};

    // Filtro por búsqueda (nombre, documento, email, teléfono)
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { taxId: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.customerType) {
      where.customerType = filters.customerType;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.findMany(tenantId, {
      where,
      pagination,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Buscar cliente por documento (CUIT/DNI)
   */
  async findByTaxId(tenantId: string, taxId: string): Promise<Customer | null> {
    return this.model.findFirst({
      where: { tenantId, taxId },
    });
  }

  /**
   * Verificar si existe un cliente con el mismo documento
   * Útil antes de crear o actualizar
   */
  async existsByTaxId(
    tenantId: string,
    taxId: string,
    excludeId?: string
  ): Promise<boolean> {
    const where: Record<string, unknown> = { tenantId, taxId };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Crear cliente verificando duplicados
   */
  async createWithValidation(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Customer> {
    // Verificar duplicado por taxId si se proporciona
    if (data.taxId) {
      const exists = await this.existsByTaxId(tenantId, data.taxId as string);
      if (exists) {
        throw ApiError.badRequest(`Ya existe un cliente con el documento ${data.taxId}`);
      }
    }

    return this.create(tenantId, data);
  }

  /**
   * Actualizar cliente verificando duplicados
   */
  async updateWithValidation(
    id: string,
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Customer> {
    // Obtener cliente actual
    const existing = await this.findByIdOrFail(id, tenantId);

    // Verificar duplicado por taxId si se está cambiando
    if (data.taxId && data.taxId !== existing.taxId) {
      const exists = await this.existsByTaxId(tenantId, data.taxId as string, id);
      if (exists) {
        throw ApiError.badRequest(`Ya existe un cliente con el documento ${data.taxId}`);
      }
    }

    return this.update(id, tenantId, data);
  }

  /**
   * Eliminar o desactivar cliente
   * Si tiene ventas, solo desactiva (soft delete)
   */
  async deleteOrDeactivate(
    id: string,
    tenantId: string
  ): Promise<{ deleted: boolean; deactivated: boolean; message: string }> {
    // Verificar que existe
    await this.findByIdOrFail(id, tenantId);

    // Verificar si tiene ventas
    const salesCount = await this.prisma.sale.count({
      where: { customerId: id },
    });

    if (salesCount > 0) {
      // Soft delete
      await this.update(id, tenantId, { isActive: false });
      return {
        deleted: false,
        deactivated: true,
        message: 'Cliente desactivado (tiene ventas asociadas)',
      };
    }

    // Hard delete
    await this.delete(id, tenantId);
    return {
      deleted: true,
      deactivated: false,
      message: 'Cliente eliminado',
    };
  }
}

// Instancia singleton para usar en las rutas
export const customerRepository = new CustomerRepository();
export default customerRepository;
