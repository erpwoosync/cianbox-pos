import { useState, useEffect } from 'react';
import {
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Check,
  X,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  treasuryApi,
  TreasuryPending,
  TreasurySummary,
  TreasuryStatus,
} from '../services/api';
import TreasuryConfirmModal from '../components/TreasuryConfirmModal';

export default function Treasury() {
  const { tenant } = useAuth();
  const [pending, setPending] = useState<TreasuryPending[]>([]);
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TreasuryStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal
  const [selectedPending, setSelectedPending] = useState<TreasuryPending | null>(null);
  const [modalMode, setModalMode] = useState<'confirm' | 'reject' | 'view'>('view');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Paginacion
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [page, statusFilter, dateFrom, dateTo]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.fromDate = dateFrom;
      if (dateTo) params.toDate = dateTo;

      const [pendingResponse, summaryResponse] = await Promise.all([
        treasuryApi.getPending(params as Parameters<typeof treasuryApi.getPending>[0]),
        treasuryApi.getSummary({ fromDate: dateFrom || undefined, toDate: dateTo || undefined }),
      ]);

      setPending(pendingResponse.pending);
      setTotal(pendingResponse.total);
      setSummary(summaryResponse);
    } catch (error) {
      console.error('Error loading treasury data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (item: TreasuryPending, mode: 'confirm' | 'reject' | 'view') => {
    setSelectedPending(item);
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPending(null);
  };

  const handleConfirmSuccess = () => {
    handleCloseModal();
    loadData();
  };

  const getStatusIcon = (status: TreasuryStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'CONFIRMED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'PARTIAL':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: TreasuryStatus) => {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'CONFIRMED':
        return 'Confirmado';
      case 'PARTIAL':
        return 'Parcial';
      case 'REJECTED':
        return 'Rechazado';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: TreasuryStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tesoreria</h1>
          <p className="text-gray-500">Control de retiros pendientes de {tenant?.name}</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Resumen de tesoreria */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Pendientes
            </div>
            <div className="text-xl font-bold text-gray-900">
              {summary.pending.count}
            </div>
            <div className="text-sm text-gray-500">
              {formatCurrency(summary.pending.amount)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Confirmados
            </div>
            <div className="text-xl font-bold text-gray-900">
              {summary.confirmed.count}
            </div>
            <div className="text-sm text-gray-500">
              {formatCurrency(summary.confirmed.confirmedAmount)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              Parciales
            </div>
            <div className="text-xl font-bold text-gray-900">
              {summary.partial.count}
            </div>
            <div className="text-sm text-gray-500">
              {formatCurrency(summary.partial.confirmedAmount)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
              <XCircle className="w-4 h-4" />
              Rechazados
            </div>
            <div className="text-xl font-bold text-gray-900">
              {summary.rejected.count}
            </div>
            <div className="text-sm text-gray-500">
              {formatCurrency(summary.rejected.amount)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-sm mb-1">
              {summary.totals.totalDifference >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className="text-gray-600">Diferencia</span>
            </div>
            <div
              className={`text-xl font-bold ${
                summary.totals.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(summary.totals.totalDifference)}
            </div>
            <div className="text-xs text-gray-400">
              Esperado: {formatCurrency(summary.totals.totalExpected)}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                onChange={(e) => setStatusFilter(e.target.value as TreasuryStatus | '')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendientes</option>
                <option value="CONFIRMED">Confirmados</option>
                <option value="PARTIAL">Parciales</option>
                <option value="REJECTED">Rechazados</option>
              </select>
            </div>
          </div>

          {/* Boton limpiar */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Limpiar filtros
            </button>
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
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Punto de Venta
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cajero
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Motivo
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Monto Esperado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Monto Recibido
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
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Cargando retiros...
                  </td>
                </tr>
              ) : pending.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron retiros pendientes
                  </td>
                </tr>
              ) : (
                pending.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {formatDate(item.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {item.cashSession.pointOfSale.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {item.cashSession.user.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.cashSession.user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {item.cashMovement.reason}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.confirmedAmount !== null && item.confirmedAmount !== undefined ? (
                        <div
                          className={`text-sm font-medium ${
                            item.confirmedAmount === item.amount
                              ? 'text-green-600'
                              : 'text-orange-600'
                          }`}
                        >
                          {formatCurrency(item.confirmedAmount)}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                            item.status
                          )}`}
                        >
                          {getStatusIcon(item.status)}
                          {getStatusText(item.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenModal(item, 'view')}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleOpenModal(item, 'confirm')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Confirmar recepcion"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenModal(item, 'reject')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Rechazar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
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
              Mostrando {(page - 1) * pageSize + 1} a{' '}
              {Math.min(page * pageSize, total)} de {total} retiros
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

      {/* Modal */}
      {isModalOpen && selectedPending && (
        <TreasuryConfirmModal
          pending={selectedPending}
          mode={modalMode}
          onClose={handleCloseModal}
          onSuccess={handleConfirmSuccess}
        />
      )}
    </div>
  );
}
