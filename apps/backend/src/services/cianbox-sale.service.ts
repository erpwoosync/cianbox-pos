/**
 * CianboxSaleService - Envío de ventas POS a Cianbox ERP
 *
 * Convierte ventas del POS al formato de la API de Cianbox,
 * las envía, y gestiona el polling de facturas y reintentos.
 */

import { Prisma, PaymentMethod, CianboxSyncStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { CianboxService } from './cianbox.service.js';

// Tipo de venta con todas las relaciones necesarias
type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true } };
    payments: { include: { cardTerminal: true; bank: true } };
    customer: true;
    branch: true;
    pointOfSale: true;
  };
}>;

// Respuesta de Cianbox al crear una venta
interface CianboxSaleResponse {
  status: string;
  body: {
    id: number;
    id_recibo: number;
  };
  statusMessage?: string;
}

// Respuesta de Cianbox al consultar una venta
interface CianboxSaleDetail {
  status: string;
  body: Array<{
    id: number;
    pdf_url?: string;
    cae?: string;
    [key: string]: unknown;
  }>;
}

// Bloque de tarjeta para Cianbox
interface CianboxTarjetaBlock {
  id_tarjeta: number;
  id_entidad: number;
  cuotas: number;
  cupon: string;
  numero_lote: string;
  monto: number;
}

// Resultado del mapeo de pagos
interface PaymentMapping {
  forma_pago: string;
  cobro: Record<string, unknown>;
}

// Resultado del polling de factura
interface PollInvoiceResult {
  ready: boolean;
  invoiceUrl?: string;
  cae?: string;
}

/**
 * Servicio para sincronizar ventas POS con Cianbox
 */
export class CianboxSaleService {
  /**
   * Construye el payload completo para POST /ventas/alta
   */
  static buildPayload(
    sale: SaleWithRelations,
    connection: { defaultCustomerId: number | null; defaultChannelId: number; defaultCurrencyId: number }
  ): Record<string, unknown> {
    // Filtrar items de recargo financiero
    const productItems = sale.items.filter((item) => !item.isSurcharge);

    // Mapear productos al formato Cianbox
    // neto_uni = precio neto unitario (sin IVA, con descuento aplicado)
    // subtotal del POS = (unitPrice * qty) - discount (con IVA incluido)
    // neto unitario = (subtotal / qty) / (1 + alicuota/100)
    const productos = productItems.map((item) => {
      const qty = Number(item.quantity);
      const subtotal = Number(item.subtotal); // unitPrice * qty - discount (IVA incluido)
      const alicuota = Number(item.taxRate);
      const unitarioConIva = qty !== 0 ? subtotal / qty : 0;
      const netoUni = unitarioConIva / (1 + alicuota / 100);

      return {
        id: item.product?.cianboxProductId ?? 0,
        cantidad: qty,
        neto_uni: Math.round(netoUni * 100) / 100,
        alicuota,
      };
    });

    // Mapear pagos
    const { forma_pago, cobro } = CianboxSaleService.mapPayments(sale.payments);

    // Determinar ID de cliente
    const idCliente = sale.customer?.cianboxCustomerId ?? connection.defaultCustomerId ?? 0;

    // Fecha en formato YYYY-MM-DD
    const fecha = sale.saleDate.toISOString().split('T')[0];

    // ID de sucursal Cianbox
    const idSucursal = sale.branch?.cianboxBranchId ?? 0;

    // ID punto de venta / talonario Cianbox
    const idTalonario = sale.pointOfSale?.cianboxPointOfSaleId ?? 0;

    const payload: Record<string, unknown> = {
      fecha,
      origen: { tipo: 'directa' },
      id_cliente: idCliente,
      id_canal_venta: connection.defaultChannelId,
      forma_pago,
      id_punto_venta: idTalonario,
      id_moneda: connection.defaultCurrencyId,
      cotizacion: 1,
      observaciones: sale.notes || '',
      productos,
      percepciones: [],
    };

    // Agregar bloques condicionales de pago
    if (cobro && Object.keys(cobro).length > 0) {
      if ('tarjeta' in cobro) {
        payload.tarjeta = cobro.tarjeta;
      } else {
        payload.cobro = cobro;
      }
    }

    return payload;
  }

  /**
   * Determina forma_pago y construye el bloque de cobro
   */
  static mapPayments(
    payments: SaleWithRelations['payments']
  ): PaymentMapping {
    if (payments.length === 0) {
      return { forma_pago: 'efectivo', cobro: {} };
    }

    if (payments.length === 1) {
      return CianboxSaleService.mapSinglePayment(payments[0]);
    }

    return CianboxSaleService.mapMixedPayments(payments);
  }

