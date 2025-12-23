import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mercadoPagoApi, MercadoPagoConfig, MercadoPagoDevice, MercadoPagoAppType, pointsOfSaleApi, stockApi } from '../services/api';
import { RefreshCw, CheckCircle, XCircle, Smartphone, ExternalLink, Link2, Unlink, AlertTriangle, CreditCard, QrCode, Store, Printer, MapPin, ToggleLeft, ToggleRight, Plus, X, ChevronDown, ChevronRight, Building2 } from 'lucide-react';

interface QRStore {
  id: string;
  name: string;
  external_id: string;
}

interface QRCashier {
  id: number;
  name: string;
  external_id: string;
  store_id: string;
  qr?: {
    image: string;
    template_document: string;
    template_image: string;
  };
}

interface SystemPOS {
  id: string;
  code: string;
  name: string;
  mpQrPosId?: number | null;
  mpQrExternalId?: string | null;
  branch?: { id: string; name: string; code: string };
  branchId: string;
}

interface SystemBranch {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

interface BranchWithMPStatus {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  hasStore: boolean;
  mpStoreId: string | null;
  mpExternalId: string | null;
}

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

  // QR Stores and Cashiers
  const [qrStores, setQrStores] = useState<QRStore[]>([]);
  const [qrCashiers, setQrCashiers] = useState<QRCashier[]>([]);
  const [loadingQrData, setLoadingQrData] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [systemPOSList, setSystemPOSList] = useState<SystemPOS[]>([]);
  const [systemBranches, setSystemBranches] = useState<SystemBranch[]>([]);
  const [linkingCashier, setLinkingCashier] = useState<number | null>(null);
  const [changingModeDeviceId, setChangingModeDeviceId] = useState<string | null>(null);

