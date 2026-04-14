import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// DASHBOARD
// =============================================

router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // Fechas para filtros
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalProducts,
      activeProducts,
      parentProducts,
      totalCategories,
      totalBrands,
      lowStockProducts,
      outOfStockProducts,
      totalBranches,
      totalPointsOfSale,
      totalCustomers,
      activeCustomers,
      activePromotions,
      totalUsers,
      // Ventas
      totalSales,
      salesToday,
      salesThisWeek,
      salesThisMonth,
      pendingSales,
      // Totales de ventas
      salesTodayAmount,
      salesThisWeekAmount,
      salesThisMonthAmount,
      // Últimas ventas
      recentSales,
    ] = await Promise.all([
      prisma.product.count({ where: { tenantId, parentProductId: null } }),
      prisma.product.count({ where: { tenantId, isActive: true, parentProductId: null } }),
      prisma.product.count({ where: { tenantId, isParent: true } }),
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
      prisma.branch.count({ where: { tenantId } }),
      prisma.pointOfSale.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId, isActive: true } }),
      prisma.promotion.count({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { startDate: null },
            { startDate: { lte: new Date() } }
          ],
          AND: {
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } }
            ]
          }
        }
      }),
      prisma.user.count({ where: { tenantId } }),
      // Ventas counts
      prisma.sale.count({ where: { tenantId } }),
      prisma.sale.count({ where: { tenantId, createdAt: { gte: today } } }),
      prisma.sale.count({ where: { tenantId, createdAt: { gte: startOfWeek } } }),
      prisma.sale.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      prisma.sale.count({ where: { tenantId, status: 'PENDING' } }),
      // Ventas amounts
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: startOfWeek }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      // Últimas 5 ventas
      prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          saleNumber: true,
          total: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true } },
          pointOfSale: { select: { name: true } },
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
          withVariants: parentProducts,
        },
        categories: totalCategories,
        brands: totalBrands,
        stock: {
          lowStock: lowStockProducts,
          outOfStock: outOfStockProducts,
        },
        branches: totalBranches,
        pointsOfSale: totalPointsOfSale,
        customers: {
          total: totalCustomers,
          active: activeCustomers,
        },
        promotions: {
          active: activePromotions,
        },
        users: totalUsers,
        sales: {
          total: totalSales,
          today: salesToday,
          thisWeek: salesThisWeek,
          thisMonth: salesThisMonth,
          pending: pendingSales,
          todayAmount: Number(salesTodayAmount._sum.total || 0),
          thisWeekAmount: Number(salesThisWeekAmount._sum.total || 0),
          thisMonthAmount: Number(salesThisMonthAmount._sum.total || 0),
        },
        recentSales: recentSales.map(s => ({
          id: s.id,
          saleNumber: s.saleNumber,
          total: Number(s.total),
          status: s.status,
          createdAt: s.createdAt,
          customerName: s.customer?.name || 'Consumidor Final',
          pointOfSale: s.pointOfSale?.name,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
