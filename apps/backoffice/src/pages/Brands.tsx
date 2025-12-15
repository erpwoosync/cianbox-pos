import { useState, useEffect } from 'react';
import { brandsApi, Brand } from '../services/api';
import { Tags, RefreshCw, Search } from 'lucide-react';

export default function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const data = await brandsApi.getAll();
      setBrands(data);
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Marcas</h1>
        <button
          onClick={loadBrands}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Brands grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se encontraron marcas
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {filteredBrands.map((brand) => (
              <div
                key={brand.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  {brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <Tags className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{brand.name}</h3>
                  <p className="text-sm text-gray-500">
                    {brand._count?.products || 0} productos
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    brand.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {brand.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        Total: {brands.length} marcas
      </div>
    </div>
  );
}
