/**
 * Rutas de Cuentas Bancarias
 *
 * CRUD para gestionar cuentas bancarias para liquidación de cupones
 * y movimientos de tesorería.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ApiError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// Schema de validación para crear/editar cuenta bancaria
const bankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  bankName: z.string().min(1, 'El banco es requerido').max(100),
  accountNumber: z.string().max(50).optional().nullable(),
  cbu: z
    .string()
    .max(22)
    .regex(/^[0-9]*$/, 'El CBU solo puede contener números')
    .optional()
    .nullable(),
  alias: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateBankAccountSchema = bankAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ==============================================
// GET /api/bank-accounts
// Listar cuentas bancarias del tenant
// ==============================================
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { activeOnly } = req.query;

    const where: { tenantId: string; isActive?: boolean } = { tenantId };

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const accounts = await prisma.bankAccount.findMany({
      where,
      orderBy: [{ bankName: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { settlements: true },
        },
      },
    });

    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/bank-accounts/:id
// Obtener cuenta bancaria por ID
// ==============================================
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const account = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { settlements: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Cuenta bancaria no encontrada');
    }

    res.json(account);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/bank-accounts
// Crear cuenta bancaria
// ==============================================
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const parseResult = bankAccountSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar CBU único si se proporciona
    if (data.cbu) {
      const existingCbu = await prisma.bankAccount.findFirst({
        where: { tenantId, cbu: data.cbu },
      });

      if (existingCbu) {
        throw ApiError.conflict(`Ya existe una cuenta con el CBU ${data.cbu}`);
      }
    }

    const account = await prisma.bankAccount.create({
      data: {
        tenantId,
        name: data.name,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        cbu: data.cbu,
        alias: data.alias,
        isActive: data.isActive,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PUT /api/bank-accounts/:id
// Actualizar cuenta bancaria
// ==============================================
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const parseResult = updateBankAccountSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Cuenta bancaria no encontrada');
    }

    // Si se está cambiando el CBU, verificar que no exista otro con ese CBU
    if (data.cbu && data.cbu !== existing.cbu) {
      const duplicate = await prisma.bankAccount.findFirst({
        where: { tenantId, cbu: data.cbu, id: { not: id } },
      });

      if (duplicate) {
        throw ApiError.conflict(`Ya existe una cuenta con el CBU ${data.cbu}`);
      }
    }

    const account = await prisma.bankAccount.update({
      where: { id },
      data: {
        name: data.name,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        cbu: data.cbu,
        alias: data.alias,
        isActive: data.isActive,
      },
    });

    res.json(account);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PATCH /api/bank-accounts/:id/toggle
// Activar/desactivar cuenta bancaria
// ==============================================
router.patch('/:id/toggle', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Cuenta bancaria no encontrada');
    }

    const account = await prisma.bankAccount.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json(account);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// DELETE /api/bank-accounts/:id
// Eliminar cuenta bancaria
// ==============================================
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Cuenta bancaria no encontrada');
    }

    // Verificar si hay liquidaciones asociadas
    const settlementsCount = await prisma.voucherSettlement.count({
      where: { bankAccountId: id },
    });

    if (settlementsCount > 0) {
      throw ApiError.badRequest(
        `No se puede eliminar la cuenta porque tiene ${settlementsCount} liquidación(es) asociada(s). Puede desactivarla en su lugar.`
      );
    }

    await prisma.bankAccount.delete({
      where: { id },
    });

    res.json({ message: 'Cuenta bancaria eliminada correctamente' });
  } catch (error) {
    next(error);
  }
});

export default router;
