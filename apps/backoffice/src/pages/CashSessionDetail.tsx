import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Calendar,
  Clock,
  User,
  MapPin,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PauseCircle,
} from 'lucide-react';
import { cashApi, CashSession, CashMovement, CashCount } from '../services/api';

interface SessionDetail extends CashSession {
  movements: CashMovement[];
  counts: CashCount[];
  closingDifference?: number | null;
  sales: Array<{
    id: string;
    saleNumber: string;
    saleDate: string;
    total: number;
    status: string;
  }>;
}

export default function CashSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'movements' | 'counts' | 'sales'>('summary');

  useEffect(() => {
    if (id) {
      loadSessionDetail();
    }
  }, [id]);

  const loadSessionDetail = async () => {
    setIsLoading(true);
    try {
      const response = await cashApi.getSessionReport(id!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionData = response.session as any;
      setSession({
        ...sessionData,
        sales: sessionData.sales?.map((s: { id: string; saleNumber: string; saleDate?: string; total: number; status: string }) => ({
          ...s,
          saleDate: s.saleDate || sessionData.openedAt,
        })) || [],
      } as SessionDetail);
    } catch (error) {
      console.error('Error loading session detail:', error);
    } finally {
      setIsLoading(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'CLOSED':
        return <XCircle className="w-5 h-5 text-gray-600" />;
      case 'SUSPENDED':
        return <PauseCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'Abierto';
      case 'CLOSED':
        return 'Cerrado';
      case 'SUSPENDED':
        return 'Suspendido';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      case 'SUSPENDED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getMovementTypeText = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'Ingreso';
      case 'WITHDRAWAL':
        return 'Retiro';
      case 'ADJUSTMENT':
        return 'Ajuste';
      default:
        return type;
    }
  };

  const getReasonText = (reason: string) => {
    const reasons: Record<string, string> = {
      CHANGE_FUND: 'Fondo para cambio',
      LOAN_RETURN: 'Devolucion de prestamo',
      SAFE_DEPOSIT: 'Deposito a caja fuerte',
      BANK_DEPOSIT: 'Deposito bancario',
      SUPPLIER_PAYMENT: 'Pago a proveedor',
      EXPENSE: 'Gasto menor',
      OTHER: 'Otro',
    };
    return reasons[reason] || reason;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/cash-sessions')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a sesiones
        </button>
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Sesion no encontrada</h2>
          <p className="text-gray-500 mt-2">
            La sesion de caja solicitada no existe o no tienes permisos para verla.
          </p>
        </div>
      </div>
    );
  }

  const expectedCash =
    Number(session.openingAmount) +
    Number(session.totalCash) +
    Number(session.depositsTotal) -
    Number(session.withdrawalsTotal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/cash-sessions')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Turno #{session.sessionNumber}
            </h1>
            <p className="text-gray-500">
              {session.pointOfSale?.name} - {session.user?.name}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
            session.status
          )}`}
        >
          {getStatusIcon(session.status)}
          {getStatusText(session.status)}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Calendar className="w-4 h-4" />
            Apertura
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatDate(session.openedAt)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Clock className="w-4 h-4" />
            Cierre
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {session.closedAt ? formatDate(session.closedAt) : 'En curso'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <MapPin className="w-4 h-4" />
            Punto de Venta
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {session.pointOfSale?.name}
          </div>
          <div className="text-sm text-gray-500">{session.pointOfSale?.code}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <User className="w-4 h-4" />
            Cajero
          </div>
          <div className="text-lg font-semibold text-gray-900">{session.user?.name}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            {(['summary', 'movements', 'counts', 'sales'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'summary' && 'Resumen'}
                {tab === 'movements' && `Movimientos (${session.movements?.length || 0})`}
                {tab === 'counts' && `Arqueos (${session.counts?.length || 0})`}
                {tab === 'sales' && `Ventas (${session.salesCount})`}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Resumen */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Totales por metodo de pago */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Totales por Metodo de Pago
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-green-600" />
                      <span>Efectivo</span>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(Number(session.totalCash))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="w-5 h-5 text-blue-600" />
                      <span>Debito</span>
                    </div>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(Number(session.totalDebit))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="w-5 h-5 text-purple-600" />
                      <span>Credito</span>
                    </div>
                    <span className="font-semibold text-purple-600">
                      {formatCurrency(Number(session.totalCredit))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-cyan-600" />
                      <span>QR</span>
                    </div>
                    <span className="font-semibold text-cyan-600">
                      {formatCurrency(Number(session.totalQr))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 font-medium">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <span>Total Ventas</span>
                    </div>
                    <span className="font-bold text-blue-600">
                      {formatCurrency(Number(session.salesTotal))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Movimientos de caja */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Balance de Caja
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>Fondo Inicial</span>
                    <span className="font-semibold">
                      {formatCurrency(Number(session.openingAmount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>+ Ventas en Efectivo</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(Number(session.totalCash))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>+ Ingresos</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(Number(session.depositsTotal))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>- Retiros</span>
                    <span className="font-semibold text-red-600">
                      -{formatCurrency(Number(session.withdrawalsTotal))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 font-medium">
                      <Banknote className="w-5 h-5 text-green-600" />
                      <span>Efectivo Esperado</span>
                    </div>
                    <span className="font-bold text-green-600">
                      {formatCurrency(expectedCash)}
                    </span>
                  </div>
                </div>

                {/* Diferencia de cierre */}
                {session.status === 'CLOSED' && session.closingDifference !== null && (
                  <div className="mt-4">
                    <div
                      className={`p-4 rounded-lg ${
                        Number(session.closingDifference) === 0
                          ? 'bg-green-50 border border-green-200'
                          : Number(session.closingDifference) > 0
                          ? 'bg-yellow-50 border border-yellow-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {Number(session.closingDifference) === 0 ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                          )}
                          <span className="font-medium">Diferencia al cierre:</span>
                        </div>
                        <span
                          className={`font-bold ${
                            Number(session.closingDifference) === 0
                              ? 'text-green-600'
                              : Number(session.closingDifference) > 0
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {Number(session.closingDifference) > 0 ? '+' : ''}
                          {formatCurrency(Number(session.closingDifference))}
                        </span>
                      </div>
                      {Number(session.closingDifference) !== 0 && (
                        <p className="text-sm mt-2">
                          {Number(session.closingDifference) > 0
                            ? 'Sobrante detectado'
                            : 'Faltante detectado'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Movimientos */}
          {activeTab === 'movements' && (
            <div>
              {session.movements?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay movimientos registrados en esta sesion
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Razon
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Descripcion
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {session.movements?.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(movement.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              movement.type === 'DEPOSIT'
                                ? 'bg-green-100 text-green-800'
                                : movement.type === 'WITHDRAWAL'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {movement.type === 'DEPOSIT' ? (
                              <ArrowDownCircle className="w-3 h-3" />
                            ) : (
                              <ArrowUpCircle className="w-3 h-3" />
                            )}
                            {getMovementTypeText(movement.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {getReasonText(movement.reason)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {movement.description || '-'}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-semibold text-right ${
                            movement.type === 'DEPOSIT'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {movement.type === 'DEPOSIT' ? '+' : '-'}
                          {formatCurrency(Number(movement.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Arqueos */}
          {activeTab === 'counts' && (
            <div>
              {session.counts?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay arqueos registrados en esta sesion
                </div>
              ) : (
                <div className="space-y-4">
                  {session.counts?.map((count) => (
                    <div
                      key={count.id}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Calculator className="w-5 h-5 text-blue-600" />
                          <div>
                            <span className="font-medium">
                              Arqueo {count.type === 'PARTIAL' ? 'Parcial' : 'de Cierre'}
                            </span>
                            <p className="text-sm text-gray-500">
                              {formatDate(count.countedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            Contado: {formatCurrency(Number(count.totalCounted))}
                          </div>
                          {count.difference !== null && (
                            <div
                              className={`text-sm ${
                                Number(count.difference) === 0
                                  ? 'text-green-600'
                                  : Number(count.difference) > 0
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              Diferencia:{' '}
                              {Number(count.difference) > 0 ? '+' : ''}
                              {formatCurrency(Number(count.difference))}
                            </div>
                          )}
                        </div>
                      </div>
                      {count.notes && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-gray-100 rounded">
                          <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                          <p className="text-sm text-gray-600">{count.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ventas */}
          {activeTab === 'sales' && (
            <div>
              {!session.sales || session.sales.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay ventas registradas en esta sesion
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Numero
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
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
                    {session.sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {sale.saleNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(sale.saleDate)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              sale.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : sale.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {sale.status === 'COMPLETED'
                              ? 'Completada'
                              : sale.status === 'CANCELLED'
                              ? 'Cancelada'
                              : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => navigate(`/sales/${sale.id}`)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
