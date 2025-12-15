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
  Link,
  Eye,
  EyeOff,
} from 'lucide-react';
import { tenantsApi, connectionsApi } from '../services/api';

interface CianboxConnection {
  id: string;
  cuenta: string;
  appName: string;
  appCode: string;
  user: string;
  password: string;
  syncPageSize: number;
  isActive: boolean;
  lastSync: string | null;
  syncStatus: string | null;
  webhookUrl: string | null;
}

interface TenantDetailData {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: string;
  databaseServer?: {
    id: string;
    name: string;
    host: string;
  };
  cianboxConnection?: CianboxConnection;
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
  const [tenant, setTenant] = useState<TenantDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form data para datos generales del tenant
  const [generalForm, setGeneralForm] = useState({
    name: '',
    slug: '',
    status: 'ACTIVE',
    plan: 'FREE',
  });

  // Form data para conexión Cianbox
  const [cianboxForm, setCianboxForm] = useState({
    cuenta: '',
    appName: '',
    appCode: '',
    user: '',
    password: '',
    syncPageSize: 50,
    isActive: true,
    webhookUrl: '',
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

      setGeneralForm({
        name: data.name,
        slug: data.slug,
        status: data.status || 'ACTIVE',
        plan: data.plan || 'FREE',
      });

      if (data.cianboxConnection) {
        setCianboxForm({
          cuenta: data.cianboxConnection.cuenta || '',
          appName: data.cianboxConnection.appName || '',
          appCode: data.cianboxConnection.appCode || '',
          user: data.cianboxConnection.user || '',
          password: '', // No mostramos la contraseña guardada
          syncPageSize: data.cianboxConnection.syncPageSize || 50,
          isActive: data.cianboxConnection.isActive ?? true,
          webhookUrl: data.cianboxConnection.webhookUrl || '',
        });
      }
    } catch (error) {
      console.error('Error loading tenant:', error);
      showMessage('error', 'Error al cargar el tenant');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await tenantsApi.update(id!, {
        name: generalForm.name,
        slug: generalForm.slug,
        status: generalForm.status,
        plan: generalForm.plan,
      });
      await loadTenant();
      showMessage('success', 'Datos generales guardados');
    } catch (error) {
      console.error('Error saving:', error);
      showMessage('error', 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCianbox = async () => {
    setSaving(true);
    try {
      await connectionsApi.update(id!, {
        cuenta: cianboxForm.cuenta,
        appName: cianboxForm.appName,
        appCode: cianboxForm.appCode,
        user: cianboxForm.user,
        password: cianboxForm.password || undefined, // Solo enviar si se cambió
        syncPageSize: cianboxForm.syncPageSize,
        isActive: cianboxForm.isActive,
        webhookUrl: cianboxForm.webhookUrl || undefined,
      });
      await loadTenant();
      showMessage('success', 'Conexión Cianbox guardada');
      setCianboxForm(prev => ({ ...prev, password: '' })); // Limpiar password después de guardar
    } catch (error) {
      console.error('Error saving Cianbox:', error);
      showMessage('error', 'Error al guardar conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const result = await connectionsApi.test(id!);
      if (result.success) {
        setConnectionStatus('success');
        showMessage('success', 'Conexión exitosa');
      } else {
        setConnectionStatus('error');
        showMessage('error', result.message || 'Error de conexión');
      }
    } catch (error) {
      setConnectionStatus('error');
      showMessage('error', 'No se pudo conectar a Cianbox');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await tenantsApi.syncProducts(id!);
      await loadTenant();
      showMessage('success', 'Sincronización iniciada');
    } catch (error) {
      console.error('Error syncing:', error);
      showMessage('error', 'Error al sincronizar');
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

  const isActive = tenant.status === 'ACTIVE';
  const hasConnection = !!tenant.cianboxConnection;

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle size={18} />
          ) : (
            <XCircle size={18} />
          )}
          {message.text}
        </div>
      )}

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
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tenant.status}
          </span>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            {tenant.plan}
          </span>
        </div>
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
              { id: 'cianbox', label: 'Integración Cianbox', icon: Link },
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
          {/* Tab General */}
          {activeTab === 'general' && (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={generalForm.name}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, name: e.target.value })
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
                  value={generalForm.slug}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, slug: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan
                </label>
                <select
                  value={generalForm.plan}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, plan: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={generalForm.status}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, status: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="SUSPENDED">Suspendido</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DB Server
                </label>
                <p className="text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                  {tenant.databaseServer?.name || 'Servidor por defecto'}{' '}
                  {tenant.databaseServer?.host && (
                    <span className="text-gray-400">({tenant.databaseServer.host})</span>
                  )}
                </p>
              </div>

              <button
                onClick={handleSaveGeneral}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}

          {/* Tab Cianbox */}
          {activeTab === 'cianbox' && (
            <div className="space-y-6">
              {/* Estado de conexión */}
              <div className={`p-4 rounded-lg ${hasConnection ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2">
                  {hasConnection ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Conexión configurada</span>
                      {tenant.cianboxConnection?.isActive && (
                        <span className="ml-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full">
                          Activa
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Sin conexión configurada</span>
                    </>
                  )}
                </div>
              </div>

              {/* Formulario de conexión */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Database size={18} />
                    Credenciales de API
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuenta (URL base)
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.cuenta}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, cuenta: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="mitienda.cianbox.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL de tu cuenta Cianbox (sin https://)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de Aplicación
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.appName}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, appName: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="POS Cianbox"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código de Aplicación
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.appCode}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, appCode: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="pos-app-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.user}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, user: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="api_user"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña {hasConnection && <span className="text-gray-400">(dejar vacío para mantener)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={cianboxForm.password}
                        onChange={(e) =>
                          setCianboxForm({ ...cianboxForm, password: e.target.value })
                        }
                        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Settings size={18} />
                    Configuración
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Productos por página (sync)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={cianboxForm.syncPageSize}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, syncPageSize: parseInt(e.target.value) || 50 })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Cantidad de productos a sincronizar por página (máx 200)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL (opcional)
                    </label>
                    <input
                      type="url"
                      value={cianboxForm.webhookUrl}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, webhookUrl: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="https://..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL para recibir notificaciones de Cianbox
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={cianboxForm.isActive}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                      Conexión activa
                    </label>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveCianbox}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? 'Guardando...' : 'Guardar Conexión'}
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !cianboxForm.cuenta}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                    connectionStatus === 'success'
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : connectionStatus === 'error'
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {testingConnection ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : connectionStatus === 'success' ? (
                    <CheckCircle size={18} />
                  ) : connectionStatus === 'error' ? (
                    <XCircle size={18} />
                  ) : (
                    <AlertCircle size={18} />
                  )}
                  Probar Conexión
                </button>
              </div>

              {/* Sección de Sincronización */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Sincronización de Datos
                </h3>

                {tenant.cianboxConnection?.lastSync && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Última sincronización:</span>
                        <p className="font-medium text-gray-900">
                          {new Date(tenant.cianboxConnection.lastSync).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Estado:</span>
                        <p className={`font-medium ${
                          tenant.cianboxConnection.syncStatus === 'success'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {tenant.cianboxConnection.syncStatus === 'success' ? 'Exitoso' : tenant.cianboxConnection.syncStatus || 'Pendiente'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSync}
                    disabled={syncing || !hasConnection}
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

                {!hasConnection && (
                  <p className="text-sm text-yellow-600 mt-2">
                    Configura la conexión Cianbox para habilitar la sincronización
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
