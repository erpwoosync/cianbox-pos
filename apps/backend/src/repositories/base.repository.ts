/**
 * BaseRepository - Clase base para repositorios
 *
 * Proporciona métodos CRUD genéricos que manejan:
 * - Filtrado automático por tenantId
 * - Paginación estándar
 * - Manejo de errores consistente
 *
 * Uso:
 *   class ProductRepository extends BaseRepository<Product> {
 *     constructor() {
 *       super('Producto', 'product');
 *     }
 *   }
 */

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../utils/errors.js';

// Tipos para paginación
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Tipo para ordenamiento
export type OrderBy = Record<string, 'asc' | 'desc'>;

/**
 * Repositorio base con operaciones CRUD genéricas
 * @template T - Tipo de la entidad (ej: Product, Customer)
 */
export abstract class BaseRepository<T> {
  protected prisma = prisma;

  constructor(
    protected readonly entityName: string,  // Nombre para mensajes de error (ej: "Producto")
    protected readonly modelName: string    // Nombre del modelo Prisma (ej: "product")
  ) {}

  /**
   * Obtiene el delegado de Prisma para el modelo
   * Ejemplo: prisma.product, prisma.customer, etc.
   */
  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Buscar por ID y tenant
   * Retorna null si no existe
   */
  async findById(
    id: string,
    tenantId: string,
    include?: Record<string, unknown>
  ): Promise<T | null> {
    return this.model.findFirst({
      where: { id, tenantId },
      include,
    });
  }

  /**
   * Buscar por ID y tenant, lanza error si no existe
   */
  async findByIdOrFail(
    id: string,
    tenantId: string,
    include?: Record<string, unknown>
  ): Promise<T> {
    const result = await this.findById(id, tenantId, include);
    if (!result) {
      throw new NotFoundError(this.entityName);
    }
    return result;
  }

  /**
   * Buscar múltiples registros con paginación
   */
  async findMany(
    tenantId: string,
    options: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
      orderBy?: OrderBy;
      pagination?: PaginationParams;
    } = {}
  ): Promise<PaginatedResult<T>> {
    const {
      where = {},
      include,
      orderBy = { createdAt: 'desc' },
      pagination = {},
    } = options;

    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 50;
    const skip = (page - 1) * pageSize;

    // Agregar tenantId al where
    const fullWhere = { ...where, tenantId };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where: fullWhere,
        include,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.model.count({ where: fullWhere }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Buscar todos los registros sin paginación
   */
  async findAll(
    tenantId: string,
    options: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
      orderBy?: OrderBy;
    } = {}
  ): Promise<T[]> {
    const { where = {}, include, orderBy = { createdAt: 'desc' } } = options;

    return this.model.findMany({
      where: { ...where, tenantId },
      include,
      orderBy,
    });
  }

  /**
   * Crear un nuevo registro
   */
  async create(
    tenantId: string,
    data: Record<string, unknown>,
    include?: Record<string, unknown>
  ): Promise<T> {
    return this.model.create({
      data: { ...data, tenantId },
      include,
    });
  }

  /**
   * Actualizar un registro existente
   * Verifica que exista y pertenezca al tenant antes de actualizar
   */
  async update(
    id: string,
    tenantId: string,
    data: Record<string, unknown>,
    include?: Record<string, unknown>
  ): Promise<T> {
    // Verificar que existe
    await this.findByIdOrFail(id, tenantId);

    return this.model.update({
      where: { id },
      data,
      include,
    });
  }

  /**
   * Eliminar un registro
   * Verifica que exista y pertenezca al tenant antes de eliminar
   */
  async delete(id: string, tenantId: string): Promise<T> {
    // Verificar que existe
    await this.findByIdOrFail(id, tenantId);

    return this.model.delete({
      where: { id },
    });
  }

  /**
   * Contar registros
   */
  async count(tenantId: string, where: Record<string, unknown> = {}): Promise<number> {
    return this.model.count({
      where: { ...where, tenantId },
    });
  }

  /**
   * Verificar si existe un registro
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    const count = await this.model.count({
      where: { id, tenantId },
    });
    return count > 0;
  }
}

export default BaseRepository;
