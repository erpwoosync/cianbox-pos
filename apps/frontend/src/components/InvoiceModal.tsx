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
              @page { size: 80mm auto; margin: 2mm; }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                width: 76mm;
                margin: 0 auto;
                padding: 2mm;
              }
              .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
              .header h1 { font-size: 14px; margin: 0; }
              .header p { margin: 2px 0; font-size: 10px; }
              .voucher-type { font-size: 18px; font-weight: bold; text-align: center; margin: 10px 0; }
              .voucher-number { text-align: center; font-size: 14px; margin-bottom: 10px; }
              .section { margin: 8px 0; }
              .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; }
              .row { display: flex; justify-content: space-between; }
              .items { width: 100%; border-collapse: collapse; margin: 5px 0; }
              .items th, .items td { text-align: left; padding: 2px 0; font-size: 10px; }
              .items th:last-child, .items td:last-child { text-align: right; }
              .total { font-size: 16px; font-weight: bold; text-align: right; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
              .cae { margin-top: 10px; padding-top: 5px; border-top: 1px dashed #000; font-size: 10px; }
              .qr { text-align: center; margin-top: 10px; }
              .qr img { max-width: 100px; }
              .footer { text-align: center; font-size: 8px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR');
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

              {/* Vista previa de impresión */}
              <div ref={printRef} className="bg-white border rounded-lg p-4 mb-4 text-sm font-mono">
                <div className="header">
                  <h1>{invoice.tradeName || invoice.businessName}</h1>
                  <p>{invoice.businessName}</p>
                  <p>{invoice.address}</p>
                  <p>CUIT: {invoice.cuit}</p>
                  <p>{invoice.taxCategory}</p>
                </div>

                <div className="voucher-type">
                  FACTURA {getVoucherTypeLetter(invoice.voucherType)}
                </div>

                <div className="voucher-number">
                  {String(invoice.salesPointNumber).padStart(4, '0')}-{String(invoice.number).padStart(8, '0')}
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
                        <th>Producto</th>
                        <th>Cant</th>
                        <th>Subtotal</th>
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
                  <div>CAE: {invoice.cae}</div>
                  <div>Vto CAE: {formatDate(invoice.caeExpiration)}</div>
                </div>

                <div className="qr">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(getQRUrl())}`} alt="QR AFIP" />
                </div>

                <div className="footer">
                  Comprobante autorizado por AFIP
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
