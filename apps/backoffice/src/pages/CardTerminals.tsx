/**
 * CardTerminals - Gestión de Terminales de Tarjetas no integrados
 * CRUD para administrar terminales como Posnet, Lapos, Payway, etc.
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
} from 'lucide-react';
import api from '../services/api';

interface CardTerminal {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  requiresAuthCode: boolean;
  requiresVoucherNumber: boolean;
  requiresCardBrand: boolean;
  requiresLastFour: boolean;
  requiresInstallments: boolean;
  requiresBatchNumber: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  code: string;
  isActive: boolean;
  requiresAuthCode: boolean;
  requiresVoucherNumber: boolean;
  requiresCardBrand: boolean;
  requiresLastFour: boolean;
  requiresInstallments: boolean;
  requiresBatchNumber: boolean;
}

const initialFormData: FormData = {
  name: '',
  code: '',
  isActive: true,
  requiresAuthCode: true,
  requiresVoucherNumber: true,
  requiresCardBrand: false,
  requiresLastFour: false,
  requiresInstallments: true,
  requiresBatchNumber: true,
};

export default function CardTerminals() {
  const [terminals, setTerminals] = useState<CardTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<CardTerminal | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<CardTerminal | null>(null);

  useEffect(() => {
    loadTerminals();
  }, []);

  const loadTerminals = async () => {
    setLoading(true);
    try {
      const response = await api.get('/card-terminals');
      setTerminals(response.data);
    } catch (err) {
      console.error('Error loading terminals:', err);
      setError('Error al cargar los terminales');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await api.post('/card-terminals/initialize');
      loadTerminals();
    } catch (err) {
      console.error('Error initializing terminals:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingTerminal(null);
    setFormData(initialFormData);
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (terminal: CardTerminal) => {
    setEditingTerminal(terminal);
    setFormData({
      name: terminal.name,
      code: terminal.code,
      isActive: terminal.isActive,
      requiresAuthCode: terminal.requiresAuthCode,
      requiresVoucherNumber: terminal.requiresVoucherNumber,
      requiresCardBrand: terminal.requiresCardBrand,
      requiresLastFour: terminal.requiresLastFour,
      requiresInstallments: terminal.requiresInstallments,
      requiresBatchNumber: terminal.requiresBatchNumber,
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

      if (editingTerminal) {
        await api.put(`/card-terminals/${editingTerminal.id}`, data);
      } else {
        await api.post('/card-terminals', data);
      }

      setShowModal(false);
      loadTerminals();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Error al guardar el terminal');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (terminal: CardTerminal) => {
    try {
      await api.patch(`/card-terminals/${terminal.id}/toggle`);
      loadTerminals();
    } catch (err) {
      console.error('Error toggling terminal:', err);
    }
  };

  const handleDelete = async (terminal: CardTerminal) => {
    try {
      await api.delete(`/card-terminals/${terminal.id}`);
      setShowDeleteConfirm(null);
      loadTerminals();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al eliminar el terminal');
      setShowDeleteConfirm(null);
    }
  };

  const filteredTerminals = terminals.filter(
    (terminal) =>
      terminal.name.toLowerCase().includes(search.toLowerCase()) ||
      terminal.code.toLowerCase().includes(search.toLowerCase())
  );

  const systemTerminals = filteredTerminals.filter((t) => t.isSystem);
  const customTerminals = filteredTerminals.filter((t) => !t.isSystem);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terminales de Tarjetas no integrados</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurar terminales externos como Posnet, Lapos, Payway, etc.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTerminals}
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
            Nuevo Terminal
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
              placeholder="Buscar terminal..."
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
        ) : terminals.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay terminales configurados</p>
            <button
              onClick={handleInitialize}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Inicializar terminales de sistema
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {/* System Terminals */}
            {systemTerminals.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <Settings size={16} />
                  Terminales de Sistema
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {systemTerminals.map((terminal) => (
                    <TerminalCard
                      key={terminal.id}
                      terminal={terminal}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Custom Terminals */}
            {customTerminals.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                  <Plus size={16} />
                  Terminales Personalizados
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customTerminals.map((terminal) => (
                    <TerminalCard
                      key={terminal.id}
                      terminal={terminal}
                      onEdit={handleOpenEdit}
                      onToggle={handleToggleActive}
                      onDelete={(t) => setShowDeleteConfirm(t)}
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
        Total: {terminals.length} terminales ({systemTerminals.length} de sistema, {customTerminals.length} personalizados)
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingTerminal ? 'Editar Terminal' : 'Nuevo Terminal'}
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
                  placeholder="Ej: Mi Terminal"
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
                  placeholder="Ej: MITERMINAL"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">Solo letras mayúsculas, números y guiones</p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Campos Requeridos en el POS</p>
                <div className="space-y-2">
                  {[
                    { key: 'requiresAuthCode', label: 'Código de Autorización' },
                    { key: 'requiresVoucherNumber', label: 'Número de Cupón' },
                    { key: 'requiresBatchNumber', label: 'Número de Lote' },
                    { key: 'requiresInstallments', label: 'Cuotas' },
                    { key: 'requiresCardBrand', label: 'Marca de Tarjeta' },
                    { key: 'requiresLastFour', label: 'Últimos 4 dígitos' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[key as keyof FormData] as boolean}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Terminal activo</span>
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
              <h3 className="text-lg font-semibold mb-2">Eliminar Terminal</h3>
              <p className="text-gray-500 mb-6">
                ¿Está seguro de eliminar el terminal "{showDeleteConfirm.name}"?
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

// Terminal Card Component
function TerminalCard({
  terminal,
  onEdit,
  onToggle,
  onDelete,
}: {
  terminal: CardTerminal;
  onEdit: (terminal: CardTerminal) => void;
  onToggle: (terminal: CardTerminal) => void;
  onDelete: (terminal: CardTerminal) => void;
}) {
  const requiredFields = [
    terminal.requiresAuthCode && 'Autorización',
    terminal.requiresVoucherNumber && 'Cupón',
    terminal.requiresBatchNumber && 'Lote',
    terminal.requiresInstallments && 'Cuotas',
    terminal.requiresCardBrand && 'Marca',
    terminal.requiresLastFour && 'Últimos 4',
  ].filter(Boolean);

  return (
    <div
      className={`p-4 border rounded-lg ${
        terminal.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              terminal.isActive ? 'bg-blue-100' : 'bg-gray-200'
            }`}
          >
            <CreditCard
              className={`w-5 h-5 ${terminal.isActive ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{terminal.name}</h4>
            <p className="text-xs text-gray-500">{terminal.code}</p>
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            terminal.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {terminal.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {requiredFields.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Campos requeridos:</p>
          <div className="flex flex-wrap gap-1">
            {requiredFields.map((field) => (
              <span
                key={field as string}
                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t">
        <button
          onClick={() => onEdit(terminal)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          <Edit2 size={14} />
          Editar
        </button>
        <button
          onClick={() => onToggle(terminal)}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm rounded ${
            terminal.isActive
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-green-600 hover:bg-green-50'
          }`}
        >
          <Power size={14} />
          {terminal.isActive ? 'Desactivar' : 'Activar'}
        </button>
        {!terminal.isSystem && (
          <button
            onClick={() => onDelete(terminal)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
