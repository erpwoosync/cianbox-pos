import { useState, useEffect, useRef } from 'react';
import { X, Smartphone, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { mercadoPagoService, MPOrderResult } from '../services/api';

interface MPPointPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: MPOrderResult) => void;
  onError: (error: string) => void;
  pointOfSaleId: string;
  amount: number;
  externalReference: string;
}

type PaymentStatus = 'idle' | 'creating' | 'waiting' | 'processing' | 'success' | 'error' | 'cancelled';

export default function MPPointPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  pointOfSaleId,
  amount,
  externalReference,
}: MPPointPaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<MPOrderResult | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      createOrder();
    }
  }, [isOpen]);

  const createOrder = async () => {
    setStatus('creating');
    setError(null);

    try {
      const response = await mercadoPagoService.createPointOrder({
        pointOfSaleId,
        amount,
        externalReference,
        description: `Venta POS - ${externalReference}`,
      });

      if (!mountedRef.current) return;

      if (response.success) {
        setOrderId(response.data.orderId);
        setStatus('waiting');
        startPolling(response.data.orderId);
      } else {
        setError('Error al crear la orden');
        setStatus('error');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Error de conexion';
      setError(errorMessage);
      setStatus('error');
      onError(errorMessage);
    }
  };

  const startPolling = (orderIdToCheck: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes with 1s intervals

    pollingRef.current = setInterval(async () => {
      attempts++;

      if (attempts >= maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (mountedRef.current) {
          setStatus('error');
          setError('Tiempo de espera agotado');
        }
        return;
      }

      try {
        const response = await mercadoPagoService.getOrderStatus(orderIdToCheck);

        if (!mountedRef.current) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          return;
        }

        if (response.success) {
          const orderStatus = response.data.status;

          if (orderStatus === 'PROCESSING') {
            setStatus('processing');
          } else if (orderStatus === 'FINISHED' || orderStatus === 'APPROVED' || orderStatus === 'PROCESSED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentResult(response.data);
            setStatus('success');
            setTimeout(() => {
              if (mountedRef.current) {
                onSuccess(response.data);
              }
            }, 1500);
          } else if (orderStatus === 'CANCELED' || orderStatus === 'CANCELLED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStatus('cancelled');
            setError('Pago cancelado');
          } else if (orderStatus === 'ERROR' || orderStatus === 'REJECTED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStatus('error');
            setError('Pago rechazado');
          }
        }
      } catch (err) {
        console.error('Error polling order status:', err);
      }
    }, 1000);
  };

  const handleCancel = async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    if (orderId && status === 'waiting') {
      try {
        await mercadoPagoService.cancelOrder(orderId);
      } catch (err) {
        console.error('Error cancelling order:', err);
      }
    }

    resetAndClose();
  };

  const resetAndClose = () => {
    setStatus('idle');
    setOrderId(null);
    setError(null);
    setPaymentResult(null);
    onClose();
  };

  const handleRetry = () => {
    setStatus('idle');
    setError(null);
    createOrder();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-[#009EE3] text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Pago con Point</h2>
          </div>
          {status !== 'success' && (
            <button onClick={handleCancel} className="p-1 hover:bg-white/20 rounded">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Monto */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">Monto a cobrar</p>
            <p className="text-3xl font-bold text-gray-900">
              ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Estado */}
          <div className="flex flex-col items-center justify-center py-8">
            {status === 'creating' && (
              <>
                <Loader2 className="w-16 h-16 text-[#009EE3] animate-spin mb-4" />
                <p className="text-gray-600">Conectando con terminal...</p>
              </>
            )}

            {status === 'waiting' && (
              <>
                <div className="relative mb-4">
                  <Smartphone className="w-20 h-20 text-[#009EE3]" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full animate-pulse" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Esperando pago en terminal
                </p>
                <p className="text-sm text-gray-500 text-center">
                  Pase o inserte la tarjeta en el lector Point
                </p>
              </>
            )}

            {status === 'processing' && (
              <>
                <Loader2 className="w-16 h-16 text-[#009EE3] animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-900">Procesando pago...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                <p className="text-lg font-medium text-green-700 mb-2">Pago aprobado</p>
                {paymentResult && (
                  <div className="text-sm text-gray-600 text-center">
                    {paymentResult.cardBrand && (
                      <p>{paymentResult.cardBrand} ****{paymentResult.cardLastFour}</p>
                    )}
                    {paymentResult.installments && paymentResult.installments > 1 && (
                      <p>{paymentResult.installments} cuotas</p>
                    )}
                  </div>
                )}
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-20 h-20 text-red-500 mb-4" />
                <p className="text-lg font-medium text-red-700 mb-2">Error en el pago</p>
                <p className="text-sm text-gray-600 text-center">{error}</p>
              </>
            )}

            {status === 'cancelled' && (
              <>
                <AlertCircle className="w-20 h-20 text-yellow-500 mb-4" />
                <p className="text-lg font-medium text-yellow-700 mb-2">Pago cancelado</p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          {(status === 'waiting' || status === 'processing') && (
            <button
              onClick={handleCancel}
              className="w-full py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          )}

          {(status === 'error' || status === 'cancelled') && (
            <div className="flex gap-3">
              <button
                onClick={resetAndClose}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-2 px-4 bg-[#009EE3] text-white rounded-lg hover:bg-[#0084c7] transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {status === 'success' && (
            <p className="text-center text-sm text-gray-500">
              Cerrando automaticamente...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
