import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize, AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// PAGOS MP HUÉRFANOS (Processed sin venta)
// =============================================

/**
 * GET /api/backoffice/mp-orders/search
 * Buscar órdenes de MP por paymentId, orderId o externalReference
 */
router.get('/mp-orders/search', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { paymentId, orderId, reference } = req.query;

    const where: Record<string, unknown> = { tenantId };
    if (paymentId) where.paymentId = paymentId as string;
    if (orderId) where.orderId = orderId as string;
    if (reference) where.externalReference = { contains: reference as string };

    const orders = await prisma.mercadoPagoOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backoffice/mp-orphan-orders
 * Lista órdenes de MP procesadas que no tienen venta asociada
 * Excluye órdenes cuyo paymentId ya existe en algún Payment de una Sale
 */
router.get('/mp-orphan-orders', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // Buscar órdenes sin saleId (incluir varios estados que indican pago completado)
    const orphanOrders = await prisma.mercadoPagoOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PROCESSED', 'COMPLETED', 'APPROVED'] },
        saleId: null,
      },
      orderBy: { processedAt: 'desc' },
    });

    // Filtrar las que ya tienen un Payment vinculado a una Sale
    const trueOrphans = [];
    for (const order of orphanOrders) {
      let linkedSaleId: string | null = null;

      // 1. Buscar por paymentId en Payment.transactionId
      if (order.paymentId) {
        const existingPayment = await prisma.payment.findFirst({
          where: {
            transactionId: order.paymentId,
            sale: { tenantId },
          },
          include: { sale: { select: { id: true } } },
        });
        if (existingPayment?.sale) {
          linkedSaleId = existingPayment.sale.id;
        }
      }

      // 2. Buscar por orderId en Payment.transactionId
      if (!linkedSaleId) {
        const paymentByOrderId = await prisma.payment.findFirst({
          where: {
            transactionId: order.orderId,
            sale: { tenantId },
          },
          include: { sale: { select: { id: true } } },
        });
        if (paymentByOrderId?.sale) {
          linkedSaleId = paymentByOrderId.sale.id;
        }
      }

      // 3. Buscar por externalReference en Payment.transactionId
      if (!linkedSaleId && order.externalReference) {
        const paymentByRef = await prisma.payment.findFirst({
          where: {
            transactionId: order.externalReference,
            sale: { tenantId },
          },
          include: { sale: { select: { id: true } } },
        });
        if (paymentByRef?.sale) {
          linkedSaleId = paymentByRef.sale.id;
        }
      }

      if (linkedSaleId) {
        // Auto-vincular el MercadoPagoOrder a la Sale
        await prisma.mercadoPagoOrder.update({
          where: { id: order.id },
          data: { saleId: linkedSaleId },
        });
        // No agregar a la lista de huérfanos
        continue;
      }

      trueOrphans.push(order);
    }

    res.json({
      success: true,
      data: trueOrphans,
      count: trueOrphans.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backoffice/mp-orphan-orders/:orderId/create-sale
 * Crea una venta a partir de un pago huérfano
 * Body: { items: [{ productId, quantity, unitPrice }], customerId? }
 */
const createSaleFromOrphanSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().min(0).optional().default(0),
  })).min(1, 'Debe incluir al menos un producto'),
  customerId: z.string().optional(),
  notes: z.string().optional(),
});

