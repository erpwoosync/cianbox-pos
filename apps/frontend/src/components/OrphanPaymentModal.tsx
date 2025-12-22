import { useState, useEffect } from 'react';
import { X, CreditCard, Loader2, AlertCircle, RefreshCw, Clock, CheckCircle } from 'lucide-react';
import { mercadoPagoService, OrphanPayment } from '../services/api';

interface CartItem {
  product: {
    id: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount?: number;
  promotionId?: string;
  promotionName?: string;
}

interface OrphanPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sale: unknown) => void;
  onError: (error: string) => void;
  pointOfSaleId: string;
  items: CartItem[];
  total: number;
  customerId?: string;
  ticketNumber?: number;
}

export default function OrphanPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  pointOfSaleId,
  items,
  total,
  customerId,
  ticketNumber,
}: OrphanPaymentModalProps) {
  const [orphanPayments, setOrphanPayments] = useState<OrphanPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<OrphanPayment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOrphanPayments();
    }
  }, [isOpen, pointOfSaleId]);

  const loadOrphanPayments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mercadoPagoService.getOrphanPayments(pointOfSaleId);
      if (response.success) {
        setOrphanPayments(response.data);
      } else {
        setError('Error al cargar pagos huerfanos');
      }
    } catch (err) {
      console.error('Error loading orphan payments:', err);
      setError('Error de conexion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedPayment) return;

    setIsApplying(true);
    setError(null);

    try {
      const response = await mercadoPagoService.applyOrphanPayment(selectedPayment.orderId, {
        pointOfSaleId,
        items: items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          promotionId: item.promotionId,
          promotionName: item.promotionName,
        })),
        customerId,
        ticketNumber,
      });

      if (response.success) {
        onSuccess(response.data);
      } else {
        setError('Error al aplicar el pago');
        onError('Error al aplicar el pago');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error de conexion';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsApplying(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'credit_card':
        return 'Credito';
      case 'debit_card':
        return 'Debito';
      case 'account_money':
        return 'Dinero MP';
      case 'bank_transfer':
      case 'interop_transfer':
        return 'Transferencia';
      default:
        return method || 'MP';
    }
  };

  // Filtrar pagos que coinciden con el monto (con tolerancia de 1 peso)
  const matchingPayments = orphanPayments.filter(
    (p) => Math.abs(p.amount - total) < 1
  );
  const otherPayments = orphanPayments.filter(
    (p) => Math.abs(p.amount - total) >= 1
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-amber-500 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Pagos Disponibles</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Monto a cobrar */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="text-center">
            <p className="text-sm text-gray-500">Monto del carrito</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
              <p className="text-gray-500">Cargando pagos...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-600">
              <AlertCircle className="w-10 h-10 mb-3" />
              <p>{error}</p>
              <button
                onClick={loadOrphanPayments}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          ) : orphanPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">No hay pagos disponibles</p>
              <p className="text-sm mt-1">No se encontraron pagos huerfanos para esta sucursal</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pagos que coinciden con el monto */}
              {matchingPayments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Coinciden con el monto ({matchingPayments.length})
                  </h3>
                  <div className="space-y-2">
                    {matchingPayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        isSelected={selectedPayment?.id === payment.id}
                        onSelect={() => setSelectedPayment(payment)}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
                        getPaymentMethodLabel={getPaymentMethodLabel}
                        highlight
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Otros pagos */}
              {otherPayments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Otros pagos ({otherPayments.length})
                  </h3>
                  <div className="space-y-2">
                    {otherPayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        isSelected={selectedPayment?.id === payment.id}
                        onSelect={() => setSelectedPayment(payment)}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
                        getPaymentMethodLabel={getPaymentMethodLabel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          {selectedPayment && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-800">
                <strong>Seleccionado:</strong> {formatCurrency(selectedPayment.amount)}
                {Math.abs(selectedPayment.amount - total) >= 1 && (
                  <span className="text-amber-600 ml-2">
                    (Diferencia: {formatCurrency(selectedPayment.amount - total)})
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedPayment || isApplying}
              className="flex-1 py-2 px-4 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                'Aplicar Pago'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente interno para cada tarjeta de pago
function PaymentCard({
  payment,
  isSelected,
  onSelect,
  formatDate,
  formatCurrency,
  getPaymentMethodLabel,
  highlight = false,
}: {
  payment: OrphanPayment;
  isSelected: boolean;
  onSelect: () => void;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  getPaymentMethodLabel: (method?: string) => string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-amber-500 bg-amber-50'
          : highlight
          ? 'border-green-300 bg-green-50 hover:border-green-400'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {formatCurrency(payment.amount)}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(payment.processedAt || payment.createdAt)}
              </span>
              <span>|</span>
              <span>{getPaymentMethodLabel(payment.paymentMethod)}</span>
              {payment.cardLastFour && (
                <span>****{payment.cardLastFour}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSelected && (
            <CheckCircle className="w-5 h-5 text-amber-500" />
          )}
        </div>
      </div>
    </button>
  );
}
