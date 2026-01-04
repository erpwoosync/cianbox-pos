import { z } from 'zod';

// ==============================================
// SCHEMAS DE VALIDACIÓN PARA CAJA MULTI-MONEDA
// ==============================================

// Montos por moneda { "ARS": 5000, "USD": 100 }
export const currencyAmountsSchema = z.record(z.string(), z.number().min(0));

// Conteo por denominación { "10000": 2, "5000": 5 }
export const denominationCountSchema = z.record(z.string(), z.number().int().min(0));

// Apertura de turno multi-moneda
export const openSessionMultiCurrencySchema = z.object({
  pointOfSaleId: z.string().cuid(),
  openingAmounts: currencyAmountsSchema, // { "ARS": 5000, "USD": 100 }
  defaultCurrency: z.string().default('ARS'),
  notes: z.string().optional(),
});

// Conteo de caja por moneda
export const currencyCountSchema = z.object({
  currency: z.string(),
  denominationCounts: denominationCountSchema.optional(), // { "10000": 2, "5000": 5 }
  totalAmount: z.number().min(0),
});

// Cierre de turno multi-moneda
export const closeSessionMultiCurrencySchema = z.object({
  closingAmounts: currencyAmountsSchema, // Monto final por moneda
  counts: z.array(currencyCountSchema).optional(), // Conteos detallados por moneda
  notes: z.string().optional(),
});

// Movimiento multi-moneda
export const movementMultiCurrencySchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CHANGE_FUND']),
  amount: z.number().positive(),
  currency: z.string().default('ARS'),
  reason: z.enum([
    'SAFE_DEPOSIT',
    'BANK_DEPOSIT',
    'SUPPLIER_PAYMENT',
    'EXPENSE',
    'CHANGE_FUND',
    'INITIAL_FUND',
    'LOAN_RETURN',
    'CORRECTION',
    'COUNT_DIFFERENCE',
    'OTHER',
  ]),
  description: z.string().optional(),
  reference: z.string().optional(),
  destinationType: z.string().optional(),
  authorizedByUserId: z.string().optional(),
  // Para retiros que crean TreasuryPending
  createTreasuryPending: z.boolean().default(false),
});

// Arqueo multi-moneda
export const countMultiCurrencySchema = z.object({
  type: z.enum(['OPENING', 'PARTIAL', 'CLOSING', 'AUDIT', 'TRANSFER']).default('PARTIAL'),
  currency: z.string().default('ARS'),
  denominationCounts: denominationCountSchema.optional(),
  totalAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type OpenSessionMultiCurrencyInput = z.infer<typeof openSessionMultiCurrencySchema>;
export type CloseSessionMultiCurrencyInput = z.infer<typeof closeSessionMultiCurrencySchema>;
export type MovementMultiCurrencyInput = z.infer<typeof movementMultiCurrencySchema>;
export type CountMultiCurrencyInput = z.infer<typeof countMultiCurrencySchema>;
export type CurrencyAmounts = z.infer<typeof currencyAmountsSchema>;
