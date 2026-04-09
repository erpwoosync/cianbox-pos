import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Printer,
  CreditCard,
  Bell,
  Shield,
  Save,
  Link,
  Zap,
  ArrowRight,
  Tags,
} from 'lucide-react';
import { categoriesService } from '../services/api';
import { useAuthStore } from '../context/authStore';
import { useQzPrinter } from '../hooks/useQzPrinter';

type TabId = 'general' | 'cianbox' | 'pos' | 'notifications';

interface QuickAccessCategory {
  id: string;
  name: string;
  quickAccessColor?: string | null;
  _count?: { products: number };
}

export default function Settings() {
  const { tenant } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [quickAccessCategories, setQuickAccessCategories] = useState<QuickAccessCategory[]>([]);
  const { connected: qzConnected, connecting: qzConnecting, printers: qzPrinters, selectedPrinter, error: qzError, connect: qzConnect, selectPrinter } = useQzPrinter();

  useEffect(() => {
    loadQuickAccessCategories();
  }, []);

  const loadQuickAccessCategories = async () => {
    try {
      const response = await categoriesService.getQuickAccess();
      if (response.success) {
        setQuickAccessCategories(response.data);
      }
    } catch (error) {
      console.error('Error loading quick access categories:', error);
    }
  };

  const tabs = [
    { id: 'general' as const, name: 'General', icon: Store },
    { id: 'cianbox' as const, name: 'Cianbox', icon: Link },
    { id: 'pos' as const, name: 'Punto de Venta', icon: CreditCard },
    { id: 'notifications' as const, name: 'Notificaciones', icon: Bell },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500">Ajustes del sistema</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="border-b">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Información del Negocio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del negocio
                    </label>
                    <input
                      type="text"
                      defaultValue={tenant?.name}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identificador (slug)
                    </label>
                    <input
                      type="text"
                      defaultValue={tenant?.slug}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CUIT/RUT
                    </label>
                    <input
                      type="text"
                      placeholder="30-12345678-9"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moneda
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                      <option value="ARS">ARS - Peso Argentino</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Ticket de Venta</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Encabezado del ticket
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Nombre del negocio&#10;Dirección&#10;Teléfono"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pie del ticket
                    </label>
                    <textarea
                      rows={2}
                      placeholder="¡Gracias por su compra!"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cianbox' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Conexión Cianbox ERP</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuenta
                    </label>
                    <input
                      type="text"
                      placeholder="mi-cuenta"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL: https://[cuenta].cianbox.com
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de App
                    </label>
                    <input
                      type="text"
                      placeholder="CianboxPOS"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código de App
                    </label>
                    <input
                      type="text"
                      placeholder="APP_CODE"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usuario
                    </label>
                    <input
                      type="text"
                      placeholder="usuario_api"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <button className="mt-4 btn btn-secondary">
                  Probar conexión
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pos' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Configuración del POS</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-gray-700">Imprimir ticket automáticamente</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-gray-700">Abrir cajón de dinero al cobrar</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-gray-700">Permitir venta con stock negativo</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-gray-700">Requerir cliente en cada venta</span>
                  </label>
                </div>
              </div>

              {/* Quick Access Categories */}
              <div>
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Categorías de Acceso Rápido
                </h3>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    Configura las categorías que aparecerán como botones destacados en el POS para acceso rápido a los productos más vendidos.
                  </p>

                  {quickAccessCategories.length > 0 ? (
                    <div className="mb-4">
                      <p className="text-xs text-amber-700 mb-2 font-medium">Categorías configuradas:</p>
                      <div className="flex flex-wrap gap-2">
                        {quickAccessCategories.slice(0, 5).map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border"
                            style={{
                              borderColor: cat.quickAccessColor || '#3b82f6',
                              color: cat.quickAccessColor || '#3b82f6',
                              backgroundColor: `${cat.quickAccessColor || '#3b82f6'}10`,
                            }}
                          >
                            <Tags className="w-3 h-3" />
                            {cat.name}
                          </span>
                        ))}
                        {quickAccessCategories.length > 5 && (
                          <span className="text-xs text-amber-600">
                            +{quickAccessCategories.length - 5} más
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600 mb-3">
                      No hay categorías de acceso rápido configuradas.
                    </p>
                  )}

                  <button
                    onClick={() => navigate('/categorias')}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Configurar Acceso Rápido
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Printer className="w-5 h-5" />
                  Impresoras
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${qzConnected ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-sm text-gray-600">
                        QZ Tray: {qzConnected ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                    {!qzConnected && (
                      <button
                        onClick={qzConnect}
                        disabled={qzConnecting}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {qzConnecting ? 'Conectando...' : 'Conectar'}
                      </button>
                    )}
                  </div>
                  {qzError && (
                    <p className="text-sm text-red-600">{qzError}</p>
                  )}
                  {qzConnected && qzPrinters.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Impresora de tickets</label>
                      <select
                        value={selectedPrinter || ''}
                        onChange={(e) => selectPrinter(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Seleccionar impresora...</option>
                        {qzPrinters.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        La impresora seleccionada se guardará para este navegador
                      </p>
                    </div>
                  )}
                  {qzConnected && qzPrinters.length === 0 && (
                    <p className="text-sm text-gray-500">No se encontraron impresoras</p>
                  )}
                  {!qzConnected && !qzError && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Para impresión directa, instalá <strong>QZ Tray</strong> en esta computadora.
                      </p>
                      <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        Descargar QZ Tray
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Notificaciones</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Stock bajo</p>
                      <p className="text-sm text-gray-500">
                        Recibir alerta cuando un producto tenga stock bajo
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Ventas diarias</p>
                      <p className="text-sm text-gray-500">
                        Resumen de ventas al final del día
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Sincronización</p>
                      <p className="text-sm text-gray-500">
                        Notificar cuando falle la sincronización con Cianbox
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security info */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">Seguridad</p>
            <p className="text-sm text-gray-600 mt-1">
              Las credenciales de Cianbox se almacenan de forma segura y encriptada.
              Solo los administradores pueden modificar la configuración del sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
