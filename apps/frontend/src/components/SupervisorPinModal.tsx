import { useState, useRef, useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';

interface SupervisorPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  message?: string;
  isLoading?: boolean;
  error?: string | null;
}

export default function SupervisorPinModal({
  isOpen,
  onClose,
  onSubmit,
  message = 'Esta operación requiere autorización de un supervisor.',
  isLoading = false,
  error = null,
}: SupervisorPinModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Limpiar PIN cuando se abre/cierra el modal
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      // Foco en el primer input
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [isOpen]);

  // Limpiar PIN cuando hay error
  useEffect(() => {
    if (error) {
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
    }
  }, [error]);

  const handleChange = (index: number, value: string) => {
    // Solo permitir digitos
    const digit = value.replace(/\D/g, '').slice(-1);

    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    // Mover al siguiente input si se ingreso un digito
    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Si se completo el PIN, enviar
    if (digit && index === 3) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        onSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: borrar y volver al anterior
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    }
    // Enter: enviar si esta completo
    if (e.key === 'Enter') {
      const fullPin = pin.join('');
      if (fullPin.length === 4) {
        onSubmit(fullPin);
      }
    }
    // Escape: cerrar
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const newPin = pasted.split('');
      setPin(newPin);
      inputRefs[3].current?.focus();
      onSubmit(pasted);
    }
  };

  const isPinComplete = pin.every((d) => d !== '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Autorizacion de Supervisor
          </h3>
          <p className="text-gray-600 text-sm">{message}</p>
        </div>

        {/* PIN Input */}
        <div className="px-6 pb-4">
          <div className="flex justify-center gap-3 mb-4">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isLoading}
                className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all
                  ${digit ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-gray-50'}
                  ${error ? 'border-red-500 bg-red-50 animate-shake' : ''}
                  focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                autoComplete="off"
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="text-center mb-4">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Indicador */}
          <p className="text-center text-gray-400 text-xs mb-4">
            Ingrese el PIN de 4 digitos del supervisor
          </p>
        </div>

        {/* Botones */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 text-gray-600 bg-gray-100 rounded-xl font-medium
              hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => isPinComplete && onSubmit(pin.join(''))}
            disabled={!isPinComplete || isLoading}
            className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-medium
              hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando...
              </>
            ) : (
              'Autorizar'
            )}
          </button>
        </div>
      </div>

      {/* Estilos para animacion de shake */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
