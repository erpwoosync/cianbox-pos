import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  User,
  Store,
  Monitor,
  ShoppingCart,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Package,
  AlertCircle,
  RefreshCw,
  Banknote,
  Percent,
  Building2,
  RotateCcw,
  FileText,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface RefundItem {
  saleItemId: string;
  quantity: number;
  maxQuantity: number;
  productName: string;
  unitPrice: number;
  selected: boolean;
}

interface SaleItem {
  id: string;
  productId?: string;
  productCode?: string;
  productName: string;
  productBarcode?: string;
  quantity: number;
  unitPrice: number;
  unitPriceNet?: number;
  discount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  promotionId?: string;
  promotionName?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    cianboxProductId?: number;
    taxRate?: number;
  };
}

interface Payment {
  id: string;
  method: string;
  amount: number;
  reference?: string;
  cardBrand?: string;
  cardLastFour?: string;
  installments: number;
  amountTendered?: number;
  changeAmount?: number;
  status: string;
  transactionId?: string;
  // Campos de Mercado Pago
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
}

interface Sale {
  id: string;
  saleNumber: string;
  saleDate: string;
  receiptType: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  notes?: string;
  cancelledAt?: string;
  cancelReason?: string;
  pointOfSale: {
    id: string;
    name: string;
    code: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  customer?: {
    id: string;
    name: string;
  };
  cashSession?: {
    id: string;
    sessionNumber: string;
    status: string;
    openedAt: string;
    closedAt?: string;
    user: { id: string; name: string };
    pointOfSale: { id: string; name: string; code: string };
  };
  items: SaleItem[];
  payments: Payment[];
}

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [refundReason, setRefundReason] = useState('');
  const [emitCreditNote, setEmitCreditNote] = useState(true);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<{ message: string; creditNote?: any } | null>(null);

  useEffect(() => {
    loadSale();
  }, [id]);

