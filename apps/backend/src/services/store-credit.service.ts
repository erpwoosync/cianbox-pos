/**
 * Servicio de Store Credits (Vales de Crédito)
 * Gestión de vales generados en devoluciones
 */

import { PrismaClient, Prisma, StoreCreditStatus, StoreCreditTxType } from '@prisma/client';
import { ApiError, NotFoundError } from '../utils/errors.js';

const prisma = new PrismaClient();

/**
 * Genera un código único para el vale
 * Formato: VAL-{BRANCH}-{YEAR}-{RANDOM4}
 */
async function generateCode(tenantId: string, branchCode?: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = 'VAL';
  const branchPart = branchCode || '001';

  // Generar parte aleatoria de 4 caracteres alfanuméricos
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const code = `${prefix}-${branchPart}-${year}-${random}`;

  // Verificar que no exista
  const existing = await prisma.storeCredit.findUnique({
    where: { code },
  });

  if (existing) {
    // Reintentar con otro código
    return generateCode(tenantId, branchCode);
  }

  return code;
}

/**
 * Genera barcode a partir del código
 * Formato numérico para Code128
 */
function generateBarcode(code: string): string {
  // Convertir código a formato numérico usando hash simple
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) - hash) + code.charCodeAt(i);
    hash = hash & hash; // Convertir a 32bit integer
  }
  // Generar número de 13 dígitos (EAN-13 compatible)
  const timestamp = Date.now().toString().slice(-6);
  const hashStr = Math.abs(hash).toString().slice(0, 6).padStart(6, '0');
  return `${hashStr}${timestamp}0`;
}

interface CreateStoreCreditParams {
  tenantId: string;
  amount: number;
  issuedByUserId: string;
  branchId?: string;
  customerId?: string;
  originSaleId?: string;
  expiresAt?: Date;
  notes?: string;
}

interface RedeemStoreCreditParams {
  tenantId: string;
  code: string;
  amount: number;
  saleId: string;
  userId: string;
}

interface CheckBalanceParams {
  tenantId: string;
  code: string;
}

interface CancelStoreCreditParams {
  tenantId: string;
  code: string;
  userId: string;
  reason: string;
}

interface ListStoreCreditsParams {
  status?: StoreCreditStatus;
  customerId?: string;
  branchId?: string;
  limit?: number;
  offset?: number;
}

