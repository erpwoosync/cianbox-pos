import { useState, useEffect, useRef } from 'react';
import { X, QrCode, Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { mercadoPagoService, MPOrderResult, MPQRData } from '../services/api';

interface CartItem {
  product: {
    name: string;
  };
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface MPQRPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: MPOrderResult) => void;
  onError: (error: string) => void;
  pointOfSaleId: string;
  amount: number;
  externalReference: string;
  items?: CartItem[];
}

type PaymentStatus = 'idle' | 'creating' | 'waiting' | 'success' | 'error' | 'expired';

export default function MPQRPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  pointOfSaleId,
  amount,
  externalReference,
  items = [],
}: MPQRPaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [qrData, setQrData] = useState<MPQRData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<MPOrderResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      createQROrder();
    }
  }, [isOpen]);

  const cleanup = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const createQROrder = async () => {
    setStatus('creating');
    setError(null);
    setTimeLeft(300);

    try {
      // Usar subtotal/quantity para obtener precio con descuento aplicado
      const mpItems = items.map((item) => ({
        title: item.product.name.substring(0, 50),
        quantity: item.quantity,
        unit_price: item.subtotal / item.quantity, // Precio con descuento
      }));

      const response = await mercadoPagoService.createQROrder({
        pointOfSaleId,
        amount,
        externalReference,
        description: `Venta POS - ${externalReference}`,
        items: mpItems.length > 0 ? mpItems : undefined,
      });

      if (!mountedRef.current) return;

      if (response.success) {
        setQrData(response.data);
        setStatus('waiting');
        startPolling(response.data.externalReference);
        startTimer();
      } else {
        setError('Error al generar el codigo QR');
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

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          cleanup();
          if (mountedRef.current) {
            setStatus('expired');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPolling = (extRef: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await mercadoPagoService.getQROrderStatus(extRef);

        if (!mountedRef.current) {
          cleanup();
          return;
        }

        if (response.success) {
          const orderStatus = response.data.status;

          if (orderStatus === 'APPROVED' || orderStatus === 'approved' || orderStatus === 'PROCESSED') {
            cleanup();
            setPaymentResult(response.data);
            setStatus('success');
            setTimeout(() => {
              if (mountedRef.current) {
                onSuccess(response.data);
              }
            }, 1500);
          } else if (orderStatus === 'REJECTED' || orderStatus === 'rejected') {
            cleanup();
            setStatus('error');
            setError('Pago rechazado');
          } else if (orderStatus === 'CANCELLED' || orderStatus === 'cancelled') {
            cleanup();
            setStatus('error');
            setError('Pago cancelado');
          }
        }
      } catch (err) {
        console.error('Error polling QR status:', err);
      }
    }, 2000);
  };

  const handleClose = () => {
    cleanup();
    resetAndClose();
  };

  const resetAndClose = () => {
    setStatus('idle');
    setQrData(null);
    setError(null);
    setPaymentResult(null);
    setTimeLeft(300);
    onClose();
  };

  const handleRetry = () => {
    cleanup();
    setStatus('idle');
    setError(null);
    createQROrder();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-[#009EE3] text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Pago con QR</h2>
          </div>
          {status !== 'success' && (
            <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Monto */}
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500">Monto a cobrar</p>
            <p className="text-3xl font-bold text-gray-900">
              ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Estado */}
          <div className="flex flex-col items-center justify-center py-4">
            {status === 'creating' && (
              <>
                <Loader2 className="w-16 h-16 text-[#009EE3] animate-spin mb-4" />
                <p className="text-gray-600">Generando codigo QR...</p>
              </>
            )}

            {status === 'waiting' && qrData && (
              <>
                {/* QR Code */}
                <div className="bg-white p-4 rounded-lg border-2 border-[#009EE3] mb-4">
                  {qrData.qrBase64 ? (
                    <img
                      src={`data:image/png;base64,${qrData.qrBase64}`}
                      alt="Codigo QR"
                      className="w-48 h-48"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                      <QrCode className="w-24 h-24 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Timer */}
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-500">Tiempo restante</p>
                  <p className={`text-2xl font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatTime(timeLeft)}
                  </p>
                </div>

                <p className="text-sm text-gray-600 text-center">
                  Escanea el codigo QR con la app de Mercado Pago
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                <p className="text-lg font-medium text-green-700 mb-2">Pago aprobado</p>
                {paymentResult && paymentResult.paymentId && (
                  <p className="text-sm text-gray-600">
                    ID: {paymentResult.paymentId}
                  </p>
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

            {status === 'expired' && (
              <>
                <AlertCircle className="w-20 h-20 text-yellow-500 mb-4" />
                <p className="text-lg font-medium text-yellow-700 mb-2">QR expirado</p>
                <p className="text-sm text-gray-600 text-center">
                  El tiempo para escanear el codigo ha terminado
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          {status === 'waiting' && (
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerar
              </button>
            </div>
          )}

          {(status === 'error' || status === 'expired') && (
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
