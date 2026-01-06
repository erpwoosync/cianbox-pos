/**
 * BankPromotions - CRUD de promociones bancarias de cuotas
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ApiError } from '../utils/errors.js';

const router = Router();

// Schemas de validación
const createPromotionSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  bankId: z.string().min(1, 'El banco es requerido'),
  cardBrandId: z.string().min(1, 'La tarjeta es requerida'),
  interestFreeInstallments: z.array(z.number().int().min(1).max(24)).min(1, 'Seleccione al menos una cuota'),
  cashbackPercent: z.number().min(0).max(100).optional().nullable(),
  cashbackDescription: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
});

const updatePromotionSchema = createPromotionSchema.partial();

// GET /bank-promotions - Listar promociones
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { activeOnly, bankId, cardBrandId } = req.query;

    const where: {
      tenantId: string;
      isActive?: boolean;
      bankId?: string;
      cardBrandId?: string;
    } = { tenantId };

    if (activeOnly === 'true') {
      where.isActive = true;
    }
    if (bankId) {
      where.bankId = bankId as string;
    }
    if (cardBrandId) {
      where.cardBrandId = cardBrandId as string;
    }

    const promotions = await prisma.bankCardPromotion.findMany({
      where,
      include: {
        bank: { select: { id: true, name: true, code: true } },
        cardBrand: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });

    res.json(promotions);
  } catch (error) {
    next(error);
  }
});

// GET /bank-promotions/active - Obtener promociones vigentes (para POS)
router.get('/active', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Dom, 1=Lun... 6=Sáb

    const promotions = await prisma.bankCardPromotion.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
      },
      include: {
        bank: { select: { id: true, name: true, code: true } },
        cardBrand: {
          select: {
            id: true,
            name: true,
            code: true,
            maxInstallments: true,
            installmentRates: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });

    // Filtrar por fecha fin y día de la semana
    const activePromotions = promotions.filter((promo) => {
      // Verificar fecha fin
      if (promo.endDate && new Date(promo.endDate) < now) {
        return false;
      }
      // Verificar día de la semana (vacío = todos los días)
      if (promo.daysOfWeek.length > 0 && !promo.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
      return true;
    });

    res.json(activePromotions);
  } catch (error) {
    next(error);
  }
});

// GET /bank-promotions/:id - Obtener promoción por ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const promotion = await prisma.bankCardPromotion.findFirst({
      where: { id, tenantId },
      include: {
        bank: { select: { id: true, name: true, code: true } },
        cardBrand: { select: { id: true, name: true, code: true } },
      },
    });

    if (!promotion) {
      throw new NotFoundError('Promoción no encontrada');
    }

    res.json(promotion);
  } catch (error) {
    next(error);
  }
});

// POST /bank-promotions - Crear promoción
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = createPromotionSchema.parse(req.body);

    // Verificar que el banco existe
    const bank = await prisma.bank.findFirst({
      where: { id: data.bankId, tenantId },
    });
    if (!bank) {
      throw ApiError.badRequest('Banco no encontrado');
    }

    // Verificar que la tarjeta existe
    const cardBrand = await prisma.cardBrand.findFirst({
      where: { id: data.cardBrandId, tenantId },
    });
    if (!cardBrand) {
      throw ApiError.badRequest('Tarjeta no encontrada');
    }

    const promotion = await prisma.bankCardPromotion.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        bankId: data.bankId,
        cardBrandId: data.cardBrandId,
        interestFreeInstallments: data.interestFreeInstallments,
        cashbackPercent: data.cashbackPercent,
        cashbackDescription: data.cashbackDescription,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        daysOfWeek: data.daysOfWeek,
        isActive: data.isActive,
        priority: data.priority,
      },
      include: {
        bank: { select: { id: true, name: true, code: true } },
        cardBrand: { select: { id: true, name: true, code: true } },
      },
    });

    res.status(201).json(promotion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: error.errors[0].message } });
    }
    next(error);
  }
});

// PUT /bank-promotions/:id - Actualizar promoción
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = updatePromotionSchema.parse(req.body);

    // Verificar que existe
    const existing = await prisma.bankCardPromotion.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Promoción no encontrada');
    }

    // Verificar banco si se cambia
    if (data.bankId) {
      const bank = await prisma.bank.findFirst({
        where: { id: data.bankId, tenantId },
      });
      if (!bank) {
        throw ApiError.badRequest('Banco no encontrado');
      }
    }

    // Verificar tarjeta si se cambia
    if (data.cardBrandId) {
      const cardBrand = await prisma.cardBrand.findFirst({
        where: { id: data.cardBrandId, tenantId },
      });
      if (!cardBrand) {
        throw ApiError.badRequest('Tarjeta no encontrada');
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    const promotion = await prisma.bankCardPromotion.update({
      where: { id },
      data: updateData,
      include: {
        bank: { select: { id: true, name: true, code: true } },
        cardBrand: { select: { id: true, name: true, code: true } },
      },
    });

    res.json(promotion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: error.errors[0].message } });
    }
    next(error);
  }
});

// DELETE /bank-promotions/:id - Eliminar promoción
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que existe
    const promotion = await prisma.bankCardPromotion.findFirst({
      where: { id, tenantId },
    });

    if (!promotion) {
      throw new NotFoundError('Promoción no encontrada');
    }

    await prisma.bankCardPromotion.delete({
      where: { id },
    });

    res.json({ message: 'Promoción eliminada correctamente' });
  } catch (error) {
    next(error);
  }
});

// PATCH /bank-promotions/:id/toggle - Activar/Desactivar promoción
router.patch('/:id/toggle', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const promotion = await prisma.bankCardPromotion.findFirst({
      where: { id, tenantId },
    });

    if (!promotion) {
      throw new NotFoundError('Promoción no encontrada');
    }

    const updated = await prisma.bankCardPromotion.update({
      where: { id },
      data: { isActive: !promotion.isActive },
      include: {
        bank: { select: { id: true, name: true, code: true } },
        cardBrand: { select: { id: true, name: true, code: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
