/**
 * CardBrands - Gestión de Marcas de Tarjeta
 * CRUD para administrar marcas como Visa, Mastercard, Naranja, etc.
 * Incluye configuración de cuotas y recargos por marca
 */

import { useState, useEffect } from 'react';
import {
  CreditCard,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  Power,
  X,
  AlertTriangle,
  CheckCircle,
  Settings,
  Percent,
} from 'lucide-react';
import api from '../services/api';

interface InstallmentRate {
  installment: number;
  rate: number;
}

interface CardBrand {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  maxInstallments: number;
  installmentRates: InstallmentRate[];
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  code: string;
  isActive: boolean;
}

const initialFormData: FormData = {
  name: '',
  code: '',
  isActive: true,
};

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];

export default function CardBrands() {
  const [brands, setBrands] = useState<CardBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<CardBrand | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<CardBrand | null>(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState<CardBrand | null>(null);
  const [installmentConfig, setInstallmentConfig] = useState<{
    maxInstallments: number;
    rates: { [key: number]: string };
  }>({ maxInstallments: 12, rates: {} });
  const [savingInstallments, setSavingInstallments] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const response = await api.get('/card-brands');
      setBrands(response.data);
    } catch (err) {
      console.error('Error loading brands:', err);
      setError('Error al cargar las marcas');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await api.post('/card-brands/initialize');
      loadBrands();
    } catch (err) {
      console.error('Error initializing brands:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setFormData(initialFormData);
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (brand: CardBrand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      code: brand.code,
      isActive: brand.isActive,
    });
    setError(null);
    setShowModal(true);
  };

  const handleOpenInstallments = (brand: CardBrand) => {
    const rates: { [key: number]: string } = {};
    (brand.installmentRates || []).forEach((r) => {
      rates[r.installment] = r.rate.toString();
    });
    setInstallmentConfig({
      maxInstallments: brand.maxInstallments || 12,
      rates,
    });
    setShowInstallmentsModal(brand);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Nombre y código son requeridos');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        ...formData,
        code: formData.code.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
      };

      if (editingBrand) {
        await api.put(`/card-brands/${editingBrand.id}`, data);
      } else {
        await api.post('/card-brands', data);
      }

      setShowModal(false);
      loadBrands();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Error al guardar la marca');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInstallments = async () => {
    if (!showInstallmentsModal) return;

    setSavingInstallments(true);

    try {
      const installmentRates: InstallmentRate[] = [];
      for (let i = 1; i <= installmentConfig.maxInstallments; i++) {
        const rate = parseFloat(installmentConfig.rates[i] || '0') || 0;
        installmentRates.push({ installment: i, rate });
      }

      await api.put(`/card-brands/${showInstallmentsModal.id}/installments`, {
        maxInstallments: installmentConfig.maxInstallments,
        installmentRates,
      });

      setShowInstallmentsModal(null);
      loadBrands();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al guardar configuración');
    } finally {
      setSavingInstallments(false);
    }
  };

  const handleToggleActive = async (brand: CardBrand) => {
    try {
      await api.patch(`/card-brands/${brand.id}/toggle`);
      loadBrands();
    } catch (err) {
      console.error('Error toggling brand:', err);
    }
  };

  const handleDelete = async (brand: CardBrand) => {
    try {
      await api.delete(`/card-brands/${brand.id}`);
      setShowDeleteConfirm(null);
      loadBrands();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al eliminar la marca');
      setShowDeleteConfirm(null);
    }
  };

  const filteredBrands = brands.filter(
    (brand) =>
      brand.name.toLowerCase().includes(search.toLowerCase()) ||
      brand.code.toLowerCase().includes(search.toLowerCase())
  );

  const systemBrands = filteredBrands.filter((b) => b.isSystem);
  const customBrands = filteredBrands.filter((b) => !b.isSystem);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marcas de Tarjeta</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurar marcas de tarjeta y recargos por cuotas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadBrands}
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
            Nueva Marca
          </button>
        </div>
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay marcas de tarjeta configuradas</p>
            <button
              onClick={handleInitialize}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Inicializar marcas de sistema
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {/* System Brands */}
            {systemBrands.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <Settings size={16} />
                  Marcas de Sistema
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {systemBrands.map((brand) => (
                    <BrandCard
                      key={brand.id}
                      brand={brand}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={() => {}}
                      onInstallments={handleOpenInstallments}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Custom Brands */}
            {customBrands.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <Plus size={16} />
                  Marcas Personalizadas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {customBrands.map((brand) => (
                    <BrandCard
                      key={brand.id}
                      brand={brand}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={(b) => setShowDeleteConfirm(b)}
                      onInstallments={handleOpenInstallments}
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
        Total: {brands.length} marcas ({systemBrands.length} de sistema, {customBrands.length} personalizadas)
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingBrand ? 'Editar Marca' : 'Nueva Marca'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Visa, Mastercard"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Ej: VISA, MC"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">Solo letras mayúsculas, números y guiones</p>
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Marca activa</span>
                </label>
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

      {/* Installments Configuration Modal */}
      {showInstallmentsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Percent size={20} className="text-blue-600" />
                Recargos por Cuotas - {showInstallmentsModal.name}
              </h3>
              <button
                onClick={() => setShowInstallmentsModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  Configure el recargo porcentual para cada cantidad de cuotas.
                  Las cuotas sin interés (promociones bancarias) ignoran estos recargos.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de Cuotas
                </label>
                <select
                  value={installmentConfig.maxInstallments}
                  onChange={(e) =>
                    setInstallmentConfig({
                      ...installmentConfig,
                      maxInstallments: parseInt(e.target.value),
                    })
                  }
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {INSTALLMENT_OPTIONS.map((num) => (
                    <option key={num} value={num}>
                      {num} cuotas
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Recargos por Cuota (%)
                </label>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Array.from({ length: installmentConfig.maxInstallments }, (_, i) => i + 1).map(
                    (num) => (
                      <div key={num} className="relative">
                        <label className="block text-xs text-gray-500 mb-1">{num} cuota{num > 1 ? 's' : ''}</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={installmentConfig.rates[num] || ''}
                            onChange={(e) =>
                              setInstallmentConfig({
                                ...installmentConfig,
                                rates: {
                                  ...installmentConfig.rates,
                                  [num]: e.target.value,
                                },
                              })
                            }
                            placeholder="0"
                            min="0"
                            max="200"
                            step="0.01"
                            className="w-full px-3 py-2 pr-7 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                            %
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-700">
                  <strong>Ejemplo:</strong> Si un producto cuesta $10.000 y el recargo para 6 cuotas es 15%,
                  el cliente pagará $11.500 en total (6 cuotas de $1.916,67).
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowInstallmentsModal(null)}
                disabled={savingInstallments}
                className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveInstallments}
                disabled={savingInstallments}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingInstallments ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Guardar Recargos
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
              <h3 className="text-lg font-semibold mb-2">Eliminar Marca</h3>
              <p className="text-gray-500 mb-6">
                ¿Está seguro de eliminar la marca "{showDeleteConfirm.name}"?
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

// Brand Card Component
function BrandCard({
  brand,
  onEdit,
  onToggle,
  onDelete,
  onInstallments,
}: {
  brand: CardBrand;
  onEdit: (brand: CardBrand) => void;
  onToggle: (brand: CardBrand) => void;
  onDelete: (brand: CardBrand) => void;
  onInstallments: (brand: CardBrand) => void;
}) {
  const hasRates = brand.installmentRates && brand.installmentRates.length > 0;

  return (
    <div
      className={`p-3 border rounded-lg ${
        brand.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded flex items-center justify-center ${
            brand.isActive ? 'bg-blue-100' : 'bg-gray-200'
          }`}
        >
          <CreditCard
            className={`w-4 h-4 ${brand.isActive ? 'text-blue-600' : 'text-gray-400'}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm truncate">{brand.name}</h4>
          <p className="text-xs text-gray-500">{brand.code}</p>
        </div>
      </div>

      {/* Installments info */}
      <div className="mb-2 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${hasRates ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {brand.maxInstallments || 12} cuotas {hasRates ? '(config.)' : ''}
        </span>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => onInstallments(brand)}
          className="flex-1 flex items-center justify-center p-1.5 text-blue-600 hover:bg-blue-50 rounded text-xs"
          title="Configurar Cuotas"
        >
          <Percent size={12} />
        </button>
        <button
          onClick={() => onEdit(brand)}
          className="flex-1 flex items-center justify-center p-1.5 text-gray-600 hover:bg-gray-100 rounded text-xs"
          title="Editar"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => onToggle(brand)}
          className={`flex-1 flex items-center justify-center p-1.5 rounded text-xs ${
            brand.isActive
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-green-600 hover:bg-green-50'
          }`}
          title={brand.isActive ? 'Desactivar' : 'Activar'}
        >
          <Power size={12} />
        </button>
        {!brand.isSystem && (
          <button
            onClick={() => onDelete(brand)}
            className="flex items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded text-xs"
            title="Eliminar"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
