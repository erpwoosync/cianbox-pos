import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { productsApi, categoriesApi, brandsApi, Product, Category, Brand, ProductsResponse } from '../services/api';
import { Package, RefreshCw, Search, Filter, Eye, ChevronLeft, ChevronRight, Layers, Grid3x3 } from 'lucide-react';

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [hideVariants, setHideVariants] = useState(true);
  const [parentsOnly, setParentsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ProductsResponse['pagination'] | null>(null);
  const itemsPerPage = 50;

  // Debounce search para evitar muchas llamadas al backend
  const debouncedSearch = useDebounce(search, 300);

  // Cargar categorías y marcas solo una vez
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [categoriesData, brandsData] = await Promise.all([
          categoriesApi.getAll(),
          brandsApi.getAll(),
        ]);
        setCategories(categoriesData);
        setBrands(brandsData);
      } catch (error) {
        console.error('Error loading filters:', error);
      }
    };
    loadFilters();
  }, []);

  // Cargar productos cuando cambian los filtros
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await productsApi.getAll({
        categoryId: categoryFilter || undefined,
        brandId: brandFilter || undefined,
        search: debouncedSearch || undefined,
        parentsOnly: parentsOnly || undefined,
        hideVariants: hideVariants || undefined,
        page,
        limit: itemsPerPage,
      });
      setProducts(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, brandFilter, debouncedSearch, parentsOnly, hideVariants, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Reset page cuando cambian los filtros
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, brandFilter, debouncedSearch, parentsOnly, hideVariants]);

  // Memoizar el conteo de filtros activos
  const activeFiltersCount = useMemo(() => {
    return (categoryFilter ? 1 : 0) + (brandFilter ? 1 : 0) + (parentsOnly ? 1 : 0);
  }, [categoryFilter, brandFilter, parentsOnly]);

  const handleRefresh = () => {
    loadProducts();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm mb-6">
        {/* Search and filters */}
        <div className="p-4 border-b">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
                showFilters || categoryFilter || brandFilter
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Filter size={18} />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Filtros de productos variables */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideVariants}
                    onChange={(e) => setHideVariants(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Ocultar variantes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentsOnly}
                    onChange={(e) => {
                      setParentsOnly(e.target.checked);
                      if (e.target.checked) setHideVariants(true);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Solo productos padre (con variantes)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca
                  </label>
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Todas las marcas</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Products table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se encontraron productos
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Marca
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Variantes
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
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            product.isParent ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            {product.isParent ? (
                              <Layers size={20} className="text-purple-600" />
                            ) : (
                              <Package size={20} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{product.name}</p>
                              {product.isParent && (
                                <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                  Padre
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {product.barcode && <span>{product.barcode}</span>}
                              {product.size && <span>Talle: {product.size}</span>}
                              {product.color && <span>Color: {product.color}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {product.category?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {product.brand?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.isParent && product._count?.variants ? (
                          <Link
                            to={`/products/${product.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                          >
                            <Grid3x3 size={14} />
                            <span className="text-xs font-medium">{product._count.variants}</span>
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            product.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {product.isActive ? 'Activo' : 'Inactivo'}
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-gray-500">
                  Mostrando {(page - 1) * itemsPerPage + 1} -{' '}
                  {Math.min(page * itemsPerPage, pagination.total)} de{' '}
                  {pagination.total}
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
                    Página {page} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === pagination.totalPages}
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

      <div className="text-sm text-gray-500">
        Total: {pagination?.total || 0} productos
      </div>
    </div>
  );
}
