/**
 * Rutas de administración de agencia (super admins)
 * Gestión de servidores de DB, tenants globales, etc.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/database.service.js';
import DatabaseService from '../services/database.service.js';
import { ApiError, ValidationError, AuthenticationError } from '../utils/errors.js';

const router = Router();

// =============================================
// MIDDLEWARE DE AUTENTICACIÓN DE AGENCIA
// =============================================

interface AgencyAuthRequest extends Request {
  agencyUser?: {
    id: string;
    email: string;
    name: string;
  };
}

const agencyAuth = async (
  req: AgencyAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token de agencia requerido');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      ) as { agencyUserId: string; email: string; name: string };

      // Verificar que es un usuario de agencia
      const agencyUser = await prisma.agencyUser.findUnique({
        where: { id: decoded.agencyUserId },
      });

      if (!agencyUser || agencyUser.status !== 'ACTIVE') {
        throw new AuthenticationError('Usuario de agencia no válido');
      }

      req.agencyUser = {
        id: agencyUser.id,
        email: agencyUser.email,
        name: agencyUser.name,
      };

      next();
    } catch {
      throw new AuthenticationError('Token de agencia inválido');
    }
  } catch (error) {
    next(error);
  }
};

// =============================================
// AUTENTICACIÓN DE AGENCIA
// =============================================

const agencyLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/agency/login
 * Login de usuario de agencia (super admin)
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = agencyLoginSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.errors);
    }

    const { email, password } = validation.data;

    const agencyUser = await prisma.agencyUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!agencyUser) {
      throw new AuthenticationError('Credenciales inválidas');
    }

    if (agencyUser.status !== 'ACTIVE') {
      throw new AuthenticationError('Usuario deshabilitado');
    }

    const isValidPassword = await bcrypt.compare(password, agencyUser.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Credenciales inválidas');
    }

    const token = jwt.sign(
      {
        agencyUserId: agencyUser.id,
        email: agencyUser.email,
        name: agencyUser.name,
        isAgencyUser: true,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: agencyUser.id,
          email: agencyUser.email,
          name: agencyUser.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// GESTIÓN DE SERVIDORES DE BASE DE DATOS
// =============================================

const serverCreateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  host: z.string().min(1, 'Host requerido'),
  port: z.number().int().default(5432),
  database: z.string().min(1, 'Nombre de DB requerido'),
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
  sslEnabled: z.boolean().default(true),
  maxConnections: z.number().int().min(10).max(1000).default(100),
  isDefault: z.boolean().default(false),
  region: z.string().optional(),
  description: z.string().optional(),
});

const serverUpdateSchema = serverCreateSchema.partial();

/**
 * GET /api/agency/database-servers
 * Listar servidores de base de datos
 */
