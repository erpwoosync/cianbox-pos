/**
 * ComboRepository - Operaciones de base de datos para combos
 */

import { Combo } from '@prisma/client';
import { BaseRepository } from './base.repository.js';
import { ApiError } from '../utils/errors.js';

export class ComboRepository extends BaseRepository<Combo> {
  constructor() {
    super('Combo', 'combo');
  }

  /**
   * Verificar si existe combo con el mismo código
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
   * Crear combo con validación de código
   */
  async createWithValidation(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Combo> {
    // Verificar código único (obligatorio para combos)
    if (!data.code) {
      throw ApiError.badRequest('El código es requerido');
    }

    const exists = await this.existsByCode(tenantId, data.code as string);
    if (exists) {
      throw ApiError.conflict('Ya existe un combo con ese código');
    }

    return this.create(tenantId, data);
  }

  /**
   * Actualizar combo con validación
   */
  async updateWithValidation(
    id: string,
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Combo> {
    const existing = await this.findByIdOrFail(id, tenantId);

    // Verificar código único si cambió
    if (data.code && data.code !== (existing as Record<string, unknown>).code) {
      const exists = await this.existsByCode(tenantId, data.code as string, id);
      if (exists) {
        throw ApiError.conflict('Ya existe un combo con ese código');
      }
    }

    return this.update(id, tenantId, data);
  }

  /**
   * Eliminar o desactivar combo
   * Si tiene ventas asociadas, solo desactiva
   */
  async deleteOrDeactivate(
    id: string,
    tenantId: string
  ): Promise<{ deleted: boolean; deactivated: boolean; message: string }> {
    // Verificar si existe y tiene ventas
    const existing = await this.model.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { saleItems: true } } },
    });

    if (!existing) {
      throw ApiError.notFound('Combo');
    }

    // Si tiene ventas, desactivar
    if (existing._count.saleItems > 0) {
      await this.update(id, tenantId, { isActive: false });
      return {
        deleted: false,
        deactivated: true,
        message: 'Combo desactivado (tiene ventas asociadas)',
      };
    }

    await this.delete(id, tenantId);
    return {
      deleted: true,
      deactivated: false,
      message: 'Combo eliminado',
    };
  }
}

// Instancia singleton
export const comboRepository = new ComboRepository();
export default comboRepository;
