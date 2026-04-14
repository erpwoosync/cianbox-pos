import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authorize, AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// USERS
// =============================================

// Listar usuarios
router.get('/users', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        roleId: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener usuario por ID
router.get('/users/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        roleId: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true, permissions: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// Crear usuario
const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'El nombre es requerido'),
  roleId: z.string().min(1, 'El rol es requerido'),
  branchId: z.string().optional(),
  pin: z.string().length(4, 'El PIN debe tener 4 dígitos').optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'DISABLED']).optional().default('ACTIVE'),
});

router.post(
  '/users',
  authorize('admin:users', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const validation = createUserSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { email, password, name, roleId, branchId, pin, status } = validation.data;

      // Verificar que no exista otro usuario con el mismo email en el tenant
      const existing = await prisma.user.findFirst({
        where: { tenantId, email },
      });

      if (existing) {
        throw new ApiError(409, 'CONFLICT', 'Ya existe un usuario con ese email');
      }

      // Verificar que el rol pertenece al tenant
      const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
      });

      if (!role) {
        throw new ApiError(404, 'NOT_FOUND', 'Rol no encontrado');
      }

      // Verificar que la sucursal pertenece al tenant (si se especifica)
      if (branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId },
        });

        if (!branch) {
          throw new ApiError(404, 'NOT_FOUND', 'Sucursal no encontrada');
        }
      }

      // Hash de la contraseña
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          tenantId,
          email,
          passwordHash,
          name,
          roleId,
          branchId,
          pin,
          status,
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          roleId: true,
          branchId: true,
          createdAt: true,
          role: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'Usuario creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Actualizar usuario
const updateUserSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  name: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  branchId: z.string().nullable().optional(),
  pin: z.string().length(4, 'El PIN debe tener 4 dígitos').nullable().optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'DISABLED']).optional(),
});

router.put(
  '/users/:id',
  authorize('admin:users', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const validation = updateUserSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const existing = await prisma.user.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
      }

      const { email, password, name, roleId, branchId, pin, status } = validation.data;

      // Verificar email único si se cambia
      if (email && email !== existing.email) {
        const duplicate = await prisma.user.findFirst({
          where: { tenantId, email, id: { not: id } },
        });

        if (duplicate) {
          throw new ApiError(409, 'CONFLICT', 'Ya existe un usuario con ese email');
        }
      }

      // Verificar rol si se cambia
      if (roleId && roleId !== existing.roleId) {
        const role = await prisma.role.findFirst({
          where: { id: roleId, tenantId },
        });

        if (!role) {
          throw new ApiError(404, 'NOT_FOUND', 'Rol no encontrado');
        }
      }

      // Verificar sucursal si se cambia
      if (branchId && branchId !== existing.branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId },
        });

        if (!branch) {
          throw new ApiError(404, 'NOT_FOUND', 'Sucursal no encontrada');
        }
      }

      // Preparar datos de actualización
      const updateData: {
        email?: string;
        passwordHash?: string;
        name?: string;
        roleId?: string;
        branchId?: string | null;
        pin?: string | null;
        status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
      } = {};

      if (email) updateData.email = email;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
      if (name) updateData.name = name;
      if (roleId) updateData.roleId = roleId;
      if (branchId !== undefined) updateData.branchId = branchId;
      if (pin !== undefined) updateData.pin = pin;
      if (status) updateData.status = status;

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          roleId: true,
          branchId: true,
          createdAt: true,
          updatedAt: true,
          role: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      res.json({
        success: true,
        data: user,
        message: 'Usuario actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Eliminar usuario
router.delete(
  '/users/:id',
  authorize('admin:users', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const currentUserId = req.user!.userId;

      // No permitir que el usuario se elimine a sí mismo
      if (id === currentUserId) {
        throw new ApiError(400, 'BAD_REQUEST', 'No puedes eliminarte a ti mismo');
      }

      const existing = await prisma.user.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
      }

      // Verificar que no tenga ventas asociadas
      const salesCount = await prisma.sale.count({
        where: { userId: id },
      });

      if (salesCount > 0) {
        // En lugar de eliminar, desactivar el usuario
        await prisma.user.update({
          where: { id },
          data: { status: 'DISABLED' },
        });

        res.json({
          success: true,
          message: 'Usuario desactivado (tiene ventas asociadas)',
        });
        return;
      }

      await prisma.user.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
