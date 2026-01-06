/**
 * BankAccounts - Gestión de Cuentas Bancarias
 * CRUD para administrar cuentas bancarias para liquidación de cupones
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
} from 'lucide-react';
import api from '../services/api';

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string | null;
  cbu: string | null;
  alias: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    settlements: number;
  };
}

interface FormData {
  name: string;
  bankName: string;
  accountNumber: string;
  cbu: string;
  alias: string;
  isActive: boolean;
}

const initialFormData: FormData = {
  name: '',
  bankName: '',
  accountNumber: '',
  cbu: '',
  alias: '',
  isActive: true,
};

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<BankAccount | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bank-accounts');
      setAccounts(response.data);
    } catch (err) {
      console.error('Error loading accounts:', err);
      setError('Error al cargar las cuentas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setFormData(initialFormData);
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber || '',
      cbu: account.cbu || '',
      alias: account.alias || '',
      isActive: account.isActive,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.bankName.trim()) {
      setError('Nombre y banco son requeridos');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        ...formData,
        accountNumber: formData.accountNumber || null,
        cbu: formData.cbu || null,
        alias: formData.alias || null,
      };

      if (editingAccount) {
        await api.put(`/bank-accounts/${editingAccount.id}`, data);
      } else {
        await api.post('/bank-accounts', data);
      }

      setShowModal(false);
      loadAccounts();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (account: BankAccount) => {
    try {
      await api.patch(`/bank-accounts/${account.id}/toggle`);
      loadAccounts();
    } catch (err) {
      console.error('Error toggling account:', err);
    }
  };

  const handleDelete = async (account: BankAccount) => {
    try {
      await api.delete(`/bank-accounts/${account.id}`);
      setShowDeleteConfirm(null);
      loadAccounts();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosError.response?.data?.error?.message || 'Error al eliminar la cuenta');
      setShowDeleteConfirm(null);
    }
  };

  const filteredAccounts = accounts.filter(
    (account) =>
      account.name.toLowerCase().includes(search.toLowerCase()) ||
      account.bankName.toLowerCase().includes(search.toLowerCase()) ||
      (account.alias && account.alias.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas Bancarias</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionar cuentas bancarias para liquidación de cupones
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAccounts}
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
            Nueva Cuenta
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
              placeholder="Buscar por nombre, banco o alias..."
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
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay cuentas bancarias configuradas</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Agregar primera cuenta
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={handleOpenEdit}
                  onToggle={handleToggleActive}
                  onDelete={(a) => setShowDeleteConfirm(a)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="text-sm text-gray-500">
        Total: {accounts.length} cuenta(s) bancaria(s)
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la cuenta *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Cta Cte Principal"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banco *
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Ej: Santander, BBVA, Macro"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Cuenta
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="Ej: 123-456789/0"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alias
                  </label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    placeholder="Ej: MI.CUENTA.SANTANDER"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CBU
                  </label>
                  <input
                    type="text"
                    value={formData.cbu}
                    onChange={(e) => setFormData({ ...formData, cbu: e.target.value.replace(/\D/g, '') })}
                    placeholder="22 dígitos"
                    maxLength={22}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.cbu.length}/22 dígitos</p>
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
                  <span className="text-sm font-medium text-gray-700">Cuenta activa</span>
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
              <h3 className="text-lg font-semibold mb-2">Eliminar Cuenta</h3>
              <p className="text-gray-500 mb-6">
                ¿Está seguro de eliminar la cuenta "{showDeleteConfirm.name}"?
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

// Account Card Component
function AccountCard({
  account,
  onEdit,
  onToggle,
  onDelete,
}: {
  account: BankAccount;
  onEdit: (account: BankAccount) => void;
  onToggle: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
}) {
  return (
    <div
      className={`p-4 border rounded-lg ${
        account.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              account.isActive ? 'bg-green-100' : 'bg-gray-200'
            }`}
          >
            <Building2
              className={`w-5 h-5 ${account.isActive ? 'text-green-600' : 'text-gray-400'}`}
            />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{account.name}</h4>
            <p className="text-sm text-gray-500">{account.bankName}</p>
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            account.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {account.isActive ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      <div className="space-y-1 mb-3 text-sm">
        {account.alias && (
          <p className="text-gray-600">
            <span className="text-gray-400">Alias:</span> {account.alias}
          </p>
        )}
        {account.accountNumber && (
          <p className="text-gray-600">
            <span className="text-gray-400">Cuenta:</span> {account.accountNumber}
          </p>
        )}
        {account.cbu && (
          <p className="text-gray-600 font-mono text-xs">
            <span className="text-gray-400 font-sans">CBU:</span> {account.cbu}
          </p>
        )}
      </div>

      {account._count && account._count.settlements > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          {account._count.settlements} liquidación(es)
        </p>
      )}

      <div className="flex gap-2 pt-3 border-t">
        <button
          onClick={() => onEdit(account)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          <Edit2 size={14} />
          Editar
        </button>
        <button
          onClick={() => onToggle(account)}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm rounded ${
            account.isActive
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-green-600 hover:bg-green-50'
          }`}
        >
          <Power size={14} />
          {account.isActive ? 'Desactivar' : 'Activar'}
        </button>
        <button
          onClick={() => onDelete(account)}
          className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
