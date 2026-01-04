/**
 * Rutas de Gift Cards
 * API para gestión de tarjetas de regalo
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import {
  generateGiftCardsSchema,
  activateGiftCardSchema,
  redeemGiftCardSchema,
  checkBalanceSchema,
  cancelGiftCardSchema,
} from '../schemas/gift-card.schema.js';
import GiftCardService from '../services/gift-card.service.js';
import { GiftCardStatus } from '@prisma/client';

const router = Router();

// ==============================================
// POST /api/gift-cards/generate
// Genera nuevas gift cards (backoffice)
// ==============================================
router.post('/generate', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = generateGiftCardsSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { quantity, amount, currency, expiresAt } = parseResult.data;

    const giftCards = await GiftCardService.generateGiftCards({
      tenantId: req.user!.tenantId,
      quantity,
      amount,
      currency,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      generatedById: req.user!.userId,
    });

    res.status(201).json({
      success: true,
      message: `${giftCards.length} gift cards generadas`,
      giftCards,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/gift-cards/activate
// Activa una gift card (al venderla)
// ==============================================
router.post('/activate', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = activateGiftCardSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code, saleId } = parseResult.data;

    const giftCard = await GiftCardService.activateGiftCard({
      tenantId: req.user!.tenantId,
      code,
      userId: req.user!.userId,
      saleId,
    });

    res.json({
      success: true,
      message: 'Gift card activada',
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        amount: Number(giftCard.initialAmount),
        currency: giftCard.currency,
        status: giftCard.status,
        expiresAt: giftCard.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/gift-cards/redeem
// Canjea saldo de una gift card
// ==============================================
router.post('/redeem', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = redeemGiftCardSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code, amount, saleId } = parseResult.data;

    const result = await GiftCardService.redeemGiftCard({
      tenantId: req.user!.tenantId,
      code,
      amount,
      saleId,
      userId: req.user!.userId,
    });

    res.json({
      success: true,
      message: `Canjeados ${amount} ${result.giftCard.currency}`,
      amountRedeemed: result.amountRedeemed,
      remainingBalance: result.remainingBalance,
      giftCard: {
        id: result.giftCard.id,
        code: result.giftCard.code,
        currentBalance: Number(result.giftCard.currentBalance),
        currency: result.giftCard.currency,
        status: result.giftCard.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/gift-cards/balance
// Consulta saldo de una gift card
// ==============================================
router.post('/balance', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = checkBalanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code } = parseResult.data;

    const result = await GiftCardService.checkBalance({
      tenantId: req.user!.tenantId,
      code,
    });

    res.json({
      success: true,
      giftCard: {
        code: result.code,
        initialAmount: Number(result.initialAmount),
        currentBalance: Number(result.currentBalance),
        currency: result.currency,
        status: result.status,
        expiresAt: result.expiresAt,
        activatedAt: result.activatedAt,
        isExpired: result.isExpired,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/gift-cards/cancel
// Cancela una gift card
// ==============================================
router.post('/cancel', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = cancelGiftCardSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const { code, reason } = parseResult.data;

    const giftCard = await GiftCardService.cancelGiftCard({
      tenantId: req.user!.tenantId,
      code,
      userId: req.user!.userId,
      reason,
    });

    res.json({
      success: true,
      message: 'Gift card cancelada',
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        status: giftCard.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/gift-cards
// Lista gift cards (backoffice)
// ==============================================
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, currency, limit, offset } = req.query;

    const result = await GiftCardService.listGiftCards(req.user!.tenantId, {
      status: status as GiftCardStatus | undefined,
      currency: currency as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
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
// GET /api/gift-cards/:id/transactions
// Historial de transacciones de una gift card
// ==============================================
router.get('/:id/transactions', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await GiftCardService.getGiftCardTransactions(req.user!.tenantId, id);

    res.json({
      success: true,
      giftCard: {
        id: result.giftCard.id,
        code: result.giftCard.code,
        initialAmount: Number(result.giftCard.initialAmount),
        currentBalance: Number(result.giftCard.currentBalance),
        currency: result.giftCard.currency,
        status: result.giftCard.status,
      },
      transactions: result.transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        balanceAfter: Number(tx.balanceAfter),
        notes: tx.notes,
        user: tx.user,
        sale: tx.sale,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
