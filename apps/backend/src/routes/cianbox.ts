/**
 * Rutas de integración con Cianbox
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { CianboxService } from '../services/cianbox.service.js';
import { ApiError, ValidationError, NotFoundError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// Schemas de validación
const connectionConfigSchema = z.object({
  cuenta: z.string().min(1, 'Cuenta requerida'),
  appName: z.string().min(1, 'Nombre de aplicación requerido'),
  appCode: z.string().min(1, 'Código de aplicación requerido'),
  user: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
  syncPageSize: z.number().int().min(10).max(200).default(50),
});

const connectionUpdateSchema = connectionConfigSchema.partial();

/**
 * GET /api/cianbox/connection
 * Obtener configuración de conexión a Cianbox
 */
router.get(
  '/connection',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const connection = await prisma.cianboxConnection.findUnique({
        where: { tenantId: req.user!.tenantId },
        select: {
          id: true,
          cuenta: true,
          appName: true,
          appCode: true,
          user: true,
          syncPageSize: true,
          isActive: true,
          lastSync: true,
          syncStatus: true,
          webhookUrl: true,
          createdAt: true,
          updatedAt: true,
          // No incluir password ni tokens por seguridad
        },
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
 * POST /api/cianbox/connection
 * Configurar conexión a Cianbox
 */
router.post(
  '/connection',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = connectionConfigSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar si ya existe una conexión
      const existing = await prisma.cianboxConnection.findUnique({
        where: { tenantId },
      });

      if (existing) {
        throw ApiError.conflict(
          'Ya existe una conexión configurada. Use PUT para actualizar.'
        );
      }

      // Crear conexión
      const connection = await prisma.cianboxConnection.create({
        data: {
          tenantId,
          ...data,
          isActive: true,
        },
        select: {
          id: true,
          cuenta: true,
          appName: true,
          appCode: true,
          user: true,
          syncPageSize: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Intentar autenticar para validar credenciales
      try {
        const service = await CianboxService.forTenant(tenantId);
        // El constructor ya intenta autenticar

        res.status(201).json({
          success: true,
          data: connection,
          message: 'Conexión configurada y autenticada correctamente',
        });
      } catch (authError) {
        // Eliminar conexión si falla autenticación
        await prisma.cianboxConnection.delete({
          where: { id: connection.id },
        });
        throw ApiError.badRequest(
          'Credenciales inválidas. No se pudo autenticar con Cianbox.'
        );
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/cianbox/connection
 * Actualizar configuración de conexión
 */
router.put(
  '/connection',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = connectionUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      const existing = await prisma.cianboxConnection.findUnique({
        where: { tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Conexión');
      }

      // Actualizar y limpiar tokens si cambian credenciales
      const needsReauth =
        data.user || data.password || data.appCode || data.cuenta;

      const connection = await prisma.cianboxConnection.update({
        where: { tenantId },
        data: {
          ...data,
          ...(needsReauth && {
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
          }),
        },
        select: {
          id: true,
          cuenta: true,
          appName: true,
          appCode: true,
          user: true,
          syncPageSize: true,
          isActive: true,
          lastSync: true,
          syncStatus: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        data: connection,
        message: needsReauth
          ? 'Conexión actualizada. Se requerirá re-autenticación en la próxima sincronización.'
          : 'Conexión actualizada',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cianbox/connection
 * Eliminar conexión a Cianbox
 */
router.delete(
  '/connection',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const existing = await prisma.cianboxConnection.findUnique({
        where: { tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Conexión');
      }

      await prisma.cianboxConnection.delete({
        where: { tenantId },
      });

      res.json({
        success: true,
        message: 'Conexión eliminada',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/connection/test
 * Probar conexión a Cianbox
 */
router.post(
  '/connection/test',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);

      // Intentar obtener categorías como prueba
      const categories = await service.getCategories();

      res.json({
        success: true,
        message: `Conexión exitosa. Se encontraron ${categories.length} categorías.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/connection/toggle
 * Activar/desactivar conexión
 */
router.post(
  '/connection/toggle',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const existing = await prisma.cianboxConnection.findUnique({
        where: { tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Conexión');
      }

      const connection = await prisma.cianboxConnection.update({
        where: { tenantId },
        data: { isActive: !existing.isActive },
        select: {
          id: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: connection,
        message: connection.isActive
          ? 'Conexión activada'
          : 'Conexión desactivada',
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// SINCRONIZACIÓN
// =============================================

/**
 * POST /api/cianbox/sync/all
 * Sincronizar todos los datos desde Cianbox
 */
router.post(
  '/sync/all',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const result = await service.syncAll(tenantId);

      res.json({
        success: true,
        data: result,
        message: `Sincronización completada: ${result.products} productos, ${result.categories} categorías, ${result.brands} marcas, ${result.branches} sucursales, ${result.priceLists} listas de precios, ${result.customers} clientes`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/sync/products
 * Sincronizar solo productos
 */
router.post(
  '/sync/products',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const count = await service.syncProducts(tenantId);

      res.json({
        success: true,
        data: { synced: count },
        message: `${count} productos sincronizados`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/sync/categories
 * Sincronizar solo categorías
 */
router.post(
  '/sync/categories',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const count = await service.syncCategories(tenantId);

      res.json({
        success: true,
        data: { synced: count },
        message: `${count} categorías sincronizadas`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/sync/brands
 * Sincronizar solo marcas
 */
router.post(
  '/sync/brands',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const count = await service.syncBrands(tenantId);

      res.json({
        success: true,
        data: { synced: count },
        message: `${count} marcas sincronizadas`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/sync/branches
 * Sincronizar sucursales
 */
router.post(
  '/sync/branches',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const count = await service.syncBranches(tenantId);

      res.json({
        success: true,
        data: { synced: count },
        message: `${count} sucursales sincronizadas`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/sync/price-lists
 * Sincronizar listas de precios
 */
router.post(
  '/sync/price-lists',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const count = await service.syncPriceLists(tenantId);

      res.json({
        success: true,
        data: { synced: count },
        message: `${count} listas de precios sincronizadas`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cianbox/sync/customers
 * Sincronizar clientes
 */
router.post(
  '/sync/customers',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const service = await CianboxService.forTenant(tenantId);
      const count = await service.syncCustomers(tenantId);

      res.json({
        success: true,
        data: { synced: count },
        message: `${count} clientes sincronizados`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// WEBHOOKS - Ver /api/cianboxwebhooks/:tenantId
// =============================================

/**
 * GET /api/cianbox/sync/status
 * Obtener estado de última sincronización
 */
router.get(
  '/sync/status',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const connection = await prisma.cianboxConnection.findUnique({
        where: { tenantId: req.user!.tenantId },
        select: {
          lastSync: true,
          syncStatus: true,
          isActive: true,
        },
      });

      if (!connection) {
        return res.json({
          success: true,
          data: {
            configured: false,
          },
        });
      }

      // Contar registros sincronizados
      const tenantId = req.user!.tenantId;
      const [products, categories, brands, branches, priceLists, customers] =
        await Promise.all([
          prisma.product.count({ where: { tenantId, cianboxProductId: { not: null } } }),
          prisma.category.count({ where: { tenantId, cianboxCategoryId: { not: null } } }),
          prisma.brand.count({ where: { tenantId, cianboxBrandId: { not: null } } }),
          prisma.branch.count({ where: { tenantId, cianboxBranchId: { not: null } } }),
          prisma.priceList.count({ where: { tenantId, cianboxPriceListId: { not: null } } }),
          prisma.customer.count({ where: { tenantId, cianboxCustomerId: { not: null } } }),
        ]);

      res.json({
        success: true,
        data: {
          configured: true,
          isActive: connection.isActive,
          lastSync: connection.lastSync,
          syncStatus: connection.syncStatus,
          counts: {
            products,
            categories,
            brands,
            branches,
            priceLists,
            customers,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
