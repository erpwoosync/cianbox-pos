/**
 * VoucherSettlements - Liquidación de Cupones de Tarjeta
 * Gestión y liquidación de cupones de terminales y Mercado Pago Point
 */

import { useState, useEffect } from 'react';
import {
  Receipt,
  RefreshCw,
  Filter,
  X,
  AlertTriangle,
  Calendar,
  Building2,
  Check,
  CheckCircle,
  Trash2,
  Eye,
  DollarSign,
} from 'lucide-react';
import api from '../services/api';

interface CardVoucher {
  id: string;
  source: 'CARD_TERMINAL' | 'MERCADO_PAGO';
  saleDate: string;
  amount: number;
  status: 'PENDING' | 'SETTLED';
  voucherNumber: string | null;
  batchNumber: string | null;
  authorizationCode: string | null;
  installments: number;
  cardLastFour: string | null;
  mpPaymentId: string | null;
  cardTerminal: { id: string; name: string; code: string } | null;
  cardBrand: { id: string; name: string; code: string } | null;
  payment: {
    id: string;
    method: string;
    sale: { id: string; saleNumber: string; saleDate: string };
  };
  settlement?: { id: string; settlementDate: string };
}

interface CardTerminal {
  id: string;
  name: string;
  code: string;
}

interface CardBrand {
  id: string;
  name: string;
  code: string;
}

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  isActive: boolean;
}

interface VoucherSettlement {
  id: string;
  settlementDate: string;
  grossAmount: number;
  commissionAmount: number;
  withholdingAmount: number;
  netAmount: number;
  notes: string | null;
  bankAccount: { id: string; name: string; bankName: string };
  _count: { vouchers: number };
}

