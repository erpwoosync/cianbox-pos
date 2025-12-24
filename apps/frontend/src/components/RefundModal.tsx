import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Package,
  FileText,
} from 'lucide-react';
import api from '../services/api';

interface SaleItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface Invoice {
  id: string;
  voucherType: string;
  salesPointId?: string;
}

interface Sale {
  id: string;
  saleNumber: string;
  total: number;
  status: string;
  items?: SaleItem[];
  afipInvoices?: Invoice[];
}

interface RefundItem {
  saleItemId: string;
  quantity: number;
  maxQuantity: number;
  productName: string;
  unitPrice: number;
  selected: boolean;
}

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onRefundComplete: () => void;
}

export default function RefundModal({
  isOpen,
  onClose,
  sale,
  onRefundComplete,
}: RefundModalProps) {
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [reason, setReason] = useState('');
  const [emitCreditNote, setEmitCreditNote] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; creditNote?: any } | null>(null);

  // Inicializar items cuando cambia la venta
  useEffect(() => {
    if (sale?.items) {
      setRefundItems(
        sale.items.map((item) => ({
          saleItemId: item.id,
          quantity: item.quantity,
          maxQuantity: item.quantity,
          productName: item.productName,
          unitPrice: item.unitPrice,
          selected: true,
        }))
      );
    }
    setReason('');
    setError(null);
    setSuccess(null);
  }, [sale]);

  // Calcular total de devolucion
  const refundTotal = refundItems
    .filter((item) => item.selected && item.quantity > 0)
    .reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + itemTotal;
    }, 0);

  const selectedCount = refundItems.filter(
    (item) => item.selected && item.quantity > 0
  ).length;

  const handleQuantityChange = (index: number, value: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.min(Math.max(0, value), item.maxQuantity) }
          : item
      )
    );
  };

  const handleSelectAll = () => {
    setRefundItems((prev) =>
      prev.map((item) => ({ ...item, selected: true, quantity: item.maxQuantity }))
    );
  };

  const handleDeselectAll = () => {
    setRefundItems((prev) =>
      prev.map((item) => ({ ...item, selected: false, quantity: 0 }))
    );
  };

  const handleToggleItem = (index: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              selected: !item.selected,
              quantity: !item.selected ? item.maxQuantity : 0,
            }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    if (!sale) return;

    if (!reason.trim()) {
      setError('Debe ingresar el motivo de la devolucion');
      return;
    }

    const itemsToRefund = refundItems
      .filter((item) => item.selected && item.quantity > 0)
      .map((item) => ({
        saleItemId: item.saleItemId,
        quantity: item.quantity,
      }));

    if (itemsToRefund.length === 0) {
      setError('Debe seleccionar al menos un item para devolver');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await api.post(`/sales/${sale.id}/refund`, {
        items: itemsToRefund,
        reason: reason.trim(),
        emitCreditNote,
        salesPointId: sale.afipInvoices?.[0]?.salesPointId,
      });

      if (response.data.success) {
        const data = response.data.data;
        setSuccess({
          message: data.isFullRefund
            ? 'Devolucion total procesada correctamente'
            : 'Devolucion parcial procesada correctamente',
          creditNote: data.creditNote,
        });
      } else {
        setError(response.data.error || 'Error al procesar devolucion');
      }
    } catch (err: any) {
      console.error('Error procesando devolucion:', err);
      setError(
        err.response?.data?.error || err.message || 'Error al procesar devolucion'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (success) {
      onRefundComplete();
    }
    onClose();
  };

  if (!isOpen || !sale) return null;

  const hasInvoice = sale.afipInvoices && sale.afipInvoices.length > 0;
  const canRefund = sale.status !== 'REFUNDED' && sale.status !== 'CANCELLED';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-red-50 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Procesar Devolucion</h3>
            <p className="text-sm text-gray-500">Venta #{sale.saleNumber}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-green-800 mb-2">
                Devolucion Exitosa
              </h4>
              <p className="text-gray-600 mb-4">{success.message}</p>

              {success.creditNote && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-sm mx-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Nota de Credito</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Numero: {success.creditNote.voucherNumber}
                  </p>
                  <p className="text-sm text-blue-700">CAE: {success.creditNote.cae}</p>
                </div>
              )}

              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Cerrar
              </button>
            </div>
          ) : !canRefund ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h4 className="text-xl font-semibold text-red-800 mb-2">
                No se puede devolver
              </h4>
              <p className="text-gray-600">
                {sale.status === 'REFUNDED'
                  ? 'Esta venta ya fue devuelta completamente'
                  : 'Esta venta fue anulada'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Botones de seleccion */}
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  Seleccionar Todo
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Deseleccionar
                </button>
              </div>

              {/* Items */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b font-medium text-sm text-gray-600">
                  Items a devolver
                </div>
                <div className="divide-y max-h-[280px] overflow-y-auto">
                  {refundItems.map((item, index) => (
                    <div
                      key={item.saleItemId}
                      className={`p-3 flex items-center gap-3 ${
                        item.selected ? 'bg-orange-50' : 'bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleItem(index)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium truncate">{item.productName}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          ${item.unitPrice.toFixed(2)} x {item.maxQuantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={item.maxQuantity}
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(index, parseInt(e.target.value) || 0)
                          }
                          disabled={!item.selected}
                          className="w-16 px-2 py-1 text-center border rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        <span className="text-sm text-gray-500">/ {item.maxQuantity}</span>
                      </div>
                    </div>
                  ))}
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
                  placeholder="Ingrese el motivo..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Opciones */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={emitCreditNote}
                    onChange={(e) => setEmitCreditNote(e.target.checked)}
                    disabled={!hasInvoice}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm">Emitir Nota de Credito AFIP</span>
                  {!hasInvoice && (
                    <span className="text-xs text-gray-500">(Venta sin factura)</span>
                  )}
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && canRefund && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="bg-red-100 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">Items: </span>
              <span className="font-semibold text-red-700">{selectedCount}</span>
              <span className="mx-3 text-gray-400">|</span>
              <span className="text-sm text-gray-600">Total: </span>
              <span className="font-bold text-red-700">
                ${refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
              <button
                onClick={handleSubmit}
                disabled={isProcessing || selectedCount === 0}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Procesar Devolucion
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
