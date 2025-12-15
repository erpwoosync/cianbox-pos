import { ReactNode, useState } from 'react';
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
  User,
  Store,
  ListOrdered,
  Monitor,
  Shield,
  Users,
  Building2,
} from 'lucide-react';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/branches', label: 'Sucursales', icon: Store },
  { path: '/price-lists', label: 'Listas de Precio', icon: ListOrdered },
  { path: '/points-of-sale', label: 'Puntos de Venta', icon: Monitor },
  { path: '/categories', label: 'Categorias', icon: FolderTree },
  { path: '/brands', label: 'Marcas', icon: Tags },
  { path: '/products', label: 'Productos', icon: Package },
  { path: '/prices', label: 'Precios', icon: DollarSign },
  { path: '/stock', label: 'Stock', icon: Warehouse },
  { path: '/roles', label: 'Roles', icon: Shield },
  { path: '/users', label: 'Usuarios', icon: Users },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
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
