import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// SESIONES DE CAJA
// =============================================

/**
 * GET /api/backoffice/cash-sessions
 * Lista todas las sesiones de caja del tenant
 */
router.get('/cash-sessions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      page = '1',
      limit = '20',
      status,
      branchId,
      pointOfSaleId,
      userId,
      from,
      to,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId };

    if (status) where.status = status;
    if (branchId) where.branchId = branchId;
    if (pointOfSaleId) where.pointOfSaleId = pointOfSaleId;
    if (userId) where.userId = userId;

    if (from || to) {
      where.openedAt = {};
      if (from) where.openedAt.gte = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        where.openedAt.lte = toDate;
      }
    }

    const [sessions, total] = await Promise.all([
      prisma.cashSession.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { openedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          pointOfSale: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true } },
          _count: {
            select: { movements: true, sales: true },
          },
        },
      }),
      prisma.cashSession.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backoffice/cash-sessions/:id
 * Detalle de una sesión de caja con movimientos, arqueos y ventas
 */
router.get('/cash-sessions/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const session = await prisma.cashSession.findFirst({
      where: { id, tenantId },
      include: {
        pointOfSale: true,
        branch: true,
        user: { select: { id: true, name: true, email: true } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        movements: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: { select: { id: true, name: true } },
            authorizedBy: { select: { id: true, name: true } },
          },
        },
        counts: {
          orderBy: { countedAt: 'asc' },
          include: {
            countedBy: { select: { id: true, name: true } },
            verifiedBy: { select: { id: true, name: true } },
          },
        },
        sales: {
          where: { status: 'COMPLETED' },
          orderBy: { saleDate: 'desc' },
          select: {
            id: true,
            saleNumber: true,
            saleDate: true,
            total: true,
            status: true,
            payments: {
              select: { method: true, amount: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', 'Sesión de caja no encontrada');
    }

    res.json({
      success: true,
      data: { session },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backoffice/cash-sessions/report/daily
 * Reporte diario de sesiones de caja
 */
router.get('/cash-sessions/report/daily', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { date, branchId } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      tenantId,
      openedAt: { gte: startOfDay, lte: endOfDay },
    };

    if (branchId) where.branchId = branchId;

    const sessions = await prisma.cashSession.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        pointOfSale: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    // Calcular resumen
    const summary = {
      totalSessions: sessions.length,
      openSessions: sessions.filter((s) => s.status === 'OPEN').length,
      closedSessions: sessions.filter((s) => s.status === 'CLOSED').length,
      totalSales: sessions.reduce((sum, s) => sum + Number(s.salesTotal), 0),
      totalCash: sessions.reduce((sum, s) => sum + Number(s.totalCash), 0),
      totalDebit: sessions.reduce((sum, s) => sum + Number(s.totalDebit), 0),
      totalCredit: sessions.reduce((sum, s) => sum + Number(s.totalCredit), 0),
      totalQr: sessions.reduce((sum, s) => sum + Number(s.totalQr), 0),
      totalMpPoint: sessions.reduce((sum, s) => sum + Number(s.totalMpPoint || 0), 0),
      totalTransfer: sessions.reduce((sum, s) => sum + Number(s.totalTransfer || 0), 0),
      totalOther: sessions.reduce((sum, s) => sum + Number(s.totalOther || 0), 0),
      totalWithdrawals: sessions.reduce((sum, s) => sum + Number(s.withdrawalsTotal), 0),
      totalDeposits: sessions.reduce((sum, s) => sum + Number(s.depositsTotal), 0),
    };

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        sessions,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
