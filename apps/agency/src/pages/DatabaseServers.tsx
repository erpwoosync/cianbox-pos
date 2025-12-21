import { useEffect, useState } from 'react';
import {
  Plus,
  Database,
  MoreVertical,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Edit,
  Play,
} from 'lucide-react';
import { dbServersApi } from '../services/api';

interface DbServer {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  tenantCount: number;
}

export default function DatabaseServers() {
  const [servers, setServers] = useState<DbServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<DbServer | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error'>>({});

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await dbServersApi.getAll();
      setServers(data);
    } catch (error) {
      console.error('Error loading servers:', error);
      // Mock data
      setServers([
        {
          id: '1',
          name: 'Primary Server',
          host: '172.16.1.62',
          port: 5432,
          database: 'cianbox_pos',
          username: 'postgres',
          isActive: true,
          createdAt: new Date().toISOString(),
          tenantCount: 3,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResults((prev) => ({ ...prev, [id]: undefined as unknown as 'success' | 'error' }));
    try {
      await dbServersApi.testConnection(id);
      setTestResults((prev) => ({ ...prev, [id]: 'success' }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: 'error' }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este servidor?')) return;
    try {
      await dbServersApi.delete(id);
      await loadServers();
    } catch (error) {
      console.error('Error deleting server:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DB Servers</h1>
          <p className="text-gray-500">Servidores de base de datos para sharding</p>
        </div>
        <button
          onClick={() => {
            setEditingServer(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Nuevo Servidor
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <div
              key={server.id}
              className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    server.isActive ? 'bg-green-100' : 'bg-gray-100'
                  }`}
                >
                  <Database
                    className={`w-6 h-6 ${
                      server.isActive ? 'text-green-600' : 'text-gray-400'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{server.name}</h3>
                    {server.isActive ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {server.host}:{server.port} / {server.database}
                  </p>
                  <p className="text-xs text-gray-400">
                    {server.tenantCount || 0} tenants asignados
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestConnection(server.id)}
                  disabled={testingId === server.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    testResults[server.id] === 'success'
                      ? 'bg-green-100 text-green-700'
                      : testResults[server.id] === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {testingId === server.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Test
                </button>
                <button
                  onClick={() => {
                    setEditingServer(server);
                    setShowModal(true);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={18} />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          ))}

          {servers.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay servidores configurados</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <DbServerModal
          server={editingServer}
          onClose={() => {
            setShowModal(false);
            setEditingServer(null);
          }}
          onSaved={loadServers}
        />
      )}
    </div>
  );
}

interface DbServerModalProps {
  server: DbServer | null;
  onClose: () => void;
  onSaved: () => void;
}

function DbServerModal({ server, onClose, onSaved }: DbServerModalProps) {
  const [formData, setFormData] = useState({
    name: server?.name || '',
    host: server?.host || '',
    port: server?.port || 5432,
    database: server?.database || '',
    username: server?.username || '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (server) {
        await dbServersApi.update(server.id, formData);
      } else {
        await dbServersApi.create(formData);
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving server:', error);
      alert('Error al guardar el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {server ? 'Editar Servidor' : 'Nuevo Servidor'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Primary Server"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) =>
                  setFormData({ ...formData, host: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="172.16.1.62"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Puerto
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="5432"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base de datos
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) =>
                setFormData({ ...formData, database: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="cianbox_pos"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="postgres"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña {server && '(dejar vacío para mantener)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="••••••••"
              required={!server}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : server ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