  // Modales para crear store/cashier
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showCreateCashierModal, setShowCreateCashierModal] = useState(false);
  const [selectedStoreForNewCashier, setSelectedStoreForNewCashier] = useState<QRStore | null>(null);
  const [creatingStore, setCreatingStore] = useState(false);
  const [creatingCashier, setCreatingCashier] = useState(false);

  // Nueva sección: Sucursales con MP Status
  const [branchesWithMPStatus, setBranchesWithMPStatus] = useState<BranchWithMPStatus[]>([]);
  const [loadingBranchesStatus, setLoadingBranchesStatus] = useState(false);
  const [creatingStoreFromBranch, setCreatingStoreFromBranch] = useState<string | null>(null);
  const [syncingStores, setSyncingStores] = useState(false);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const [unlinkedStores, setUnlinkedStores] = useState<Array<{ id: string; name: string; external_id: string }>>([]);
  const [linkingBranchId, setLinkingBranchId] = useState<string | null>(null);
  const [unlinkingBranchId, setUnlinkingBranchId] = useState<string | null>(null);
  const [syncingQRData, setSyncingQRData] = useState(false);

  // NOTA: La asociación terminal→POS NO se puede hacer vía API de MP.
  // Se configura desde el dispositivo físico: Más opciones > Ajustes > Modo de vinculación

  // Form data para crear store
  const [newStoreData, setNewStoreData] = useState({
    name: '',
    external_id: '',
    street_name: '',
    street_number: '',
    city_name: '',
    state_name: '',
  });

  // Form data para crear cashier
  const [newCashierData, setNewCashierData] = useState({
    name: '',
    external_id: '',
  });
  const [linkToPosId, setLinkToPosId] = useState<string>(''); // POS a vincular después de crear

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
        await loadDevices();
      }

      // Load QR data if QR is connected - await all to prevent race condition
      if (result.isQrConnected) {
        await Promise.all([
          loadQRData(),
          loadSystemPOS(),
          loadSystemBranches(),
          loadBranchesWithMPStatus(),
        ]);
      }
    } catch (error) {
      console.error('Error loading MP config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQRData = async () => {
    setLoadingQrData(true);
    try {
      // Cargar desde cache local (DB) en lugar de MP API
      const stores = await mercadoPagoApi.getLocalStores();
      // Convertir al formato esperado
      const formattedStores: QRStore[] = stores.map(s => ({
        id: s.mpStoreId,
        name: s.name,
        external_id: s.externalId,
      }));
      setQrStores(formattedStores);

      // Load all cashiers desde cache local
      const cashiers = await mercadoPagoApi.getLocalCashiers();
      // Convertir al formato esperado
      const formattedCashiers: QRCashier[] = cashiers.map(c => ({
        id: c.mpCashierId,
        name: c.name,
        external_id: c.externalId,
        store_id: c.mpStoreId,
        qr: c.qrImage ? {
          image: c.qrImage,
          template_document: c.qrTemplate || '',
          template_image: '',
        } : undefined,
      }));
      setQrCashiers(formattedCashiers);
    } catch (error) {
      console.error('Error loading QR data:', error);
    } finally {
      setLoadingQrData(false);
    }
  };

  // Sincronizar datos QR desde MP a cache local
  const handleSyncQRData = async () => {
    setSyncingQRData(true);
    try {
      const result = await mercadoPagoApi.syncQRData();
      const added = result.storesAdded + result.cashiersAdded;
      const updated = result.storesUpdated + result.cashiersUpdated;

      if (added > 0 || updated > 0) {
        setNotification({
          type: 'success',
          message: `Sincronización completada: ${added} nuevos, ${updated} actualizados`,
        });
      } else {
        setNotification({ type: 'success', message: 'Todo está sincronizado' });
      }

      // Recargar datos locales
      await loadQRData();
      await loadBranchesWithMPStatus();
    } catch (error: unknown) {
      console.error('Error syncing QR data:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Error al sincronizar',
      });
    } finally {
      setSyncingQRData(false);
    }
  };

  const loadSystemPOS = async () => {
    try {
      const posList = await pointsOfSaleApi.getAll();
      setSystemPOSList(posList);
    } catch (error) {
      console.error('Error loading system POS:', error);
    }
  };

  const loadSystemBranches = async () => {
    try {
      const branches = await stockApi.getBranches();
      setSystemBranches(branches);
    } catch (error) {
      console.error('Error loading system branches:', error);
    }
  };

  // Cargar sucursales con estado de MP y stores no vinculados
  const loadBranchesWithMPStatus = async () => {
    setLoadingBranchesStatus(true);
    try {
      // Cargar branches primero (esto no falla)
      const branches = await mercadoPagoApi.getBranchesWithMPStatus();
      setBranchesWithMPStatus(branches);

      // Intentar cargar stores no vinculados (puede fallar si MP da error)
      try {
        const stores = await mercadoPagoApi.getUnlinkedStores();
        setUnlinkedStores(stores);
      } catch (storeError) {
        console.error('Error loading unlinked stores:', storeError);
        // Si falla, usar los stores de qrStores que ya tenemos
        // y filtrar los que no están en branches
        const linkedStoreIds = new Set(branches.filter(b => b.mpStoreId).map(b => b.mpStoreId));
        const available = qrStores.filter(s => !linkedStoreIds.has(s.id));
        setUnlinkedStores(available);
      }
    } catch (error) {
      console.error('Error loading branches MP status:', error);
    } finally {
      setLoadingBranchesStatus(false);
    }
  };

  // Crear Store en MP desde una Branch (1 click)
  const handleCreateStoreFromBranch = async (branchId: string) => {
    setCreatingStoreFromBranch(branchId);
    try {
      await mercadoPagoApi.createStoreFromBranch(branchId);
      setNotification({ type: 'success', message: 'Local creado exitosamente en Mercado Pago' });
      await Promise.all([loadBranchesWithMPStatus(), loadQRData()]);
    } catch (error: unknown) {
      console.error('Error creating store from branch:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Error al crear local' });
    } finally {
      setCreatingStoreFromBranch(null);
    }
  };

  // Sincronizar Stores existentes con Branches
  const handleSyncMPStores = async () => {
    setSyncingStores(true);
    try {
      const result = await mercadoPagoApi.syncMPStores();
      if (result.synced > 0) {
        setNotification({ type: 'success', message: `${result.synced} sucursales vinculadas exitosamente` });
      } else if (result.notMatched.length > 0) {
        setNotification({ type: 'success', message: `No se encontraron coincidencias. ${result.notMatched.length} stores sin vincular.` });
      } else {
        setNotification({ type: 'success', message: 'Sincronización completada' });
      }
      await loadBranchesWithMPStatus();
    } catch (error: unknown) {
      console.error('Error syncing stores:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Error al sincronizar' });
    } finally {
      setSyncingStores(false);
    }
  };

  // Vincular Store existente a Branch
  const handleLinkStoreToBranch = async (branchId: string, storeId: string, externalId: string) => {
    setLinkingBranchId(branchId);
    try {
      await mercadoPagoApi.linkStoreToBranch(branchId, storeId, externalId);
      setNotification({ type: 'success', message: 'Local vinculado exitosamente' });
      await Promise.all([loadBranchesWithMPStatus(), loadQRData()]);
    } catch (error: unknown) {
      console.error('Error linking store to branch:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Error al vincular local' });
    } finally {
      setLinkingBranchId(null);
    }
  };

  // Desvincular Store de Branch
  const handleUnlinkStoreFromBranch = async (branchId: string) => {
    if (!confirm('¿Desvincular este local de la sucursal? Las cajas seguirán existiendo en MP.')) return;
    setUnlinkingBranchId(branchId);
    try {
      await mercadoPagoApi.unlinkStoreFromBranch(branchId);
      setNotification({ type: 'success', message: 'Local desvinculado' });
      await loadBranchesWithMPStatus();
    } catch (error: unknown) {
      console.error('Error unlinking store:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Error al desvincular' });
    } finally {
      setUnlinkingBranchId(null);
    }
  };

  // Autocompletar datos de local desde sucursal seleccionada
  const handleBranchSelect = (branchId: string) => {
    const branch = systemBranches.find(b => b.id === branchId);
    if (branch) {
      setNewStoreData({
        name: branch.name,
        external_id: branch.code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        street_name: branch.address || '',
        street_number: '',
        city_name: branch.city || '',
        state_name: branch.state || '',
      });
    }
  };

  // Autocompletar datos de caja desde POS seleccionado
  const handlePosSelectForCashier = (posId: string) => {
    setLinkToPosId(posId);
    if (posId) {
      const pos = systemPOSList.find(p => p.id === posId);
      if (pos) {
        setNewCashierData({
          name: pos.name,
          external_id: pos.code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        });
      }
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreData.name || !newStoreData.external_id || !newStoreData.street_name ||
        !newStoreData.street_number || !newStoreData.city_name || !newStoreData.state_name) {
      setNotification({ type: 'error', message: 'Todos los campos son requeridos' });
      return;
    }

    setCreatingStore(true);
    try {
      await mercadoPagoApi.createQRStore({
        name: newStoreData.name,
        external_id: newStoreData.external_id.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        location: {
          street_name: newStoreData.street_name,
          street_number: newStoreData.street_number,
          city_name: newStoreData.city_name,
          state_name: newStoreData.state_name,
        },
      });
      setNotification({ type: 'success', message: 'Local creado exitosamente' });
      setShowCreateStoreModal(false);
      setNewStoreData({ name: '', external_id: '', street_name: '', street_number: '', city_name: '', state_name: '' });
      await loadQRData();
    } catch (error: unknown) {
      console.error('Error creating store:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Error al crear local' });
    } finally {
      setCreatingStore(false);
    }
  };

  const handleCreateCashier = async () => {
    if (!newCashierData.name || !newCashierData.external_id || !selectedStoreForNewCashier) {
      setNotification({ type: 'error', message: 'Todos los campos son requeridos' });
      return;
    }

    setCreatingCashier(true);
    try {
      const externalId = newCashierData.external_id.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const result = await mercadoPagoApi.createQRCashier({
        name: newCashierData.name,
        external_id: externalId,
        store_id: selectedStoreForNewCashier.id,
      });

      // Si se seleccionó un POS para vincular, vincular automáticamente
      if (linkToPosId && result.data?.id) {
        try {
          await mercadoPagoApi.linkQRCashierToPOS(linkToPosId, {
            mpQrPosId: result.data.id,
            mpQrPosExternalId: externalId,
          });
          await loadSystemPOS();
          setNotification({ type: 'success', message: 'Caja creada y vinculada exitosamente' });
        } catch (linkError) {
          console.error('Error vinculando caja:', linkError);
          setNotification({ type: 'success', message: 'Caja creada. Error al vincular automáticamente, vinculala manualmente.' });
        }
      } else {
        setNotification({ type: 'success', message: 'Caja creada exitosamente' });
      }

      setShowCreateCashierModal(false);
      setNewCashierData({ name: '', external_id: '' });
      setSelectedStoreForNewCashier(null);
      setLinkToPosId('');
      await loadQRData();
    } catch (error: unknown) {
      console.error('Error creating cashier:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Error al crear caja' });
    } finally {
      setCreatingCashier(false);
    }
  };

  const openCreateCashierModal = (store: QRStore) => {
    setSelectedStoreForNewCashier(store);
    setNewCashierData({ name: '', external_id: '' });
    setLinkToPosId('');
    setShowCreateCashierModal(true);
  };

  const handleLinkCashierToPOS = async (cashierId: number, cashierExternalId: string, posId: string) => {
    setLinkingCashier(cashierId);
    try {
      await mercadoPagoApi.linkQRCashierToPOS(posId, {
        mpQrPosId: cashierId,
        mpQrPosExternalId: cashierExternalId,
      });
      await loadSystemPOS();
      setNotification({ type: 'success', message: 'Caja QR vinculada exitosamente' });
    } catch (error) {
      console.error('Error linking cashier:', error);
      setNotification({ type: 'error', message: 'Error al vincular caja QR' });
    } finally {
      setLinkingCashier(null);
    }
  };

  const handleUnlinkCashier = async (posId: string) => {
    try {
      await mercadoPagoApi.linkQRCashierToPOS(posId, {
        mpQrPosId: null,
        mpQrPosExternalId: null,
      });
      await loadSystemPOS();
      setNotification({ type: 'success', message: 'Caja QR desvinculada' });
    } catch (error) {
      console.error('Error unlinking cashier:', error);
      setNotification({ type: 'error', message: 'Error al desvincular' });
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

  const handleChangeDeviceMode = async (deviceId: string, currentMode: string) => {
    const newMode: 'PDV' | 'STANDALONE' = currentMode === 'PDV' ? 'STANDALONE' : 'PDV';
    const modeLabel = newMode === 'PDV' ? 'Integrado (PDV)' : 'Independiente (STANDALONE)';

    // Si va a cambiar a PDV, mostrar instrucción sobre cómo asociar a un POS
    if (newMode === 'PDV') {
      const confirmMsg = `¿Cambiar el dispositivo a modo ${modeLabel}?\n\nIMPORTANTE:\n1. Solo puede haber UNA terminal en modo PDV por caja\n2. Para múltiples terminales, crea múltiples cajas en la sección QR\n3. La asociación terminal→caja se configura desde el dispositivo:\n   Más opciones > Ajustes > Modo de vinculación\n4. Reinicia el dispositivo después del cambio`;
      if (!confirm(confirmMsg)) return;
    } else {
      if (!confirm(`¿Cambiar el dispositivo a modo ${modeLabel}?\n\nReinicia el dispositivo para aplicar el cambio.`)) return;
    }

    setChangingModeDeviceId(deviceId);
    try {
      const result = await mercadoPagoApi.changeDeviceOperatingMode(deviceId, newMode);
      console.log('Resultado cambio modo:', result);
      setNotification({
        type: 'success',
        message: `Modo cambiado a ${modeLabel}. Reinicia el dispositivo para aplicar el cambio.`,
      });
      await loadDevices();
    } catch (error: unknown) {
      console.error('Error changing device mode:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setNotification({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Error al cambiar modo de operación',
      });
    } finally {
      setChangingModeDeviceId(null);
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
                {mpDevices.map((device) => {
                  const isPDV = device.operating_mode === 'PDV';
                  const isChanging = changingModeDeviceId === device.id;

                  return (
                    <div
                      key={device.id}
                      className="p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Smartphone size={24} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${
                                isPDV
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isPDV ? 'Integrado (PDV)' : 'Independiente'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 font-mono mt-1">
                            ...{device.id.slice(-12)}
                          </p>
                        </div>
                      </div>

                      {/* Mostrar POS asociado si está en modo PDV */}
                      {isPDV && device.external_pos_id && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg">
                          <p className="text-xs text-green-700">
                            <span className="font-medium">Caja asociada:</span> {device.external_pos_id}
                          </p>
                        </div>
                      )}

                      {/* Instrucciones para configurar desde el dispositivo */}
                      {!isPDV && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">
                            <strong>Para integrar:</strong><br/>
                            1. Crea una Caja en la sección QR abajo<br/>
                            2. En el dispositivo: Más opciones → Ajustes → Modo de vinculación<br/>
                            3. Activa modo PDV aquí
                          </p>
                        </div>
                      )}

                      {/* Botón para cambiar modo */}
                      <button
                        onClick={() => handleChangeDeviceMode(device.id, device.operating_mode)}
                        disabled={isChanging}
                        className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          isPDV
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        } disabled:opacity-50`}
                        title={isPDV ? 'Cambiar a modo Independiente' : 'Cambiar a modo Integrado (PDV)'}
                      >
                        {isChanging ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : isPDV ? (
                          <ToggleRight size={16} />
                        ) : (
                          <ToggleLeft size={16} />
                        )}
                        {isPDV ? 'Cambiar a Independiente' : 'Cambiar a PDV'}
                      </button>
                    </div>
                  );
                })}
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

      {/* Sucursales con Estado de MP - Only show if QR is connected */}
      {isQrConnected && (
        <div className="bg-white rounded-xl shadow-sm mt-6">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sucursales</h2>
                <p className="text-sm text-gray-500">
                  Vincula tus sucursales con locales de Mercado Pago QR
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncMPStores}
                disabled={syncingStores}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                title="Detectar stores existentes en MP y vincularlos automáticamente"
              >
                <RefreshCw size={18} className={syncingStores ? 'animate-spin' : ''} />
                Sincronizar
              </button>
            </div>
          </div>

          <div className="p-4">
            {loadingBranchesStatus ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : branchesWithMPStatus.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 size={48} className="mx-auto mb-3 text-gray-300" />
                <p>No hay sucursales configuradas</p>
                <p className="text-sm mt-1">
                  Las sucursales se importan automáticamente desde Cianbox
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {branchesWithMPStatus.map(branch => {
                  const isCreating = creatingStoreFromBranch === branch.id;
                  const isExpanded = expandedBranchId === branch.id;
                  const branchCashiers = branch.mpStoreId
                    ? qrCashiers.filter(c => c.store_id === branch.mpStoreId)
                    : [];

                  return (
                    <div key={branch.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Status indicator */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              branch.hasStore
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {branch.hasStore ? (
                              <CheckCircle size={18} />
                            ) : (
                              <XCircle size={18} />
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">{branch.name}</p>
                            <p className="text-xs text-gray-500">
                              {branch.code}
                              {branch.hasStore && branch.mpExternalId && (
                                <span className="ml-2 text-green-600">
                                  → Local MP: {branch.mpExternalId}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {branch.hasStore ? (
                            <>
                              <span className="text-xs text-gray-500">
                                {branchCashiers.length} cajas
                              </span>
                              <button
                                onClick={() => setExpandedBranchId(isExpanded ? null : branch.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                Ver cajas
                              </button>
                              <button
                                onClick={() => handleUnlinkStoreFromBranch(branch.id)}
                                disabled={unlinkingBranchId === branch.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                title="Desvincular local"
                              >
                                {unlinkingBranchId === branch.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Unlink size={14} />
                                )}
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Selector de stores existentes */}
                              {unlinkedStores.length > 0 && (
                                <select
                                  disabled={linkingBranchId === branch.id}
                                  onChange={(e) => {
                                    const store = unlinkedStores.find(s => s.id === e.target.value);
                                    if (store) {
                                      handleLinkStoreToBranch(branch.id, store.id, store.external_id);
                                    }
                                  }}
                                  className="px-2 py-1.5 text-sm border rounded-lg"
                                  defaultValue=""
                                >
                                  <option value="">Vincular a local existente...</option>
                                  {unlinkedStores.map(store => (
                                    <option key={store.id} value={store.id}>
                                      {store.name} ({store.external_id})
                                    </option>
                                  ))}
                                </select>
                              )}
                              {linkingBranchId === branch.id && (
                                <RefreshCw size={14} className="animate-spin text-indigo-600" />
                              )}
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleCreateStoreFromBranch(branch.id)}
                                disabled={isCreating}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                              >
                                {isCreating ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Plus size={14} />
                                )}
                                Crear nuevo
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded cashiers list */}
                      {isExpanded && branch.hasStore && (
                        <div className="mt-3 ml-11 p-3 bg-gray-50 rounded-lg">
                          {branchCashiers.length === 0 ? (
                            <p className="text-sm text-gray-500">No hay cajas en este local</p>
                          ) : (
                            <div className="space-y-2">
                              {branchCashiers.map(cashier => {
                                const linkedPOS = systemPOSList.find(pos => pos.mpQrPosId === cashier.id);
                                return (
                                  <div key={cashier.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                    <div className="flex items-center gap-2">
                                      <QrCode size={16} className="text-purple-500" />
                                      <span className="text-sm font-medium">{cashier.name}</span>
                                      <span className="text-xs text-gray-400">({cashier.external_id})</span>
                                    </div>
                                    {linkedPOS ? (
                                      <span className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        {linkedPOS.name}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">Sin vincular</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              const store = qrStores.find(s => s.id === branch.mpStoreId);
                              if (store) openCreateCashierModal(store);
                            }}
                            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Plus size={14} />
                            Agregar caja
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Stores and Cashiers Section - Only show if QR is connected */}
      {isQrConnected && (
        <div className="bg-white rounded-xl shadow-sm mt-6">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Store size={20} className="text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Locales y Cajas QR</h2>
                <p className="text-sm text-gray-500">
                  Vincula las cajas de Mercado Pago a tus puntos de venta
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateStoreModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                <Plus size={18} />
                Crear Local
              </button>
              <button
                onClick={handleSyncQRData}
                disabled={syncingQRData}
                className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                title="Sincronizar datos desde Mercado Pago"
              >
                <RefreshCw size={18} className={syncingQRData ? 'animate-spin' : ''} />
                Sincronizar con MP
              </button>
            </div>
          </div>

          <div className="p-4">
            {loadingQrData ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Store filter */}
                {qrStores.length > 1 && (
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Filtrar por local:</label>
                    <select
                      value={selectedStoreId}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Todos los locales</option>
                      {qrStores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Stores list */}
                <div className="space-y-4">
                  {qrStores
                    .filter(store => !selectedStoreId || store.id === selectedStoreId)
                    .map(store => {
                      const storeCashiers = qrCashiers.filter(c => c.store_id === store.id);

                      return (
                        <div key={store.id} className="border rounded-lg overflow-hidden">
                          {/* Store header */}
                          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <MapPin size={18} className="text-gray-500" />
                              <span className="font-medium text-gray-900">{store.name}</span>
                              <span className="text-xs text-gray-500">({storeCashiers.length} cajas)</span>
                            </div>
                            <button
                              onClick={() => openCreateCashierModal(store)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100"
                            >
                              <Plus size={16} />
                              Agregar Caja
                            </button>
                          </div>

                          {/* Cashiers */}
                          {storeCashiers.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              No hay cajas en este local
                            </div>
                          ) : (
                            <div className="divide-y">
                              {storeCashiers.map(cashier => {
                                const linkedPOS = systemPOSList.find(pos => pos.mpQrPosId === cashier.id);

                                return (
                                  <div key={cashier.id} className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <QrCode size={20} className="text-purple-600" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{cashier.name}</p>
                                        <p className="text-xs text-gray-500">
                                          ID: {cashier.id} | External: {cashier.external_id || '-'}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {/* Print QR button */}
                                      {cashier.qr?.template_document && (
                                        <a
                                          href={cashier.qr.template_document}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100"
                                        >
                                          <Printer size={16} />
                                          Imprimir QR
                                        </a>
                                      )}

                                      {/* Link status / selector */}
                                      {linkedPOS ? (
                                        <div className="flex items-center gap-2">
                                          <span className="px-3 py-1.5 text-sm text-green-700 bg-green-100 rounded-lg flex items-center gap-2">
                                            <CheckCircle size={14} />
                                            Vinculado a: {linkedPOS.name}
                                          </span>
                                          <button
                                            onClick={() => handleUnlinkCashier(linkedPOS.id)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                            title="Desvincular"
                                          >
                                            <Unlink size={16} />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <select
                                            disabled={linkingCashier === cashier.id}
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                handleLinkCashierToPOS(cashier.id, cashier.external_id, e.target.value);
                                              }
                                            }}
                                            className="px-3 py-1.5 text-sm border rounded-lg"
                                            defaultValue=""
                                          >
                                            <option value="">Vincular a POS...</option>
                                            {systemPOSList
                                              .filter(pos => !pos.mpQrPosId)
                                              .map(pos => (
                                                <option key={pos.id} value={pos.id}>
                                                  {pos.name} {pos.branch?.name ? `(${pos.branch.name})` : ''}
                                                </option>
                                              ))}
                                          </select>
                                          {linkingCashier === cashier.id && (
                                            <RefreshCw size={16} className="animate-spin text-purple-600" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {qrStores.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Store size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>No se encontraron locales en Mercado Pago</p>
                    <p className="text-sm mt-1 mb-4">
                      Crea un local para empezar a usar QR
                    </p>
                    <button
                      onClick={() => setShowCreateStoreModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                    >
                      <Plus size={18} />
                      Crear Local
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Crear Local */}
      {showCreateStoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Crear Local</h3>
              <button
                onClick={() => setShowCreateStoreModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Selector de sucursal del sistema para autocompletar */}
              {systemBranches.length > 0 && (
                <div className="pb-3 border-b">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crear desde sucursal del sistema <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    onChange={(e) => handleBranchSelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Seleccionar sucursal para autocompletar...</option>
                    {systemBranches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Se autocompletarán los datos del local desde la sucursal</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del local *</label>
                <input
                  type="text"
                  value={newStoreData.name}
                  onChange={(e) => setNewStoreData({ ...newStoreData, name: e.target.value })}
                  placeholder="Ej: Sucursal Centro"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Externo *</label>
                <input
                  type="text"
                  value={newStoreData.external_id}
                  onChange={(e) => setNewStoreData({ ...newStoreData, external_id: e.target.value })}
                  placeholder="Ej: SUC001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Solo letras y números, sin espacios</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calle *</label>
                  <input
                    type="text"
                    value={newStoreData.street_name}
                    onChange={(e) => setNewStoreData({ ...newStoreData, street_name: e.target.value })}
                    placeholder="Av. Corrientes"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                  <input
                    type="text"
                    value={newStoreData.street_number}
                    onChange={(e) => setNewStoreData({ ...newStoreData, street_number: e.target.value })}
                    placeholder="1234"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad *</label>
                  <input
                    type="text"
                    value={newStoreData.city_name}
                    onChange={(e) => setNewStoreData({ ...newStoreData, city_name: e.target.value })}
                    placeholder="Buenos Aires"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia *</label>
                  <input
                    type="text"
                    value={newStoreData.state_name}
                    onChange={(e) => setNewStoreData({ ...newStoreData, state_name: e.target.value })}
                    placeholder="CABA"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowCreateStoreModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateStore}
                disabled={creatingStore}
                className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {creatingStore && <RefreshCw size={16} className="animate-spin" />}
                Crear Local
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Caja */}
      {showCreateCashierModal && selectedStoreForNewCashier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Crear Caja</h3>
                <p className="text-sm text-gray-500">En: {selectedStoreForNewCashier.name}</p>
              </div>
              <button
                onClick={() => setShowCreateCashierModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Selector de POS para vincular y autocompletar - primero para mejor UX */}
              {systemPOSList.filter(pos => !pos.mpQrPosId).length > 0 && (
                <div className="pb-3 border-b">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crear desde Punto de Venta del sistema <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    value={linkToPosId}
                    onChange={(e) => handlePosSelectForCashier(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Seleccionar POS para autocompletar...</option>
                    {systemPOSList.filter(pos => !pos.mpQrPosId).map(pos => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name} ({pos.code}) - {pos.branch?.name || 'Sin sucursal'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Se autocompletará nombre y ID externo, y se vinculará al POS al crear</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la caja *</label>
                <input
                  type="text"
                  value={newCashierData.name}
                  onChange={(e) => setNewCashierData({ ...newCashierData, name: e.target.value })}
                  placeholder="Ej: Caja 1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Externo *</label>
                <input
                  type="text"
                  value={newCashierData.external_id}
                  onChange={(e) => setNewCashierData({ ...newCashierData, external_id: e.target.value })}
                  placeholder="Ej: CAJA01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Solo letras y números, sin espacios</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowCreateCashierModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCashier}
                disabled={creatingCashier}
                className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {creatingCashier && <RefreshCw size={16} className="animate-spin" />}
                Crear Caja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
