import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// CUSTOMERS (Clientes)
// =============================================

/**
 * GET /api/backoffice/customers
 * Lista todos los clientes del tenant
 */
router.get('/customers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { search, page = '1', pageSize = '50', isActive } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const pageSizeNum = Math.min(parseInt(pageSize as string, 10) || 50, 100);
    const skip = (pageNum - 1) * pageSizeNum;

    const where: {
      tenantId: string;
      isActive?: boolean;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; taxId?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }>;
    } = { tenantId };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          cianboxCustomerId: true,
          name: true,
          taxId: true,
          taxIdType: true,
          taxCategory: true,
          customerType: true,
          email: true,
          phone: true,
          mobile: true,
          address: true,
          city: true,
          state: true,
          creditLimit: true,
          creditBalance: true,
          paymentTermDays: true,
          globalDiscount: true,
          isActive: true,
          priceList: {
            select: { id: true, name: true },
          },
          lastSyncedAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSizeNum,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backoffice/customers/:id
 * Obtiene un cliente por ID
 */
router.get('/customers/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        priceList: {
          select: { id: true, name: true },
        },
        sales: {
          select: {
            id: true,
            saleNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { sales: true },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backoffice/customers/stats
 * Estadísticas de clientes
 */
router.get('/customers-stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const [total, active, withCredit, byCianbox] = await Promise.all([
      prisma.customer.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId, isActive: true } }),
      prisma.customer.count({ where: { tenantId, creditLimit: { gt: 0 } } }),
      prisma.customer.count({ where: { tenantId, cianboxCustomerId: { not: null } } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        withCredit,
        fromCianbox: byCianbox,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
