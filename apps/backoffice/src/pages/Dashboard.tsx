import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { Package, FolderTree, Tags, AlertTriangle, RefreshCw } from 'lucide-react';

interface DashboardStats {
  products: {
    total: number;
    active: number;
    inactive: number;
  };
  categories: number;
  brands: number;
  stock: {
    lowStock: number;
    outOfStock: number;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const cards = [
    {
      title: 'Productos',
      value: stats?.products?.total || 0,
      subtitle: `${stats?.products?.active || 0} activos`,
      icon: Package,
      color: 'blue',
      link: '/products',
    },
    {
      title: 'Categorías',
      value: stats?.categories || 0,
      icon: FolderTree,
      color: 'purple',
      link: '/categories',
    },
    {
      title: 'Marcas',
      value: stats?.brands || 0,
      icon: Tags,
      color: 'indigo',
      link: '/brands',
    },
    {
      title: 'Stock Bajo',
      value: stats?.stock?.lowStock || 0,
      subtitle: 'productos',
      icon: AlertTriangle,
      color: 'amber',
      link: '/stock?lowStock=true',
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'bg-indigo-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'bg-amber-100' },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const colors = colorClasses[card.color];
          return (
            <Link
              key={card.title}
              to={card.link}
              className={`${colors.bg} rounded-xl p-6 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className={`text-3xl font-bold ${colors.text} mt-2`}>
                    {card.value}
                  </p>
                  {card.subtitle && (
                    <p className="text-sm text-gray-500 mt-1">{card.subtitle}</p>
                  )}
                </div>
                <div className={`${colors.icon} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="space-y-3">
            <Link
              to="/products"
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700">Ver Catálogo de Productos</span>
              </div>
            </Link>
            <Link
              to="/stock?lowStock=true"
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-gray-700">Revisar Stock Bajo</span>
              </div>
            </Link>
            <Link
              to="/prices"
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Tags className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-700">Gestionar Precios</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Los datos de productos, categorías y marcas se sincronizan automáticamente
              desde Cianbox.
            </p>
            <p>
              Puedes consultar precios y stock, pero las modificaciones deben realizarse
              en Cianbox para mantener la sincronización.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
