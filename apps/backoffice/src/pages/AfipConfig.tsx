import { useState, useEffect } from 'react';
import { afipApi, AfipConfig, AfipSalesPoint, AfipInvoice, AfipConstants, pointsOfSaleApi } from '../services/api';
import {
  FileText,
  Plus,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  Eye,
  Trash2,
  Settings,
  Receipt,
  QrCode,
  ExternalLink,
  Download,
  Key,
  Loader2
} from 'lucide-react';

type Tab = 'config' | 'salesPoints' | 'invoices';

interface AfipConfigForm extends Partial<AfipConfig> {
  afipAccessToken?: string;
}

interface SystemPOS {
  id: string;
  code: string;
  name: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export default function AfipConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Config state
  const [configured, setConfigured] = useState(false);
  const [config, setConfig] = useState<AfipConfigForm>({
    cuit: '',
    businessName: '',
    tradeName: '',
    taxCategory: 'RESPONSABLE_INSCRIPTO',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    isProduction: false,
    isActive: true,
    afipAccessToken: '',
  });
  const [constants, setConstants] = useState<AfipConstants | null>(null);

  // Sales Points state
  const [salesPoints, setSalesPoints] = useState<AfipSalesPoint[]>([]);
  const [systemPOSList, setSystemPOSList] = useState<SystemPOS[]>([]);
  const [showAddSalesPoint, setShowAddSalesPoint] = useState(false);
  const [newSalesPoint, setNewSalesPoint] = useState({ number: 1, name: '', pointOfSaleId: '' });
  const [creatingSalesPoint, setCreatingSalesPoint] = useState(false);
  const [importingFromAfip, setImportingFromAfip] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [afipPointsList, setAfipPointsList] = useState<Array<{
    number: number;
    type: string;
    blocked: string;
    dropDate: string | null;
    isAvailable: boolean;
    reason?: string;
    alreadyExists: boolean;
    selected: boolean;
  }>>([]);
  const [importingSelected, setImportingSelected] = useState(false);

