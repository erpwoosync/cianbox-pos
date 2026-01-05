/**
 * Rutas de gestión de caja (turnos, movimientos, arqueos)
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient, Prisma, CashSessionStatus, CashMovementType, CashMovementReason, CashCountType, DifferenceType } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError, ValidationError, NotFoundError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// ==============================================
// SCHEMAS DE VALIDACIÓN
// ==============================================

const openSessionSchema = z.object({
  pointOfSaleId: z.string(),
  openingAmount: z.number().min(0),
  notes: z.string().optional(),
});

const closeSessionSchema = z.object({
  count: z.object({
    bills: z.object({
      10000: z.number().int().min(0).default(0),
      5000: z.number().int().min(0).default(0),
      2000: z.number().int().min(0).default(0),
      1000: z.number().int().min(0).default(0),
      500: z.number().int().min(0).default(0),
      200: z.number().int().min(0).default(0),
      100: z.number().int().min(0).default(0),
      50: z.number().int().min(0).default(0),
      20: z.number().int().min(0).default(0),
      10: z.number().int().min(0).default(0),
    }).optional(),
    coins: z.object({
      500: z.number().int().min(0).default(0),
      200: z.number().int().min(0).default(0),
      100: z.number().int().min(0).default(0),
      50: z.number().int().min(0).default(0),
      25: z.number().int().min(0).default(0),
      10: z.number().int().min(0).default(0),
      5: z.number().int().min(0).default(0),
      2: z.number().int().min(0).default(0),
      1: z.number().int().min(0).default(0),
    }).optional(),
    vouchers: z.number().min(0).default(0),
    checks: z.number().min(0).default(0),
    otherValues: z.number().min(0).default(0),
    otherValuesNote: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
});

const movementSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CHANGE_FUND']),
  amount: z.number().positive(),
  reason: z.enum([
    'SAFE_DEPOSIT',
    'BANK_DEPOSIT',
    'SUPPLIER_PAYMENT',
    'EXPENSE',
    'CHANGE_FUND',
    'INITIAL_FUND',
    'LOAN_RETURN',
    'CORRECTION',
    'COUNT_DIFFERENCE',
    'OTHER',
  ]),
  description: z.string().optional(),
  reference: z.string().optional(),
  destinationType: z.string().optional(),
});

const countSchema = z.object({
  type: z.enum(['OPENING', 'PARTIAL', 'CLOSING', 'AUDIT', 'TRANSFER']).default('PARTIAL'),
  bills: z.object({
    10000: z.number().int().min(0).default(0),
    5000: z.number().int().min(0).default(0),
    2000: z.number().int().min(0).default(0),
    1000: z.number().int().min(0).default(0),
    500: z.number().int().min(0).default(0),
    200: z.number().int().min(0).default(0),
    100: z.number().int().min(0).default(0),
    50: z.number().int().min(0).default(0),
    20: z.number().int().min(0).default(0),
    10: z.number().int().min(0).default(0),
  }),
  coins: z.object({
    500: z.number().int().min(0).default(0),
    200: z.number().int().min(0).default(0),
    100: z.number().int().min(0).default(0),
    50: z.number().int().min(0).default(0),
    25: z.number().int().min(0).default(0),
    10: z.number().int().min(0).default(0),
    5: z.number().int().min(0).default(0),
    2: z.number().int().min(0).default(0),
    1: z.number().int().min(0).default(0),
  }),
  vouchers: z.number().min(0).default(0),
  checks: z.number().min(0).default(0),
  otherValues: z.number().min(0).default(0),
  otherValuesNote: z.string().optional(),
  notes: z.string().optional(),
});

const transferSchema = z.object({
  toUserId: z.string(),
  transferAmount: z.number().min(0),
  count: countSchema.optional(),
  notes: z.string().optional(),
});

// ==============================================
// HELPERS
// ==============================================

/**
 * Genera número de sesión secuencial
 */
