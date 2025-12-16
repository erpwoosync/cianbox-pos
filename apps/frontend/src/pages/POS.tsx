import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  ArrowLeft,
  Tag,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import { productsService, salesService, pointsOfSaleService } from '../services/api';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  shortName?: string;
  imageUrl?: string;
  basePrice?: number;
  taxRate?: number;
  category?: { id: string; name: string };
  prices?: Array<{ priceListId: string; price: number; priceList?: { id: string; name: string } }>;
}

// Helper para obtener el precio del producto
const getProductPrice = (product: Product): number => {
  // Primero intentar basePrice
  if (product.basePrice != null) {
    const price = Number(product.basePrice);
    if (!isNaN(price)) return price;
  }
  // Luego buscar en prices (primer precio disponible)
  if (product.prices && product.prices.length > 0) {
    const price = Number(product.prices[0].price);
    if (!isNaN(price)) return price;
  }
  return 0;
};

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  promotionId?: string;
  promotionName?: string;
}

interface Category {
  id: string;
  name: string;
}

interface PointOfSale {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  branch?: { id: string; name: string };
  priceList?: { id: string; name: string; currency: string };
}

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR';

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Estado del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estado de productos y categorías
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Estado de punto de venta
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [selectedPOS, setSelectedPOS] = useState<PointOfSale | null>(null);
  const [showPOSSelector, setShowPOSSelector] = useState(false);

  // Estado del pago
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Cargar categorías y productos
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [categoriesRes, productsRes, posRes] = await Promise.all([
        productsService.getCategories(),
        productsService.list({ pageSize: 100 }),
        pointsOfSaleService.list(),
      ]);

      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
      }

      if (productsRes.success) {
        setProducts(productsRes.data);
      }

      if (posRes.success) {
        // Filtrar puntos de venta activos de la sucursal del usuario
        const userBranchId = user?.branch?.id;
        const activePOS = posRes.data.filter(
          (pos: PointOfSale) => pos.isActive && (!userBranchId || pos.branch?.id === userBranchId)
        );
        setPointsOfSale(activePOS);

        // Auto-seleccionar si solo hay uno
        if (activePOS.length === 1) {
          setSelectedPOS(activePOS[0]);
        } else if (activePOS.length > 1) {
          // Mostrar selector si hay múltiples
          setShowPOSSelector(true);
        } else if (activePOS.length === 0) {
          alert('No hay puntos de venta configurados para esta sucursal');
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Búsqueda de productos
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await productsService.search(
        query,
        undefined,
        user?.branch?.id
      );
      if (response.success) {
        setSearchResults(response.data);

        // Si es un código de barras exacto y hay un resultado, agregar al carrito
        if (response.data.length === 1 && response.data[0].barcode === query) {
          addToCart(response.data[0]);
          setSearchQuery('');
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
    } finally {
      setIsSearching(false);
    }
  }, [user?.branch?.id]);

  // Agregar producto al carrito
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].subtotal =
          updated[existingIndex].quantity * updated[existingIndex].unitPrice -
          updated[existingIndex].discount;
        return updated;
      }

      const price = getProductPrice(product);
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          product,
          quantity: 1,
          unitPrice: price,
          discount: 0,
          subtotal: price,
        },
      ];
    });

    setSearchQuery('');
    setSearchResults([]);
  };

  // Actualizar cantidad
  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQty = Math.max(0, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.unitPrice - item.discount,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Eliminar item
  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Calcular vuelto
  const tenderedAmount = parseFloat(amountTendered) || 0;
  const change = tenderedAmount - total;

  // Procesar venta
  const processSale = async () => {
    if (cart.length === 0) return;

    if (!selectedPOS) {
      setShowPOSSelector(true);
      return;
    }

    setIsProcessing(true);
    try {
      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        items: cart.map((item) => ({
          productId: item.product.id,
          productCode: item.product.sku,
          productName: item.product.name,
          productBarcode: item.product.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.product.taxRate || 21,
          promotionId: item.promotionId,
          promotionName: item.promotionName,
        })),
        payments: [
          {
            method: selectedPaymentMethod,
            amount: total,
            amountTendered:
              selectedPaymentMethod === 'CASH' ? tenderedAmount : undefined,
          },
        ],
      };

      const response = await salesService.create(saleData);

      if (response.success) {
        // Limpiar carrito y mostrar confirmación
        setCart([]);
        setShowPayment(false);
        setAmountTendered('');
        alert(`Venta #${response.data.saleNumber} registrada correctamente`);
      }
    } catch (error) {
      console.error('Error procesando venta:', error);
      alert('Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtrar productos por categoría
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category?.id === selectedCategory)
    : products;

  // Filtrar categorías que tienen productos
  const categoriesWithProducts = categories.filter((cat) =>
    products.some((p) => p.category?.id === cat.id)
  );

  return (
    <div className="pos-layout">
      {/* Modal selector de Punto de Venta */}
      {showPOSSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Seleccionar Punto de Venta</h3>
            <div className="space-y-2">
              {pointsOfSale.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => {
                    setSelectedPOS(pos);
                    setShowPOSSelector(false);
                  }}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedPOS?.id === pos.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{pos.name}</p>
                  <p className="text-sm text-gray-500">
                    {pos.code} {pos.branch && `• ${pos.branch.name}`}
                  </p>
                  {pos.priceList && (
                    <p className="text-xs text-gray-400 mt-1">
                      Lista: {pos.priceList.name}
                    </p>
                  )}
                </button>
              ))}
            </div>
            {pointsOfSale.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No hay puntos de venta configurados
              </p>
            )}
            {selectedPOS && (
              <button
                onClick={() => setShowPOSSelector(false)}
                className="w-full btn btn-primary mt-4"
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel izquierdo - Productos */}
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          <div className="text-right flex items-center gap-4">
            {/* Indicador de POS */}
            <button
              onClick={() => pointsOfSale.length > 1 && setShowPOSSelector(true)}
              className={`px-3 py-1 rounded-lg text-sm ${
                selectedPOS
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              } ${pointsOfSale.length > 1 ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              {selectedPOS ? `Caja: ${selectedPOS.name}` : 'Sin caja'}
            </button>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.branch?.name}</p>
            </div>
          </div>
        </div>

        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <div className="absolute top-20 left-4 right-[396px] bg-white rounded-lg shadow-lg border z-10 max-h-96 overflow-y-auto">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <ShoppingCart className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    {product.sku} | {product.barcode}
                  </p>
                </div>
                <p className="font-semibold">
                  ${getProductPrice(product).toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Categorías */}
        <div className="flex gap-2 p-4 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todos
          </button>
          {categoriesWithProducts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingProducts ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all text-left"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingCart className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <p className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
                    {product.shortName || product.name}
                  </p>
                  <p className="text-primary-600 font-semibold mt-1">
                    ${getProductPrice(product).toFixed(2)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho - Carrito */}
      <div className="flex flex-col h-screen bg-white border-l">
        {/* Header del carrito */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito
              {itemCount > 0 && (
                <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {itemCount}
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p>Carrito vacío</p>
              <p className="text-sm">Escanee o busque productos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-lg p-3 flex gap-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${item.unitPrice.toFixed(2)} c/u
                    </p>
                    {item.promotionName && (
                      <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3" />
                        {item.promotionName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-600 mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales y pago */}
        <div className="border-t p-4 space-y-4">
          {/* Totales */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuentos</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Botón de cobrar */}
          {!showPayment ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full btn btn-success py-4 text-lg disabled:opacity-50"
            >
              Cobrar ${total.toFixed(2)}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Métodos de pago */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { method: 'CASH' as PaymentMethod, icon: Banknote, label: 'Efectivo' },
                  { method: 'CREDIT_CARD' as PaymentMethod, icon: CreditCard, label: 'Crédito' },
                  { method: 'DEBIT_CARD' as PaymentMethod, icon: CreditCard, label: 'Débito' },
                  { method: 'QR' as PaymentMethod, icon: QrCode, label: 'QR' },
                ].map(({ method, icon: Icon, label }) => (
                  <button
                    key={method}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                      selectedPaymentMethod === method
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>

              {/* Input de monto (solo efectivo) */}
              {selectedPaymentMethod === 'CASH' && (
                <div>
                  <label className="text-sm text-gray-500">Monto recibido</label>
                  <input
                    type="number"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder="0.00"
                    className="input text-xl text-right"
                    min={total}
                  />
                  {tenderedAmount >= total && (
                    <p className="text-right text-green-600 font-semibold mt-1">
                      Vuelto: ${change.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPayment(false)}
                  className="flex-1 btn btn-secondary py-3"
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </button>
                <button
                  onClick={processSale}
                  disabled={
                    isProcessing ||
                    (selectedPaymentMethod === 'CASH' && tenderedAmount < total)
                  }
                  className="flex-1 btn btn-success py-3 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 mr-2" />
                  )}
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
