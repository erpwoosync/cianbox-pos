import { useState, useEffect } from 'react';
import {
  X,
  Search,
  Loader2,
  Receipt,
  ArrowLeft,
  Calendar,
  FileText,
  Printer,
  Eye,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { salesService } from '../services/api';
import api from '../services/api';
import RefundModal from './RefundModal';

interface SaleItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  promotionName?: string;
}

interface Payment {
  id: string;
  method: string;
  amount: number;
  cardBrand?: string;
  cardLastFour?: string;
}

interface Invoice {
  id: string;
  voucherType: string;
  number: number;
  cae: string;
  caeExpiration: string;
  salesPoint?: { number: number };
  totalAmount: number;
  receiverName?: string;
  receiverDocNum: string;
  issueDate: string;
  // Datos del emisor vienen de afipConfig
  afipConfig?: {
    cuit: string;
    businessName: string;
    tradeName?: string;
    address: string;
    taxCategory: string;
  };
}

// Helper para obtener número de punto de venta
const getSalesPointNumber = (invoice: Invoice): number => {
  return invoice.salesPoint?.number || 0;
};

// Helper para obtener datos del emisor
const getEmitterData = (invoice: Invoice) => ({
  cuit: invoice.afipConfig?.cuit || '',
  businessName: invoice.afipConfig?.businessName || '',
  tradeName: invoice.afipConfig?.tradeName,
  address: invoice.afipConfig?.address || '',
  taxCategory: invoice.afipConfig?.taxCategory || '',
});

interface Sale {
  id: string;
  saleNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string;
  originalSaleId?: string; // Si tiene valor, es una devolucion
  customer?: {
    id: string;
    name: string;
    taxId?: string;
  };
  user?: {
    id: string;
    name: string;
  };
  pointOfSale?: {
    id: string;
    name: string;
  };
  items?: SaleItem[];
  payments?: Payment[];
  afipInvoices?: Invoice[];
}

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pointOfSaleId?: string;
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  CREDIT_CARD: <CreditCard className="w-4 h-4" />,
  DEBIT_CARD: <CreditCard className="w-4 h-4" />,
  MP_POINT: <CreditCard className="w-4 h-4" />,
  MP_QR: <QrCode className="w-4 h-4" />,
  TRANSFER: <Banknote className="w-4 h-4" />,
};

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CREDIT_CARD: 'Tarjeta Crédito',
  DEBIT_CARD: 'Tarjeta Débito',
  MP_POINT: 'MP Point',
  MP_QR: 'MP QR',
  TRANSFER: 'Transferencia',
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  COMPLETED: { label: 'Completada', color: 'green', icon: <CheckCircle className="w-4 h-4" /> },
  CANCELLED: { label: 'Anulada', color: 'red', icon: <XCircle className="w-4 h-4" /> },
  PENDING: { label: 'Pendiente', color: 'amber', icon: <Clock className="w-4 h-4" /> },
  REFUNDED: { label: 'Devuelta', color: 'orange', icon: <RotateCcw className="w-4 h-4" /> },
  PARTIAL_REFUND: { label: 'Dev. Parcial', color: 'orange', icon: <RotateCcw className="w-4 h-4" /> },
};

