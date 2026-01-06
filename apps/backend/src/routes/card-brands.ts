/**
 * Rutas de Marcas de Tarjeta
 *
 * CRUD para gestionar marcas de tarjeta (Visa, Mastercard, Naranja, etc.)
 * para la liquidación de cupones.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ApiError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// Marcas de tarjeta del sistema predefinidas
const SYSTEM_CARD_BRANDS = [
  { name: 'Visa', code: 'VISA' },
  { name: 'Mastercard', code: 'MC' },
  { name: 'American Express', code: 'AMEX' },
  { name: 'Naranja', code: 'NARANJA' },
  { name: 'Cabal', code: 'CABAL' },
  { name: 'Maestro', code: 'MAESTRO' },
  { name: 'Tarjeta Shopping', code: 'SHOPPING' },
  { name: 'Tarjeta Nevada', code: 'NEVADA' },
  { name: 'Diners Club', code: 'DINERS' },
  { name: 'Argencard', code: 'ARGENCARD' },
  { name: 'Nativa', code: 'NATIVA' },
  { name: 'Tarjeta Sol', code: 'SOL' },
];

// Schema de validación para crear/editar marca
const cardBrandSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  isActive: z.boolean().optional().default(true),
});

const updateCardBrandSchema = cardBrandSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ==============================================
// GET /api/card-brands
// Listar marcas del tenant
// ==============================================
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { activeOnly } = req.query;

    const where: { tenantId: string; isActive?: boolean } = { tenantId };

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const brands = await prisma.cardBrand.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    res.json(brands);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/card-brands/:id
// Obtener marca por ID
// ==============================================
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const brand = await prisma.cardBrand.findFirst({
      where: { id, tenantId },
    });

    if (!brand) {
      throw new NotFoundError('Marca de tarjeta no encontrada');
    }

    res.json(brand);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/card-brands
// Crear marca personalizada
// ==============================================
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const parseResult = cardBrandSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que el código no exista ya para este tenant
    const existing = await prisma.cardBrand.findFirst({
      where: { tenantId, code: data.code },
    });

    if (existing) {
      throw ApiError.conflict(`Ya existe una marca con el código ${data.code}`);
    }

    const brand = await prisma.cardBrand.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        isActive: data.isActive,
        isSystem: false, // Las creadas manualmente no son de sistema
      },
    });

    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PUT /api/card-brands/:id
// Actualizar marca
// ==============================================
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const parseResult = updateCardBrandSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.cardBrand.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Marca de tarjeta no encontrada');
    }

    // Si se está cambiando el código, verificar que no exista otro con ese código
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.cardBrand.findFirst({
        where: { tenantId, code: data.code, id: { not: id } },
      });

      if (duplicate) {
        throw ApiError.conflict(`Ya existe una marca con el código ${data.code}`);
      }
    }

    const brand = await prisma.cardBrand.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        isActive: data.isActive,
      },
    });

    res.json(brand);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PATCH /api/card-brands/:id/toggle
// Activar/desactivar marca
// ==============================================
router.patch('/:id/toggle', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.cardBrand.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Marca de tarjeta no encontrada');
    }

    const brand = await prisma.cardBrand.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json(brand);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// DELETE /api/card-brands/:id
// Eliminar marca (solo no-sistema)
// ==============================================
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.cardBrand.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Marca de tarjeta no encontrada');
    }

    if (existing.isSystem) {
      throw ApiError.badRequest('No se pueden eliminar marcas de sistema. Solo se pueden desactivar.');
    }

    // Verificar si hay cupones asociados
    const vouchersCount = await prisma.cardVoucher.count({
      where: { cardBrandId: id },
    });

    if (vouchersCount > 0) {
      throw ApiError.badRequest(
        `No se puede eliminar la marca porque tiene ${vouchersCount} cupón(es) asociado(s). Puede desactivarla en su lugar.`
      );
    }

    await prisma.cardBrand.delete({
      where: { id },
    });

    res.json({ message: 'Marca de tarjeta eliminada correctamente' });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PUT /api/card-brands/:id/installments
// Configurar cuotas y recargos de una marca
// ==============================================
const installmentRateSchema = z.object({
  installment: z.number().int().min(1).max(24),
  rate: z.number().min(0).max(200), // 0% a 200%
});

const installmentsConfigSchema = z.object({
  maxInstallments: z.number().int().min(1).max(24),
  installmentRates: z.array(installmentRateSchema),
});

router.put('/:id/installments', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const parseResult = installmentsConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.cardBrand.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Marca de tarjeta no encontrada');
    }

    // Validar que las cuotas en los rates no excedan maxInstallments
    const invalidRates = data.installmentRates.filter((r) => r.installment > data.maxInstallments);
    if (invalidRates.length > 0) {
      throw ApiError.badRequest(
        `Las cuotas ${invalidRates.map((r) => r.installment).join(', ')} exceden el máximo de ${data.maxInstallments}`
      );
    }

    const brand = await prisma.cardBrand.update({
      where: { id },
      data: {
        maxInstallments: data.maxInstallments,
        installmentRates: data.installmentRates,
      },
    });

    res.json(brand);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/card-brands/initialize
// Inicializar marcas de sistema para el tenant
// ==============================================
router.post('/initialize', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // Verificar qué marcas ya existen
    const existingBrands = await prisma.cardBrand.findMany({
      where: { tenantId },
      select: { code: true },
    });

    const existingCodes = new Set(existingBrands.map((b) => b.code));

    const created: string[] = [];
    const skipped: string[] = [];

    for (const brandData of SYSTEM_CARD_BRANDS) {
      if (existingCodes.has(brandData.code)) {
        skipped.push(brandData.code);
        continue;
      }

      await prisma.cardBrand.create({
        data: {
          tenantId,
          name: brandData.name,
          code: brandData.code,
          isActive: true,
          isSystem: true,
        },
      });

      created.push(brandData.code);
    }

    res.json({
      message: 'Inicialización completada',
      created,
      skipped,
      total: SYSTEM_CARD_BRANDS.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
