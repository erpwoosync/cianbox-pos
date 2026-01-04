/**
 * Rutas de ventas
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError, ValidationError, NotFoundError, AuthorizationError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// Schemas de validación
const saleItemSchema = z.object({
  productId: z.string().optional(),
  comboId: z.string().optional(),
  productCode: z.string().optional(),
  productName: z.string(),
  productBarcode: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0), // Precio CON IVA
  unitPriceNet: z.number().min(0).optional(), // Precio SIN IVA
  discount: z.number().min(0).default(0),
  taxRate: z.number().default(21),
  promotionId: z.string().optional(),
  promotionName: z.string().optional(),
  priceListId: z.string().optional(), // ID de lista de precios usada
  branchId: z.string().optional(), // ID de sucursal (heredado de la venta)
});

const paymentSchema = z.object({
  method: z.enum([
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'QR',
    'MP_POINT',
    'TRANSFER',
    'CHECK',
    'CREDIT',
    'VOUCHER',
    'GIFTCARD',
    'POINTS',
    'OTHER',
  ]),
  amount: z.number().positive(),
  reference: z.string().optional(),
  cardBrand: z.string().optional(),
  cardLastFour: z.string().optional(),
  installments: z.number().int().min(1).default(1),
  amountTendered: z.number().optional(),
  transactionId: z.string().optional(),

  // Campos de Mercado Pago
  mpPaymentId: z.string().optional(),
  mpOrderId: z.string().optional(),
  mpOperationType: z.string().optional(),
  mpPointType: z.string().optional(),
  cardFirstSix: z.string().optional(),
  cardExpirationMonth: z.number().optional(),
  cardExpirationYear: z.number().optional(),
  cardholderName: z.string().optional(),
  cardType: z.string().optional(),
  payerEmail: z.string().optional(),
  payerIdType: z.string().optional(),
  payerIdNumber: z.string().optional(),
  authorizationCode: z.string().optional(),
  mpFeeAmount: z.number().optional(),
  mpFeeRate: z.number().optional(),
  netReceivedAmount: z.number().optional(),
  bankOriginId: z.string().optional(),
  bankOriginName: z.string().optional(),
  bankTransferId: z.string().optional(),
  mpDeviceId: z.string().optional(),
  mpPosId: z.string().optional(),
  mpStoreId: z.string().optional(),
  providerData: z.any().optional(),
});

const saleCreateSchema = z.object({
  branchId: z.string(),
  pointOfSaleId: z.string(),
  customerId: z.string().optional(),
  receiptType: z
    .enum([
      'TICKET',
      'INVOICE_A',
      'INVOICE_B',
      'INVOICE_C',
      'CREDIT_NOTE_A',
      'CREDIT_NOTE_B',
      'CREDIT_NOTE_C',
      'RECEIPT',
    ])
    .default('TICKET'),
  items: z.array(saleItemSchema).min(1, 'Debe incluir al menos un item'),
  payments: z.array(paymentSchema).min(1, 'Debe incluir al menos un pago'),
  notes: z.string().optional(),
});

const saleQuerySchema = z.object({
  branchId: z.string().optional(),
  pointOfSaleId: z.string().optional(),
  userId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.string().default('1'),
  pageSize: z.string().default('50'),
});

/**
 * Genera número de venta secuencial
 * Formato: SUC-CODE-POS-CODE-YYYYMMDD-NNNN
 */
async function generateSaleNumber(
  tenantId: string,
  branchId: string,
  pointOfSaleId: string
): Promise<string> {
  // Obtener punto de venta y sucursal para el prefijo
  const pos = await prisma.pointOfSale.findUnique({
    where: { id: pointOfSaleId },
    include: { branch: true },
  });

  if (!pos) {
    throw new NotFoundError('Punto de venta');
  }

  // Fecha actual en formato YYYYMMDD
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Contar ventas del día en este POS para la secuencia diaria
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

  // Formato: SUC-1-CAJA-01-20251222-0001
  return `${pos.branch.code}-${pos.code}-${dateStr}-${sequence}`;
}

