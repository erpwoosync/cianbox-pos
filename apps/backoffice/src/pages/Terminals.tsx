import { useState, useEffect } from 'react';
import { terminalsApi, pointsOfSaleApi, PosTerminal, PointOfSale, TerminalsStats } from '../services/api';
import {
  Monitor,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  X,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  Cpu
} from 'lucide-react';

const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  DISABLED: { label: 'Deshabilitado', color: 'bg-gray-100 text-gray-500', icon: Ban },
  BLOCKED: { label: 'Bloqueado', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function Terminals() {
  const [terminals, setTerminals] = useState<PosTerminal[]>([]);
  const [stats, setStats] = useState<TerminalsStats | null>(null);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<PosTerminal | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PENDING' as 'PENDING' | 'ACTIVE' | 'DISABLED' | 'BLOCKED',
    pointOfSaleId: '' as string | null,
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [terminalsData, posData] = await Promise.all([
        terminalsApi.getAll({ status: statusFilter || undefined, search: search || undefined }),
        pointsOfSaleApi.getAll(),
      ]);
      setTerminals(terminalsData.data);
      setStats(terminalsData.stats);
      setPointsOfSale(posData);
    } catch (error) {
      console.error('Error loading terminals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTerminals = terminals.filter((t) =>
    t.hostname.toLowerCase().includes(search.toLowerCase()) ||
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.macAddress.toLowerCase().includes(search.toLowerCase()) ||
    t.ipAddress?.toLowerCase().includes(search.toLowerCase())
  );

  const openEditModal = (terminal: PosTerminal) => {
    setEditingTerminal(terminal);
    setFormData({
      name: terminal.name || '',
      description: terminal.description || '',
      status: terminal.status,
      pointOfSaleId: terminal.pointOfSaleId || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTerminal(null);
    setFormData({
      name: '',
      description: '',
      status: 'PENDING',
      pointOfSaleId: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerminal) return;

    setSaving(true);
    try {
      await terminalsApi.update(editingTerminal.id, {
        name: formData.name || undefined,
        description: formData.description || undefined,
        status: formData.status,
        pointOfSaleId: formData.pointOfSaleId || null,
      });
      closeModal();
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error updating terminal:', error);
      alert(err.response?.data?.error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (terminal: PosTerminal) => {
    if (!confirm(`¿Eliminar la terminal "${terminal.name || terminal.hostname}"? Esta accion no se puede deshacer.`)) return;

    setDeleting(terminal.id);
    try {
      await terminalsApi.delete(terminal.id);
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error deleting terminal:', error);
      alert(err.response?.data?.error?.message || 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Hace instantes';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Terminales POS</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats.online}</div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Wifi size={14} /> En linea
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-gray-500">Activas</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-500">Pendientes</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-500">{stats.disabled}</div>
            <div className="text-sm text-gray-500">Deshabilitadas</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
            <div className="text-sm text-gray-500">Bloqueadas</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por hostname, nombre, MAC o IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="ACTIVE">Activas</option>
            <option value="DISABLED">Deshabilitadas</option>
            <option value="BLOCKED">Bloqueadas</option>
          </select>
        </div>

        {/* Terminals table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredTerminals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {terminals.length === 0
              ? 'No hay terminales registradas. Las terminales se registran automaticamente cuando un POS Desktop se conecta.'
              : 'No se encontraron terminales con los filtros aplicados'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Terminal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Punto de Venta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Info Sistema
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ultima Conexion
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTerminals.map((terminal) => {
                  const statusCfg = statusConfig[terminal.status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={terminal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${terminal.isOnline ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Monitor size={20} className={terminal.isOnline ? 'text-green-600' : 'text-gray-400'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {terminal.name || terminal.hostname}
                              </span>
                              <span title={terminal.isOnline ? "En linea" : "Desconectado"}>
                                {terminal.isOnline ? (
                                  <Wifi size={14} className="text-green-500" />
                                ) : (
                                  <WifiOff size={14} className="text-gray-400" />
                                )}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {terminal.hostname} | {terminal.macAddress}
                            </div>
                            {terminal.ipAddress && (
                              <div className="text-xs text-gray-400">
                                IP: {terminal.ipAddress}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {terminal.pointOfSale ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {terminal.pointOfSale.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {terminal.pointOfSale.branch.name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-yellow-600 font-medium">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Cpu size={14} className="text-gray-400" />
                          <div>
                            {terminal.osVersion && (
                              <div className="text-xs">{terminal.osVersion}</div>
                            )}
                            {terminal.appVersion && (
                              <div className="text-xs text-gray-400">App v{terminal.appVersion}</div>
                            )}
                            {!terminal.osVersion && !terminal.appVersion && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusCfg.color}`}>
                          <StatusIcon size={12} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {getTimeSince(terminal.lastSeenAt)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(terminal.lastSeenAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(terminal)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(terminal)}
                            disabled={deleting === terminal.id}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deleting === terminal.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && editingTerminal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Editar Terminal
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Info de la terminal (solo lectura) */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Hostname:</span>
                  <span className="font-medium text-gray-900">{editingTerminal.hostname}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">MAC:</span>
                  <span className="font-mono text-gray-900">{editingTerminal.macAddress}</span>
                </div>
                {editingTerminal.ipAddress && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">IP:</span>
                    <span className="text-gray-900">{editingTerminal.ipAddress}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Registrada:</span>
                  <span className="text-gray-900">{formatDate(editingTerminal.registeredAt)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Caja Principal"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Descripcion opcional..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Punto de Venta *
                </label>
                <select
                  value={formData.pointOfSaleId || ''}
                  onChange={(e) => setFormData({ ...formData, pointOfSaleId: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Sin asignar</option>
                  {pointsOfSale.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name} - {pos.branch?.name} ({pos.code})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Debe asignar un Punto de Venta para activar la terminal
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="DISABLED">Deshabilitado</option>
                  <option value="BLOCKED">Bloqueado</option>
                </select>
                {formData.status === 'ACTIVE' && !formData.pointOfSaleId && (
                  <p className="mt-1 text-xs text-red-500">
                    Debe asignar un Punto de Venta para activar la terminal
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || (formData.status === 'ACTIVE' && !formData.pointOfSaleId)}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <RefreshCw size={16} className="animate-spin" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
