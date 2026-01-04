import { useState, useEffect } from 'react';
import {
  Filter,
  Plus,
  RefreshCw,
  Gift,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Ban,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  giftCardsApi,
  GiftCard,
  GiftCardStatus,
  GiftCardTransaction,
} from '../services/api';
import GenerateGiftCardsModal from '../components/GenerateGiftCardsModal';

export default function GiftCards() {
  const { tenant } = useAuth();
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GiftCardStatus | ''>('');
  const [searchCode, setSearchCode] = useState('');

  // Modales
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCard | null>(null);
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([]);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isBalanceChecking, setIsBalanceChecking] = useState(false);
  const [balanceResult, setBalanceResult] = useState<GiftCard | null>(null);

  // Paginacion
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadGiftCards();
  }, [page, statusFilter]);

  const loadGiftCards = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (statusFilter) params.status = statusFilter;

      const response = await giftCardsApi.getAll(params as Parameters<typeof giftCardsApi.getAll>[0]);
      setGiftCards(response.giftCards);
      setTotal(response.total);
    } catch (error) {
      console.error('Error loading gift cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTransactions = async (giftCard: GiftCard) => {
    try {
      const response = await giftCardsApi.getTransactions(giftCard.id);
      setSelectedGiftCard(response.giftCard);
      setTransactions(response.transactions);
      setIsTransactionsModalOpen(true);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleCheckBalance = async () => {
    if (!searchCode) return;

    setIsBalanceChecking(true);
    setBalanceResult(null);

    try {
      const result = await giftCardsApi.checkBalance(searchCode);
      setBalanceResult(result);
    } catch (error) {
      console.error('Error checking balance:', error);
      alert('Gift card no encontrada o codigo invalido');
    } finally {
      setIsBalanceChecking(false);
    }
  };

  const handleCancelGiftCard = async (code: string) => {
    const reason = prompt('Ingrese el motivo de la cancelacion:');
    if (!reason) return;

    try {
      await giftCardsApi.cancel(code, reason);
      loadGiftCards();
      alert('Gift card cancelada correctamente');
    } catch (error) {
      console.error('Error canceling gift card:', error);
      alert('Error al cancelar la gift card');
    }
  };

  const getStatusIcon = (status: GiftCardStatus) => {
    switch (status) {
      case 'INACTIVE':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'ACTIVE':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'DEPLETED':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      case 'EXPIRED':
        return <XCircle className="w-4 h-4 text-orange-600" />;
      case 'CANCELLED':
        return <Ban className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: GiftCardStatus) => {
    switch (status) {
      case 'INACTIVE':
        return 'Inactiva';
      case 'ACTIVE':
        return 'Activa';
      case 'DEPLETED':
        return 'Agotada';
      case 'EXPIRED':
        return 'Expirada';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: GiftCardStatus) => {
    switch (status) {
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'DEPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-orange-100 text-orange-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
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

  // Estadisticas
  const stats = {
    active: giftCards.filter(g => g.status === 'ACTIVE').length,
    inactive: giftCards.filter(g => g.status === 'INACTIVE').length,
    totalBalance: giftCards
      .filter(g => g.status === 'ACTIVE')
      .reduce((sum, g) => sum + g.currentBalance, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
          <p className="text-gray-500">Gestion de tarjetas de regalo de {tenant?.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadGiftCards}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Generar Gift Cards
          </button>
        </div>
      </div>

      {/* Estadisticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Gift className="w-4 h-4" />
            Total Gift Cards
          </div>
          <div className="text-2xl font-bold text-gray-900">{total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Activas
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Sin Activar
          </div>
          <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
            <CreditCard className="w-4 h-4" />
            Saldo Disponible
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(stats.totalBalance)}
          </div>
        </div>
      </div>

      {/* Buscar por codigo */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consultar Saldo
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                placeholder="Ingrese el codigo de la gift card..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleCheckBalance}
            disabled={!searchCode || isBalanceChecking}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isBalanceChecking ? 'Buscando...' : 'Consultar'}
          </button>
        </div>

        {/* Resultado de busqueda */}
        {balanceResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Codigo</p>
                <p className="text-lg font-mono font-bold text-gray-900">{balanceResult.code}</p>
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                    balanceResult.status
                  )}`}
                >
                  {getStatusIcon(balanceResult.status)}
                  {getStatusText(balanceResult.status)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-500">Monto Inicial</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(balanceResult.initialAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Saldo Actual</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(balanceResult.currentBalance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vencimiento</p>
                <p className="text-sm font-medium text-gray-900">
                  {balanceResult.expiresAt ? formatDate(balanceResult.expiresAt) : 'Sin vencimiento'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as GiftCardStatus | '')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="INACTIVE">Sin activar</option>
                <option value="ACTIVE">Activas</option>
                <option value="DEPLETED">Agotadas</option>
                <option value="EXPIRED">Expiradas</option>
                <option value="CANCELLED">Canceladas</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              setStatusFilter('');
              setPage(1);
            }}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Codigo
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Monto Inicial
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Saldo Actual
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Creada
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Activada
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vencimiento
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
                    Cargando gift cards...
                  </td>
                </tr>
              ) : giftCards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron gift cards
                  </td>
                </tr>
              ) : (
                giftCards.map((giftCard) => (
                  <tr key={giftCard.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono font-medium text-gray-900">
                        {giftCard.code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(giftCard.initialAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`text-sm font-medium ${
                          giftCard.currentBalance > 0 ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {formatCurrency(giftCard.currentBalance)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                            giftCard.status
                          )}`}
                        >
                          {getStatusIcon(giftCard.status)}
                          {getStatusText(giftCard.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {formatDate(giftCard.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {formatDate(giftCard.activatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {giftCard.expiresAt ? formatDate(giftCard.expiresAt) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewTransactions(giftCard)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Ver historial"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(giftCard.status === 'ACTIVE' || giftCard.status === 'INACTIVE') && (
                          <button
                            onClick={() => handleCancelGiftCard(giftCard.code)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Cancelar"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
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
              {Math.min(page * pageSize, total)} de {total} gift cards
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
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

      {/* Modal Generar Gift Cards */}
      {isGenerateModalOpen && (
        <GenerateGiftCardsModal
          onClose={() => setIsGenerateModalOpen(false)}
          onSuccess={() => {
            setIsGenerateModalOpen(false);
            loadGiftCards();
          }}
        />
      )}

      {/* Modal Historial de Transacciones */}
      {isTransactionsModalOpen && selectedGiftCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsTransactionsModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Historial de Transacciones
                </h2>
                <p className="text-sm text-gray-500 font-mono">
                  {selectedGiftCard.code}
                </p>
              </div>
              <button
                onClick={() => setIsTransactionsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Info de la gift card */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Monto Inicial</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(selectedGiftCard.initialAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Saldo Actual</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedGiftCard.currentBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                        selectedGiftCard.status
                      )}`}
                    >
                      {getStatusIcon(selectedGiftCard.status)}
                      {getStatusText(selectedGiftCard.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de transacciones */}
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Sin transacciones registradas
                  </p>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            tx.type === 'ACTIVATION'
                              ? 'bg-green-100'
                              : tx.type === 'REDEMPTION'
                              ? 'bg-blue-100'
                              : tx.type === 'REFUND'
                              ? 'bg-purple-100'
                              : 'bg-red-100'
                          }`}
                        >
                          {tx.type === 'ACTIVATION' && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          {tx.type === 'REDEMPTION' && (
                            <CreditCard className="w-4 h-4 text-blue-600" />
                          )}
                          {tx.type === 'REFUND' && (
                            <Gift className="w-4 h-4 text-purple-600" />
                          )}
                          {tx.type === 'CANCELLATION' && (
                            <Ban className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {tx.type === 'ACTIVATION' && 'Activacion'}
                            {tx.type === 'REDEMPTION' && 'Canje'}
                            {tx.type === 'REFUND' && 'Reembolso'}
                            {tx.type === 'CANCELLATION' && 'Cancelacion'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(tx.createdAt)}
                            {tx.user && ` - ${tx.user.name}`}
                          </p>
                          {tx.sale && (
                            <p className="text-xs text-gray-400">
                              Venta #{tx.sale.saleNumber}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${
                            tx.type === 'REDEMPTION' || tx.type === 'CANCELLATION'
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {tx.type === 'REDEMPTION' || tx.type === 'CANCELLATION' ? '-' : '+'}
                          {formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Saldo: {formatCurrency(tx.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
