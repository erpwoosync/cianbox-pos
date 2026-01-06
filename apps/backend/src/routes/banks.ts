/**
 * Banks - CRUD de bancos para promociones bancarias
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ApiError } from '../utils/errors.js';

const router = Router();

// Schemas de validación
const createBankSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().min(1, 'El código es requerido').toUpperCase(),
  isActive: z.boolean().optional().default(true),
});

const updateBankSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).toUpperCase().optional(),
  isActive: z.boolean().optional(),
});

// GET /banks - Listar bancos
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { activeOnly } = req.query;

    const where: { tenantId: string; isActive?: boolean } = { tenantId };
    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const banks = await prisma.bank.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(banks);
  } catch (error) {
    next(error);
  }
});

// GET /banks/:id - Obtener banco por ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const bank = await prisma.bank.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { promotions: true },
        },
      },
    });

    if (!bank) {
      throw new NotFoundError('Banco no encontrado');
    }

    res.json(bank);
  } catch (error) {
    next(error);
  }
});

// POST /banks - Crear banco
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = createBankSchema.parse(req.body);

    // Verificar código único
    const existing = await prisma.bank.findFirst({
      where: { tenantId, code: data.code },
    });

    if (existing) {
      throw ApiError.conflict(`Ya existe un banco con el código ${data.code}`);
    }

    const bank = await prisma.bank.create({
      data: {
        tenantId,
        ...data,
      },
    });

    res.status(201).json(bank);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: error.errors[0].message } });
    }
    next(error);
  }
});

// PUT /banks/:id - Actualizar banco
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = updateBankSchema.parse(req.body);

    // Verificar que existe
    const existing = await prisma.bank.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Banco no encontrado');
    }

    // Si cambia el código, verificar que no exista
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.bank.findFirst({
        where: { tenantId, code: data.code, NOT: { id } },
      });
      if (codeExists) {
        throw ApiError.conflict(`Ya existe un banco con el código ${data.code}`);
      }
    }

    const bank = await prisma.bank.update({
      where: { id },
      data,
    });

    res.json(bank);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: error.errors[0].message } });
    }
    next(error);
  }
});

// DELETE /banks/:id - Eliminar banco
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Verificar que existe
    const bank = await prisma.bank.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { promotions: true, payments: true },
        },
      },
    });

    if (!bank) {
      throw new NotFoundError('Banco no encontrado');
    }

    // Verificar que no tiene promociones o pagos asociados
    if (bank._count.promotions > 0) {
      throw ApiError.badRequest(
        `No se puede eliminar: tiene ${bank._count.promotions} promoción(es) asociada(s)`
      );
    }

    if (bank._count.payments > 0) {
      throw ApiError.badRequest(
        `No se puede eliminar: tiene ${bank._count.payments} pago(s) asociado(s)`
      );
    }

    await prisma.bank.delete({
      where: { id },
    });

    res.json({ message: 'Banco eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

// POST /banks/initialize - Inicializar bancos comunes
router.post('/initialize', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const systemBanks = [
      { name: 'Banco Macro', code: 'MACRO' },
      { name: 'Banco Galicia', code: 'GALICIA' },
      { name: 'Banco Santander', code: 'SANTANDER' },
      { name: 'Banco BBVA', code: 'BBVA' },
      { name: 'Banco Nación', code: 'NACION' },
      { name: 'Banco Provincia', code: 'PROVINCIA' },
      { name: 'Banco Ciudad', code: 'CIUDAD' },
      { name: 'Banco ICBC', code: 'ICBC' },
      { name: 'Banco HSBC', code: 'HSBC' },
      { name: 'Banco Patagonia', code: 'PATAGONIA' },
      { name: 'Banco Supervielle', code: 'SUPERVIELLE' },
      { name: 'Banco Comafi', code: 'COMAFI' },
      { name: 'Banco Credicoop', code: 'CREDICOOP' },
      { name: 'Banco Hipotecario', code: 'HIPOTECARIO' },
      { name: 'Otro Banco', code: 'OTRO' },
    ];

    const created: string[] = [];
    const existing: string[] = [];

    for (const bank of systemBanks) {
      const exists = await prisma.bank.findFirst({
        where: { tenantId, code: bank.code },
      });

      if (exists) {
        existing.push(bank.name);
      } else {
        await prisma.bank.create({
          data: {
            tenantId,
            ...bank,
          },
        });
        created.push(bank.name);
      }
    }

    res.json({
      message: 'Bancos inicializados',
      created,
      existing,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
