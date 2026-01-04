import { z } from 'zod';

// Schemas de validación para Tesorería

export const treasuryStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'PARTIAL', 'REJECTED']);

// Crear retiro pendiente (desde el POS)
export const createTreasuryPendingSchema = z.object({
  cashMovementId: z.string().cuid(), // Movimiento de retiro original
  expectedAmount: z.number().positive(),
  currency: z.string().default('ARS'),
  notes: z.string().optional(),
});

// Confirmar recepción de retiro (supervisor/tesorero)
export const confirmTreasuryPendingSchema = z.object({
  receivedAmount: z.number().nonnegative(),
  notes: z.string().optional(),
});

// Rechazar retiro pendiente
export const rejectTreasuryPendingSchema = z.object({
  reason: z.string().min(5, 'Debe indicar una razón'),
});

// Filtros para listar retiros pendientes
export const listTreasuryPendingSchema = z.object({
  status: treasuryStatusSchema.optional(),
  currency: z.string().optional(),
  branchId: z.string().cuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

export type CreateTreasuryPendingInput = z.infer<typeof createTreasuryPendingSchema>;
export type ConfirmTreasuryPendingInput = z.infer<typeof confirmTreasuryPendingSchema>;
export type RejectTreasuryPendingInput = z.infer<typeof rejectTreasuryPendingSchema>;
export type ListTreasuryPendingInput = z.infer<typeof listTreasuryPendingSchema>;
