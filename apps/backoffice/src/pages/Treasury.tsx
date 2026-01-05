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
  Wallet,
  Plus,
  Building2,
  Truck,
  Receipt,
  ArrowRightLeft,
  MoreHorizontal,
  DollarSign,
  Printer,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  treasuryApi,
  TreasuryPending,
  TreasurySummary,
  TreasuryStatus,
  TreasuryBalance,
  TreasuryMovement,
  TreasuryMovementType,
  CreateTreasuryMovementDto,
} from '../services/api';
import TreasuryConfirmModal from '../components/TreasuryConfirmModal';

type TabType = 'pending' | 'movements';

const MOVEMENT_TYPES: { value: TreasuryMovementType; label: string; icon: React.ReactNode }[] = [
  { value: 'BANK_DEPOSIT', label: 'Deposito Bancario', icon: <Building2 className="w-5 h-5" /> },
  { value: 'SUPPLIER_PAYMENT', label: 'Pago a Proveedor', icon: <Truck className="w-5 h-5" /> },
  { value: 'EXPENSE', label: 'Gasto/Egreso', icon: <Receipt className="w-5 h-5" /> },
  { value: 'TRANSFER', label: 'Transferencia', icon: <ArrowRightLeft className="w-5 h-5" /> },
  { value: 'OTHER', label: 'Otro', icon: <MoreHorizontal className="w-5 h-5" /> },
];

