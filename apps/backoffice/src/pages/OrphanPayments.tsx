import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Plus,
  Link2,
  DollarSign,
  Calendar,
  Clock,
  Trash2,
} from 'lucide-react';
import { orphanOrdersApi, OrphanMPOrder } from '../services/api';

export default function OrphanPayments() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrphanMPOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orphanOrdersApi.getAll();
      setOrders(data);
    } catch (err) {
      console.error('Error loading orphan orders:', err);
      setError('Error al cargar los pagos huerfanos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async (orderId: string) => {
    if (!confirm('Descartar este pago? No se creara ninguna venta asociada.')) {
      return;
    }

    setDismissingId(orderId);
    try {
      await orphanOrdersApi.dismiss(orderId);
      setOrders(orders.filter((o) => o.orderId !== orderId));
    } catch (err) {
      console.error('Error dismissing order:', err);
      setError('Error al descartar el pago');
    } finally {
      setDismissingId(null);
    }
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

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'credit_card':
        return 'Credito';
      case 'debit_card':
        return 'Debito';
      default:
        return method || 'Tarjeta';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
            Pagos Huerfanos
          </h1>
          <p className="text-gray-500">
            Pagos procesados en Mercado Pago sin venta asociada
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Info */}
      {orders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">
                Tienes {orders.length} pago(s) sin venta asociada
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Estos pagos fueron procesados exitosamente pero no se creo la venta correspondiente.
                Puedes crear una venta nueva o vincularlos a una venta existente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Lista de pagos */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Cargando pagos...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">
              No hay pagos huerfanos
            </h3>
            <p className="text-gray-500 mt-1">
              Todos los pagos tienen su venta asociada
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {orders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {order.orderId}
                          </span>
                          {order.cardBrand && order.cardLastFour && (
                            <span className="text-sm text-gray-500">
                              {order.cardBrand} ****{order.cardLastFour}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(order.processedAt || order.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            {getPaymentMethodLabel(order.paymentMethod)}
                          </span>
                          {order.installments && order.installments > 1 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {order.installments} cuotas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xl font-bold text-gray-900">
                        <DollarSign className="w-5 h-5" />
                        {formatCurrency(order.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Ref: {order.externalReference}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/orphan-payments/${order.orderId}/create-sale`)}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Crear Venta
                      </button>
                      <button
                        onClick={() => navigate(`/orphan-payments/${order.orderId}/link-sale`)}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                      >
                        <Link2 className="w-4 h-4" />
                        Vincular
                      </button>
                      <button
                        onClick={() => handleDismiss(order.orderId)}
                        disabled={dismissingId === order.orderId}
                        className="flex items-center gap-1 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        title="Descartar (no crear venta)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
