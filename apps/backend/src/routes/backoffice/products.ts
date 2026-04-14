import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize, AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// PRODUCTS
// =============================================

// Listar productos
router.get('/products', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { categoryId, brandId, search, parentsOnly, hideVariants, page, limit } = req.query;

    // Paginación: por defecto 50 items, máximo 200
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: {
      tenantId: string;
      categoryId?: string;
      brandId?: string;
      isParent?: boolean;
      parentProductId?: null;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; sku?: { contains: string; mode: 'insensitive' }; barcode?: { contains: string } }>;
    } = { tenantId };

    if (categoryId) {
      where.categoryId = categoryId as string;
    }

    if (brandId) {
      where.brandId = brandId as string;
    }

    // Filtro: solo productos padre (con variantes)
    if (parentsOnly === 'true') {
      where.isParent = true;
    }

    // Filtro: ocultar variantes (mostrar padres y productos simples)
    if (hideVariants === 'true') {
      where.parentProductId = null;
    }

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { sku: { contains: searchStr, mode: 'insensitive' } },
        { barcode: { contains: searchStr } },
      ];
    }

    // Ejecutar count y findMany en paralelo para mejor performance
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
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
          stock: {
            include: {
              branch: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: { variants: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasMore: pageNum < totalPages,
      },
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
        // Producto padre (si es variante)
        parentProduct: {
          select: { id: true, name: true, sku: true, imageUrl: true },
        },
        // Contador de variantes (si es padre)
        _count: {
          select: { variants: true },
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
// Para productos padre (isParent: true), devuelve stock agregado de todas las variantes por sucursal
router.get('/products/:id/stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que el producto pertenece al tenant
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true, isParent: true, name: true },
    });

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    // Si es producto padre, agregar stock de todas las variantes por sucursal
    if (product.isParent) {
      // Obtener todas las variantes
      const variants = await prisma.product.findMany({
        where: { tenantId, parentProductId: id },
        select: { id: true },
      });

      const variantIds = variants.map(v => v.id);

      // Obtener stock de todas las variantes
      const variantStock = await prisma.productStock.findMany({
        where: { productId: { in: variantIds } },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });

      // Agregar por sucursal
      const stockByBranch: Record<string, {
        id: string;
        branchId: string;
        branch: { id: string; name: string } | null;
        quantity: number;
        reserved: number;
        available: number;
        variantCount: number;
      }> = {};

      for (const s of variantStock) {
        if (!stockByBranch[s.branchId]) {
          stockByBranch[s.branchId] = {
            id: `agg-${s.branchId}`,
            branchId: s.branchId,
            branch: s.branch,
            quantity: 0,
            reserved: 0,
            available: 0,
            variantCount: 0,
          };
        }
        stockByBranch[s.branchId].quantity += Number(s.quantity) || 0;
        stockByBranch[s.branchId].reserved += Number(s.reserved) || 0;
        stockByBranch[s.branchId].available += Number(s.available) || 0;
        stockByBranch[s.branchId].variantCount += 1;
      }

      const aggregatedStock = Object.values(stockByBranch);

      res.json({
        success: true,
        data: aggregatedStock,
        isAggregated: true,
        variantCount: variantIds.length,
        message: `Stock agregado de ${variantIds.length} variantes`,
      });
      return;
    }

    // Para productos simples o variantes, devolver stock directo
    const stock = await prisma.productStock.findMany({
      where: { productId: id },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: stock,
      isAggregated: false,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener curva de talles de un producto padre
router.get('/products/:id/size-curve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { branchId } = req.query;

    // Verificar que el producto existe y es padre
    const parentProduct = await prisma.product.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        isParent: true,
        cianboxProductId: true,
        basePrice: true,
      },
    });

    if (!parentProduct) {
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    if (!parentProduct.isParent) {
      throw new ApiError(400, 'INVALID_REQUEST', 'El producto no es un producto padre con variantes');
    }

    // Obtener todas las variantes del producto padre
    const variants = await prisma.product.findMany({
      where: { tenantId, parentProductId: id },
      select: {
        id: true,
        sku: true,
        barcode: true,
        size: true,
        color: true,
        isActive: true,
        basePrice: true,
        stock: {
          where: branchId ? { branchId: branchId as string } : undefined,
          select: {
            quantity: true,
            reserved: true,
            available: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
    });

    // Extraer talles y colores únicos
    const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))].sort();
    const colors = [...new Set(variants.map(v => v.color).filter(Boolean))].sort();

    // Construir matriz de variantes con stock y precio
    const matrix: Record<string, {
      variantId: string;
      sku: string | null;
      barcode: string | null;
      isActive: boolean;
      stock: number;
      reserved: number;
      available: number;
      price: number;
    }> = {};

    const totalsBySize: Record<string, number> = {};
    const totalsByColor: Record<string, number> = {};
    let totalStock = 0;

    for (const variant of variants) {
      const key = `${variant.size || 'N/A'}-${variant.color || 'N/A'}`;

      // Sumar stock de todas las sucursales (o solo la filtrada)
      const stockSum = variant.stock.reduce((sum, s) => sum + Number(s.available || 0), 0);
      const reservedSum = variant.stock.reduce((sum, s) => sum + Number(s.reserved || 0), 0);
      const quantitySum = variant.stock.reduce((sum, s) => sum + Number(s.quantity || 0), 0);

      matrix[key] = {
        variantId: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        isActive: variant.isActive,
        stock: quantitySum,
        reserved: reservedSum,
        available: stockSum,
        price: Number(variant.basePrice || parentProduct.basePrice || 0),
      };

      // Totales por talle
      const sizeKey = variant.size || 'N/A';
      totalsBySize[sizeKey] = (totalsBySize[sizeKey] || 0) + stockSum;

      // Totales por color
      const colorKey = variant.color || 'N/A';
      totalsByColor[colorKey] = (totalsByColor[colorKey] || 0) + stockSum;

      totalStock += stockSum;
    }

    res.json({
      success: true,
      data: {
        parent: {
          id: parentProduct.id,
          name: parentProduct.name,
          sku: parentProduct.sku,
          imageUrl: parentProduct.imageUrl,
          basePrice: Number(parentProduct.basePrice || 0),
        },
        sizes,
        colors,
        variants: variants.map(v => ({
          id: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku,
          barcode: v.barcode,
          isActive: v.isActive,
          stock: v.stock.reduce((sum, s) => sum + Number(s.available || 0), 0),
          price: Number(v.basePrice || parentProduct.basePrice || 0),
        })),
        matrix,
        totals: {
          bySize: totalsBySize,
          byColor: totalsByColor,
          total: totalStock,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Obtener variantes de un producto padre con su stock
router.get('/products/:id/variants-stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que el producto existe y es padre
    const parentProduct = await prisma.product.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        sku: true,
        isParent: true,
      },
    });

    if (!parentProduct) {
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    if (!parentProduct.isParent) {
      throw new ApiError(400, 'INVALID_REQUEST', 'El producto no es un producto padre con variantes');
    }

    // Obtener todas las variantes con su stock
    const variants = await prisma.product.findMany({
      where: { tenantId, parentProductId: id },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        size: true,
        color: true,
        isActive: true,
        stock: {
          select: {
            id: true,
            branchId: true,
            quantity: true,
            reserved: true,
            available: true,
          },
        },
      },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
    });

    res.json({
      success: true,
      data: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        size: v.size,
        color: v.color,
        isActive: v.isActive,
        stock: v.stock.map(s => ({
          id: s.id,
          branchId: s.branchId,
          quantity: Number(s.quantity),
          reserved: Number(s.reserved),
          available: Number(s.available),
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Obtener variantes de un producto padre con sus precios
router.get('/products/:id/variants-prices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que el producto existe y es padre
    const parentProduct = await prisma.product.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        sku: true,
        isParent: true,
      },
    });

    if (!parentProduct) {
      throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
    }

    if (!parentProduct.isParent) {
      throw new ApiError(400, 'INVALID_REQUEST', 'El producto no es un producto padre con variantes');
    }

    // Obtener todas las variantes con sus precios
    const variants = await prisma.product.findMany({
      where: { tenantId, parentProductId: id },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        size: true,
        color: true,
        isActive: true,
        prices: {
          select: {
            id: true,
            price: true,
            priceListId: true,
          },
        },
      },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
    });

    res.json({
      success: true,
      data: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        size: v.size,
        color: v.color,
        isActive: v.isActive,
        prices: v.prices.map(p => ({
          id: p.id,
          price: Number(p.price),
          priceListId: p.priceListId,
        })),
      })),
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
