import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Package,
} from 'lucide-react';
import { orphanOrdersApi, productsApi, OrphanMPOrder, Product } from '../services/api';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export default function CreateSaleFromOrphan() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrphanMPOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
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
      const [ordersData, productsResponse] = await Promise.all([
        orphanOrdersApi.getAll(),
        productsApi.getAll(),
      ]);

      const foundOrder = ordersData.find((o: OrphanMPOrder) => o.orderId === orderId);
      if (!foundOrder) {
        setError('Orden no encontrada');
        return;
      }

      setOrder(foundOrder);
      setProducts(productsResponse.data);
    } catch (err) {
      console.error('Error loading data:', err);
      const axiosError = err as { response?: { data?: { message?: string }; status?: number } };
      if (axiosError?.response?.data?.message) {
        setError(axiosError.response.data.message);
      } else {
        setError('Error al cargar los datos');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchQuery))
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(cart.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // Get default price from product (ensure it's a number)
      const defaultPrice = Number(product.prices?.[0]?.price) || 0;
      setCart([...cart, { product, quantity: 1, unitPrice: defaultPrice }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map((item) => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter((item) => item.quantity > 0));
  };

  const updatePrice = (productId: string, price: number) => {
    setCart(cart.map((item) =>
      item.product.id === productId ? { ...item, unitPrice: price } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const orderAmount = order ? Number(order.amount) : 0;
  const difference = Math.abs(cartTotal - orderAmount);
  const isAmountMatch = difference < 0.01;

  const handleSubmit = async () => {
    if (!order || !isAmountMatch) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await orphanOrdersApi.createSale(order.orderId, {
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/orphan-payments');
        }, 2000);
      } else {
        setError(result.message || 'Error al crear la venta');
      }
    } catch (err: unknown) {
      console.error('Error creating sale:', err);
      const axiosError = err as { response?: { data?: { message?: string; details?: unknown } } };
      let errorMessage = 'Error al crear la venta';
      if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message;
        if (axiosError.response.data.details) {
          errorMessage += ': ' + JSON.stringify(axiosError.response.data.details);
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
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
        <h2 className="text-xl font-bold text-gray-900">Venta creada exitosamente</h2>
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
          <h1 className="text-2xl font-bold text-gray-900">Crear Venta desde Pago</h1>
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
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(orderAmount)}</p>
            <p className="text-sm text-blue-700">Monto a igualar</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Search */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Buscar Productos</h2>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, SKU o codigo..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredProducts.slice(0, 20).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      {product.sku} - {formatCurrency(product.prices?.[0]?.price || 0)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => addToCart(product)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-center text-gray-500 py-4">No se encontraron productos</p>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Items de la Venta</h2>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Agrega productos para crear la venta</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{item.product.name}</p>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 bg-white border rounded hover:bg-gray-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 bg-white border rounded hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">x $</span>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border rounded text-right"
                        step="0.01"
                      />
                    </div>
                    <span className="ml-auto font-medium">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 pt-4 border-t space-y-2">
            <div className="flex justify-between text-lg">
              <span className="font-medium">Total Venta:</span>
              <span className="font-bold">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="font-medium">Pago MP:</span>
              <span className="font-bold text-blue-600">{formatCurrency(orderAmount)}</span>
            </div>
            <div className={`flex justify-between text-lg ${isAmountMatch ? 'text-green-600' : 'text-red-600'}`}>
              <span className="font-medium">Diferencia:</span>
              <span className="font-bold">
                {isAmountMatch ? 'OK' : formatCurrency(cartTotal - orderAmount)}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={cart.length === 0 || !isAmountMatch || isSubmitting}
            className={`w-full mt-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
              cart.length === 0 || !isAmountMatch
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creando venta...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Crear Venta
              </>
            )}
          </button>

          {!isAmountMatch && cart.length > 0 && (
            <p className="text-sm text-red-600 text-center mt-2">
              El total debe coincidir con el monto del pago
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
