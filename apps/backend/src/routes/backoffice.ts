/**
 * Rutas del Client Backoffice
 * API para gestión de catálogo por tenant (categorías, marcas, productos, precios, stock)
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// Middleware: autenticación requerida para todas las rutas
router.use(authenticate);

// =============================================
// DASHBOARD
// =============================================

router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const [
      totalProducts,
      activeProducts,
      totalCategories,
      totalBrands,
      lowStockProducts,
      outOfStockProducts,
    ] = await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.category.count({ where: { tenantId } }),
      prisma.brand.count({ where: { tenantId } }),
      prisma.productStock.count({
        where: {
          product: { tenantId },
          available: { gt: 0, lt: 10 },
        },
      }),
      prisma.productStock.count({
        where: {
          product: { tenantId },
          available: { lte: 0 },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        products: {
          total: totalProducts,
          active: activeProducts,
          inactive: totalProducts - activeProducts,
        },
        categories: totalCategories,
        brands: totalBrands,
        stock: {
          lowStock: lowStockProducts,
          outOfStock: outOfStockProducts,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// CATEGORIES
// =============================================

// Listar categorías
router.get('/categories', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const categories = await prisma.category.findMany({
      where: { tenantId },
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
});

// Obtener categoría por ID
router.get('/categories/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: true,
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new ApiError(404, 'NOT_FOUND', 'Categoría no encontrada');
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// BRANDS
// =============================================

// Listar marcas
router.get('/brands', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const brands = await prisma.brand.findMany({
      where: { tenantId },
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
});

// Obtener marca por ID
router.get('/brands/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const brand = await prisma.brand.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new ApiError(404, 'NOT_FOUND', 'Marca no encontrada');
    }

    res.json({
      success: true,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// PRODUCTS
// =============================================

// Listar productos
router.get('/products', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { categoryId, brandId, search } = req.query;

    const where: {
      tenantId: string;
      categoryId?: string;
      brandId?: string;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; sku?: { contains: string; mode: 'insensitive' }; barcode?: { contains: string } }>;
    } = { tenantId };

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
});

// Obtener producto por ID
router.get('/products/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
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
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener precios de producto
router.get('/products/:id/prices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que el producto pertenece al tenant
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    const prices = await prisma.productPrice.findMany({
      where: { productId: id },
      include: {
        priceList: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: prices,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener stock de producto
router.get('/products/:id/stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que el producto pertenece al tenant
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    const stock = await prisma.productStock.findMany({
      where: { productId: id },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: stock,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// PRICE LISTS
// =============================================

router.get('/price-lists', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const priceLists = await prisma.priceList.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: priceLists,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// BRANCHES (Sucursales)
// =============================================

router.get('/branches', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const branches = await prisma.branch.findMany({
      where: { tenantId },
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
});

// =============================================
// STOCK
// =============================================

// Obtener todo el stock
router.get('/stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { lowStock, search } = req.query;

    const where: {
      product: { tenantId: string; OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; sku?: { contains: string; mode: 'insensitive' } }> };
      available?: { lt: number } | { lte: number };
    } = {
      product: { tenantId },
    };

    if (lowStock === 'true') {
      where.available = { lt: 10 };
    }

    if (search) {
      const searchStr = search as string;
      where.product.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { sku: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const stock = await prisma.productStock.findMany({
      where,
      include: {
        product: {
          select: { id: true, sku: true, name: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { available: 'asc' },
    });

    res.json({
      success: true,
      data: stock,
    });
  } catch (error) {
    next(error);
  }
});

// Ajustar stock
const adjustStockSchema = z.object({
  quantity: z.number(),
  reason: z.string().min(1),
});

router.post(
  '/products/:id/stock/adjust',
  authorize('stock:adjust', 'stock:write', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const branchId = req.user!.branchId;
      const { id } = req.params;

      const validation = adjustStockSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { quantity, reason } = validation.data;

      // Verificar que el producto pertenece al tenant
      const product = await prisma.product.findFirst({
        where: { id, tenantId },
      });

      if (!product) {
        throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
      }

      if (!branchId) {
        throw new ApiError(400, 'BAD_REQUEST', 'Usuario no tiene sucursal asignada');
      }

      // Buscar o crear stock para la sucursal
      const existingStock = await prisma.productStock.findUnique({
        where: {
          productId_branchId: { productId: id, branchId },
        },
      });

      let updatedStock;

      if (existingStock) {
        const currentQuantity = Number(existingStock.quantity);
        const currentReserved = Number(existingStock.reserved);
        const newQuantity = currentQuantity + quantity;
        const newAvailable = newQuantity - currentReserved;

        updatedStock = await prisma.productStock.update({
          where: { id: existingStock.id },
          data: {
            quantity: newQuantity,
            available: newAvailable,
          },
          include: {
            branch: { select: { id: true, name: true } },
          },
        });
      } else {
        updatedStock = await prisma.productStock.create({
          data: {
            productId: id,
            branchId,
            quantity: quantity > 0 ? quantity : 0,
            reserved: 0,
            available: quantity > 0 ? quantity : 0,
          },
          include: {
            branch: { select: { id: true, name: true } },
          },
        });
      }

      // TODO: Registrar movimiento de stock en tabla de auditoría

      res.json({
        success: true,
        data: updatedStock,
        message: `Stock ajustado: ${quantity > 0 ? '+' : ''}${quantity} (${reason})`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
