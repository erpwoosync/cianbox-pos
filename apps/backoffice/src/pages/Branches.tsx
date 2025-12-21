import { useState, useEffect } from 'react';
import { stockApi } from '../services/api';
import { Store, RefreshCw, Search, MapPin, Trash2, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  cianboxBranchId?: number | null;
  productStockCount?: number;
  pointsOfSaleCount?: number;
  hasCianboxMapping?: boolean;
}

interface DiagnosticSummary {
  totalBranches: number;
  mappedToCianbox: number;
  unmapped: number;
  withStock: number;
}

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const data = await stockApi.getBranchDiagnostics();
      setBranches(data.branches);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error loading branches:', error);
      // Fallback al endpoint simple si el de diagnóstico falla
      try {
        const simpleData = await stockApi.getBranches();
        setBranches(simpleData);
      } catch {
        console.error('Error loading branches (fallback):', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('¿Eliminar sucursales no mapeadas a Cianbox?\n\nLos puntos de venta y usuarios se migrarán a la sucursal principal.')) {
      return;
    }

    setCleaning(true);
    setMessage(null);
    try {
      const result = await stockApi.cleanupUnmappedBranches();
      setMessage({
        type: 'success',
        text: result.message || `${result.results?.deleted || 0} sucursales eliminadas`,
      });
      loadBranches(); // Recargar
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al limpiar sucursales',
      });
    } finally {
      setCleaning(false);
    }
  };

  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(search.toLowerCase()) ||
    branch.code?.toLowerCase().includes(search.toLowerCase())
  );

  const unmappedCount = summary?.unmapped || branches.filter(b => !b.hasCianboxMapping && !b.cianboxBranchId).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
        <div className="flex items-center gap-2">
          {unmappedCount > 0 && (
            <button
              onClick={handleCleanup}
              disabled={cleaning}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={18} className={cleaning ? 'animate-pulse' : ''} />
              {cleaning ? 'Limpiando...' : `Limpiar (${unmappedCount})`}
            </button>
          )}
          <button
            onClick={loadBranches}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Mensaje de resultado */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">{summary.totalBranches}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{summary.mappedToCianbox}</div>
            <div className="text-sm text-gray-500">Mapeadas</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className={`text-2xl font-bold ${summary.unmapped > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary.unmapped}</div>
            <div className="text-sm text-gray-500">Sin mapear</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{summary.withStock}</div>
            <div className="text-sm text-gray-500">Con stock</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar sucursal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Branches grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se encontraron sucursales
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredBranches.map((branch) => {
              const isMapped = branch.hasCianboxMapping || branch.cianboxBranchId != null;
              return (
                <div
                  key={branch.id}
                  className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
                    !isMapped ? 'border-red-200 bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isMapped ? 'bg-orange-100' : 'bg-red-100'
                    }`}>
                      <Store className={`w-6 h-6 ${isMapped ? 'text-orange-600' : 'text-red-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900 truncate">{branch.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            branch.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {branch.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                        {isMapped ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                            <CheckCircle size={10} />
                            Cianbox #{branch.cianboxBranchId}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            Sin mapear
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Codigo: {branch.code || '-'}
                      </p>
                      {branch.productStockCount !== undefined && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <Package size={14} />
                          {branch.productStockCount} productos con stock
                        </p>
                      )}
                      {branch.address && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin size={14} />
                          {branch.address}
                        </p>
                      )}
                      {branch.phone && (
                        <p className="text-sm text-gray-500 mt-1">
                          Tel: {branch.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        Total: {branches.length} sucursales
      </div>
    </div>
  );
}
