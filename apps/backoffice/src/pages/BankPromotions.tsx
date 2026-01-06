/**
 * BankPromotions - Gestión de Promociones Bancarias
 * CRUD para administrar promociones de cuotas sin interés
 */

import { useState, useEffect } from 'react';
import {
  Percent,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  Power,
  X,
  AlertTriangle,
  CheckCircle,
  Building2,
  CreditCard,
  Calendar,
  Gift,
} from 'lucide-react';
import api from '../services/api';

interface Bank {
  id: string;
  name: string;
  code: string;
}

interface CardBrand {
  id: string;
  name: string;
  code: string;
}

interface BankPromotion {
  id: string;
  name: string;
  description: string | null;
  bankId: string;
  cardBrandId: string;
  bank: Bank;
  cardBrand: CardBrand;
  interestFreeInstallments: number[];
  cashbackPercent: number | null;
  cashbackDescription: string | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[];
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface FormData {
  name: string;
  description: string;
  bankId: string;
  cardBrandId: string;
  interestFreeInstallments: number[];
  cashbackPercent: string;
  cashbackDescription: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  isActive: boolean;
  priority: number;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  bankId: '',
  cardBrandId: '',
  interestFreeInstallments: [],
  cashbackPercent: '',
  cashbackDescription: '',
  startDate: '',
  endDate: '',
  daysOfWeek: [],
  isActive: true,
  priority: 0,
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Lun', fullLabel: 'Lunes' },
  { value: 2, label: 'Mar', fullLabel: 'Martes' },
  { value: 3, label: 'Mié', fullLabel: 'Miércoles' },
  { value: 4, label: 'Jue', fullLabel: 'Jueves' },
  { value: 5, label: 'Vie', fullLabel: 'Viernes' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];

export default function BankPromotions() {
  const [promotions, setPromotions] = useState<BankPromotion[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [cardBrands, setCardBrands] = useState<CardBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [filterCard, setFilterCard] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<BankPromotion | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<BankPromotion | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [promoRes, banksRes, brandsRes] = await Promise.all([
        api.get('/bank-promotions'),
        api.get('/banks?activeOnly=true'),
        api.get('/card-brands?activeOnly=true'),
      ]);
      setPromotions(promoRes.data);
      setBanks(banksRes.data);
      setCardBrands(brandsRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setFormData(initialFormData);
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (promo: BankPromotion) => {
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      description: promo.description || '',
      bankId: promo.bankId,
      cardBrandId: promo.cardBrandId,
      interestFreeInstallments: promo.interestFreeInstallments,
      cashbackPercent: promo.cashbackPercent?.toString() || '',
      cashbackDescription: promo.cashbackDescription || '',
      startDate: promo.startDate ? promo.startDate.split('T')[0] : '',
      endDate: promo.endDate ? promo.endDate.split('T')[0] : '',
      daysOfWeek: promo.daysOfWeek,
      isActive: promo.isActive,
      priority: promo.priority,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.bankId || !formData.cardBrandId) {
      setError('Nombre, banco y tarjeta son requeridos');
      return;
    }

    if (formData.interestFreeInstallments.length === 0) {
      setError('Seleccione al menos una cuota sin interés');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        bankId: formData.bankId,
        cardBrandId: formData.cardBrandId,
        interestFreeInstallments: formData.interestFreeInstallments,
        cashbackPercent: formData.cashbackPercent ? parseFloat(formData.cashbackPercent) : null,
        cashbackDescription: formData.cashbackDescription || null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        daysOfWeek: formData.daysOfWeek,
        isActive: formData.isActive,
        priority: formData.priority,
      };

      if (editingPromo) {
        await api.put(`/bank-promotions/${editingPromo.id}`, data);
      } else {
        await api.post('/bank-promotions', data);
      }

      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Error al guardar la promoción');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: BankPromotion) => {
    try {
      await api.patch(`/bank-promotions/${promo.id}/toggle`);
      loadData();
    } catch (err) {
      console.error('Error toggling promotion:', err);
    }
  };

  const handleDelete = async (promo: BankPromotion) => {
    try {
      await api.delete(`/bank-promotions/${promo.id}`);
      setShowDeleteConfirm(null);
      loadData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al eliminar la promoción');
      setShowDeleteConfirm(null);
    }
  };

  const toggleInstallment = (installment: number) => {
    setFormData((prev) => ({
      ...prev,
      interestFreeInstallments: prev.interestFreeInstallments.includes(installment)
        ? prev.interestFreeInstallments.filter((i) => i !== installment)
        : [...prev.interestFreeInstallments, installment].sort((a, b) => a - b),
    }));
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b),
    }));
  };

  const filteredPromotions = promotions.filter((promo) => {
    const matchesSearch =
      promo.name.toLowerCase().includes(search.toLowerCase()) ||
      promo.bank.name.toLowerCase().includes(search.toLowerCase()) ||
      promo.cardBrand.name.toLowerCase().includes(search.toLowerCase());
    const matchesBank = !filterBank || promo.bankId === filterBank;
    const matchesCard = !filterCard || promo.cardBrandId === filterCard;
    return matchesSearch && matchesBank && matchesCard;
  });

  const activePromos = filteredPromotions.filter((p) => p.isActive);
  const inactivePromos = filteredPromotions.filter((p) => !p.isActive);

  const formatInstallments = (installments: number[]) => {
    if (installments.length === 0) return '-';
    if (installments.length <= 4) return installments.join(', ');
    return `${installments.slice(0, 3).join(', ')}... (${installments.length})`;
  };

  const formatDays = (days: number[]) => {
    if (days.length === 0) return 'Todos los días';
    if (days.length === 7) return 'Todos los días';
    return days.map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label).join(', ');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promociones Bancarias</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurar cuotas sin interés y promociones por banco/tarjeta
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            Nueva Promoción
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar promoción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <select
              value={filterBank}
              onChange={(e) => setFilterBank(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los bancos</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
            <select
              value={filterCard}
              onChange={(e) => setFilterCard(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las tarjetas</option>
              {cardBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-12">
            <Percent className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay promociones configuradas</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Crear primera promoción
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {/* Active Promotions */}
            {activePromos.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  Promociones Activas ({activePromos.length})
                </h3>
                <div className="space-y-3">
                  {activePromos.map((promo) => (
                    <PromoCard
                      key={promo.id}
                      promo={promo}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={(p) => setShowDeleteConfirm(p)}
                      formatInstallments={formatInstallments}
                      formatDays={formatDays}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Promotions */}
            {inactivePromos.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <Power size={16} className="text-gray-400" />
                  Promociones Inactivas ({inactivePromos.length})
                </h3>
                <div className="space-y-3">
                  {inactivePromos.map((promo) => (
                    <PromoCard
                      key={promo.id}
                      promo={promo}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={(p) => setShowDeleteConfirm(p)}
                      formatInstallments={formatInstallments}
                      formatDays={formatDays}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Total */}
      <div className="text-sm text-gray-500">
        Total: {promotions.length} promociones ({activePromos.length} activas)
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Nombre y Descripción */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: 6 cuotas sin interés Galicia Visa"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción opcional"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Banco y Tarjeta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building2 className="inline w-4 h-4 mr-1" />
                    Banco *
                  </label>
                  <select
                    value={formData.bankId}
                    onChange={(e) => setFormData({ ...formData, bankId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar banco</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CreditCard className="inline w-4 h-4 mr-1" />
                    Tarjeta *
                  </label>
                  <select
                    value={formData.cardBrandId}
                    onChange={(e) => setFormData({ ...formData, cardBrandId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar tarjeta</option>
                    {cardBrands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cuotas sin interés */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Percent className="inline w-4 h-4 mr-1" />
                  Cuotas Sin Interés *
                </label>
                <div className="flex flex-wrap gap-2">
                  {INSTALLMENT_OPTIONS.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => toggleInstallment(num)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.interestFreeInstallments.includes(num)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Seleccionadas: {formData.interestFreeInstallments.length > 0
                    ? formData.interestFreeInstallments.join(', ')
                    : 'Ninguna'}
                </p>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Días de la semana */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de la Semana
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.daysOfWeek.includes(day.value)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Vacío = todos los días. Seleccione días específicos si aplica solo algunos días.
                </p>
              </div>

              {/* Cashback */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
                  <Gift size={18} />
                  Reintegro (Informativo)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Porcentaje Reintegro
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.cashbackPercent}
                        onChange={(e) =>
                          setFormData({ ...formData, cashbackPercent: e.target.value })
                        }
                        placeholder="Ej: 15"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                        %
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={formData.cashbackDescription}
                      onChange={(e) =>
                        setFormData({ ...formData, cashbackDescription: e.target.value })
                      }
                      placeholder="Ej: 15% reintegro en resumen"
                      className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  Este reintegro es solo informativo. El banco lo acredita en el resumen.
                </p>
              </div>

              {/* Prioridad y Estado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridad
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mayor número = mayor prioridad al mostrar
                  </p>
                </div>
                <div className="flex items-end pb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Promoción activa</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Eliminar Promoción</h3>
              <p className="text-gray-500 mb-6">
                ¿Está seguro de eliminar "{showDeleteConfirm.name}"?
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Promo Card Component
function PromoCard({
  promo,
  onEdit,
  onToggle,
  onDelete,
  formatInstallments,
  formatDays,
}: {
  promo: BankPromotion;
  onEdit: (promo: BankPromotion) => void;
  onToggle: (promo: BankPromotion) => void;
  onDelete: (promo: BankPromotion) => void;
  formatInstallments: (installments: number[]) => string;
  formatDays: (days: number[]) => string;
}) {
  return (
    <div
      className={`p-4 border rounded-lg ${
        promo.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 truncate">{promo.name}</h4>
            {promo.cashbackPercent && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                {promo.cashbackPercent}% reintegro
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Building2 size={14} />
              {promo.bank.name}
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1">
              <CreditCard size={14} />
              {promo.cardBrand.name}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
              Cuotas: {formatInstallments(promo.interestFreeInstallments)}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {formatDays(promo.daysOfWeek)}
            </span>
            {promo.startDate && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                Desde: {new Date(promo.startDate).toLocaleDateString()}
              </span>
            )}
            {promo.endDate && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                Hasta: {new Date(promo.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(promo)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded"
            title="Editar"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onToggle(promo)}
            className={`p-2 rounded ${
              promo.isActive
                ? 'text-orange-600 hover:bg-orange-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
            title={promo.isActive ? 'Desactivar' : 'Activar'}
          >
            <Power size={16} />
          </button>
          <button
            onClick={() => onDelete(promo)}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
