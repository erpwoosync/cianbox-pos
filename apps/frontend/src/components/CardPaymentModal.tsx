/**
 * CardPaymentModal - Modal para datos de cupón de tarjeta
 * Se muestra cuando se paga con crédito o débito usando terminales no integrados
 * (Posnet, Lapos, Payway, Getnet, Clover, NaranjaX, Ualá, Viumi Macro, etc.)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import api from '../services/api';

// Tipos
interface CardTerminal {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  requiresAuthCode: boolean;
  requiresVoucherNumber: boolean;
  requiresCardBrand: boolean;
  requiresLastFour: boolean;
  requiresInstallments: boolean;
  requiresBatchNumber: boolean;
}

export interface CardPaymentData {
  cardTerminalId: string;
  authorizationCode?: string;
  voucherNumber?: string;
  batchNumber?: string;
  installments: number;
  cardBrand?: string;
  cardLastFour?: string;
}

interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CardPaymentData) => void;
  amount: number;
  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD';
  initialData?: CardPaymentData | null;
}

// Marcas de tarjeta disponibles
const CARD_BRANDS = [
  { value: 'VISA', label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'AMEX', label: 'American Express' },
  { value: 'CABAL', label: 'Cabal' },
  { value: 'NARANJA', label: 'Naranja' },
  { value: 'MAESTRO', label: 'Maestro' },
  { value: 'OTHER', label: 'Otra' },
];

// Opciones de cuotas
const INSTALLMENT_OPTIONS = [
  { value: 1, label: '1 cuota' },
  { value: 3, label: '3 cuotas' },
  { value: 6, label: '6 cuotas' },
  { value: 9, label: '9 cuotas' },
  { value: 12, label: '12 cuotas' },
  { value: 18, label: '18 cuotas' },
  { value: 24, label: '24 cuotas' },
];

export default function CardPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  paymentMethod,
  initialData,
}: CardPaymentModalProps) {
  // Estado de terminales
  const [terminals, setTerminals] = useState<CardTerminal[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(true);
  const [terminalsError, setTerminalsError] = useState<string | null>(null);

  // Estado del formulario
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [installments, setInstallments] = useState(1);
  const [cardBrand, setCardBrand] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');

  // Estado de validación
  const [validationError, setValidationError] = useState<string | null>(null);

  // Terminal seleccionado
  const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);

  // Cargar terminales al abrir
  const loadTerminals = useCallback(async () => {
    setLoadingTerminals(true);
    setTerminalsError(null);

    try {
      const response = await api.get('/card-terminals?activeOnly=true');
      const data = response.data;

      if (Array.isArray(data) && data.length > 0) {
        setTerminals(data);
        // Seleccionar el primero por defecto
        setSelectedTerminalId(data[0].id);
      } else {
        // No hay terminales, intentar inicializar
        const initResponse = await api.post('/card-terminals/initialize');
        if (initResponse.data.created?.length > 0) {
          // Recargar después de inicializar
          const reloadResponse = await api.get('/card-terminals?activeOnly=true');
          setTerminals(reloadResponse.data);
          if (reloadResponse.data.length > 0) {
            setSelectedTerminalId(reloadResponse.data[0].id);
          }
        } else {
          setTerminalsError('No hay terminales de tarjeta configurados');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setTerminalsError(
        axiosError.response?.data?.error?.message || errorMessage || 'Error al cargar terminales'
      );
    } finally {
      setLoadingTerminals(false);
    }
  }, []);

  // Cargar terminales al abrir el modal
  useEffect(() => {
    if (isOpen) {
      loadTerminals();
    }
  }, [isOpen, loadTerminals]);

  // Inicializar con datos existentes o resetear al cerrar
  useEffect(() => {
    if (isOpen && initialData) {
      // Pre-cargar datos existentes
      setSelectedTerminalId(initialData.cardTerminalId || '');
      setAuthorizationCode(initialData.authorizationCode || '');
      setVoucherNumber(initialData.voucherNumber || '');
      setBatchNumber(initialData.batchNumber || '');
      setInstallments(initialData.installments || 1);
      setCardBrand(initialData.cardBrand || '');
      setCardLastFour(initialData.cardLastFour || '');
      setValidationError(null);
    } else if (!isOpen) {
      // Resetear al cerrar solo si no hay datos iniciales
      setSelectedTerminalId('');
      setAuthorizationCode('');
      setVoucherNumber('');
      setBatchNumber('');
      setInstallments(1);
      setCardBrand('');
      setCardLastFour('');
      setValidationError(null);
    }
  }, [isOpen, initialData]);

  // Validar formulario
  const validateForm = (): boolean => {
    if (!selectedTerminal) {
      setValidationError('Seleccione un terminal');
      return false;
    }

    if (selectedTerminal.requiresAuthCode && !authorizationCode.trim()) {
      setValidationError('El código de autorización es requerido');
      return false;
    }

    if (selectedTerminal.requiresVoucherNumber && !voucherNumber.trim()) {
      setValidationError('El número de cupón es requerido');
      return false;
    }

    if (selectedTerminal.requiresBatchNumber && !batchNumber.trim()) {
      setValidationError('El número de lote es requerido');
      return false;
    }

    if (selectedTerminal.requiresInstallments && installments < 1) {
      setValidationError('Las cuotas son requeridas');
      return false;
    }

    if (selectedTerminal.requiresCardBrand && !cardBrand) {
      setValidationError('La marca de tarjeta es requerida');
      return false;
    }

    if (selectedTerminal.requiresLastFour) {
      if (!cardLastFour.trim()) {
        setValidationError('Los últimos 4 dígitos son requeridos');
        return false;
      }
      if (!/^\d{4}$/.test(cardLastFour)) {
        setValidationError('Los últimos 4 dígitos deben ser numéricos');
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  // Manejar confirmación
  const handleConfirm = () => {
    if (!validateForm()) return;

    onConfirm({
      cardTerminalId: selectedTerminalId,
      authorizationCode: authorizationCode.trim() || undefined,
      voucherNumber: voucherNumber.trim() || undefined,
      batchNumber: batchNumber.trim() || undefined,
      installments,
      cardBrand: cardBrand || undefined,
      cardLastFour: cardLastFour.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  const isCredit = paymentMethod === 'CREDIT_CARD';
  const title = isCredit ? 'Datos del Cupón - Crédito' : 'Datos del Cupón - Débito';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`p-4 border-b ${isCredit ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gradient-to-r from-blue-50 to-cyan-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCredit ? 'bg-purple-100' : 'bg-blue-100'}`}>
              <CreditCard className={`w-5 h-5 ${isCredit ? 'text-purple-600' : 'text-blue-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-gray-500">
                Complete los datos del comprobante
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loadingTerminals ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : terminalsError ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{terminalsError}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selector de terminal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terminal
                </label>
                <div className="relative">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedTerminalId}
                    onChange={(e) => setSelectedTerminalId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {terminals.map((terminal) => (
                      <option key={terminal.id} value={terminal.id}>
                        {terminal.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTerminal && (
                <>
                  {/* Código de autorización */}
                  {(selectedTerminal.requiresAuthCode || authorizationCode) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código de Autorización
                        {selectedTerminal.requiresAuthCode && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={authorizationCode}
                        onChange={(e) => setAuthorizationCode(e.target.value)}
                        placeholder="Ej: 123456"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Número de cupón */}
                  {(selectedTerminal.requiresVoucherNumber || voucherNumber) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nro de Cupón
                        {selectedTerminal.requiresVoucherNumber && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                        placeholder="Ej: 0001234"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Número de lote */}
                  {(selectedTerminal.requiresBatchNumber || batchNumber) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nro de Lote
                        {selectedTerminal.requiresBatchNumber && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={batchNumber}
                        onChange={(e) => setBatchNumber(e.target.value)}
                        placeholder="Ej: 001"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Cuotas - solo para crédito */}
                  {isCredit && (selectedTerminal.requiresInstallments || installments > 1) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cuotas
                        {selectedTerminal.requiresInstallments && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {INSTALLMENT_OPTIONS.map((opt) => {
                          const installmentAmount = amount / opt.value;
                          return (
                            <option key={opt.value} value={opt.value}>
                              {opt.value === 1
                                ? '1 pago'
                                : `${opt.value} cuotas de $${installmentAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Marca de tarjeta */}
                  {(selectedTerminal.requiresCardBrand || cardBrand) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Marca de Tarjeta
                        {selectedTerminal.requiresCardBrand && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        {CARD_BRANDS.map((brand) => (
                          <option key={brand.value} value={brand.value}>
                            {brand.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Últimos 4 dígitos */}
                  {(selectedTerminal.requiresLastFour || cardLastFour) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Últimos 4 dígitos
                        {selectedTerminal.requiresLastFour && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={cardLastFour}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setCardLastFour(val);
                        }}
                        placeholder="XXXX"
                        maxLength={4}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Monto */}
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Monto a cobrar</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                {isCredit && installments > 1 && (
                  <p className="text-sm text-purple-600 mt-1 font-medium">
                    {installments} cuotas de ${(amount / installments).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              {/* Error de validación */}
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{validationError}</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedTerminalId}
                  className={`flex-1 py-3 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                    isCredit
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Pago
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
