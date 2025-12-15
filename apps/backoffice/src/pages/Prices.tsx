import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsApi, pricesApi, Product } from '../services/api';
import { DollarSign, RefreshCw, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface PriceList {
  id: string;
  name: string;
}

export default function Prices() {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsData, priceListsData] = await Promise.all([
        productsApi.getAll(),
        pricesApi.getPriceLists(),
      ]);
      setProducts(productsData);
      setPriceLists(priceListsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const getPrice = (product: Product, priceListId: string): number | null => {
    const price = product.prices?.find((p) => p.priceListId === priceListId);
    return price?.price ?? null;
  };

  const formatPrice = (price: number | null): string => {
    if (price === null) return '-';
    return '$' + price.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Precios</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm mb-6">
        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
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
        </div>

        {/* Prices table */}
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
                    {priceLists.map((pl) => (
                      <th
                        key={pl.id}
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                      >
                        {pl.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <DollarSign size={16} className="text-green-500" />
                          <span className="font-medium text-gray-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                      {priceLists.map((pl) => (
                        <td key={pl.id} className="px-4 py-3 text-right font-medium">
                          {formatPrice(getPrice(product, pl.id))}
                        </td>
                      ))}
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

      {priceLists.length > 0 && (
        <div className="text-sm text-gray-500">
          {priceLists.length} lista(s) de precios configuradas
        </div>
      )}
    </div>
  );
}
