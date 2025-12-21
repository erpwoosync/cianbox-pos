import { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2, Package, Grid3x3, ShoppingCart, ArrowLeft, Layers, Tag, Barcode, BoxIcon } from 'lucide-react';
import { productsService, SizeCurveData } from '../services/api';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  shortName?: string;
  imageUrl?: string;
  basePrice?: number;
  taxRate?: number;
  cianboxProductId?: number;
  category?: { id: string; name: string };
  brand?: { id: string; name: string };
  prices?: Array<{
    priceListId: string;
    price: number;
    priceNet?: number;
    priceList?: { id: string; name: string };
  }>;
  stock?: Array<{
    quantity?: number;
    reserved?: number;
    available?: number;
  }>;
  isParent?: boolean;
  parentProductId?: string | null;
  size?: string | null;
  color?: string | null;
}

interface ActivePromotion {
  id: string;
  name: string;
  type: string;
  discountValue: number;
  badgeColor?: string | null;
}

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product) => void;
  branchId?: string;
  activePromotions?: ActivePromotion[];
}

// Helper para obtener precio
const getProductPrice = (product: Product): number => {
  if (product.basePrice != null) {
    const price = Number(product.basePrice);
    if (!isNaN(price)) return price;
  }
  if (product.prices && product.prices.length > 0) {
    const price = Number(product.prices[0].price);
    if (!isNaN(price)) return price;
  }
  return 0;
};

// Helper para obtener stock disponible
const getProductStock = (product: Product): number => {
  if (!product.stock || product.stock.length === 0) return 0;
  return product.stock.reduce((sum, s) => sum + (s.available || 0), 0);
};

// Helper para formatear badge de promoción
const formatPromoBadge = (promo: ActivePromotion): string => {
  switch (promo.type) {
    case 'PERCENTAGE':
    case 'FLASH_SALE':
      return `-${promo.discountValue}%`;
    case 'FIXED_AMOUNT':
      return `-$${promo.discountValue}`;
    case 'BUY_X_GET_Y':
      return '2x1';
    case 'SECOND_UNIT_DISCOUNT':
      return `2da -${promo.discountValue}%`;
    default:
      return 'Promo';
  }
};