class StoreCreditService {
  /**
   * Crear un nuevo vale de crédito
   */
  async createStoreCredit(params: CreateStoreCreditParams) {
    const { tenantId, amount, issuedByUserId, branchId, customerId, originSaleId, expiresAt } = params;

    // Obtener configuración del tenant para días de vencimiento
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    // Obtener código de sucursal si existe
    let branchCode = '001';
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { code: true },
      });
      if (branch) {
        branchCode = branch.code;
      }
    }

    // Calcular fecha de vencimiento
    let calculatedExpiresAt = expiresAt;
    if (!calculatedExpiresAt) {
      const settings = tenant?.settings as Record<string, unknown> || {};
      const expirationDays = (settings.storeCreditExpirationDays as number) || 90;
      if (expirationDays > 0) {
        calculatedExpiresAt = new Date();
        calculatedExpiresAt.setDate(calculatedExpiresAt.getDate() + expirationDays);
      }
    }

    // Generar código único
    const code = await generateCode(tenantId, branchCode);
    const barcode = generateBarcode(code);

    // Crear vale y transacción inicial en una transacción
    const storeCredit = await prisma.$transaction(async (tx) => {
      const credit = await tx.storeCredit.create({
        data: {
          tenantId,
          code,
          barcode,
          originalAmount: new Prisma.Decimal(amount),
          currentBalance: new Prisma.Decimal(amount),
          status: 'ACTIVE',
          issuedByUserId,
          branchId,
          customerId,
          originSaleId,
          expiresAt: calculatedExpiresAt,
        },
        include: {
          customer: { select: { id: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          issuedBy: { select: { id: true, name: true } },
        },
      });

      // Crear transacción de emisión
      await tx.storeCreditTx.create({
        data: {
          storeCreditId: credit.id,
          type: 'ISSUED',
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(amount),
          saleId: originSaleId,
          description: 'Emisión inicial',
        },
      });

      return credit;
    });

    return storeCredit;
  }

  /**
   * Consultar saldo de un vale
   */
  async checkBalance(params: CheckBalanceParams) {
    const { tenantId, code } = params;

    const storeCredit = await prisma.storeCredit.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
      },
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    if (!storeCredit) {
      throw new NotFoundError('Vale de crédito');
    }

    // Verificar que pertenezca al tenant
    if (storeCredit.tenantId !== tenantId) {
      throw new NotFoundError('Vale de crédito');
    }

    // Verificar si está vencido
    const isExpired = storeCredit.expiresAt && new Date() > storeCredit.expiresAt;

    // Si está vencido pero el status no lo refleja, actualizarlo
    if (isExpired && storeCredit.status === 'ACTIVE') {
      await prisma.$transaction(async (tx) => {
        await tx.storeCredit.update({
          where: { id: storeCredit.id },
          data: { status: 'EXPIRED' },
        });

        await tx.storeCreditTx.create({
          data: {
            storeCreditId: storeCredit.id,
            type: 'EXPIRED',
            amount: new Prisma.Decimal(0),
            balanceAfter: storeCredit.currentBalance,
            description: 'Vale vencido',
          },
        });
      });

      storeCredit.status = 'EXPIRED';
    }

    return {
      ...storeCredit,
      isExpired: isExpired || storeCredit.status === 'EXPIRED',
    };
  }

  /**
   * Canjear/usar un vale
   */
  async redeemStoreCredit(params: RedeemStoreCreditParams) {
    const { tenantId, code, amount, saleId, userId } = params;

    // Verificar vale
    const balance = await this.checkBalance({ tenantId, code });

    if (balance.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Vale de crédito no activo. Estado: ${balance.status}`);
    }

    if (balance.isExpired) {
      throw ApiError.badRequest('Vale de crédito vencido');
    }

    const currentBalance = Number(balance.currentBalance);
    if (amount > currentBalance) {
      throw ApiError.badRequest(
        `Saldo insuficiente. Disponible: $${currentBalance}, Solicitado: $${amount}`
      );
    }

    // Procesar canje
    const result = await prisma.$transaction(async (tx) => {
      const newBalance = currentBalance - amount;
      const newStatus: StoreCreditStatus = newBalance === 0 ? 'USED' : 'ACTIVE';

      const updatedCredit = await tx.storeCredit.update({
        where: { id: balance.id },
        data: {
          currentBalance: new Prisma.Decimal(newBalance),
          status: newStatus,
        },
      });

      await tx.storeCreditTx.create({
        data: {
          storeCreditId: balance.id,
          type: 'REDEEMED',
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(newBalance),
          saleId,
          description: `Uso en venta`,
        },
      });

      return updatedCredit;
    });

    return {
      storeCredit: result,
      amountRedeemed: amount,
      remainingBalance: Number(result.currentBalance),
    };
  }

  /**
   * Cancelar un vale
   */
  async cancelStoreCredit(params: CancelStoreCreditParams) {
    const { tenantId, code, userId, reason } = params;

    const storeCredit = await prisma.storeCredit.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        tenantId,
      },
    });

    if (!storeCredit) {
      throw new NotFoundError('Vale de crédito');
    }

    if (storeCredit.status === 'CANCELLED') {
      throw ApiError.badRequest('El vale ya está cancelado');
    }

    if (storeCredit.status === 'USED') {
      throw ApiError.badRequest('No se puede cancelar un vale ya utilizado');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.storeCredit.update({
        where: { id: storeCredit.id },
        data: { status: 'CANCELLED' },
      });

      await tx.storeCreditTx.create({
        data: {
          storeCreditId: storeCredit.id,
          type: 'CANCELLED',
          amount: new Prisma.Decimal(0),
          balanceAfter: storeCredit.currentBalance,
          description: `Cancelado: ${reason}`,
        },
      });

      return updated;
    });

    return result;
  }

  /**
   * Listar vales de un tenant
   */
  async listStoreCredits(tenantId: string, params: ListStoreCreditsParams) {
    const { status, customerId, branchId, limit = 50, offset = 0 } = params;

    const where: Prisma.StoreCreditWhereInput = { tenantId };

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (branchId) where.branchId = branchId;

    const [storeCredits, total] = await Promise.all([
      prisma.storeCredit.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          issuedBy: { select: { id: true, name: true } },
          originSale: { select: { id: true, saleNumber: true } },
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.storeCredit.count({ where }),
    ]);

    return {
      storeCredits: storeCredits.map((sc) => ({
        ...sc,
        originalAmount: Number(sc.originalAmount),
        currentBalance: Number(sc.currentBalance),
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Obtener historial de transacciones de un vale
   */
  async getTransactions(tenantId: string, storeCreditId: string) {
    const storeCredit = await prisma.storeCredit.findFirst({
      where: {
        id: storeCreditId,
        tenantId,
      },
    });

    if (!storeCredit) {
      throw new NotFoundError('Vale de crédito');
    }

    const transactions = await prisma.storeCreditTx.findMany({
      where: { storeCreditId },
      include: {
        sale: { select: { id: true, saleNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      storeCredit: {
        ...storeCredit,
        originalAmount: Number(storeCredit.originalAmount),
        currentBalance: Number(storeCredit.currentBalance),
      },
      transactions: transactions.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
        balanceAfter: Number(tx.balanceAfter),
      })),
    };
  }
}

export default new StoreCreditService();