export default function Treasury() {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Balance
  const [balance, setBalance] = useState<TreasuryBalance | null>(null);

  // Pending withdrawals
  const [pending, setPending] = useState<TreasuryPending[]>([]);
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TreasuryStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Movements
  const [movements, setMovements] = useState<TreasuryMovement[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movementTypeFilter, setMovementTypeFilter] = useState<TreasuryMovementType | ''>('');

  // Modal confirm/reject
  const [selectedPending, setSelectedPending] = useState<TreasuryPending | null>(null);
  const [modalMode, setModalMode] = useState<'confirm' | 'reject' | 'view'>('view');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal create movement
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTreasuryMovementDto>({
    type: 'BANK_DEPOSIT',
    amount: 0,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Paginacion
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPendingData();
    } else {
      loadMovementsData();
    }
  }, [page, statusFilter, movementTypeFilter, dateFrom, dateTo, activeTab]);

  const loadBalance = async () => {
    try {
      const balanceData = await treasuryApi.getBalance();
      setBalance(balanceData);
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const loadPendingData = async () => {
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

  const loadMovementsData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (movementTypeFilter) params.type = movementTypeFilter;

      const response = await treasuryApi.getMovements(params as Parameters<typeof treasuryApi.getMovements>[0]);
      setMovements(response.movements);
      setMovementsTotal(response.total);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = () => {
    loadBalance();
    if (activeTab === 'pending') {
      loadPendingData();
    } else {
      loadMovementsData();
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

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.amount || createForm.amount <= 0) {
      setCreateError('Ingrese un monto valido');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      await treasuryApi.createMovement(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ type: 'BANK_DEPOSIT', amount: 0 });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setCreateError(err.response?.data?.message || 'Error al crear el movimiento');
    } finally {
      setIsCreating(false);
    }
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

  const getMovementTypeLabel = (type: TreasuryMovementType) => {
    const found = MOVEMENT_TYPES.find((t) => t.value === type);
    return found?.label || type;
  };

  const getMovementTypeIcon = (type: TreasuryMovementType) => {
    const found = MOVEMENT_TYPES.find((t) => t.value === type);
    return found?.icon || <MoreHorizontal className="w-5 h-5" />;
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

  // Imprimir comprobante de retiro
  const printWithdrawal = (item: TreasuryPending) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Retiro</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 12px; color: #666; }
          .company { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
          .section { margin-bottom: 15px; }
          .label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 3px; }
          .value { font-size: 14px; font-weight: 500; }
          .amount-box { background: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border: 1px solid #ddd; }
          .amount { font-size: 28px; font-weight: bold; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-confirmed { background: #d1fae5; color: #065f46; }
          .status-partial { background: #fed7aa; color: #9a3412; }
          .status-rejected { background: #fee2e2; color: #991b1b; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; }
          .signature { text-align: center; width: 45%; }
          .signature-line { border-top: 1px solid #000; margin-bottom: 5px; }
          .signature-label { font-size: 11px; color: #666; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .print-date { font-size: 10px; color: #999; text-align: right; margin-bottom: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="print-date">Impreso: ${new Date().toLocaleString('es-AR')}</div>
        <div class="header">
          <div class="company">${tenant?.name || 'EMPRESA'}</div>
          <div class="title">COMPROBANTE DE RETIRO DE CAJA</div>
          <div class="subtitle">Tesoreria</div>
        </div>

        <div class="row">
          <div class="section">
            <div class="label">Fecha del Retiro</div>
            <div class="value">${formatDate(item.createdAt)}</div>
          </div>
          <div class="section" style="text-align: right;">
            <div class="label">Estado</div>
            <span class="status status-${item.status.toLowerCase()}">${getStatusText(item.status)}</span>
          </div>
        </div>

        <div class="section">
          <div class="label">Punto de Venta</div>
          <div class="value">${item.cashSession.pointOfSale.name}</div>
        </div>

        <div class="section">
          <div class="label">Cajero</div>
          <div class="value">${item.cashSession.user.name}</div>
        </div>

        <div class="section">
          <div class="label">Motivo</div>
          <div class="value">${item.cashMovement.reason}</div>
        </div>

        <div class="amount-box">
          <div class="label">Monto del Retiro</div>
          <div class="amount">${formatCurrency(item.amount)}</div>
        </div>

        ${item.confirmedAmount !== null && item.confirmedAmount !== undefined ? `
        <div class="row">
          <div class="section">
            <div class="label">Monto Recibido</div>
            <div class="value" style="color: ${item.confirmedAmount === item.amount ? '#065f46' : '#9a3412'};">
              ${formatCurrency(item.confirmedAmount)}
            </div>
          </div>
          ${item.confirmedAmount !== item.amount ? `
          <div class="section" style="text-align: right;">
            <div class="label">Diferencia</div>
            <div class="value" style="color: #991b1b;">${formatCurrency(item.confirmedAmount - item.amount)}</div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${item.differenceNotes ? `
        <div class="section">
          <div class="label">Observaciones</div>
          <div class="value">${item.differenceNotes}</div>
        </div>
        ` : ''}

        <div class="signatures">
          <div class="signature">
            <div class="signature-line"></div>
            <div class="signature-label">Entrega</div>
            <div style="font-size: 10px; margin-top: 3px;">${item.cashSession.user.name}</div>
          </div>
          <div class="signature">
            <div class="signature-line"></div>
            <div class="signature-label">Recibe (Tesoreria)</div>
            ${item.confirmedBy ? `<div style="font-size: 10px; margin-top: 3px;">${item.confirmedBy.name}</div>` : ''}
          </div>
        </div>

        <div class="footer">
          <div>Documento interno - Conservar como comprobante</div>
          <div style="margin-top: 5px;">ID: ${item.id.slice(-8).toUpperCase()}</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Imprimir comprobante de egreso
  const printMovement = (mov: TreasuryMovement) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let detailsHtml = '';
    if (mov.type === 'BANK_DEPOSIT' && mov.bankName) {
      detailsHtml = `
        <div class="row">
          <div class="section">
            <div class="label">Banco</div>
            <div class="value">${mov.bankName}</div>
          </div>
          ${mov.depositNumber ? `
          <div class="section" style="text-align: right;">
            <div class="label">Nro. Deposito</div>
            <div class="value">${mov.depositNumber}</div>
          </div>
          ` : ''}
        </div>
      `;
    } else if (mov.type === 'SUPPLIER_PAYMENT' && mov.supplierName) {
      detailsHtml = `
        <div class="row">
          <div class="section">
            <div class="label">Proveedor</div>
            <div class="value">${mov.supplierName}</div>
          </div>
          ${mov.invoiceNumber ? `
          <div class="section" style="text-align: right;">
            <div class="label">Nro. Factura</div>
            <div class="value">${mov.invoiceNumber}</div>
          </div>
          ` : ''}
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Egreso</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 12px; color: #666; }
          .company { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
          .section { margin-bottom: 15px; }
          .label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 3px; }
          .value { font-size: 14px; font-weight: 500; }
          .amount-box { background: #fef2f2; padding: 15px; text-align: center; margin: 20px 0; border: 1px solid #fecaca; }
          .amount { font-size: 28px; font-weight: bold; color: #dc2626; }
          .type-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #e0e7ff; color: #3730a3; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; }
          .signature { text-align: center; width: 45%; }
          .signature-line { border-top: 1px solid #000; margin-bottom: 5px; }
          .signature-label { font-size: 11px; color: #666; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .print-date { font-size: 10px; color: #999; text-align: right; margin-bottom: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="print-date">Impreso: ${new Date().toLocaleString('es-AR')}</div>
        <div class="header">
          <div class="company">${tenant?.name || 'EMPRESA'}</div>
          <div class="title">COMPROBANTE DE EGRESO</div>
          <div class="subtitle">Tesoreria</div>
        </div>

        <div class="row">
          <div class="section">
            <div class="label">Fecha</div>
            <div class="value">${formatDate(mov.createdAt)}</div>
          </div>
          <div class="section" style="text-align: right;">
            <div class="label">Tipo</div>
            <span class="type-badge">${getMovementTypeLabel(mov.type)}</span>
          </div>
        </div>

        ${mov.description ? `
        <div class="section">
          <div class="label">Descripcion</div>
          <div class="value">${mov.description}</div>
        </div>
        ` : ''}

        ${detailsHtml}

        ${mov.reference ? `
        <div class="section">
          <div class="label">Referencia</div>
          <div class="value">${mov.reference}</div>
        </div>
        ` : ''}

        <div class="amount-box">
          <div class="label">Monto del Egreso</div>
          <div class="amount">-${formatCurrency(mov.amount)}</div>
        </div>

        <div class="section">
          <div class="label">Registrado por</div>
          <div class="value">${mov.createdBy.name}</div>
        </div>

        <div class="signatures">
          <div class="signature">
            <div class="signature-line"></div>
            <div class="signature-label">Autoriza</div>
          </div>
          <div class="signature">
            <div class="signature-line"></div>
            <div class="signature-label">Recibe</div>
          </div>
        </div>

        <div class="footer">
          <div>Documento interno - Conservar como comprobante</div>
          <div style="margin-top: 5px;">ID: ${mov.id.slice(-8).toUpperCase()}</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const totalPages = Math.ceil((activeTab === 'pending' ? total : movementsTotal) / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tesoreria</h1>
          <p className="text-gray-500">Control de efectivo y movimientos de {tenant?.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Egreso
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Saldo de Tesoreria - Tarjeta Grande */}
      {balance && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-100 mb-1">
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-medium">Saldo Actual de Tesoreria</span>
              </div>
              <div className="text-4xl font-bold">
                {formatCurrency(balance.currentBalance)}
              </div>
              <div className="text-blue-200 text-sm mt-1">
                {balance.currency}
              </div>
            </div>
            <div className="text-right space-y-2">
              <div>
                <div className="text-blue-200 text-xs">Ingresos (Retiros Confirmados)</div>
                <div className="text-lg font-semibold flex items-center gap-1 justify-end">
                  <TrendingUp className="w-4 h-4" />
                  {formatCurrency(balance.totalIncomes)}
                </div>
              </div>
              <div>
                <div className="text-blue-200 text-xs">Egresos (Movimientos)</div>
                <div className="text-lg font-semibold flex items-center gap-1 justify-end">
                  <TrendingDown className="w-4 h-4" />
                  {formatCurrency(balance.totalExpenses)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => { setActiveTab('pending'); setPage(1); }}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Retiros Pendientes
            {summary && summary.pending.count > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                {summary.pending.count}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('movements'); setPage(1); }}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'movements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Movimientos / Egresos
          </button>
        </nav>
      </div>

      {/* Tab: Retiros Pendientes */}
      {activeTab === 'pending' && (
        <>
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

          {/* Tabla Retiros */}
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
                            <button
                              onClick={() => printWithdrawal(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Imprimir comprobante"
                            >
                              <Printer className="w-4 h-4" />
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
          </div>
        </>
      )}

      {/* Tab: Movimientos */}
      {activeTab === 'movements' && (
        <>
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={movementTypeFilter}
                    onChange={(e) => setMovementTypeFilter(e.target.value as TreasuryMovementType | '')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    {MOVEMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setMovementTypeFilter('');
                    setPage(1);
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Tabla Movimientos */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
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
                      Descripcion
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Referencia
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Creado por
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Cargando movimientos...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No se encontraron movimientos
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {formatDate(mov.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">
                              {getMovementTypeIcon(mov.type)}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {getMovementTypeLabel(mov.type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {mov.description || '-'}
                          </div>
                          {mov.type === 'BANK_DEPOSIT' && mov.bankName && (
                            <div className="text-xs text-gray-500">
                              {mov.bankName} {mov.depositNumber ? `#${mov.depositNumber}` : ''}
                            </div>
                          )}
                          {mov.type === 'SUPPLIER_PAYMENT' && mov.supplierName && (
                            <div className="text-xs text-gray-500">
                              {mov.supplierName} {mov.invoiceNumber ? `Fac: ${mov.invoiceNumber}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">
                            {mov.reference || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-medium text-red-600">
                            -{formatCurrency(mov.amount)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {mov.createdBy.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => printMovement(mov)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Imprimir comprobante"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Paginacion (compartida) */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Mostrando {(page - 1) * pageSize + 1} a{' '}
            {Math.min(page * pageSize, activeTab === 'pending' ? total : movementsTotal)} de{' '}
            {activeTab === 'pending' ? total : movementsTotal} registros
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        : 'hover:bg-gray-50'
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
              className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal Confirm/Reject */}
      {isModalOpen && selectedPending && (
        <TreasuryConfirmModal
          pending={selectedPending}
          mode={modalMode}
          onClose={handleCloseModal}
          onSuccess={handleConfirmSuccess}
        />
      )}

      {/* Modal Crear Movimiento */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Egreso de Tesoreria</h2>
              <p className="text-sm text-gray-500 mt-1">
                Registrar salida de dinero de la caja de tesoreria
              </p>
            </div>

            <form onSubmit={handleCreateMovement} className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Movimiento *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MOVEMENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, type: type.value })}
                      className={`flex items-center gap-2 p-3 border rounded-lg text-left ${
                        createForm.type === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {type.icon}
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.amount || ''}
                    onChange={(e) => setCreateForm({ ...createForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                {balance && (
                  <p className="text-xs text-gray-500 mt-1">
                    Saldo disponible: {formatCurrency(balance.currentBalance)}
                  </p>
                )}
              </div>

              {/* Descripcion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion
                </label>
                <input
                  type="text"
                  value={createForm.description || ''}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Descripcion del movimiento"
                />
              </div>

              {/* Campos adicionales segun tipo */}
              {createForm.type === 'BANK_DEPOSIT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Banco
                    </label>
                    <input
                      type="text"
                      value={createForm.bankName || ''}
                      onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Nombre del banco"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nro. Deposito
                    </label>
                    <input
                      type="text"
                      value={createForm.depositNumber || ''}
                      onChange={(e) => setCreateForm({ ...createForm, depositNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Numero de comprobante"
                    />
                  </div>
                </div>
              )}

              {createForm.type === 'SUPPLIER_PAYMENT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proveedor
                    </label>
                    <input
                      type="text"
                      value={createForm.supplierName || ''}
                      onChange={(e) => setCreateForm({ ...createForm, supplierName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nro. Factura
                    </label>
                    <input
                      type="text"
                      value={createForm.invoiceNumber || ''}
                      onChange={(e) => setCreateForm({ ...createForm, invoiceNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Numero de factura"
                    />
                  </div>
                </div>
              )}

              {/* Referencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia
                </label>
                <input
                  type="text"
                  value={createForm.reference || ''}
                  onChange={(e) => setCreateForm({ ...createForm, reference: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Referencia opcional"
                />
              </div>

              {/* Error */}
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {createError}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateForm({ type: 'BANK_DEPOSIT', amount: 0 });
                    setCreateError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !createForm.amount}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Guardando...' : 'Registrar Egreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
