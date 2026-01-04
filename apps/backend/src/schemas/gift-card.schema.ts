import { z } from 'zod';

// Schemas de validación para Gift Cards

export const giftCardStatusSchema = z.enum(['INACTIVE', 'ACTIVE', 'DEPLETED', 'EXPIRED', 'CANCELLED']);

export const generateGiftCardsSchema = z.object({
  quantity: z.number().int().min(1).max(100),
  amount: z.number().positive(),
  currency: z.string().default('ARS'),
  expiresAt: z.string().datetime().optional(),
});

export const activateGiftCardSchema = z.object({
  code: z.string().min(8).max(20),
  saleId: z.string().cuid().optional(), // Venta donde se vendió la gift card
});

export const redeemGiftCardSchema = z.object({
  code: z.string().min(8).max(20),
  amount: z.number().positive(),
  saleId: z.string().cuid(), // Venta donde se usa la gift card
});

export const checkBalanceSchema = z.object({
  code: z.string().min(8).max(20),
});

export const cancelGiftCardSchema = z.object({
  code: z.string().min(8).max(20),
  reason: z.string().optional(),
});

export type GenerateGiftCardsInput = z.infer<typeof generateGiftCardsSchema>;
export type ActivateGiftCardInput = z.infer<typeof activateGiftCardSchema>;
export type RedeemGiftCardInput = z.infer<typeof redeemGiftCardSchema>;
export type CheckBalanceInput = z.infer<typeof checkBalanceSchema>;
export type CancelGiftCardInput = z.infer<typeof cancelGiftCardSchema>;
