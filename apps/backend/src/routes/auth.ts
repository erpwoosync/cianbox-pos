/**
 * Rutas de autenticación
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  authenticate,
  generateToken,
  generateRefreshToken,
  verifyToken,
  AuthenticatedRequest,
} from '../middleware/auth.js';
import { ApiError, AuthenticationError, AuthorizationError, ValidationError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// Schemas de validación
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
  tenantSlug: z.string().min(1, 'Tenant requerido'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

const pinLoginSchema = z.object({
  pin: z.string().length(4, 'PIN debe tener 4 dígitos'),
  tenantSlug: z.string().min(1, 'Tenant requerido'),
});

/**
 * POST /api/auth/login
 * Login con email y contraseña
 */
router.post('/login', async (req, res: Response, next: NextFunction) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.errors);
    }

    const { email, password, tenantSlug } = validation.data;

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new AuthenticationError('Tenant no encontrado');
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      throw new AuthenticationError('Tenant no activo');
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: email.toLowerCase(),
        },
      },
      include: {
        role: true,
        branch: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('Credenciales inválidas');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('Usuario no activo');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Credenciales inválidas');
    }

    // Crear sesión
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        status: 'ACTIVE',
      },
    });

    // Generar tokens
    const tokenPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      roleId: user.roleId,
      permissions: user.role.permissions,
      branchId: user.branchId || undefined,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions,
          },
          branch: user.branch
            ? {
                id: user.branch.id,
                code: user.branch.code,
                name: user.branch.name,
              }
            : null,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
        },
        sessionId: session.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login/pin
 * Login rápido con PIN (para cambios de turno en POS)
 */
router.post('/login/pin', async (req, res: Response, next: NextFunction) => {
  try {
    const validation = pinLoginSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.errors);
    }

    const { pin, tenantSlug } = validation.data;

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new AuthenticationError('Tenant no encontrado');
    }

    // Buscar usuario por PIN
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        pin,
        status: 'ACTIVE',
      },
      include: {
        role: true,
        branch: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('PIN inválido');
    }

    // Crear sesión
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        status: 'ACTIVE',
      },
    });

    // Generar tokens
    const tokenPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      roleId: user.roleId,
      permissions: user.role.permissions,
      branchId: user.branchId || undefined,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions,
          },
          branch: user.branch
            ? {
                id: user.branch.id,
                code: user.branch.code,
                name: user.branch.name,
              }
            : null,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
        },
        sessionId: session.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/verify-supervisor
 * Verificar PIN de supervisor para autorización de operaciones
 */
const verifySupervisorSchema = z.object({
  pin: z.string().length(4, 'PIN debe tener 4 dígitos'),
  requiredPermission: z.string().min(1, 'Permiso requerido'),
});

router.post('/verify-supervisor', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = verifySupervisorSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.errors);
    }

    const { pin, requiredPermission } = validation.data;
    const tenantId = req.user!.tenantId;

    // Buscar usuario por PIN en el mismo tenant
    const supervisor = await prisma.user.findFirst({
      where: {
        tenantId,
        pin,
        status: 'ACTIVE',
      },
      include: {
        role: true,
      },
    });

    if (!supervisor) {
      throw new AuthenticationError('PIN inválido');
    }

    // Verificar que tenga el permiso requerido
    const permissions = supervisor.role.permissions as string[];
    if (!permissions.includes(requiredPermission) && !permissions.includes('*')) {
      throw new AuthorizationError('El usuario no tiene permiso para autorizar esta operación');
    }

    res.json({
      success: true,
      data: {
        supervisor: {
          id: supervisor.id,
          name: supervisor.name,
          email: supervisor.email,
          role: supervisor.role.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Renovar token de acceso
 */
router.post('/refresh', async (req, res: Response, next: NextFunction) => {
  try {
    const validation = refreshSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.errors);
    }

    const { refreshToken } = validation.data;

    // Verificar refresh token
    const payload = verifyToken(refreshToken);
    if (!payload) {
      throw new AuthenticationError('Refresh token inválido o expirado');
    }

    // Verificar que el usuario siga activo
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('Usuario no activo');
    }

    // Generar nuevo token
    const tokenPayload = {
      userId: user.id,
      tenantId: payload.tenantId,
      email: user.email,
      roleId: user.roleId,
      permissions: user.role.permissions,
      branchId: user.branchId || undefined,
    };

    const newToken = generateToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post(
  '/logout',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.body.sessionId;

      if (sessionId) {
        // Cerrar sesión específica
        await prisma.userSession.update({
          where: { id: sessionId },
          data: {
            status: 'CLOSED',
            logoutAt: new Date(),
          },
        });
      } else {
        // Cerrar todas las sesiones activas del usuario
        await prisma.userSession.updateMany({
          where: {
            userId: req.user!.userId,
            status: 'ACTIVE',
          },
          data: {
            status: 'CLOSED',
            logoutAt: new Date(),
          },
        });
      }

      res.json({
        success: true,
        message: 'Sesión cerrada correctamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Obtener usuario actual
 */
router.get(
  '/me',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: {
          role: true,
          branch: true,
          tenant: true,
        },
      });

      if (!user) {
        throw ApiError.notFound('Usuario no encontrado');
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions,
          },
          branch: user.branch
            ? {
                id: user.branch.id,
                code: user.branch.code,
                name: user.branch.name,
              }
            : null,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            logo: user.tenant.logo,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/auth/password
 * Cambiar contraseña
 */
router.put(
  '/password',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = changePasswordSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const { currentPassword, newPassword } = validation.data;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!user) {
        throw ApiError.notFound('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );
      if (!isValidPassword) {
        throw new AuthenticationError('Contraseña actual incorrecta');
      }

      // Actualizar contraseña
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      res.json({
        success: true,
        message: 'Contraseña actualizada correctamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
