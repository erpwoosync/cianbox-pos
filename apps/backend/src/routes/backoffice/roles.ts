import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize, AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// ROLES
// =============================================

// Lista de permisos disponibles en el sistema
const AVAILABLE_PERMISSIONS = [
  // POS
  { code: 'pos:sell', name: 'Vender', category: 'POS' },
  { code: 'pos:discount', name: 'Aplicar descuentos', category: 'POS' },
  { code: 'pos:void', name: 'Anular ventas', category: 'POS' },
  { code: 'pos:refund', name: 'Hacer devoluciones', category: 'POS' },
  { code: 'pos:cash_drawer', name: 'Abrir caja registradora', category: 'POS' },
  { code: 'pos:close_shift', name: 'Cerrar turno', category: 'POS' },
  // Inventario
  { code: 'inventory:view', name: 'Ver inventario', category: 'Inventario' },
  { code: 'inventory:edit', name: 'Editar productos', category: 'Inventario' },
  { code: 'stock:view', name: 'Ver stock', category: 'Stock' },
  { code: 'stock:adjust', name: 'Ajustar stock', category: 'Stock' },
  { code: 'stock:write', name: 'Modificar stock', category: 'Stock' },
  // Reportes
  { code: 'reports:sales', name: 'Ver reportes de ventas', category: 'Reportes' },
  { code: 'reports:inventory', name: 'Ver reportes de inventario', category: 'Reportes' },
  { code: 'reports:financial', name: 'Ver reportes financieros', category: 'Reportes' },
  // Administración
  { code: 'admin:users', name: 'Gestionar usuarios', category: 'Administración' },
  { code: 'admin:roles', name: 'Gestionar roles', category: 'Administración' },
  { code: 'admin:settings', name: 'Configuración general', category: 'Administración' },
  { code: 'pos:write', name: 'Gestionar puntos de venta', category: 'Administración' },
  { code: 'pos:delete', name: 'Eliminar puntos de venta', category: 'Administración' },
  // Vales de Crédito
  { code: 'storecredits:view', name: 'Ver vales de crédito', category: 'Vales' },
  { code: 'storecredits:create', name: 'Crear vales de crédito', category: 'Vales' },
  { code: 'storecredits:cancel', name: 'Cancelar vales de crédito', category: 'Vales' },
  // Acceso total
  { code: '*', name: 'Acceso total (superadmin)', category: 'Sistema' },
];

// Obtener lista de permisos disponibles
router.get('/permissions', async (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: AVAILABLE_PERMISSIONS,
  });
});

// Listar roles
router.get('/roles', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener rol por ID
router.get('/roles/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const role = await prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { users: true } },
        users: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });

    if (!role) {
      throw new ApiError(404, 'NOT_FOUND', 'Rol no encontrado');
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
});

// Crear rol
const createRoleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'Debe asignar al menos un permiso'),
});

router.post(
  '/roles',
  authorize('admin:roles', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const validation = createRoleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { name, description, permissions } = validation.data;

      // Verificar que no exista otro rol con el mismo nombre
      const existing = await prisma.role.findFirst({
        where: { tenantId, name },
      });

      if (existing) {
        throw new ApiError(409, 'CONFLICT', 'Ya existe un rol con ese nombre');
      }

      const role = await prisma.role.create({
        data: {
          tenantId,
          name,
          description,
          permissions,
          isSystem: false,
        },
        include: {
          _count: { select: { users: true } },
        },
      });

      res.status(201).json({
        success: true,
        data: role,
        message: 'Rol creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Actualizar rol
const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1).optional(),
});

router.put(
  '/roles/:id',
  authorize('admin:roles', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const validation = updateRoleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const existing = await prisma.role.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Rol no encontrado');
      }

      // No permitir modificar roles del sistema
      if (existing.isSystem) {
        throw new ApiError(403, 'FORBIDDEN', 'No se pueden modificar roles del sistema');
      }

      const { name, description, permissions } = validation.data;

      // Verificar nombre único si se cambia
      if (name && name !== existing.name) {
        const duplicate = await prisma.role.findFirst({
          where: { tenantId, name, id: { not: id } },
        });

        if (duplicate) {
          throw new ApiError(409, 'CONFLICT', 'Ya existe un rol con ese nombre');
        }
      }

      const role = await prisma.role.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(permissions && { permissions }),
        },
        include: {
          _count: { select: { users: true } },
        },
      });

      res.json({
        success: true,
        data: role,
        message: 'Rol actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Eliminar rol
router.delete(
  '/roles/:id',
  authorize('admin:roles', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const existing = await prisma.role.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { users: true } } },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Rol no encontrado');
      }

      // No permitir eliminar roles del sistema
      if (existing.isSystem) {
        throw new ApiError(403, 'FORBIDDEN', 'No se pueden eliminar roles del sistema');
      }

      // Verificar que no tenga usuarios asignados
      if (existing._count.users > 0) {
        throw new ApiError(400, 'BAD_REQUEST', `No se puede eliminar: el rol tiene ${existing._count.users} usuarios asignados`);
      }

      await prisma.role.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Rol eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
