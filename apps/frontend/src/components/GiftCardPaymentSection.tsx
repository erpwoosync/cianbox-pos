/**
 * Componente para integrar pagos con Gift Cards en el POS
 * Permite consultar saldo y aplicar gift cards como metodo de pago
 */

import { useState, useCallback } from 'react';
import { Gift, Search, X, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { giftCardsService, GiftCardBalance } from '../services/api';

export interface AppliedGiftCard {
  code: string;
  amountApplied: number;
  originalBalance: number;
}

interface GiftCardPaymentSectionProps {
  /** Monto total a pagar */
  totalAmount: number;
  /** Monto ya cubierto por gift cards */
  giftCardAmount: number;
  /** Gift cards aplicadas */
  appliedGiftCards: AppliedGiftCard[];
  /** Callback cuando se aplica una gift card */
  onApplyGiftCard: (giftCard: AppliedGiftCard) => void;
  /** Callback cuando se remueve una gift card */
  onRemoveGiftCard: (code: string) => void;
  /** Si esta deshabilitado */
  disabled?: boolean;
}

export default function GiftCardPaymentSection({
  totalAmount,
  giftCardAmount,
  appliedGiftCards,
  onApplyGiftCard,
  onRemoveGiftCard,
  disabled = false,
}: GiftCardPaymentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<GiftCardBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountToApply, setAmountToApply] = useState('');

  const remainingAmount = totalAmount - giftCardAmount;

  /**
   * Buscar saldo de gift card
   */
  const handleSearch = useCallback(async () => {
    if (!code.trim()) {
      setError('Ingrese el codigo de la gift card');
      return;
    }

    // Verificar si ya fue aplicada
    if (appliedGiftCards.some(gc => gc.code === code.trim())) {
      setError('Esta gift card ya fue aplicada');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      const response = await giftCardsService.checkBalance(code.trim());

      if (response.success && response.data) {
        if (!response.data.isValid) {
          setError(response.data.message || 'Gift card no valida');
          return;
        }

        if (response.data.status !== 'ACTIVE') {
          setError(`Gift card ${response.data.status === 'EXPIRED' ? 'expirada' : 'inactiva'}`);
          return;
        }

        if (response.data.balance <= 0) {
          setError('Gift card sin saldo disponible');
          return;
        }

        setSearchResult(response.data);
        // Pre-cargar el monto a aplicar con el minimo entre saldo y monto restante
        const maxApplicable = Math.min(response.data.balance, remainingAmount);
        setAmountToApply(maxApplicable.toString());
      }
    } catch (err) {
      console.error('Error buscando gift card:', err);
      setError('Error al buscar gift card');
    } finally {
      setIsSearching(false);
    }
  }, [code, appliedGiftCards, remainingAmount]);

  /**
   * Aplicar gift card al pago
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

    onApplyGiftCard({
      code: searchResult.code,
      amountApplied: amount,
      originalBalance: searchResult.balance,
    });

    // Limpiar estado
    setCode('');
    setSearchResult(null);
    setAmountToApply('');
    setError(null);
  }, [searchResult, amountToApply, remainingAmount, onApplyGiftCard]);

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

  if (disabled && appliedGiftCards.length === 0) {
    return null;
  }

  return (
    <div className="border border-purple-200 rounded-lg overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 transition-colors ${
          appliedGiftCards.length > 0
            ? 'bg-purple-50 hover:bg-purple-100'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-gray-700">Gift Cards</span>
          {appliedGiftCards.length > 0 && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {appliedGiftCards.length} aplicada{appliedGiftCards.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {giftCardAmount > 0 && (
            <span className="text-sm font-semibold text-purple-600">
              -${giftCardAmount.toFixed(2)}
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
        <div className="p-3 space-y-3 bg-white border-t border-purple-100">
          {/* Gift cards aplicadas */}
          {appliedGiftCards.length > 0 && (
            <div className="space-y-2">
              {appliedGiftCards.map((gc) => (
                <div
                  key={gc.code}
                  className="flex items-center justify-between p-2 bg-purple-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-mono">{gc.code}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-purple-700">
                      -${gc.amountApplied.toFixed(2)}
                    </span>
                    {!disabled && (
                      <button
                        onClick={() => onRemoveGiftCard(gc.code)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Quitar gift card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para agregar gift card */}
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
                      placeholder="Codigo de gift card..."
                      className="w-full pl-3 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono uppercase"
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
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                          className="w-full pl-6 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
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
                      className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      Usar maximo
                    </button>
                    <button
                      onClick={() => setAmountToApply(searchResult.balance.toString())}
                      className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      Usar todo el saldo
                    </button>
                  </div>
                </div>
              )}

              {/* Monto restante */}
              {remainingAmount > 0 && appliedGiftCards.length > 0 && (
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
              <span>Total cubierto con gift cards</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