  const loadSale = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/backoffice/sales/${id}`);
      if (response.data.success) {
        setSale(response.data.data);
      }
    } catch (error) {
      console.error('Error loading sale:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncPaymentFromMP = async (paymentId: string) => {
    setSyncingPaymentId(paymentId);
    try {
      // Llamar al endpoint de sync
      const response = await api.post('/mercadopago/payments/sync', {
        paymentIds: [paymentId]
      });

      if (response.data.success) {
        // Recargar la venta para ver los datos actualizados
        await loadSale();
        alert('Pago sincronizado correctamente');
      } else {
        alert('Error al sincronizar: ' + (response.data.error?.message || 'Error desconocido'));
      }
    } catch (error: unknown) {
      console.error('Error syncing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al sincronizar pago: ' + errorMessage);
    } finally {
      setSyncingPaymentId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'CANCELLED':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'PENDING':
        return <Clock className="w-6 h-6 text-yellow-600" />;
      case 'REFUNDED':
      case 'PARTIAL_REFUND':
        return <RotateCcw className="w-6 h-6 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'PENDING':
        return 'Pendiente';
      case 'REFUNDED':
        return 'Devuelta';
      case 'PARTIAL_REFUND':
        return 'Devolucion Parcial';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REFUNDED':
      case 'PARTIAL_REFUND':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Funciones para devoluciones
  const openRefundModal = () => {
    if (!sale) return;
    setRefundItems(
      sale.items.map((item) => ({
        saleItemId: item.id,
        quantity: item.quantity,
        maxQuantity: item.quantity,
        productName: item.productName,
        unitPrice: item.unitPrice,
        selected: true,
      }))
    );
    setRefundReason('');
    setRefundError(null);
    setRefundSuccess(null);
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    if (refundSuccess) {
      loadSale();
    }
  };

  const handleRefundQuantityChange = (index: number, value: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.min(Math.max(0, value), item.maxQuantity) }
          : item
      )
    );
  };

  const handleRefundToggleItem = (index: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              selected: !item.selected,
              quantity: !item.selected ? item.maxQuantity : 0,
            }
          : item
      )
    );
  };

  const calculateRefundTotal = () => {
    return refundItems
      .filter((item) => item.selected && item.quantity > 0)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const getSelectedRefundCount = () => {
    return refundItems.filter((item) => item.selected && item.quantity > 0).length;
  };

  const processRefund = async () => {
    if (!sale || !id) return;

    if (!refundReason.trim()) {
      setRefundError('Debe ingresar el motivo de la devolucion');
      return;
    }

    const itemsToRefund = refundItems
      .filter((item) => item.selected && item.quantity > 0)
      .map((item) => ({
        saleItemId: item.saleItemId,
        quantity: item.quantity,
      }));

    if (itemsToRefund.length === 0) {
      setRefundError('Debe seleccionar al menos un item para devolver');
      return;
    }

    setIsProcessingRefund(true);
    setRefundError(null);

    try {
      const response = await api.post(`/sales/${id}/refund`, {
        items: itemsToRefund,
        reason: refundReason.trim(),
        emitCreditNote,
      });

      if (response.data.success) {
        const data = response.data.data;
        setRefundSuccess({
          message: data.isFullRefund
            ? 'Devolucion total procesada correctamente'
            : 'Devolucion parcial procesada correctamente',
          creditNote: data.creditNote,
        });
      } else {
        setRefundError(response.data.error || 'Error al procesar devolucion');
      }
    } catch (error: any) {
      console.error('Error procesando devolucion:', error);
      setRefundError(
        error.response?.data?.error || error.message || 'Error al procesar devolucion'
      );
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const canRefund = sale && sale.status !== 'REFUNDED' && sale.status !== 'CANCELLED';

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Efectivo',
      CREDIT_CARD: 'Tarjeta de Crédito',
      DEBIT_CARD: 'Tarjeta de Débito',
      QR: 'QR',
      TRANSFER: 'Transferencia',
      CHECK: 'Cheque',
      CREDIT: 'Cuenta Corriente',
      VOUCHER: 'Vale',
      GIFTCARD: 'Gift Card',
      POINTS: 'Puntos',
      OTHER: 'Otro',
    };
    return methods[method] || method;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Venta no encontrada</h2>
        <button
          onClick={() => navigate('/sales')}
          className="text-blue-600 hover:text-blue-700"
        >
          Volver al listado
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Venta {sale.saleNumber}</h1>
            <p className="text-gray-500">{tenant?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canRefund && (
            <button
              onClick={openRefundModal}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Devolver
            </button>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusBadgeClass(sale.status)}`}>
            {getStatusIcon(sale.status)}
            <span className="font-semibold">{getStatusText(sale.status)}</span>
          </div>
        </div>
      </div>

      {/* Información general */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Fecha</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{formatDate(sale.saleDate)}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Sucursal</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{sale.branch.name}</p>
          <p className="text-xs text-gray-500">{sale.branch.code}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-2">
            <Monitor className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Punto de Venta</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{sale.pointOfSale.name}</p>
          <p className="text-xs text-gray-500">{sale.pointOfSale.code}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Cajero</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{sale.user.name}</p>
          <p className="text-xs text-gray-500">{sale.user.email}</p>
        </div>
      </div>

      {/* Cliente */}
      {sale.customer && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-500">Cliente</span>
              <p className="text-lg font-semibold text-gray-900">{sale.customer.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sesión de Caja */}
      {sale.cashSession && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Banknote className="w-5 h-5 text-green-600" />
              <div>
                <span className="text-sm font-medium text-gray-500">Sesión de Caja</span>
                <p className="text-lg font-semibold text-gray-900">
                  #{sale.cashSession.sessionNumber}
                </p>
                <p className="text-xs text-gray-500">
                  {sale.cashSession.pointOfSale.name} • {sale.cashSession.user.name}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/cash-sessions/${sale.cashSession!.id}`)}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Ver sesión
            </button>
          </div>
        </div>
      )}

      {/* Items de venta */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Items de Venta</h2>
            <span className="text-sm text-gray-500">({sale.items.length} productos)</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ID Cianbox</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Alícuota</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Descuento</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      {item.productCode && (
                        <div className="text-xs text-gray-500">SKU: {item.productCode}</div>
                      )}
                      {item.promotionName && (
                        <div className="text-xs text-green-600">
                          <Package className="w-3 h-3 inline mr-1" />
                          {item.promotionName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-mono text-gray-700">
                      {item.product?.cianboxProductId || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.unitPrice)}
                    </div>
                    {item.unitPriceNet && (
                      <div className="text-xs text-gray-500">
                        Neto: {formatCurrency(item.unitPriceNet)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.taxRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {item.discount > 0 ? formatCurrency(item.discount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales y Pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pagos */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Pagos</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {sale.payments.map((payment) => (
              <div key={payment.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-gray-900">{getPaymentMethodText(payment.method)}</div>
                    {payment.cardBrand && (
                      <div className="text-xs text-gray-500">
                        {payment.cardBrand} **** {payment.cardLastFour}
                        {payment.installments > 1 && ` (${payment.installments} cuotas)`}
                      </div>
                    )}
                    {payment.reference && (
                      <div className="text-xs text-gray-500">Ref: {payment.reference}</div>
                    )}
                    {payment.method === 'CASH' && payment.amountTendered && (
                      <div className="text-xs text-gray-500">
                        Entregado: {formatCurrency(payment.amountTendered)}
                        {payment.changeAmount && payment.changeAmount > 0 && (
                          <> • Cambio: {formatCurrency(payment.changeAmount)}</>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(payment.amount)}
                  </div>
                </div>

                {/* Datos de Mercado Pago */}
                {payment.mpPaymentId && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <CreditCard className="w-4 h-4" />
                      Datos Mercado Pago
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {payment.mpPaymentId && (
                        <div>
                          <span className="text-gray-500">ID Pago:</span>{' '}
                          <span className="font-mono">{payment.mpPaymentId}</span>
                        </div>
                      )}
                      {payment.authorizationCode && (
                        <div>
                          <span className="text-gray-500">Auth:</span>{' '}
                          <span className="font-mono">{payment.authorizationCode}</span>
                        </div>
                      )}
                      {payment.cardholderName && (
                        <div>
                          <span className="text-gray-500">Titular:</span>{' '}
                          <span>{payment.cardholderName}</span>
                        </div>
                      )}
                      {payment.cardType && (
                        <div>
                          <span className="text-gray-500">Tipo:</span>{' '}
                          <span className="capitalize">{payment.cardType === 'credit' ? 'Crédito' : payment.cardType === 'debit' ? 'Débito' : payment.cardType}</span>
                        </div>
                      )}
                      {payment.cardFirstSix && (
                        <div>
                          <span className="text-gray-500">BIN:</span>{' '}
                          <span className="font-mono">{payment.cardFirstSix}</span>
                        </div>
                      )}
                      {payment.bankOriginName && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500">Banco:</span>{' '}
                          <span>{payment.bankOriginName}</span>
                        </div>
                      )}
                    </div>

                    {/* Fee y Monto Neto */}
                    {(payment.mpFeeAmount || payment.netReceivedAmount) && (
                      <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                        {payment.mpFeeAmount && (
                          <div className="flex items-center gap-1">
                            <Percent className="w-3 h-3 text-red-400" />
                            <span className="text-gray-500">Comisión MP:</span>{' '}
                            <span className="text-red-600 font-medium">
                              {formatCurrency(payment.mpFeeAmount)}
                              {payment.mpFeeRate && ` (${payment.mpFeeRate}%)`}
                            </span>
                          </div>
                        )}
                        {payment.netReceivedAmount && (
                          <div className="flex items-center gap-1">
                            <Banknote className="w-3 h-3 text-green-500" />
                            <span className="text-gray-500">Neto recibido:</span>{' '}
                            <span className="text-green-600 font-medium">{formatCurrency(payment.netReceivedAmount)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Botón para sincronizar si tiene transactionId pero no mpPaymentId */}
                {payment.transactionId && !payment.mpPaymentId && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => syncPaymentFromMP(payment.id)}
                      disabled={syncingPaymentId === payment.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingPaymentId === payment.id ? 'animate-spin' : ''}`} />
                      {syncingPaymentId === payment.id ? 'Sincronizando...' : 'Sincronizar datos de MP'}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      ID Transacción: {payment.transactionId}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resumen de totales */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento</span>
                <span className="font-medium text-red-600">-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">IVA</span>
              <span className="font-medium text-gray-900">{formatCurrency(sale.tax)}</span>
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      {sale.notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Notas</h3>
          <p className="text-blue-800">{sale.notes}</p>
        </div>
      )}

      {/* Cancelación */}
      {sale.status === 'CANCELLED' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-2">Venta Cancelada</h3>
          {sale.cancelledAt && (
            <p className="text-sm text-red-800 mb-1">
              Fecha de cancelación: {formatDate(sale.cancelledAt)}
            </p>
          )}
          {sale.cancelReason && (
            <p className="text-sm text-red-800">
              Motivo: {sale.cancelReason}
            </p>
          )}
        </div>
      )}

      {/* Modal de Devolución */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-red-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Procesar Devolucion</h3>
                  <p className="text-sm text-gray-500">Venta #{sale.saleNumber}</p>
                </div>
              </div>
              <button
                onClick={closeRefundModal}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {refundSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-green-800 mb-2">
                    Devolucion Exitosa
                  </h4>
                  <p className="text-gray-600 mb-4">{refundSuccess.message}</p>

                  {refundSuccess.creditNote && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-sm mx-auto">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-blue-800">Nota de Credito</span>
                      </div>
                      <p className="text-sm text-blue-700">
                        Numero: {refundSuccess.creditNote.voucherNumber}
                      </p>
                      <p className="text-sm text-blue-700">CAE: {refundSuccess.creditNote.cae}</p>
                    </div>
                  )}

                  <button
                    onClick={closeRefundModal}
                    className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Botones de selección */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setRefundItems((prev) =>
                          prev.map((item) => ({ ...item, selected: true, quantity: item.maxQuantity }))
                        )
                      }
                      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    >
                      Seleccionar Todo
                    </button>
                    <button
                      onClick={() =>
                        setRefundItems((prev) =>
                          prev.map((item) => ({ ...item, selected: false, quantity: 0 }))
                        )
                      }
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Deseleccionar
                    </button>
                  </div>

                  {/* Items */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b font-medium text-sm text-gray-600">
                      Items a devolver
                    </div>
                    <div className="divide-y max-h-[280px] overflow-y-auto">
                      {refundItems.map((item, index) => (
                        <div
                          key={item.saleItemId}
                          className={`p-3 flex items-center gap-3 ${
                            item.selected ? 'bg-orange-50' : 'bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleRefundToggleItem(index)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium truncate">{item.productName}</span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.unitPrice)} x {item.maxQuantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={item.maxQuantity}
                              value={item.quantity}
                              onChange={(e) =>
                                handleRefundQuantityChange(index, parseInt(e.target.value) || 0)
                              }
                              disabled={!item.selected}
                              className="w-16 px-2 py-1 text-center border rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                            />
                            <span className="text-sm text-gray-500">/ {item.maxQuantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Motivo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo de la devolucion *
                    </label>
                    <textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Ingrese el motivo..."
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  {/* Opciones */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={emitCreditNote}
                        onChange={(e) => setEmitCreditNote(e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm">Emitir Nota de Credito AFIP</span>
                    </label>
                  </div>

                  {/* Error */}
                  {refundError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{refundError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!refundSuccess && (
              <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                <div className="bg-red-100 px-4 py-2 rounded-lg">
                  <span className="text-sm text-gray-600">Items: </span>
                  <span className="font-semibold text-red-700">{getSelectedRefundCount()}</span>
                  <span className="mx-3 text-gray-400">|</span>
                  <span className="text-sm text-gray-600">Total: </span>
                  <span className="font-bold text-red-700">
                    {formatCurrency(calculateRefundTotal())}
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeRefundModal}
                    disabled={isProcessingRefund}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={processRefund}
                    disabled={isProcessingRefund || getSelectedRefundCount() === 0}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessingRefund ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Procesar Devolucion
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
