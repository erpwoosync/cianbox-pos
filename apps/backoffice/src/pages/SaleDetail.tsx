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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

  const syncPaymentFromMP = async (paymentId: string, transactionId: string) => {
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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusBadgeClass(sale.status)}`}>
          {getStatusIcon(sale.status)}
          <span className="font-semibold">{getStatusText(sale.status)}</span>
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
                      onClick={() => syncPaymentFromMP(payment.id, payment.transactionId!)}
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
    </div>
  );
}
