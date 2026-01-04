/**
 * Rutas de Tesorería
 * API para gestión de retiros pendientes de confirmación
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient, TreasuryStatus } from '@prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import {
  confirmTreasuryPendingSchema,
  rejectTreasuryPendingSchema,
} from '../schemas/treasury.schema.js';

const router = Router();
const prisma = new PrismaClient();

// ==============================================
// GET /api/treasury/pending
// Lista retiros pendientes de confirmación
// ==============================================
router.get('/pending', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, currency, branchId, fromDate, toDate, limit = '50', offset = '0' } = req.query;

    const where: Record<string, unknown> = { tenantId };

    if (status) {
      where.status = status as TreasuryStatus;
    }
    if (currency) {
      where.currency = currency as string;
    }
    if (branchId) {
      where.cashSession = { branchId: branchId as string };
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, Date>).gte = new Date(fromDate as string);
      if (toDate) (where.createdAt as Record<string, Date>).lte = new Date(toDate as string);
    }

    const [pendingList, total] = await Promise.all([
      prisma.treasuryPending.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          cashMovement: {
            select: {
              id: true,
              type: true,
              amount: true,
              reason: true,
              createdAt: true,
            },
          },
          cashSession: {
            select: {
              id: true,
              pointOfSale: {
                select: { id: true, name: true },
              },
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          confirmedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.treasuryPending.count({ where }),
    ]);

    res.json({
      success: true,
      pending: pendingList.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        cashMovement: {
          id: p.cashMovement.id,
          type: p.cashMovement.type,
          amount: Number(p.cashMovement.amount),
          reason: p.cashMovement.reason,
          createdAt: p.cashMovement.createdAt,
        },
        cashSession: {
          id: p.cashSession.id,
          pointOfSale: p.cashSession.pointOfSale,
          user: p.cashSession.user,
        },
        confirmedAt: p.confirmedAt,
        confirmedBy: p.confirmedBy,
        confirmedAmount: p.confirmedAmount ? Number(p.confirmedAmount) : null,
        differenceNotes: p.differenceNotes,
        receiptNumber: p.receiptNumber,
      })),
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/treasury/pending/:id
// Obtener detalle de un retiro pendiente
// ==============================================
router.get('/pending/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const pending = await prisma.treasuryPending.findFirst({
      where: { id, tenantId },
      include: {
        cashMovement: {
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            createdAt: true,
          },
        },
        cashSession: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            pointOfSale: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        confirmedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!pending) {
      throw new NotFoundError('Retiro pendiente no encontrado');
    }

    res.json({
      success: true,
      pending: {
        id: pending.id,
        amount: Number(pending.amount),
        currency: pending.currency,
        status: pending.status,
        createdAt: pending.createdAt,
        updatedAt: pending.updatedAt,
        cashMovement: {
          id: pending.cashMovement.id,
          type: pending.cashMovement.type,
          amount: Number(pending.cashMovement.amount),
          reason: pending.cashMovement.reason,
          createdAt: pending.cashMovement.createdAt,
        },
        cashSession: {
          id: pending.cashSession.id,
          openedAt: pending.cashSession.openedAt,
          closedAt: pending.cashSession.closedAt,
          pointOfSale: pending.cashSession.pointOfSale,
          user: pending.cashSession.user,
        },
        confirmedAt: pending.confirmedAt,
        confirmedBy: pending.confirmedBy,
        confirmedAmount: pending.confirmedAmount ? Number(pending.confirmedAmount) : null,
        differenceNotes: pending.differenceNotes,
        receiptNumber: pending.receiptNumber,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/treasury/pending/:id/confirm
// Confirmar recepción de retiro
// ==============================================
router.post('/pending/:id/confirm', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const parseResult = confirmTreasuryPendingSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { receivedAmount, notes } = parseResult.data;

    const pending = await prisma.treasuryPending.findFirst({
      where: { id, tenantId },
    });

    if (!pending) {
      throw new NotFoundError('Retiro pendiente no encontrado');
    }

    if (pending.status !== TreasuryStatus.PENDING) {
      throw new ValidationError(`Retiro ya fue procesado (estado: ${pending.status})`);
    }

    const expectedAmount = Number(pending.amount);
    const difference = receivedAmount - expectedAmount;
    const newStatus = difference === 0 ? TreasuryStatus.CONFIRMED : TreasuryStatus.PARTIAL;

    const updated = await prisma.treasuryPending.update({
      where: { id },
      data: {
        status: newStatus,
        confirmedAt: new Date(),
        confirmedById: req.user!.userId,
        confirmedAmount: receivedAmount,
        differenceNotes: difference !== 0 ? `Diferencia: ${difference}. ${notes || ''}` : notes,
      },
    });

    res.json({
      success: true,
      message: newStatus === TreasuryStatus.CONFIRMED
        ? 'Retiro confirmado correctamente'
        : `Retiro confirmado con diferencia de ${difference}`,
      pending: {
        id: updated.id,
        status: updated.status,
        expectedAmount,
        confirmedAmount: receivedAmount,
        difference,
        confirmedAt: updated.confirmedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/treasury/pending/:id/reject
// Rechazar un retiro pendiente
// ==============================================
router.post('/pending/:id/reject', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const parseResult = rejectTreasuryPendingSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { reason } = parseResult.data;

    const pending = await prisma.treasuryPending.findFirst({
      where: { id, tenantId },
    });

    if (!pending) {
      throw new NotFoundError('Retiro pendiente no encontrado');
    }

    if (pending.status !== TreasuryStatus.PENDING) {
      throw new ValidationError(`Retiro ya fue procesado (estado: ${pending.status})`);
    }

    const updated = await prisma.treasuryPending.update({
      where: { id },
      data: {
        status: TreasuryStatus.REJECTED,
        confirmedAt: new Date(),
        confirmedById: req.user!.userId,
        differenceNotes: `RECHAZADO: ${reason}`,
      },
    });

    res.json({
      success: true,
      message: 'Retiro rechazado',
      pending: {
        id: updated.id,
        status: updated.status,
        reason,
        rejectedAt: updated.confirmedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/treasury/summary
// Resumen de retiros por estado
// ==============================================
router.get('/summary', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { fromDate, toDate, currency = 'ARS' } = req.query;

    const where: Record<string, unknown> = {
      tenantId,
      currency: currency as string,
    };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, Date>).gte = new Date(fromDate as string);
      if (toDate) (where.createdAt as Record<string, Date>).lte = new Date(toDate as string);
    }

    const [pendingAgg, confirmedAgg, partialAgg, rejectedAgg] = await Promise.all([
      prisma.treasuryPending.aggregate({
        where: { ...where, status: TreasuryStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.treasuryPending.aggregate({
        where: { ...where, status: TreasuryStatus.CONFIRMED },
        _sum: { amount: true, confirmedAmount: true },
        _count: true,
      }),
      prisma.treasuryPending.aggregate({
        where: { ...where, status: TreasuryStatus.PARTIAL },
        _sum: { amount: true, confirmedAmount: true },
        _count: true,
      }),
      prisma.treasuryPending.aggregate({
        where: { ...where, status: TreasuryStatus.REJECTED },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalExpected =
      (Number(confirmedAgg._sum.amount) || 0) +
      (Number(partialAgg._sum.amount) || 0);

    const totalReceived =
      (Number(confirmedAgg._sum.confirmedAmount) || 0) +
      (Number(partialAgg._sum.confirmedAmount) || 0);

    res.json({
      success: true,
      summary: {
        currency,
        pending: {
          count: pendingAgg._count,
          amount: Number(pendingAgg._sum.amount) || 0,
        },
        confirmed: {
          count: confirmedAgg._count,
          expectedAmount: Number(confirmedAgg._sum.amount) || 0,
          confirmedAmount: Number(confirmedAgg._sum.confirmedAmount) || 0,
        },
        partial: {
          count: partialAgg._count,
          expectedAmount: Number(partialAgg._sum.amount) || 0,
          confirmedAmount: Number(partialAgg._sum.confirmedAmount) || 0,
        },
        rejected: {
          count: rejectedAgg._count,
          amount: Number(rejectedAgg._sum.amount) || 0,
        },
        totals: {
          totalExpected,
          totalReceived,
          totalDifference: totalReceived - totalExpected,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