export default function ProductSearchModal({
  isOpen,
  onClose,
  onAddToCart,
  branchId,
  activePromotions = [],
}: ProductSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sizeCurve, setSizeCurve] = useState<SizeCurveData | null>(null);
  const [loadingSizeCurve, setLoadingSizeCurve] = useState(false);

  // Limpiar estado al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedProduct(null);
      setSizeCurve(null);
    }
  }, [isOpen]);

  // Cargar curva de talles cuando se selecciona un producto padre
  useEffect(() => {
    if (selectedProduct?.isParent) {
      loadSizeCurve(selectedProduct.id);
    } else {
      setSizeCurve(null);
    }
  }, [selectedProduct]);

  const loadSizeCurve = async (productId: string) => {
    setLoadingSizeCurve(true);
    try {
      const response = await productsService.getSizeCurve(productId, branchId);
      if (response.success) {
        setSizeCurve(response.data);
      }
    } catch (err) {
      console.error('Error loading size curve:', err);
    } finally {
      setLoadingSizeCurve(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSelectedProduct(null);
    setSizeCurve(null);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await productsService.search(query, undefined, branchId);
      if (response.success) {
        setSearchResults(response.data);
      }
    } catch (error) {
      console.error('Error en busqueda:', error);
    } finally {
      setIsSearching(false);
    }
  }, [branchId]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleBack = () => {
    setSelectedProduct(null);
    setSizeCurve(null);
  };

  // Obtener promoción aplicable al producto
  const getProductPromotion = (_product: Product): ActivePromotion | null => {
    if (!activePromotions.length) return null;
    // Simplificado: buscar promoción que aplique a este producto
    // TODO: En producción, verificar categorías, marcas, productos específicos
    return activePromotions.find(p => p.type === 'FLASH_SALE' || p.type === 'PERCENTAGE') || null;
  };

  const handleAddVariantToCart = (size: string, color: string) => {
    if (!sizeCurve || !onAddToCart || !selectedProduct) return;

    const key = `${size}-${color}`;
    const cell = sizeCurve.matrix[key];

    if (!cell || cell.available <= 0) return;

    const variant = sizeCurve.variants.find(v => v.id === cell.variantId);
    if (!variant) return;

    // Usar nombre del padre (el carrito muestra badges de talle/color)
    const variantProduct: Product = {
      id: variant.id,
      sku: variant.sku || selectedProduct.sku,
      barcode: variant.barcode || selectedProduct.barcode,
      name: selectedProduct.name,
      shortName: selectedProduct.shortName,
      imageUrl: selectedProduct.imageUrl,
      basePrice: selectedProduct.basePrice,
      taxRate: selectedProduct.taxRate,
      cianboxProductId: selectedProduct.cianboxProductId,
      category: selectedProduct.category,
      brand: selectedProduct.brand,
      prices: selectedProduct.prices,
      isParent: false,
      size: variant.size,
      color: variant.color,
    };

    onAddToCart(variantProduct);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 flex items-center gap-4">
          {selectedProduct ? (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {selectedProduct ? 'Detalle del Producto' : 'Consulta de Productos'}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedProduct ? selectedProduct.name : 'Buscar por nombre, SKU o codigo de barras'}
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
          {!selectedProduct ? (
            <>
              {/* Barra de busqueda */}
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-lg"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                  )}
                </div>
              </div>

              {/* Resultados de busqueda */}
              <div className="flex-1 overflow-y-auto p-4">
                {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron productos</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Ingrese al menos 2 caracteres para buscar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                          product.isParent
                            ? 'border-purple-200 hover:border-purple-400 bg-purple-50/50'
                            : 'border-gray-200 hover:border-blue-400'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-16 h-16 rounded-lg flex items-center justify-center shrink-0 ${
                            product.isParent ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : product.isParent ? (
                              <Layers className="w-8 h-8 text-purple-400" />
                            ) : (
                              <Package className="w-8 h-8 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900 truncate">
                                {product.name}
                              </p>
                              {product.isParent && (
                                <span className="shrink-0 px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                                  Talles
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              SKU: {product.sku}
                            </p>
                            {product.barcode && (
                              <p className="text-sm text-gray-500 truncate">
                                Cod: {product.barcode}
                              </p>
                            )}
                            {(product.size || product.color) && (
                              <p className="text-sm text-purple-600">
                                {product.size && `Talle: ${product.size}`}
                                {product.size && product.color && ' | '}
                                {product.color && `Color: ${product.color}`}
                              </p>
                            )}
                            <p className="text-lg font-bold text-blue-600 mt-1">
                              ${getProductPrice(product).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Vista de detalle del producto */
            <div className="flex-1 overflow-y-auto p-4">
              {/* Info del producto */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                {(() => {
                  const promo = getProductPromotion(selectedProduct);
                  const stock = getProductStock(selectedProduct);
                  return (
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Imagen y badges */}
                      <div className="relative shrink-0">
                        <div className={`w-32 h-32 lg:w-40 lg:h-40 rounded-xl flex items-center justify-center ${
                          selectedProduct.isParent ? 'bg-purple-100' : 'bg-gray-200'
                        }`}>
                          {selectedProduct.imageUrl ? (
                            <img
                              src={selectedProduct.imageUrl}
                              alt={selectedProduct.name}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : selectedProduct.isParent ? (
                            <Layers className="w-16 h-16 text-purple-400" />
                          ) : (
                            <Package className="w-16 h-16 text-gray-400" />
                          )}
                        </div>
                        {/* Badge promoción */}
                        {promo && (
                          <div
                            style={{ backgroundColor: promo.badgeColor || '#22C55E' }}
                            className="absolute -top-2 -right-2 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1"
                          >
                            <Tag className="w-4 h-4" />
                            {formatPromoBadge(promo)}
                          </div>
                        )}
                        {/* Badge talles */}
                        {selectedProduct.isParent && (
                          <div className={`absolute ${promo ? '-top-2 -left-2' : '-top-2 -right-2'} bg-purple-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg`}>
                            Talles
                          </div>
                        )}
                      </div>

                      {/* Información principal */}
                      <div className="flex-1">
                        {/* Nombre y badges de variante */}
                        <div className="mb-3">
                          <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedProduct.name}</h2>
                          {/* Badges de talle/color para variantes */}
                          {(selectedProduct.size || selectedProduct.color) && (
                            <div className="flex items-center gap-2 mt-2">
                              {selectedProduct.size && (
                                <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-lg">
                                  Talle: {selectedProduct.size}
                                </span>
                              )}
                              {selectedProduct.color && (
                                <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg">
                                  Color: {selectedProduct.color}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Badge promoción inline */}
                          {promo && (
                            <div className="mt-2">
                              <span
                                style={{ backgroundColor: `${promo.badgeColor || '#22C55E'}20`, color: promo.badgeColor || '#22C55E' }}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
                              >
                                <Tag className="w-4 h-4" />
                                {promo.name}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Grid de información */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          {/* SKU */}
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">SKU</p>
                            <p className="font-semibold text-gray-900">{selectedProduct.sku || '-'}</p>
                          </div>
                          {/* Código de barras */}
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <Barcode className="w-3 h-3" /> Código
                            </p>
                            <p className="font-semibold text-gray-900 font-mono">{selectedProduct.barcode || '-'}</p>
                          </div>
                          {/* Stock (solo para productos no padre) */}
                          {!selectedProduct.isParent && (
                            <div className="bg-white rounded-lg p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <BoxIcon className="w-3 h-3" /> Stock
                              </p>
                              <p className={`font-semibold ${
                                stock <= 0 ? 'text-red-600' : stock < 5 ? 'text-amber-600' : 'text-green-600'
                              }`}>
                                {stock} unidades
                              </p>
                            </div>
                          )}
                          {/* Categoría */}
                          {selectedProduct.category && (
                            <div className="bg-white rounded-lg p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Categoría</p>
                              <p className="font-semibold text-gray-900">{selectedProduct.category.name}</p>
                            </div>
                          )}
                          {/* Marca */}
                          {selectedProduct.brand && (
                            <div className="bg-white rounded-lg p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Marca</p>
                              <p className="font-semibold text-gray-900">{selectedProduct.brand.name}</p>
                            </div>
                          )}
                        </div>

                        {/* Precio y botón agregar */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <div>
                            <p className="text-sm text-gray-500">Precio</p>
                            <span className="text-3xl font-bold text-green-600">
                              ${getProductPrice(selectedProduct).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Botón agregar si no es padre */}
                          {!selectedProduct.isParent && onAddToCart && (
                            <button
                              onClick={() => {
                                onAddToCart(selectedProduct);
                                onClose();
                              }}
                              disabled={stock <= 0}
                              className={`px-8 py-4 rounded-xl flex items-center gap-2 font-semibold text-lg transition-all ${
                                stock <= 0
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105 shadow-lg'
                              }`}
                            >
                              <ShoppingCart className="w-6 h-6" />
                              {stock <= 0 ? 'Sin Stock' : 'Agregar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Curva de talles */}
              {selectedProduct.isParent && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Grid3x3 className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-semibold">Curva de Talles</h3>
                    {sizeCurve && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        Stock total: {sizeCurve.totals.total}
                      </span>
                    )}
                  </div>

                  {loadingSizeCurve ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                      <span className="ml-2 text-gray-500">Cargando curva de talles...</span>
                    </div>
                  ) : sizeCurve ? (
                    <div>
                      {/* Matriz */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[500px]">
                          <thead>
                            <tr>
                              <th className="px-4 py-3 bg-gray-100 text-left text-sm font-medium text-gray-600 uppercase border">
                                Talle / Color
                              </th>
                              {sizeCurve.colors.map((color) => (
                                <th
                                  key={color}
                                  className="px-4 py-3 bg-gray-100 text-center text-sm font-medium text-gray-600 uppercase border min-w-[100px]"
                                >
                                  {color}
                                </th>
                              ))}
                              <th className="px-4 py-3 bg-gray-200 text-center text-sm font-bold text-gray-700 uppercase border min-w-[80px]">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sizeCurve.sizes.map((size) => (
                              <tr key={size}>
                                <td className="px-4 py-3 bg-gray-50 font-medium text-gray-900 border">
                                  {size}
                                </td>
                                {sizeCurve.colors.map((color) => {
                                  const key = `${size}-${color}`;
                                  const cell = sizeCurve.matrix[key];
                                  const stock = cell?.available ?? 0;
                                  const hasStock = stock > 0;

                                  return (
                                    <td
                                      key={key}
                                      onClick={() => hasStock && onAddToCart && handleAddVariantToCart(size, color)}
                                      className={`px-4 py-4 text-center border font-medium transition-all ${
                                        hasStock && onAddToCart
                                          ? 'cursor-pointer hover:scale-105 hover:shadow-lg'
                                          : hasStock
                                          ? ''
                                          : 'cursor-not-allowed opacity-50'
                                      } ${
                                        stock <= 0
                                          ? 'bg-red-50 text-red-400'
                                          : stock < 5
                                          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                                      }`}
                                      title={
                                        hasStock && onAddToCart
                                          ? `Click para agregar ${size} ${color} al carrito`
                                          : hasStock
                                          ? `${stock} disponibles`
                                          : 'Sin stock'
                                      }
                                    >
                                      <div className="text-lg font-bold">{stock}</div>
                                      {cell && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          {cell.sku || '-'}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 bg-gray-100 text-center font-bold text-gray-900 border">
                                  {sizeCurve.totals.bySize[size] || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td className="px-4 py-3 bg-gray-200 font-bold text-gray-900 border">
                                Total
                              </td>
                              {sizeCurve.colors.map((color) => (
                                <td
                                  key={color}
                                  className="px-4 py-3 bg-gray-100 text-center font-bold text-gray-900 border"
                                >
                                  {sizeCurve.totals.byColor[color] || 0}
                                </td>
                              ))}
                              <td className="px-4 py-3 bg-purple-100 text-center font-bold text-purple-700 border text-lg">
                                {sizeCurve.totals.total}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Leyenda */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-green-50 border rounded"></div>
                          <span>Stock OK (5+)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-amber-50 border rounded"></div>
                          <span>Stock bajo (1-4)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-red-50 border rounded"></div>
                          <span>Sin stock (0)</span>
                        </div>
                        {onAddToCart && (
                          <div className="ml-auto text-purple-600 font-medium">
                            Click en una celda con stock para agregar al carrito
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No se pudo cargar la curva de talles
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
