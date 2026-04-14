import {
  Search,
  ArrowLeft,
  Loader2,
  Layers,
  Receipt,
  RotateCcw,
  WifiOff,
  Wifi,
  RefreshCw,
  CloudUpload,
  X,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PointOfSale } from '../../hooks/usePOSSetup';

interface POSHeaderProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;

  // Action buttons
  onOpenProductSearch: () => void;
  onOpenSalesHistory: () => void;
  onOpenRefund: () => void;

  // Connection
  isOnline: boolean;
  isSyncing: boolean;
  pendingSalesCount: number;
  onSyncPending: () => void;

  // POS
  selectedPOS: PointOfSale | null;
  onOpenPOSSelector: () => void;
  pointsOfSaleCount: number;
  hasCashSession: boolean;

  // User
  user: { name: string; branch?: { name: string } } | null;

  // Cianbox
  posTalonarios: Array<{ id: number; comprobante: string; tipo: string; fiscal: boolean; descripcion: string }>;
  showCianboxPopover: boolean;
  onToggleCianboxPopover: (show: boolean) => void;

  // QZ Tray
  qzConnected: boolean;
  qzConnecting: boolean;
  onQzConnect: () => void;
  selectedPrinter: string | null;
}

export default function POSHeader({
  searchQuery,
  onSearchChange,
  isSearching,
  onOpenProductSearch,
  onOpenSalesHistory,
  onOpenRefund,
  isOnline,
  isSyncing,
  pendingSalesCount,
  onSyncPending,
  selectedPOS,
  onOpenPOSSelector,
  pointsOfSaleCount,
  hasCashSession,
  user,
  posTalonarios,
  showCianboxPopover,
  onToggleCianboxPopover,
  qzConnected,
  qzConnecting,
  onQzConnect,
  selectedPrinter,
}: POSHeaderProps) {
  const navigate = useNavigate();

  return (
        <div className="bg-white border-b p-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Boton consulta de productos */}
          <button
            onClick={onOpenProductSearch}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            title="Consultar productos y curva de talles"
          >
            <Layers className="w-5 h-5" />
            <span className="hidden sm:inline">Consultar</span>
          </button>

          {/* Boton historial de ventas */}
          <button
            onClick={onOpenSalesHistory}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            title="Historial de ventas y reimpresión"
          >
            <Receipt className="w-5 h-5" />
            <span className="hidden sm:inline">Ventas</span>
          </button>

          {/* Boton devoluciones */}
          <button
            onClick={onOpenRefund}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
            title="Procesar devolución de producto"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="hidden sm:inline">Devoluciones</span>
          </button>

          <div className="text-right flex items-center gap-4">
            {/* Indicador de conexión y sincronización */}
            {!isOnline ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm">
                <WifiOff className="w-4 h-4" />
                <span>Sin conexión</span>
                {pendingSalesCount > 0 && (
                  <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-xs font-medium">
                    {pendingSalesCount} pendientes
                  </span>
                )}
              </div>
            ) : (
              <>
                {isSyncing && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sincronizando...</span>
                  </div>
                )}
                {!isSyncing && pendingSalesCount > 0 && (
                  <button
                    onClick={onSyncPending}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                    title="Sincronizar ventas pendientes"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{pendingSalesCount} pendientes</span>
                  </button>
                )}
                {!isSyncing && pendingSalesCount === 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm">
                    <Wifi className="w-4 h-4" />
                    <span>Conectado</span>
                  </div>
                )}
              </>
            )}

            {/* Indicador de POS */}
            <button
              onClick={() => {
                if (hasCashSession) {
                  alert('Debe cerrar el turno de caja actual antes de cambiar de punto de venta');
                  return;
                }
                if (pointsOfSaleCount > 1) {
                  onOpenPOSSelector();
                }
              }}
              className={`px-3 py-1 rounded-lg text-sm ${
                selectedPOS
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              } ${pointsOfSaleCount > 1 && !hasCashSession ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              {selectedPOS ? `Caja: ${selectedPOS.name}` : 'Sin caja'}
            </button>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.branch?.name}</p>
            </div>

            {/* Indicador Cianbox - sync configurado + popover talonarios */}
            <div className="relative">
              <button
                onClick={() => onToggleCianboxPopover(!showCianboxPopover)}
                title={
                  selectedPOS?.cianboxPointOfSaleId
                    ? 'Cianbox configurado — click para ver talonarios'
                    : 'Cianbox no configurado — sin talonario asignado'
                }
                className={`relative p-2 rounded-lg ${
                  selectedPOS?.cianboxPointOfSaleId
                    ? 'text-gray-600 hover:text-gray-800'
                    : 'text-gray-400'
                }`}
              >
                <CloudUpload className="w-5 h-5" />
                <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  selectedPOS?.cianboxPointOfSaleId
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`} />
              </button>
              {showCianboxPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => onToggleCianboxPopover(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-xl border w-72 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700">Cianbox — Talonarios</h4>
                      <button onClick={() => onToggleCianboxPopover(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {!selectedPOS?.cianboxPointOfSaleId ? (
                      <p className="text-xs text-red-600">Este punto de venta no tiene talonario Cianbox configurado.</p>
                    ) : posTalonarios.length === 0 ? (
                      <p className="text-xs text-gray-500">Cargando talonarios...</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {posTalonarios.filter(t => !t.fiscal).length > 0 && (
                          <>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">NDP</p>
                            {posTalonarios.filter(t => !t.fiscal).map(t => (
                              <div key={t.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-50">
                                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="text-gray-700 truncate">{t.descripcion || t.comprobante}</span>
                                <span className="text-gray-400 ml-auto">#{t.id}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {posTalonarios.filter(t => t.fiscal).length > 0 && (
                          <>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-1">Factura</p>
                            {posTalonarios.filter(t => t.fiscal).map(t => (
                              <div key={t.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-50">
                                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                                <span className="text-gray-700 truncate">{t.descripcion || t.comprobante}</span>
                                <span className="text-gray-400 ml-auto">#{t.id}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Indicador QZ Tray - ícono impresora + LED */}
            <button
              onClick={() => { if (!qzConnected && !qzConnecting) onQzConnect(); }}
              title={
                qzConnecting
                  ? 'Conectando a QZ Tray...'
                  : qzConnected
                  ? `Impresora: ${selectedPrinter || 'Sin seleccionar'}`
                  : 'QZ Tray desconectado — click para reconectar'
              }
              className={`relative p-2 rounded-lg ${
                qzConnecting
                  ? 'text-yellow-600 cursor-wait'
                  : qzConnected
                  ? 'text-gray-600 cursor-default'
                  : 'text-gray-400 hover:text-gray-600 cursor-pointer'
              }`}
            >
              {qzConnecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                qzConnecting
                  ? 'bg-yellow-400 animate-pulse'
                  : qzConnected
                  ? 'bg-green-500'
                  : 'bg-red-500'
              }`} />
            </button>
          </div>
        </div>
  );
}
