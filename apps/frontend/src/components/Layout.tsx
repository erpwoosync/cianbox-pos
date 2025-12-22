import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  Tags,
  ShoppingCart,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Store,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, permissions: [] }, // Todos ven dashboard
  { name: 'Punto de Venta', href: '/pos', icon: ShoppingCart, permissions: ['pos:sell'] },
  { name: 'Consulta de Productos', href: '/consulta-productos', icon: Search, permissions: ['pos:sell', 'inventory:view', 'inventory:edit'] },
  { name: 'Productos', href: '/productos', icon: Package, permissions: ['admin:products', 'inventory:view', 'inventory:edit'] },
  { name: 'Categorías', href: '/categorias', icon: Tags, permissions: ['admin:products', 'inventory:view', 'inventory:edit'] },
  { name: 'Usuarios', href: '/usuarios', icon: Users, permissions: ['admin:users'] },
  { name: 'Ventas', href: '/ventas', icon: BarChart3, permissions: ['reports:sales', 'pos:view_reports'] },
  { name: 'Sincronización', href: '/sync', icon: RefreshCw, permissions: ['admin:settings'] },
  { name: 'Configuración', href: '/configuracion', icon: Settings, permissions: ['admin:settings'] },
];

// Helper para verificar si el usuario tiene alguno de los permisos requeridos
const hasAnyPermission = (userPermissions: string[], requiredPermissions: string[]): boolean => {
  // Si no hay permisos requeridos, todos tienen acceso
  if (requiredPermissions.length === 0) return true;
  // Si el usuario tiene '*', tiene acceso a todo
  if (userPermissions.includes('*')) return true;
  // Verificar si tiene alguno de los permisos requeridos
  return requiredPermissions.some(perm => userPermissions.includes(perm));
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, tenant, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold">Cianbox POS</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tenant info */}
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Tenant</p>
          <p className="text-white font-medium truncate">{tenant?.name}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation
            .filter((item) => hasAnyPermission(user?.role?.permissions || [], item.permissions))
            .map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-700 p-4">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-slate-400 text-xs truncate">{user?.role?.name}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 rounded-lg shadow-lg py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.branch?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
