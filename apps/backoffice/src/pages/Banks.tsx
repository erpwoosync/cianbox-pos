/**
 * Banks - Gestión de Bancos para Promociones
 * CRUD para administrar bancos emisores de tarjetas
 */

import { useState, useEffect } from 'react';
import {
  Building2,
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
} from 'lucide-react';
import api from '../services/api';

interface Bank {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    promotions: number;
    payments: number;
  };
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

export default function Banks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Bank | null>(null);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/banks');
      setBanks(response.data);
    } catch (err) {
      console.error('Error loading banks:', err);
      setError('Error al cargar los bancos');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await api.post('/banks/initialize');
      loadBanks();
    } catch (err) {
      console.error('Error initializing banks:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingBank(null);
    setFormData(initialFormData);
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      name: bank.name,
      code: bank.code,
      isActive: bank.isActive,
    });
    setError(null);
    setShowModal(true);
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

      if (editingBank) {
        await api.put(`/banks/${editingBank.id}`, data);
      } else {
        await api.post('/banks', data);
      }

      setShowModal(false);
      loadBanks();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Error al guardar el banco');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bank: Bank) => {
    try {
      await api.put(`/banks/${bank.id}`, { isActive: !bank.isActive });
      loadBanks();
    } catch (err) {
      console.error('Error toggling bank:', err);
    }
  };

  const handleDelete = async (bank: Bank) => {
    try {
      await api.delete(`/banks/${bank.id}`);
      setShowDeleteConfirm(null);
      loadBanks();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al eliminar el banco');
      setShowDeleteConfirm(null);
    }
  };

  const filteredBanks = banks.filter(
    (bank) =>
      bank.name.toLowerCase().includes(search.toLowerCase()) ||
      bank.code.toLowerCase().includes(search.toLowerCase())
  );

  const activeBanks = filteredBanks.filter((b) => b.isActive);
  const inactiveBanks = filteredBanks.filter((b) => !b.isActive);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bancos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Administrar bancos para promociones de tarjetas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadBanks}
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
            Nuevo Banco
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
              placeholder="Buscar banco..."
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
        ) : banks.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay bancos configurados</p>
            <button
              onClick={handleInitialize}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Inicializar bancos comunes
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {/* Active Banks */}
            {activeBanks.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  Bancos Activos ({activeBanks.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {activeBanks.map((bank) => (
                    <BankCard
                      key={bank.id}
                      bank={bank}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={(b) => setShowDeleteConfirm(b)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Banks */}
            {inactiveBanks.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <Settings size={16} />
                  Bancos Inactivos ({inactiveBanks.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {inactiveBanks.map((bank) => (
                    <BankCard
                      key={bank.id}
                      bank={bank}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={(b) => setShowDeleteConfirm(b)}
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
        Total: {banks.length} bancos ({activeBanks.length} activos, {inactiveBanks.length} inactivos)
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingBank ? 'Editar Banco' : 'Nuevo Banco'}
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
                  placeholder="Ej: Banco Galicia"
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
                  placeholder="Ej: GALICIA"
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
                  <span className="text-sm font-medium text-gray-700">Banco activo</span>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Eliminar Banco</h3>
              <p className="text-gray-500 mb-6">
                ¿Está seguro de eliminar el banco "{showDeleteConfirm.name}"?
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

// Bank Card Component
function BankCard({
  bank,
  onEdit,
  onToggle,
  onDelete,
}: {
  bank: Bank;
  onEdit: (bank: Bank) => void;
  onToggle: (bank: Bank) => void;
  onDelete: (bank: Bank) => void;
}) {
  return (
    <div
      className={`p-3 border rounded-lg ${
        bank.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded flex items-center justify-center ${
            bank.isActive ? 'bg-blue-100' : 'bg-gray-200'
          }`}
        >
          <Building2
            className={`w-4 h-4 ${bank.isActive ? 'text-blue-600' : 'text-gray-400'}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm truncate">{bank.name}</h4>
          <p className="text-xs text-gray-500">{bank.code}</p>
        </div>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => onEdit(bank)}
          className="flex-1 flex items-center justify-center p-1.5 text-gray-600 hover:bg-gray-100 rounded text-xs"
          title="Editar"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => onToggle(bank)}
          className={`flex-1 flex items-center justify-center p-1.5 rounded text-xs ${
            bank.isActive
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-green-600 hover:bg-green-50'
          }`}
          title={bank.isActive ? 'Desactivar' : 'Activar'}
        >
          <Power size={12} />
        </button>
        <button
          onClick={() => onDelete(bank)}
          className="flex items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded text-xs"
          title="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
