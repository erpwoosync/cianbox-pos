/**
 * PromotionRepository - Operaciones de base de datos para promociones
 */

import { Promotion } from '@prisma/client';
import { BaseRepository, PaginatedResult } from './base.repository.js';
import { ApiError } from '../utils/errors.js';

export interface PromotionFilters {
  type?: string;
  isActive?: boolean;
}

export class PromotionRepository extends BaseRepository<Promotion> {
  constructor() {
    super('Promoción', 'promotion');
  }

  /**
   * Buscar promociones con filtros
   */
  async findWithFilters(
    tenantId: string,
    filters: PromotionFilters,
    pagination: { page?: number; pageSize?: number } = {}
  ): Promise<PaginatedResult<Promotion>> {
    const where: Record<string, unknown> = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.findMany(tenantId, {
      where,
      pagination,
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * Verificar si existe promoción con el mismo código
   */
  async existsByCode(
    tenantId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> {
    const where: Record<string, unknown> = { tenantId, code };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Crear promoción con validación de código
   */
  async createWithValidation(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Promotion> {
    // Verificar código único si se proporciona
    if (data.code) {
      const exists = await this.existsByCode(tenantId, data.code as string);
      if (exists) {
        throw ApiError.conflict('Ya existe una promoción con ese código');
      }
    }

    return this.create(tenantId, data);
  }

  /**
   * Actualizar promoción con validación
   */
  async updateWithValidation(
    id: string,
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Promotion> {
    const existing = await this.findByIdOrFail(id, tenantId);

    // Verificar código único si cambió
    if (data.code && data.code !== (existing as Record<string, unknown>).code) {
      const exists = await this.existsByCode(tenantId, data.code as string, id);
      if (exists) {
        throw ApiError.conflict('Ya existe una promoción con ese código');
      }
    }

    return this.update(id, tenantId, data);
  }

  /**
   * Eliminar o desactivar promoción
   * Si tiene usos, solo desactiva
   */
  async deleteOrDeactivate(
    id: string,
    tenantId: string
  ): Promise<{ deleted: boolean; deactivated: boolean; message: string }> {
    const existing = await this.findByIdOrFail(id, tenantId);

    // Verificar si tiene usos
    if ((existing as Record<string, unknown>).currentUses as number > 0) {
      await this.update(id, tenantId, { isActive: false });
      return {
        deleted: false,
        deactivated: true,
        message: 'Promoción desactivada (tiene ventas asociadas)',
      };
    }

    await this.delete(id, tenantId);
    return {
      deleted: true,
      deactivated: false,
      message: 'Promoción eliminada',
    };
  }
}

// Instancia singleton
export const promotionRepository = new PromotionRepository();
export default promotionRepository;
