/**
 * SaleService - Lógica de negocio para ventas
 *
 * Extrae la lógica compleja de las rutas de ventas para:
 * - Reutilización de código
 * - Mejor testabilidad
 * - Separación de responsabilidades
 */

import { Prisma, PaymentMethod, PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { NotFoundError, ApiError } from '../utils/errors.js';

// Tipos
export interface SaleItemInput {
  productId?: string;
  comboId?: string;
  productCode?: string;
  productName: string;
  productBarcode?: string;
  quantity: number;
  unitPrice: number;
  unitPriceNet?: number;
  discount: number;
  taxRate: number;
  promotionId?: string;
  promotionName?: string;
  priceListId?: string;
  branchId?: string;
  isReturn?: boolean;
  originalSaleId?: string;
  originalSaleItemId?: string;
  returnReason?: string;
}

export interface PaymentInput {
  method: string;
  amount: number;
  reference?: string;
  giftCardCode?: string;
  storeCreditCode?: string;
  cardBrand?: string;
  cardLastFour?: string;
  installments: number;
  amountTendered?: number;
  transactionId?: string;
  // Mercado Pago fields
  mpPaymentId?: string;
  mpOrderId?: string;
  mpOperationType?: string;
  mpPointType?: string;
  cardFirstSix?: string;
  cardExpirationMonth?: number;
  cardExpirationYear?: number;
  cardholderName?: string;
  cardType?: string;
  payerEmail?: string;
  payerIdType?: string;
  payerIdNumber?: string;
  authorizationCode?: string;
  mpFeeAmount?: number;
  mpFeeRate?: number;
  netReceivedAmount?: number;
  bankOriginId?: string;
  bankOriginName?: string;
  bankTransferId?: string;
  mpDeviceId?: string;
  mpPosId?: string;
  mpStoreId?: string;
  providerData?: unknown;
}

export interface CalculatedItem extends SaleItemInput {
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
}

export interface SaleTotals {
  subtotal: Prisma.Decimal;
  totalDiscount: Prisma.Decimal;
  totalTax: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface PaymentTotals {
  totalCash: number;
  totalDebit: number;
  totalCredit: number;
  totalQr: number;
  totalMpPoint: number;
  totalTransfer: number;
  totalOther: number;
}

class SaleService {
  /**
   * Genera número de venta secuencial
   * Formato: SUC-CODE-POS-CODE-YYYYMMDD-NNNN
   */
  async generateSaleNumber(
    tenantId: string,
    branchId: string,
    pointOfSaleId: string
  ): Promise<string> {
    const pos = await prisma.pointOfSale.findUnique({
      where: { id: pointOfSaleId },
      include: { branch: true },
    });

    if (!pos) {
      throw new NotFoundError('Punto de venta');
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const count = await prisma.sale.count({
      where: {
        tenantId,
        pointOfSaleId,
        createdAt: { gte: startOfDay },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${pos.branch.code}-${pos.code}-${dateStr}-${sequence}`;
  }

  /**
   * Valida que la sucursal y el punto de venta existan y pertenezcan al tenant
   */
  async validateBranchAndPOS(
    tenantId: string,
    branchId: string,
    pointOfSaleId: string
  ): Promise<{ branch: { id: string; code: string; name: string }; pos: { id: string; code: string; name: string; priceListId: string | null } }> {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new NotFoundError('Sucursal');
    }

    const pos = await prisma.pointOfSale.findFirst({
      where: {
        id: pointOfSaleId,
        tenantId,
        branchId,
      },
    });

    if (!pos) {
      throw new NotFoundError('Punto de venta');
    }

    return { branch, pos };
  }

  /**
   * Calcula totales de items de venta
   * Normaliza cantidades (negativas para devoluciones)
   */
  calculateTotals(items: SaleItemInput[]): {
    calculatedItems: CalculatedItem[];
    totals: SaleTotals;
  } {
    let subtotal = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);

    const calculatedItems = items.map((item) => {
      // Normalizar cantidad: si es devolución, asegurar que sea negativa
      const isReturnItem = item.isReturn === true || item.quantity < 0;
      const normalizedQuantity = isReturnItem
        ? -Math.abs(item.quantity)
        : Math.abs(item.quantity);

      const itemSubtotal = new Prisma.Decimal(item.unitPrice)
        .times(normalizedQuantity)
        .minus(item.discount);
      const taxAmount = itemSubtotal.times(item.taxRate).dividedBy(121); // IVA incluido

      subtotal = subtotal.plus(itemSubtotal);
      totalDiscount = totalDiscount.plus(item.discount);
      totalTax = totalTax.plus(taxAmount);

      return {
        ...item,
        quantity: normalizedQuantity,
        subtotal: itemSubtotal,
        taxAmount,
      };
    });

    return {
      calculatedItems,
      totals: {
        subtotal,
        totalDiscount,
        totalTax,
        total: subtotal,
      },
    };
  }

  /**
   * Valida que los pagos cubran el total de la venta
   */
  validatePayments(payments: PaymentInput[], total: Prisma.Decimal): void {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    // Solo requerir pagos si el total es positivo
    if (total.greaterThan(0) && new Prisma.Decimal(totalPaid).lessThan(total)) {
      throw ApiError.badRequest(
        `El total de pagos ($${totalPaid}) es menor al total de la venta ($${total})`
      );
    }

    // Si total <= 0 y hay pagos, validar que no excedan
    if (total.lessThanOrEqualTo(0) && payments.length > 0) {
      throw ApiError.badRequest(
        'No se deben incluir pagos cuando el total es menor o igual a cero'
      );
    }
  }

  /**
   * Calcula totales por método de pago para actualizar sesión de caja
   */
  calculatePaymentTotals(payments: PaymentInput[]): PaymentTotals {
    const totals: PaymentTotals = {
      totalCash: 0,
      totalDebit: 0,
      totalCredit: 0,
      totalQr: 0,
      totalMpPoint: 0,
      totalTransfer: 0,
      totalOther: 0,
    };

    for (const payment of payments) {
      switch (payment.method) {
        case 'CASH':
          totals.totalCash += payment.amount;
          break;
        case 'DEBIT_CARD':
          totals.totalDebit += payment.amount;
          break;
        case 'CREDIT_CARD':
        case 'CREDIT':
          totals.totalCredit += payment.amount;
          break;
        case 'QR':
          totals.totalQr += payment.amount;
          break;
        case 'MP_POINT':
          totals.totalMpPoint += payment.amount;
          break;
        case 'TRANSFER':
          totals.totalTransfer += payment.amount;
          break;
        case 'GIFT_CARD':
        case 'GIFTCARD':
        case 'VOUCHER':
        default:
          totals.totalOther += payment.amount;
      }
    }

    return totals;
  }

  /**
   * Actualiza stock de productos después de una venta
   * @param tx - Transacción de Prisma
   * @param items - Items con cantidad (negativa para devoluciones)
   * @param branchId - Sucursal donde actualizar stock
   */
  async updateStock(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    items: CalculatedItem[],
    branchId: string
  ): Promise<void> {
    for (const item of items) {
      if (item.productId) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product?.trackStock) {
          await tx.productStock.updateMany({
            where: {
              productId: item.productId,
              branchId,
            },
            data: {
              quantity: { decrement: item.quantity },
              available: { decrement: item.quantity },
            },
          });
        }
      }
    }
  }

  /**
   * Actualiza totales de la sesión de caja
   * @param tx - Transacción de Prisma
   * @param cashSessionId - ID de la sesión de caja
   * @param total - Total de la venta
   * @param paymentTotals - Totales por método de pago
   */
  async updateCashSession(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    cashSessionId: string,
    total: Prisma.Decimal,
    paymentTotals: PaymentTotals
  ): Promise<void> {
    await tx.cashSession.update({
      where: { id: cashSessionId },
      data: {
        salesCount: { increment: 1 },
        salesTotal: { increment: total.toNumber() },
        totalCash: { increment: paymentTotals.totalCash },
        totalDebit: { increment: paymentTotals.totalDebit },
        totalCredit: { increment: paymentTotals.totalCredit },
        totalQr: { increment: paymentTotals.totalQr },
        totalMpPoint: { increment: paymentTotals.totalMpPoint },
        totalTransfer: { increment: paymentTotals.totalTransfer },
        totalOther: { increment: paymentTotals.totalOther },
      },
    });
  }

  /**
   * Busca la sesión de caja abierta del usuario
   */
  async findOpenCashSession(
    tenantId: string,
    userId: string,
    pointOfSaleId: string
  ): Promise<{ id: string } | null> {
    return prisma.cashSession.findFirst({
      where: {
        tenantId,
        userId,
        pointOfSaleId,
        status: 'OPEN',
      },
      select: { id: true },
    });
  }

  /**
   * Prepara los datos de pago para crear en la base de datos
   * Normaliza GIFT_CARD -> GIFTCARD
   */
  preparePaymentData(
    payment: PaymentInput,
    storeCreditCodeToIdMap: Map<string, string>
  ): Record<string, unknown> {
    return {
      method: (payment.method === 'GIFT_CARD' ? 'GIFTCARD' : payment.method) as PaymentMethod,
      amount: payment.amount,
      reference: payment.reference,
      cardBrand: payment.cardBrand,
      cardLastFour: payment.cardLastFour,
      installments: payment.installments,
      amountTendered: payment.amountTendered,
      changeAmount:
        payment.method === 'CASH' && payment.amountTendered
          ? payment.amountTendered - payment.amount
          : null,
      transactionId: payment.transactionId,
      status: 'COMPLETED',
      // ID del vale de crédito usado
      storeCreditId: payment.method === 'VOUCHER' && payment.storeCreditCode
        ? storeCreditCodeToIdMap.get(payment.storeCreditCode)
        : undefined,
      // Campos de Mercado Pago
      mpPaymentId: payment.mpPaymentId,
      mpOrderId: payment.mpOrderId,
      mpOperationType: payment.mpOperationType,
      mpPointType: payment.mpPointType,
      cardFirstSix: payment.cardFirstSix,
      cardExpirationMonth: payment.cardExpirationMonth,
      cardExpirationYear: payment.cardExpirationYear,
      cardholderName: payment.cardholderName,
      cardType: payment.cardType,
      payerEmail: payment.payerEmail,
      payerIdType: payment.payerIdType,
      payerIdNumber: payment.payerIdNumber,
      authorizationCode: payment.authorizationCode,
      mpFeeAmount: payment.mpFeeAmount,
      mpFeeRate: payment.mpFeeRate,
      netReceivedAmount: payment.netReceivedAmount,
      bankOriginId: payment.bankOriginId,
      bankOriginName: payment.bankOriginName,
      bankTransferId: payment.bankTransferId,
      mpDeviceId: payment.mpDeviceId,
      mpPosId: payment.mpPosId,
      mpStoreId: payment.mpStoreId,
      providerData: payment.providerData,
    };
  }
}

// Instancia singleton
export const saleService = new SaleService();
export default saleService;
