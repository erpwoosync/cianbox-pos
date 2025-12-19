import { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Loader2, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';
import { cashService, authService } from '../services/api';

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

  // Estado para autorización de supervisor (solo retiros)
  const [step, setStep] = useState<'form' | 'authorize'>('form');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [supervisorInfo, setSupervisorInfo] = useState<{ id: string; name: string } | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const isWithdraw = type === 'withdraw';
  const reasons = REASONS[type];

  const validateForm = (): boolean => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Ingrese un monto valido');
      return false;
    }

    if (!reason) {
      setError('Seleccione una razon');
      return false;
    }

    if (isWithdraw && parsedAmount > availableCash) {
      setError(`No hay suficiente efectivo. Disponible: $${availableCash.toLocaleString()}`);
      return false;
    }

    return true;
  };

  const handleRequestAuthorization = () => {
    if (!validateForm()) return;
    setError(null);
    setStep('authorize');
  };

  const handleVerifyPin = async () => {
    if (supervisorPin.length !== 4) {
      setPinError('El PIN debe tener 4 dígitos');
      return;
    }

    setIsLoading(true);
    setPinError(null);

    try {
      const response = await authService.verifySupervisor(supervisorPin, 'cash:movements');
      if (response.success && response.data.supervisor) {
        setSupervisorInfo({
          id: response.data.supervisor.id,
          name: response.data.supervisor.name,
        });
        // Ejecutar el retiro con autorización
        await executeWithdraw(response.data.supervisor.id);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        setPinError(axiosError.response?.data?.message || 'PIN inválido o sin permisos');
      } else {
        setPinError('Error al verificar PIN');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const executeWithdraw = async (authorizedByUserId: string) => {
    try {
      const data = {
        amount: parseFloat(amount),
        reason,
        description: description || undefined,
        reference: reference || undefined,
        ...(destinationType ? { destinationType } : {}),
        authorizedByUserId,
      };

      const response = await cashService.withdraw(data);

      if (response.success) {
        onSuccess();
        handleClose();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar el retiro';
      setError(errorMessage);
      setStep('form');
    }
  };

  const handleDepositSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = {
        amount: parseFloat(amount),
        reason,
        description: description || undefined,
        reference: reference || undefined,
      };

      const response = await cashService.deposit(data);

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
    setStep('form');
    setSupervisorPin('');
    setSupervisorInfo(null);
    setPinError(null);
    onClose();
  };

  const handleBackToForm = () => {
    setStep('form');
    setSupervisorPin('');
    setPinError(null);
  };

  if (!isOpen) return null;

  // Paso de autorización de supervisor (solo para retiros)
  if (step === 'authorize') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-amber-50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Autorización Requerida</h2>
            </div>
            <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            <div className="text-center">
              <p className="text-gray-600 mb-2">
                Para realizar este retiro se requiere autorización de un supervisor.
              </p>
              <div className="bg-gray-100 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-500">Monto a retirar</p>
                <p className="text-2xl font-bold text-red-600">
                  ${parseFloat(amount).toLocaleString()}
                </p>
              </div>
            </div>

            {pinError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{pinError}</p>
              </div>
            )}

            {supervisorInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  Autorizado por: <span className="font-medium">{supervisorInfo.name}</span>
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                <KeyRound className="w-4 h-4 inline mr-1" />
                PIN de Supervisor
              </label>
              <input
                type="password"
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full px-4 py-4 text-3xl text-center tracking-widest border rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && supervisorPin.length === 4) {
                    handleVerifyPin();
                  }
                }}
              />
              <p className="text-xs text-gray-500 text-center mt-2">
                Ingrese el PIN de 4 dígitos del supervisor
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-4 border-t bg-gray-50">
            <button
              onClick={handleBackToForm}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              Volver
            </button>
            <button
              onClick={handleVerifyPin}
              disabled={isLoading || supervisorPin.length !== 4}
              className="flex-1 py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Autorizar'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Formulario principal
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

          {isWithdraw && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                Los retiros requieren autorización de un supervisor
              </p>
            </div>
          )}
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
            onClick={isWithdraw ? handleRequestAuthorization : handleDepositSubmit}
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
              'Solicitar Retiro'
            ) : (
              'Registrar Ingreso'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
