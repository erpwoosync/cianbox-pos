import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Search,
  Link2,
  AlertCircle,
  CheckCircle,
  Loader2,
  ShoppingCart,
  Calendar,
} from 'lucide-react';
import { orphanOrdersApi, salesApi, OrphanMPOrder } from '../services/api';

interface Sale {
  id: string;
  saleNumber: string;
  saleDate: string;
  total: number;
  status: string;
  pointOfSale: { name: string };
  user: { name: string };
}

export default function LinkSaleToOrphan() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrphanMPOrder | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ordersData, salesData] = await Promise.all([
        orphanOrdersApi.getAll(),
        salesApi.getAll({ pageSize: 100 }),
      ]);

      const foundOrder = ordersData.find((o: OrphanMPOrder) => o.orderId === orderId);
      if (!foundOrder) {
        setError('Orden no encontrada');
        return;
      }

      setOrder(foundOrder);
      // Filter sales that match the order amount (with tolerance)
      const orderAmount = Number(foundOrder.amount);
      const matchingSales = (salesData.data || []).filter((sale: Sale) => {
        const saleTotal = Number(sale.total);
        return Math.abs(saleTotal - orderAmount) < 0.01 && sale.status === 'COMPLETED';
      });
      setSales(matchingSales);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSales = sales.filter((s) =>
    s.saleNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!order || !selectedSaleId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await orphanOrdersApi.linkSale(order.orderId, selectedSaleId);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/orphan-payments');
        }, 2000);
      } else {
        setError(result.message || 'Error al vincular la venta');
      }
    } catch (err: unknown) {
      console.error('Error linking sale:', err);
      const errorMessage = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al vincular la venta';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Venta vinculada exitosamente</h2>
        <p className="text-gray-500">Redirigiendo...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-500">{error || 'Orden no encontrada'}</p>
        <Link to="/orphan-payments" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a pagos huerfanos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/orphan-payments"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vincular Pago a Venta</h1>
          <p className="text-gray-500">Orden: {order.orderId}</p>
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">Pago procesado</p>
              <p className="text-sm text-blue-700">
                {order.cardBrand} ****{order.cardLastFour} - {order.paymentMethod === 'debit_card' ? 'Debito' : 'Credito'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(Number(order.amount))}</p>
            <p className="text-sm text-blue-700">Monto del pago</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold text-gray-900 mb-4">
          Ventas con monto coincidente ({formatCurrency(Number(order.amount))})
        </h2>

        {sales.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por numero de venta..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {sales.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No hay ventas con el mismo monto</p>
            <p className="text-sm text-gray-400 mt-1">
              Solo se muestran ventas completadas con total de {formatCurrency(Number(order.amount))}
            </p>
            <Link
              to={`/orphan-payments/${order.orderId}/create-sale`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crear nueva venta
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                onClick={() => setSelectedSaleId(sale.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedSaleId === sale.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedSaleId === sale.id ? 'bg-blue-500' : 'bg-gray-100'
                    }`}>
                      <ShoppingCart className={`w-5 h-5 ${
                        selectedSaleId === sale.id ? 'text-white' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{sale.saleNumber}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(sale.saleDate)}
                        </span>
                        <span>{sale.pointOfSale.name}</span>
                        <span>{sale.user.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(sale.total)}</p>
                    {selectedSaleId === sale.id && (
                      <CheckCircle className="w-5 h-5 text-blue-500 ml-auto mt-1" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        {sales.length > 0 && (
          <button
            onClick={handleSubmit}
            disabled={!selectedSaleId || isSubmitting}
            className={`w-full mt-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
              !selectedSaleId
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link2 className="w-5 h-5" />
                Vincular Pago a Venta
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
