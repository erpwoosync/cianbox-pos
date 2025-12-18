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

// =============================================
// POINTS OF SALE (Puntos de Venta / Cajas)
// =============================================

// Listar puntos de venta
router.get('/points-of-sale', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const pointsOfSale = await prisma.pointOfSale.findMany({
      where: { tenantId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        priceList: { select: { id: true, name: true, currency: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: pointsOfSale,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener punto de venta por ID
router.get('/points-of-sale/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        priceList: { select: { id: true, name: true, currency: true } },
      },
    });

    if (!pointOfSale) {
      throw new ApiError(404, 'NOT_FOUND', 'Punto de venta no encontrado');
    }

    res.json({
      success: true,
      data: pointOfSale,
    });
  } catch (error) {
    next(error);
  }
});

// Crear punto de venta
const createPointOfSaleSchema = z.object({
  branchId: z.string().min(1, 'La sucursal es requerida'),
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  priceListId: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

router.post(
  '/points-of-sale',
  authorize('pos:write', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const validation = createPointOfSaleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { branchId, code, name, description, priceListId, isActive } = validation.data;

      // Verificar que la sucursal pertenece al tenant
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });

      if (!branch) {
        throw new ApiError(404, 'NOT_FOUND', 'Sucursal no encontrada');
      }

      // Verificar que la lista de precios pertenece al tenant (si se especifica)
      if (priceListId) {
        const priceList = await prisma.priceList.findFirst({
          where: { id: priceListId, tenantId },
        });

        if (!priceList) {
          throw new ApiError(404, 'NOT_FOUND', 'Lista de precios no encontrada');
        }
      }

      // Verificar que no exista otro POS con el mismo código en la misma sucursal
      const existing = await prisma.pointOfSale.findFirst({
        where: { tenantId, branchId, code },
      });

      if (existing) {
        throw new ApiError(409, 'CONFLICT', 'Ya existe un punto de venta con ese código en la sucursal');
      }

      const pointOfSale = await prisma.pointOfSale.create({
        data: {
          tenantId,
          branchId,
          code,
          name,
          description,
          priceListId,
          isActive,
        },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          priceList: { select: { id: true, name: true, currency: true } },
        },
      });

      res.status(201).json({
        success: true,
        data: pointOfSale,
        message: 'Punto de venta creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Actualizar punto de venta
const updatePointOfSaleSchema = z.object({
  branchId: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceListId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  mpDeviceId: z.string().nullable().optional(),
  mpDeviceName: z.string().nullable().optional(),
});

router.put(
  '/points-of-sale/:id',
  authorize('pos:write', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const validation = updatePointOfSaleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      // Verificar que el punto de venta existe y pertenece al tenant
      const existing = await prisma.pointOfSale.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Punto de venta no encontrado');
      }

      const { branchId, code, name, description, priceListId, isActive, mpDeviceId, mpDeviceName } = validation.data;

      // Verificar sucursal si se cambia
      if (branchId && branchId !== existing.branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId },
        });

        if (!branch) {
          throw new ApiError(404, 'NOT_FOUND', 'Sucursal no encontrada');
        }
      }

      // Verificar lista de precios si se cambia
      if (priceListId && priceListId !== existing.priceListId) {
        const priceList = await prisma.priceList.findFirst({
          where: { id: priceListId, tenantId },
        });

        if (!priceList) {
          throw new ApiError(404, 'NOT_FOUND', 'Lista de precios no encontrada');
        }
      }

      // Verificar código único en la sucursal
      const targetBranchId = branchId || existing.branchId;
      const targetCode = code || existing.code;

      if (code !== existing.code || branchId !== existing.branchId) {
        const duplicate = await prisma.pointOfSale.findFirst({
          where: {
            tenantId,
            branchId: targetBranchId,
            code: targetCode,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new ApiError(409, 'CONFLICT', 'Ya existe un punto de venta con ese código en la sucursal');
        }
      }

      const pointOfSale = await prisma.pointOfSale.update({
        where: { id },
        data: {
          ...(branchId && { branchId }),
          ...(code && { code }),
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(priceListId !== undefined && { priceListId }),
          ...(isActive !== undefined && { isActive }),
          ...(mpDeviceId !== undefined && { mpDeviceId }),
          ...(mpDeviceName !== undefined && { mpDeviceName }),
        },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          priceList: { select: { id: true, name: true, currency: true } },
        },
      });

      res.json({
        success: true,
        data: pointOfSale,
        message: 'Punto de venta actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Eliminar punto de venta
router.delete(
  '/points-of-sale/:id',
  authorize('pos:delete', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      // Verificar que el punto de venta existe y pertenece al tenant
      const existing = await prisma.pointOfSale.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Punto de venta no encontrado');
      }

      // Verificar que no tenga ventas asociadas
      const salesCount = await prisma.sale.count({
        where: { pointOfSaleId: id },
      });

      if (salesCount > 0) {
        throw new ApiError(400, 'BAD_REQUEST', `No se puede eliminar: el punto de venta tiene ${salesCount} ventas asociadas`);
      }

      await prisma.pointOfSale.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Punto de venta eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

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

// =============================================
// USERS
// =============================================

import bcrypt from 'bcryptjs';

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

// =============================================
// SALES (Ventas)
// =============================================

// Listar ventas
router.get('/sales', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', pageSize = '20', status, dateFrom, dateTo } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = parseInt(pageSize as string);

    const where: Record<string, unknown> = { tenantId };

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) {
        (where.saleDate as Record<string, Date>).gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        (where.saleDate as Record<string, Date>).lte = endDate;
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          pointOfSale: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { items: true, payments: true } },
        },
        skip,
        take,
        orderBy: { saleDate: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({
      success: true,
      data: sales,
      pagination: {
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Obtener venta por ID
router.get('/sales/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                cianboxProductId: true,
                taxRate: true,
              },
            },
            combo: { select: { id: true, name: true, code: true } },
            promotion: { select: { id: true, name: true, code: true } },
          },
        },
        payments: true,
        customer: true,
        branch: true,
        pointOfSale: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!sale) {
      throw new ApiError(404, 'NOT_FOUND', 'Venta no encontrada');
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
