/**
 * Schemas de validación para Store Credits (Vales de Crédito)
 */

import { z } from 'zod';

// Schema para crear un vale manualmente (desde backoffice)
export const createStoreCreditSchema = z.object({
  amount: z.number().positive('El monto debe ser positivo'),
  customerId: z.string().optional(),
  expiresAt: z.string().optional(), // ISO date string
  notes: z.string().optional(),
});

// Schema para consultar saldo de vale
export const checkStoreCreditSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
});

// Schema para usar/canjear un vale
export const redeemStoreCreditSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  amount: z.number().positive('El monto debe ser positivo'),
  saleId: z.string().min(1, 'El ID de venta es requerido'),
});

// Schema para cancelar un vale
export const cancelStoreCreditSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  reason: z.string().min(1, 'Debe indicar el motivo de la cancelación'),
});

// Schema para listar vales
export const listStoreCreditsSchema = z.object({
  status: z.enum(['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED']).optional(),
  customerId: z.string().optional(),
  branchId: z.string().optional(),
  limit: z.string().default('50'),
  offset: z.string().default('0'),
});

export type CreateStoreCreditInput = z.infer<typeof createStoreCreditSchema>;
export type CheckStoreCreditInput = z.infer<typeof checkStoreCreditSchema>;
export type RedeemStoreCreditInput = z.infer<typeof redeemStoreCreditSchema>;
export type CancelStoreCreditInput = z.infer<typeof cancelStoreCreditSchema>;
export type ListStoreCreditsInput = z.infer<typeof listStoreCreditsSchema>;
