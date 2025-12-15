import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Building2,
  MoreVertical,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { tenantsApi } from '../services/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  dbServer?: {
    name: string;
  };
  cianboxConnection?: {
    apiUrl: string;
    lastSync: string;
  };
  _count?: {
    products: number;
    users: number;
  };
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await tenantsApi.getAll();
      setTenants(data);
    } catch (error) {
      console.error('Error loading tenants:', error);
      // Mock data for development
      setTenants([
        {
          id: '1',
          name: 'Demo Store',
          slug: 'demo-store',
          isActive: true,
          createdAt: new Date().toISOString(),
          dbServer: { name: 'Primary Server' },
          cianboxConnection: {
            apiUrl: 'https://demo.cianbox.com',
            lastSync: new Date().toISOString(),
          },
          _count: { products: 150, users: 3 },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-500">Gestión de clientes del sistema</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Nuevo Tenant
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          size={20}
        />
        <input
          type="text"
          placeholder="Buscar por nombre o slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Tenants List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                  Tenant
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                  DB Server
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                  Cianbox
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                  Productos
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                  Estado
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/tenants/${tenant.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 hover:text-blue-600">
                          {tenant.name}
                        </p>
                        <p className="text-sm text-gray-500">{tenant.slug}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {tenant.dbServer?.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {tenant.cianboxConnection ? (
                      <div>
                        <p className="text-sm text-gray-600 truncate max-w-[200px]">
                          {tenant.cianboxConnection.apiUrl}
                        </p>
                        <p className="text-xs text-gray-400">
                          Sync:{' '}
                          {new Date(
                            tenant.cianboxConnection.lastSync
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No configurado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {tenant._count?.products || 0}
                  </td>
                  <td className="px-6 py-4">
                    {tenant.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        <CheckCircle size={12} />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        <XCircle size={12} />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <MoreVertical size={20} className="text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTenants.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No se encontraron tenants
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadTenants}
        />
      )}
    </div>
  );
}

interface CreateTenantModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateTenantModal({ onClose, onCreated }: CreateTenantModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    cianboxApiUrl: '',
    cianboxApiKey: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await tenantsApi.create(formData);
      onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Error al crear el tenant');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Nuevo Tenant</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                });
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Mi Tienda"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="mi-tienda"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL API Cianbox
            </label>
            <input
              type="url"
              value={formData.cianboxApiUrl}
              onChange={(e) =>
                setFormData({ ...formData, cianboxApiUrl: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="https://api.cianbox.com/client"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key Cianbox
            </label>
            <input
              type="password"
              value={formData.cianboxApiKey}
              onChange={(e) =>
                setFormData({ ...formData, cianboxApiKey: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="••••••••"
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
              {loading ? 'Creando...' : 'Crear Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
