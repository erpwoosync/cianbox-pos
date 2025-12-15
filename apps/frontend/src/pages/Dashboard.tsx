import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  BarChart3,
  Package,
  Users,
  Settings,
  LogOut,
  RefreshCw,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const stats = [
    {
      label: 'Ventas Hoy',
      value: '$0.00',
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      label: 'Transacciones',
      value: '0',
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      label: 'Ticket Promedio',
      value: '$0.00',
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      label: 'Productos',
      value: '0',
      icon: Package,
      color: 'bg-orange-500',
    },
  ];

  const menuItems = [
    {
      label: 'Punto de Venta',
      description: 'Registrar ventas',
      icon: ShoppingCart,
      path: '/pos',
      color: 'bg-primary-500',
    },
    {
      label: 'Productos',
      description: 'Gestionar catálogo',
      icon: Package,
      path: '/products',
      color: 'bg-green-500',
    },
    {
      label: 'Reportes',
      description: 'Ver estadísticas',
      icon: BarChart3,
      path: '/reports',
      color: 'bg-purple-500',
    },
    {
      label: 'Clientes',
      description: 'Base de clientes',
      icon: Users,
      path: '/customers',
      color: 'bg-orange-500',
    },
    {
      label: 'Sincronizar',
      description: 'Sync con Cianbox',
      icon: RefreshCw,
      path: '/sync',
      color: 'bg-cyan-500',
    },
    {
      label: 'Configuración',
      description: 'Ajustes del sistema',
      icon: Settings,
      path: '/settings',
      color: 'bg-gray-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo y Tenant */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {tenant?.name || 'Cianbox POS'}
                </h1>
                <p className="text-xs text-gray-500">
                  {user?.branch?.name || 'Sin sucursal asignada'}
                </p>
              </div>
            </div>

            {/* Usuario y Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`${stat.color} w-10 h-10 rounded-lg flex items-center justify-center`}
                >
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Menu Grid */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Acceso rápido
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-gray-200 transition-all group"
            >
              <div
                className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900">{item.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
            </button>
          ))}
        </div>

        {/* Acceso rápido POS */}
        <div className="mt-8">
          <button
            onClick={() => navigate('/pos')}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl p-6 shadow-lg flex items-center justify-center gap-3 transition-colors"
          >
            <ShoppingCart className="w-8 h-8" />
            <div className="text-left">
              <p className="text-xl font-semibold">Abrir Punto de Venta</p>
              <p className="text-primary-200 text-sm">
                Presiona aquí o usa el atajo F2
              </p>
            </div>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-gray-500">
        Cianbox POS v1.0.0 &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
