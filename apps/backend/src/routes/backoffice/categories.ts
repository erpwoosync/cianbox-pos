import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

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

export default router;