export default function SalesHistoryModal({
  isOpen,
  onClose,
  pointOfSaleId,
}: SalesHistoryModalProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isInvoicing, setIsInvoicing] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Cargar ventas
  useEffect(() => {
    if (isOpen) {
      loadSales();
    }
  }, [isOpen, dateFrom, dateTo, pointOfSaleId]);

  // Limpiar estado al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSelectedSale(null);
      setSearchQuery('');
      setInvoiceError(null);
    }
  }, [isOpen]);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const response = await salesService.list({
        pointOfSaleId,
        dateFrom,
        dateTo,
        pageSize: 100,
      });
      if (response.success) {
        setSales(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando ventas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSaleDetail = async (saleId: string) => {
    setLoadingDetail(true);
    try {
      const response = await salesService.get(saleId);
      if (response.success) {
        setSelectedSale(response.data);
      }
    } catch (error) {
      console.error('Error cargando detalle:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelectSale = (sale: Sale) => {
    loadSaleDetail(sale.id);
  };

  const handleBack = () => {
    setSelectedSale(null);
    setInvoiceError(null);
  };

  // Filtrar ventas por búsqueda
  const filteredSales = sales.filter((sale) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sale.saleNumber.toLowerCase().includes(query) ||
      sale.customer?.name?.toLowerCase().includes(query) ||
      sale.total.toString().includes(query)
    );
  });

  // Emitir factura
  const handleInvoice = async () => {
    if (!selectedSale) return;

    setIsInvoicing(true);
    setInvoiceError(null);

    try {
      const response = await api.post('/afip/invoices/from-sale', {
        saleId: selectedSale.id,
        receiverName: selectedSale.customer?.name,
      });

      if (response.data.success) {
        // Recargar detalle para obtener la factura
        await loadSaleDetail(selectedSale.id);
      }
    } catch (err: any) {
      console.error('Error al facturar:', err);
      setInvoiceError(err.response?.data?.error || 'Error al emitir factura');
    } finally {
      setIsInvoicing(false);
    }
  };

  // Formatear fecha
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateStr: string) => {
    // AFIP devuelve fechas en formato YYYYMMDD o ISO
    if (/^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('es-AR');
  };

  const formatTaxCategory = (category: string) => {
    const categories: Record<string, string> = {
      RESPONSABLE_INSCRIPTO: 'IVA Responsable Inscripto',
      MONOTRIBUTO: 'Monotributista',
      EXENTO: 'IVA Exento',
      CONSUMIDOR_FINAL: 'Consumidor Final',
    };
    return categories[category] || category;
  };

  const getVoucherTypeLetter = (type: string) => {
    if (type.includes('_A')) return 'A';
    if (type.includes('_B')) return 'B';
    if (type.includes('_C')) return 'C';
    return 'X';
  };

  const getQRUrl = (invoice: Invoice) => {
    const emitter = getEmitterData(invoice);
    const data = {
      ver: 1,
      fecha: new Date(invoice.issueDate).toISOString().split('T')[0],
      cuit: emitter.cuit.replace(/\D/g, ''),
      ptoVta: getSalesPointNumber(invoice),
      tipoCmp: invoice.voucherType === 'FACTURA_B' ? 6 : 11,
      nroCmp: invoice.number,
      importe: Number(invoice.totalAmount),
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

  // Imprimir factura
  const handlePrint = (invoice: Invoice) => {
    if (!selectedSale) return;

    const emitter = getEmitterData(invoice);
    const spNumber = getSalesPointNumber(invoice);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Factura ${invoice.voucherType} ${String(spNumber).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}</title>
          <style>
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
            .items th:nth-child(2), .items td:nth-child(2) {
              text-align: center;
              width: 30px;
            }
            .items th:last-child, .items td:last-child {
              text-align: right;
              width: 55px;
            }
            .items td {
              padding: 3px 1px;
              vertical-align: top;
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
          <div class="header">
            <h1>${emitter.tradeName || emitter.businessName}</h1>
            ${emitter.tradeName ? `<p>${emitter.businessName}</p>` : ''}
            <p>${emitter.address}</p>
            <p>CUIT: ${emitter.cuit}</p>
            <p>${formatTaxCategory(emitter.taxCategory)}</p>
          </div>
          <div class="voucher-type">FACTURA ${getVoucherTypeLetter(invoice.voucherType)}</div>
          <div class="voucher-number">Nro: ${String(spNumber).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}</div>
          <div class="section">
            <div class="row"><span>Fecha:</span><span>${formatDateShort(invoice.issueDate)}</span></div>
            <div class="row"><span>Cliente:</span><span>${invoice.receiverName || 'Consumidor Final'}</span></div>
            ${invoice.receiverDocNum !== '0' ? `<div class="row"><span>DNI/CUIT:</span><span>${invoice.receiverDocNum}</span></div>` : ''}
          </div>
          <div class="section">
            <div class="section-title">Detalle</div>
            <table class="items">
              <thead>
                <tr><th>Descripción</th><th>Cant</th><th>Importe</th></tr>
              </thead>
              <tbody>
                ${selectedSale.items?.map((item) => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>
          </div>
          <div class="total">TOTAL: $${Number(invoice.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          <div class="cae">
            <div><strong>CAE:</strong> ${invoice.cae}</div>
            <div><strong>Vto CAE:</strong> ${formatDateShort(invoice.caeExpiration)}</div>
          </div>
          <div class="qr">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(getQRUrl(invoice))}" alt="QR AFIP" />
          </div>
          <div class="footer">Comprobante Autorizado - AFIP</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  if (!isOpen) return null;

  const invoice = selectedSale?.afipInvoices?.[0];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-green-50 to-blue-50 flex items-center gap-4">
          {selectedSale ? (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {selectedSale ? `Venta #${selectedSale.saleNumber}` : 'Historial de Ventas'}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedSale
                  ? formatDate(selectedSale.createdAt)
                  : 'Consultar y reimprimir facturas'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="ml-auto p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!selectedSale ? (
            <>
              {/* Filtros */}
              <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Search className="w-4 h-4 inline mr-1" />
                    Buscar
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Número, cliente o monto..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={loadSales}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Buscar
                </button>
              </div>

              {/* Lista de ventas */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                    <span className="ml-2 text-gray-500">Cargando ventas...</span>
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron ventas</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Número
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Cliente
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                          Total
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                          Factura
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredSales.map((sale) => {
                        const status = statusConfig[sale.status] || statusConfig.PENDING;
                        const hasInvoice = sale.afipInvoices && sale.afipInvoices.length > 0;
                        return (
                          <tr
                            key={sale.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSelectSale(sale)}
                          >
                            <td className="px-4 py-3 font-mono font-medium">
                              #{sale.saleNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(sale.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span>{sale.customer?.name || 'Consumidor Final'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                              ${sale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-700`}
                              >
                                {status.icon}
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {hasInvoice ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  <FileText className="w-3 h-3" />
                                  Facturada
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">Sin factura</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSale(sale);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Ver detalle"
                              >
                                <Eye className="w-4 h-4 text-gray-600" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            /* Vista de detalle */
            <div className="flex-1 overflow-y-auto p-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  <span className="ml-2 text-gray-500">Cargando detalle...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info general */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Número</p>
                        <p className="font-semibold font-mono">#{selectedSale.saleNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fecha</p>
                        <p className="font-semibold">{formatDate(selectedSale.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cliente</p>
                        <p className="font-semibold">
                          {selectedSale.customer?.name || 'Consumidor Final'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Vendedor</p>
                        <p className="font-semibold">{selectedSale.user?.name || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b font-medium">
                      Detalle de productos
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                            Producto
                          </th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">
                            Cant
                          </th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                            P. Unit
                          </th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                            Desc
                          </th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedSale.items?.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.productName}</p>
                              {item.promotionName && (
                                <p className="text-xs text-green-600">{item.promotionName}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">
                              ${Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {item.discount > 0 ? `-$${Number(item.discount).toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ${Number(item.subtotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-right font-medium">
                            Subtotal:
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            ${Number(selectedSale.subtotal).toFixed(2)}
                          </td>
                        </tr>
                        {selectedSale.discount > 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-medium text-red-600">
                              Descuento:
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-red-600">
                              -${Number(selectedSale.discount).toFixed(2)}
                            </td>
                          </tr>
                        )}
                        <tr className="text-lg">
                          <td colSpan={4} className="px-4 py-3 text-right font-bold">
                            TOTAL:
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            ${Number(selectedSale.total).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Pagos */}
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b font-medium">Forma de pago</div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-3">
                        {selectedSale.payments?.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg"
                          >
                            {paymentMethodIcons[payment.method] || <CreditCard className="w-4 h-4" />}
                            <span className="font-medium">
                              {paymentMethodLabels[payment.method] || payment.method}
                            </span>
                            {payment.cardLastFour && (
                              <span className="text-gray-500">****{payment.cardLastFour}</span>
                            )}
                            <span className="text-green-600 font-semibold">
                              ${Number(payment.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Factura */}
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b font-medium flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Factura Electrónica
                    </div>
                    <div className="p-4">
                      {invoice ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div>
                              <p className="font-semibold text-green-800">
                                Factura {getVoucherTypeLetter(invoice.voucherType)}{' '}
                                {String(getSalesPointNumber(invoice)).padStart(4, '0')}-
                                {String(invoice.number).padStart(8, '0')}
                              </p>
                              <p className="text-sm text-green-600">CAE: {invoice.cae}</p>
                              <p className="text-sm text-green-600">
                                Vto: {formatDateShort(invoice.caeExpiration)}
                              </p>
                            </div>
                            <button
                              onClick={() => handlePrint(invoice)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                              <Printer className="w-4 h-4" />
                              Reimprimir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {invoiceError && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                              <p className="text-sm text-red-700">{invoiceError}</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div>
                              <p className="font-semibold text-amber-800">Sin factura emitida</p>
                              <p className="text-sm text-amber-600">
                                Esta venta no tiene factura electrónica
                              </p>
                            </div>
                            <button
                              onClick={handleInvoice}
                              disabled={isInvoicing || selectedSale.status === 'CANCELLED'}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                              {isInvoicing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Emitiendo...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4" />
                                  Facturar
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {!selectedSale && `${filteredSales.length} ventas encontradas`}
          </div>
          <div className="flex gap-3">
            {selectedSale && selectedSale.status !== 'REFUNDED' && selectedSale.status !== 'CANCELLED' && !selectedSale.originalSaleId && (
              <button
                onClick={() => setShowRefundModal(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Devolver
              </button>
            )}
            <button onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Devolucion */}
      <RefundModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        sale={selectedSale}
        onRefundComplete={() => {
          setShowRefundModal(false);
          loadSales();
          if (selectedSale) {
            loadSaleDetail(selectedSale.id);
          }
        }}
      />
    </div>
  );
}
