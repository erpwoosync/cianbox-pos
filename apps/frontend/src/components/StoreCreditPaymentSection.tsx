/**
 * Componente para integrar pagos con Vales de Credito en el POS
 * Permite consultar saldo y aplicar vales como metodo de pago
 */

import { useState, useCallback } from 'react';
import { CreditCard, Search, X, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import api from '../services/api';

interface StoreCreditBalance {
  code: string;
  balance: number;
  originalAmount: number;
  status: string;
  expiresAt?: string;
  isExpired: boolean;
  isValid: boolean;
  customer?: {
    id: string;
    name: string;
  };
  message?: string;
}

export interface AppliedStoreCredit {
  code: string;
  amountApplied: number;
  originalBalance: number;
}

interface StoreCreditPaymentSectionProps {
  /** Monto total a pagar */
  totalAmount: number;
  /** Monto ya cubierto por vales */
  storeCreditAmount: number;
  /** Vales aplicados */
  appliedStoreCredits: AppliedStoreCredit[];
  /** Callback cuando se aplica un vale */
  onApplyStoreCredit: (storeCredit: AppliedStoreCredit) => void;
  /** Callback cuando se remueve un vale */
  onRemoveStoreCredit: (code: string) => void;
  /** Si esta deshabilitado */
  disabled?: boolean;
}

export default function StoreCreditPaymentSection({
  totalAmount,
  storeCreditAmount,
  appliedStoreCredits,
  onApplyStoreCredit,
  onRemoveStoreCredit,
  disabled = false,
}: StoreCreditPaymentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<StoreCreditBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountToApply, setAmountToApply] = useState('');

  const remainingAmount = totalAmount - storeCreditAmount;

  /**
   * Buscar saldo de vale
   */
  const handleSearch = useCallback(async () => {
    if (!code.trim()) {
      setError('Ingrese el codigo del vale');
      return;
    }

    // Verificar si ya fue aplicado
    if (appliedStoreCredits.some(sc => sc.code === code.trim().toUpperCase())) {
      setError('Este vale ya fue aplicado');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      const response = await api.post('/store-credits/balance', {
        code: code.trim().toUpperCase(),
      });

      if (response.data.success && response.data.data) {
        const data = response.data.data;

        if (!data.isValid) {
          setError(data.message || 'Vale no valido');
          return;
        }

        if (data.status !== 'ACTIVE') {
          setError(`Vale ${data.status === 'EXPIRED' ? 'vencido' : 'inactivo'}`);
          return;
        }

        if (data.balance <= 0) {
          setError('Vale sin saldo disponible');
          return;
        }

        setSearchResult(data);
        // Pre-cargar el monto a aplicar con el minimo entre saldo y monto restante
        const maxApplicable = Math.min(data.balance, remainingAmount);
        setAmountToApply(maxApplicable.toString());
      }
    } catch (err: any) {
      console.error('Error buscando vale:', err);
      const msg = err.response?.data?.error?.message || 'Error al buscar vale';
      setError(msg);
    } finally {
      setIsSearching(false);
    }
  }, [code, appliedStoreCredits, remainingAmount]);

  /**
   * Aplicar vale al pago
   */
  const handleApply = useCallback(() => {
    if (!searchResult) return;

    const amount = parseFloat(amountToApply);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingrese un monto valido');
      return;
    }

    if (amount > searchResult.balance) {
      setError('El monto excede el saldo disponible');
      return;
    }

    if (amount > remainingAmount) {
      setError('El monto excede el total pendiente');
      return;
    }

    onApplyStoreCredit({
      code: searchResult.code,
      amountApplied: amount,
      originalBalance: searchResult.balance,
    });

    // Limpiar estado
    setCode('');
    setSearchResult(null);
    setAmountToApply('');
    setError(null);
  }, [searchResult, amountToApply, remainingAmount, onApplyStoreCredit]);

  /**
   * Cancelar busqueda
   */
  const handleCancel = () => {
    setCode('');
    setSearchResult(null);
    setAmountToApply('');
    setError(null);
  };

  /**
   * Manejar tecla Enter en el input
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResult) {
        handleApply();
      } else {
        handleSearch();
      }
    }
  };

  if (disabled && appliedStoreCredits.length === 0) {
    return null;
  }

  return (
    <div className="border border-orange-200 rounded-lg overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 transition-colors ${
          appliedStoreCredits.length > 0
            ? 'bg-orange-50 hover:bg-orange-100'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-600" />
          <span className="font-medium text-gray-700">Vales de Credito</span>
          {appliedStoreCredits.length > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {appliedStoreCredits.length} aplicado{appliedStoreCredits.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {storeCreditAmount > 0 && (
            <span className="text-sm font-semibold text-orange-600">
              -${storeCreditAmount.toFixed(2)}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className="p-3 space-y-3 bg-white border-t border-orange-100">
          {/* Vales aplicados */}
          {appliedStoreCredits.length > 0 && (
            <div className="space-y-2">
              {appliedStoreCredits.map((sc) => (
                <div
                  key={sc.code}
                  className="flex items-center justify-between p-2 bg-orange-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-mono">{sc.code}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-orange-700">
                      -${sc.amountApplied.toFixed(2)}
                    </span>
                    {!disabled && (
                      <button
                        onClick={() => onRemoveStoreCredit(sc.code)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Quitar vale"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para agregar vale */}
          {!disabled && remainingAmount > 0 && (
            <div className="space-y-2">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 text-sm rounded">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Input de codigo */}
              {!searchResult && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Codigo del vale (VAL-XXX-XXXX-XXXX)..."
                      className="w-full pl-3 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 font-mono uppercase"
                      disabled={isSearching}
                    />
                    {code && !isSearching && (
                      <button
                        onClick={() => setCode('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={!code.trim() || isSearching}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Resultado de busqueda */}
              {searchResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-mono font-medium">{searchResult.code}</span>
                    </div>
                    <button
                      onClick={handleCancel}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {searchResult.customer && (
                    <div className="text-sm text-gray-600">
                      Cliente: <span className="font-medium">{searchResult.customer.name}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Saldo disponible:</span>
                      <p className="font-semibold text-green-700">
                        ${searchResult.balance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Pendiente a pagar:</span>
                      <p className="font-semibold">${remainingAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  {searchResult.expiresAt && (
                    <div className="text-xs text-gray-500">
                      Vence: {new Date(searchResult.expiresAt).toLocaleDateString('es-AR')}
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">
                        Monto a aplicar
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          value={amountToApply}
                          onChange={(e) => setAmountToApply(e.target.value)}
                          onKeyDown={handleKeyDown}
                          max={Math.min(searchResult.balance, remainingAmount)}
                          className="w-full pl-6 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleApply}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aplicar
                    </button>
                  </div>

                  {/* Botones rapidos */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAmountToApply(Math.min(searchResult.balance, remainingAmount).toString())
                      }
                      className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    >
                      Usar maximo
                    </button>
                    <button
                      onClick={() => setAmountToApply(searchResult.balance.toString())}
                      className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    >
                      Usar todo el saldo
                    </button>
                  </div>
                </div>
              )}

              {/* Monto restante */}
              {remainingAmount > 0 && appliedStoreCredits.length > 0 && (
                <p className="text-xs text-gray-500 text-center">
                  Falta pagar: <span className="font-semibold">${remainingAmount.toFixed(2)}</span>
                </p>
              )}
            </div>
          )}

          {/* Mensaje cuando el total esta cubierto */}
          {remainingAmount <= 0 && (
            <div className="flex items-center gap-2 p-2 bg-green-50 text-green-700 text-sm rounded">
              <CheckCircle className="w-4 h-4" />
              <span>Total cubierto con vales</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
