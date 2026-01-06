/**
 * Gift Card Service
 * Lógica de negocio para gestión de gift cards
 */

import { GiftCardStatus, GiftCardTxType } from '@prisma/client';
import prisma from '../lib/prisma.js';

/**
 * Genera un código único para gift card
 * Formato: GC-XXXX-XXXX-XXXX (16 caracteres alfanuméricos)
 */
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let code = 'GC-';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface GenerateGiftCardsParams {
  tenantId: string;
  quantity: number;
  amount: number;
  currency: string;
  expiresAt?: Date;
  generatedById: string;
}

export interface GiftCardResult {
  id: string;
  code: string;
  amount: number;
  currency: string;
  expiresAt: Date | null;
}

/**
 * Genera múltiples gift cards
 */
export async function generateGiftCards(params: GenerateGiftCardsParams): Promise<GiftCardResult[]> {
  const { tenantId, quantity, amount, currency, expiresAt, generatedById } = params;

  const giftCards: GiftCardResult[] = [];

  for (let i = 0; i < quantity; i++) {
    // Generar código único
    let code: string;
    let attempts = 0;
    do {
      code = generateGiftCardCode();
      const existing = await prisma.giftCard.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('No se pudo generar un código único');
    }

    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        initialAmount: amount,
        currentBalance: amount,
        currency,
        status: GiftCardStatus.INACTIVE,
        expiresAt: expiresAt || null,
        tenantId,
        generatedById,
      },
    });

    giftCards.push({
      id: giftCard.id,
      code: giftCard.code,
      amount: Number(giftCard.initialAmount),
      currency: giftCard.currency,
      expiresAt: giftCard.expiresAt,
    });
  }

  return giftCards;
}

export interface ActivateGiftCardParams {
  tenantId: string;
  code: string;
  userId: string;
  saleId?: string;
}

/**
 * Activa una gift card (cuando se vende)
 */
export async function activateGiftCard(params: ActivateGiftCardParams) {
  const { tenantId, code, userId, saleId } = params;

  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
  });

  if (!giftCard) {
    throw new Error('Gift card no encontrada');
  }

  if (giftCard.status !== GiftCardStatus.INACTIVE) {
    throw new Error(`Gift card no puede ser activada (estado: ${giftCard.status})`);
  }

  // Verificar expiración
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    throw new Error('Gift card expirada');
  }

  const updated = await prisma.giftCard.update({
    where: { id: giftCard.id },
    data: {
      status: GiftCardStatus.ACTIVE,
      activatedAt: new Date(),
      activatedById: userId,
    },
  });

  // Registrar transacción
  await prisma.giftCardTransaction.create({
    data: {
      giftCardId: giftCard.id,
      type: GiftCardTxType.ACTIVATION,
      amount: Number(giftCard.initialAmount),
      balanceAfter: Number(giftCard.currentBalance),
      saleId,
      userId,
    },
  });

  return updated;
}

export interface RedeemGiftCardParams {
  tenantId: string;
  code: string;
  amount: number;
  saleId: string;
  userId: string;
}

/**
 * Canjea (usa) saldo de una gift card
 */
export async function redeemGiftCard(params: RedeemGiftCardParams) {
  const { tenantId, code, amount, saleId, userId } = params;

  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
  });

  if (!giftCard) {
    throw new Error('Gift card no encontrada');
  }

  if (giftCard.status !== GiftCardStatus.ACTIVE) {
    throw new Error(`Gift card no disponible (estado: ${giftCard.status})`);
  }

  // Verificar expiración
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: GiftCardStatus.EXPIRED },
    });
    throw new Error('Gift card expirada');
  }

  const currentBalance = Number(giftCard.currentBalance);
  if (amount > currentBalance) {
    throw new Error(`Saldo insuficiente. Disponible: ${currentBalance} ${giftCard.currency}`);
  }

  const newBalance = currentBalance - amount;
  const newStatus = newBalance === 0 ? GiftCardStatus.DEPLETED : GiftCardStatus.ACTIVE;

  const updated = await prisma.giftCard.update({
    where: { id: giftCard.id },
    data: {
      currentBalance: newBalance,
      status: newStatus,
    },
  });

  // Registrar transacción
  await prisma.giftCardTransaction.create({
    data: {
      giftCardId: giftCard.id,
      type: GiftCardTxType.REDEMPTION,
      amount: -amount, // Negativo porque sale
      balanceAfter: newBalance,
      saleId,
      userId,
    },
  });

  return {
    giftCard: updated,
    amountRedeemed: amount,
    remainingBalance: newBalance,
  };
}

