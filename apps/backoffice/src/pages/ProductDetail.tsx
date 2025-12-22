import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productsApi, pricesApi, stockApi, Product, ProductPrice, ProductStock, SizeCurveData } from '../services/api';
import { Package, ArrowLeft, RefreshCw, DollarSign, Warehouse, Tag, FolderTree, Grid3x3, Layers, Info, MapPin } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const [stockInfo, setStockInfo] = useState<{ isAggregated: boolean; variantCount?: number; message?: string }>({ isAggregated: false });
  const [sizeCurve, setSizeCurve] = useState<SizeCurveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // Estado para sucursales y filtro de curva de talles
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loadingSizeCurve, setLoadingSizeCurve] = useState(false);

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  }, [id]);

  // Recargar curva de talles cuando cambia la sucursal
  useEffect(() => {
    if (product?.isParent && id) {
      loadSizeCurve(selectedBranchId || undefined);
    }
  }, [selectedBranchId]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const [productData, pricesData, stockResponse, branchesData] = await Promise.all([
        productsApi.getById(id!),
        pricesApi.getByProduct(id!),
        stockApi.getByProduct(id!),
        stockApi.getBranches(),
      ]);
      setProduct(productData);
      setPrices(pricesData);
      setStock(stockResponse.data);
      setBranches(branchesData);
      setStockInfo({
        isAggregated: stockResponse.isAggregated,
        variantCount: stockResponse.variantCount,
        message: stockResponse.message,
      });

      // Si es producto padre, cargar curva de talles
      if (productData.isParent) {
        try {
          const curveData = await productsApi.getSizeCurve(id!);
          setSizeCurve(curveData);
        } catch (err) {
          console.error('Error loading size curve:', err);
        }
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSizeCurve = async (branchId?: string) => {
    if (!id) return;
    setLoadingSizeCurve(true);
    try {
      const curveData = await productsApi.getSizeCurve(id, branchId);
      setSizeCurve(curveData);
    } catch (err) {
      console.error('Error loading size curve:', err);
    } finally {
      setLoadingSizeCurve(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Producto no encontrado</p>
        <Link to="/products" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a productos
        </Link>
      </div>
    );
  }

  // Tabs dinámicos: agregar "Curva de Talles" si es producto padre
  const tabs = [
    { id: 'info', label: 'Información', icon: Package },
    { id: 'prices', label: 'Precios', icon: DollarSign },
    { id: 'stock', label: 'Stock', icon: Warehouse },
    // Agregar tab de curva de talles si es producto padre
    ...(product?.isParent ? [{ id: 'sizeCurve', label: 'Curva de Talles', icon: Grid3x3 }] : []),
  ];

  return (
    <div>
      <Link
        to="/products"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Volver a productos
      </Link>

      <div className="bg-white rounded-xl shadow-sm">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
              <Package size={32} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>SKU: {product.sku}</span>
                {product.barcode && <span>Código: {product.barcode}</span>}
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    product.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {product.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre corto</label>
                  <p className="mt-1 text-gray-900">{product.shortName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Descripción</label>
                  <p className="mt-1 text-gray-900">{product.description || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Unidad</label>
                  <p className="mt-1 text-gray-900">{product.unit || 'UN'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                  <FolderTree className="text-purple-600" size={20} />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Categoría</label>
                    <p className="text-gray-900">{product.category?.name || 'Sin categoría'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg">
                  <Tag className="text-indigo-600" size={20} />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Marca</label>
                    <p className="text-gray-900">{product.brand?.name || 'Sin marca'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prices' && (
            <div>
              {prices.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay precios configurados para este producto
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Lista de Precios
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prices.map((price) => (
                        <tr key={price.id}>
                          <td className="px-4 py-3 text-gray-900">
                            {price.priceList?.name || 'Lista ' + price.priceListId}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            ${price.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stock' && (
            <div>
              {/* Mensaje informativo para stock agregado de variantes */}
              {stockInfo.isAggregated && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Stock agregado de {stockInfo.variantCount} variantes
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Este es un producto padre con variantes de talle/color. El stock mostrado es la suma total de todas las variantes por sucursal. Para ver el detalle por variante, consulte la pestaña "Curva de Talles".
                    </p>
                  </div>
                </div>
              )}

              {stock.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {stockInfo.isAggregated
                    ? 'No hay stock registrado en ninguna variante'
                    : 'No hay stock registrado para este producto'
                  }
                </p>
              ) : (
                <>
                  {/* Resumen total */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Warehouse className="w-8 h-8 text-blue-600" />
                        <div>
                          <p className="text-sm text-gray-500">Stock Total Disponible</p>
                          <p className="text-3xl font-bold text-green-600">
                            {stock.reduce((sum, s) => sum + Number(s.available || 0), 0)} unidades
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>Total: {stock.reduce((sum, s) => sum + Number(s.quantity || 0), 0)}</p>
                        <p>Reservado: {stock.reduce((sum, s) => sum + Number(s.reserved || 0), 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tarjetas por sucursal */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Stock por Sucursal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stock.map((s) => {
                      const available = Number(s.available || 0);
                      const quantity = Number(s.quantity || 0);
                      const reserved = Number(s.reserved || 0);
                      return (
                        <div
                          key={s.id}
                          className={`p-4 rounded-xl border-2 ${
                            available <= 0
                              ? 'border-red-200 bg-red-50'
                              : available < 10
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-green-200 bg-green-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-3 h-3 rounded-full ${
                              available <= 0 ? 'bg-red-500' : available < 10 ? 'bg-amber-500' : 'bg-green-500'
                            }`} />
                            <h4 className="font-semibold text-gray-900">
                              {s.branch?.name || 'Sucursal ' + s.branchId}
                            </h4>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white/60 rounded-lg p-2">
                              <p className="text-xs text-gray-500">Total</p>
                              <p className="text-lg font-bold text-gray-900">{quantity}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2">
                              <p className="text-xs text-gray-500">Reservado</p>
                              <p className="text-lg font-bold text-amber-600">{reserved}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2">
                              <p className="text-xs text-gray-500">Disponible</p>
                              <p className={`text-lg font-bold ${
                                available <= 0 ? 'text-red-600' : available < 10 ? 'text-amber-600' : 'text-green-600'
                              }`}>{available}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab de Curva de Talles */}
          {activeTab === 'sizeCurve' && sizeCurve && (
            <div>
              {/* Header con selector de sucursal y totales */}
              <div className="mb-6 flex flex-wrap items-center gap-4">
                {/* Selector de sucursal */}
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-gray-500" />
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loadingSizeCurve}
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {loadingSizeCurve && (
                    <RefreshCw size={16} className="animate-spin text-blue-600" />
                  )}
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                  <Layers size={18} className="text-blue-600" />
                  <span className="text-sm text-gray-600">Variantes:</span>
                  <span className="font-bold text-blue-600">{sizeCurve.variants.length}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                  <Warehouse size={18} className="text-green-600" />
                  <span className="text-sm text-gray-600">Stock {selectedBranchId ? 'Sucursal' : 'Total'}:</span>
                  <span className="font-bold text-green-600">{sizeCurve.totals.total}</span>
                </div>
              </div>

              {/* Matriz de talles/colores */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase border">
                        Talle / Color
                      </th>
                      {sizeCurve.colors.map((color) => (
                        <th
                          key={color}
                          className="px-4 py-3 bg-gray-100 text-center text-xs font-medium text-gray-600 uppercase border min-w-[80px]"
                        >
                          {color}
                        </th>
                      ))}
                      <th className="px-4 py-3 bg-gray-200 text-center text-xs font-bold text-gray-700 uppercase border min-w-[80px]">
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
                          return (
                            <td
                              key={key}
                              className={`px-4 py-3 text-center border font-medium ${
                                stock <= 0
                                  ? 'bg-red-50 text-red-600'
                                  : stock < 5
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-green-50 text-green-600'
                              }`}
                              title={cell ? `SKU: ${cell.sku || '-'}\nCódigo: ${cell.barcode || '-'}` : 'Sin variante'}
                            >
                              {stock}
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
                      <td className="px-4 py-3 bg-blue-100 text-center font-bold text-blue-700 border">
                        {sizeCurve.totals.total}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Leyenda */}
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-50 border rounded"></div>
                  <span>Stock OK (≥5)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-amber-50 border rounded"></div>
                  <span>Stock bajo (1-4)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-red-50 border rounded"></div>
                  <span>Sin stock (0)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
