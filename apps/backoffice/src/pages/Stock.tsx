import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsApi, stockApi, Product, ProductStock } from '../services/api';
import { Warehouse, RefreshCw, Search, Eye, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsData, branchesData] = await Promise.all([
        productsApi.getAll(),
        stockApi.getBranches(),
      ]);
      setProducts(productsData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalStock = (product: Product): number => {
    if (!product.stock || product.stock.length === 0) return 0;
    return product.stock.reduce((sum, s) => sum + s.available, 0);
  };

  const getStockByBranch = (product: Product, branchId: string): ProductStock | undefined => {
    return product.stock?.find((s) => s.branchId === branchId);
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

                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <Warehouse size={16} className="text-blue-500" />
                            <span className="font-medium text-gray-900">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                        {branches.map((branch) => {
                          const branchStock = getStockByBranch(product, branch.id);
                          const available = branchStock?.available ?? 0;
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
                          {totalStock}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${status.color}`}
                          >
                            <StatusIcon size={12} />
                            {status.label}
                          </span>
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
