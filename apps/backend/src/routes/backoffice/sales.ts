import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import { AfipService } from '../../services/afip.service.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// SALES (Ventas)
// =============================================

// Listar ventas
router.get('/sales', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page = '1', pageSize = '20', status, dateFrom, dateTo, cianboxSyncStatus } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = parseInt(pageSize as string);

    const where: Record<string, unknown> = { tenantId };

    if (status) {
      where.status = status;
    }

    if (cianboxSyncStatus) {
      where.cianboxSyncStatus = cianboxSyncStatus;
    }

    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) {
        (where.saleDate as Record<string, Date>).gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        const endDate = new Date(dateTo as string);
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
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Obtener venta por ID
router.get('/sales/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                cianboxProductId: true,
                taxRate: true,
              },
            },
            combo: { select: { id: true, name: true, code: true } },
            promotion: { select: { id: true, name: true, code: true } },
          },
        },
        payments: {
          include: {
            storeCredit: {
              select: {
                id: true,
                code: true,
                originalAmount: true,
                currentBalance: true,
                status: true,
              },
            },
            cardTerminal: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        customer: true,
        branch: true,
        pointOfSale: true,
        user: { select: { id: true, name: true, email: true } },
        cashSession: {
          select: {
            id: true,
            sessionNumber: true,
            status: true,
            openedAt: true,
            closedAt: true,
            user: { select: { id: true, name: true } },
            pointOfSale: { select: { id: true, name: true, code: true } },
          },
        },
        // Venta original (si es una devolución)
        originalSale: {
          select: {
            id: true,
            saleNumber: true,
            total: true,
          },
        },
        // Devoluciones asociadas (si es una venta)
        refunds: {
          select: {
            id: true,
            saleNumber: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        // Facturas AFIP (factura electrónica o nota de crédito)
        afipInvoices: {
          include: {
            salesPoint: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sale) {
      throw new ApiError(404, 'NOT_FOUND', 'Venta no encontrada');
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
});

// Imprimir factura electrónica
router.get('/invoices/:id/print', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Obtener la factura con todos los datos necesarios
    const invoice = await prisma.afipInvoice.findFirst({
      where: { id, tenantId },
      include: {
        salesPoint: true,
        sale: {
          include: {
            items: true,
            customer: true,
            branch: true,
          },
        },
        afipConfig: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', 'Factura no encontrada');
    }

    const tenant = invoice.afipConfig.tenant;
    const sale = invoice.sale;

    // Formatear fecha
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // Formatear moneda
    const formatCurrency = (amount: number | any) => {
      const num = typeof amount === 'object' ? Number(amount) : amount;
      return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    };

    // Determinar tipo de comprobante para mostrar
    const voucherTypeLabels: Record<string, string> = {
      'FACTURA_A': 'FACTURA A',
      'FACTURA_B': 'FACTURA B',
      'FACTURA_C': 'FACTURA C',
      'CREDIT_NOTE_A': 'NOTA DE CRÉDITO A',
      'CREDIT_NOTE_B': 'NOTA DE CRÉDITO B',
      'CREDIT_NOTE_C': 'NOTA DE CRÉDITO C',
    };

    const voucherLabel = voucherTypeLabels[invoice.voucherType] || invoice.voucherType;
    const isCreditNote = invoice.voucherType.includes('CREDIT');
    const voucherLetter = invoice.voucherType.includes('_A') ? 'A' : invoice.voucherType.includes('_B') ? 'B' : 'C';

    // Número de comprobante formateado
    const ptoVta = String(invoice.salesPoint.number).padStart(5, '0');
    const nroComp = String(invoice.number).padStart(8, '0');

    // Datos del receptor
    const docTypeLabels: Record<string, string> = {
      '80': 'CUIT',
      '96': 'DNI',
      '99': 'Consumidor Final',
    };
    const docTypeLabel = docTypeLabels[invoice.receiverDocType] || 'Doc.';

    // Condición IVA del receptor
    const taxCategoryLabels: Record<string, string> = {
      '1': 'IVA Responsable Inscripto',
      '4': 'IVA Sujeto Exento',
      '5': 'Consumidor Final',
      '6': 'Responsable Monotributo',
      '8': 'Proveedor del Exterior',
      '9': 'Cliente del Exterior',
      '10': 'IVA Liberado',
      '13': 'Monotributista Social',
      '15': 'IVA No Alcanzado',
    };
    const receiverTaxCategoryLabel = taxCategoryLabels[invoice.receiverTaxCategory || '5'] || invoice.receiverTaxCategory || 'Consumidor Final';

    // Generar datos para QR de AFIP
    // Tipos de comprobante AFIP
    const voucherTypeCodes: Record<string, number> = {
      'FACTURA_A': 1,
      'FACTURA_B': 6,
      'FACTURA_C': 11,
      'CREDIT_NOTE_A': 3,
      'CREDIT_NOTE_B': 8,
      'CREDIT_NOTE_C': 13,
    };

    const qrData = {
      ver: 1,
      fecha: new Date(invoice.issueDate).toISOString().split('T')[0],
      cuit: parseInt(invoice.afipConfig.cuit.replace(/\D/g, '')),
      ptoVta: invoice.salesPoint.number,
      tipoCmp: voucherTypeCodes[invoice.voucherType] || 11,
      nroCmp: invoice.number,
      importe: Number(invoice.totalAmount),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: parseInt(invoice.receiverDocType) || 99,
      nroDocRec: parseInt(invoice.receiverDocNum.replace(/\D/g, '')) || 0,
      tipoCodAut: 'E',
      codAut: parseInt(invoice.cae),
    };

    const qrBase64 = Buffer.from(JSON.stringify(qrData)).toString('base64');
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;

    // Generar QR como data URL base64
    const qrImageUrl = await QRCode.toDataURL(qrUrl, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Generar HTML de la factura
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${voucherLabel} ${ptoVta}-${nroComp}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      border: 2px solid #000;
      margin-bottom: 10px;
    }
    .header-left, .header-right {
      flex: 1;
      padding: 15px;
    }
    .header-center {
      width: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-left: 2px solid #000;
      border-right: 2px solid #000;
    }
    .voucher-letter {
      font-size: 48px;
      font-weight: bold;
      line-height: 1;
    }
    .voucher-code {
      font-size: 10px;
      margin-top: 5px;
    }
    .company-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .voucher-type {
      font-size: 16px;
      font-weight: bold;
      text-align: right;
    }
    .voucher-number {
      font-size: 14px;
      text-align: right;
      margin-top: 5px;
    }
    .info-row {
      display: flex;
      border: 1px solid #000;
      border-top: none;
    }
    .info-col {
      flex: 1;
      padding: 8px;
      border-right: 1px solid #000;
    }
    .info-col:last-child {
      border-right: none;
    }
    .info-label {
      font-weight: bold;
      font-size: 10px;
      color: #666;
    }
    .receptor {
      border: 1px solid #000;
      border-top: none;
      padding: 10px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .items-table th, .items-table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    .items-table th {
      background: #f0f0f0;
      font-weight: bold;
    }
    .items-table .number {
      text-align: right;
    }
    .totals {
      margin-top: 15px;
      border: 1px solid #000;
      padding: 10px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    .totals-row.total {
      font-size: 16px;
      font-weight: bold;
      border-top: 1px solid #000;
      padding-top: 8px;
      margin-top: 5px;
    }
    .cae-section {
      margin-top: 15px;
      border: 1px solid #000;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cae-info { flex: 1; }
    .cae-label { font-weight: bold; }
    .qr-placeholder {
      width: 100px;
      height: 100px;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #999;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    .print-btn:hover { background: #45a049; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir</button>

  <div class="header">
    <div class="header-left">
      <div class="company-name">${invoice.afipConfig.businessName}</div>
      <div>Razón Social: ${invoice.afipConfig.businessName}</div>
      <div>Domicilio: ${invoice.afipConfig.address || '-'}</div>
      <div>Condición IVA: ${invoice.afipConfig.taxCategory === 'RESPONSABLE_INSCRIPTO' ? 'IVA Responsable Inscripto' : invoice.afipConfig.taxCategory}</div>
    </div>
    <div class="header-center">
      <div class="voucher-letter">${voucherLetter}</div>
      <div class="voucher-code">Cód. ${invoice.voucherType.includes('_A') ? '01' : invoice.voucherType.includes('_B') ? '06' : '11'}</div>
    </div>
    <div class="header-right">
      <div class="voucher-type">${voucherLabel}</div>
      <div class="voucher-number">Nº ${ptoVta}-${nroComp}</div>
      <div style="margin-top: 10px;">
        <div>Fecha: ${formatDate(invoice.issueDate)}</div>
        <div>CUIT: ${invoice.afipConfig.cuit}</div>
        <div>Inicio Act.: ${invoice.afipConfig.activityStartDate ? formatDate(invoice.afipConfig.activityStartDate) : '-'}</div>
      </div>
    </div>
  </div>

  <div class="receptor">
    <div style="display: flex; gap: 20px;">
      <div style="flex: 1;">
        <span class="info-label">${docTypeLabel}:</span> ${invoice.receiverDocNum}
      </div>
      <div style="flex: 2;">
        <span class="info-label">Apellido y Nombre / Razón Social:</span> ${invoice.receiverName || 'CONSUMIDOR FINAL'}
      </div>
    </div>
    <div style="margin-top: 5px;">
      <span class="info-label">Condición IVA:</span> ${receiverTaxCategoryLabel}
      <span style="margin-left: 20px;"><span class="info-label">Condición de Venta:</span> Contado</span>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 50px;">Cant.</th>
        <th>Descripción</th>
        <th style="width: 100px;" class="number">Precio Unit.</th>
        ${voucherLetter === 'A' ? '<th style="width: 60px;" class="number">% IVA</th>' : ''}
        <th style="width: 100px;" class="number">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${sale?.items.map(item => `
        <tr>
          <td class="number">${Number(item.quantity)}</td>
          <td>${item.productName}</td>
          <td class="number">${formatCurrency(item.unitPrice)}</td>
          ${voucherLetter === 'A' ? `<td class="number">${Number(item.taxRate)}%</td>` : ''}
          <td class="number">${formatCurrency(item.subtotal)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5">Sin items</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    ${voucherLetter === 'A' ? `
      <div class="totals-row">
        <span>Subtotal Neto Gravado:</span>
        <span>${formatCurrency(invoice.netAmount)}</span>
      </div>
      <div class="totals-row">
        <span>IVA 21%:</span>
        <span>${formatCurrency(invoice.taxAmount)}</span>
      </div>
      ${Number(invoice.exemptAmount) > 0 ? `
        <div class="totals-row">
          <span>Exento:</span>
          <span>${formatCurrency(invoice.exemptAmount)}</span>
        </div>
      ` : ''}
    ` : ''}
    <div class="totals-row total">
      <span>TOTAL:</span>
      <span>${formatCurrency(invoice.totalAmount)}</span>
    </div>
  </div>

  <div class="cae-section">
    <div class="cae-info">
      <div><span class="cae-label">CAE:</span> ${invoice.cae}</div>
      <div><span class="cae-label">Vto. CAE:</span> ${formatDate(invoice.caeExpiration)}</div>
    </div>
    <div>
      <img src="${qrImageUrl}" alt="QR AFIP" style="width: 120px; height: 120px;" />
    </div>
  </div>

  <div class="footer">
    <p>Comprobante emitido por sistema - ${invoice.afipConfig.businessName}</p>
    <p>Este documento es una representación impresa de un comprobante electrónico</p>
  </div>

  <script>
    // Auto-print si viene de un iframe o popup
    if (window.opener || window.parent !== window) {
      window.onload = function() { window.print(); }
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// Schema para devolución
const backofficeRefundItemSchema = z.object({
  saleItemId: z.string().min(1),
  quantity: z.number().positive(),
});

const backofficeRefundSchema = z.object({
  items: z.array(backofficeRefundItemSchema).min(1),
  reason: z.string().min(1),
  emitCreditNote: z.boolean().default(true),
});

// Procesar devolución de venta
router.post('/sales/:id/refund', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const validation = backofficeRefundSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', validation.error.errors[0].message);
    }

    const { items, reason, emitCreditNote } = validation.data;

    // Obtener venta original
    const originalSale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        afipInvoices: true,
        branch: true,
        pointOfSale: true,
      },
    });

    if (!originalSale) {
      throw new ApiError(404, 'NOT_FOUND', 'Venta no encontrada');
    }

    if (originalSale.status === 'REFUNDED') {
      throw new ApiError(400, 'ALREADY_REFUNDED', 'Esta venta ya fue devuelta completamente');
    }

    if (originalSale.status === 'CANCELLED') {
      throw new ApiError(400, 'CANCELLED_SALE', 'No se puede devolver una venta anulada');
    }

    // Validar items y calcular totales
    let refundTotal = 0;
    const refundItems: Array<{
      originalItem: typeof originalSale.items[0];
      quantity: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const originalItem = originalSale.items.find(i => i.id === item.saleItemId);
      if (!originalItem) {
        throw new ApiError(400, 'INVALID_ITEM', `Item ${item.saleItemId} no encontrado`);
      }

      if (item.quantity > Number(originalItem.quantity)) {
        throw new ApiError(400, 'INVALID_QUANTITY', `Cantidad a devolver excede la original`);
      }

      // El subtotal original ya tiene el descuento aplicado
      // Calcular proporcionalmente según la cantidad a devolver
      const originalQuantity = Number(originalItem.quantity);
      const originalSubtotal = Number(originalItem.subtotal);
      const subtotal = (item.quantity / originalQuantity) * originalSubtotal;

      console.log(`[Refund] Item: ${originalItem.productName}, qty: ${item.quantity}/${originalQuantity}, originalSubtotal: ${originalSubtotal}, refundSubtotal: ${subtotal}`);

      refundTotal += subtotal;

      refundItems.push({ originalItem, quantity: item.quantity, subtotal });
    }

    // Determinar si es devolución total
    const isFullRefund = refundItems.every(ri =>
      ri.quantity === Number(ri.originalItem.quantity)
    ) && refundItems.length === originalSale.items.length;

    // Crear venta de devolución (negativa)
    const refundSale = await prisma.sale.create({
      data: {
        tenantId,
        branchId: originalSale.branchId,
        pointOfSaleId: originalSale.pointOfSaleId,
        userId: req.user!.userId,
        customerId: originalSale.customerId,
        cashSessionId: null,
        saleNumber: `DEV-${originalSale.saleNumber}`,
        saleDate: new Date(),
        receiptType: 'TICKET',
        subtotal: -refundTotal,
        discount: 0,
        tax: 0,
        total: -refundTotal,
        status: 'COMPLETED',
        notes: `Devolución: ${reason}`,
        originalSaleId: originalSale.id,
        items: {
          create: refundItems.map(ri => ({
            productId: ri.originalItem.productId,
            productCode: ri.originalItem.productCode,
            productName: ri.originalItem.productName,
            productBarcode: ri.originalItem.productBarcode,
            quantity: -ri.quantity,
            unitPrice: ri.originalItem.unitPrice,
            discount: ri.originalItem.discount,
            subtotal: -ri.subtotal,
            taxRate: ri.originalItem.taxRate,
            taxAmount: 0,
            originalItemId: ri.originalItem.id,
          })),
        },
      },
    });

    // Restaurar stock
    for (const ri of refundItems) {
      if (ri.originalItem.productId) {
        await prisma.productStock.updateMany({
          where: {
            productId: ri.originalItem.productId,
            branchId: originalSale.branchId,
          },
          data: {
            quantity: { increment: ri.quantity },
            available: { increment: ri.quantity },
          },
        });
      }
    }

    // Actualizar estado de venta original
    await prisma.sale.update({
      where: { id: originalSale.id },
      data: { status: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND' },
    });

    // Emitir nota de crédito si corresponde
    let creditNoteResult = null;
    if (emitCreditNote && originalSale.afipInvoices.length > 0) {
      const originalInvoice = originalSale.afipInvoices[0];
      const afipService = new AfipService();

      try {
        if (originalInvoice.voucherType === 'FACTURA_A') {
          creditNoteResult = await afipService.createCreditNoteA(
            tenantId,
            originalInvoice.salesPointId,
            originalInvoice.id,
            refundTotal,
            refundSale.id
          );
        } else if (originalInvoice.voucherType === 'FACTURA_C') {
          creditNoteResult = await afipService.createCreditNoteC(
            tenantId,
            originalInvoice.salesPointId,
            originalInvoice.id,
            refundTotal,
            refundSale.id
          );
        } else {
          creditNoteResult = await afipService.createCreditNoteB(
            tenantId,
            originalInvoice.salesPointId,
            originalInvoice.id,
            refundTotal,
            refundSale.id
          );
        }
      } catch (error) {
        console.error('Error emitiendo nota de crédito:', error);
      }
    }

    res.json({
      success: true,
      data: {
        refundSale,
        refundAmount: refundTotal,
        isFullRefund,
        creditNote: creditNoteResult?.invoiceId ? {
          id: creditNoteResult.invoiceId,
          cae: creditNoteResult.cae,
          caeExpiration: creditNoteResult.caeExpiration,
          voucherNumber: creditNoteResult.voucherNumber,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