export default function VoucherSettlements() {
  // State
  const [tab, setTab] = useState<'vouchers' | 'settlements'>('vouchers');
  const [vouchers, setVouchers] = useState<CardVoucher[]>([]);
  const [settlements, setSettlements] = useState<VoucherSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());

  // Filters
  const [filters, setFilters] = useState({
    status: 'PENDING' as 'PENDING' | 'SETTLED' | '',
    source: '' as '' | 'CARD_TERMINAL' | 'MERCADO_PAGO',
    cardTerminalId: '',
    cardBrandId: '',
    dateFrom: '',
    dateTo: '',
  });

  // Modal state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    settlementDate: new Date().toISOString().split('T')[0],
    bankAccountId: '',
    grossAmount: 0,
    commissionAmount: 0,
    withholdingAmount: 0,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [terminals, setTerminals] = useState<CardTerminal[]>([]);
  const [brands, setBrands] = useState<CardBrand[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Summary
  const [summary, setSummary] = useState({ pendingCount: 0, pendingAmount: 0 });

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<VoucherSettlement | null>(null);
  const [settlementDetail, setSettlementDetail] = useState<(VoucherSettlement & { vouchers: CardVoucher[] }) | null>(null);

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (tab === 'vouchers') {
      loadVouchers();
    } else {
      loadSettlements();
    }
  }, [tab, filters]);

  const loadReferenceData = async () => {
    try {
      const [terminalsRes, brandsRes, accountsRes] = await Promise.all([
        api.get('/card-terminals?activeOnly=true'),
        api.get('/card-brands?activeOnly=true'),
        api.get('/bank-accounts?activeOnly=true'),
      ]);
      setTerminals(terminalsRes.data);
      setBrands(brandsRes.data);
      setBankAccounts(accountsRes.data);
    } catch (err) {
      console.error('Error loading reference data:', err);
    }
  };

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.source) params.append('source', filters.source);
      if (filters.cardTerminalId) params.append('cardTerminalId', filters.cardTerminalId);
      if (filters.cardBrandId) params.append('cardBrandId', filters.cardBrandId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      params.append('limit', '200');

      const response = await api.get(`/voucher-settlements/vouchers?${params}`);
      setVouchers(response.data.vouchers);
      setSummary(response.data.summary);
    } catch (err) {
      console.error('Error loading vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSettlements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/voucher-settlements?limit=50');
      setSettlements(response.data.settlements);
    } catch (err) {
      console.error('Error loading settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVoucher = (id: string) => {
    const newSelected = new Set(selectedVouchers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVouchers(newSelected);
  };

  const handleSelectAll = () => {
    const pendingVouchers = vouchers.filter((v) => v.status === 'PENDING');
    if (selectedVouchers.size === pendingVouchers.length) {
      setSelectedVouchers(new Set());
    } else {
      setSelectedVouchers(new Set(pendingVouchers.map((v) => v.id)));
    }
  };

  const calculateSelectedTotal = () => {
    return vouchers
      .filter((v) => selectedVouchers.has(v.id))
      .reduce((sum, v) => sum + Number(v.amount), 0);
  };

  const handleOpenSettlementModal = () => {
    if (selectedVouchers.size === 0) {
      alert('Seleccione al menos un cupón para liquidar');
      return;
    }

    const total = calculateSelectedTotal();
    setSettlementForm({
      settlementDate: new Date().toISOString().split('T')[0],
      bankAccountId: bankAccounts[0]?.id || '',
      grossAmount: total,
      commissionAmount: 0,
      withholdingAmount: 0,
      notes: '',
    });
    setError(null);
    setShowSettlementModal(true);
  };

  const handleCreateSettlement = async () => {
    if (!settlementForm.bankAccountId) {
      setError('Debe seleccionar una cuenta bancaria');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.post('/voucher-settlements', {
        voucherIds: Array.from(selectedVouchers),
        settlementDate: settlementForm.settlementDate,
        bankAccountId: settlementForm.bankAccountId,
        grossAmount: settlementForm.grossAmount,
        commissionAmount: settlementForm.commissionAmount,
        withholdingAmount: settlementForm.withholdingAmount,
        notes: settlementForm.notes || undefined,
      });

      setShowSettlementModal(false);
      setSelectedVouchers(new Set());
      loadVouchers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Error al crear la liquidación');
    } finally {
      setSaving(false);
    }
  };

  const handleViewSettlement = async (settlement: VoucherSettlement) => {
    try {
      const response = await api.get(`/voucher-settlements/${settlement.id}`);
      setSettlementDetail(response.data);
      setShowDetailModal(settlement);
    } catch (err) {
      console.error('Error loading settlement detail:', err);
    }
  };

  const handleDeleteSettlement = async (settlement: VoucherSettlement) => {
    if (!confirm(`¿Está seguro de eliminar esta liquidación? Los cupones volverán a estado pendiente.`)) {
      return;
    }

    try {
      await api.delete(`/voucher-settlements/${settlement.id}`);
      loadSettlements();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al eliminar la liquidación');
    }
  };

  const netAmount = settlementForm.grossAmount - settlementForm.commissionAmount - settlementForm.withholdingAmount;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidación de Cupones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionar cupones de tarjeta y liquidaciones
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (tab === 'vouchers' ? loadVouchers() : loadSettlements())}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          {tab === 'vouchers' && selectedVouchers.size > 0 && (
            <button
              onClick={handleOpenSettlementModal}
              className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <CheckCircle size={18} />
              Liquidar ({selectedVouchers.size})
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('vouchers')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tab === 'vouchers'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          <Receipt className="inline-block mr-2" size={18} />
          Cupones
        </button>
        <button
          onClick={() => setTab('settlements')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tab === 'settlements'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          <DollarSign className="inline-block mr-2" size={18} />
          Liquidaciones
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm">
        {tab === 'vouchers' ? (
          <>
            {/* Filters */}
            <div className="p-4 border-b">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Filtros:</span>
                </div>

                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as typeof filters.status })}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PENDING">Pendientes</option>
                  <option value="SETTLED">Liquidados</option>
                  <option value="">Todos</option>
                </select>

                <select
                  value={filters.source}
                  onChange={(e) => setFilters({ ...filters, source: e.target.value as typeof filters.source })}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todo origen</option>
                  <option value="CARD_TERMINAL">Terminal</option>
                  <option value="MERCADO_PAGO">MP Point</option>
                </select>

                <select
                  value={filters.cardTerminalId}
                  onChange={(e) => setFilters({ ...filters, cardTerminalId: e.target.value })}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los terminales</option>
                  {terminals.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <select
                  value={filters.cardBrandId}
                  onChange={(e) => setFilters({ ...filters, cardBrandId: e.target.value })}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las marcas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Desde"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Hasta"
                />
              </div>
            </div>

            {/* Summary */}
            {filters.status === 'PENDING' && (
              <div className="p-4 bg-yellow-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="text-yellow-600" size={20} />
                  <span className="font-medium">
                    {summary.pendingCount} cupones pendientes de liquidar
                  </span>
                </div>
                <span className="font-bold text-lg">
                  ${Number(summary.pendingAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Vouchers Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay cupones para mostrar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        {filters.status === 'PENDING' && (
                          <input
                            type="checkbox"
                            checked={selectedVouchers.size > 0 && selectedVouchers.size === vouchers.filter((v) => v.status === 'PENDING').length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                        )}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venta</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origen</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cupón</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vouchers.map((voucher) => (
                      <tr key={voucher.id} className={`hover:bg-gray-50 ${selectedVouchers.has(voucher.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          {voucher.status === 'PENDING' && (
                            <input
                              type="checkbox"
                              checked={selectedVouchers.has(voucher.id)}
                              onChange={() => handleSelectVoucher(voucher.id)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(voucher.saleDate).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {voucher.payment.sale.saleNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            voucher.source === 'MERCADO_PAGO'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {voucher.source === 'MERCADO_PAGO' ? 'MP Point' : voucher.cardTerminal?.name || 'Terminal'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {voucher.cardBrand?.name || '-'}
                          {voucher.cardLastFour && <span className="text-gray-400 ml-1">****{voucher.cardLastFour}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {voucher.voucherNumber || voucher.authorizationCode || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          ${Number(voucher.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            voucher.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {voucher.status === 'PENDING' ? 'Pendiente' : 'Liquidado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selected summary */}
            {selectedVouchers.size > 0 && (
              <div className="p-4 bg-blue-50 border-t flex items-center justify-between">
                <span className="text-blue-700">
                  {selectedVouchers.size} cupón(es) seleccionado(s)
                </span>
                <span className="font-bold text-lg text-blue-700">
                  ${calculateSelectedTotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </>
        ) : (
          /* Settlements List */
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay liquidaciones registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cupones</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bruto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Comisión</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Retención</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Neto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {settlements.map((settlement) => (
                      <tr key={settlement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(settlement.settlementDate).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-gray-400" />
                            <div>
                              <p className="text-sm font-medium">{settlement.bankAccount.name}</p>
                              <p className="text-xs text-gray-500">{settlement.bankAccount.bankName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {settlement._count.vouchers}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          ${Number(settlement.grossAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-red-600">
                          -${Number(settlement.commissionAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-red-600">
                          -${Number(settlement.withholdingAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                          ${Number(settlement.netAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleViewSettlement(settlement)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                              title="Ver detalle"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteSettlement(settlement)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Settlement Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Liquidar Cupones</h3>
              <button
                onClick={() => setShowSettlementModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>{selectedVouchers.size}</strong> cupones seleccionados
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline-block mr-1" size={14} />
                    Fecha de depósito *
                  </label>
                  <input
                    type="date"
                    value={settlementForm.settlementDate}
                    onChange={(e) => setSettlementForm({ ...settlementForm, settlementDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building2 className="inline-block mr-1" size={14} />
                    Cuenta Bancaria *
                  </label>
                  <select
                    value={settlementForm.bankAccountId}
                    onChange={(e) => setSettlementForm({ ...settlementForm, bankAccountId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} - {acc.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Bruto
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settlementForm.grossAmount}
                    onChange={(e) => setSettlementForm({ ...settlementForm, grossAmount: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comisión
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settlementForm.commissionAmount}
                    onChange={(e) => setSettlementForm({ ...settlementForm, commissionAmount: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retenciones
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settlementForm.withholdingAmount}
                    onChange={(e) => setSettlementForm({ ...settlementForm, withholdingAmount: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Neto
                  </label>
                  <div className={`px-4 py-2 rounded-lg font-bold text-lg ${netAmount >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    ${netAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={settlementForm.notes}
                    onChange={(e) => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Notas opcionales..."
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowSettlementModal(false)}
                disabled={saving}
                className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSettlement}
                disabled={saving || netAmount < 0}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Liquidar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Detail Modal */}
      {showDetailModal && settlementDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Detalle de Liquidación
              </h3>
              <button
                onClick={() => setShowDetailModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Fecha</p>
                  <p className="font-medium">{new Date(settlementDetail.settlementDate).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Cuenta</p>
                  <p className="font-medium">{settlementDetail.bankAccount.name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Cupones</p>
                  <p className="font-medium">{settlementDetail.vouchers.length}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">Neto recibido</p>
                  <p className="font-bold text-green-700">
                    ${Number(settlementDetail.netAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Vouchers */}
              <h4 className="font-medium mb-3">Cupones liquidados</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Venta</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origen</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {settlementDetail.vouchers.map((voucher) => (
                      <tr key={voucher.id}>
                        <td className="px-3 py-2">{new Date(voucher.saleDate).toLocaleDateString('es-AR')}</td>
                        <td className="px-3 py-2 font-mono">{voucher.payment.sale.saleNumber}</td>
                        <td className="px-3 py-2">
                          {voucher.source === 'MERCADO_PAGO' ? 'MP Point' : voucher.cardTerminal?.name || 'Terminal'}
                        </td>
                        <td className="px-3 py-2">{voucher.cardBrand?.name || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          ${Number(voucher.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {settlementDetail.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Notas</p>
                  <p className="text-sm">{settlementDetail.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
