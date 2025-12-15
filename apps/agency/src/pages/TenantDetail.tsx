import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Settings,
  Database,
  RefreshCw,
  Save,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { tenantsApi, connectionsApi } from '../services/api';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  dbServer?: {
    id: string;
    name: string;
    host: string;
  };
  cianboxConnection?: {
    apiUrl: string;
    apiKey: string;
    lastSync: string | null;
    lastSyncStatus: string | null;
  };
  _count?: {
    products: number;
    categories: number;
    brands: number;
    users: number;
    sales: number;
  };
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    isActive: true,
    apiUrl: '',
    apiKey: '',
  });

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      const data = await tenantsApi.getById(id!);
      setTenant(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
        apiUrl: data.cianboxConnection?.apiUrl || '',
        apiKey: data.cianboxConnection?.apiKey || '',
      });
    } catch (error) {
      console.error('Error loading tenant:', error);
      // Mock data
      const mockTenant: TenantDetail = {
        id: id!,
        name: 'Demo Store',
        slug: 'demo-store',
        isActive: true,
        createdAt: new Date().toISOString(),
        dbServer: {
          id: '1',
          name: 'Primary Server',
          host: '172.16.1.62',
        },
        cianboxConnection: {
          apiUrl: 'https://demo.cianbox.com/api',
          apiKey: 'secret-key',
          lastSync: new Date().toISOString(),
          lastSyncStatus: 'success',
        },
        _count: {
          products: 150,
          categories: 12,
          brands: 8,
          users: 3,
          sales: 245,
        },
      };
      setTenant(mockTenant);
      setFormData({
        name: mockTenant.name,
        slug: mockTenant.slug,
        isActive: mockTenant.isActive,
        apiUrl: mockTenant.cianboxConnection?.apiUrl || '',
        apiKey: mockTenant.cianboxConnection?.apiKey || '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await tenantsApi.update(id!, {
        name: formData.name,
        slug: formData.slug,
        isActive: formData.isActive,
      });

      if (formData.apiUrl || formData.apiKey) {
        await connectionsApi.update(id!, {
          apiUrl: formData.apiUrl,
          apiKey: formData.apiKey,
        });
      }

      await loadTenant();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      await connectionsApi.test(id!);
      setConnectionStatus('success');
    } catch {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await tenantsApi.syncProducts(id!);
      await loadTenant();
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Tenant no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/tenants')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            <p className="text-gray-500">{tenant.slug}</p>
          </div>
        </div>
        <span
          className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
            tenant.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {tenant.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Productos', value: tenant._count?.products || 0 },
          { label: 'Categorías', value: tenant._count?.categories || 0 },
          { label: 'Marcas', value: tenant._count?.brands || 0 },
          { label: 'Usuarios', value: tenant._count?.users || 0 },
          { label: 'Ventas', value: tenant._count?.sales || 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex gap-4 px-6">
            {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'cianbox', label: 'Cianbox', icon: Database },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-4 max-w-lg">
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DB Server
                </label>
                <p className="text-gray-600">
                  {tenant.dbServer?.name || 'No asignado'}{' '}
                  {tenant.dbServer?.host && (
                    <span className="text-gray-400">({tenant.dbServer.host})</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Tenant activo
                </label>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}

          {activeTab === 'cianbox' && (
            <div className="space-y-6">
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL API Cianbox
                  </label>
                  <input
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, apiUrl: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="https://api.cianbox.com/client"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save size={18} />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : connectionStatus === 'success' ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : connectionStatus === 'error' ? (
                      <XCircle size={18} className="text-red-500" />
                    ) : (
                      <AlertCircle size={18} />
                    )}
                    Probar Conexión
                  </button>
                </div>
              </div>

              {/* Sync Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Sincronización
                </h3>

                {tenant.cianboxConnection?.lastSync && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Última sincronización:{' '}
                      <span className="font-medium">
                        {new Date(
                          tenant.cianboxConnection.lastSync
                        ).toLocaleString()}
                      </span>
                    </p>
                    {tenant.cianboxConnection.lastSyncStatus && (
                      <p className="text-sm text-gray-600">
                        Estado:{' '}
                        <span
                          className={`font-medium ${
                            tenant.cianboxConnection.lastSyncStatus === 'success'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {tenant.cianboxConnection.lastSyncStatus === 'success'
                            ? 'Exitoso'
                            : 'Fallido'}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSync}
                  disabled={syncing || !formData.apiUrl || !formData.apiKey}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {syncing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Play size={18} />
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar Productos'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
