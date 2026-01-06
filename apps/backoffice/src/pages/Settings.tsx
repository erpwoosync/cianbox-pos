import { useState, useEffect } from 'react';
import { settingsApi, TenantSettings, SurchargeDisplayMode } from '../services/api';
import { Settings as SettingsIcon, RefreshCw, Save, CreditCard } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [surchargeDisplayMode, setSurchargeDisplayMode] = useState<SurchargeDisplayMode>('SEPARATE_ITEM');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setSurchargeDisplayMode(data.surchargeDisplayMode);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await settingsApi.update({ surchargeDisplayMode });
      setSettings(data);
      setHasChanges(false);
      alert('Configuración guardada exitosamente');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error saving settings:', error);
      alert(err.response?.data?.error?.message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (mode: SurchargeDisplayMode) => {
    setSurchargeDisplayMode(mode);
    setHasChanges(mode !== settings?.surchargeDisplayMode);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <div className="flex gap-2">
          <button
            onClick={loadSettings}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar
          </button>
        </div>
      </div>

      {/* Tenant Info */}
      <div className="bg-white rounded-xl shadow-sm mb-6 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <SettingsIcon size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{settings?.name}</h2>
            <p className="text-sm text-gray-500">Slug: {settings?.slug}</p>
          </div>
        </div>
      </div>

      {/* Surcharge Display Mode Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <CreditCard size={20} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recargo Financiero</h3>
            <p className="text-sm text-gray-500">Configuración de visualización en ventas con tarjeta</p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <p className="text-sm text-gray-600 mb-4">
            Cuando el cliente paga con tarjeta de crédito en cuotas, se aplica un recargo financiero.
            Elegí cómo querés que se muestre este recargo en el ticket de venta:
          </p>

          <div className="space-y-3">
            <label className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
              surchargeDisplayMode === 'SEPARATE_ITEM'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="surchargeDisplayMode"
                value="SEPARATE_ITEM"
                checked={surchargeDisplayMode === 'SEPARATE_ITEM'}
                onChange={() => handleModeChange('SEPARATE_ITEM')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Mostrar como ítem separado</div>
                <p className="text-sm text-gray-500 mt-1">
                  Se agrega una línea "Recargo financiero" al ticket con el monto del recargo.
                  El cliente ve claramente cuánto es el recargo por las cuotas.
                </p>
                <div className="mt-3 p-3 bg-white rounded border text-sm font-mono">
                  <div>Producto A ............. $1,000</div>
                  <div>Producto B ............. $500</div>
                  <div className="text-purple-600">Recargo financiero (7%) . $105</div>
                  <div className="border-t mt-1 pt-1 font-bold">Total .................. $1,605</div>
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
              surchargeDisplayMode === 'DISTRIBUTED'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="surchargeDisplayMode"
                value="DISTRIBUTED"
                checked={surchargeDisplayMode === 'DISTRIBUTED'}
                onChange={() => handleModeChange('DISTRIBUTED')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Distribuir en precio de productos</div>
                <p className="text-sm text-gray-500 mt-1">
                  El recargo se suma proporcionalmente al precio de cada producto.
                  No se muestra una línea separada de recargo.
                </p>
                <div className="mt-3 p-3 bg-white rounded border text-sm font-mono">
                  <div>Producto A ............. $1,070</div>
                  <div>Producto B ............. $535</div>
                  <div className="border-t mt-1 pt-1 font-bold">Total .................. $1,605</div>
                </div>
              </div>
            </label>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Esta configuración es el valor por defecto para todos los puntos de venta.
              Podés sobrescribirla en cada punto de venta individual si necesitás un comportamiento diferente.
            </p>
          </div>
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>Hay cambios sin guardar</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}
