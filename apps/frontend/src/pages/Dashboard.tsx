import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { salesService } from '../services/api';

interface DailySummary {
  totalSales: number;
  totalAmount: number;
  avgTicket: number;
  totalItems: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DailySummary>({
    totalSales: 0,
    totalAmount: 0,
    avgTicket: 0,
    totalItems: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const response = await salesService.getDailySummary();
      if (response.success) {
        setSummary({
          totalSales: response.data.totalSales || 0,
          totalAmount: response.data.totalAmount || 0,
          avgTicket: response.data.avgTicket || 0,
          totalItems: response.data.totalItems || 0,
        });
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    {
      label: 'Ventas Hoy',
      value: `$${summary.totalAmount.toFixed(2)}`,
      change: '+12%',
      changeType: 'positive',
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
    {
      label: 'Transacciones',
      value: summary.totalSales.toString(),
      change: '+5%',
      changeType: 'positive',
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      label: 'Ticket Promedio',
      value: `$${summary.avgTicket.toFixed(2)}`,
      change: '-2%',
      changeType: 'negative',
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      label: 'Items Vendidos',
      value: summary.totalItems.toString(),
      icon: Package,
      color: 'bg-orange-500',
    },
  ];

  const quickActions = [
    {
      label: 'Abrir POS',
      description: 'Iniciar punto de venta',
      icon: ShoppingCart,
      path: '/pos',
      color: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
      label: 'Productos',
      description: 'Gestionar catálogo',
      icon: Package,
      path: '/productos',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: 'Ventas',
      description: 'Ver historial',
      icon: BarChart3,
      path: '/ventas',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      label: 'Usuarios',
      description: 'Administrar accesos',
      icon: Users,
      path: '/usuarios',
      color: 'bg-orange-600 hover:bg-orange-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Resumen de actividad del día</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
          >
            <div className="flex items-start justify-between">
              <div
                className={`${stat.color} w-10 h-10 rounded-lg flex items-center justify-center`}
              >
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              {stat.change && (
                <span
                  className={`flex items-center text-sm font-medium ${
                    stat.changeType === 'positive'
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}
                >
                  {stat.changeType === 'positive' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : stat.value}
              </p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acceso rápido</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`${action.color} text-white rounded-xl p-5 text-left transition-colors`}
            >
              <action.icon className="w-8 h-8 mb-3" />
              <p className="font-semibold">{action.label}</p>
              <p className="text-sm opacity-80">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main POS Button */}
      <button
        onClick={() => navigate('/pos')}
        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl p-6 shadow-lg flex items-center justify-center gap-4 transition-all"
      >
        <ShoppingCart className="w-10 h-10" />
        <div className="text-left">
          <p className="text-xl font-semibold">Abrir Punto de Venta</p>
          <p className="text-emerald-100">Presiona aquí para iniciar ventas</p>
        </div>
      </button>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Actividad Reciente
        </h2>
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay actividad reciente</p>
          <p className="text-sm">Las últimas ventas aparecerán aquí</p>
        </div>
      </div>
    </div>
  );
}