router.get(
  '/database-servers',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const servers = await DatabaseService.listServers();

      res.json({
        success: true,
        data: servers,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/database-servers
 * Crear servidor de base de datos
 */
router.post(
  '/database-servers',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const validation = serverCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const server = await DatabaseService.createServer(validation.data);

      res.status(201).json({
        success: true,
        data: server,
        message: 'Servidor creado correctamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/agency/database-servers/:id
 * Actualizar servidor de base de datos
 */
router.put(
  '/database-servers/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const validation = serverUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const server = await DatabaseService.updateServer(
        req.params.id,
        validation.data
      );

      res.json({
        success: true,
        data: server,
        message: 'Servidor actualizado',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/agency/database-servers/:id
 * Eliminar servidor de base de datos
 */
router.delete(
  '/database-servers/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      await DatabaseService.deleteServer(req.params.id);

      res.json({
        success: true,
        message: 'Servidor eliminado',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/database-servers/:id/test
 * Probar conexión a servidor
 */
router.post(
  '/database-servers/:id/test',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await DatabaseService.testConnection(req.params.id);

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/database-servers/:id/stats
 * Estadísticas de un servidor
 */
router.get(
  '/database-servers/:id/stats',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await DatabaseService.getServerStats(req.params.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/database-servers/health-check
 * Health check de todos los servidores
 */
router.post(
  '/database-servers/health-check',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const results = await DatabaseService.healthCheckAll();

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// GESTIÓN DE TENANTS (desde agencia)
// =============================================

const tenantCreateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z
    .string()
    .min(3, 'Slug debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug solo puede contener letras minúsculas, números y guiones'),
  taxId: z.string().optional(),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).default('FREE'),
  databaseServerId: z.string().optional(),
  adminEmail: z.string().email('Email de admin requerido'),
  adminPassword: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
  adminName: z.string().min(1, 'Nombre de admin requerido'),
});

/**
 * GET /api/agency/tenants
 * Listar todos los tenants
 */
router.get(
  '/tenants',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenants = await prisma.tenant.findMany({
        include: {
          databaseServer: {
            select: { id: true, name: true, host: true },
          },
          _count: {
            select: { users: true, branches: true, products: true, sales: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: tenants,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/tenants
 * Crear nuevo tenant con admin inicial
 */
router.post(
  '/tenants',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const validation = tenantCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;

      // Verificar slug único
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug: data.slug },
      });

      if (existingTenant) {
        throw ApiError.conflict('Ya existe un tenant con ese slug');
      }

      // Crear tenant con rol y usuario admin en una transacción
      const result = await prisma.$transaction(async (tx) => {
        // Crear tenant
        const tenant = await tx.tenant.create({
          data: {
            name: data.name,
            slug: data.slug,
            taxId: data.taxId,
            plan: data.plan,
            status: 'ACTIVE',
            databaseServerId: data.databaseServerId,
          },
        });

        // Crear rol administrador
        const adminRole = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: 'Administrador',
            description: 'Acceso completo al sistema',
            isSystem: true,
            permissions: ['*'], // Todos los permisos
          },
        });

        // Crear rol cajero
        await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: 'Cajero',
            description: 'Operaciones de punto de venta',
            isSystem: true,
            permissions: ['pos:sell', 'pos:discount', 'inventory:view'],
          },
        });

        // Crear usuario admin
        const passwordHash = await bcrypt.hash(data.adminPassword, 10);
        const adminUser = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: data.adminEmail.toLowerCase(),
            passwordHash,
            name: data.adminName,
            roleId: adminRole.id,
            status: 'ACTIVE',
          },
        });

        // Actualizar contador de tenants en el servidor de DB
        if (data.databaseServerId) {
          await tx.databaseServer.update({
            where: { id: data.databaseServerId },
            data: { tenantCount: { increment: 1 } },
          });
        }

        return { tenant, adminUser };
      });

      res.status(201).json({
        success: true,
        data: {
          tenant: result.tenant,
          adminUser: {
            id: result.adminUser.id,
            email: result.adminUser.email,
            name: result.adminUser.name,
          },
        },
        message: 'Tenant creado correctamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/agency/tenants/:id/database-server
 * Asignar tenant a un servidor de base de datos
 */
router.put(
  '/tenants/:id/database-server',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const { serverId } = req.body;

      const result = await DatabaseService.assignTenantToServer(
        req.params.id,
        serverId
      );

      res.json({
        success: true,
        data: result,
        message: serverId
          ? 'Tenant asignado al servidor'
          : 'Tenant asignado al servidor por defecto',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/tenants/:id/migrate
 * Migrar tenant a otro servidor (solo actualiza asignación)
 */
router.post(
  '/tenants/:id/migrate',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const { targetServerId } = req.body;

      if (!targetServerId) {
        throw ApiError.badRequest('serverId destino requerido');
      }

      const result = await DatabaseService.migrateTenant(
        req.params.id,
        targetServerId
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/agency/tenants/:id/status
 * Cambiar estado de un tenant
 */
router.put(
  '/tenants/:id/status',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;

      if (!['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'].includes(status)) {
        throw ApiError.badRequest('Estado inválido');
      }

      const tenant = await prisma.tenant.update({
        where: { id: req.params.id },
        data: { status },
      });

      res.json({
        success: true,
        data: tenant,
        message: `Tenant ${status === 'ACTIVE' ? 'activado' : status.toLowerCase()}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// DASHBOARD DE AGENCIA
// =============================================

/**
 * GET /api/agency/dashboard
 * Estadísticas generales de la agencia
 */
router.get(
  '/dashboard',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const [
        totalTenants,
        activeTenants,
        totalServers,
        healthyServers,
        tenantsByPlan,
        recentTenants,
      ] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.databaseServer.count({ where: { isActive: true } }),
        prisma.databaseServer.count({
          where: { isActive: true, healthStatus: 'HEALTHY' },
        }),
        prisma.tenant.groupBy({
          by: ['plan'],
          _count: true,
        }),
        prisma.tenant.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          tenants: {
            total: totalTenants,
            active: activeTenants,
            byPlan: tenantsByPlan.reduce(
              (acc, item) => ({
                ...acc,
                [item.plan]: item._count,
              }),
              {}
            ),
          },
          servers: {
            total: totalServers,
            healthy: healthyServers,
          },
          recentTenants,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
