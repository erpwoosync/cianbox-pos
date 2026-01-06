/**
 * CashService - Lógica de negocio para gestión de caja
 *
 * Extrae la lógica compleja de las rutas de caja para:
 * - Reutilización de código
 * - Mejor testabilidad
 * - Separación de responsabilidades
 */

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../utils/errors.js';

// Tipos
export interface DenominationCount {
  bills: Record<string, number>;
  coins: Record<string, number>;
}

export interface DenominationTotals {
  totalBills: number;
  totalCoins: number;
  totalCash: number;
}

export interface PaymentTotals {
  totalCash: number;
  totalDebit: number;
  totalCredit: number;
  totalQr: number;
  totalMpPoint: number;
  totalTransfer: number;
  totalOther: number;
  salesCount: number;
  salesTotal: number;
  refundsCount: number;
  refundsTotal: number;
  cancelsCount: number;
}

class CashService {
  // Denominaciones de billetes (pesos argentinos)
  private readonly billDenominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
  // Denominaciones de monedas (pesos argentinos)
  private readonly coinDenominations = [500, 200, 100, 50, 25, 10, 5, 2, 1];

  /**
   * Genera número de sesión secuencial
   * Formato: T-POS_CODE-YYYYMMDD-NNN
   */
  async generateSessionNumber(
    tenantId: string,
    pointOfSaleId: string
  ): Promise<string> {
    const pos = await prisma.pointOfSale.findUnique({
      where: { id: pointOfSaleId },
    });

    if (!pos) {
      throw new NotFoundError('Punto de venta');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.cashSession.count({
      where: {
        tenantId,
        pointOfSaleId,
        createdAt: { gte: today },
      },
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = String(count + 1).padStart(3, '0');

    return `T-${pos.code}-${dateStr}-${sequence}`;
  }

  /**
   * Calcula el monto esperado de efectivo en la sesión
   * Suma: apertura + ventas en efectivo + depósitos - retiros
   */
  async calculateExpectedCash(sessionId: string): Promise<number> {
    const session = await prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: true,
        sales: {
          where: { status: 'COMPLETED' },
          include: { payments: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Sesión de caja');
    }

    let expected = Number(session.openingAmount);

    // Sumar ventas en efectivo
    // payment.amount es el monto neto de la venta (lo que queda en caja)
    // changeAmount es solo informativo (lo que se devolvió al cliente)
    for (const sale of session.sales) {
      for (const payment of sale.payments) {
        if (payment.method === 'CASH' && payment.status === 'COMPLETED') {
          expected += Number(payment.amount);
        }
      }
    }

    // Sumar/restar movimientos
    for (const mov of session.movements) {
      const amount = Number(mov.amount);
      switch (mov.type) {
        case 'DEPOSIT':
        case 'ADJUSTMENT_IN':
        case 'TRANSFER_IN':
        case 'CHANGE_FUND':
          expected += amount;
          break;
        case 'WITHDRAWAL':
        case 'ADJUSTMENT_OUT':
        case 'TRANSFER_OUT':
          expected -= amount;
          break;
      }
    }

    return expected;
  }

  /**
   * Calcula totales por método de pago de una sesión
   */
  async calculatePaymentTotals(sessionId: string): Promise<PaymentTotals> {
    const session = await prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        sales: {
          include: { payments: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Sesión de caja');
    }

    const totals: PaymentTotals = {
      totalCash: 0,
      totalDebit: 0,
      totalCredit: 0,
      totalQr: 0,
      totalMpPoint: 0,
      totalTransfer: 0,
      totalOther: 0,
      salesCount: 0,
      salesTotal: 0,
      refundsCount: 0,
      refundsTotal: 0,
      cancelsCount: 0,
    };

    for (const sale of session.sales) {
      if (sale.status === 'COMPLETED') {
        totals.salesCount++;
        totals.salesTotal += Number(sale.total);

        for (const payment of sale.payments) {
          if (payment.status !== 'COMPLETED') continue;
          const amount = Number(payment.amount);

          switch (payment.method) {
            case 'CASH':
              totals.totalCash += amount;
              break;
            case 'DEBIT_CARD':
              totals.totalDebit += amount;
              break;
            case 'CREDIT_CARD':
              totals.totalCredit += amount;
              break;
            case 'QR':
              totals.totalQr += amount;
              break;
            case 'MP_POINT':
              totals.totalMpPoint += amount;
              break;
            case 'TRANSFER':
              totals.totalTransfer += amount;
              break;
            default:
              totals.totalOther += amount;
          }
        }
      } else if (sale.status === 'REFUNDED' || sale.status === 'PARTIAL_REFUND') {
        totals.refundsCount++;
        totals.refundsTotal += Number(sale.total);
      } else if (sale.status === 'CANCELLED') {
        totals.cancelsCount++;
      }
    }

    return totals;
  }

  /**
   * Calcula totales de billetes y monedas
   * @param bills - Conteo de billetes por denominación
   * @param coins - Conteo de monedas por denominación
   */
  calculateDenominationTotals(
    bills: Record<string, number>,
    coins: Record<string, number>
  ): DenominationTotals {
    let totalBills = 0;
    let totalCoins = 0;

    for (const denom of this.billDenominations) {
      totalBills += (bills[denom.toString()] || 0) * denom;
    }

    for (const denom of this.coinDenominations) {
      totalCoins += (coins[denom.toString()] || 0) * denom;
    }

    return {
      totalBills,
      totalCoins,
      totalCash: totalBills + totalCoins,
    };
  }

  /**
   * Busca sesión de caja abierta por usuario
   */
  async findOpenSession(
    tenantId: string,
    userId: string,
    statuses: string[] = ['OPEN', 'SUSPENDED', 'COUNTING']
  ): Promise<{ id: string; pointOfSaleId: string } | null> {
    return prisma.cashSession.findFirst({
      where: {
        tenantId,
        userId,
        status: { in: statuses as any },
      },
      select: { id: true, pointOfSaleId: true },
    });
  }

  /**
   * Busca sesión de caja abierta por punto de venta
   */
  async findOpenSessionByPOS(
    tenantId: string,
    pointOfSaleId: string,
    statuses: string[] = ['OPEN', 'SUSPENDED', 'COUNTING']
  ): Promise<{ id: string; userId: string } | null> {
    return prisma.cashSession.findFirst({
      where: {
        tenantId,
        pointOfSaleId,
        status: { in: statuses as any },
      },
      select: { id: true, userId: true },
    });
  }

  /**
   * Valida que el punto de venta exista y pertenezca al tenant
   */
  async validatePointOfSale(
    tenantId: string,
    pointOfSaleId: string
  ): Promise<{ id: string; code: string; name: string; branchId: string }> {
    const pos = await prisma.pointOfSale.findFirst({
      where: { id: pointOfSaleId, tenantId },
    });

    if (!pos) {
      throw new NotFoundError('Punto de venta');
    }

    return pos;
  }
}

// Instancia singleton
export const cashService = new CashService();
export default cashService;
