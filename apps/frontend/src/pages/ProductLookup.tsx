/**
 * Página de Consulta de Productos
 * Permite buscar productos simples y variables, ver stock en todas las sucursales
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Package,
  Layers,
  Barcode,
  MapPin,
  ChevronDown,
  ChevronUp,
  Building2,
  ArrowLeft,
  Grid3x3,
} from 'lucide-react';
import { productsService, branchesService, Branch, SizeCurveData } from '../services/api';
import { useAuthStore } from '../context/authStore';

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
    id: string;
    quantity?: number;
    reserved?: number;
    available?: number;
    branch?: { id: string; code: string; name: string };
  }>;
  isParent?: boolean;
  parentProductId?: string | null;
  size?: string | null;
  color?: string | null;
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

// Helper para obtener stock total
const getProductStock = (product: Product): number => {
  if (!product.stock || product.stock.length === 0) return 0;
  return product.stock.reduce((sum, s) => sum + (s.available || 0), 0);
};

export default function ProductLookup() {
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetail, setProductDetail] = useState<Product | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Sucursales
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  // Curva de talles
  const [sizeCurve, setSizeCurve] = useState<SizeCurveData | null>(null);
  const [loadingSizeCurve, setLoadingSizeCurve] = useState(false);
  const [expandedStockSection, setExpandedStockSection] = useState(true);

  // Cargar sucursales al montar
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const response = await branchesService.list();
        if (response.success) {
          setBranches(response.data);
          // Seleccionar la sucursal del usuario por defecto
          if (user?.branch?.id) {
            setSelectedBranchId(user.branch.id);
          } else if (response.data.length > 0) {
            setSelectedBranchId(response.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    };

    loadBranches();
  }, [user?.branch?.id]);

  // Cargar detalle del producto cuando se selecciona
  useEffect(() => {
    if (selectedProduct) {
      loadProductDetail(selectedProduct.id);
      if (selectedProduct.isParent) {
        loadSizeCurve(selectedProduct.id);
      } else {
        setSizeCurve(null);
      }
    } else {
      setProductDetail(null);
      setSizeCurve(null);
    }
  }, [selectedProduct]);

  const loadProductDetail = async (productId: string) => {
    setLoadingDetail(true);
    try {
      const response = await productsService.get(productId);
      if (response.success) {
        setProductDetail(response.data);
      }
    } catch (error) {
      console.error('Error loading product detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadSizeCurve = async (productId: string) => {
    setLoadingSizeCurve(true);
    try {
      const response = await productsService.getSizeCurve(productId, selectedBranchId || undefined);
      if (response.success) {
        setSizeCurve(response.data);
      }
    } catch (error) {
      console.error('Error loading size curve:', error);
    } finally {
      setLoadingSizeCurve(false);
    }
  };

  // Recargar curva de talles cuando cambia la sucursal
  useEffect(() => {
    if (selectedProduct?.isParent && selectedBranchId) {
      loadSizeCurve(selectedProduct.id);
    }
  }, [selectedBranchId]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSelectedProduct(null);
    setProductDetail(null);
    setSizeCurve(null);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await productsService.search(query, undefined, selectedBranchId || undefined);
      if (response.success) {
        setSearchResults(response.data);
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
    } finally {
      setIsSearching(false);
    }
  }, [selectedBranchId]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleBack = () => {
    setSelectedProduct(null);
    setProductDetail(null);
    setSizeCurve(null);
  };

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedProduct && (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedProduct ? 'Detalle del Producto' : 'Consulta de Productos'}
            </h1>
            <p className="text-gray-500">
              {selectedProduct ? selectedProduct.name : 'Buscar productos por nombre, SKU o código de barras'}
            </p>
          </div>
        </div>

        {/* Selector de sucursal */}
        <div className="relative">
          <button
            onClick={() => setShowBranchSelector(!showBranchSelector)}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Building2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">
              {selectedBranch?.name || 'Todas las sucursales'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBranchSelector ? 'rotate-180' : ''}`} />
          </button>

          {showBranchSelector && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border z-20">
              <div className="p-2">
                <button
                  onClick={() => {
                    setSelectedBranchId(null);
                    setShowBranchSelector(false);
                  }}
                  className={`w-full px-3 py-2 text-left rounded-lg text-sm ${
                    !selectedBranchId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                  }`}
                >
                  Todas las sucursales
                </button>
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      setShowBranchSelector(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-lg text-sm ${
                      selectedBranchId === branch.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    {branch.name}
                    {user?.branch?.id === branch.id && (
                      <span className="ml-2 text-xs text-gray-400">(Mi sucursal)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vista de búsqueda o detalle */}
      {!selectedProduct ? (
        <>
          {/* Barra de búsqueda */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU o código de barras..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-lg"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Resultados de búsqueda */}
          <div className="bg-white rounded-xl shadow-sm border">
            {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching ? (
              <div className="text-center py-16 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No se encontraron productos</p>
                <p className="text-sm">Intente con otro término de búsqueda</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Ingrese al menos 2 caracteres para buscar</p>
              </div>
            ) : (
              <div className="divide-y">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div
                      className={`w-16 h-16 rounded-lg flex items-center justify-center shrink-0 ${
                        product.isParent ? 'bg-purple-100' : 'bg-gray-100'
                      }`}
                    >
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
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        {product.isParent && (
                          <span className="shrink-0 px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                            Talles
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        SKU: {product.sku || '-'} | Cod: {product.barcode || '-'}
                      </p>
                      {(product.size || product.color) && (
                        <p className="text-sm text-purple-600">
                          {product.size && `Talle: ${product.size}`}
                          {product.size && product.color && ' | '}
                          {product.color && `Color: ${product.color}`}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-green-600">
                        ${getProductPrice(product).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                      {!product.isParent && (
                        <p className={`text-sm ${getProductStock(product) > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                          Stock: {getProductStock(product)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Vista de detalle */
        <div className="space-y-6">
          {/* Info del producto */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-500">Cargando detalle...</span>
              </div>
            ) : productDetail ? (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Imagen */}
                <div className="relative shrink-0">
                  <div
                    className={`w-40 h-40 rounded-xl flex items-center justify-center ${
                      productDetail.isParent ? 'bg-purple-100' : 'bg-gray-100'
                    }`}
                  >
                    {productDetail.imageUrl ? (
                      <img
                        src={productDetail.imageUrl}
                        alt={productDetail.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : productDetail.isParent ? (
                      <Layers className="w-16 h-16 text-purple-400" />
                    ) : (
                      <Package className="w-16 h-16 text-gray-400" />
                    )}
                  </div>
                  {productDetail.isParent && (
                    <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
                      Talles
                    </div>
                  )}
                </div>

                {/* Información principal */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{productDetail.name}</h2>

                  {/* Badges de talle/color */}
                  {(productDetail.size || productDetail.color) && (
                    <div className="flex items-center gap-2 mb-4">
                      {productDetail.size && (
                        <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-lg">
                          Talle: {productDetail.size}
                        </span>
                      )}
                      {productDetail.color && (
                        <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg">
                          Color: {productDetail.color}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Grid de información */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">SKU</p>
                      <p className="font-semibold text-gray-900">{productDetail.sku || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Barcode className="w-3 h-3" /> Código
                      </p>
                      <p className="font-semibold text-gray-900 font-mono">{productDetail.barcode || '-'}</p>
                    </div>
                    {productDetail.category && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Categoría</p>
                        <p className="font-semibold text-gray-900">{productDetail.category.name}</p>
                      </div>
                    )}
                    {productDetail.brand && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Marca</p>
                        <p className="font-semibold text-gray-900">{productDetail.brand.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Precio */}
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Precio</p>
                      <span className="text-3xl font-bold text-green-600">
                        ${getProductPrice(productDetail).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {productDetail.prices && productDetail.prices.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {productDetail.prices.slice(0, 3).map((price) => (
                          <div key={price.priceListId} className="bg-gray-100 px-3 py-1 rounded-lg text-sm">
                            <span className="text-gray-500">{price.priceList?.name}:</span>{' '}
                            <span className="font-medium">${price.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Stock por sucursal (solo para productos simples) */}
          {productDetail && !productDetail.isParent && productDetail.stock && productDetail.stock.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border">
              <button
                onClick={() => setExpandedStockSection(!expandedStockSection)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Stock por Sucursal</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {productDetail.stock.length} sucursales
                  </span>
                </div>
                {expandedStockSection ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedStockSection && (
                <div className="border-t p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {productDetail.stock.map((stockItem) => {
                      const isUserBranch = stockItem.branch?.id === user?.branch?.id;
                      return (
                        <div
                          key={stockItem.id}
                          className={`p-4 rounded-lg border-2 ${
                            isUserBranch ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Building2 className={`w-4 h-4 ${isUserBranch ? 'text-blue-600' : 'text-gray-500'}`} />
                              <span className="font-medium">{stockItem.branch?.name || 'Sucursal'}</span>
                              {isUserBranch && (
                                <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded">Mi sucursal</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-500">Total</p>
                              <p className="font-semibold">{stockItem.quantity || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Reservado</p>
                              <p className="font-semibold text-amber-600">{stockItem.reserved || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Disponible</p>
                              <p className={`font-bold ${(stockItem.available || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stockItem.available || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumen total */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-gray-500">Stock total disponible:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {productDetail.stock.reduce((sum, s) => sum + (s.available || 0), 0)} unidades
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Curva de talles */}
          {productDetail?.isParent && (
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-4 border-b flex items-center gap-3">
                <Grid3x3 className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-semibold">Curva de Talles</h3>
                {sizeCurve && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    Stock total: {sizeCurve.totals.total}
                  </span>
                )}
                {selectedBranch && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {selectedBranch.name}
                  </span>
                )}
              </div>

              <div className="p-4">
                {loadingSizeCurve ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <span className="ml-2 text-gray-500">Cargando curva de talles...</span>
                  </div>
                ) : sizeCurve ? (
                  <div>
                    {/* Matriz */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="px-2 py-1.5 bg-gray-100 text-left font-medium text-gray-600 uppercase border">
                              Talle
                            </th>
                            {sizeCurve.colors.map((color) => (
                              <th
                                key={color}
                                className="px-2 py-1.5 bg-gray-100 text-center font-medium text-gray-600 uppercase border min-w-[50px]"
                              >
                                {color}
                              </th>
                            ))}
                            <th className="px-2 py-1.5 bg-gray-200 text-center font-bold text-gray-700 uppercase border min-w-[45px]">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sizeCurve.sizes.map((size) => (
                            <tr key={size}>
                              <td className="px-2 py-1.5 bg-gray-50 font-medium text-gray-900 border">{size}</td>
                              {sizeCurve.colors.map((color) => {
                                const key = `${size}-${color}`;
                                const cell = sizeCurve.matrix[key];
                                const stock = cell?.available ?? 0;

                                return (
                                  <td
                                    key={key}
                                    className={`px-2 py-1.5 text-center border font-semibold ${
                                      stock <= 0
                                        ? 'bg-red-50 text-red-400'
                                        : stock < 5
                                        ? 'bg-amber-50 text-amber-600'
                                        : 'bg-green-50 text-green-600'
                                    }`}
                                  >
                                    {stock}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 bg-gray-100 text-center font-bold text-gray-900 border">
                                {sizeCurve.totals.bySize[size] || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td className="px-2 py-1.5 bg-gray-200 font-bold text-gray-900 border">Total</td>
                            {sizeCurve.colors.map((color) => (
                              <td key={color} className="px-2 py-1.5 bg-gray-100 text-center font-bold text-gray-900 border">
                                {sizeCurve.totals.byColor[color] || 0}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 bg-purple-100 text-center font-bold text-purple-700 border">
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
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No se pudo cargar la curva de talles
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overlay para cerrar selector de sucursal */}
      {showBranchSelector && (
        <div className="fixed inset-0 z-10" onClick={() => setShowBranchSelector(false)} />
      )}
    </div>
  );
}
