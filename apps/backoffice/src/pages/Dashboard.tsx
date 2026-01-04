import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import {
  Package,
  FolderTree,
  Tags,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  DollarSign,
  UserCircle,
  Store,
  Monitor,
  Gift,
  Users,
  TrendingUp,
  Calendar,
  Clock,
} from 'lucide-react';

interface RecentSale {
  id: string;
  saleNumber: string;
  total: number;
  status: string;
  createdAt: string;
  customerName: string;
  pointOfSale?: string;
}

interface DashboardStats {
  products: {
    total: number;
    active: number;
    inactive: number;
    withVariants: number;
  };
  categories: number;
  brands: number;
  stock: {
    lowStock: number;
    outOfStock: number;
  };
  branches: number;
  pointsOfSale: number;
  customers: {
    total: number;
    active: number;
  };
  promotions: {
    active: number;
  };
  users: number;
  sales: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
    todayAmount: number;
    thisWeekAmount: number;
    thisMonthAmount: number;
  };
  recentSales: RecentSale[];
}

// Funciones de formato estables (fuera del componente para evitar recreación)
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusStyles: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  COMPLETED: 'Completada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Memoizar datos procesados de ventas recientes
  const recentSalesData = useMemo(() => {
    if (!stats?.recentSales) return [];
    return stats.recentSales.map(sale => ({
      ...sale,
      badgeStyle: statusStyles[sale.status] || 'bg-gray-100 text-gray-700',
      badgeLabel: statusLabels[sale.status] || sale.status,
      formattedTotal: formatCurrency(sale.total),
      formattedDate: formatDate(sale.createdAt),
    }));
  }, [stats?.recentSales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Ventas del día - Destacado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Ventas Hoy</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.sales?.todayAmount || 0)}</p>
              <p className="text-green-100 text-sm mt-1">{stats?.sales?.today || 0} operaciones</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Ventas Semana</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.sales?.thisWeekAmount || 0)}</p>
              <p className="text-blue-100 text-sm mt-1">{stats?.sales?.thisWeek || 0} operaciones</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Calendar className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Ventas Mes</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.sales?.thisMonthAmount || 0)}</p>
              <p className="text-purple-100 text-sm mt-1">{stats?.sales?.thisMonth || 0} operaciones</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Link to="/sales" className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingCart size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.sales?.total || 0}</p>
              <p className="text-xs text-gray-500">Ventas Total</p>
            </div>
          </div>
        </Link>

        <Link to="/products" className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.products?.total || 0}</p>
              <p className="text-xs text-gray-500">Productos</p>
            </div>
          </div>
        </Link>

        <Link to="/customers" className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <UserCircle size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.customers?.total || 0}</p>
              <p className="text-xs text-gray-500">Clientes</p>
            </div>
          </div>
        </Link>

        <Link to="/branches" className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Store size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.branches || 0}</p>
              <p className="text-xs text-gray-500">Sucursales</p>
            </div>
          </div>
        </Link>

        <Link to="/points-of-sale" className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <Monitor size={20} className="text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.pointsOfSale || 0}</p>
              <p className="text-xs text-gray-500">Puntos Venta</p>
            </div>
          </div>
        </Link>

        <Link to="/promotions" className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
              <Gift size={20} className="text-pink-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.promotions?.active || 0}</p>
              <p className="text-xs text-gray-500">Promos Activas</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Catálogo y Alertas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link to="/categories" className="bg-purple-50 rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FolderTree size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats?.categories || 0}</p>
              <p className="text-xs text-gray-500">Categorías</p>
            </div>
          </div>
        </Link>

        <Link to="/brands" className="bg-indigo-50 rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Tags size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{stats?.brands || 0}</p>
              <p className="text-xs text-gray-500">Marcas</p>
            </div>
          </div>
        </Link>

        <Link to="/stock" className="bg-amber-50 rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats?.stock?.lowStock || 0}</p>
              <p className="text-xs text-gray-500">Stock Bajo</p>
            </div>
          </div>
        </Link>

        <Link to="/stock" className="bg-red-50 rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats?.stock?.outOfStock || 0}</p>
              <p className="text-xs text-gray-500">Sin Stock</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Últimas Ventas y Usuarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas Ventas */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Últimas Ventas</h2>
            <Link to="/sales" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
          </div>
          {recentSalesData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nro</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentSalesData.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/sales/${sale.id}`} className="font-mono text-sm text-blue-600 hover:underline">
                          {sale.saleNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.customerName}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {sale.formattedTotal}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${sale.badgeStyle}`}>
                          {sale.badgeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {sale.formattedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay ventas recientes
            </div>
          )}
        </div>

        {/* Panel derecho */}
        <div className="space-y-6">
          {/* Pendientes */}
          {(stats?.sales?.pending || 0) > 0 && (
            <Link to="/sales?status=PENDING" className="block bg-yellow-50 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock size={24} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-600">{stats?.sales?.pending}</p>
                  <p className="text-sm text-gray-600">Ventas Pendientes</p>
                </div>
              </div>
            </Link>
          )}

          {/* Usuarios */}
          <Link to="/users" className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Users size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats?.users || 0}</p>
                <p className="text-sm text-gray-600">Usuarios</p>
              </div>
            </div>
          </Link>

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Información</h3>
            <p className="text-sm text-blue-700">
              Los datos se sincronizan automáticamente desde Cianbox. Las modificaciones deben realizarse en Cianbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
