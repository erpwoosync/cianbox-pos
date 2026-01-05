/**
 * StoreCredits - Pagina de gestion de vales de credito
 */

import { useState, useEffect } from 'react';
import {
  Filter,
  RefreshCw,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Ban,
  Search,
  User,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  storeCreditsApi,
  StoreCredit,
  StoreCreditStatus,
  StoreCreditTransaction,
} from '../services/api';

export default function StoreCredits() {
  const { tenant: _tenant } = useAuth();
  const [storeCredits, setStoreCredits] = useState<StoreCredit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StoreCreditStatus | ''>('');
  const [searchCode, setSearchCode] = useState('');

  // Modales
  const [selectedStoreCredit, setSelectedStoreCredit] = useState<StoreCredit | null>(null);
  const [transactions, setTransactions] = useState<StoreCreditTransaction[]>([]);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isBalanceChecking, setIsBalanceChecking] = useState(false);
  const [balanceResult, setBalanceResult] = useState<(StoreCredit & { isValid: boolean; message?: string }) | null>(null);

  // Paginacion
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadStoreCredits();
  }, [page, statusFilter]);

  const loadStoreCredits = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (statusFilter) params.status = statusFilter;

      const response = await storeCreditsApi.getAll(params as Parameters<typeof storeCreditsApi.getAll>[0]);
      setStoreCredits(response.storeCredits);
      setTotal(response.total);
    } catch (error) {
      console.error('Error loading store credits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTransactions = async (storeCredit: StoreCredit) => {
    try {
      const response = await storeCreditsApi.getTransactions(storeCredit.id);
      setSelectedStoreCredit(response.storeCredit);
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
      const result = await storeCreditsApi.checkBalance(searchCode);
      setBalanceResult(result);
    } catch (error) {
      console.error('Error checking balance:', error);
      alert('Vale no encontrado o codigo invalido');
    } finally {
      setIsBalanceChecking(false);
    }
  };

  const handleCancelStoreCredit = async (code: string) => {
    const reason = prompt('Ingrese el motivo de la cancelacion:');
    if (!reason) return;

    try {
      await storeCreditsApi.cancel(code, reason);
      loadStoreCredits();
      alert('Vale cancelado correctamente');
    } catch (error) {
      console.error('Error canceling store credit:', error);
      alert('Error al cancelar el vale');
    }
  };

  const getStatusIcon = (status: StoreCreditStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'USED':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      case 'EXPIRED':
        return <XCircle className="w-4 h-4 text-orange-600" />;
      case 'CANCELLED':
        return <Ban className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: StoreCreditStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'USED':
        return 'Usado';
      case 'EXPIRED':
        return 'Vencido';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: StoreCreditStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'USED':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-orange-100 text-orange-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeText = (type: string) => {
    switch (type) {
      case 'ISSUED':
        return 'Emision';
      case 'REDEEMED':
        return 'Canje';
      case 'EXPIRED':
        return 'Vencimiento';
      case 'CANCELLED':
        return 'Cancelacion';
      case 'ADJUSTED':
        return 'Ajuste';
      default:
        return type;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vales de Credito</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestiona los vales generados por devoluciones
          </p>
        </div>
        <button
          onClick={loadStoreCredits}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Consulta rapida de saldo */}
      <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
          <Search className="w-5 h-5" />
          Consultar Saldo de Vale
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleCheckBalance()}
            placeholder="Ingrese codigo del vale (VAL-XXX-XXXX-XXXX)"
            className="flex-1 px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono uppercase"
          />
          <button
            onClick={handleCheckBalance}
            disabled={!searchCode || isBalanceChecking}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isBalanceChecking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Consultar
          </button>
        </div>

        {/* Resultado de consulta */}
        {balanceResult && (
          <div className={`mt-4 p-4 rounded-lg ${balanceResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-lg">{balanceResult.code}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span>Saldo: <strong className="text-lg">${balanceResult.currentBalance?.toFixed(2)}</strong></span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(balanceResult.status)}`}>
                    {getStatusText(balanceResult.status)}
                  </span>
                </div>
                {balanceResult.customer && (
                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {balanceResult.customer.name}
                  </p>
                )}
                {balanceResult.expiresAt && (
                  <p className="text-sm text-gray-500 mt-1">
                    Vence: {new Date(balanceResult.expiresAt).toLocaleDateString('es-AR')}
                  </p>
                )}
                {balanceResult.message && (
                  <p className="text-sm text-red-600 mt-2">{balanceResult.message}</p>
                )}
              </div>
              <button
                onClick={() => setBalanceResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StoreCreditStatus | '');
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="USED">Usados</option>
            <option value="EXPIRED">Vencidos</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
        </div>

        <div className="text-sm text-gray-500">
          {total} vale{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Codigo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sucursal</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Monto Original</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Saldo</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vencimiento</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Creacion</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Cargando...
                </td>
              </tr>
            ) : storeCredits.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron vales
                </td>
              </tr>
            ) : (
              storeCredits.map((sc) => (
                <tr key={sc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-orange-500" />
                      <span className="font-mono font-medium">{sc.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {sc.customer ? (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="w-4 h-4 text-gray-400" />
                        {sc.customer.name}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sc.branch ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Store className="w-4 h-4 text-gray-400" />
                        {sc.branch.name}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${sc.originalAmount?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${sc.currentBalance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      ${sc.currentBalance?.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sc.status)}`}>
                      {getStatusIcon(sc.status)}
                      {getStatusText(sc.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {sc.expiresAt ? new Date(sc.expiresAt).toLocaleDateString('es-AR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(sc.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewTransactions(sc)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Ver movimientos"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {sc.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleCancelStoreCredit(sc.code)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Cancelar vale"
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
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm">
              Pagina {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal de transacciones */}
      {isTransactionsModalOpen && selectedStoreCredit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-orange-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Movimientos del Vale</h3>
                  <p className="font-mono text-orange-700">{selectedStoreCredit.code}</p>
                </div>
                <button
                  onClick={() => setIsTransactionsModalOpen(false)}
                  className="p-2 hover:bg-orange-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-500">Monto Original</p>
                  <p className="font-bold text-lg">${selectedStoreCredit.originalAmount?.toFixed(2)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-500">Saldo Actual</p>
                  <p className="font-bold text-lg text-green-600">${selectedStoreCredit.currentBalance?.toFixed(2)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-500">Estado</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedStoreCredit.status)}`}>
                    {getStatusIcon(selectedStoreCredit.status)}
                    {getStatusText(selectedStoreCredit.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay movimientos registrados</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            tx.type === 'ISSUED' ? 'bg-blue-100 text-blue-800' :
                            tx.type === 'REDEEMED' ? 'bg-green-100 text-green-800' :
                            tx.type === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getTransactionTypeText(tx.type)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(tx.createdAt).toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount?.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Saldo: ${tx.balanceAfter?.toFixed(2)}</p>
                        </div>
                      </div>
                      {tx.notes && (
                        <p className="text-sm text-gray-600 mt-2">{tx.notes}</p>
                      )}
                      {tx.user && (
                        <p className="text-xs text-gray-400 mt-1">Por: {tx.user.name}</p>
                      )}
                      {tx.sale && (
                        <p className="text-xs text-gray-400">Venta: #{tx.sale.saleNumber}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setIsTransactionsModalOpen(false)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
