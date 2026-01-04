import { useState, useRef } from 'react';
import { FileText, Printer, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
  saleNumber: string;
  total: number;
  customerName?: string;
}

interface InvoiceData {
  id: string;
  voucherType: string;
  number: number;
  cae: string;
  caeExpiration: string;
  salesPointNumber: number;
  total: number;
  receiverName: string;
  receiverDocNum: string;
  issueDate: string;
  cuit: string;
  businessName: string;
  tradeName?: string;
  address: string;
  taxCategory: string;
}

interface SaleData {
  id: string;
  saleNumber: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }>;
}

export default function InvoiceModal({
  isOpen,
  onClose,
  saleId,
  saleNumber,
  total,
  customerName,
}: InvoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [sale, setSale] = useState<SaleData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleInvoice = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/afip/invoices/from-sale', {
        saleId,
        receiverName: customerName,
      });

      if (response.data.success) {
        setInvoice(response.data.invoice);
        setSale(response.data.sale);
      }
    } catch (err: any) {
      console.error('Error al facturar:', err);
      setError(err.response?.data?.error || 'Error al emitir factura');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Factura ${invoice?.voucherType} ${String(invoice?.salesPointNumber).padStart(4, '0')}-${String(invoice?.number).padStart(8, '0')}</title>
            <style>
              /* Configuración para papel de rollo 80mm */
              @page {
                size: 80mm auto;
                margin: 0;
              }
              @media print {
                html, body {
                  width: 80mm;
                  margin: 0;
                  padding: 0;
                }
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: 'Courier New', 'Lucida Console', monospace;
                font-size: 11px;
                line-height: 1.3;
                width: 72mm;
                max-width: 72mm;
                margin: 0 auto;
                padding: 3mm;
                background: white;
                color: #000;
              }
              .header {
                text-align: center;
                padding-bottom: 8px;
                margin-bottom: 8px;
                border-bottom: 1px dashed #000;
              }
              .header h1 {
                font-size: 13px;
                font-weight: bold;
                margin-bottom: 2px;
                word-wrap: break-word;
              }
              .header p {
                font-size: 9px;
                margin: 1px 0;
              }
              .voucher-type {
                text-align: center;
                font-size: 20px;
                font-weight: bold;
                margin: 10px 0 5px 0;
                padding: 5px;
                border: 2px solid #000;
                display: inline-block;
                width: 100%;
              }
              .voucher-number {
                text-align: center;
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 8px;
              }
              .section {
                margin: 6px 0;
                font-size: 10px;
              }
              .section-title {
                font-weight: bold;
                font-size: 11px;
                border-bottom: 1px solid #000;
                margin-bottom: 4px;
                padding-bottom: 2px;
              }
              .row {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
              }
              .row span:first-child {
                font-weight: bold;
              }
              .items {
                width: 100%;
                border-collapse: collapse;
                margin: 4px 0;
                font-size: 9px;
              }
              .items th {
                text-align: left;
                font-weight: bold;
                padding: 2px 1px;
                border-bottom: 1px solid #000;
              }
              .items th:nth-child(2),
              .items td:nth-child(2) {
                text-align: center;
                width: 30px;
              }
              .items th:last-child,
              .items td:last-child {
                text-align: right;
                width: 55px;
              }
              .items td {
                padding: 3px 1px;
                vertical-align: top;
                word-wrap: break-word;
              }
              .items td:first-child {
                max-width: 120px;
                overflow: hidden;
              }
              .separator {
                border-top: 1px dashed #000;
                margin: 6px 0;
              }
              .total {
                font-size: 14px;
                font-weight: bold;
                text-align: right;
                padding: 6px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
                margin: 6px 0;
              }
              .cae {
                font-size: 9px;
                margin: 8px 0;
                padding: 4px 0;
              }
              .cae div {
                margin: 2px 0;
              }
              .qr {
                text-align: center;
                margin: 8px 0;
              }
              .qr img {
                width: 90px;
                height: 90px;
              }
              .footer {
                text-align: center;
                font-size: 8px;
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px dashed #000;
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        // Esperar a que cargue la imagen del QR antes de imprimir
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    // AFIP devuelve fechas en formato YYYYMMDD o ISO
    if (/^\d{8}$/.test(dateStr)) {
      // Formato YYYYMMDD de AFIP
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('es-AR');
  };

  const formatTaxCategory = (category: string) => {
    const categories: Record<string, string> = {
      'RESPONSABLE_INSCRIPTO': 'IVA Responsable Inscripto',
      'MONOTRIBUTO': 'Monotributista',
      'EXENTO': 'IVA Exento',
      'CONSUMIDOR_FINAL': 'Consumidor Final',
    };
    return categories[category] || category;
  };

  const getVoucherTypeLetter = (type: string) => {
    if (type.includes('_A')) return 'A';
    if (type.includes('_B')) return 'B';
    if (type.includes('_C')) return 'C';
    return 'X';
  };

  const getQRUrl = () => {
    if (!invoice) return '';
    const data = {
      ver: 1,
      fecha: new Date(invoice.issueDate).toISOString().split('T')[0],
      cuit: invoice.cuit.replace(/\D/g, ''),
      ptoVta: invoice.salesPointNumber,
      tipoCmp: invoice.voucherType === 'FACTURA_B' ? 6 : 11,
      nroCmp: invoice.number,
      importe: Number(invoice.total),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: invoice.receiverDocNum === '0' ? 99 : 96,
      nroDocRec: parseInt(invoice.receiverDocNum) || 0,
      tipoCodAut: 'E',
      codAut: parseInt(invoice.cae),
    };
    const base64Data = btoa(JSON.stringify(data));
    return `https://www.afip.gob.ar/fe/qr/?p=${base64Data}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Facturar Venta</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!invoice ? (
            // Estado inicial - Preguntar si facturar
            <div className="text-center">
              <div className="bg-green-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Venta Completada</h3>
              <p className="text-gray-600 mb-2">#{saleNumber}</p>
              <p className="text-2xl font-bold text-green-600 mb-4">
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 text-left">{error}</p>
                </div>
              )}

              <p className="text-gray-500 mb-4">¿Deseas emitir factura electrónica?</p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  No, gracias
                </button>
                <button
                  onClick={handleInvoice}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Emitiendo...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Facturar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Factura emitida - Mostrar para imprimir
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-medium">Factura emitida correctamente</span>
              </div>

              {/* Vista previa de impresión - Formato ticket 80mm */}
              <div ref={printRef} className="bg-white border rounded-lg p-4 mb-4 text-sm font-mono">
                <div className="header">
                  <h1>{invoice.tradeName || invoice.businessName}</h1>
                  {invoice.tradeName && <p>{invoice.businessName}</p>}
                  <p>{invoice.address}</p>
                  <p>CUIT: {invoice.cuit}</p>
                  <p>{formatTaxCategory(invoice.taxCategory)}</p>
                </div>

                <div className="voucher-type">
                  FACTURA {getVoucherTypeLetter(invoice.voucherType)}
                </div>

                <div className="voucher-number">
                  Nro: {String(invoice.salesPointNumber).padStart(4, '0')}-{String(invoice.number).padStart(8, '0')}
                </div>

                <div className="section">
                  <div className="row">
                    <span>Fecha:</span>
                    <span>{formatDate(invoice.issueDate)}</span>
                  </div>
                  <div className="row">
                    <span>Cliente:</span>
                    <span>{invoice.receiverName}</span>
                  </div>
                  {invoice.receiverDocNum !== '0' && (
                    <div className="row">
                      <span>DNI/CUIT:</span>
                      <span>{invoice.receiverDocNum}</span>
                    </div>
                  )}
                </div>

                <div className="section">
                  <div className="section-title">Detalle</div>
                  <table className="items">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th>Cant</th>
                        <th>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale?.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.productName}</td>
                          <td>{item.quantity}</td>
                          <td>${Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="total">
                  TOTAL: ${Number(invoice.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>

                <div className="cae">
                  <div><strong>CAE:</strong> {invoice.cae}</div>
                  <div><strong>Vto CAE:</strong> {formatDate(invoice.caeExpiration)}</div>
                </div>

                <div className="qr">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(getQRUrl())}`} alt="QR AFIP" />
                </div>

                <div className="footer">
                  Comprobante Autorizado - AFIP
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Imprimir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
