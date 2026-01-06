/**
 * Rutas de Liquidación de Cupones de Tarjeta
 *
 * Gestión de cupones de tarjeta (desde terminales y Mercado Pago Point)
 * y su liquidación (matching con depósitos bancarios).
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ApiError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// ==============================================
// CUPONES (VOUCHERS)
// ==============================================

// ==============================================
// GET /api/voucher-settlements/vouchers
// Listar cupones de tarjeta con filtros
// ==============================================
router.get('/vouchers', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, source, cardTerminalId, cardBrandId, dateFrom, dateTo, page = '1', limit = '50' } = req.query;

    const where: {
      tenantId: string;
      status?: 'PENDING' | 'SETTLED';
      source?: 'CARD_TERMINAL' | 'MERCADO_PAGO';
      cardTerminalId?: string;
      cardBrandId?: string;
      saleDate?: { gte?: Date; lte?: Date };
    } = { tenantId };

    if (status === 'PENDING' || status === 'SETTLED') {
      where.status = status;
    }

    if (source === 'CARD_TERMINAL' || source === 'MERCADO_PAGO') {
      where.source = source;
    }

    if (cardTerminalId && typeof cardTerminalId === 'string') {
      where.cardTerminalId = cardTerminalId;
    }

    if (cardBrandId && typeof cardBrandId === 'string') {
      where.cardBrandId = cardBrandId;
    }

    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom && typeof dateFrom === 'string') {
        where.saleDate.gte = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === 'string') {
        where.saleDate.lte = new Date(dateTo);
      }
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 200);
    const skip = (pageNum - 1) * limitNum;

    const [vouchers, total] = await Promise.all([
      prisma.cardVoucher.findMany({
        where,
        include: {
          cardTerminal: {
            select: { id: true, name: true, code: true },
          },
          cardBrand: {
            select: { id: true, name: true, code: true },
          },
          payment: {
            select: {
              id: true,
              method: true,
              sale: {
                select: { id: true, saleNumber: true, saleDate: true },
              },
            },
          },
          settlement: {
            select: { id: true, settlementDate: true },
          },
        },
        orderBy: { saleDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.cardVoucher.count({ where }),
    ]);

    // Calcular totales para cupones pendientes
    const pendingTotals = await prisma.cardVoucher.aggregate({
      where: { ...where, status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    });

    res.json({
      vouchers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        pendingCount: pendingTotals._count,
        pendingAmount: pendingTotals._sum.amount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/voucher-settlements/vouchers/:id
// Obtener cupón por ID
// ==============================================
router.get('/vouchers/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const voucher = await prisma.cardVoucher.findFirst({
      where: { id, tenantId },
      include: {
        cardTerminal: true,
        cardBrand: true,
        payment: {
          include: {
            sale: {
              include: {
                pointOfSale: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        settlement: {
          include: {
            bankAccount: true,
          },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundError('Cupón no encontrado');
    }

    res.json(voucher);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// LIQUIDACIONES (SETTLEMENTS)
// ==============================================

// Schema de validación para crear liquidación
const createSettlementSchema = z.object({
  voucherIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un cupón'),
  settlementDate: z.string().transform((str) => new Date(str)),
  bankAccountId: z.string().min(1, 'Debe seleccionar una cuenta bancaria'),
  grossAmount: z.number().positive('El monto bruto debe ser positivo'),
  commissionAmount: z.number().min(0, 'La comisión no puede ser negativa'),
  withholdingAmount: z.number().min(0, 'Las retenciones no pueden ser negativas'),
  notes: z.string().max(500).optional(),
});

// ==============================================
// POST /api/voucher-settlements
// Crear liquidación de cupones
// ==============================================
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const parseResult = createSettlementSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que la cuenta bancaria existe y pertenece al tenant
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: data.bankAccountId, tenantId },
    });

    if (!bankAccount) {
      throw new NotFoundError('Cuenta bancaria no encontrada');
    }

    // Verificar que todos los cupones existen, pertenecen al tenant y están pendientes
    const vouchers = await prisma.cardVoucher.findMany({
      where: {
        id: { in: data.voucherIds },
        tenantId,
        status: 'PENDING',
      },
    });

    if (vouchers.length !== data.voucherIds.length) {
      const foundIds = new Set(vouchers.map((v) => v.id));
      const missingOrSettled = data.voucherIds.filter((id) => !foundIds.has(id));
      throw ApiError.badRequest(
        `Algunos cupones no existen o ya fueron liquidados: ${missingOrSettled.join(', ')}`
      );
    }

    // Calcular monto neto
    const netAmount = data.grossAmount - data.commissionAmount - data.withholdingAmount;

    if (netAmount < 0) {
      throw ApiError.badRequest('El monto neto no puede ser negativo');
    }

    // Crear liquidación en transacción
    const settlement = await prisma.$transaction(async (tx) => {
      // Crear la liquidación
      const newSettlement = await tx.voucherSettlement.create({
        data: {
          tenantId,
          settlementDate: data.settlementDate,
          bankAccountId: data.bankAccountId,
          grossAmount: new Decimal(data.grossAmount),
          commissionAmount: new Decimal(data.commissionAmount),
          withholdingAmount: new Decimal(data.withholdingAmount),
          netAmount: new Decimal(netAmount),
          notes: data.notes,
        },
      });

      // Actualizar todos los cupones
      await tx.cardVoucher.updateMany({
        where: { id: { in: data.voucherIds } },
        data: {
          status: 'SETTLED',
          settlementId: newSettlement.id,
        },
      });

      return newSettlement;
    });

    // Obtener la liquidación con relaciones
    const fullSettlement = await prisma.voucherSettlement.findUnique({
      where: { id: settlement.id },
      include: {
        bankAccount: true,
        vouchers: {
          include: {
            cardBrand: { select: { id: true, name: true } },
            cardTerminal: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.status(201).json(fullSettlement);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/voucher-settlements
// Listar liquidaciones
// ==============================================
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { bankAccountId, dateFrom, dateTo, page = '1', limit = '20' } = req.query;

    const where: {
      tenantId: string;
      bankAccountId?: string;
      settlementDate?: { gte?: Date; lte?: Date };
    } = { tenantId };

    if (bankAccountId && typeof bankAccountId === 'string') {
      where.bankAccountId = bankAccountId;
    }

    if (dateFrom || dateTo) {
      where.settlementDate = {};
      if (dateFrom && typeof dateFrom === 'string') {
        where.settlementDate.gte = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === 'string') {
        where.settlementDate.lte = new Date(dateTo);
      }
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const [settlements, total] = await Promise.all([
      prisma.voucherSettlement.findMany({
        where,
        include: {
          bankAccount: {
            select: { id: true, name: true, bankName: true },
          },
          _count: {
            select: { vouchers: true },
          },
        },
        orderBy: { settlementDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.voucherSettlement.count({ where }),
    ]);

    res.json({
      settlements,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/voucher-settlements/:id
// Obtener liquidación por ID
// ==============================================
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const settlement = await prisma.voucherSettlement.findFirst({
      where: { id, tenantId },
      include: {
        bankAccount: true,
        vouchers: {
          include: {
            cardBrand: { select: { id: true, name: true, code: true } },
            cardTerminal: { select: { id: true, name: true, code: true } },
            payment: {
              select: {
                id: true,
                method: true,
                sale: {
                  select: { id: true, saleNumber: true, saleDate: true },
                },
              },
            },
          },
          orderBy: { saleDate: 'asc' },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundError('Liquidación no encontrada');
    }

    res.json(settlement);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// DELETE /api/voucher-settlements/:id
// Eliminar liquidación (revierte estado de cupones)
// ==============================================
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.voucherSettlement.findFirst({
      where: { id, tenantId },
      include: { vouchers: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundError('Liquidación no encontrada');
    }

    // Eliminar liquidación y revertir estado de cupones en transacción
    await prisma.$transaction(async (tx) => {
      // Revertir cupones a PENDING
      await tx.cardVoucher.updateMany({
        where: { settlementId: id },
        data: {
          status: 'PENDING',
          settlementId: null,
        },
      });

      // Eliminar la liquidación
      await tx.voucherSettlement.delete({
        where: { id },
      });
    });

    res.json({
      message: 'Liquidación eliminada correctamente',
      vouchersReverted: existing.vouchers.length,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/voucher-settlements/stats
// Estadísticas de cupones
// ==============================================
router.get('/stats/summary', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const [pendingStats, settledStats, recentSettlements] = await Promise.all([
      // Estadísticas de cupones pendientes
      prisma.cardVoucher.aggregate({
        where: { tenantId, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      // Estadísticas de cupones liquidados (último mes)
      prisma.cardVoucher.aggregate({
        where: {
          tenantId,
          status: 'SETTLED',
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Últimas 5 liquidaciones
      prisma.voucherSettlement.findMany({
        where: { tenantId },
        include: {
          bankAccount: { select: { name: true, bankName: true } },
          _count: { select: { vouchers: true } },
        },
        orderBy: { settlementDate: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      pending: {
        count: pendingStats._count,
        amount: pendingStats._sum.amount || 0,
      },
      settledLastMonth: {
        count: settledStats._count,
        amount: settledStats._sum.amount || 0,
      },
      recentSettlements,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