async function generateSessionNumber(
  tenantId: string,
  pointOfSaleId: string
): Promise<string> {
  const pos = await prisma.pointOfSale.findUnique({
    where: { id: pointOfSaleId },
  });

  if (!pos) {
    throw new NotFoundError('Punto de venta');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.cashSession.count({
    where: {
      tenantId,
      pointOfSaleId,
      createdAt: { gte: today },
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = String(count + 1).padStart(3, '0');

  return `T-${pos.code}-${dateStr}-${sequence}`;
}

/**
 * Calcula el monto esperado de efectivo en la sesión
 */
async function calculateExpectedCash(sessionId: string): Promise<number> {
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      movements: true,
      sales: {
        where: { status: 'COMPLETED' },
        include: { payments: true },
      },
    },
  });

  if (!session) {
    throw new NotFoundError('Sesión de caja');
  }

  let expected = Number(session.openingAmount);

  // Sumar ventas en efectivo
  // payment.amount es el monto neto de la venta (lo que queda en caja)
  // changeAmount es solo informativo (lo que se devolvió al cliente)
  for (const sale of session.sales) {
    for (const payment of sale.payments) {
      if (payment.method === 'CASH' && payment.status === 'COMPLETED') {
        expected += Number(payment.amount);
      }
    }
  }

  // Sumar/restar movimientos
  for (const mov of session.movements) {
    const amount = Number(mov.amount);
    switch (mov.type) {
      case 'DEPOSIT':
      case 'ADJUSTMENT_IN':
      case 'TRANSFER_IN':
      case 'CHANGE_FUND':
        expected += amount;
        break;
      case 'WITHDRAWAL':
      case 'ADJUSTMENT_OUT':
      case 'TRANSFER_OUT':
        expected -= amount;
        break;
    }
  }

  return expected;
}

/**
 * Calcula totales por método de pago
 */
async function calculatePaymentTotals(sessionId: string): Promise<{
  totalCash: number;
  totalDebit: number;
  totalCredit: number;
  totalQr: number;
  totalMpPoint: number;
  totalTransfer: number;
  totalOther: number;
  salesCount: number;
  salesTotal: number;
  refundsCount: number;
  refundsTotal: number;
  cancelsCount: number;
}> {
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      sales: {
        include: { payments: true },
      },
    },
  });

  if (!session) {
    throw new NotFoundError('Sesión de caja');
  }

  const totals = {
    totalCash: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalQr: 0,
    totalMpPoint: 0,
    totalTransfer: 0,
    totalOther: 0,
    salesCount: 0,
    salesTotal: 0,
    refundsCount: 0,
    refundsTotal: 0,
    cancelsCount: 0,
  };

  for (const sale of session.sales) {
    if (sale.status === 'COMPLETED') {
      totals.salesCount++;
      totals.salesTotal += Number(sale.total);

      for (const payment of sale.payments) {
        if (payment.status !== 'COMPLETED') continue;
        const amount = Number(payment.amount);

        switch (payment.method) {
          case 'CASH':
            totals.totalCash += amount;
            break;
          case 'DEBIT_CARD':
            totals.totalDebit += amount;
            break;
          case 'CREDIT_CARD':
            totals.totalCredit += amount;
            break;
          case 'QR':
            totals.totalQr += amount;
            break;
          case 'MP_POINT':
            totals.totalMpPoint += amount;
            break;
          case 'TRANSFER':
            totals.totalTransfer += amount;
            break;
          default:
            totals.totalOther += amount;
        }
      }
    } else if (sale.status === 'REFUNDED' || sale.status === 'PARTIAL_REFUND') {
      totals.refundsCount++;
      totals.refundsTotal += Number(sale.total);
    } else if (sale.status === 'CANCELLED') {
      totals.cancelsCount++;
    }
  }

  return totals;
}

/**
 * Calcula totales de billetes y monedas
 */
function calculateDenominationTotals(bills: Record<string, number>, coins: Record<string, number>): {
  totalBills: number;
  totalCoins: number;
  totalCash: number;
} {
  const billDenominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
  const coinDenominations = [500, 200, 100, 50, 25, 10, 5, 2, 1];

  let totalBills = 0;
  let totalCoins = 0;

  for (const denom of billDenominations) {
    totalBills += (bills[denom.toString()] || 0) * denom;
  }

  for (const denom of coinDenominations) {
    totalCoins += (coins[denom.toString()] || 0) * denom;
  }

  return {
    totalBills,
    totalCoins,
    totalCash: totalBills + totalCoins,
  };
}

