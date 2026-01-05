/**
 * Rutas de Store Credits (Vales de Crédito)
 * API para gestión de vales generados en devoluciones
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import {
  createStoreCreditSchema,
  checkStoreCreditSchema,
  redeemStoreCreditSchema,
  cancelStoreCreditSchema,
  listStoreCreditsSchema,
} from '../schemas/store-credit.schema.js';
import StoreCreditService from '../services/store-credit.service.js';
import { StoreCreditStatus } from '@prisma/client';

const router = Router();

// ==============================================
// POST /api/store-credits
// Crear nuevo vale (desde backoffice)
// ==============================================
router.post(
  '/',
  authenticate,
  authorize('storecredits:create', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = createStoreCreditSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { amount, customerId, expiresAt, notes } = parseResult.data;

    const storeCredit = await StoreCreditService.createStoreCredit({
      tenantId: req.user!.tenantId,
      amount,
      customerId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      issuedByUserId: req.user!.userId,
      branchId: req.user!.branchId || undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Vale de crédito creado',
      storeCredit: {
        id: storeCredit.id,
        code: storeCredit.code,
        barcode: storeCredit.barcode,
        originalAmount: Number(storeCredit.originalAmount),
        currentBalance: Number(storeCredit.currentBalance),
        status: storeCredit.status,
        expiresAt: storeCredit.expiresAt,
        customer: storeCredit.customer,
        branch: storeCredit.branch,
        issuedBy: storeCredit.issuedBy,
        createdAt: storeCredit.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/store-credits/balance
// Consultar saldo de un vale (POS y Backoffice)
// ==============================================
router.post(
  '/balance',
  authenticate,
  authorize('pos:sell', 'storecredits:view', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = checkStoreCreditSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code } = parseResult.data;

    const result = await StoreCreditService.checkBalance({
      tenantId: req.user!.tenantId,
      code,
    });

    // Determinar si es válido para uso
    const isValid = result.status === 'ACTIVE' && !result.isExpired && Number(result.currentBalance) > 0;

    res.json({
      success: true,
      data: {
        code: result.code,
        originalAmount: Number(result.originalAmount),
        balance: Number(result.currentBalance),
        currentBalance: Number(result.currentBalance),
        status: result.status,
        expiresAt: result.expiresAt,
        issuedAt: result.issuedAt,
        isExpired: result.isExpired,
        isValid,
        customer: result.customer,
        branch: result.branch,
        message: !isValid
          ? (result.status !== 'ACTIVE'
            ? `Vale no activo (${result.status})`
            : result.isExpired
              ? 'Vale vencido'
              : 'Sin saldo')
          : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/store-credits/:code
// Obtener vale por código (alternativa GET)
// ==============================================
router.get(
  '/code/:code',
  authenticate,
  authorize('pos:sell', 'storecredits:view', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await StoreCreditService.checkBalance({
      tenantId: req.user!.tenantId,
      code: req.params.code,
    });

    const isValid = result.status === 'ACTIVE' && !result.isExpired && Number(result.currentBalance) > 0;

    res.json({
      success: true,
      data: {
        id: result.id,
        code: result.code,
        barcode: result.barcode,
        originalAmount: Number(result.originalAmount),
        currentBalance: Number(result.currentBalance),
        status: result.status,
        expiresAt: result.expiresAt,
        issuedAt: result.issuedAt,
        isExpired: result.isExpired,
        isValid,
        customer: result.customer,
        branch: result.branch,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/store-credits/redeem
// Canjear saldo de un vale (usado al registrar venta)
// ==============================================
router.post(
  '/redeem',
  authenticate,
  authorize('pos:sell', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = redeemStoreCreditSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code, amount, saleId } = parseResult.data;

    const result = await StoreCreditService.redeemStoreCredit({
      tenantId: req.user!.tenantId,
      code,
      amount,
      saleId,
      userId: req.user!.userId,
    });

    res.json({
      success: true,
      message: `Canjeados $${amount}`,
      amountRedeemed: result.amountRedeemed,
      remainingBalance: result.remainingBalance,
      storeCredit: {
        id: result.storeCredit.id,
        code: result.storeCredit.code,
        currentBalance: Number(result.storeCredit.currentBalance),
        status: result.storeCredit.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/store-credits/cancel
// Cancelar un vale (backoffice)
// ==============================================
router.post(
  '/cancel',
  authenticate,
  authorize('storecredits:cancel', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = cancelStoreCreditSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code, reason } = parseResult.data;

    const storeCredit = await StoreCreditService.cancelStoreCredit({
      tenantId: req.user!.tenantId,
      code,
      userId: req.user!.userId,
      reason,
    });

    res.json({
      success: true,
      message: 'Vale cancelado',
      storeCredit: {
        id: storeCredit.id,
        code: storeCredit.code,
        status: storeCredit.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/store-credits
// Listar vales (backoffice)
// ==============================================
router.get(
  '/',
  authenticate,
  authorize('storecredits:view', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = listStoreCreditsSchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new ValidationError('Parámetros inválidos', parseResult.error.errors);
    }

    const { status, customerId, branchId, limit, offset } = parseResult.data;

    const result = await StoreCreditService.listStoreCredits(req.user!.tenantId, {
      status: status as StoreCreditStatus | undefined,
      customerId,
      branchId,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/store-credits/:id/transactions
// Historial de transacciones de un vale
// ==============================================
router.get(
  '/:id/transactions',
  authenticate,
  authorize('storecredits:view', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await StoreCreditService.getTransactions(req.user!.tenantId, id);

    res.json({
      success: true,
      storeCredit: result.storeCredit,
      transactions: result.transactions,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/store-credits/customer/:customerId
// Obtener vales activos de un cliente (para POS)
// ==============================================
router.get(
  '/customer/:customerId',
  authenticate,
  authorize('pos:sell', 'storecredits:view', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;

    const credits = await StoreCreditService.getCustomerActiveCredits(
      req.user!.tenantId,
      customerId
    );

    // Calcular total disponible
    const totalAvailable = credits.reduce(
      (sum, c) => sum + Number(c.currentBalance),
      0
    );

    res.json({
      success: true,
      credits: credits.map(c => ({
        id: c.id,
        code: c.code,
        currentBalance: Number(c.currentBalance),
        expiresAt: c.expiresAt,
      })),
      totalAvailable,
      count: credits.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