  // Invoices state
  const [invoices, setInvoices] = useState<AfipInvoice[]>([]);
  const [invoicePagination, setInvoicePagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<AfipInvoice | null>(null);
  const [invoiceQrUrl, setInvoiceQrUrl] = useState<string | null>(null);

  // Server status
  const [serverStatus, setServerStatus] = useState<{ appserver: string; dbserver: string; authserver: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Certificate wizard state
  const [showCertWizard, setShowCertWizard] = useState(false);
  const [certWizardStep, setCertWizardStep] = useState<1 | 2 | 3>(1);
  const [certWizardData, setCertWizardData] = useState({
    username: '',
    password: '',
    alias: 'afipsdk',
    isProduction: false,
  });
  const [certWizardLoading, setCertWizardLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices();
    }
  }, [activeTab, invoicePagination.page]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [configRes, constantsRes, posRes] = await Promise.all([
        afipApi.getConfig(),
        afipApi.getConstants(),
        pointsOfSaleApi.getAll(),
      ]);

      setConfigured(configRes.configured);
      if (configRes.config) {
        setConfig(configRes.config);
        setSalesPoints(configRes.config.salesPoints || []);
      }
      setConstants(constantsRes);
      // posRes ya viene como array desde pointsOfSaleApi.getAll()
      setSystemPOSList(Array.isArray(posRes) ? posRes : []);
    } catch (error: any) {
      console.error('Error loading AFIP config:', error);
      showNotification('error', 'Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesPoints = async () => {
    try {
      const data = await afipApi.getSalesPoints();
      setSalesPoints(data);
    } catch (error: any) {
      console.error('Error loading sales points:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const data = await afipApi.getInvoices({ page: invoicePagination.page, limit: invoicePagination.limit });
      setInvoices(data.data);
      setInvoicePagination(data.pagination);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await afipApi.saveConfig(config);
      setConfigured(true);
      showNotification('success', 'Configuración guardada correctamente');
    } catch (error: any) {
      console.error('Error saving config:', error);
      showNotification('error', error.response?.data?.error || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setCheckingStatus(true);
      const status = await afipApi.getServerStatus();
      setServerStatus(status);
      showNotification('success', 'Estado de servidores obtenido');
    } catch (error: any) {
      console.error('Error checking status:', error);
      showNotification('error', 'Error al verificar estado de AFIP');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCreateSalesPoint = async () => {
    try {
      setCreatingSalesPoint(true);
      await afipApi.createSalesPoint(newSalesPoint);
      await loadSalesPoints();
      setShowAddSalesPoint(false);
      setNewSalesPoint({ number: 1, name: '', pointOfSaleId: '' });
      showNotification('success', 'Punto de venta creado');
    } catch (error: any) {
      console.error('Error creating sales point:', error);
      showNotification('error', error.response?.data?.error || 'Error al crear punto de venta');
    } finally {
      setCreatingSalesPoint(false);
    }
  };

  const handleImportFromAfip = async () => {
    try {
      setImportingFromAfip(true);
      const result = await afipApi.getAfipSalesPoints();

      console.log('AFIP sales points result:', result);

      // Verificar si estamos en modo testing
      if (!result.isProduction) {
        showNotification('error', result.message || 'En modo testing no hay puntos de venta reales. Activa modo producción para importar.');
        return;
      }

      const afipPoints = result.salesPoints;
      console.log('AFIP points:', afipPoints);

      if (afipPoints.length === 0) {
        showNotification('error', result.message || 'No se encontraron puntos de venta en AFIP');
        return;
      }

      // Recargar puntos de venta actuales de la DB
      const currentSalesPoints = await afipApi.getSalesPoints();
      const existingNumbers = currentSalesPoints.map(sp => sp.number);

      // Preparar lista con estado de cada punto de venta
      const pointsList = afipPoints.map(ap => {
        const alreadyExists = existingNumbers.includes(ap.number);
        const hasBaja = !!ap.dropDate;
        const isBlocked = ap.blocked === 'S';

        let isAvailable = !hasBaja && !alreadyExists;
        let reason = '';

        if (alreadyExists) {
          reason = 'Ya configurado';
        } else if (hasBaja) {
          reason = 'Dado de baja';
        } else if (isBlocked) {
          reason = 'Usado por otro software';
          // Aún así se puede importar si el usuario quiere
          isAvailable = true;
        }

        return {
          ...ap,
          isAvailable,
          reason,
          alreadyExists,
          selected: isAvailable && !isBlocked, // Pre-seleccionar solo los libres
        };
      });

      setAfipPointsList(pointsList);
      setShowImportModal(true);
    } catch (error: any) {
      console.error('Error importing from AFIP:', error);
      showNotification('error', error.response?.data?.message || 'Error al importar de AFIP');
    } finally {
      setImportingFromAfip(false);
    }
  };

  const handleTogglePointSelection = (number: number) => {
    setAfipPointsList(prev => prev.map(p =>
      p.number === number && p.isAvailable
        ? { ...p, selected: !p.selected }
        : p
    ));
  };

  const handleImportSelected = async () => {
    const toImport = afipPointsList.filter(p => p.selected && p.isAvailable && !p.alreadyExists);

    if (toImport.length === 0) {
      showNotification('error', 'No hay puntos de venta seleccionados para importar');
      return;
    }

    try {
      setImportingSelected(true);
      let created = 0;

      for (const ap of toImport) {
        try {
          await afipApi.createSalesPoint({
            number: ap.number,
            name: `Punto de Venta ${ap.number} (${ap.type})`,
          });
          created++;
        } catch (e) {
          console.error(`Error creating sales point ${ap.number}:`, e);
        }
      }

      await loadSalesPoints();
      setShowImportModal(false);
      showNotification('success', `Importados ${created} de ${toImport.length} puntos de venta`);
    } catch (error: any) {
      showNotification('error', 'Error al importar puntos de venta');
    } finally {
      setImportingSelected(false);
    }
  };

  const handleDeleteSalesPoint = async (id: string) => {
    if (!confirm('¿Desactivar este punto de venta?')) return;
    try {
      await afipApi.deleteSalesPoint(id);
      await loadSalesPoints();
      showNotification('success', 'Punto de venta desactivado');
    } catch (error: any) {
      console.error('Error deleting sales point:', error);
      showNotification('error', 'Error al desactivar punto de venta');
    }
  };

  const handleLinkPOS = async (afipSalesPointId: string, pointOfSaleId: string | null) => {
    try {
      await afipApi.updateSalesPoint(afipSalesPointId, { pointOfSaleId: pointOfSaleId || undefined });
      await loadSalesPoints();
      showNotification('success', pointOfSaleId ? 'Punto de venta vinculado' : 'Vinculación eliminada');
    } catch (error: any) {
      console.error('Error linking POS:', error);
      showNotification('error', 'Error al vincular punto de venta');
    }
  };

  const handleViewInvoice = async (invoice: AfipInvoice) => {
    setSelectedInvoice(invoice);
    try {
      const { qrUrl } = await afipApi.getInvoiceQr(invoice.id);
      setInvoiceQrUrl(qrUrl);
    } catch (error) {
      setInvoiceQrUrl(null);
    }
  };

  // Certificate Wizard handlers
  const openCertWizard = () => {
    setCertWizardStep(1);
    setCertWizardData({
      username: config.cuit?.replace(/\D/g, '') || '',
      password: '',
      alias: 'afipsdk',
      isProduction: config.isProduction || false,
    });
    setShowCertWizard(true);
  };

  const handleGenerateCertificate = async () => {
    try {
      setCertWizardLoading(true);
      await afipApi.generateCertificate(certWizardData);
      showNotification('success', 'Certificado generado y guardado exitosamente');
      setCertWizardStep(2);
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Error al generar certificado');
    } finally {
      setCertWizardLoading(false);
    }
  };

  const handleSkipToComplete = async () => {
    // Recargar config para actualizar estado
    await loadInitialData();
    setCertWizardStep(3);
  };

  const closeCertWizard = () => {
    setShowCertWizard(false);
    setCertWizardData({ ...certWizardData, password: '' }); // Limpiar contraseña
  };

  const getVoucherTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FACTURA_A: 'Factura A',
      FACTURA_B: 'Factura B',
      FACTURA_C: 'Factura C',
      NOTA_CREDITO_A: 'NC A',
      NOTA_CREDITO_B: 'NC B',
      NOTA_CREDITO_C: 'NC C',
      NOTA_DEBITO_A: 'ND A',
      NOTA_DEBITO_B: 'ND B',
      NOTA_DEBITO_C: 'ND C',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ISSUED') return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Emitida</span>;
    if (status === 'ERROR') return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Error</span>;
    if (status === 'VOIDED') return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">Anulada</span>;
    return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">{status}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Facturación Electrónica AFIP</h1>
            <p className="text-gray-500">Configuración y emisión de comprobantes</p>
          </div>
        </div>
        <button
          onClick={handleCheckStatus}
          disabled={checkingStatus || !configured}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
          Verificar AFIP
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Server Status */}
      {serverStatus && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Estado de Servidores AFIP</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${serverStatus.appserver === 'OK' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>App Server: {serverStatus.appserver}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${serverStatus.dbserver === 'OK' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>DB Server: {serverStatus.dbserver}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${serverStatus.authserver === 'OK' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Auth Server: {serverStatus.authserver}</span>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Status Panel */}
      {configured && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Estado de Configuración</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Step 1: Token */}
            <div className={`p-3 rounded-lg border-2 ${config.hasAccessToken ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {config.hasAccessToken ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center text-xs text-gray-500">1</span>
                )}
                <span className="font-medium text-sm">Access Token</span>
              </div>
              <p className="text-xs text-gray-500">
                {config.hasAccessToken ? 'Configurado' : 'Pendiente - Obtené tu token en afipsdk.com'}
              </p>
            </div>

            {/* Step 2: Certificate */}
            <div className={`p-3 rounded-lg border-2 ${config.hasCertificate && config.hasKey ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {config.hasCertificate && config.hasKey ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center text-xs text-gray-500">2</span>
                )}
                <span className="font-medium text-sm">Certificado Digital</span>
              </div>
              <p className="text-xs text-gray-500">
                {config.hasCertificate && config.hasKey
                  ? 'Generado y guardado'
                  : 'Pendiente - Usá el botón "Configurar Certificado"'}
              </p>
            </div>

            {/* Step 3: Sales Points */}
            <div className={`p-3 rounded-lg border-2 ${salesPoints.length > 0 ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {salesPoints.length > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center text-xs text-gray-500">3</span>
                )}
                <span className="font-medium text-sm">Puntos de Venta</span>
              </div>
              <p className="text-xs text-gray-500">
                {salesPoints.length > 0
                  ? `${salesPoints.length} punto(s) configurado(s)`
                  : 'Pendiente - Importá desde AFIP'}
              </p>
            </div>

            {/* Step 4: Ready */}
            <div className={`p-3 rounded-lg border-2 ${
              config.hasAccessToken && config.hasCertificate && config.hasKey && salesPoints.length > 0
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {config.hasAccessToken && config.hasCertificate && config.hasKey && salesPoints.length > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center text-xs text-gray-500">4</span>
                )}
                <span className="font-medium text-sm">Listo para Facturar</span>
              </div>
              <p className="text-xs text-gray-500">
                {config.hasAccessToken && config.hasCertificate && config.hasKey && salesPoints.length > 0
                  ? '¡Podés emitir comprobantes!'
                  : 'Completá los pasos anteriores'}
              </p>
            </div>
          </div>

          {/* Next Step Guide */}
          {!(config.hasAccessToken && config.hasCertificate && config.hasKey && salesPoints.length > 0) && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-blue-800 mb-2">📋 Siguiente paso:</p>
              {!config.hasAccessToken ? (
                <p className="text-sm text-blue-700">
                  1. Obtené tu <strong>Access Token</strong> en{' '}
                  <a href="https://afipsdk.com" target="_blank" rel="noopener noreferrer" className="underline">afipsdk.com</a>{' '}
                  y pegalo en el campo correspondiente abajo.
                </p>
              ) : !config.hasCertificate || !config.hasKey ? (
                <p className="text-sm text-blue-700">
                  2. Hacé click en el botón <strong>"Configurar Certificado"</strong> (abajo en la sección Credenciales)
                  para generar tu certificado digital con tus credenciales de AFIP.
                </p>
              ) : salesPoints.length === 0 ? (
                <p className="text-sm text-blue-700">
                  3. Andá a la pestaña <strong>"Puntos de Venta"</strong> y hacé click en <strong>"Importar de AFIP"</strong>{' '}
                  para cargar tus puntos de venta habilitados.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'config', label: 'Configuración', icon: Settings },
            { id: 'salesPoints', label: 'Puntos de Venta', icon: Building2 },
            { id: 'invoices', label: 'Comprobantes', icon: Receipt },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Datos Fiscales</h2>

          {!config.hasAccessToken && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800">
                Necesitas configurar el Access Token de AfipSDK para emitir comprobantes.
                <a href="https://afipsdk.com" target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                  Obtener token
                </a>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUIT *</label>
              <input
                type="text"
                value={config.cuit || ''}
                onChange={e => setConfig({ ...config, cuit: e.target.value })}
                placeholder="20-12345678-9"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condición IVA *</label>
              <select
                value={config.taxCategory || ''}
                onChange={e => setConfig({ ...config, taxCategory: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar...</option>
                {constants?.TAX_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
              <input
                type="text"
                value={config.businessName || ''}
                onChange={e => setConfig({ ...config, businessName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Fantasía</label>
              <input
                type="text"
                value={config.tradeName || ''}
                onChange={e => setConfig({ ...config, tradeName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Domicilio Fiscal</label>
              <input
                type="text"
                value={config.address || ''}
                onChange={e => setConfig({ ...config, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={config.city || ''}
                onChange={e => setConfig({ ...config, city: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
              <input
                type="text"
                value={config.state || ''}
                onChange={e => setConfig({ ...config, state: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
              <input
                type="text"
                value={config.zipCode || ''}
                onChange={e => setConfig({ ...config, zipCode: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio de Actividades</label>
              <input
                type="date"
                value={config.activityStartDate?.split('T')[0] || ''}
                onChange={e => setConfig({ ...config, activityStartDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <hr className="my-6" />

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Credenciales AfipSDK</h2>
            <button
              onClick={openCertWizard}
              disabled={!config.cuit || !config.hasAccessToken}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!config.hasAccessToken ? 'Primero configura el Access Token' : 'Configurar certificado digital'}
            >
              <Key className="w-4 h-4" />
              Configurar Certificado
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token *</label>
              {config.hasAccessToken && !config.afipAccessToken && (
                <div className="mb-2 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Token configurado. Dejá vacío para mantener el actual.
                </div>
              )}
              <input
                type="password"
                value={config.afipAccessToken || ''}
                onChange={e => setConfig({ ...config, afipAccessToken: e.target.value })}
                placeholder={config.hasAccessToken ? "Dejar vacío para mantener el actual" : "Token de AfipSDK"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Obtén tu token en{' '}
                <a href="https://afipsdk.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  afipsdk.com
                </a>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.isProduction || false}
                  onChange={e => setConfig({ ...config, isProduction: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Modo Producción</span>
              </label>
              {config.isProduction && (
                <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                  Los comprobantes serán reales
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={saving || !config.cuit || !config.businessName || !config.taxCategory}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'salesPoints' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Puntos de Venta AFIP</h2>
            <div className="flex gap-2">
              <button
                onClick={handleImportFromAfip}
                disabled={!configured || importingFromAfip}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${importingFromAfip ? 'animate-bounce' : ''}`} />
                {importingFromAfip ? 'Importando...' : 'Importar de AFIP'}
              </button>
              <button
                onClick={() => setShowAddSalesPoint(true)}
                disabled={!configured}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Agregar Manual
              </button>
            </div>
          </div>

          {!configured && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800">Debes configurar los datos fiscales primero</span>
            </div>
          )}

          {salesPoints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay puntos de venta configurados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Número</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nombre</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">POS Vinculado</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Última Factura B</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estado</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesPoints.map(sp => (
                    <tr key={sp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold">{String(sp.number).padStart(4, '0')}</span>
                      </td>
                      <td className="px-4 py-3">{sp.name || '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={sp.pointOfSaleId || ''}
                          onChange={(e) => handleLinkPOS(sp.id, e.target.value || null)}
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sin vincular</option>
                          {systemPOSList.map(pos => (
                            <option key={pos.id} value={pos.id}>
                              {pos.branch?.name ? `${pos.branch.name} - ${pos.name}` : pos.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono">{sp.lastInvoiceB || 0}</td>
                      <td className="px-4 py-3">
                        {sp.isActive ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Activo</span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteSalesPoint(sp.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Desactivar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal agregar punto de venta */}
          {showAddSalesPoint && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Agregar Punto de Venta</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Punto de Venta *</label>
                    <input
                      type="number"
                      min="1"
                      value={newSalesPoint.number}
                      onChange={e => setNewSalesPoint({ ...newSalesPoint, number: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Debe coincidir con el habilitado en AFIP</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (opcional)</label>
                    <input
                      type="text"
                      value={newSalesPoint.name}
                      onChange={e => setNewSalesPoint({ ...newSalesPoint, name: e.target.value })}
                      placeholder="Ej: Caja Principal"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vincular con POS (opcional)</label>
                    <select
                      value={newSalesPoint.pointOfSaleId}
                      onChange={e => setNewSalesPoint({ ...newSalesPoint, pointOfSaleId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sin vincular</option>
                      {systemPOSList.map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.name} ({pos.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowAddSalesPoint(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateSalesPoint}
                    disabled={creatingSalesPoint || !newSalesPoint.number}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingSalesPoint ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Comprobantes Emitidos</h2>

          {loadingInvoices ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay comprobantes emitidos</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Fecha</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Punto Venta</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Número</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Cliente</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Total</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">CAE</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estado</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{new Date(inv.issueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">{getVoucherTypeLabel(inv.voucherType)}</span>
                        </td>
                        <td className="px-4 py-3 font-mono">{String(inv.salesPoint?.number || '').padStart(4, '0')}</td>
                        <td className="px-4 py-3 font-mono">{String(inv.number).padStart(8, '0')}</td>
                        <td className="px-4 py-3 text-sm">{inv.receiverName || 'Consumidor Final'}</td>
                        <td className="px-4 py-3 text-right font-semibold">${Number(inv.totalAmount).toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{inv.cae !== 'ERROR' ? inv.cae : '-'}</td>
                        <td className="px-4 py-3">{getStatusBadge(inv.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleViewInvoice(inv)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {invoicePagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">
                    Mostrando {(invoicePagination.page - 1) * invoicePagination.limit + 1} -{' '}
                    {Math.min(invoicePagination.page * invoicePagination.limit, invoicePagination.total)} de {invoicePagination.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInvoicePagination({ ...invoicePagination, page: invoicePagination.page - 1 })}
                      disabled={invoicePagination.page <= 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setInvoicePagination({ ...invoicePagination, page: invoicePagination.page + 1 })}
                      disabled={invoicePagination.page >= invoicePagination.pages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Modal detalle comprobante */}
          {selectedInvoice && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-lg font-semibold mb-4">
                  {getVoucherTypeLabel(selectedInvoice.voucherType)} {String(selectedInvoice.salesPoint?.number || '').padStart(4, '0')}-{String(selectedInvoice.number).padStart(8, '0')}
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha de emisión:</span>
                    <span>{new Date(selectedInvoice.issueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cliente:</span>
                    <span>{selectedInvoice.receiverName || 'Consumidor Final'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Documento:</span>
                    <span>{selectedInvoice.receiverDocType === '99' ? 'CF' : selectedInvoice.receiverDocNum}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Neto Gravado:</span>
                    <span>${Number(selectedInvoice.netAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">IVA:</span>
                    <span>${Number(selectedInvoice.taxAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>${Number(selectedInvoice.totalAmount).toFixed(2)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="text-gray-500">CAE:</span>
                    <span className="font-mono">{selectedInvoice.cae}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vencimiento CAE:</span>
                    <span>{new Date(selectedInvoice.caeExpiration).toLocaleDateString()}</span>
                  </div>
                </div>

                {invoiceQrUrl && (
                  <div className="mt-4 text-center">
                    <a
                      href={invoiceQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <QrCode className="w-4 h-4" />
                      Ver QR en AFIP
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => { setSelectedInvoice(null); setInvoiceQrUrl(null); }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Sales Points Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Puntos de Venta en AFIP</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-10"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">N°</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {afipPointsList.map(point => {
                    const isDisabled = !point.isAvailable || point.alreadyExists;
                    return (
                      <tr
                        key={point.number}
                        className={isDisabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50'}
                      >
                        <td className="px-3 py-2">
                          {point.isAvailable && !point.alreadyExists ? (
                            <input
                              type="checkbox"
                              checked={point.selected}
                              onChange={() => handleTogglePointSelection(point.number)}
                              className="rounded border-gray-300 text-blue-600"
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">
                          {String(point.number).padStart(4, '0')}
                        </td>
                        <td className="px-3 py-2 text-sm">{point.type}</td>
                        <td className="px-3 py-2">
                          {point.alreadyExists ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                              <CheckCircle className="w-3 h-3" />
                              Ya configurado
                            </span>
                          ) : point.dropDate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                              <XCircle className="w-3 h-3" />
                              Dado de baja
                            </span>
                          ) : point.blocked === 'S' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                              <AlertTriangle className="w-3 h-3" />
                              En uso (otro software)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              <CheckCircle className="w-3 h-3" />
                              Disponible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <div className="text-sm text-gray-500">
                {afipPointsList.filter(p => p.selected && !p.alreadyExists).length} seleccionados para importar
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportSelected}
                  disabled={importingSelected || afipPointsList.filter(p => p.selected && !p.alreadyExists).length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {importingSelected ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Importar Seleccionados
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Wizard Modal */}
      {showCertWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Configurar Certificado Digital</h3>
                <p className="text-sm text-gray-500">Paso {certWizardStep} de 3</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(step => (
                <div
                  key={step}
                  className={`flex-1 h-2 rounded-full ${
                    step <= certWizardStep ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {/* Step 1: Credentials */}
            {certWizardStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Importante:</strong> Necesitás tus credenciales de ARCA/AFIP (clave fiscal).
                  Tu contraseña NO se guarda, solo se usa para generar el certificado.
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario ARCA (CUIT sin guiones)</label>
                  <input
                    type="text"
                    value={certWizardData.username}
                    onChange={e => setCertWizardData({ ...certWizardData, username: e.target.value })}
                    placeholder="20123456789"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña ARCA (Clave Fiscal)</label>
                  <input
                    type="password"
                    value={certWizardData.password}
                    onChange={e => setCertWizardData({ ...certWizardData, password: e.target.value })}
                    placeholder="Tu contraseña de AFIP"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alias del certificado</label>
                  <input
                    type="text"
                    value={certWizardData.alias}
                    onChange={e => setCertWizardData({ ...certWizardData, alias: e.target.value })}
                    placeholder="afipsdk"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Nombre identificador del certificado en AFIP</p>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={certWizardData.isProduction}
                    onChange={e => setCertWizardData({ ...certWizardData, isProduction: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600"
                  />
                  <span className="text-sm text-gray-700">Certificado de Producción</span>
                </label>
              </div>
            )}

            {/* Step 2: Authorize WebService (Manual) */}
            {certWizardStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    <strong>Certificado generado y guardado exitosamente</strong>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Paso manual requerido:</strong> Ahora necesitás autorizar el Web Service WSFE en la página de AFIP/ARCA.
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-3">
                  <p className="font-semibold">Instrucciones:</p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      Ingresá a{' '}
                      <a
                        href={certWizardData.isProduction
                          ? "https://auth.afip.gob.ar/contribuyente_/"
                          : "https://wsaahomo.afip.gov.ar/wsfed/"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        AFIP con clave fiscal
                      </a>
                    </li>
                    <li>Buscá el servicio <strong>"Administrador de Relaciones de Clave Fiscal"</strong></li>
                    <li>Seleccioná <strong>"Adherir Servicio"</strong> o <strong>"Nueva Relación"</strong></li>
                    <li>Buscá y seleccioná: <strong>"WSFE - Factura Electrónica"</strong> (o "Web Services - Facturación Electrónica")</li>
                    <li>Confirmá la adhesión</li>
                  </ol>

                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-blue-800">
                      <strong>Tip:</strong> Si ya tenés el WSFE autorizado (porque facturás desde otro sistema),
                      podés saltear este paso directamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {certWizardStep === 3 && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>

                <h4 className="text-xl font-semibold text-gray-800">¡Configuración Completa!</h4>

                <p className="text-gray-600">
                  Tu certificado digital está configurado y el web service WSFE autorizado.
                  Ya podés emitir comprobantes electrónicos.
                </p>

                <div className="p-4 bg-gray-50 rounded-lg text-left text-sm">
                  <p className="font-medium mb-2">Siguiente paso:</p>
                  <p className="text-gray-600">
                    1. Ve a la pestaña "Puntos de Venta"<br />
                    2. Hacé click en "Importar de AFIP"<br />
                    3. Tus puntos de venta se cargarán automáticamente
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between mt-6 pt-4 border-t">
              <button
                onClick={closeCertWizard}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                {certWizardStep === 3 ? 'Cerrar' : 'Cancelar'}
              </button>

              {certWizardStep === 1 && (
                <button
                  onClick={handleGenerateCertificate}
                  disabled={certWizardLoading || !certWizardData.username || !certWizardData.password}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {certWizardLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      Generar Certificado
                    </>
                  )}
                </button>
              )}

              {certWizardStep === 2 && (
                <button
                  onClick={handleSkipToComplete}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Ya autoricé el WSFE, continuar
                </button>
              )}

              {certWizardStep === 3 && (
                <button
                  onClick={() => { closeCertWizard(); setActiveTab('salesPoints'); }}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Building2 className="w-4 h-4" />
                  Ir a Puntos de Venta
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
