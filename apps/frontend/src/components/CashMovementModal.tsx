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
        const supervisor = response.data.supervisor;
        setSupervisorInfo({
          id: supervisor.id,
          name: supervisor.name,
        });
        // Ejecutar el retiro con autorización e imprimir comprobante
        await executeWithdraw(supervisor.id, supervisor.name);
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

  const executeWithdraw = async (authorizedByUserId: string, supervisorName: string) => {
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
        // Imprimir comprobante de retiro
        printWithdrawalReceipt({
          amount: parseFloat(amount),
          reason,
          description: description || undefined,
          reference: reference || undefined,
          supervisorName,
        });

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

  // Imprimir comprobante de retiro
  const printWithdrawalReceipt = (withdrawalData: {
    amount: number;
    reason: string;
    description?: string;
    reference?: string;
    supervisorName: string;
  }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reasonLabels: Record<string, string> = {
      'SAFE_DEPOSIT': 'Depósito a caja fuerte',
      'BANK_DEPOSIT': 'Depósito bancario',
      'SUPPLIER_PAYMENT': 'Pago a proveedor',
      'EXPENSE': 'Gasto menor',
      'OTHER': 'Otro retiro',
    };

    const now = new Date();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const tenantName = localStorage.getItem('tenantName') || 'Empresa';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Retiro</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .company { font-size: 18px; font-weight: bold; }
          .title { font-size: 14px; margin-top: 5px; text-transform: uppercase; }
          .info { margin: 15px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
          .label { color: #666; }
          .amount-box { background: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px; }
          .amount { font-size: 28px; font-weight: bold; color: #dc2626; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .signature { text-align: center; width: 45%; }
          .signature-line { border-top: 1px solid #000; padding-top: 5px; font-size: 12px; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">${tenantName}</div>
          <div class="title">Comprobante de Retiro de Efectivo</div>
        </div>

        <div class="info">
          <div class="info-row">
            <span class="label">Fecha:</span>
            <span>${now.toLocaleDateString('es-AR')} ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="info-row">
            <span class="label">Cajero:</span>
            <span>${user.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="label">Motivo:</span>
            <span>${reasonLabels[withdrawalData.reason] || withdrawalData.reason}</span>
          </div>
          ${withdrawalData.description ? `
          <div class="info-row">
            <span class="label">Descripción:</span>
            <span>${withdrawalData.description}</span>
          </div>
          ` : ''}
          ${withdrawalData.reference ? `
          <div class="info-row">
            <span class="label">Referencia:</span>
            <span>${withdrawalData.reference}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="label">Autorizado por:</span>
            <span>${withdrawalData.supervisorName}</span>
          </div>
        </div>

        <div class="amount-box">
          <div style="font-size: 12px; color: #666;">Monto Retirado</div>
          <div class="amount">$${withdrawalData.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>

        <div class="signatures">
          <div class="signature">
            <div class="signature-line">Entrega (Cajero)</div>
          </div>
          <div class="signature">
            <div class="signature-line">Recibe (Tesorería)</div>
          </div>
        </div>

        <div class="footer">
          Documento generado el ${now.toLocaleString('es-AR')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
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
