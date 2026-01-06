/**
 * Rutas de Terminales de Tarjetas no integrados
 *
 * CRUD para gestionar terminales de tarjeta (Posnet, Lapos, Payway, etc.)
 * que no están integrados directamente con el sistema.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ApiError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// Terminales de sistema predefinidos
const SYSTEM_TERMINALS = [
  { name: 'Posnet', code: 'POSNET' },
  { name: 'Lapos', code: 'LAPOS' },
  { name: 'Payway', code: 'PAYWAY' },
  { name: 'Getnet', code: 'GETNET' },
  { name: 'Clover', code: 'CLOVER' },
  { name: 'NaranjaX', code: 'NARANJAX' },
  { name: 'Ualá', code: 'UALA' },
  { name: 'Viumi Macro', code: 'VIUMI' },
];

// Schema de validación para crear/editar terminal
const cardTerminalSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  isActive: z.boolean().optional().default(true),
  requiresAuthCode: z.boolean().optional().default(true),
  requiresVoucherNumber: z.boolean().optional().default(true),
  requiresCardBrand: z.boolean().optional().default(false),
  requiresLastFour: z.boolean().optional().default(false),
  requiresInstallments: z.boolean().optional().default(true),
  requiresBatchNumber: z.boolean().optional().default(true),
});

const updateCardTerminalSchema = cardTerminalSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ==============================================
// GET /api/card-terminals
// Listar terminales del tenant
// ==============================================
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { activeOnly } = req.query;

    const where: { tenantId: string; isActive?: boolean } = { tenantId };

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const terminals = await prisma.cardTerminal.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    res.json(terminals);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// GET /api/card-terminals/:id
// Obtener terminal por ID
// ==============================================
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const terminal = await prisma.cardTerminal.findFirst({
      where: { id, tenantId },
    });

    if (!terminal) {
      throw new NotFoundError('Terminal no encontrado');
    }

    res.json(terminal);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/card-terminals
// Crear terminal personalizado
// ==============================================
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const parseResult = cardTerminalSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que el código no exista ya para este tenant
    const existing = await prisma.cardTerminal.findFirst({
      where: { tenantId, code: data.code },
    });

    if (existing) {
      throw ApiError.conflict(`Ya existe un terminal con el código ${data.code}`);
    }

    const terminal = await prisma.cardTerminal.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        isActive: data.isActive,
        isSystem: false, // Los creados manualmente no son de sistema
        requiresAuthCode: data.requiresAuthCode,
        requiresVoucherNumber: data.requiresVoucherNumber,
        requiresCardBrand: data.requiresCardBrand,
        requiresLastFour: data.requiresLastFour,
        requiresInstallments: data.requiresInstallments,
        requiresBatchNumber: data.requiresBatchNumber,
      },
    });

    res.status(201).json(terminal);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PUT /api/card-terminals/:id
// Actualizar terminal
// ==============================================
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const parseResult = updateCardTerminalSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Datos inválidos', parseResult.error.errors);
    }

    const data = parseResult.data;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.cardTerminal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Terminal no encontrado');
    }

    // Si se está cambiando el código, verificar que no exista otro con ese código
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.cardTerminal.findFirst({
        where: { tenantId, code: data.code, id: { not: id } },
      });

      if (duplicate) {
        throw ApiError.conflict(`Ya existe un terminal con el código ${data.code}`);
      }
    }

    const terminal = await prisma.cardTerminal.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        isActive: data.isActive,
        requiresAuthCode: data.requiresAuthCode,
        requiresVoucherNumber: data.requiresVoucherNumber,
        requiresCardBrand: data.requiresCardBrand,
        requiresLastFour: data.requiresLastFour,
        requiresInstallments: data.requiresInstallments,
        requiresBatchNumber: data.requiresBatchNumber,
      },
    });

    res.json(terminal);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// PATCH /api/card-terminals/:id/toggle
// Activar/desactivar terminal
// ==============================================
router.patch('/:id/toggle', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.cardTerminal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Terminal no encontrado');
    }

    const terminal = await prisma.cardTerminal.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json(terminal);
  } catch (error) {
    next(error);
  }
});

// ==============================================
// DELETE /api/card-terminals/:id
// Eliminar terminal (solo no-sistema)
// ==============================================
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await prisma.cardTerminal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Terminal no encontrado');
    }

    if (existing.isSystem) {
      throw ApiError.badRequest('No se pueden eliminar terminales de sistema. Solo se pueden desactivar.');
    }

    // Verificar si hay pagos asociados
    const paymentsCount = await prisma.payment.count({
      where: { cardTerminalId: id },
    });

    if (paymentsCount > 0) {
      throw ApiError.badRequest(
        `No se puede eliminar el terminal porque tiene ${paymentsCount} pago(s) asociado(s). Puede desactivarlo en su lugar.`
      );
    }

    await prisma.cardTerminal.delete({
      where: { id },
    });

    res.json({ message: 'Terminal eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// POST /api/card-terminals/initialize
// Inicializar terminales de sistema para el tenant
// ==============================================
router.post('/initialize', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // Verificar qué terminales ya existen
    const existingTerminals = await prisma.cardTerminal.findMany({
      where: { tenantId },
      select: { code: true },
    });

    const existingCodes = new Set(existingTerminals.map((t) => t.code));

    const created: string[] = [];
    const skipped: string[] = [];

    for (const terminalData of SYSTEM_TERMINALS) {
      if (existingCodes.has(terminalData.code)) {
        skipped.push(terminalData.code);
        continue;
      }

      await prisma.cardTerminal.create({
        data: {
          tenantId,
          name: terminalData.name,
          code: terminalData.code,
          isActive: true,
          isSystem: true,
          requiresAuthCode: true,
          requiresVoucherNumber: true,
          requiresCardBrand: false,
          requiresLastFour: false,
          requiresInstallments: true,
          requiresBatchNumber: true,
        },
      });

      created.push(terminalData.code);
    }

    res.json({
      message: 'Inicialización completada',
      created,
      skipped,
      total: SYSTEM_TERMINALS.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
