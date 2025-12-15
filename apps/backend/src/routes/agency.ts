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
import CianboxService from '../services/cianbox.service.js';
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
          cianboxConnection: {
            select: { id: true, cuenta: true, lastSync: true, syncStatus: true },
          },
          _count: {
            select: { users: true, branches: true, products: true, sales: true, categories: true, brands: true },
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
 * GET /api/agency/tenants/:id
 * Obtener detalle de un tenant
 */
router.get(
  '/tenants/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.params.id },
        include: {
          databaseServer: {
            select: { id: true, name: true, host: true },
          },
          cianboxConnection: true,
          _count: {
            select: { users: true, branches: true, products: true, sales: true, categories: true, brands: true },
          },
        },
      });

      if (!tenant) {
        throw ApiError.notFound('Tenant no encontrado');
      }

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/agency/tenants/:id
 * Actualizar un tenant
 */
router.put(
  '/tenants/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, slug, taxId, plan, databaseServerId, status } = req.body;

      const tenant = await prisma.tenant.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(slug && { slug }),
          ...(taxId !== undefined && { taxId }),
          ...(plan && { plan }),
          ...(databaseServerId !== undefined && { databaseServerId }),
          ...(status && { status }),
        },
      });

      res.json({
        success: true,
        data: tenant,
        message: 'Tenant actualizado',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/agency/tenants/:id
 * Eliminar un tenant
 */
router.delete(
  '/tenants/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      await prisma.tenant.delete({
        where: { id: req.params.id },
      });

      res.json({
        success: true,
        message: 'Tenant eliminado',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/connection
 * Obtener conexión Cianbox de un tenant
 */
router.get(
  '/tenants/:id/connection',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const connection = await prisma.cianboxConnection.findUnique({
        where: { tenantId: req.params.id },
      });

      res.json({
        success: true,
        data: connection,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/agency/tenants/:id/connection
 * Actualizar/crear conexión Cianbox de un tenant
 */
router.put(
  '/tenants/:id/connection',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const { cuenta, appName, appCode, user, password, syncPageSize, isActive, webhookUrl } = req.body;

      const connection = await prisma.cianboxConnection.upsert({
        where: { tenantId: req.params.id },
        create: {
          tenantId: req.params.id,
          cuenta: cuenta || '',
          appName: appName || '',
          appCode: appCode || '',
          user: user || '',
          password: password || '',
          syncPageSize: syncPageSize || 50,
          isActive: isActive ?? true,
          webhookUrl: webhookUrl || null,
        },
        update: {
          ...(cuenta !== undefined && { cuenta }),
          ...(appName !== undefined && { appName }),
          ...(appCode !== undefined && { appCode }),
          ...(user !== undefined && { user }),
          ...(password && { password }), // Solo actualizar si se envía
          ...(syncPageSize !== undefined && { syncPageSize }),
          ...(isActive !== undefined && { isActive }),
          ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
        },
      });

      res.json({
        success: true,
        data: connection,
        message: 'Conexión actualizada',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/tenants/:id/connection/test
 * Probar conexión Cianbox de un tenant
 */
router.post(
  '/tenants/:id/connection/test',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await CianboxService.testConnection(req.params.id);

      res.json({
        success: result.success,
        message: result.message,
        data: result.expiresIn ? { expiresIn: result.expiresIn } : undefined,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/categories
 * Sincronizar categorías de un tenant desde Cianbox
 */
router.post(
  '/tenants/:id/sync/categories',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(`[Sync] Iniciando sync de categorías para tenant: ${req.params.id}`);
      const cianbox = await CianboxService.forTenant(req.params.id);
      const synced = await cianbox.syncCategories(req.params.id);

      res.json({
        success: true,
        message: `${synced} categorías sincronizadas`,
        data: { synced },
      });
    } catch (error) {
      console.error(`[Sync] Error en categorías:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      res.status(500).json({
        success: false,
        message: `Error al sincronizar categorías: ${errorMessage}`,
        error: errorMessage,
      });
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/brands
 * Sincronizar marcas de un tenant desde Cianbox
 */
router.post(
  '/tenants/:id/sync/brands',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(`[Sync] Iniciando sync de marcas para tenant: ${req.params.id}`);
      const cianbox = await CianboxService.forTenant(req.params.id);
      const synced = await cianbox.syncBrands(req.params.id);

      res.json({
        success: true,
        message: `${synced} marcas sincronizadas`,
        data: { synced },
      });
    } catch (error) {
      console.error(`[Sync] Error en marcas:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      res.status(500).json({
        success: false,
        message: `Error al sincronizar marcas: ${errorMessage}`,
        error: errorMessage,
      });
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/products
 * Sincronizar productos de un tenant desde Cianbox
 */
router.post(
  '/tenants/:id/sync/products',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const cianbox = await CianboxService.forTenant(req.params.id);
      const synced = await cianbox.syncProducts(req.params.id);

      res.json({
        success: true,
        message: `${synced} productos sincronizados`,
        data: { synced },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/branches
 * Sincronizar sucursales de un tenant desde Cianbox
 */
router.post(
  '/tenants/:id/sync/branches',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(`[Sync] Iniciando sync de sucursales para tenant: ${req.params.id}`);
      const cianbox = await CianboxService.forTenant(req.params.id);
      const synced = await cianbox.syncBranches(req.params.id);

      res.json({
        success: true,
        message: `${synced} sucursales sincronizadas`,
        data: { synced },
      });
    } catch (error) {
      console.error(`[Sync] Error en sucursales:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      res.status(500).json({
        success: false,
        message: `Error al sincronizar sucursales: ${errorMessage}`,
        error: errorMessage,
      });
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/price-lists
 * Sincronizar listas de precios de un tenant desde Cianbox
 */
router.post(
  '/tenants/:id/sync/price-lists',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(`[Sync] Iniciando sync de listas de precios para tenant: ${req.params.id}`);
      const cianbox = await CianboxService.forTenant(req.params.id);
      const synced = await cianbox.syncPriceLists(req.params.id);

      res.json({
        success: true,
        message: `${synced} listas de precios sincronizadas`,
        data: { synced },
      });
    } catch (error) {
      console.error(`[Sync] Error en listas de precios:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      res.status(500).json({
        success: false,
        message: `Error al sincronizar listas de precios: ${errorMessage}`,
        error: errorMessage,
      });
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/customers
 * Sincronizar clientes de un tenant desde Cianbox
 */
router.post(
  '/tenants/:id/sync/customers',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(`[Sync] Iniciando sync de clientes para tenant: ${req.params.id}`);
      const cianbox = await CianboxService.forTenant(req.params.id);
      const synced = await cianbox.syncCustomers(req.params.id);

      res.json({
        success: true,
        message: `${synced} clientes sincronizados`,
        data: { synced },
      });
    } catch (error) {
      console.error(`[Sync] Error en clientes:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      res.status(500).json({
        success: false,
        message: `Error al sincronizar clientes: ${errorMessage}`,
        error: errorMessage,
      });
    }
  }
);

/**
 * POST /api/agency/tenants/:id/sync/all
 * Sincronizar todo desde Cianbox (categorías, marcas, productos)
 */
router.post(
  '/tenants/:id/sync/all',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const cianbox = await CianboxService.forTenant(req.params.id);
      const result = await cianbox.syncAll(req.params.id);

      res.json({
        success: true,
        message: 'Sincronización completa',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/sync/status
 * Estado de sincronización de un tenant
 */
router.get(
  '/tenants/:id/sync/status',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const connection = await prisma.cianboxConnection.findUnique({
        where: { tenantId: req.params.id },
        select: {
          lastSync: true,
          syncStatus: true,
        },
      });

      const counts = await prisma.$transaction([
        prisma.product.count({ where: { tenantId: req.params.id } }),
        prisma.category.count({ where: { tenantId: req.params.id } }),
        prisma.brand.count({ where: { tenantId: req.params.id } }),
      ]);

      res.json({
        success: true,
        data: {
          lastSync: connection?.lastSync,
          status: connection?.syncStatus,
          products: counts[0],
          categories: counts[1],
          brands: counts[2],
        },
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

// =============================================
// GESTIÓN DE USUARIOS DE AGENCIA
// =============================================

const agencyUserCreateSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'Nombre requerido'),
});

const agencyUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

/**
 * GET /api/agency/users
 * Listar usuarios de agencia
 */
router.get(
  '/users',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.agencyUser.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/agency/users
 * Crear usuario de agencia
 */
router.post(
  '/users',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const validation = agencyUserCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const { email, password, name } = validation.data;

      const existingUser = await prisma.agencyUser.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw ApiError.conflict('Ya existe un usuario con ese email');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.agencyUser.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'Usuario creado',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/agency/users/:id
 * Actualizar usuario de agencia
 */
router.put(
  '/users/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const validation = agencyUserUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const updateData: Record<string, unknown> = {};

      if (data.email) {
        updateData.email = data.email.toLowerCase();
      }
      if (data.name) {
        updateData.name = data.name;
      }
      if (data.status) {
        updateData.status = data.status;
      }
      if (data.password) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10);
      }

      const user = await prisma.agencyUser.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        data: user,
        message: 'Usuario actualizado',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/agency/users/:id
 * Eliminar usuario de agencia
 */
router.delete(
  '/users/:id',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      // Evitar que el usuario se elimine a sí mismo
      if (req.params.id === req.agencyUser?.id) {
        throw ApiError.badRequest('No puedes eliminar tu propio usuario');
      }

      await prisma.agencyUser.delete({
        where: { id: req.params.id },
      });

      res.json({
        success: true,
        message: 'Usuario eliminado',
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// CIANBOX TOKENS MANAGEMENT
// =============================================

/**
 * POST /api/agency/cianbox/refresh-tokens
 * Ejecutar refresh de todos los tokens de Cianbox manualmente
 */
router.post(
  '/cianbox/refresh-tokens',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await CianboxService.refreshAllTokens();

      res.json({
        success: true,
        message: `Refresh completado: ${result.refreshed} actualizados, ${result.failed} fallidos`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/cianbox/token-status
 * Ver estado de tokens de todas las conexiones Cianbox
 */
router.get(
  '/cianbox/token-status',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const connections = await prisma.cianboxConnection.findMany({
        where: { isActive: true },
        select: {
          id: true,
          cuenta: true,
          isActive: true,
          tokenExpiresAt: true,
          lastSync: true,
          syncStatus: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      });

      const now = new Date();
      const statuses = connections.map((conn) => {
        const expiresAt = conn.tokenExpiresAt;
        let tokenStatus = 'unknown';
        let hoursRemaining = 0;

        if (expiresAt) {
          hoursRemaining = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
          if (hoursRemaining > 2) {
            tokenStatus = 'valid';
          } else if (hoursRemaining > 0) {
            tokenStatus = 'expiring_soon';
          } else {
            tokenStatus = 'expired';
          }
        }

        return {
          tenantId: conn.tenant?.id,
          tenantName: conn.tenant?.name,
          cuenta: conn.cuenta,
          tokenStatus,
          hoursRemaining,
          expiresAt,
          lastSync: conn.lastSync,
          syncStatus: conn.syncStatus,
        };
      });

      res.json({
        success: true,
        data: {
          total: statuses.length,
          valid: statuses.filter((s) => s.tokenStatus === 'valid').length,
          expiringSoon: statuses.filter((s) => s.tokenStatus === 'expiring_soon').length,
          expired: statuses.filter((s) => s.tokenStatus === 'expired').length,
          connections: statuses,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// CATÁLOGO DE TENANT (vista desde agency)
// =============================================

/**
 * GET /api/agency/tenants/:id/catalog/categories
 * Listar categorías de un tenant
 */
router.get(
  '/tenants/:id/catalog/categories',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.category.findMany({
        where: { tenantId: req.params.id },
        include: {
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/catalog/brands
 * Listar marcas de un tenant
 */
router.get(
  '/tenants/:id/catalog/brands',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const brands = await prisma.brand.findMany({
        where: { tenantId: req.params.id },
        include: {
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: brands,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/catalog/products
 * Listar productos de un tenant con precios y stock
 */
router.get(
  '/tenants/:id/catalog/products',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const { categoryId, brandId, search } = req.query;

      const where: {
        tenantId: string;
        categoryId?: string;
        brandId?: string;
        OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; sku?: { contains: string; mode: 'insensitive' }; barcode?: { contains: string } }>;
      } = { tenantId: req.params.id };

      if (categoryId) {
        where.categoryId = categoryId as string;
      }

      if (brandId) {
        where.brandId = brandId as string;
      }

      if (search) {
        const searchStr = search as string;
        where.OR = [
          { name: { contains: searchStr, mode: 'insensitive' } },
          { sku: { contains: searchStr, mode: 'insensitive' } },
          { barcode: { contains: searchStr } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          prices: {
            include: {
              priceList: { select: { id: true, name: true } },
            },
          },
          stock: {
            include: {
              branch: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/catalog/products/:productId
 * Obtener detalle de un producto con precios y stock
 */
router.get(
  '/tenants/:id/catalog/products/:productId',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const product = await prisma.product.findFirst({
        where: {
          id: req.params.productId,
          tenantId: req.params.id,
        },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          prices: {
            include: {
              priceList: { select: { id: true, name: true } },
            },
          },
          stock: {
            include: {
              branch: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!product) {
        throw ApiError.notFound('Producto no encontrado');
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/catalog/price-lists
 * Listar listas de precios de un tenant
 */
router.get(
  '/tenants/:id/catalog/price-lists',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const priceLists = await prisma.priceList.findMany({
        where: { tenantId: req.params.id },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: priceLists,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agency/tenants/:id/catalog/branches
 * Listar sucursales de un tenant
 */
router.get(
  '/tenants/:id/catalog/branches',
  agencyAuth,
  async (req: AgencyAuthRequest, res: Response, next: NextFunction) => {
    try {
      const branches = await prisma.branch.findMany({
        where: { tenantId: req.params.id },
        select: { id: true, name: true, code: true, isActive: true },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: branches,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
