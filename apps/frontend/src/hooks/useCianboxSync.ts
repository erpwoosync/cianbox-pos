import { useState, useEffect, useCallback } from 'react';
import { cianboxService, cianboxInvoiceService } from '../services/api';
import { Customer, CONSUMIDOR_FINAL } from '../services/customers';

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR' | 'TRANSFER' | 'GIFT_CARD' | 'VOUCHER';

interface PointOfSale {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  branch?: { id: string; name: string };
  priceList?: { id: string; name: string; currency: string };
  mpDeviceId?: string;
  mpDeviceName?: string;
  surchargeDisplayMode?: 'SEPARATE_ITEM' | 'DISTRIBUTED';
  cianboxPointOfSaleId?: number | null;
}

interface AppliedGiftCard {
  code: string;
  amountApplied: number;
}

interface AppliedStoreCredit {
  code: string;
  amountApplied: number;
}

export interface Talonario {
  id: number;
  comprobante: string;
  tipo: string;
  talonario: string;
  fiscal: boolean;
  descripcion: string;
}

interface InvoicePollingData {
  saleId: string;
  saleNumber: string;
  isFiscal: boolean;
  total: number;
  customerName?: string;
  items?: Array<{ name: string; qty: number; price: number; discount: number; subtotal: number }>;
}

interface InvoiceReadyData {
  saleNumber: string;
  url: string;
}

interface UseCianboxSyncParams {
  selectedPOS: PointOfSale | null;
  selectedPaymentMethod: PaymentMethod | null;
  appliedGiftCards: AppliedGiftCard[];
  appliedStoreCredits: AppliedStoreCredit[];
  selectedCustomer: Customer | null;
  qzConnected: boolean;
  selectedPrinter: string | null;
  qzPrintHtml: (html: string) => Promise<void>;
}