// ==============================================
// RUTAS DE GESTIÓN DE TURNOS
// ==============================================

/**
 * GET /api/cash/current
 * Obtener turno actual del usuario
 */
router.get(
  '/current',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
        include: {
          pointOfSale: true,
          branch: true,
          user: { select: { id: true, name: true, email: true } },
          movements: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          counts: {
            orderBy: { countedAt: 'desc' },
            take: 5,
          },
          _count: {
            select: { sales: true, movements: true },
          },
        },
      });

      if (!session) {
        return res.json({
          success: true,
          data: { session: null, hasOpenSession: false, expectedCash: 0 },
        });
      }

      const expectedCash = await calculateExpectedCash(session.id);

      res.json({
        success: true,
        data: {
          session: {
            ...session,
            expectedCash,
          },
          hasOpenSession: true,
          expectedCash,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cash/status/:posId
 * Estado de caja por punto de venta
 */
router.get(
  '/status/:posId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { posId } = req.params;

      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          pointOfSaleId: posId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          pointOfSale: true,
        },
      });

      const pos = await prisma.pointOfSale.findFirst({
        where: {
          id: posId,
          tenantId: req.user!.tenantId,
        },
      });

      if (!pos) {
        throw new NotFoundError('Punto de venta');
      }

      res.json({
        success: true,
        data: {
          pointOfSale: pos,
          currentSession: session,
          isOpen: !!session && session.status === 'OPEN',
          isSuspended: session?.status === 'SUSPENDED',
          isCounting: session?.status === 'COUNTING',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cash/open
 * Abrir turno de caja
 */
router.post(
  '/open',
  authenticate,
  authorize('cash:open'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = openSessionSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const { pointOfSaleId, openingAmount, notes } = validation.data;
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;

      // Verificar que el POS existe y pertenece al tenant
      const pos = await prisma.pointOfSale.findFirst({
        where: { id: pointOfSaleId, tenantId },
        include: { branch: true },
      });

      if (!pos) {
        throw new NotFoundError('Punto de venta');
      }

      // Verificar que no hay otra sesión abierta en este POS
      const existingSession = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          pointOfSaleId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
      });

      if (existingSession) {
        throw new ApiError(400, 'Ya hay un turno abierto en este punto de venta');
      }

      // Verificar que el usuario no tiene otro turno abierto
      const userSession = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          userId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
      });

      if (userSession) {
        throw new ApiError(400, 'Ya tienes un turno abierto en otro punto de venta');
      }

      // Generar número de sesión
      const sessionNumber = await generateSessionNumber(tenantId, pointOfSaleId);

      // Crear la sesión
      const session = await prisma.cashSession.create({
        data: {
          tenantId,
          branchId: pos.branchId,
          pointOfSaleId,
          userId,
          sessionNumber,
          openingAmount: new Prisma.Decimal(openingAmount),
          openedByUserId: userId,
          openingNotes: notes,
          status: 'OPEN',
        },
        include: {
          pointOfSale: true,
          branch: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      res.status(201).json({
        success: true,
        message: 'Turno de caja abierto correctamente',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cash/close
 * Cerrar turno actual
 */
router.post(
  '/close',
  authenticate,
  authorize('cash:close'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = closeSessionSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const { count, notes } = validation.data;
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;

      // Buscar sesión abierta del usuario
      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          userId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
      });

      if (!session) {
        throw new ApiError(400, 'No tienes un turno abierto');
      }

      // Calcular monto esperado
      const expectedAmount = await calculateExpectedCash(session.id);

      // Calcular totales por método de pago
      const paymentTotals = await calculatePaymentTotals(session.id);

      // Calcular movimientos
      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: session.id },
      });

      let withdrawalsTotal = 0;
      let depositsTotal = 0;

      for (const mov of movements) {
        const amount = Number(mov.amount);
        if (['WITHDRAWAL', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'].includes(mov.type)) {
          withdrawalsTotal += amount;
        } else {
          depositsTotal += amount;
        }
      }

      let closingAmount = expectedAmount;
      let difference = 0;
      let differenceType: DifferenceType | null = null;
      let cashCount = null;

      // Si se proporciona arqueo, calcularlo
      if (count?.bills || count?.coins) {
        const bills: Record<string, number> = (count.bills || {}) as Record<string, number>;
        const coins: Record<string, number> = (count.coins || {}) as Record<string, number>;
        const totals = calculateDenominationTotals(bills, coins);

        closingAmount = totals.totalCash + (count.vouchers || 0) + (count.checks || 0) + (count.otherValues || 0);
        difference = closingAmount - expectedAmount;

        if (difference > 0) {
          differenceType = 'SURPLUS';
        } else if (difference < 0) {
          differenceType = 'SHORTAGE';
        }

        // Crear registro de arqueo de cierre
        cashCount = await prisma.cashCount.create({
          data: {
            cashSessionId: session.id,
            type: 'CLOSING',
            bills_10000: bills['10000'] || 0,
            bills_5000: bills['5000'] || 0,
            bills_2000: bills['2000'] || 0,
            bills_1000: bills['1000'] || 0,
            bills_500: bills['500'] || 0,
            bills_200: bills['200'] || 0,
            bills_100: bills['100'] || 0,
            bills_50: bills['50'] || 0,
            bills_20: bills['20'] || 0,
            bills_10: bills['10'] || 0,
            coins_500: coins['500'] || 0,
            coins_200: coins['200'] || 0,
            coins_100: coins['100'] || 0,
            coins_50: coins['50'] || 0,
            coins_25: coins['25'] || 0,
            coins_10: coins['10'] || 0,
            coins_5: coins['5'] || 0,
            coins_2: coins['2'] || 0,
            coins_1: coins['1'] || 0,
            totalBills: new Prisma.Decimal(totals.totalBills),
            totalCoins: new Prisma.Decimal(totals.totalCoins),
            totalCash: new Prisma.Decimal(totals.totalCash),
            expectedAmount: new Prisma.Decimal(expectedAmount),
            difference: new Prisma.Decimal(difference),
            differenceType,
            vouchers: new Prisma.Decimal(count.vouchers || 0),
            checks: new Prisma.Decimal(count.checks || 0),
            otherValues: new Prisma.Decimal(count.otherValues || 0),
            otherValuesNote: count.otherValuesNote,
            countedByUserId: userId,
          },
        });
      }

      // Actualizar sesión
      const closedSession = await prisma.cashSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedByUserId: userId,
          closingAmount: new Prisma.Decimal(closingAmount),
          expectedAmount: new Prisma.Decimal(expectedAmount),
          difference: new Prisma.Decimal(difference),
          closingNotes: notes,
          ...paymentTotals,
          withdrawalsTotal: new Prisma.Decimal(withdrawalsTotal),
          depositsTotal: new Prisma.Decimal(depositsTotal),
        },
        include: {
          pointOfSale: true,
          branch: true,
          user: { select: { id: true, name: true, email: true } },
          counts: true,
        },
      });

      res.json({
        success: true,
        message: 'Turno de caja cerrado correctamente',
        data: {
          session: closedSession,
          summary: {
            openingAmount: Number(session.openingAmount),
            closingAmount,
            expectedAmount,
            difference,
            differenceType,
            ...paymentTotals,
            withdrawalsTotal,
            depositsTotal,
          },
          count: cashCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cash/suspend
 * Suspender turno (pausa temporal)
 */
router.post(
  '/suspend',
  authenticate,
  authorize('cash:open'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          status: 'OPEN',
        },
      });

      if (!session) {
        throw new ApiError(400, 'No tienes un turno abierto');
      }

      const updatedSession = await prisma.cashSession.update({
        where: { id: session.id },
        data: { status: 'SUSPENDED' },
      });

      res.json({
        success: true,
        message: 'Turno suspendido',
        data: { session: updatedSession },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cash/resume
 * Reanudar turno suspendido
 */
router.post(
  '/resume',
  authenticate,
  authorize('cash:open'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          status: 'SUSPENDED',
        },
      });

      if (!session) {
        throw new ApiError(400, 'No tienes un turno suspendido');
      }

      const updatedSession = await prisma.cashSession.update({
        where: { id: session.id },
        data: { status: 'OPEN' },
      });

      res.json({
        success: true,
        message: 'Turno reanudado',
        data: { session: updatedSession },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cash/transfer
 * Relevo de turno a otro cajero
 */
router.post(
  '/transfer',
  authenticate,
  authorize('cash:close'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = transferSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const { toUserId, transferAmount, count, notes } = validation.data;
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;

      // Buscar usuario actual
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      });

      if (!currentUser) {
        throw new ApiError(401, 'Usuario no encontrado');
      }

      // Buscar sesión actual
      const currentSession = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          userId,
          status: { in: ['OPEN', 'SUSPENDED'] },
        },
      });

      if (!currentSession) {
        throw new ApiError(400, 'No tienes un turno abierto');
      }

      // Verificar que el nuevo cajero existe
      const newCashier = await prisma.user.findFirst({
        where: { id: toUserId, tenantId },
      });

      if (!newCashier) {
        throw new NotFoundError('Usuario destino');
      }

      // Verificar que el nuevo cajero no tiene turno abierto
      const newCashierSession = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          userId: toUserId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
      });

      if (newCashierSession) {
        throw new ApiError(400, 'El cajero destino ya tiene un turno abierto');
      }

      // Usar transacción para el relevo
      const result = await prisma.$transaction(async (tx) => {
        // Calcular totales de la sesión actual
        const expectedAmount = await calculateExpectedCash(currentSession.id);
        const paymentTotals = await calculatePaymentTotals(currentSession.id);

        // Cerrar sesión actual
        const closedSession = await tx.cashSession.update({
          where: { id: currentSession.id },
          data: {
            status: 'TRANSFERRED',
            closedAt: new Date(),
            closedByUserId: userId,
            closingAmount: new Prisma.Decimal(transferAmount),
            expectedAmount: new Prisma.Decimal(expectedAmount),
            difference: new Prisma.Decimal(transferAmount - expectedAmount),
            closingNotes: notes || 'Relevo de turno',
            ...paymentTotals,
          },
        });

        // Registrar movimiento de transferencia saliente
        await tx.cashMovement.create({
          data: {
            cashSessionId: currentSession.id,
            type: 'TRANSFER_OUT',
            amount: new Prisma.Decimal(transferAmount),
            reason: 'SHIFT_TRANSFER',
            description: `Transferido a ${newCashier.name}`,
            createdByUserId: userId,
          },
        });

        // Generar nuevo número de sesión
        const sessionNumber = await generateSessionNumber(tenantId, currentSession.pointOfSaleId);

        // Crear nueva sesión para el cajero entrante
        const newSession = await tx.cashSession.create({
          data: {
            tenantId,
            branchId: currentSession.branchId,
            pointOfSaleId: currentSession.pointOfSaleId,
            userId: toUserId,
            sessionNumber,
            openingAmount: new Prisma.Decimal(transferAmount),
            openedByUserId: userId, // El que transfiere autoriza la apertura
            openingNotes: `Relevo de ${currentUser.name}`,
            previousSessionId: currentSession.id,
            transferAmount: new Prisma.Decimal(transferAmount),
            status: 'OPEN',
          },
          include: {
            pointOfSale: true,
            branch: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });

        // Registrar movimiento de transferencia entrante
        await tx.cashMovement.create({
          data: {
            cashSessionId: newSession.id,
            type: 'TRANSFER_IN',
            amount: new Prisma.Decimal(transferAmount),
            reason: 'SHIFT_TRANSFER',
            description: `Recibido de ${currentUser.name}`,
            createdByUserId: userId,
          },
        });

        return { closedSession, newSession };
      });

      res.json({
        success: true,
        message: 'Relevo de turno completado',
        data: {
          closedSession: result.closedSession,
          newSession: result.newSession,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==============================================
// RUTAS DE MOVIMIENTOS
// ==============================================

/**
 * POST /api/cash/deposit
 * Registrar ingreso de efectivo
 */
router.post(
  '/deposit',
  authenticate,
  authorize('cash:movements'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = movementSchema.safeParse({
        ...req.body,
        type: 'DEPOSIT',
      });
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const { amount, reason, description, reference } = validation.data;

      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          status: 'OPEN',
        },
      });

      if (!session) {
        throw new ApiError(400, 'No tienes un turno abierto');
      }

      const movement = await prisma.cashMovement.create({
        data: {
          cashSessionId: session.id,
          type: 'DEPOSIT',
          amount: new Prisma.Decimal(amount),
          reason: reason as CashMovementReason,
          description,
          reference,
          createdByUserId: req.user!.userId,
        },
      });

      // Actualizar total de depósitos
      await prisma.cashSession.update({
        where: { id: session.id },
        data: {
          depositsTotal: {
            increment: amount,
          },
        },
      });

      res.status(201).json({
        success: true,
        message: 'Ingreso registrado',
        data: { movement },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cash/withdraw
 * Registrar retiro de efectivo (requiere autorización de supervisor)
 */
const withdrawSchema = z.object({
  amount: z.number().positive(),
  reason: z.enum([
    'SAFE_DEPOSIT',
    'BANK_DEPOSIT',
    'SUPPLIER_PAYMENT',
    'EXPENSE',
    'CHANGE_FUND',
    'LOAN_RETURN',
    'CORRECTION',
    'OTHER',
  ]),
  description: z.string().optional(),
  reference: z.string().optional(),
  destinationType: z.string().optional(),
  authorizedByUserId: z.string().min(1, 'Se requiere autorización de supervisor'),
});

router.post(
  '/withdraw',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = withdrawSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const { amount, reason, description, reference, destinationType, authorizedByUserId } = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar que el supervisor existe y tiene permiso
      const supervisor = await prisma.user.findFirst({
        where: {
          id: authorizedByUserId,
          tenantId,
          status: 'ACTIVE',
        },
        include: { role: true },
      });

      if (!supervisor) {
        throw new ApiError(400, 'Supervisor no válido');
      }

      const supervisorPermissions = supervisor.role.permissions as string[];
      if (!supervisorPermissions.includes('cash:movements') && !supervisorPermissions.includes('*')) {
        throw new ApiError(403, 'El supervisor no tiene permiso para autorizar retiros');
      }

      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          userId: req.user!.userId,
          status: 'OPEN',
        },
      });

      if (!session) {
        throw new ApiError(400, 'No tienes un turno abierto');
      }

      // Verificar que hay suficiente efectivo
      const expectedCash = await calculateExpectedCash(session.id);
      if (amount > expectedCash) {
        throw new ApiError(400, `No hay suficiente efectivo. Disponible: $${expectedCash.toFixed(2)}`);
      }

      const movement = await prisma.cashMovement.create({
        data: {
          cashSessionId: session.id,
          type: 'WITHDRAWAL',
          amount: new Prisma.Decimal(amount),
          reason: reason as CashMovementReason,
          description,
          reference,
          destinationType,
          createdByUserId: req.user!.userId,
          authorizedByUserId,
          requiresAuth: true,
        },
        include: {
          authorizedBy: { select: { id: true, name: true } },
        },
      });

      // Actualizar total de retiros
      await prisma.cashSession.update({
        where: { id: session.id },
        data: {
          withdrawalsTotal: {
            increment: amount,
          },
        },
      });

      // Crear registro en tesorería para control
      await prisma.treasuryPending.create({
        data: {
          tenantId,
          cashSessionId: session.id,
          cashMovementId: movement.id,
          amount: new Prisma.Decimal(amount),
          status: 'PENDING',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Retiro registrado',
        data: { movement },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cash/movements
 * Listar movimientos del turno actual
 */
router.get(
  '/movements',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
      });

      if (!session) {
        return res.json({
          success: true,
          data: { movements: [], session: null },
        });
      }

      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: session.id },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          authorizedBy: { select: { id: true, name: true } },
        },
      });

      res.json({
        success: true,
        data: { movements, sessionId: session.id },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cash/movements/:sessionId
 * Movimientos de un turno específico
 */
router.get(
  '/movements/:sessionId',
  authenticate,
  authorize('cash:view_all'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const session = await prisma.cashSession.findFirst({
        where: {
          id: sessionId,
          tenantId: req.user!.tenantId,
        },
      });

      if (!session) {
        throw new NotFoundError('Sesión de caja');
      }

      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: sessionId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          authorizedBy: { select: { id: true, name: true } },
        },
      });

      res.json({
        success: true,
        data: { movements, session },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==============================================
// RUTAS DE ARQUEOS
// ==============================================

/**
 * POST /api/cash/count
 * Registrar arqueo
 */
router.post(
  '/count',
  authenticate,
  authorize('cash:count'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = countSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const { type, bills, coins, vouchers, checks, otherValues, otherValuesNote, notes } = validation.data;

      const session = await prisma.cashSession.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          status: { in: ['OPEN', 'SUSPENDED', 'COUNTING'] },
        },
      });

      if (!session) {
        throw new ApiError(400, 'No tienes un turno abierto');
      }

      // Calcular totales
      const totals = calculateDenominationTotals(bills as Record<string, number>, coins as Record<string, number>);
      const expectedAmount = await calculateExpectedCash(session.id);
      const totalWithOthers = totals.totalCash + vouchers + checks + otherValues;
      const difference = totalWithOthers - expectedAmount;

      let differenceType: DifferenceType | null = null;
      if (difference > 0) {
        differenceType = 'SURPLUS';
      } else if (difference < 0) {
        differenceType = 'SHORTAGE';
      }

      const cashCount = await prisma.cashCount.create({
        data: {
          cashSessionId: session.id,
          type: type as CashCountType,
          bills_10000: bills['10000'] || 0,
          bills_5000: bills['5000'] || 0,
          bills_2000: bills['2000'] || 0,
          bills_1000: bills['1000'] || 0,
          bills_500: bills['500'] || 0,
          bills_200: bills['200'] || 0,
          bills_100: bills['100'] || 0,
          bills_50: bills['50'] || 0,
          bills_20: bills['20'] || 0,
          bills_10: bills['10'] || 0,
          coins_500: coins['500'] || 0,
          coins_200: coins['200'] || 0,
          coins_100: coins['100'] || 0,
          coins_50: coins['50'] || 0,
          coins_25: coins['25'] || 0,
          coins_10: coins['10'] || 0,
          coins_5: coins['5'] || 0,
          coins_2: coins['2'] || 0,
          coins_1: coins['1'] || 0,
          totalBills: new Prisma.Decimal(totals.totalBills),
          totalCoins: new Prisma.Decimal(totals.totalCoins),
          totalCash: new Prisma.Decimal(totals.totalCash),
          expectedAmount: new Prisma.Decimal(expectedAmount),
          difference: new Prisma.Decimal(difference),
          differenceType,
          vouchers: new Prisma.Decimal(vouchers),
          checks: new Prisma.Decimal(checks),
          otherValues: new Prisma.Decimal(otherValues),
          otherValuesNote,
          notes,
          countedByUserId: req.user!.userId,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Arqueo registrado',
        data: {
          count: cashCount,
          summary: {
            ...totals,
            vouchers,
            checks,
            otherValues,
            totalWithOthers,
            expectedAmount,
            difference,
            differenceType,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cash/counts/:sessionId
 * Ver arqueos de un turno
 */
router.get(
  '/counts/:sessionId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const session = await prisma.cashSession.findFirst({
        where: {
          id: sessionId,
          tenantId: req.user!.tenantId,
        },
      });

      if (!session) {
        throw new NotFoundError('Sesión de caja');
      }

      // Verificar permiso: solo ver propios o tener permiso de ver todos
      if (session.userId !== req.user!.userId) {
        const hasPermission = req.user!.permissions?.includes('cash:view_all');
        if (!hasPermission) {
          throw new ApiError(403, 'No tienes permiso para ver arqueos de otros usuarios');
        }
      }

      const counts = await prisma.cashCount.findMany({
        where: { cashSessionId: sessionId },
        orderBy: { countedAt: 'desc' },
        include: {
          countedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });

      res.json({
        success: true,
        data: { counts, session },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==============================================
// RUTAS DE REPORTES
// ==============================================

/**
 * GET /api/cash/report/session/:id
 * Reporte de un turno específico
 */
router.get(
  '/report/session/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const session = await prisma.cashSession.findFirst({
        where: {
          id,
          tenantId: req.user!.tenantId,
        },
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
            include: {
              payments: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundError('Sesión de caja');
      }

      // Verificar permiso
      if (session.userId !== req.user!.userId) {
        const hasPermission = req.user!.permissions?.includes('cash:report_all');
        if (!hasPermission) {
          throw new ApiError(403, 'No tienes permiso para ver reportes de otros usuarios');
        }
      }

      res.json({
        success: true,
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cash/report/daily
 * Reporte diario de todas las cajas
 */
router.get(
  '/report/daily',
  authenticate,
  authorize('cash:report_all'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { date, branchId } = req.query;

      const targetDate = date ? new Date(date as string) : new Date();
      targetDate.setHours(0, 0, 0, 0);

      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const where: Prisma.CashSessionWhereInput = {
        tenantId: req.user!.tenantId,
        openedAt: {
          gte: targetDate,
          lt: nextDate,
        },
      };

      if (branchId) {
        where.branchId = branchId as string;
      }

      const sessions = await prisma.cashSession.findMany({
        where,
        include: {
          pointOfSale: true,
          branch: true,
          user: { select: { id: true, name: true } },
          _count: {
            select: { sales: true, movements: true },
          },
        },
        orderBy: { openedAt: 'asc' },
      });

      // Calcular totales
      const summary = {
        totalSessions: sessions.length,
        openSessions: sessions.filter((s) => s.status === 'OPEN').length,
        closedSessions: sessions.filter((s) => ['CLOSED', 'TRANSFERRED'].includes(s.status)).length,
        totalSales: 0,
        totalCash: 0,
        totalDebit: 0,
        totalCredit: 0,
        totalQr: 0,
        totalMpPoint: 0,
        totalTransfer: 0,
        totalOther: 0,
        totalWithdrawals: 0,
        totalDeposits: 0,
      };

      for (const session of sessions) {
        summary.totalSales += session._count.sales;
        summary.totalCash += Number(session.totalCash);
        summary.totalDebit += Number(session.totalDebit);
        summary.totalCredit += Number(session.totalCredit);
        summary.totalQr += Number(session.totalQr);
        summary.totalMpPoint += Number(session.totalMpPoint);
        summary.totalTransfer += Number(session.totalTransfer);
        summary.totalOther += Number(session.totalOther);
        summary.totalWithdrawals += Number(session.withdrawalsTotal);
        summary.totalDeposits += Number(session.depositsTotal);
      }

      res.json({
        success: true,
        data: {
          date: targetDate.toISOString().slice(0, 10),
          sessions,
          summary,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cash/sessions
 * Listar sesiones con filtros
 */
router.get(
  '/sessions',
  authenticate,
  authorize('cash:view_all'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        branchId,
        pointOfSaleId,
        userId,
        status,
        dateFrom,
        dateTo,
        page = '1',
        pageSize = '20',
      } = req.query;

      const where: Prisma.CashSessionWhereInput = {
        tenantId: req.user!.tenantId,
      };

      if (branchId) where.branchId = branchId as string;
      if (pointOfSaleId) where.pointOfSaleId = pointOfSaleId as string;
      if (userId) where.userId = userId as string;
      if (status) where.status = status as CashSessionStatus;

      if (dateFrom || dateTo) {
        where.openedAt = {};
        if (dateFrom) where.openedAt.gte = new Date(dateFrom as string);
        if (dateTo) where.openedAt.lte = new Date(dateTo as string);
      }

      const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
      const take = parseInt(pageSize as string);

      const [sessions, total] = await Promise.all([
        prisma.cashSession.findMany({
          where,
          include: {
            pointOfSale: true,
            branch: true,
            user: { select: { id: true, name: true, email: true } },
            _count: {
              select: { sales: true, movements: true, counts: true },
            },
          },
          orderBy: { openedAt: 'desc' },
          skip,
          take,
        }),
        prisma.cashSession.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            total,
            page: parseInt(page as string),
            pageSize: take,
            totalPages: Math.ceil(total / take),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
