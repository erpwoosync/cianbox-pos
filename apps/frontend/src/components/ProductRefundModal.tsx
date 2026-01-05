import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Package,
  FileText,
  Search,
  User,
  Calendar,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import api from '../services/api';
import SupervisorPinModal from './SupervisorPinModal';

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  internalCode?: string;
}

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  availableQuantity: number;
  refundedQuantity: number;
}

interface Customer {
  id: string;
  name: string;
  docNumber?: string;
}

interface Sale {
  id: string;
  saleNumber: string;
  saleDate: string;
  total: number;
  status: string;
  customer?: Customer;
  items: SaleItem[];
}

interface ReturnItem {
  product: {
    id: string;
    name: string;
    sku?: string;
    barcode?: string;
    taxRate?: number;
  };
  quantity: number;
  unitPrice: number;
  unitPriceNet: number;
  subtotal: number;
  originalSaleId: string;
  originalSaleItemId: string;
  returnReason?: string;
}

interface ProductRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefundComplete: () => void;
  onAddToCart?: (returnItem: ReturnItem) => void; // Para agregar al carrito como devolución
}

export default function ProductRefundModal({
  isOpen,
  onClose,
  onRefundComplete,
  onAddToCart,
}: ProductRefundModalProps) {
  // Estados de busqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Datos encontrados
  const [product, setProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);

  // Seleccion
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');

  // Procesamiento
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    message: string;
    refundAmount: number;
    creditNote?: any;
  } | null>(null);

  // Supervisor PIN
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [supervisorPinError, setSupervisorPinError] = useState<string | null>(null);
  const [isValidatingPin, setIsValidatingPin] = useState(false);

  // Paso actual
  const [step, setStep] = useState<'search' | 'select' | 'confirm'>('search');

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setProduct(null);
      setSales([]);
      setSelectedSale(null);
      setSelectedItem(null);
      setQuantity(1);
      setReason('');
      setError(null);
      setSuccess(null);
      setStep('search');
      setSearchError(null);
    }
  }, [isOpen]);

  // Buscar ventas por producto
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setProduct(null);
    setSales([]);

    try {
      const response = await api.get(`/sales/by-product/${encodeURIComponent(searchQuery.trim())}`);

      if (response.data.success) {
        const data = response.data.data;
        setProduct(data.product);
        setSales(data.sales);

        if (data.sales.length > 0) {
          setStep('select');
        } else {
          setSearchError('No se encontraron ventas con este producto disponibles para devolucion');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Error al buscar';
      setSearchError(msg);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Auto-search en codigo de barras
  useEffect(() => {
    if (searchQuery.length >= 8 && /^\d+$/.test(searchQuery)) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, handleSearch]);

  // Seleccionar venta
  const handleSelectSale = (sale: Sale) => {
    setSelectedSale(sale);
    // Tomamos el primer item (es el del producto buscado)
    const item = sale.items[0];
    setSelectedItem(item);
    setQuantity(item.availableQuantity);
    setStep('confirm');
  };

  // Calcular monto a devolver
  const refundAmount =
    selectedItem && quantity > 0
      ? (selectedItem.subtotal / Math.abs(selectedItem.quantity)) * quantity
      : 0;

  // Procesar devolucion
  const processRefund = async (supervisorPin?: string) => {
    if (!selectedSale || !selectedItem) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await api.post(`/sales/${selectedSale.id}/refund`, {
        items: [
          {
            saleItemId: selectedItem.id,
            quantity: quantity,
          },
        ],
        reason: reason.trim(),
        emitCreditNote: true,
        ...(supervisorPin && { supervisorPin }),
      });

      if (response.data.success) {
        const data = response.data.data;
        setShowSupervisorPin(false);
        setSuccess({
          message: data.isFullRefund
            ? 'Devolucion total procesada correctamente'
            : 'Devolucion parcial procesada correctamente',
          refundAmount: data.refundAmount,
          creditNote: data.creditNote,
        });
        return true;
      }
    } catch (err: any) {
      // El error puede venir como objeto {code, message} o como string
      const errorData = err.response?.data?.error;
      const errorMessage = typeof errorData === 'object'
        ? errorData?.message || 'Error al procesar devolucion'
        : errorData || err.message || 'Error al procesar devolucion';

      // Detectar error de autorizacion
      if (isAuthorizationError(errorMessage)) {
        setShowSupervisorPin(true);
        setSupervisorPinError(null);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const isAuthorizationError = (errorMsg: string): boolean => {
    const authPhrases = [
      'no tienes permiso',
      'autorización',
      'autorizacion',
      'requiere permiso',
      'pos:refund',
    ];
    return authPhrases.some((phrase) => errorMsg.toLowerCase().includes(phrase));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Debe ingresar el motivo de la devolucion');
      return;
    }

    await processRefund();
  };

  const handleSupervisorPinSubmit = async (pin: string) => {
    setIsValidatingPin(true);
    setSupervisorPinError(null);

    try {
      await processRefund(pin);
    } catch (err: any) {
      if (
        err.message?.toLowerCase().includes('pin') ||
        err.message?.toLowerCase().includes('supervisor') ||
        err.message?.toLowerCase().includes('invalido')
      ) {
        setSupervisorPinError(err.message);
      } else {
        setShowSupervisorPin(false);
        setError(err.message);
      }
    } finally {
      setIsValidatingPin(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setProduct(null);
    setSales([]);
    setSelectedSale(null);
    setSelectedItem(null);
    setStep('search');
    setSearchError(null);
    setError(null);
  };

  const handleClose = () => {
    if (success) {
      onRefundComplete();
    }
    onClose();
  };

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Devolucion de Producto</h3>
              <p className="text-sm text-gray-500">
                {step === 'search' && 'Paso 1: Buscar producto'}
                {step === 'select' && 'Paso 2: Seleccionar venta'}
                {step === 'confirm' && 'Paso 3: Confirmar devolucion'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="mt-4 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Escanee codigo de barras o busque por nombre/SKU..."
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>

          {/* Producto encontrado */}
          {product && (
            <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg flex items-center gap-3">
              <Package className="w-5 h-5 text-orange-600" />
              <div className="flex-1">
                <span className="font-medium">{product.name}</span>
                <span className="ml-3 text-sm text-gray-600">
                  {product.barcode && `Cod: ${product.barcode}`}
                  {product.sku && ` | SKU: ${product.sku}`}
                </span>
              </div>
              <button
                onClick={handleClearSearch}
                className="text-sm text-orange-700 hover:underline"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {success ? (
            <div className="w-full flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-xl font-semibold text-green-800 mb-2">Devolucion Exitosa</h4>
                <p className="text-gray-600 mb-2">{success.message}</p>
                <p className="text-lg font-bold text-green-700 mb-4">
                  Monto: ${success.refundAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>

                {success.creditNote && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-sm mx-auto mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-800">Nota de Credito</span>
                    </div>
                    <p className="text-sm text-blue-700">Numero: {success.creditNote.voucherNumber}</p>
                    <p className="text-sm text-blue-700">CAE: {success.creditNote.cae}</p>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : step === 'search' && !searchError ? (
            <div className="w-full flex items-center justify-center p-8">
              <div className="text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Busque un producto para iniciar</p>
                <p className="text-sm">Escanee el codigo de barras o busque por nombre/SKU</p>
              </div>
            </div>
          ) : searchError ? (
            <div className="w-full flex items-center justify-center p-8">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-600">{searchError}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Lista de ventas */}
              <div className="w-1/2 border-r overflow-hidden flex flex-col">
                <div className="p-3 bg-gray-50 border-b font-medium text-sm text-gray-600">
                  Ventas con este producto ({sales.length})
                </div>
                <div className="flex-1 overflow-y-auto">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className={`p-4 border-b cursor-pointer transition-colors ${
                        selectedSale?.id === sale.id
                          ? 'bg-orange-50 border-l-4 border-l-orange-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{sale.saleNumber}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(sale.saleDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {sale.customer?.name || 'Sin cliente'}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-gray-500">
                          Cant: {Math.abs(sale.items[0]?.quantity || 0)}
                        </span>
                        <span className="text-green-600 font-medium">
                          Disponible: {sale.items[0]?.availableQuantity || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detalle de devolucion */}
              <div className="w-1/2 p-4 overflow-y-auto">
                {selectedSale && selectedItem ? (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Detalle de Devolucion</h4>

                    {/* Info de la venta */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Ticket:</strong> {selectedSale.saleNumber}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Fecha:</strong> {formatDate(selectedSale.saleDate)}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Cliente:</strong> {selectedSale.customer?.name || 'Sin cliente'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Producto:</strong> {selectedItem.productName}
                      </p>
                    </div>

                    {/* Cantidad */}
                    <div className="bg-white border rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cantidad a devolver
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={selectedItem.availableQuantity}
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(
                              Math.min(
                                Math.max(1, parseInt(e.target.value) || 1),
                                selectedItem.availableQuantity
                              )
                            )
                          }
                          className="w-24 px-3 py-2 text-lg text-center border rounded-lg focus:border-orange-500"
                        />
                        <span className="text-gray-500">
                          de {selectedItem.availableQuantity} disponibles
                        </span>
                      </div>
                      <div className="mt-3 text-xl font-bold text-orange-600">
                        Monto: ${refundAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Motivo */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo de la devolucion *
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Describa el motivo..."
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg focus:border-orange-500"
                      />
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <p>Seleccione una venta de la lista</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && selectedSale && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="bg-orange-100 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">Total a devolver: </span>
              <span className="font-bold text-orange-700">
                ${refundAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>

              {/* Boton para agregar al carrito (flujo de cambio) */}
              {onAddToCart && selectedItem && (
                <button
                  onClick={() => {
                    if (!reason.trim()) {
                      setError('Debe ingresar el motivo de la devolucion');
                      return;
                    }
                    // Calcular precio unitario
                    const unitPrice = selectedItem.subtotal / Math.abs(selectedItem.quantity);
                    const taxRate = 21; // Default IVA
                    const unitPriceNet = unitPrice / (1 + taxRate / 100);

                    onAddToCart({
                      product: {
                        id: selectedItem.productId,
                        name: selectedItem.productName,
                        sku: product?.sku,
                        barcode: product?.barcode,
                        taxRate,
                      },
                      quantity,
                      unitPrice,
                      unitPriceNet,
                      subtotal: unitPrice * quantity,
                      originalSaleId: selectedSale.id,
                      originalSaleItemId: selectedItem.id,
                      returnReason: reason.trim(),
                    });
                  }}
                  disabled={isProcessing || !reason.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Agregar Cambio
                </button>
              )}

              <button
                onClick={handleSubmit}
                disabled={isProcessing || !reason.trim()}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Generar Vale
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de PIN de supervisor */}
      <SupervisorPinModal
        isOpen={showSupervisorPin}
        onClose={() => setShowSupervisorPin(false)}
        onSubmit={handleSupervisorPinSubmit}
        message="No tienes permiso para procesar devoluciones. Un supervisor puede autorizar esta operacion."
        isLoading={isValidatingPin}
        error={supervisorPinError}
      />
    </div>
  );
}