  /**
   * Mapea un pago individual a forma_pago de Cianbox
   */
  static mapSinglePayment(
    payment: SaleWithRelations['payments'][number]
  ): PaymentMapping {
    const amount = Number(payment.amount);

    switch (payment.method) {
      case PaymentMethod.CASH:
        return { forma_pago: 'efectivo', cobro: {} };

      case PaymentMethod.CREDIT_CARD:
        return {
          forma_pago: 'tarjeta_credito',
          cobro: {
            tarjeta: CianboxSaleService.buildTarjetaBlock(payment),
          },
        };

      case PaymentMethod.DEBIT_CARD:
        return {
          forma_pago: 'tarjeta_debito',
          cobro: {
            tarjeta: CianboxSaleService.buildTarjetaBlock(payment),
          },
        };

      case PaymentMethod.MP_POINT: {
        const isCredit = payment.cardType === 'credit';
        return {
          forma_pago: isCredit ? 'tarjeta_credito' : 'tarjeta_debito',
          cobro: {
            tarjeta: CianboxSaleService.buildTarjetaBlock(payment),
          },
        };
      }

      case PaymentMethod.TRANSFER:
        return {
          forma_pago: 'contado_mixto',
          cobro: {
            depositos: [{ monto: amount }],
          },
        };

      // QR, VOUCHER, GIFTCARD, POINTS, OTHER, CHECK, CREDIT → efectivo
      default:
        return { forma_pago: 'efectivo', cobro: {} };
    }
  }

  /**
   * Mapea pagos mixtos (multiples) a contado_mixto
   */
  static mapMixedPayments(
    payments: SaleWithRelations['payments']
  ): PaymentMapping {
    let efectivo = 0;
    const tarjetas: CianboxTarjetaBlock[] = [];
    const depositos: Array<{ monto: number }> = [];

    for (const payment of payments) {
      const amount = Number(payment.amount);

      switch (payment.method) {
        case PaymentMethod.CREDIT_CARD:
        case PaymentMethod.DEBIT_CARD:
        case PaymentMethod.MP_POINT:
          tarjetas.push(CianboxSaleService.buildTarjetaBlock(payment));
          break;

        case PaymentMethod.TRANSFER:
          depositos.push({ monto: amount });
          break;

        // CASH, QR, VOUCHER, GIFTCARD, POINTS, OTHER, CHECK, CREDIT → sumar a efectivo
        default:
          efectivo += amount;
          break;
      }
    }

    const cobro: Record<string, unknown> = {};
    if (efectivo > 0) {
      cobro.efectivo = Math.round(efectivo * 100) / 100;
    }
    if (tarjetas.length > 0) {
      cobro.tarjetas = tarjetas;
    }
    if (depositos.length > 0) {
      cobro.depositos = depositos;
    }

    return { forma_pago: 'contado_mixto', cobro };
  }

  /**
   * Construye el bloque tarjeta para un pago con tarjeta
   */
  static buildTarjetaBlock(
    payment: SaleWithRelations['payments'][number]
  ): CianboxTarjetaBlock {
    return {
      id_tarjeta: (payment as unknown as { cardBrandRecord?: { cianboxCardId?: number | null } })
        .cardBrandRecord?.cianboxCardId ?? 0,
      id_entidad: payment.bank?.cianboxEntityId ?? 0,
      cuotas: payment.installments ?? 1,
      cupon: payment.voucherNumber || '',
      numero_lote: payment.batchNumber || '',
      monto: Number(payment.amount),
    };
  }