export interface CheckBalanceParams {
  tenantId: string;
  code: string;
}

/**
 * Consulta el saldo de una gift card
 */
export async function checkBalance(params: CheckBalanceParams) {
  const { tenantId, code } = params;

  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
    select: {
      id: true,
      code: true,
      initialAmount: true,
      currentBalance: true,
      currency: true,
      status: true,
      expiresAt: true,
      activatedAt: true,
    },
  });

  if (!giftCard) {
    throw new Error('Gift card no encontrada');
  }

  // Verificar y actualizar expiración si corresponde
  if (giftCard.status === GiftCardStatus.ACTIVE && giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: GiftCardStatus.EXPIRED },
    });
    return {
      ...giftCard,
      status: GiftCardStatus.EXPIRED,
      isExpired: true,
    };
  }

  return {
    ...giftCard,
    isExpired: false,
  };
}

export interface CancelGiftCardParams {
  tenantId: string;
  code: string;
  userId: string;
  reason?: string;
}

/**
 * Cancela una gift card
 */
export async function cancelGiftCard(params: CancelGiftCardParams) {
  const { tenantId, code, userId, reason } = params;

  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
  });

  if (!giftCard) {
    throw new Error('Gift card no encontrada');
  }

  if (giftCard.status === GiftCardStatus.CANCELLED) {
    throw new Error('Gift card ya está cancelada');
  }

  if (giftCard.status === GiftCardStatus.DEPLETED) {
    throw new Error('Gift card ya fue utilizada completamente');
  }

  const updated = await prisma.giftCard.update({
    where: { id: giftCard.id },
    data: {
      status: GiftCardStatus.CANCELLED,
    },
  });

  // Registrar transacción de cancelación
  await prisma.giftCardTransaction.create({
    data: {
      giftCardId: giftCard.id,
      type: GiftCardTxType.CANCELLATION,
      amount: 0,
      balanceAfter: Number(giftCard.currentBalance),
      notes: reason,
      userId,
    },
  });

  return updated;
}

/**
 * Lista gift cards con filtros
 */
export async function listGiftCards(
  tenantId: string,
  filters: {
    status?: GiftCardStatus;
    currency?: string;
    limit?: number;
    offset?: number;
  }
) {
  const { status, currency, limit = 50, offset = 0 } = filters;

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (currency) where.currency = currency;

  const [giftCards, total] = await Promise.all([
    prisma.giftCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        code: true,
        initialAmount: true,
        currentBalance: true,
        currency: true,
        status: true,
        expiresAt: true,
        activatedAt: true,
        createdAt: true,
      },
    }),
    prisma.giftCard.count({ where }),
  ]);

  return { giftCards, total, limit, offset };
}

/**
 * Obtiene historial de transacciones de una gift card
 */
export async function getGiftCardTransactions(tenantId: string, giftCardId: string) {
  const giftCard = await prisma.giftCard.findFirst({
    where: { id: giftCardId, tenantId },
  });

  if (!giftCard) {
    throw new Error('Gift card no encontrada');
  }

  const transactions = await prisma.giftCardTransaction.findMany({
    where: { giftCardId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      sale: {
        select: { id: true, saleNumber: true },
      },
    },
  });

  return { giftCard, transactions };
}

export default {
  generateGiftCards,
  activateGiftCard,
  redeemGiftCard,
  checkBalance,
  cancelGiftCard,
  listGiftCards,
  getGiftCardTransactions,
};