router.post(
  '/mp-orphan-orders/:orderId/create-sale',
  authorize('pos:sell', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const branchId = req.user!.branchId;
      const { orderId } = req.params;

      // Validar body
      const validation = createSaleFromOrphanSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { items, customerId, notes } = validation.data;

      // Buscar la orden huérfana
      const mpOrder = await prisma.mercadoPagoOrder.findFirst({
        where: {
          orderId,
          tenantId,
          status: 'PROCESSED',
          saleId: null,
        },
      });

      if (!mpOrder) {
        throw new ApiError(404, 'NOT_FOUND', 'Orden de pago no encontrada o ya tiene venta asociada');
      }

      if (!branchId) {
        throw new ApiError(400, 'BAD_REQUEST', 'Usuario no tiene sucursal asignada');
      }

      // Buscar un punto de venta de la sucursal
      const pointOfSale = await prisma.pointOfSale.findFirst({
        where: { tenantId, branchId, isActive: true },
      });

      if (!pointOfSale) {
        throw new ApiError(400, 'BAD_REQUEST', 'No hay punto de venta disponible');
      }

      // Calcular totales
      let subtotal = 0;
      let totalDiscount = 0;

      const saleItems: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        subtotal: number;
        total: number;
        taxRate: number;
      }> = [];
      for (const item of items) {
        const product = await prisma.product.findFirst({
          where: { id: item.productId, tenantId },
        });

        if (!product) {
          throw new ApiError(404, 'NOT_FOUND', `Producto ${item.productId} no encontrado`);
        }

        const itemSubtotal = item.quantity * item.unitPrice;
        const itemDiscount = item.discount || 0;
        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;

        saleItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: itemDiscount,
          subtotal: itemSubtotal,
          total: itemSubtotal - itemDiscount,
          taxRate: Number(product.taxRate) || 21,
        });
      }

      const total = subtotal - totalDiscount;

      // Validar que el total coincida con el monto del pago MP
      const mpAmount = Number(mpOrder.amount);
      const tolerance = 0.01; // Tolerancia de 1 centavo por redondeos
      if (Math.abs(total - mpAmount) > tolerance) {
        throw new ApiError(
          400,
          'AMOUNT_MISMATCH',
          `El total de la venta ($${total.toFixed(2)}) no coincide con el pago MP ($${mpAmount.toFixed(2)})`
        );
      }

      // Generar número de venta
      const lastSale = await prisma.sale.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { saleNumber: true },
      });

      let nextNumber = 1;
      if (lastSale?.saleNumber) {
        const match = lastSale.saleNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const saleNumber = `T-0001-${nextNumber.toString().padStart(8, '0')}`;

      // Crear la venta con transacción
      const sale = await prisma.$transaction(async (tx) => {
        // Crear venta
        const newSale = await tx.sale.create({
          data: {
            tenantId,
            branchId,
            pointOfSaleId: pointOfSale.id,
            userId,
            customerId: customerId || null,
            saleNumber,
            receiptType: 'TICKET',
            subtotal,
            discount: totalDiscount,
            tax: 0,
            total,
            status: 'COMPLETED',
            notes: notes || `Venta recuperada de pago MP ${orderId}`,
            metadata: { recoveredFromMPOrder: orderId },
            saleDate: mpOrder.processedAt || new Date(),
            items: {
              create: saleItems,
            },
            payments: {
              create: {
                method: mpOrder.paymentMethod === 'debit_card' ? 'DEBIT_CARD' : 'CREDIT_CARD',
                amount: Number(mpOrder.amount),
                transactionId: mpOrder.paymentId || orderId,
                cardBrand: mpOrder.cardBrand,
                cardLastFour: mpOrder.cardLastFour,
                installments: mpOrder.installments || 1,
              },
            },
          },
          include: {
            items: { include: { product: { select: { id: true, name: true, sku: true } } } },
            payments: true,
            customer: true,
          },
        });

        // Vincular orden MP a la venta
        await tx.mercadoPagoOrder.update({
          where: { id: mpOrder.id },
          data: { saleId: newSale.id },
        });

        return newSale;
      });

      res.status(201).json({
        success: true,
        data: sale,
        message: `Venta ${saleNumber} creada exitosamente`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/backoffice/mp-orphan-orders/:orderId/link-sale
 * Vincula un pago huérfano a una venta existente
 * Body: { saleId }
 */
const linkSaleSchema = z.object({
  saleId: z.string().min(1, 'El ID de venta es requerido'),
});

router.post(
  '/mp-orphan-orders/:orderId/link-sale',
  authorize('pos:sell', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { orderId } = req.params;

      const validation = linkSaleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { saleId } = validation.data;

      // Verificar orden huérfana
      const mpOrder = await prisma.mercadoPagoOrder.findFirst({
        where: {
          orderId,
          tenantId,
          status: 'PROCESSED',
          saleId: null,
        },
      });

      if (!mpOrder) {
        throw new ApiError(404, 'NOT_FOUND', 'Orden de pago no encontrada o ya tiene venta asociada');
      }

      // Verificar venta
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, tenantId },
      });

      if (!sale) {
        throw new ApiError(404, 'NOT_FOUND', 'Venta no encontrada');
      }

      // Validar que el total coincida con el monto del pago MP
      const mpAmount = Number(mpOrder.amount);
      const saleTotal = Number(sale.total);
      const tolerance = 0.01;
      if (Math.abs(saleTotal - mpAmount) > tolerance) {
        throw new ApiError(
          400,
          'AMOUNT_MISMATCH',
          `El total de la venta ($${saleTotal.toFixed(2)}) no coincide con el pago MP ($${mpAmount.toFixed(2)})`
        );
      }

      // Vincular
      await prisma.mercadoPagoOrder.update({
        where: { id: mpOrder.id },
        data: { saleId },
      });

      res.json({
        success: true,
        message: `Orden ${orderId} vinculada a venta ${sale.saleNumber}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/backoffice/mp-orphan-orders/:orderId
 * Descarta un pago huérfano (lo marca como DISMISSED sin crear venta)
 */
router.delete(
  '/mp-orphan-orders/:orderId',
  authorize('pos:sell', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { orderId } = req.params;

      // Buscar la orden huérfana
      const mpOrder = await prisma.mercadoPagoOrder.findFirst({
        where: {
          orderId,
          tenantId,
          status: 'PROCESSED',
          saleId: null,
        },
      });

      if (!mpOrder) {
        throw new ApiError(404, 'NOT_FOUND', 'Orden de pago no encontrada o ya tiene venta asociada');
      }

      // Marcar como descartada (cambiar status a DISMISSED)
      await prisma.mercadoPagoOrder.update({
        where: { id: mpOrder.id },
        data: { status: 'DISMISSED' },
      });

      res.json({
        success: true,
        message: `Orden ${orderId} descartada`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/backoffice/mp-orphan-orders/sync
 * Busca pagos en MP que tengan external_reference con patrón "POS-"
 * y los importa como órdenes huérfanas si no existen en la DB
 */
router.post(
  '/mp-orphan-orders/sync',
  authorize('pos:sell', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      // Obtener config de MP (QR primero, luego Point)
      let mpConfig = await prisma.mercadoPagoConfig.findFirst({
        where: { tenantId, appType: 'QR', isActive: true },
      });

      if (!mpConfig) {
        mpConfig = await prisma.mercadoPagoConfig.findFirst({
          where: { tenantId, appType: 'POINT', isActive: true },
        });
      }

      if (!mpConfig) {
        throw new ApiError(400, 'MP_NOT_CONFIGURED', 'No hay configuración de Mercado Pago activa');
      }

      // Buscar pagos aprobados en MP (últimos 100)
      const searchUrl = new URL('https://api.mercadopago.com/v1/payments/search');
      searchUrl.searchParams.set('sort', 'date_created');
      searchUrl.searchParams.set('criteria', 'desc');
      searchUrl.searchParams.set('status', 'approved');
      searchUrl.searchParams.set('limit', '100');

      console.log('[MP Sync] Buscando pagos en:', searchUrl.toString());

      const mpResponse = await fetch(searchUrl.toString(), {
        headers: { Authorization: `Bearer ${mpConfig.accessToken}` },
      });

      if (!mpResponse.ok) {
        const errorText = await mpResponse.text();
        console.error('[MP Sync] Error buscando pagos:', mpResponse.status, errorText);
        throw new ApiError(500, 'MP_API_ERROR', `Error al consultar Mercado Pago: ${mpResponse.status}`);
      }

      interface MPPaymentResult {
        id: number;
        status: string;
        external_reference?: string;
        transaction_amount: number;
        payment_method_id?: string;
        payment_method?: { id?: string };
        card?: { last_four_digits?: string };
        installments?: number;
        date_approved?: string;
      }

      const mpData = await mpResponse.json() as { results: MPPaymentResult[] };

      // Filtrar solo los que tienen external_reference con patrón "POS-"
      const posPayments = mpData.results.filter(
        (p: MPPaymentResult) => p.external_reference?.startsWith('POS-')
      );

      console.log(`[MP Sync] Encontrados ${posPayments.length} pagos con patrón POS-`);

      // Obtener órdenes existentes en nuestra DB
      const existingOrders = await prisma.mercadoPagoOrder.findMany({
        where: { tenantId },
        select: { id: true, paymentId: true, externalReference: true, status: true },
      });

      const existingByPaymentId = new Map(existingOrders.filter(o => o.paymentId).map(o => [o.paymentId, o]));
      const existingByRef = new Map(existingOrders.map(o => [o.externalReference, o]));

      const imported: Array<{ paymentId: string; externalReference: string; amount: number; action: string }> = [];
      let updated = 0;
      let created = 0;

      for (const payment of posPayments) {
        try {
          const paymentIdStr = payment.id.toString();
          const extRef = payment.external_reference || '';

          // Ya existe con este paymentId? (ya procesado completamente)
          if (existingByPaymentId.has(paymentIdStr)) {
            continue;
          }

          // Existe por externalReference pero sin paymentId? (orden QR pendiente)
          const existingByRefOrder = existingByRef.get(extRef);
          if (existingByRefOrder && !existingByRefOrder.paymentId) {
            // Actualizar el registro existente con los datos del pago
            await prisma.mercadoPagoOrder.update({
              where: { id: existingByRefOrder.id },
              data: {
                status: 'PROCESSED',
                paymentId: paymentIdStr,
                paymentMethod: payment.payment_method_id,
                cardBrand: payment.payment_method?.id,
                cardLastFour: payment.card?.last_four_digits,
                installments: payment.installments,
                processedAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
              },
            });

            imported.push({
              paymentId: paymentIdStr,
              externalReference: extRef,
              amount: payment.transaction_amount,
              action: 'updated',
            });
            updated++;
            continue;
          }

          // Ya existe completamente por externalReference (ya procesado)
          if (existingByRefOrder) {
            continue;
          }

          // Crear nuevo registro
          await prisma.mercadoPagoOrder.create({
            data: {
              tenantId,
              orderId: paymentIdStr,
              externalReference: extRef || `SYNC-${payment.id}`,
              deviceId: 'MP-SYNC',
              amount: payment.transaction_amount,
              status: 'PROCESSED',
              paymentId: paymentIdStr,
              paymentMethod: payment.payment_method_id,
              cardBrand: payment.payment_method?.id,
              cardLastFour: payment.card?.last_four_digits,
              installments: payment.installments,
              processedAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
            },
          });

          imported.push({
            paymentId: paymentIdStr,
            externalReference: extRef,
            amount: payment.transaction_amount,
            action: 'created',
          });
          created++;
        } catch (err) {
          console.error(`[MP Sync] Error procesando pago ${payment.id}:`, err);
        }
      }

      console.log(`[MP Sync] Resultado: ${created} creados, ${updated} actualizados`);

      res.json({
        success: true,
        message: `Sincronización completada: ${created} creados, ${updated} actualizados`,
        data: {
          totalFound: posPayments.length,
          alreadyExists: posPayments.length - imported.length,
          imported: imported.length,
          created,
          updated,
          payments: imported,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// SUCURSALES - Gestión
// =============================================

/**
 * Eliminar sucursales no mapeadas a Cianbox
 * Migra las dependencias a la sucursal mapeada más cercana
 * DELETE /api/backoffice/branches/cleanup-unmapped
 */
router.delete('/branches/cleanup-unmapped',
  authorize('admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // Buscar sucursales sin cianboxBranchId
    const unmappedBranches = await prisma.branch.findMany({
      where: { tenantId, cianboxBranchId: null },
      include: {
        _count: {
          select: {
            pointsOfSale: true,
            users: true,
            productStock: true,
            sales: true,
          },
        },
      },
    });

    if (unmappedBranches.length === 0) {
      return res.json({
        success: true,
        message: 'No hay sucursales sin mapear',
        deleted: 0,
      });
    }

    // Buscar sucursal mapeada (preferir la default o la primera)
    const targetBranch = await prisma.branch.findFirst({
      where: {
        tenantId,
        cianboxBranchId: { not: null },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (!targetBranch) {
      throw new ApiError(400, 'NO_MAPPED_BRANCH', 'No hay sucursales mapeadas a Cianbox. Sincronice primero.');
    }

    const results = {
      deleted: 0,
      migratedPointsOfSale: 0,
      migratedUsers: 0,
      deletedStock: 0,
      targetBranch: {
        id: targetBranch.id,
        name: targetBranch.name,
        cianboxBranchId: targetBranch.cianboxBranchId,
      },
    };

    for (const branch of unmappedBranches) {
      console.log(`[Cleanup] Procesando sucursal sin mapear: ${branch.name} (${branch.id})`);

      // Migrar puntos de venta
      if (branch._count.pointsOfSale > 0) {
        await prisma.pointOfSale.updateMany({
          where: { branchId: branch.id },
          data: { branchId: targetBranch.id },
        });
        results.migratedPointsOfSale += branch._count.pointsOfSale;
        console.log(`[Cleanup] Migrados ${branch._count.pointsOfSale} puntos de venta`);
      }

      // Migrar usuarios
      if (branch._count.users > 0) {
        await prisma.user.updateMany({
          where: { branchId: branch.id },
          data: { branchId: targetBranch.id },
        });
        results.migratedUsers += branch._count.users;
        console.log(`[Cleanup] Migrados ${branch._count.users} usuarios`);
      }

      // Eliminar stock huérfano (no debería haber, pero por seguridad)
      if (branch._count.productStock > 0) {
        await prisma.productStock.deleteMany({
          where: { branchId: branch.id },
        });
        results.deletedStock += branch._count.productStock;
        console.log(`[Cleanup] Eliminados ${branch._count.productStock} registros de stock huérfano`);
      }

      // Migrar ventas a la sucursal destino
      if (branch._count.sales > 0) {
        await prisma.sale.updateMany({
          where: { branchId: branch.id },
          data: { branchId: targetBranch.id },
        });
        console.log(`[Cleanup] Migradas ${branch._count.sales} ventas de ${branch.name}`);
      }

      // Migrar items de venta (tienen branchId propio)
      const saleItemsUpdated = await prisma.saleItem.updateMany({
        where: { branchId: branch.id },
        data: { branchId: targetBranch.id },
      });
      if (saleItemsUpdated.count > 0) {
        console.log(`[Cleanup] Migrados ${saleItemsUpdated.count} items de venta`);
      }

      // Migrar sesiones de caja
      const cashSessionsUpdated = await prisma.cashSession.updateMany({
        where: { branchId: branch.id },
        data: { branchId: targetBranch.id },
      });
      if (cashSessionsUpdated.count > 0) {
        console.log(`[Cleanup] Migradas ${cashSessionsUpdated.count} sesiones de caja`);
      }

      // Migrar cajas registradoras
      const cashRegistersUpdated = await prisma.cashRegister.updateMany({
        where: { branchId: branch.id },
        data: { branchId: targetBranch.id },
      });
      if (cashRegistersUpdated.count > 0) {
        console.log(`[Cleanup] Migradas ${cashRegistersUpdated.count} cajas registradoras`);
      }

      // Eliminar la sucursal
      await prisma.branch.delete({
        where: { id: branch.id },
      });
      results.deleted++;
      console.log(`[Cleanup] Sucursal ${branch.name} eliminada`);
    }

    res.json({
      success: true,
      message: `Limpieza completada. ${results.deleted} sucursales eliminadas.`,
      results,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// DIAGNOSTICO - Stock por Sucursal
// =============================================

/**
 * Endpoint de diagnóstico para verificar el mapeo de sucursales y stock
 * GET /api/backoffice/diagnostics/branch-stock
 */
router.get('/diagnostics/branch-stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // Obtener todas las sucursales del tenant
    const branches = await prisma.branch.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        cianboxBranchId: true,
        isActive: true,
        _count: {
          select: {
            productStock: true,
            pointsOfSale: true,
          },
        },
      },
      orderBy: { cianboxBranchId: 'asc' },
    });

    // Obtener total de stock por sucursal
    const stockByBranch = await prisma.productStock.groupBy({
      by: ['branchId'],
      where: {
        product: { tenantId },
      },
      _sum: {
        available: true,
        quantity: true,
      },
      _count: true,
    });

    // Combinar datos
    const diagnostics = branches.map((branch) => {
      const stockData = stockByBranch.find((s) => s.branchId === branch.id);
      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        city: branch.city,
        state: branch.state,
        phone: branch.phone,
        cianboxBranchId: branch.cianboxBranchId,
        isActive: branch.isActive,
        pointsOfSaleCount: branch._count.pointsOfSale,
        productStockCount: branch._count.productStock,
        stockStats: stockData ? {
          productsWithStock: stockData._count,
          totalQuantity: Number(stockData._sum.quantity || 0),
          totalAvailable: Number(stockData._sum.available || 0),
        } : {
          productsWithStock: 0,
          totalQuantity: 0,
          totalAvailable: 0,
        },
        hasCianboxMapping: branch.cianboxBranchId !== null,
      };
    });

    res.json({
      success: true,
      data: {
        branches: diagnostics,
        summary: {
          totalBranches: branches.length,
          mappedToCianbox: branches.filter((b) => b.cianboxBranchId !== null).length,
          unmapped: branches.filter((b) => b.cianboxBranchId === null).length,
          withStock: diagnostics.filter((d) => d.productStockCount > 0).length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
