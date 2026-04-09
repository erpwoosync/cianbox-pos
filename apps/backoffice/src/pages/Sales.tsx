import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  Calendar,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { cianboxApi } from '../services/api';

interface Sale {
  id: string;
  saleNumber: string;
  saleDate: string;
  total: number;
  status: string;
  cianboxSyncStatus?: string | null;
  cianboxError?: string | null;
  cianboxSaleId?: number | null;
  pointOfSale: {
    id: string;
    name: string;
    code: string;
  };
  user: {
    id: string;
    name: string;
  };
  customer?: {
    id: string;
    name: string;
  };
  _count?: {
    items: number;
  };
}

export default function Sales() {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Paginacion
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Cianbox failed sales
  const [failedSales, setFailedSales] = useState<Sale[]>([]);
  const [failedSalesCount, setFailedSalesCount] = useState(0);
  const [showFailedSales, setShowFailedSales] = useState(false);
  const [isLoadingFailed, setIsLoadingFailed] = useState(false);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryingSaleId, setRetryingSaleId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSales();
  }, [page, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadFailedSalesCount();
  }, []);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        pageSize: pageSize.toString(),
      };

      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await api.get('/backoffice/sales', { params });

      if (response.data.success) {
        setSales(response.data.data);
        setTotal(response.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFailedSalesCount = async () => {
    try {
      const response = await cianboxApi.getFailedSales();
      if (response.success) {
        setFailedSales(response.data);
        setFailedSalesCount(response.pagination?.total || response.data.length);
      }
    } catch {
      // Silently fail - Cianbox may not be configured
    }
  };

  const loadFailedSales = useCallback(async () => {
    setIsLoadingFailed(true);
    try {
      const response = await cianboxApi.getFailedSales();
      if (response.success) {
        setFailedSales(response.data);
        setFailedSalesCount(response.pagination?.total || response.data.length);
      }
    } catch (error) {
      console.error('Error loading failed sales:', error);
    } finally {
      setIsLoadingFailed(false);
    }
  }, []);

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    setRetryMessage(null);
    try {
      const response = await cianboxApi.retryAll();
      if (response.success) {
        const data = response.data;
        setRetryMessage({
          type: 'success',
          text: `Reintento completado: ${data.succeeded || 0} exitosas, ${data.failed || 0} fallidas de ${data.total || 0} ventas.`,
        });
        // Reload failed sales list
        await loadFailedSales();
        // Also reload main sales list to reflect any status changes
        loadSales();
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Error desconocido';
      setRetryMessage({
        type: 'error',
        text: `Error al reintentar: ${errMsg}`,
      });
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleRetrySingle = async (saleId: string) => {
    setRetryingSaleId(saleId);
    setRetryMessage(null);
    try {
      const response = await cianboxApi.retrySale(saleId);
      if (response.success) {
        const data = response.data;
        if (data.cianboxSyncStatus === 'SYNCED') {
          setRetryMessage({ type: 'success', text: `Venta sincronizada correctamente.` });
        } else {
          setRetryMessage({ type: 'error', text: `La venta sigue fallida: ${data.cianboxError || 'Error desconocido'}` });
        }
        // Reload
        await loadFailedSales();
        loadSales();
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Error desconocido';
      setRetryMessage({
        type: 'error',
        text: `Error al reintentar venta: ${errMsg}`,
      });
    } finally {
      setRetryingSaleId(null);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadSales();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'CANCELLED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'PENDING':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <p className="text-gray-500">Historial de ventas de {tenant?.name}</p>
      </div>

      {/* Cianbox Failed Sales Banner */}
      {failedSalesCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
          {/* Banner header */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-red-100 transition-colors"
            onClick={() => {
              setShowFailedSales(!showFailedSales);
              if (!showFailedSales && failedSales.length === 0) {
                loadFailedSales();
              }
            }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <span className="font-semibold text-red-800">
                  {failedSalesCount} {failedSalesCount === 1 ? 'venta no sincronizada' : 'ventas no sincronizadas'} con Cianbox
                </span>
                <p className="text-sm text-red-600">
                  Estas ventas no pudieron enviarse al ERP. Revisa los errores y reintenta.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetryAll();
                }}
                disabled={isRetryingAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRetryingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Reintentar todas
              </button>
              {showFailedSales ? (
                <ChevronUp className="w-5 h-5 text-red-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>

          {/* Retry message */}
          {retryMessage && (
            <div
              className={`mx-4 mb-3 px-4 py-2 rounded-lg text-sm ${
                retryMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}
            >
              {retryMessage.text}
            </div>
          )}

          {/* Failed sales list */}
          {showFailedSales && (
            <div className="border-t border-red-200">
              {isLoadingFailed ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                  <span className="ml-2 text-sm text-red-600">Cargando ventas fallidas...</span>
                </div>
              ) : failedSales.length === 0 ? (
                <div className="px-4 py-4 text-sm text-red-600 text-center">
                  No hay ventas fallidas pendientes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-red-100/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">
                          Numero
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">
                          Punto de Venta
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-red-700 uppercase">
                          Total
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">
                          Error
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-red-700 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {failedSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-red-50/50">
                          <td className="px-4 py-2">
                            <span className="text-sm font-medium text-gray-900">
                              {sale.saleNumber}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm text-gray-700">
                              {formatDate(sale.saleDate)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm text-gray-700">
                              {sale.pointOfSale?.name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(sale.total)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className="text-xs text-red-700 line-clamp-2"
                              title={sale.cianboxError || 'Sin detalle'}
                            >
                              {sale.cianboxError || 'Sin detalle del error'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleRetrySingle(sale.id)}
                                disabled={retryingSaleId === sale.id}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reintentar envio"
                              >
                                {retryingSaleId === sale.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                                Reintentar
                              </button>
                              <button
                                onClick={() => navigate(`/sales/${sale.id}`)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Ver detalle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Busqueda */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar por numero de venta
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="SUC-001-CAJA-01-..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="COMPLETED">Completadas</option>
                <option value="CANCELLED">Canceladas</option>
                <option value="PENDING">Pendientes</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Numero
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Punto de Venta
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cajero
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Items
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
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
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Cargando ventas...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron ventas
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {sale.saleNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {formatDate(sale.saleDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {sale.pointOfSale.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {sale.pointOfSale.code}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{sale.user.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {sale.customer?.name || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <ShoppingCart className="w-4 h-4" />
                        {sale._count?.items || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-sm font-semibold text-gray-900">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(sale.total)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {getStatusIcon(sale.status)}
                        <span className="text-sm">{getStatusText(sale.status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/sales/${sale.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacion */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, total)} de {total} ventas
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 border rounded-lg ${
                        page === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'hover:bg-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
