import { z } from 'zod';

export const cashModeSchema = z.enum(['REQUIRED', 'OPTIONAL', 'AUTO']);
export const handoverModeSchema = z.enum(['CLOSE_OPEN', 'TRANSFER']);

export const createCashConfigSchema = z.object({
  pointOfSaleId: z.string().cuid(),
  cashMode: cashModeSchema.optional().default('REQUIRED'),
  handoverMode: handoverModeSchema.optional().default('CLOSE_OPEN'),
  currencies: z.array(z.string()).optional().default(['ARS']),
  defaultCurrency: z.string().optional().default('ARS'),
  requireCountOnClose: z.boolean().optional().default(true),
  requireCountOnOpen: z.boolean().optional().default(false),
  maxDifferenceAllowed: z.number().optional().default(0),
  allowPartialWithdrawal: z.boolean().optional().default(true),
  requireWithdrawalAuth: z.boolean().optional().default(false),
  denominations: z.record(z.object({
    bills: z.array(z.number()),
    coins: z.array(z.number()),
  })).optional().default({}),
});

export const updateCashConfigSchema = createCashConfigSchema.partial().omit({ pointOfSaleId: true });

export type CreateCashConfigInput = z.infer<typeof createCashConfigSchema>;
export type UpdateCashConfigInput = z.infer<typeof updateCashConfigSchema>;