export function useCianboxSync({
  selectedPOS,
  selectedPaymentMethod,
  appliedGiftCards,
  appliedStoreCredits,
  selectedCustomer,
  qzConnected,
  selectedPrinter,
  qzPrintHtml,
}: UseCianboxSyncParams) {
  // Comprobante fiscal
  const [receiptMode, setReceiptMode] = useState<'NDP' | 'FACTURA'>('NDP');
  const [cianboxTalonarios, setCianboxTalonarios] = useState<Talonario[]>([]);
  const [selectedTalonarioId, setSelectedTalonarioId] = useState<number | null>(null);

  // Talonarios disponibles para el indicador Cianbox
  const [posTalonarios, setPosTalonarios] = useState<Talonario[]>([]);
  const [showCianboxPopover, setShowCianboxPopover] = useState(false);

  // Estado de polling de comprobante PDF
  const [invoicePolling, setInvoicePolling] = useState<InvoicePollingData | null>(null);
  const [invoiceReady, setInvoiceReady] = useState<InvoiceReadyData | null>(null);

  // Cargar talonarios del POS al iniciar
  useEffect(() => {
    if (!selectedPOS?.cianboxPointOfSaleId) {
      setPosTalonarios([]);
      return;
    }
    const load = async () => {
      try {
        const all = await cianboxService.getTalonarios();
        setPosTalonarios(all);
      } catch {
        setPosTalonarios([]);
      }
    };
    load();
  }, [selectedPOS?.cianboxPointOfSaleId]);

  // Regla de negocio: si no es efectivo puro, forzar Factura
  useEffect(() => {
    if (!selectedPaymentMethod) return;

    const isOnlyCash = selectedPaymentMethod === 'CASH'
      && appliedGiftCards.length === 0
      && appliedStoreCredits.length === 0;

    if (!isOnlyCash) {
      setReceiptMode('FACTURA');
    }
  }, [selectedPaymentMethod, appliedGiftCards, appliedStoreCredits]);

  // Cargar talonarios cuando cambia a FACTURA o cambia el cliente
  useEffect(() => {
    if (receiptMode !== 'FACTURA') {
      setSelectedTalonarioId(null);
      setCianboxTalonarios([]);
      return;
    }
    const loadTalonarios = async () => {
      try {
        const customerId = selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined;
        const talonarios = await cianboxService.getTalonarios(customerId);
        const fiscales = talonarios.filter((t: any) => t.fiscal === true);
        setCianboxTalonarios(fiscales);
        if (fiscales.length >= 1) {
          setSelectedTalonarioId(fiscales[0].id);
        }
      } catch {
        setCianboxTalonarios([]);
      }
    };
    loadTalonarios();
  }, [receiptMode, selectedCustomer]);

  // Generar HTML de ticket para impresion
  const buildReceiptHtml = useCallback((data: { saleNumber: string; total: number; customerName?: string; items?: Array<{name: string; qty: number; price: number; discount: number; subtotal: number}> }) => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const itemsHtml = (data.items || []).map(i => {
      const name = i.name.length > 32 ? i.name.substring(0, 32) : i.name;
      return `<div style="font-weight:bold;margin-top:4px">${name}</div>
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <span>${i.qty} x $${fmt(i.price)}</span>
          ${i.discount > 0 ? `<span style="color:#c00;font-size:10px">-$${fmt(i.discount)}</span>` : ''}
          <span style="font-weight:bold">$${fmt(i.subtotal)}</span>
        </div>`;
    }).join('');
    return `<html><body style="font-family:'Courier New',monospace;font-size:12px;width:280px;padding:5px;line-height:1.3">
  <div style="font-size:14px;font-weight:bold;text-align:center">NOTA DE PEDIDO</div>
  <div style="font-size:10px;text-align:center;color:#666;margin-bottom:6px">Documento no fiscal</div>
  <div style="border-top:1px dashed #000;margin:6px 0"></div>
  <div style="font-size:11px"><strong>${data.saleNumber}</strong></div>
  <div style="font-size:11px">${fecha}</div>
  ${data.customerName ? `<div style="font-size:11px">Cliente: ${data.customerName}</div>` : ''}
  <div style="border-top:1px dashed #000;margin:6px 0"></div>
  ${itemsHtml}
  <div style="border-top:2px solid #000;margin-top:8px;padding-top:6px">
    ${data.items && data.items.some(i => i.discount > 0) ? `
    <div style="display:flex;justify-content:space-between;font-size:11px"><span>Subtotal</span><span>$${fmt(data.items.reduce((s, i) => s + i.price * i.qty, 0))}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px"><span>Descuento</span><span style="color:#c00">-$${fmt(data.items.reduce((s, i) => s + i.discount, 0))}</span></div>
    ` : ''}
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-top:4px"><span>TOTAL</span><span>$${fmt(data.total)}</span></div>
  </div>
  <div style="border-top:1px dashed #000;margin:6px 0"></div>
  <div style="text-align:center;font-size:10px;color:#666">Gracias por su compra</div>
</body></html>`;
  }, []);

  const printLocalReceipt = useCallback(async (data: { saleNumber: string; total: number; customerName?: string; items?: Array<{name: string; qty: number; price: number; discount: number; subtotal: number}> }) => {
    const html = buildReceiptHtml(data);

    // QZ Tray: impresion directa sin dialogo
    if (qzConnected && selectedPrinter) {
      try {
        await qzPrintHtml(html);
        return;
      } catch (err) {
        console.error('[QZ Tray] Error printing, falling back to browser:', err);
      }
    }

    // Fallback: window.print() con dialogo
    const w = window.open('', '_blank', 'width=350,height=600');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
<style>@page{margin:0mm;size:80mm 297mm}*{margin:0;padding:0;box-sizing:border-box}
@media print{html,body{width:80mm;max-width:80mm;padding:2mm}}</style></head>
${html.replace('<html>', '').replace('</html>', '')}
<script>setTimeout(()=>window.print(),300)</script></html>`);
    w.document.close();
  }, [qzConnected, selectedPrinter, qzPrintHtml, buildReceiptHtml]);

  // Polling de factura PDF cuando se inicia
  useEffect(() => {
    if (!invoicePolling) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // 40 x 5s = 200 segundos maximo
    const localFallbackAttempt = 2; // Despues de 10s (2 x 5s), fallback local para NDP

    const poll = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 5000));
        if (cancelled) return;

        try {
          const result = await cianboxInvoiceService.pollInvoice(invoicePolling.saleId);
          if (result.ready && result.invoiceUrl) {
            setInvoiceReady({
              saleNumber: invoicePolling.saleNumber,
              url: result.invoiceUrl,
            });
            setInvoicePolling(null);
            return;
          }
        } catch {
          // Ignorar errores, seguir intentando
        }

        // Fallback local para NDP despues de 10 segundos
        if (attempts >= localFallbackAttempt && !invoicePolling.isFiscal) {
          printLocalReceipt(invoicePolling).catch(() => {});
          setInvoicePolling(null);
          return;
        }
      }
      // Maximo de intentos alcanzado, detener polling
      setInvoicePolling(null);
    };

    poll();
    return () => { cancelled = true; };
  }, [invoicePolling]);

  return {
    receiptMode,
    setReceiptMode,
    cianboxTalonarios,
    setCianboxTalonarios,
    selectedTalonarioId,
    setSelectedTalonarioId,
    posTalonarios,
    setPosTalonarios,
    showCianboxPopover,
    setShowCianboxPopover,
    invoicePolling,
    setInvoicePolling,
    invoiceReady,
    setInvoiceReady,
    buildReceiptHtml,
    printLocalReceipt,
  };
}
