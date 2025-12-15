import { useState } from 'react';
import {
  RefreshCw,
  Package,
  Tags,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { cianboxService } from '../services/api';

interface SyncItem {
  id: string;
  name: string;
  icon: React.ElementType;
  lastSync?: string;
  status: 'idle' | 'syncing' | 'success' | 'error';
  count?: number;
}

export default function Sync() {
  const [syncItems, setSyncItems] = useState<SyncItem[]>([
    {
      id: 'products',
      name: 'Productos',
      icon: Package,
      lastSync: undefined,
      status: 'idle',
      count: 0,
    },
    {
      id: 'categories',
      name: 'Categorías',
      icon: Tags,
      lastSync: undefined,
      status: 'idle',
      count: 0,
    },
    {
      id: 'customers',
      name: 'Clientes',
      icon: Users,
      lastSync: undefined,
      status: 'idle',
      count: 0,
    },
  ]);

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const response = await cianboxService.getConnection();
      if (response.success && response.data) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const syncAll = async () => {
    setIsSyncingAll(true);
    setSyncItems((prev) =>
      prev.map((item) => ({ ...item, status: 'syncing' as const }))
    );

    try {
      const response = await cianboxService.syncAll();
      if (response.success) {
        setSyncItems((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'success' as const,
            lastSync: new Date().toISOString(),
          }))
        );
      }
    } catch {
      setSyncItems((prev) =>
        prev.map((item) => ({ ...item, status: 'error' as const }))
      );
    } finally {
      setIsSyncingAll(false);
    }
  };

  const getStatusIcon = (status: SyncItem['status']) => {
    switch (status) {
      case 'syncing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sincronización</h1>
          <p className="text-gray-500">Sincroniza datos con Cianbox ERP</p>
        </div>
        <button
          onClick={syncAll}
          disabled={isSyncingAll || connectionStatus !== 'connected'}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {isSyncingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sincronizar Todo
        </button>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Estado de Conexión</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-100'
                  : connectionStatus === 'checking'
                  ? 'bg-blue-100'
                  : 'bg-red-100'
              }`}
            >
              {connectionStatus === 'checking' ? (
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              ) : connectionStatus === 'connected' ? (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {connectionStatus === 'connected'
                  ? 'Conectado a Cianbox'
                  : connectionStatus === 'checking'
                  ? 'Verificando conexión...'
                  : 'Sin conexión'}
              </p>
              <p className="text-sm text-gray-500">
                {connectionStatus === 'connected'
                  ? 'Los datos se pueden sincronizar'
                  : connectionStatus === 'checking'
                  ? 'Por favor espere'
                  : 'Configure la conexión en Configuración'}
              </p>
            </div>
          </div>
          <button
            onClick={checkConnection}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Verificar
          </button>
        </div>
      </div>

      {/* Sync Items */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Entidades</h2>
        </div>
        <div className="divide-y">
          {syncItems.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {item.lastSync
                      ? `Última sync: ${new Date(item.lastSync).toLocaleString('es-AR')}`
                      : 'Nunca sincronizado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusIcon(item.status)}
                <button
                  disabled={item.status === 'syncing' || connectionStatus !== 'connected'}
                  className="btn btn-secondary btn-sm flex items-center gap-1 disabled:opacity-50"
                >
                  <Play className="w-3 h-3" />
                  Sync
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Información</p>
            <p className="text-sm text-blue-700 mt-1">
              La sincronización descarga los datos desde Cianbox ERP y los actualiza en el
              sistema POS. Los productos, categorías y clientes se actualizarán según los
              cambios realizados en Cianbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
