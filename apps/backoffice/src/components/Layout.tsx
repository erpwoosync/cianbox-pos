import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderTree,
  Tags,
  Package,
  DollarSign,
  Warehouse,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Store,
  ListOrdered,
  Monitor,
  Shield,
  Users,
  UserCircle,
  Building2,
  ShoppingCart,
  Gift,
  Plug,
  Banknote,
  AlertTriangle,
  Laptop,
  Settings,
  Boxes,
  Receipt,
  FileText,
  LucideIcon,
} from 'lucide-react';

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    id: 'config',
    label: 'Configuración',
    icon: Settings,
    items: [
      { path: '/branches', label: 'Sucursales', icon: Store },
      { path: '/price-lists', label: 'Listas de Precio', icon: ListOrdered },
      { path: '/points-of-sale', label: 'Puntos de Venta', icon: Monitor },
      { path: '/terminals', label: 'Terminales POS', icon: Laptop },
    ],
  },
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: Boxes,
    items: [
      { path: '/categories', label: 'Categorías', icon: FolderTree },
      { path: '/brands', label: 'Marcas', icon: Tags },
      { path: '/products', label: 'Productos', icon: Package },
      { path: '/prices', label: 'Precios', icon: DollarSign },
      { path: '/stock', label: 'Stock', icon: Warehouse },
      { path: '/promotions', label: 'Promociones', icon: Gift },
    ],
  },
  {
    id: 'sales',
    label: 'Ventas',
    icon: Receipt,
    items: [
      { path: '/sales', label: 'Ventas', icon: ShoppingCart },
      { path: '/customers', label: 'Clientes', icon: UserCircle },
      { path: '/orphan-payments', label: 'Pagos Huérfanos', icon: AlertTriangle },
      { path: '/cash-sessions', label: 'Caja', icon: Banknote },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: Shield,
    items: [
      { path: '/roles', label: 'Roles', icon: Shield },
      { path: '/users', label: 'Usuarios', icon: Users },
      { path: '/integrations', label: 'Integraciones', icon: Plug },
      { path: '/afip', label: 'Facturación AFIP', icon: FileText },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Auto-expand the group containing the active route
  useEffect(() => {
    const activeGroup = menuGroups.find(group =>
      group.items.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
    );
    if (activeGroup && !expandedGroups.includes(activeGroup.id)) {
      setExpandedGroups(prev => [...prev, activeGroup.id]);
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isGroupActive = (group: MenuGroup) => {
    return group.items.some(item =>
      location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 w-64 h-full bg-white shadow-lg transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col border-b">
          <div className="flex items-center justify-between h-16 px-4">
            <Link to="/" className="flex items-center gap-2">
              <Package className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-800">Backoffice</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          {/* Tenant indicator */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <Building2 size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700 truncate">
                {tenant?.name || user?.tenantName || 'Sin tenant'}
              </span>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {/* Dashboard - siempre visible */}
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === '/'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>

          {/* Grupos colapsables */}
          {menuGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups.includes(group.id);
            const groupActive = isGroupActive(group);

            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    groupActive
                      ? 'text-blue-600 bg-blue-50/50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon size={20} />
                    <span className="font-medium">{group.label}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2 ml-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon size={18} />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu size={24} />
            </button>

            {/* Tenant name visible in header on mobile */}
            <div className="lg:hidden flex items-center gap-2 ml-2">
              <Building2 size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
                {tenant?.name || user?.tenantName}
              </span>
            </div>

            <div className="flex-1" />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={18} className="text-blue-600" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {user?.name}
                </span>
                <ChevronDown size={16} className="text-gray-500" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20">
                    <div className="p-3 border-b">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={16} />
                      Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