  /**
   * Envía una venta a Cianbox por su ID (re-fetch con relaciones completas)
   */
  static async sendSaleById(tenantId: string, saleId: string): Promise<void> {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: { include: { product: true } },
        payments: { include: { cardTerminal: true, bank: true } },
        customer: true,
        branch: true,
        pointOfSale: true,
      },
    });

    if (!sale) return;
    await CianboxSaleService.sendSaleToCianbox(sale);
  }

  /**
   * Flujo completo: obtiene conexión, construye payload, envía a Cianbox y actualiza la venta
   */
  static async sendSaleToCianbox(sale: SaleWithRelations): Promise<void> {
    const tenantId = sale.tenantId;

    // Buscar conexión activa
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    // Si no hay conexión activa, no hacer nada (no todos los tenants usan Cianbox)
    if (!connection || !connection.isActive) {
      return;
    }

    // Marcar como PENDING
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        cianboxSyncStatus: CianboxSyncStatus.PENDING,
        cianboxError: null,
      },
    });

    try {
      // Enriquecer pagos con datos de CardBrand (cianboxCardId)
      const enrichedPayments = await CianboxSaleService.enrichPaymentsWithCardBrand(
        tenantId,
        sale.payments
      );
      const enrichedSale = { ...sale, payments: enrichedPayments };

      // Construir payload
      const payload = CianboxSaleService.buildPayload(enrichedSale, connection);

      console.log(`[CianboxSale] Payload para venta ${sale.saleNumber}:`, JSON.stringify(payload));

      // Crear instancia del servicio y enviar
      const service = new CianboxService(connection);
      const response = await service.request<CianboxSaleResponse>('/ventas/alta', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log(`[CianboxSale] Respuesta Cianbox para venta ${sale.saleNumber}:`, JSON.stringify(response));

      if (response.status !== 'ok' || !response.body?.id) {
        const desc = (response.body as any)?.description || response.statusMessage || JSON.stringify(response);
        throw new Error(`Cianbox rechazó la venta: ${desc}`);
      }

      // Marcar como SYNCED
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          cianboxSaleId: response.body.id,
          cianboxSyncStatus: CianboxSyncStatus.SYNCED,
          cianboxError: null,
        },
      });

      console.log(
        `[CianboxSale] Venta ${sale.saleNumber} enviada OK → Cianbox ID: ${response.body.id}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';

      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          cianboxSyncStatus: CianboxSyncStatus.FAILED,
          cianboxError: errorMessage.substring(0, 500),
        },
      });

      console.error(
        `[CianboxSale] Error enviando venta ${sale.saleNumber}: ${errorMessage}`
      );
    }
  }

  /**
   * Consulta si la factura PDF ya está disponible en Cianbox
   */
  static async pollInvoice(
    tenantId: string,
    saleId: string
  ): Promise<PollInvoiceResult> {
    // Obtener la venta
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      select: { cianboxSaleId: true },
    });

    if (!sale?.cianboxSaleId) {
      return { ready: false };
    }

    // Obtener conexión
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || !connection.isActive) {
      return { ready: false };
    }

    try {
      const service = new CianboxService(connection);
      const response = await service.request<CianboxSaleDetail>(
        `/ventas/lista?id=${sale.cianboxSaleId}`
      );

      if (
        response.status !== 'ok' ||
        !response.body ||
        response.body.length === 0
      ) {
        return { ready: false };
      }

      const ventaCianbox = response.body[0];
      const pdfUrl = ventaCianbox.pdf_url as string | undefined;
      const cae = ventaCianbox.cae as string | undefined;

      if (pdfUrl) {
        // Actualizar la venta con la URL de la factura
        await prisma.sale.update({
          where: { id: saleId },
          data: {
            cianboxInvoiceUrl: pdfUrl,
          },
        });

        return { ready: true, invoiceUrl: pdfUrl, cae };
      }

      return { ready: false };
    } catch (error) {
      console.error(
        `[CianboxSale] Error polling factura para venta ${saleId}:`,
        error
      );
      return { ready: false };
    }
  }

  /**
   * Reintenta ventas fallidas de un tenant (máximo 50)
   */
  static async retryFailedSales(tenantId: string): Promise<{
    total: number;
    retried: number;
    succeeded: number;
    failed: number;
  }> {
    const failedSales = await prisma.sale.findMany({
      where: {
        tenantId,
        cianboxSyncStatus: CianboxSyncStatus.FAILED,
      },
      include: {
        items: { include: { product: true } },
        payments: { include: { cardTerminal: true, bank: true } },
        customer: true,
        branch: true,
        pointOfSale: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const results = {
      total: failedSales.length,
      retried: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const sale of failedSales) {
      results.retried++;
      try {
        await CianboxSaleService.sendSaleToCianbox(sale);

        // Verificar si fue exitoso
        const updated = await prisma.sale.findUnique({
          where: { id: sale.id },
          select: { cianboxSyncStatus: true },
        });

        if (updated?.cianboxSyncStatus === CianboxSyncStatus.SYNCED) {
          results.succeeded++;
        } else {
          results.failed++;
        }
      } catch {
        results.failed++;
      }
    }

    console.log(
      `[CianboxSale] Retry completado para tenant ${tenantId}: ` +
        `${results.succeeded}/${results.total} exitosos, ${results.failed} fallidos`
    );

    return results;
  }

  /**
   * Enriquece los pagos con datos de CardBrand (cianboxCardId)
   * para construir correctamente el bloque tarjeta
   */
  private static async enrichPaymentsWithCardBrand(
    tenantId: string,
    payments: SaleWithRelations['payments']
  ): Promise<SaleWithRelations['payments']> {
    const cardPayments = payments.filter(
      (p) =>
        p.method === PaymentMethod.CREDIT_CARD ||
        p.method === PaymentMethod.DEBIT_CARD ||
        p.method === PaymentMethod.MP_POINT
    );

    if (cardPayments.length === 0) {
      return payments;
    }

    // Obtener todos los códigos de tarjeta únicos
    const cardCodes = [
      ...new Set(cardPayments.map((p) => p.cardBrand).filter(Boolean)),
    ] as string[];

    if (cardCodes.length === 0) {
      return payments;
    }

    // Buscar CardBrand por código para obtener cianboxCardId
    const cardBrands = await prisma.cardBrand.findMany({
      where: {
        tenantId,
        code: { in: cardCodes },
      },
      select: { code: true, cianboxCardId: true },
    });

    const cardBrandMap = new Map(
      cardBrands.map((cb) => [cb.code, cb])
    );

    // Agregar cardBrandRecord a cada pago
    return payments.map((payment) => {
      if (payment.cardBrand && cardBrandMap.has(payment.cardBrand)) {
        return {
          ...payment,
          cardBrandRecord: cardBrandMap.get(payment.cardBrand),
        } as SaleWithRelations['payments'][number];
      }
      return payment;
    });
  }
}
