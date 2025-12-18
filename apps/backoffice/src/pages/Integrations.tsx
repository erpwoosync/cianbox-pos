import { useState, useEffect } from 'react';
import { mercadoPagoApi, MercadoPagoConfig, MercadoPagoDevice, SaveMercadoPagoConfigDto } from '../services/api';
import { RefreshCw, Plug, Eye, EyeOff, CheckCircle, XCircle, Smartphone, Copy, ExternalLink } from 'lucide-react';

export default function Integrations() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig | null>(null);
  const [mpDevices, setMpDevices] = useState<MercadoPagoDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Form state
  const [formData, setFormData] = useState<SaveMercadoPagoConfigDto>({
    accessToken: '',
    publicKey: '',
    userId: '',
    webhookSecret: '',
    environment: 'production',
    isActive: true,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await mercadoPagoApi.getConfig();
      if (config) {
        setMpConfig(config);
        setFormData({
          accessToken: '', // No mostrar token existente por seguridad
          publicKey: config.publicKey || '',
          userId: config.userId || '',
          webhookSecret: '',
          environment: config.environment as 'sandbox' | 'production' || 'production',
          isActive: config.isActive,
        });

        // Cargar dispositivos si está configurado
        if (config.isActive) {
          loadDevices();
        }
      }
    } catch (error) {
      console.error('Error loading MP config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const devices = await mercadoPagoApi.listDevices();
      setMpDevices(devices);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.accessToken && !mpConfig) {
      alert('El Access Token es requerido');
      return;
    }

    setSaving(true);
    try {
      const dataToSave: SaveMercadoPagoConfigDto = {
        ...formData,
      };

      // Solo enviar accessToken si se proporcionó uno nuevo
      if (!formData.accessToken) {
        delete (dataToSave as Partial<SaveMercadoPagoConfigDto>).accessToken;
      }
      if (!formData.webhookSecret) {
        delete (dataToSave as Partial<SaveMercadoPagoConfigDto>).webhookSecret;
      }

      await mercadoPagoApi.saveConfig(dataToSave);
      await loadConfig();
      alert('Configuración guardada correctamente');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error saving config:', error);
      alert(err.response?.data?.error?.message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    const baseUrl = window.location.origin.replace('backoffice', 'api');
    const webhookUrl = `${baseUrl}/api/webhooks/mercadopago`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integraciones</h1>
      </div>

      {/* Mercado Pago Section */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plug size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mercado Pago Point</h2>
              <p className="text-sm text-gray-500">Terminal de cobro con tarjeta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mpConfig?.isActive ? (
              <span className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full">
                <CheckCircle size={14} />
                Conectado
              </span>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-500 bg-gray-100 rounded-full">
                <XCircle size={14} />
                No configurado
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Access Token */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token *
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                  placeholder={mpConfig ? '••••••••••••••••••••••••••••••••' : 'APP_USR-xxxxxx...'}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Obtén tu Access Token en{' '}
                <a
                  href="https://www.mercadopago.com.ar/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Panel de desarrolladores de Mercado Pago
                  <ExternalLink size={12} />
                </a>
                {mpConfig && ' (Dejar vacío para mantener el actual)'}
              </p>
            </div>

            {/* Public Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Public Key
              </label>
              <input
                type="text"
                value={formData.publicKey}
                onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
                placeholder="APP_USR-xxxxxx..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
              />
            </div>

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID (opcional)
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                placeholder="123456789"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook Secret
              </label>
              <input
                type="password"
                value={formData.webhookSecret}
                onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
                placeholder={mpConfig ? '••••••••••••' : 'Secret para validar webhooks'}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                {mpConfig && 'Dejar vacío para mantener el actual'}
              </p>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ambiente
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="environment"
                    value="production"
                    checked={formData.environment === 'production'}
                    onChange={() => setFormData({ ...formData, environment: 'production' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Producción</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="environment"
                    value="sandbox"
                    checked={formData.environment === 'sandbox'}
                    onChange={() => setFormData({ ...formData, environment: 'sandbox' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Sandbox (pruebas)</span>
                </label>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mpActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="mpActive" className="text-sm font-medium text-gray-700">
                Integración activa
              </label>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL de Webhook (configura esto en tu panel de Mercado Pago)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm font-mono text-gray-600 truncate">
                {window.location.origin.replace('backoffice', 'api')}/api/webhooks/mercadopago
              </code>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="px-3 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy size={16} />
                {copiedWebhook ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <RefreshCw size={16} className="animate-spin" />}
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>

      {/* Dispositivos MP Point */}
      {mpConfig?.isActive && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Smartphone size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dispositivos Point Detectados</h2>
                <p className="text-sm text-gray-500">
                  Terminales disponibles para asociar a puntos de venta
                </p>
              </div>
            </div>
            <button
              onClick={loadDevices}
              disabled={loadingDevices}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw size={18} className={loadingDevices ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          <div className="p-4">
            {loadingDevices ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : mpDevices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Smartphone size={48} className="mx-auto mb-3 text-gray-300" />
                <p>No se encontraron dispositivos Point</p>
                <p className="text-sm mt-1">
                  Asegúrate de tener dispositivos vinculados a tu cuenta de Mercado Pago
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mpDevices.map((device) => (
                  <div
                    key={device.id}
                    className="p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Smartphone size={24} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{device.operating_mode}</p>
                        <p className="text-sm text-gray-500 font-mono">
                          ...{device.id.slice(-12)}
                        </p>
                      </div>
                    </div>
                    {device.external_pos_id && (
                      <p className="mt-2 text-xs text-gray-400">
                        POS ID: {device.external_pos_id}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Para asociar un dispositivo a un punto de venta, ve a{' '}
                <a href="/points-of-sale" className="text-blue-600 hover:underline">
                  Puntos de Venta
                </a>{' '}
                y edita el POS deseado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
