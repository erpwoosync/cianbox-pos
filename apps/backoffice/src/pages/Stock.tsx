import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsApi, stockApi, Product, VariantWithStock } from '../services/api';
import { Warehouse, RefreshCw, Search, Eye, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Layers } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Estado para productos expandidos
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [variantsData, setVariantsData] = useState<Record<string, VariantWithStock[]>>({});
  const [loadingVariants, setLoadingVariants] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsResponse, branchesData] = await Promise.all([
        productsApi.getAll({ hideVariants: true }), // Solo productos simples y padres
        stockApi.getBranches(),
      ]);
      setProducts(productsResponse.data);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (productId: string) => {
    const newExpanded = new Set(expandedProducts);

    if (expandedProducts.has(productId)) {
      newExpanded.delete(productId);
      setExpandedProducts(newExpanded);
    } else {
      newExpanded.add(productId);
      setExpandedProducts(newExpanded);

      // Cargar variantes si no están cargadas
      if (!variantsData[productId]) {
        setLoadingVariants(prev => new Set(prev).add(productId));
        try {
          const variants = await productsApi.getVariantsStock(productId);
          setVariantsData(prev => ({ ...prev, [productId]: variants }));
        } catch (error) {
          console.error('Error loading variants:', error);
        } finally {
          setLoadingVariants(prev => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
        }
      }
    }
  };

  const getTotalStock = (product: Product): number => {
    if (!product.stock || product.stock.length === 0) return 0;
    return product.stock.reduce((sum, s) => sum + Number(s.available || 0), 0);
  };

  const getStockByBranch = (stockArray: Array<{ branchId: string; available: number }> | undefined, branchId: string): number => {
    const stock = stockArray?.find((s) => s.branchId === branchId);
    return Number(stock?.available ?? 0);
  };

  const getVariantTotalStock = (variant: VariantWithStock): number => {
    if (!variant.stock || variant.stock.length === 0) return 0;
    return variant.stock.reduce((sum, s) => sum + Number(s.available || 0), 0);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());

    const totalStock = getTotalStock(product);
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'low' && totalStock > 0 && totalStock < 10) ||
      (stockFilter === 'out' && totalStock <= 0);

    const matchesBranch =
      !branchFilter ||
      product.stock?.some((s) => s.branchId === branchFilter && s.available > 0);

    return matchesSearch && matchesStock && matchesBranch;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const getStockStatus = (available: number) => {
    if (available <= 0) {
      return { color: 'text-red-600 bg-red-50', label: 'Sin stock', icon: AlertTriangle };
    }
    if (available < 10) {
      return { color: 'text-amber-600 bg-amber-50', label: 'Stock bajo', icon: AlertTriangle };
    }
    return { color: 'text-green-600 bg-green-50', label: 'OK', icon: CheckCircle };
  };

  const formatVariantName = (variant: VariantWithStock): string => {
    const parts = [];
    if (variant.size) parts.push(variant.size);
    if (variant.color) parts.push(variant.color);
    return parts.length > 0 ? parts.join(' / ') : variant.name;
  };

  const stockStats = {
    total: products.length,
    withStock: products.filter((p) => getTotalStock(p) > 0).length,
    lowStock: products.filter((p) => {
      const total = getTotalStock(p);
      return total > 0 && total < 10;
    }).length,
    outOfStock: products.filter((p) => getTotalStock(p) <= 0).length,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Warehouse size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Productos</p>
              <p className="text-xl font-bold text-gray-900">{stockStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Con Stock</p>
              <p className="text-xl font-bold text-green-600">{stockStats.withStock}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Stock Bajo</p>
              <p className="text-xl font-bold text-amber-600">{stockStats.lowStock}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sin Stock</p>
              <p className="text-xl font-bold text-red-600">{stockStats.outOfStock}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm mb-6">
        {/* Filters */}
        <div className="p-4 border-b">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as 'all' | 'low' | 'out');
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">Todo el stock</option>
                <option value="low">Stock bajo</option>
                <option value="out">Sin stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stock table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se encontraron productos
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      SKU
                    </th>
                    {branches.map((branch) => (
                      <th
                        key={branch.id}
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                      >
                        {branch.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedProducts.map((product) => {
                    const totalStock = getTotalStock(product);
                    const status = getStockStatus(totalStock);
                    const StatusIcon = status.icon;
                    const isExpanded = expandedProducts.has(product.id);
                    const isLoadingVariants = loadingVariants.has(product.id);
                    const variants = variantsData[product.id] || [];
                    const hasVariants = product.isParent && (product._count?.variants ?? 0) > 0;

                    return (
                      <>
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 sticky left-0 bg-white">
                            <div className="flex items-center gap-2">
                              {hasVariants ? (
                                <button
                                  onClick={() => toggleExpand(product.id)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  {isExpanded ? (
                                    <ChevronUp size={16} className="text-blue-500" />
                                  ) : (
                                    <ChevronDown size={16} className="text-gray-400" />
                                  )}
                                </button>
                              ) : (
                                <Warehouse size={16} className="text-blue-500 ml-1" />
                              )}
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{product.name}</span>
                                {hasVariants && (
                                  <span className="flex items-center gap-1 text-xs text-purple-600">
                                    <Layers size={12} />
                                    {product._count?.variants} variantes
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                          {branches.map((branch) => {
                            if (hasVariants) {
                              return (
                                <td key={branch.id} className="px-4 py-3 text-center text-gray-400 text-sm">
                                  -
                                </td>
                              );
                            }
                            const available = getStockByBranch(product.stock, branch.id);
                            return (
                              <td
                                key={branch.id}
                                className={`px-4 py-3 text-center font-medium ${
                                  available <= 0
                                    ? 'text-red-600'
                                    : available < 10
                                    ? 'text-amber-600'
                                    : 'text-gray-900'
                                }`}
                              >
                                {available}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center font-bold text-gray-900">
                            {hasVariants ? (
                              <span className="text-gray-400 text-sm font-normal">Ver variantes</span>
                            ) : (
                              totalStock
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!hasVariants && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${status.color}`}
                              >
                                <StatusIcon size={12} />
                                {status.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              to={`/products/${product.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Eye size={16} />
                              Ver
                            </Link>
                          </td>
                        </tr>

                        {/* Variantes expandidas */}
                        {hasVariants && isExpanded && (
                          <>
                            {isLoadingVariants ? (
                              <tr key={`${product.id}-loading`}>
                                <td colSpan={4 + branches.length} className="px-4 py-4 bg-gray-50">
                                  <div className="flex items-center justify-center gap-2 text-gray-500">
                                    <RefreshCw size={16} className="animate-spin" />
                                    Cargando variantes...
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              variants.map((variant) => {
                                const variantTotal = getVariantTotalStock(variant);
                                const variantStatus = getStockStatus(variantTotal);
                                const VariantStatusIcon = variantStatus.icon;

                                return (
                                  <tr
                                    key={variant.id}
                                    className="bg-purple-50/30 hover:bg-purple-50/50"
                                  >
                                    <td className="px-4 py-2 sticky left-0 bg-purple-50/30">
                                      <div className="flex items-center gap-2 pl-8">
                                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                        <span className="text-sm text-gray-700">
                                          {formatVariantName(variant)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                                      {variant.sku || '-'}
                                    </td>
                                    {branches.map((branch) => {
                                      const available = getStockByBranch(variant.stock, branch.id);
                                      return (
                                        <td
                                          key={branch.id}
                                          className={`px-4 py-2 text-center text-sm font-medium ${
                                            available <= 0
                                              ? 'text-red-600'
                                              : available < 10
                                              ? 'text-amber-600'
                                              : 'text-gray-700'
                                          }`}
                                        >
                                          {available}
                                        </td>
                                      );
                                    })}
                                    <td className="px-4 py-2 text-center font-bold text-sm text-gray-700">
                                      {variantTotal}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${variantStatus.color}`}
                                      >
                                        <VariantStatusIcon size={10} />
                                        {variantStatus.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <Link
                                        to={`/products/${variant.id}`}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded"
                                      >
                                        <Eye size={14} />
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-gray-500">
                  Mostrando {(page - 1) * itemsPerPage + 1} -{' '}
                  {Math.min(page * itemsPerPage, filteredProducts.length)} de{' '}
                  {filteredProducts.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {branches.length > 0 && (
        <div className="text-sm text-gray-500">
          {branches.length} sucursal(es) configuradas
        </div>
      )}
    </div>
  );
}
