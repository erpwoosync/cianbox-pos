/**
 * Rutas de configuración de caja por punto de venta
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { updateCashConfigSchema } from '../schemas/cash-config.schema.js';
import prisma from '../lib/prisma.js';

const router = Router();

// Denominaciones por defecto para cada moneda
const DEFAULT_DENOMINATIONS: Record<string, { bills: number[]; coins: number[] }> = {
  ARS: {
    bills: [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10],
    coins: [500, 200, 100, 50, 25, 10, 5, 2, 1],
  },
  USD: {
    bills: [100, 50, 20, 10, 5, 2, 1],
    coins: [100, 50, 25, 10, 5, 1],
  },
  EUR: {
    bills: [500, 200, 100, 50, 20, 10, 5],
    coins: [200, 100, 50, 20, 10, 5, 2, 1],
  },
  BRL: {
    bills: [200, 100, 50, 20, 10, 5, 2],
    coins: [100, 50, 25, 10, 5, 1],
  },
};

// ==============================================
// GET /api/cash-config/pos/:posId
// Obtener configuración de caja para un POS
// ==============================================
router.get('/pos/:posId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { posId } = req.params;
    const tenantId = req.user!.tenantId;

    const config = await prisma.cashRegisterConfig.findFirst({
      where: {
        pointOfSaleId: posId,
        tenantId,
      },
    });

    if (!config) {
      // Retornar configuración por defecto si no existe
      return res.json({
        pointOfSaleId: posId,
        cashMode: 'REQUIRED',
        handoverMode: 'CLOSE_OPEN',
        currencies: ['ARS'],
        defaultCurrency: 'ARS',
        requireCountOnClose: true,
        requireCountOnOpen: false,
        maxDifferenceAllowed: 0,
        allowPartialWithdrawal: true,
        requireWithdrawalAuth: false,
        denominations: { ARS: DEFAULT_DENOMINATIONS.ARS },
        isDefault: true, // Indicador de que es config por defecto
      });
    }

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PUT /api/cash-config/pos/:posId
// Crear o actualizar configuración de caja
// ==============================================
router.put('/pos/:posId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { posId } = req.params;
    const tenantId = req.user!.tenantId;

    // Validar body
    const parseResult = updateCashConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }
    const data = parseResult.data;

    // Verificar que el POS pertenece al tenant
    const pos = await prisma.pointOfSale.findFirst({
      where: { id: posId, tenantId },
    });

    if (!pos) {
      throw new NotFoundError('Punto de venta no encontrado');
    }

    // Si currencies tiene valores, generar denominaciones por defecto para cada una
    let denominations = data.denominations;
    if (data.currencies && data.currencies.length > 0 && (!denominations || Object.keys(denominations).length === 0)) {
      denominations = {};
      for (const currency of data.currencies) {
        denominations[currency] = DEFAULT_DENOMINATIONS[currency] || DEFAULT_DENOMINATIONS.ARS;
      }
    }

    const config = await prisma.cashRegisterConfig.upsert({
      where: { pointOfSaleId: posId },
      create: {
        pointOfSaleId: posId,
        tenantId,
        cashMode: data.cashMode || 'REQUIRED',
        handoverMode: data.handoverMode || 'CLOSE_OPEN',
        currencies: data.currencies || ['ARS'],
        defaultCurrency: data.defaultCurrency || 'ARS',
        requireCountOnClose: data.requireCountOnClose ?? true,
        requireCountOnOpen: data.requireCountOnOpen ?? false,
        maxDifferenceAllowed: data.maxDifferenceAllowed || 0,
        allowPartialWithdrawal: data.allowPartialWithdrawal ?? true,
        requireWithdrawalAuth: data.requireWithdrawalAuth ?? false,
        denominations: denominations || {},
      },
      update: {
        ...data,
        denominations: denominations ?? undefined,
      },
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/cash-config/denominations/:currency
// Obtener denominaciones por defecto para una moneda
// ==============================================
router.get('/denominations/:currency', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { currency } = req.params;
    const upperCurrency = currency.toUpperCase();

    const denominations = DEFAULT_DENOMINATIONS[upperCurrency];
    if (!denominations) {
      throw new NotFoundError(`No hay denominaciones definidas para ${upperCurrency}`);
    }

    res.json({
      currency: upperCurrency,
      ...denominations,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/cash-config/currencies
// Listar monedas soportadas
// ==============================================
router.get('/currencies', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      currencies: Object.keys(DEFAULT_DENOMINATIONS),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
