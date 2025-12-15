import { useEffect, useState } from 'react';
import { Building2, Database, Users, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { dashboardApi } from '../services/api';

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalDbServers: number;
  totalUsers: number;
  recentSyncs: SyncInfo[];
}

interface SyncInfo {
  tenantId: string;
  tenantName: string;
  lastSync: string;
  status: 'success' | 'failed' | 'pending';
  productsCount: number;
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
      // Mock data for development
      setStats({
        totalTenants: 5,
        activeTenants: 4,
        totalDbServers: 2,
        totalUsers: 3,
        recentSyncs: [
          {
            tenantId: '1',
            tenantName: 'Demo Store',
            lastSync: new Date().toISOString(),
            status: 'success',
            productsCount: 150,
          },
        ],
      });
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

  const statCards = [
    {
      title: 'Total Tenants',
      value: stats?.totalTenants || 0,
      subtitle: `${stats?.activeTenants || 0} activos`,
      icon: Building2,
      color: 'bg-blue-500',
    },
    {
      title: 'DB Servers',
      value: stats?.totalDbServers || 0,
      subtitle: 'Servidores configurados',
      icon: Database,
      color: 'bg-green-500',
    },
    {
      title: 'Usuarios Agency',
      value: stats?.totalUsers || 0,
      subtitle: 'Administradores',
      icon: Users,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Vista general del sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-400">{card.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Syncs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Sincronizaciones Recientes
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {stats?.recentSyncs && stats.recentSyncs.length > 0 ? (
            stats.recentSyncs.map((sync) => (
              <div key={sync.tenantId} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {sync.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{sync.tenantName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(sync.lastSync).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {sync.productsCount} productos
                  </p>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      sync.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {sync.status === 'success' ? 'Exitoso' : 'Fallido'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              No hay sincronizaciones recientes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
