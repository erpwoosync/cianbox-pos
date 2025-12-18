import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mercadoPagoApi, MercadoPagoConfig, MercadoPagoDevice, MercadoPagoAppType } from '../services/api';
import { RefreshCw, CheckCircle, XCircle, Smartphone, ExternalLink, Link2, Unlink, AlertTriangle, CreditCard, QrCode } from 'lucide-react';

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connectingPoint, setConnectingPoint] = useState(false);
  const [connectingQr, setConnectingQr] = useState(false);
  const [disconnectingPoint, setDisconnectingPoint] = useState(false);
  const [disconnectingQr, setDisconnectingQr] = useState(false);
  const [refreshingPointToken, setRefreshingPointToken] = useState(false);
  const [refreshingQrToken, setRefreshingQrToken] = useState(false);
  const [pointConfig, setPointConfig] = useState<MercadoPagoConfig | null>(null);
  const [qrConfig, setQrConfig] = useState<MercadoPagoConfig | null>(null);
  const [isPointConnected, setIsPointConnected] = useState(false);
  const [isQrConnected, setIsQrConnected] = useState(false);
  const [mpDevices, setMpDevices] = useState<MercadoPagoDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Check for OAuth callback params
    const mpSuccess = searchParams.get('mp_success');
    const mpError = searchParams.get('mp_error');
    const mpApp = searchParams.get('mp_app');

    if (mpSuccess === 'true') {
      const appName = mpApp === 'QR' ? 'QR' : 'Point';
      setNotification({ type: 'success', message: `Cuenta de Mercado Pago ${appName} vinculada exitosamente` });
      // Clear params
      searchParams.delete('mp_success');
      searchParams.delete('mp_app');
      setSearchParams(searchParams);
    } else if (mpError) {
      setNotification({ type: 'error', message: `Error: ${mpError}` });
      // Clear params
      searchParams.delete('mp_error');
      setSearchParams(searchParams);
    }

    loadConfig();
  }, []);

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const result = await mercadoPagoApi.getConfig();
      setPointConfig(result.data.point);
      setQrConfig(result.data.qr);
      setIsPointConnected(result.isPointConnected);
      setIsQrConnected(result.isQrConnected);

      // Load devices if Point is connected
      if (result.isPointConnected) {
        loadDevices();
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

  const handleConnect = async (appType: MercadoPagoAppType) => {
    const setConnecting = appType === 'POINT' ? setConnectingPoint : setConnectingQr;
    setConnecting(true);
    try {
      const authUrl = await mercadoPagoApi.getAuthorizationUrl(appType);
      // Redirect to MP authorization page
      window.location.href = authUrl;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error('Error getting auth URL:', error);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Error al obtener URL de autorización',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async (appType: MercadoPagoAppType) => {
    const appName = appType === 'POINT' ? 'Point' : 'QR';
    if (!confirm(`Esta acción desvinculará tu cuenta de Mercado Pago ${appName}. ¿Continuar?`)) {
      return;
    }

    const setDisconnecting = appType === 'POINT' ? setDisconnectingPoint : setDisconnectingQr;
    setDisconnecting(true);
    try {
      await mercadoPagoApi.disconnect(appType);
      if (appType === 'POINT') {
        setPointConfig(null);
        setIsPointConnected(false);
        setMpDevices([]);
      } else {
        setQrConfig(null);
        setIsQrConnected(false);
      }
      setNotification({ type: 'success', message: `Cuenta de Mercado Pago ${appName} desvinculada` });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error('Error disconnecting:', error);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Error al desvincular cuenta',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefreshToken = async (appType: MercadoPagoAppType) => {
    const setRefreshing = appType === 'POINT' ? setRefreshingPointToken : setRefreshingQrToken;
    setRefreshing(true);
    try {
      await mercadoPagoApi.refreshToken(appType);
      await loadConfig();
      setNotification({ type: 'success', message: `Token de ${appType} renovado exitosamente` });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error('Error refreshing token:', error);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Error al renovar token',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Component for integration card
  const IntegrationCard = ({
    title,
    description,
    icon: Icon,
    iconColor,
    iconBg,
    appType,
    config,
    isConnected,
    connecting,
    disconnecting,
    refreshingToken,
  }: {
    title: string;
    description: string;
    icon: typeof CreditCard;
    iconColor: string;
    iconBg: string;
    appType: MercadoPagoAppType;
    config: MercadoPagoConfig | null;
    isConnected: boolean;
    connecting: boolean;
    disconnecting: boolean;
    refreshingToken: boolean;
  }) => (
    <div className="bg-white rounded-xl shadow-sm mb-6">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
            <Icon size={24} className={iconColor} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full">
              <CheckCircle size={14} />
              Conectado
            </span>
          ) : (
            <span className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-500 bg-gray-100 rounded-full">
              <XCircle size={14} />
              No conectado
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {isConnected && config ? (
          // Connected state
          <div className="space-y-6">
            {/* Token expiring warning */}
            {config.isTokenExpiringSoon && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-yellow-800">Token próximo a expirar</p>
                  <p className="text-sm text-yellow-700">
                    Tu conexión con Mercado Pago expirará pronto. Renovar el token para mantener la integración activa.
                  </p>
                  <button
                    onClick={() => handleRefreshToken(appType)}
                    disabled={refreshingToken}
                    className="mt-2 px-4 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {refreshingToken && <RefreshCw size={14} className="animate-spin" />}
                    Renovar Token
                  </button>
                </div>
              </div>
            )}

            {/* Account info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Usuario MP</p>
                <p className="font-medium text-gray-900">{config.mpUserId || '-'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Permisos</p>
                <p className="font-medium text-gray-900 text-sm">{config.scope || 'read write offline_access'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Conectado desde</p>
                <p className="font-medium text-gray-900">{formatDate(config.createdAt)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Token expira</p>
                <p className="font-medium text-gray-900">{formatDate(config.tokenExpiresAt)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <button
                onClick={() => handleRefreshToken(appType)}
                disabled={refreshingToken}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
              >
                {refreshingToken ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Renovar Token
              </button>
              <button
                onClick={() => handleDisconnect(appType)}
                disabled={disconnecting}
                className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2"
              >
                {disconnecting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Unlink size={16} />
                )}
                Desvincular Cuenta
              </button>
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="text-center py-8">
            <div className={`w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Link2 size={32} className={iconColor} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Vincula tu cuenta de Mercado Pago ({appType === 'POINT' ? 'Point' : 'QR'})
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {appType === 'POINT'
                ? 'Conecta tu cuenta para poder cobrar con terminales Point desde tus puntos de venta.'
                : 'Conecta tu cuenta para generar códigos QR de cobro desde tus puntos de venta.'}
              {' '}Serás redirigido a Mercado Pago para autorizar la conexión.
            </p>
            <button
              onClick={() => handleConnect(appType)}
              disabled={connecting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {connecting ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <ExternalLink size={18} />
              )}
              Conectar con Mercado Pago
            </button>
            <p className="text-xs text-gray-400 mt-4">
              Al conectar, autorizas a esta aplicación a acceder a tu cuenta de Mercado Pago.
            </p>
          </div>
        )}
      </div>
    </div>
  );

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

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <XCircle size={20} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Mercado Pago Point Section */}
      <IntegrationCard
        title="Mercado Pago Point"
        description="Terminal de cobro con tarjeta de crédito y débito"
        icon={CreditCard}
        iconColor="text-blue-600"
        iconBg="bg-blue-100"
        appType="POINT"
        config={pointConfig}
        isConnected={isPointConnected}
        connecting={connectingPoint}
        disconnecting={disconnectingPoint}
        refreshingToken={refreshingPointToken}
      />

      {/* Mercado Pago QR Section */}
      <IntegrationCard
        title="Mercado Pago QR"
        description="Cobro mediante código QR con billetera virtual"
        icon={QrCode}
        iconColor="text-purple-600"
        iconBg="bg-purple-100"
        appType="QR"
        config={qrConfig}
        isConnected={isQrConnected}
        connecting={connectingQr}
        disconnecting={disconnectingQr}
        refreshingToken={refreshingQrToken}
      />

      {/* Devices Section - Only show if Point is connected */}
      {isPointConnected && (
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