/**
 * POST /api/sales
 * Crear nueva venta
 */
router.post(
  '/',
  authenticate,
  authorize('pos:sell'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = saleCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;

      // Verificar que el branch pertenece al tenant
      const branch = await prisma.branch.findFirst({
        where: { id: data.branchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundError('Sucursal');
      }

      // Verificar punto de venta
      const pos = await prisma.pointOfSale.findFirst({
        where: {
          id: data.pointOfSaleId,
          tenantId,
          branchId: data.branchId,
        },
      });
      if (!pos) {
        throw new NotFoundError('Punto de venta');
      }

      // Calcular totales
      let subtotal = new Prisma.Decimal(0);
      let totalDiscount = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);

      const itemsWithCalculations = data.items.map((item) => {
        const itemSubtotal = new Prisma.Decimal(item.unitPrice)
          .times(item.quantity)
          .minus(item.discount);
        const taxAmount = itemSubtotal.times(item.taxRate).dividedBy(121); // IVA incluido

        subtotal = subtotal.plus(itemSubtotal);
        totalDiscount = totalDiscount.plus(item.discount);
        totalTax = totalTax.plus(taxAmount);

        return {
          ...item,
          subtotal: itemSubtotal,
          taxAmount,
        };
      });

      const total = subtotal;

      // Verificar que los pagos cubran el total
      const totalPaid = data.payments.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      if (new Prisma.Decimal(totalPaid).lessThan(total)) {
        throw ApiError.badRequest(
          `El total de pagos ($${totalPaid}) es menor al total de la venta ($${total})`
        );
      }

      // Generar número de venta
      const saleNumber = await generateSaleNumber(
        tenantId,
        data.branchId,
        data.pointOfSaleId
      );

      // Buscar sesión de caja abierta del usuario
      const cashSession = await prisma.cashSession.findFirst({
        where: {
          tenantId,
          userId,
          pointOfSaleId: data.pointOfSaleId,
          status: 'OPEN',
        },
      });

      // Crear venta con items y pagos en una transacción
      const sale = await prisma.$transaction(async (tx) => {
        // Crear venta
        const newSale = await tx.sale.create({
          data: {
            tenantId,
            branchId: data.branchId,
            pointOfSaleId: data.pointOfSaleId,
            userId,
            customerId: data.customerId,
            cashSessionId: cashSession?.id,
            saleNumber,
            receiptType: data.receiptType,
            subtotal,
            discount: totalDiscount,
            tax: totalTax,
            total,
            status: 'COMPLETED',
            notes: data.notes,
            items: {
              create: itemsWithCalculations.map((item) => {
                // Calcular precio neto si no viene del frontend
                const unitPriceNet = item.unitPriceNet ||
                  new Prisma.Decimal(item.unitPrice)
                    .dividedBy(new Prisma.Decimal(1).plus(new Prisma.Decimal(item.taxRate).dividedBy(100)))
                    .toNumber();

                return {
                  productId: item.productId,
                  comboId: item.comboId,
                  productCode: item.productCode,
                  productName: item.productName,
                  productBarcode: item.productBarcode,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  unitPriceNet,
                  discount: item.discount,
                  subtotal: item.subtotal,
                  taxRate: item.taxRate,
                  taxAmount: item.taxAmount,
                  promotionId: item.promotionId,
                  promotionName: item.promotionName,
                  // IDs para sincronización con Cianbox
                  priceListId: item.priceListId || pos.priceListId, // Usar del item o del POS
                  branchId: item.branchId || data.branchId, // Usar del item o de la venta
                };
              }),
            },
            payments: {
              create: data.payments.map((payment) => ({
                method: payment.method,
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
              })),
            },
          },
          include: {
            items: true,
            payments: true,
            customer: true,
            branch: true,
            pointOfSale: true,
            user: { select: { id: true, name: true } },
          },
        });

        // Actualizar stock si corresponde
        for (const item of itemsWithCalculations) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });

            if (product?.trackStock) {
              await tx.productStock.updateMany({
                where: {
                  productId: item.productId,
                  branchId: data.branchId,
                },
                data: {
                  quantity: { decrement: item.quantity },
                  available: { decrement: item.quantity },
                },
              });
            }
          }
        }

        // Actualizar totales de la sesión de caja si existe
        if (cashSession) {
          // Calcular totales por método de pago
          const paymentTotals = {
            totalCash: 0,
            totalDebit: 0,
            totalCredit: 0,
            totalQr: 0,
            totalMpPoint: 0,
            totalTransfer: 0,
            totalOther: 0,
          };

          for (const payment of data.payments) {
            switch (payment.method) {
              case 'CASH':
                // Para efectivo, restamos el vuelto
                paymentTotals.totalCash += payment.amount;
                break;
              case 'DEBIT_CARD':
                paymentTotals.totalDebit += payment.amount;
                break;
              case 'CREDIT_CARD':
              case 'CREDIT':
                paymentTotals.totalCredit += payment.amount;
                break;
              case 'QR':
                paymentTotals.totalQr += payment.amount;
                break;
              case 'MP_POINT':
                paymentTotals.totalMpPoint += payment.amount;
                break;
              case 'TRANSFER':
                paymentTotals.totalTransfer += payment.amount;
                break;
              default:
                paymentTotals.totalOther += payment.amount;
            }
          }

          await tx.cashSession.update({
            where: { id: cashSession.id },
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

        // Vincular MercadoPagoOrder si existe mpOrderId en algún pago
        for (const payment of data.payments) {
          if (payment.mpOrderId) {
            await tx.mercadoPagoOrder.updateMany({
              where: {
                orderId: payment.mpOrderId,
                tenantId,
                saleId: null,
              },
              data: { saleId: newSale.id },
            });
          }
        }

        return newSale;
      });

      res.status(201).json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sales
 * Listar ventas con filtros
 */
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = saleQuerySchema.safeParse(req.query);
      if (!validation.success) {
        throw new ValidationError('Parámetros inválidos', validation.error.errors);
      }

      const params = validation.data;
      const tenantId = req.user!.tenantId;
      const skip = (parseInt(params.page) - 1) * parseInt(params.pageSize);
      const take = parseInt(params.pageSize);

      // Construir filtros
      const where: Record<string, unknown> = { tenantId };

      if (params.branchId) where.branchId = params.branchId;
      if (params.pointOfSaleId) where.pointOfSaleId = params.pointOfSaleId;
      if (params.userId) where.userId = params.userId;
      if (params.customerId) where.customerId = params.customerId;
      if (params.status) where.status = params.status;

      if (params.dateFrom || params.dateTo) {
        where.saleDate = {};
        if (params.dateFrom) {
          (where.saleDate as Record<string, Date>).gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          const endDate = new Date(params.dateTo);
          endDate.setHours(23, 59, 59, 999);
          (where.saleDate as Record<string, Date>).lte = endDate;
        }
      }

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true } },
            branch: { select: { id: true, code: true, name: true } },
            pointOfSale: { select: { id: true, code: true, name: true } },
            user: { select: { id: true, name: true } },
            afipInvoices: {
              select: {
                id: true,
                voucherType: true,
                number: true,
                salesPoint: { select: { number: true } }
              }
            },
            _count: { select: { items: true, payments: true } },
          },
          skip,
          take,
          orderBy: { saleDate: 'desc' },
        }),
        prisma.sale.count({ where }),
      ]);

      res.json({
        success: true,
        data: sales,
        pagination: {
          page: parseInt(params.page),
          pageSize: parseInt(params.pageSize),
          total,
          totalPages: Math.ceil(total / parseInt(params.pageSize)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sales/by-product/:identifier
 * Buscar ventas que contengan un producto específico
 * identifier puede ser: productId, barcode, sku, internalCode
 * Para flujo de devolución orientado a producto
 */
router.get(
  '/by-product/:identifier',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const identifier = req.params.identifier;
      const customerId = req.query.customerId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      // Buscar producto por identifier (puede ser id, barcode, sku, internal_code o nombre parcial)
      let product = await prisma.product.findFirst({
        where: {
          tenantId,
          OR: [
            { id: identifier },
            { barcode: identifier },
            { sku: identifier },
            { internalCode: identifier },
          ],
        },
      });

      // Si no se encuentra por código exacto, buscar por nombre (para devoluciones)
      if (!product) {
        product = await prisma.product.findFirst({
          where: {
            tenantId,
            name: { contains: identifier, mode: 'insensitive' },
          },
          orderBy: { name: 'asc' },
        });
      }

      if (!product) {
        throw new NotFoundError('Producto');
      }

      // Buscar ventas que contengan este producto
      const whereClause: Record<string, unknown> = {
        tenantId,
        status: { in: ['COMPLETED', 'PARTIAL_REFUND'] }, // Solo ventas que se pueden devolver
        items: {
          some: {
            productId: product.id,
          },
        },
      };

      // Si se especifica cliente, filtrar por cliente
      if (customerId) {
        whereClause.customerId = customerId;
      }

      const sales = await prisma.sale.findMany({
        where: whereClause,
        include: {
          customer: { select: { id: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          pointOfSale: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, name: true } },
          items: {
            where: { productId: product.id },
            include: {
              refundItems: {
                select: { quantity: true },
              },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
        take: limit,
      });

      // Calcular cantidades disponibles para devolución
      const salesWithAvailable = sales.map((sale) => {
        const itemsWithAvailable = sale.items.map((item: typeof sale.items[0]) => {
          const refundedQty = item.refundItems.reduce(
            (sum: number, r: { quantity: any }) => sum + Math.abs(Number(r.quantity)),
            0
          );
          const availableQty = Number(item.quantity) - refundedQty;
          return {
            ...item,
            refundedQuantity: refundedQty,
            availableQuantity: availableQty,
          };
        });

        return {
          ...sale,
          items: itemsWithAvailable,
        };
      });

      // Filtrar ventas que tienen cantidad disponible
      const salesWithAvailableRefund = salesWithAvailable.filter((sale) =>
        sale.items.some((item: { availableQuantity: number }) => item.availableQuantity > 0)
      );

      res.json({
        success: true,
        data: {
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            internalCode: product.internalCode,
          },
          sales: salesWithAvailableRefund,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sales/:id
 * Obtener venta por ID
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sale = await prisma.sale.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              combo: { select: { id: true, name: true, code: true } },
              promotion: { select: { id: true, name: true, code: true } },
            },
          },
          payments: true,
          customer: true,
          branch: true,
          pointOfSale: true,
          user: { select: { id: true, name: true, email: true } },
          afipInvoices: {
            include: {
              afipConfig: {
                select: {
                  cuit: true,
                  businessName: true,
                  tradeName: true,
                  address: true,
                  taxCategory: true,
                }
              },
              salesPoint: {
                select: { number: true }
              }
            }
          },
        },
      });

      if (!sale) {
        throw new NotFoundError('Venta');
      }

      res.json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sales/:id/cancel
 * Anular venta
 */
router.post(
  '/:id/cancel',
  authenticate,
  authorize('pos:cancel'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;

      if (!reason) {
        throw ApiError.badRequest('Debe indicar el motivo de la anulación');
      }

      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;

      const sale = await prisma.sale.findFirst({
        where: {
          id: req.params.id,
          tenantId,
        },
        include: { items: true },
      });

      if (!sale) {
        throw new NotFoundError('Venta');
      }

      if (sale.status === 'CANCELLED') {
        throw ApiError.badRequest('La venta ya está anulada');
      }

      // Anular venta y restaurar stock
      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: userId,
            cancelReason: reason,
          },
        });

        // Restaurar stock
        for (const item of sale.items) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });

            if (product?.trackStock) {
              await tx.productStock.updateMany({
                where: {
                  productId: item.productId,
                  branchId: sale.branchId,
                },
                data: {
                  quantity: { increment: item.quantity },
                  available: { increment: item.quantity },
                },
              });
            }
          }
        }

        // Marcar pagos como cancelados
        await tx.payment.updateMany({
          where: { saleId: sale.id },
          data: { status: 'CANCELLED' },
        });
      });

      res.json({ success: true, message: 'Venta anulada correctamente' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sales/daily-summary
 * Resumen de ventas del día
 */
router.get(
  '/reports/daily-summary',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const branchId = req.query.branchId as string;
      const pointOfSaleId = req.query.pointOfSaleId as string;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const where: Record<string, unknown> = {
        tenantId,
        saleDate: { gte: today },
        status: 'COMPLETED',
      };

      if (branchId) where.branchId = branchId;
      if (pointOfSaleId) where.pointOfSaleId = pointOfSaleId;

      // Totales generales
      const totals = await prisma.sale.aggregate({
        where,
        _sum: {
          total: true,
          discount: true,
          tax: true,
        },
        _count: true,
      });

      // Totales por método de pago
      const paymentsByMethod = await prisma.payment.groupBy({
        by: ['method'],
        where: {
          sale: where,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: true,
      });

      // Productos más vendidos
      const topProducts = await prisma.saleItem.groupBy({
        by: ['productId', 'productName'],
        where: {
          sale: where,
        },
        _sum: {
          quantity: true,
          subtotal: true,
        },
        orderBy: {
          _sum: { quantity: 'desc' },
        },
        take: 10,
      });

      res.json({
        success: true,
        data: {
          date: today.toISOString().slice(0, 10),
          salesCount: totals._count,
          totalSales: totals._sum.total || 0,
          totalDiscount: totals._sum.discount || 0,
          totalTax: totals._sum.tax || 0,
          paymentsByMethod: paymentsByMethod.map((p) => ({
            method: p.method,
            total: p._sum.amount || 0,
            count: p._count,
          })),
          topProducts: topProducts.map((p) => ({
            productId: p.productId,
            productName: p.productName,
            quantity: p._sum.quantity || 0,
            total: p._sum.subtotal || 0,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Schema de validación para devolución
const refundItemSchema = z.object({
  saleItemId: z.string(),
  quantity: z.number().positive(),
  reason: z.string().optional(),
});

const refundSchema = z.object({
  items: z.array(refundItemSchema).min(1, 'Debe incluir al menos un item a devolver'),
  reason: z.string().min(1, 'Debe indicar el motivo de la devolución'),
  emitCreditNote: z.boolean().default(true),
  salesPointId: z.string().optional(), // Para nota de crédito AFIP
  supervisorPin: z.string().length(4).optional(), // PIN de supervisor para autorización
});

/**
 * POST /api/sales/:id/refund
 * Procesar devolución parcial o total
 * Requiere permiso pos:refund o autorización de supervisor con PIN
 */
router.post(
  '/:id/refund',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = refundSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const userPermissions = req.user!.permissions || [];

      // Verificar permiso del usuario o autorización de supervisor
      const hasPermission = userPermissions.includes('pos:refund') || userPermissions.includes('*');
      let supervisorId: string | null = null;
      let supervisorName: string | null = null;

      if (!hasPermission) {
        // Si no tiene permiso, necesita PIN de supervisor
        if (!data.supervisorPin) {
          throw new AuthorizationError('No tienes permiso para realizar devoluciones. Solicita autorización de un supervisor.');
        }

        // Validar PIN de supervisor
        const supervisor = await prisma.user.findFirst({
          where: {
            tenantId,
            pin: data.supervisorPin,
            status: 'ACTIVE',
          },
          include: {
            role: true,
          },
        });

        if (!supervisor) {
          throw new AuthorizationError('PIN de supervisor inválido');
        }

        // Verificar que el supervisor tenga el permiso
        const supervisorPermissions = supervisor.role.permissions as string[];
        if (!supervisorPermissions.includes('pos:refund') && !supervisorPermissions.includes('*')) {
          throw new AuthorizationError('El supervisor no tiene permiso para autorizar devoluciones');
        }

        supervisorId = supervisor.id;
        supervisorName = supervisor.name;
        console.log(`[Refund] Autorizado por supervisor: ${supervisorName} (${supervisor.email})`);
      }

      // Obtener venta original con items y factura
      const originalSale = await prisma.sale.findFirst({
        where: {
          id: req.params.id,
          tenantId,
        },
        include: {
          items: true,
          payments: true,
          customer: true,
          branch: true,
          pointOfSale: true,
          afipInvoices: {
            include: {
              salesPoint: true,
              afipConfig: true,
            },
          },
        },
      });

      if (!originalSale) {
        throw new NotFoundError('Venta');
      }

      if (originalSale.status === 'CANCELLED') {
        throw ApiError.badRequest('No se puede devolver una venta anulada');
      }

      if (originalSale.status === 'REFUNDED') {
        throw ApiError.badRequest('Esta venta ya fue devuelta completamente');
      }

      // Validar items a devolver
      let refundTotal = new Prisma.Decimal(0);
      const itemsToRefund: Array<{
        originalItem: typeof originalSale.items[0];
        quantity: number;
        reason?: string;
      }> = [];

      for (const refundItem of data.items) {
        const originalItem = originalSale.items.find(
          (item) => item.id === refundItem.saleItemId
        );

        if (!originalItem) {
          throw ApiError.badRequest(
            `Item ${refundItem.saleItemId} no encontrado en la venta`
          );
        }

        // Calcular cantidad ya devuelta de este item
        const alreadyRefunded = await prisma.saleItem.aggregate({
          where: {
            originalItemId: originalItem.id,
            isReturn: true,
          },
          _sum: { quantity: true },
        });

        const refundedQty = Number(alreadyRefunded._sum.quantity || 0);
        const availableQty = Number(originalItem.quantity) - refundedQty;

        if (refundItem.quantity > availableQty) {
          throw ApiError.badRequest(
            `Solo se pueden devolver ${availableQty} unidades del item ${originalItem.productName}`
          );
        }

        // Calcular monto proporcional
        const unitPrice = Number(originalItem.subtotal) / Number(originalItem.quantity);
        const itemRefundAmount = unitPrice * refundItem.quantity;
        refundTotal = refundTotal.plus(itemRefundAmount);

        itemsToRefund.push({
          originalItem,
          quantity: refundItem.quantity,
          reason: refundItem.reason,
        });
      }

      // Determinar si es devolución total o parcial
      const isFullRefund = refundTotal.equals(originalSale.total);

      // Verificar si tiene factura AFIP y necesita nota de crédito
      const originalInvoice = originalSale.afipInvoices[0];
      let creditNoteResult = null;

      // Procesar en transacción
      const result = await prisma.$transaction(async (tx) => {
        // Crear venta de devolución (con valores negativos)
        const refundSale = await tx.sale.create({
          data: {
            tenantId,
            branchId: originalSale.branchId,
            pointOfSaleId: originalSale.pointOfSaleId,
            userId,
            customerId: originalSale.customerId,
            saleNumber: `DEV-${originalSale.saleNumber}`,
            receiptType: originalInvoice
              ? originalInvoice.voucherType.replace('FACTURA', 'CREDIT_NOTE') as any
              : 'TICKET',
            subtotal: refundTotal.negated(),
            discount: new Prisma.Decimal(0),
            tax: refundTotal.times(0.21 / 1.21).negated(),
            total: refundTotal.negated(),
            status: 'COMPLETED',
            notes: supervisorId
              ? `Devolución de venta ${originalSale.saleNumber}: ${data.reason} [Autorizado por: ${supervisorName}]`
              : `Devolución de venta ${originalSale.saleNumber}: ${data.reason}`,
            originalSaleId: originalSale.id,
            items: {
              create: itemsToRefund.map((item) => ({
                productId: item.originalItem.productId,
                productCode: item.originalItem.productCode,
                productName: item.originalItem.productName,
                productBarcode: item.originalItem.productBarcode,
                quantity: -item.quantity,
                unitPrice: Number(item.originalItem.unitPrice),
                unitPriceNet: Number(item.originalItem.unitPriceNet),
                discount: 0,
                subtotal: new Prisma.Decimal(
                  (Number(item.originalItem.subtotal) / Number(item.originalItem.quantity)) *
                    item.quantity
                ).negated(),
                taxRate: Number(item.originalItem.taxRate),
                taxAmount: new Prisma.Decimal(
                  (Number(item.originalItem.taxAmount) / Number(item.originalItem.quantity)) *
                    item.quantity
                ).negated(),
                isReturn: true,
                originalItemId: item.originalItem.id,
              })),
            },
            payments: {
              create: [
                {
                  method: 'CREDIT', // Crédito a favor del cliente
                  amount: refundTotal.negated().toNumber(),
                  status: 'COMPLETED',
                  reference: `Devolución de ${originalSale.saleNumber}`,
                },
              ],
            },
          },
          include: {
            items: true,
            payments: true,
          },
        });

        // Actualizar estado de venta original
        await tx.sale.update({
          where: { id: originalSale.id },
          data: {
            status: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
          },
        });

        // Restaurar stock
        for (const item of itemsToRefund) {
          if (item.originalItem.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.originalItem.productId },
            });

            if (product?.trackStock) {
              await tx.productStock.updateMany({
                where: {
                  productId: item.originalItem.productId,
                  branchId: originalSale.branchId,
                },
                data: {
                  quantity: { increment: item.quantity },
                  available: { increment: item.quantity },
                },
              });
            }
          }
        }

        return refundSale;
      });

      // Emitir nota de crédito AFIP si corresponde
      if (data.emitCreditNote && originalInvoice) {
        const { AfipService } = await import('../services/afip.service.js');
        const afipService = new AfipService();

        // Determinar tipo de nota de crédito según factura original
        const voucherType = originalInvoice.voucherType;
        let creditNoteMethod: 'createCreditNoteA' | 'createCreditNoteB' | 'createCreditNoteC';

        if (voucherType === 'FACTURA_A') {
          creditNoteMethod = 'createCreditNoteA';
        } else if (voucherType === 'FACTURA_C') {
          creditNoteMethod = 'createCreditNoteC';
        } else {
          creditNoteMethod = 'createCreditNoteB';
        }

        creditNoteResult = await afipService[creditNoteMethod](
          tenantId,
          data.salesPointId || originalInvoice.salesPointId,
          originalInvoice.id,
          refundTotal.toNumber(),
          result.id // saleId de la devolución
        );

        if (!creditNoteResult.success) {
          // La devolución se procesó pero la nota de crédito falló
          // Registramos el error pero no revertimos la devolución
          console.error('Error emitiendo nota de crédito:', creditNoteResult.error);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          refundSale: result,
          creditNote: creditNoteResult?.invoiceId ? {
            id: creditNoteResult.invoiceId,
            cae: creditNoteResult.cae,
            caeExpiration: creditNoteResult.caeExpiration,
            voucherNumber: creditNoteResult.voucherNumber,
          } : null,
          isFullRefund,
          refundAmount: refundTotal.toNumber(),
        },
        message: isFullRefund
          ? 'Devolución total procesada correctamente'
          : 'Devolución parcial procesada correctamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sales/:id/refunds
 * Obtener devoluciones de una venta
 */
router.get(
  '/:id/refunds',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const refunds = await prisma.sale.findMany({
        where: {
          originalSaleId: req.params.id,
          tenantId,
        },
        include: {
          items: true,
          afipInvoices: {
            include: {
              salesPoint: true,
            },
          },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: refunds });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
