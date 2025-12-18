/**
 * Rutas de productos
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError, ValidationError, NotFoundError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// Schemas de validación
const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.string().default('1'),
  pageSize: z.string().default('50'),
});

const productCreateSchema = z.object({
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Nombre requerido'),
  shortName: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  basePrice: z.number().min(0).optional(),
  baseCost: z.number().min(0).optional(),
  taxRate: z.number().default(21),
  taxIncluded: z.boolean().default(true),
  trackStock: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(false),
  minStock: z.number().int().optional(),
  sellFractions: z.boolean().default(false),
  unitOfMeasure: z.string().default('UN'),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  isService: z.boolean().default(false),
  location: z.string().optional(),
});

const productUpdateSchema = productCreateSchema.partial();

// =============================================
// CATEGORÍAS Y MARCAS (deben ir ANTES de /:id)
// =============================================

/**
 * GET /api/products/categories
 * Listar categorías
 */
router.get(
  '/categories',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.category.findMany({
        where: {
          tenantId: req.user!.tenantId,
          isActive: true,
        },
        include: {
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      });

      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/products/categories/quick-access
 * Listar categorías de acceso rápido para el POS
 */
router.get(
  '/categories/quick-access',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.category.findMany({
        where: {
          tenantId: req.user!.tenantId,
          isActive: true,
          isQuickAccess: true,
        },
        include: {
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
        orderBy: [{ quickAccessOrder: 'asc' }, { name: 'asc' }],
      });

      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }
);

// Schema para actualizar acceso rápido de categoría
const categoryQuickAccessSchema = z.object({
  isQuickAccess: z.boolean(),
  quickAccessOrder: z.number().int().min(0).optional(),
  quickAccessColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  quickAccessIcon: z.string().optional().nullable(),
});

/**
 * PUT /api/products/categories/:id/quick-access
 * Actualizar configuración de acceso rápido de una categoría
 */
router.put(
  '/categories/:id/quick-access',
  authenticate,
  authorize('admin:settings'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = categoryQuickAccessSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const { isQuickAccess, quickAccessOrder, quickAccessColor, quickAccessIcon } = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar que la categoría existe
      const existing = await prisma.category.findFirst({
        where: { id: req.params.id, tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Categoría');
      }

      // Si se activa y no tiene orden, asignar el siguiente
      let order = quickAccessOrder;
      if (isQuickAccess && order === undefined) {
        const maxOrder = await prisma.category.aggregate({
          where: { tenantId, isQuickAccess: true },
          _max: { quickAccessOrder: true },
        });
        order = (maxOrder._max.quickAccessOrder || 0) + 1;
      }

      const category = await prisma.category.update({
        where: { id: req.params.id },
        data: {
          isQuickAccess,
          quickAccessOrder: order ?? 0,
          quickAccessColor: quickAccessColor ?? null,
          quickAccessIcon: quickAccessIcon ?? null,
        },
      });

      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }
);

// Schema para reordenar acceso rápido
const reorderQuickAccessSchema = z.object({
  categoryIds: z.array(z.string()).min(1),
});

/**
 * PUT /api/products/categories/quick-access/reorder
 * Reordenar categorías de acceso rápido
 */
router.put(
  '/categories/quick-access/reorder',
  authenticate,
  authorize('admin:settings'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = reorderQuickAccessSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const { categoryIds } = validation.data;
      const tenantId = req.user!.tenantId;

      // Actualizar orden de cada categoría
      await prisma.$transaction(
        categoryIds.map((id, index) =>
          prisma.category.updateMany({
            where: { id, tenantId },
            data: { quickAccessOrder: index },
          })
        )
      );

      res.json({ success: true, message: 'Orden actualizado' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/products/brands
 * Listar marcas
 */
router.get(
  '/brands',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const brands = await prisma.brand.findMany({
        where: {
          tenantId: req.user!.tenantId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: brands });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// PRODUCTOS
// =============================================

/**
 * GET /api/products
 * Listar productos con búsqueda y filtros
 */
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = productQuerySchema.safeParse(req.query);
      if (!validation.success) {
        throw new ValidationError('Parámetros inválidos', validation.error.errors);
      }

      const { search, categoryId, brandId, isActive, page, pageSize } = validation.data;
      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const take = parseInt(pageSize);

      // Construir filtros
      const where: Record<string, unknown> = {
        tenantId: req.user!.tenantId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (brandId) {
        where.brandId = brandId;
      }

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      // Ejecutar consultas en paralelo
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            prices: {
              include: {
                priceList: { select: { id: true, name: true } },
              },
            },
          },
          skip,
          take,
          orderBy: { name: 'asc' },
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        success: true,
        data: products,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / parseInt(pageSize)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/products/search
 * Búsqueda rápida para POS (barcode o nombre)
 */
router.get(
  '/search',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const priceListId = req.query.priceListId as string;
      const branchId = req.query.branchId as string;

      if (!query) {
        return res.json({ success: true, data: [] });
      }

      // Buscar por código de barras exacto primero
      let product = await prisma.product.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          barcode: query,
          isActive: true,
        },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          prices: priceListId
            ? {
                where: { priceListId },
                include: { priceList: { select: { id: true, name: true } } },
              }
            : {
                include: { priceList: { select: { id: true, name: true } } },
              },
          stock: branchId
            ? { where: { branchId } }
            : true,
        },
      });

      if (product) {
        return res.json({ success: true, data: [product] });
      }

      // Buscar por SKU exacto
      product = await prisma.product.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          sku: query,
          isActive: true,
        },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          prices: priceListId
            ? {
                where: { priceListId },
                include: { priceList: { select: { id: true, name: true } } },
              }
            : {
                include: { priceList: { select: { id: true, name: true } } },
              },
          stock: branchId
            ? { where: { branchId } }
            : true,
        },
      });

      if (product) {
        return res.json({ success: true, data: [product] });
      }

      // Buscar por nombre (parcial)
      const products = await prisma.product.findMany({
        where: {
          tenantId: req.user!.tenantId,
          isActive: true,
          name: { contains: query, mode: 'insensitive' },
        },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          prices: priceListId
            ? {
                where: { priceListId },
                include: { priceList: { select: { id: true, name: true } } },
              }
            : {
                include: { priceList: { select: { id: true, name: true } } },
              },
          stock: branchId
            ? { where: { branchId } }
            : true,
        },
        take: 20,
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/products/:id
 * Obtener producto por ID
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await prisma.product.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
        include: {
          category: true,
          brand: true,
          prices: {
            include: { priceList: true },
          },
          stock: {
            include: { branch: { select: { id: true, code: true, name: true } } },
          },
        },
      });

      if (!product) {
        throw new NotFoundError('Producto');
      }

      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/products
 * Crear producto (solo productos locales, no sincronizados)
 */
router.post(
  '/',
  authenticate,
  authorize('inventory:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = productCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar SKU único
      if (data.sku) {
        const existing = await prisma.product.findFirst({
          where: { tenantId, sku: data.sku },
        });
        if (existing) {
          throw ApiError.conflict('Ya existe un producto con ese SKU');
        }
      }

      const product = await prisma.product.create({
        data: {
          tenantId,
          ...data,
        },
        include: {
          category: true,
          brand: true,
        },
      });

      res.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/products/:id
 * Actualizar producto
 */
router.put(
  '/:id',
  authenticate,
  authorize('inventory:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = productUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar que el producto existe
      const existing = await prisma.product.findFirst({
        where: {
          id: req.params.id,
          tenantId,
        },
      });

      if (!existing) {
        throw new NotFoundError('Producto');
      }

      // No permitir modificar productos de Cianbox
      if (existing.cianboxProductId) {
        throw ApiError.forbidden(
          'No se pueden modificar productos sincronizados con Cianbox'
        );
      }

      // Verificar SKU único si cambió
      if (data.sku && data.sku !== existing.sku) {
        const skuExists = await prisma.product.findFirst({
          where: { tenantId, sku: data.sku },
        });
        if (skuExists) {
          throw ApiError.conflict('Ya existe un producto con ese SKU');
        }
      }

      const product = await prisma.product.update({
        where: { id: req.params.id },
        data,
        include: {
          category: true,
          brand: true,
        },
      });

      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/products/:id
 * Eliminar/desactivar producto
 */
router.delete(
  '/:id',
  authenticate,
  authorize('inventory:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const existing = await prisma.product.findFirst({
        where: {
          id: req.params.id,
          tenantId,
        },
      });

      if (!existing) {
        throw new NotFoundError('Producto');
      }

      // No eliminar, solo desactivar
      await prisma.product.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({ success: true, message: 'Producto desactivado' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
