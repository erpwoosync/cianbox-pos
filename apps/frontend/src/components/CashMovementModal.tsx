import { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Loader2, AlertCircle } from 'lucide-react';
import { cashService } from '../services/api';

type MovementType = 'deposit' | 'withdraw';

const REASONS = {
  deposit: [
    { value: 'CHANGE_FUND', label: 'Fondo para cambio' },
    { value: 'LOAN_RETURN', label: 'Devolucion de prestamo' },
    { value: 'OTHER', label: 'Otro ingreso' },
  ],
  withdraw: [
    { value: 'SAFE_DEPOSIT', label: 'Deposito a caja fuerte' },
    { value: 'BANK_DEPOSIT', label: 'Deposito bancario' },
    { value: 'SUPPLIER_PAYMENT', label: 'Pago a proveedor' },
    { value: 'EXPENSE', label: 'Gasto menor' },
    { value: 'OTHER', label: 'Otro retiro' },
  ],
};

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: MovementType;
  availableCash?: number;
}

export default function CashMovementModal({
  isOpen,
  onClose,
  onSuccess,
  type,
  availableCash = 0,
}: CashMovementModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [destinationType, setDestinationType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWithdraw = type === 'withdraw';
  const reasons = REASONS[type];

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Ingrese un monto valido');
      return;
    }

    if (!reason) {
      setError('Seleccione una razon');
      return;
    }

    if (isWithdraw && parsedAmount > availableCash) {
      setError(`No hay suficiente efectivo. Disponible: $${availableCash.toLocaleString()}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = {
        amount: parsedAmount,
        reason,
        description: description || undefined,
        reference: reference || undefined,
        ...(isWithdraw && destinationType ? { destinationType } : {}),
      };

      const response = isWithdraw
        ? await cashService.withdraw(data)
        : await cashService.deposit(data);

      if (response.success) {
        onSuccess();
        handleClose();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar el movimiento';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    setDescription('');
    setReference('');
    setDestinationType('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isWithdraw ? 'bg-red-50' : 'bg-green-50'
        }`}>
          <div className="flex items-center gap-2">
            {isWithdraw ? (
              <ArrowUpCircle className="w-5 h-5 text-red-600" />
            ) : (
              <ArrowDownCircle className="w-5 h-5 text-green-600" />
            )}
            <h2 className="text-lg font-semibold">
              {isWithdraw ? 'Retiro de Efectivo' : 'Ingreso de Efectivo'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {isWithdraw && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Efectivo disponible:</span> ${availableCash.toLocaleString()}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 text-xl border rounded-lg focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Razon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razon
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccione una razon...</option>
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Destino (solo para retiros) */}
          {isWithdraw && (reason === 'SAFE_DEPOSIT' || reason === 'BANK_DEPOSIT') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destino
              </label>
              <select
                value={destinationType}
                onChange={(e) => setDestinationType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccione destino...</option>
                <option value="SAFE">Caja fuerte</option>
                <option value="BANK">Banco</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          )}

          {/* Descripcion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Detalle del movimiento..."
            />
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia (opcional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nro. de comprobante, factura, etc."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !amount || !reason}
            className={`flex-1 py-2 px-4 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isWithdraw ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : isWithdraw ? (
              'Registrar Retiro'
            ) : (
              'Registrar Ingreso'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
