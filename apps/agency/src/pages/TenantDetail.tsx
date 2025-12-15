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
  FolderTree,
  Tags,
  Package,
  Search,
  DollarSign,
  Warehouse,
  Store,
  ListOrdered,
  Users,
  Monitor,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { tenantsApi, connectionsApi, catalogApi, Category, Brand, Product, PriceList, Branch, PointOfSale, CreatePointOfSaleDto } from '../services/api';

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
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [syncingBrands, setSyncingBrands] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingBranches, setSyncingBranches] = useState(false);
  const [syncingPriceLists, setSyncingPriceLists] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Catálogo
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Puntos de Venta Modal
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState<PointOfSale | null>(null);
  const [savingPos, setSavingPos] = useState(false);
  const [deletingPos, setDeletingPos] = useState<string | null>(null);
  const [posForm, setPosForm] = useState<CreatePointOfSaleDto>({
    branchId: '',
    code: '',
    name: '',
    description: '',
    priceListId: '',
    isActive: true,
  });

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

  // Cargar catálogo cuando se cambia al tab correspondiente
  const loadCatalog = async (type: 'categories' | 'brands' | 'products' | 'branches' | 'priceLists' | 'pointsOfSale') => {
    if (!id) return;
    setLoadingCatalog(true);
    try {
      if (type === 'categories' && categories.length === 0) {
        const data = await catalogApi.getCategories(id);
        setCategories(data);
      } else if (type === 'brands' && brands.length === 0) {
        const data = await catalogApi.getBrands(id);
        setBrands(data);
      } else if (type === 'products' && products.length === 0) {
        const data = await catalogApi.getProducts(id);
        setProducts(data);
      } else if (type === 'branches' && branches.length === 0) {
        const data = await catalogApi.getBranches(id);
        setBranches(data);
      } else if (type === 'priceLists' && priceLists.length === 0) {
        const data = await catalogApi.getPriceLists(id);
        setPriceLists(data);
      } else if (type === 'pointsOfSale') {
        // Cargar también branches y priceLists si no están cargados (para el modal)
        const [posData, branchesData, priceListsData] = await Promise.all([
          catalogApi.getPointsOfSale(id),
          branches.length === 0 ? catalogApi.getBranches(id) : Promise.resolve(branches),
          priceLists.length === 0 ? catalogApi.getPriceLists(id) : Promise.resolve(priceLists),
        ]);
        setPointsOfSale(posData);
        if (branches.length === 0) setBranches(branchesData);
        if (priceLists.length === 0) setPriceLists(priceListsData);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      showMessage('error', `Error al cargar ${type}`);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Efecto para cargar catálogo al cambiar de tab
  useEffect(() => {
    if (activeTab === 'categories') {
      loadCatalog('categories');
    } else if (activeTab === 'brands') {
      loadCatalog('brands');
    } else if (activeTab === 'products') {
      loadCatalog('products');
    } else if (activeTab === 'branches') {
      loadCatalog('branches');
    } else if (activeTab === 'priceLists') {
      loadCatalog('priceLists');
    } else if (activeTab === 'pointsOfSale') {
      loadCatalog('pointsOfSale');
    }
  }, [activeTab]);

  // Funciones de Puntos de Venta
  const openCreatePosModal = () => {
    setEditingPos(null);
    setPosForm({
      branchId: branches[0]?.id || '',
      code: '',
      name: '',
      description: '',
      priceListId: priceLists.find(pl => pl.isDefault)?.id || '',
      isActive: true,
    });
    setShowPosModal(true);
  };

  const openEditPosModal = (pos: PointOfSale) => {
    setEditingPos(pos);
    setPosForm({
      branchId: pos.branchId,
      code: pos.code,
      name: pos.name,
      description: pos.description || '',
      priceListId: pos.priceListId || '',
      isActive: pos.isActive,
    });
    setShowPosModal(true);
  };

  const closePosModal = () => {
    setShowPosModal(false);
    setEditingPos(null);
    setPosForm({
      branchId: '',
      code: '',
      name: '',
      description: '',
      priceListId: '',
      isActive: true,
    });
  };

  const handleSavePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSavingPos(true);
    try {
      if (editingPos) {
        await catalogApi.updatePointOfSale(id, editingPos.id, posForm);
        showMessage('success', 'Punto de venta actualizado');
      } else {
        await catalogApi.createPointOfSale(id, posForm);
        showMessage('success', 'Punto de venta creado');
      }
      closePosModal();
      setPointsOfSale([]);
      loadCatalog('pointsOfSale');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error saving POS:', error);
      showMessage('error', err.response?.data?.error?.message || 'Error al guardar');
    } finally {
      setSavingPos(false);
    }
  };

  const handleDeletePos = async (pos: PointOfSale) => {
    if (!id) return;
    if (!confirm(`¿Eliminar el punto de venta "${pos.name}"?`)) return;

    setDeletingPos(pos.id);
    try {
      await catalogApi.deletePointOfSale(id, pos.id);
      showMessage('success', 'Punto de venta eliminado');
      setPointsOfSale([]);
      loadCatalog('pointsOfSale');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error deleting POS:', error);
      showMessage('error', err.response?.data?.error?.message || 'Error al eliminar');
    } finally {
      setDeletingPos(null);
    }
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

  const handleSyncCategories = async () => {
    setSyncingCategories(true);
    try {
      const result = await tenantsApi.syncCategories(id!);
      await loadTenant();
      showMessage('success', result.message || 'Categorías sincronizadas');
    } catch (error: unknown) {
      console.error('Error syncing categories:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error al sincronizar categorías');
    } finally {
      setSyncingCategories(false);
    }
  };

  const handleSyncBrands = async () => {
    setSyncingBrands(true);
    try {
      const result = await tenantsApi.syncBrands(id!);
      await loadTenant();
      showMessage('success', result.message || 'Marcas sincronizadas');
    } catch (error: unknown) {
      console.error('Error syncing brands:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error al sincronizar marcas');
    } finally {
      setSyncingBrands(false);
    }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try {
      const result = await tenantsApi.syncProducts(id!);
      await loadTenant();
      showMessage('success', result.message || 'Productos sincronizados');
    } catch (error: unknown) {
      console.error('Error syncing products:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error al sincronizar productos');
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleSyncBranches = async () => {
    setSyncingBranches(true);
    try {
      const result = await tenantsApi.syncBranches(id!);
      await loadTenant();
      setBranches([]); // Limpiar para recargar
      if (activeTab === 'branches') {
        loadCatalog('branches');
      }
      showMessage('success', result.message || 'Sucursales sincronizadas');
    } catch (error: unknown) {
      console.error('Error syncing branches:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error al sincronizar sucursales');
    } finally {
      setSyncingBranches(false);
    }
  };

  const handleSyncPriceLists = async () => {
    setSyncingPriceLists(true);
    try {
      const result = await tenantsApi.syncPriceLists(id!);
      await loadTenant();
      setPriceLists([]); // Limpiar para recargar
      if (activeTab === 'priceLists') {
        loadCatalog('priceLists');
      }
      showMessage('success', result.message || 'Listas de precios sincronizadas');
    } catch (error: unknown) {
      console.error('Error syncing price lists:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error al sincronizar listas de precios');
    } finally {
      setSyncingPriceLists(false);
    }
  };

  const handleSyncCustomers = async () => {
    setSyncingCustomers(true);
    try {
      const result = await tenantsApi.syncCustomers(id!);
      await loadTenant();
      showMessage('success', result.message || 'Clientes sincronizados');
    } catch (error: unknown) {
      console.error('Error syncing customers:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error al sincronizar clientes');
    } finally {
      setSyncingCustomers(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const result = await tenantsApi.syncAll(id!);
      await loadTenant();
      showMessage('success', result.message || 'Sincronización completa');
    } catch (error: unknown) {
      console.error('Error syncing all:', error);
      const err = error as { response?: { data?: { message?: string } } };
      showMessage('error', err.response?.data?.message || 'Error en sincronización');
    } finally {
      setSyncingAll(false);
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
          <nav className="flex gap-4 px-6 overflow-x-auto">
            {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'cianbox', label: 'Integración Cianbox', icon: Link },
              { id: 'branches', label: 'Sucursales', icon: Store },
              { id: 'priceLists', label: 'Listas Precio', icon: ListOrdered },
              { id: 'pointsOfSale', label: 'Puntos Venta', icon: Monitor },
              { id: 'categories', label: 'Categorías', icon: FolderTree },
              { id: 'brands', label: 'Marcas', icon: Tags },
              { id: 'products', label: 'Productos', icon: Package },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors whitespace-nowrap ${
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
                      Empresa Cianbox <span className="text-red-500">*</span>
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-sm">
                        https://cianbox.org/
                      </span>
                      <input
                        type="text"
                        value={cianboxForm.cuenta}
                        onChange={(e) =>
                          setCianboxForm({ ...cianboxForm, cuenta: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })
                        }
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="miempresa"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Nombre de tu empresa en Cianbox (sin espacios ni caracteres especiales)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      app_name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.appName}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, appName: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Mi Aplicación POS"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nombre de la aplicación registrada en Cianbox
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      app_code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.appCode}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, appCode: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                      placeholder="abc123xyz"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Código único de la aplicación
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      user <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cianboxForm.user}
                      onChange={(e) =>
                        setCianboxForm({ ...cianboxForm, user: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="usuario@empresa.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Usuario de Cianbox con permisos de API
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      password <span className="text-red-500">*</span>
                      {hasConnection && <span className="text-gray-400 font-normal"> (dejar vacío para mantener)</span>}
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
                    onClick={handleSyncBranches}
                    disabled={syncingBranches || syncingAll || !hasConnection}
                    className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {syncingBranches ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Store size={18} />
                    )}
                    {syncingBranches ? 'Sincronizando...' : 'Sucursales'}
                  </button>
                  <button
                    onClick={handleSyncPriceLists}
                    disabled={syncingPriceLists || syncingAll || !hasConnection}
                    className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {syncingPriceLists ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <ListOrdered size={18} />
                    )}
                    {syncingPriceLists ? 'Sincronizando...' : 'Listas Precio'}
                  </button>
                  <button
                    onClick={handleSyncCategories}
                    disabled={syncingCategories || syncingAll || !hasConnection}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {syncingCategories ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <FolderTree size={18} />
                    )}
                    {syncingCategories ? 'Sincronizando...' : 'Categorías'}
                  </button>
                  <button
                    onClick={handleSyncBrands}
                    disabled={syncingBrands || syncingAll || !hasConnection}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {syncingBrands ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Tags size={18} />
                    )}
                    {syncingBrands ? 'Sincronizando...' : 'Marcas'}
                  </button>
                  <button
                    onClick={handleSyncProducts}
                    disabled={syncingProducts || syncingAll || !hasConnection}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {syncingProducts ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Package size={18} />
                    )}
                    {syncingProducts ? 'Sincronizando...' : 'Productos'}
                  </button>
                  <button
                    onClick={handleSyncCustomers}
                    disabled={syncingCustomers || syncingAll || !hasConnection}
                    className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
                  >
                    {syncingCustomers ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Users size={18} />
                    )}
                    {syncingCustomers ? 'Sincronizando...' : 'Clientes'}
                  </button>
                  <button
                    onClick={handleSyncAll}
                    disabled={syncingAll || syncingCategories || syncingBrands || syncingProducts || syncingBranches || syncingPriceLists || syncingCustomers || !hasConnection}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {syncingAll ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Play size={18} />
                    )}
                    {syncingAll ? 'Sincronizando todo...' : 'Sincronizar Todo'}
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

          {/* Tab Sucursales */}
          {activeTab === 'branches' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Sucursales</h3>
                <button
                  onClick={handleSyncBranches}
                  disabled={syncingBranches || !hasConnection}
                  className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {syncingBranches ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Sincronizar
                </button>
              </div>

              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : branches.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay sucursales registradas
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branches.map((branch) => (
                    <div
                      key={branch.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Store className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{branch.name}</h3>
                        <p className="text-sm text-gray-500">
                          Código: {branch.code || '-'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          branch.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {branch.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 text-sm text-gray-500">
                Total: {branches.length} sucursales
              </div>
            </div>
          )}

          {/* Tab Listas de Precios */}
          {activeTab === 'priceLists' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Listas de Precios</h3>
                <button
                  onClick={handleSyncPriceLists}
                  disabled={syncingPriceLists || !hasConnection}
                  className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {syncingPriceLists ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Sincronizar
                </button>
              </div>

              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : priceLists.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay listas de precios registradas
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nombre
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Moneda
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Por Defecto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {priceLists.map((priceList) => (
                        <tr key={priceList.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                <ListOrdered size={20} className="text-teal-600" />
                              </div>
                              <span className="font-medium text-gray-900">{priceList.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {priceList.currency || 'ARS'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {priceList.isDefault ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                                Por defecto
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 text-sm text-gray-500">
                Total: {priceLists.length} listas de precios
              </div>
            </div>
          )}

          {/* Tab Puntos de Venta */}
          {activeTab === 'pointsOfSale' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Puntos de Venta</h3>
                <button
                  onClick={openCreatePosModal}
                  className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <Plus size={16} />
                  Nuevo POS
                </button>
              </div>

              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : pointsOfSale.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay puntos de venta configurados. Crea uno para comenzar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Punto de Venta
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Sucursal
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Lista de Precios
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pointsOfSale.map((pos) => (
                        <tr key={pos.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Monitor size={20} className="text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{pos.name}</p>
                                <p className="text-xs text-gray-500">Código: {pos.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Store size={16} className="text-orange-500" />
                              <span className="text-sm text-gray-700">{pos.branch?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {pos.priceList ? (
                              <div className="flex items-center gap-2">
                                <ListOrdered size={16} className="text-teal-500" />
                                <span className="text-sm text-gray-700">{pos.priceList.name}</span>
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                  {pos.priceList.currency}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Sin lista asignada</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                pos.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {pos.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditPosModal(pos)}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeletePos(pos)}
                                disabled={deletingPos === pos.id}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                title="Eliminar"
                              >
                                {deletingPos === pos.id ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 text-sm text-gray-500">
                Total: {pointsOfSale.length} puntos de venta
              </div>
            </div>
          )}

          {/* Tab Categorías */}
          {activeTab === 'categories' && (
            <div>
              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay categorías registradas
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-3 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      style={{ marginLeft: category.parentId ? '2rem' : 0 }}
                    >
                      <FolderTree size={18} className="text-purple-500" />
                      <span className="flex-1 font-medium text-gray-700">{category.name}</span>
                      <span className="text-sm text-gray-500">
                        {category._count?.products || 0} productos
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          category.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {category.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Marcas */}
          {activeTab === 'brands' && (
            <div>
              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : brands.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay marcas registradas
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brands.map((brand) => (
                    <div
                      key={brand.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <Tags className="w-6 h-6 text-indigo-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{brand.name}</h3>
                        <p className="text-sm text-gray-500">
                          {brand._count?.products || 0} productos
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          brand.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {brand.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Productos */}
          {activeTab === 'products' && (
            <div>
              {/* Search */}
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay productos registrados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Marca
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Precio
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Stock
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {products
                        .filter(
                          (p) =>
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            p.sku.toLowerCase().includes(productSearch.toLowerCase())
                        )
                        .map((product) => {
                          const mainPrice = product.prices?.[0]?.price;
                          const totalStock = product.stock?.reduce(
                            (sum, s) => sum + (Number(s.available) || 0),
                            0
                          ) || 0;

                          return (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Package size={20} className="text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{product.name}</p>
                                    {product.barcode && (
                                      <p className="text-sm text-gray-500">{product.barcode}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {product.category?.name || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {product.brand?.name || '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {mainPrice ? (
                                  <span className="flex items-center justify-end gap-1 text-green-600">
                                    <DollarSign size={14} />
                                    {Number(mainPrice).toLocaleString('es-AR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`flex items-center justify-end gap-1 ${
                                    totalStock <= 0
                                      ? 'text-red-600'
                                      : totalStock < 10
                                      ? 'text-amber-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  <Warehouse size={14} />
                                  {totalStock}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    product.isActive
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {product.isActive ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 text-sm text-gray-500">
                Total: {products.length} productos
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Punto de Venta */}
      {showPosModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPos ? 'Editar Punto de Venta' : 'Nuevo Punto de Venta'}
              </h2>
              <button
                onClick={closePosModal}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePos} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sucursal *
                </label>
                <select
                  value={posForm.branchId}
                  onChange={(e) => setPosForm({ ...posForm, branchId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Seleccionar sucursal...</option>
                  {branches.filter(b => b.isActive).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={posForm.code}
                  onChange={(e) => setPosForm({ ...posForm, code: e.target.value })}
                  required
                  placeholder="Ej: CAJA-01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={posForm.name}
                  onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                  required
                  placeholder="Ej: Caja Principal"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={posForm.description}
                  onChange={(e) => setPosForm({ ...posForm, description: e.target.value })}
                  rows={2}
                  placeholder="Descripción opcional..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lista de Precios
                </label>
                <select
                  value={posForm.priceListId || ''}
                  onChange={(e) => setPosForm({ ...posForm, priceListId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Sin lista asignada</option>
                  {priceLists.map((priceList) => (
                    <option key={priceList.id} value={priceList.id}>
                      {priceList.name} ({priceList.currency})
                      {priceList.isDefault ? ' - Por defecto' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Define qué precios se usarán en este punto de venta
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="posIsActive"
                  checked={posForm.isActive}
                  onChange={(e) => setPosForm({ ...posForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="posIsActive" className="text-sm font-medium text-gray-700">
                  Activo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closePosModal}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPos}
                  className="flex-1 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingPos && <RefreshCw size={16} className="animate-spin" />}
                  {editingPos ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
