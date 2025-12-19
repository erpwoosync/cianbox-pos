import { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Loader2, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { cashService, BillsCount, CoinsCount } from '../services/api';

// Denominaciones de billetes y monedas en pesos argentinos
const BILL_DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const;
const COIN_DENOMINATIONS = [500, 200, 100, 50, 25, 10, 5, 2, 1] as const;

interface CashCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: 'partial' | 'closing';
  expectedAmount?: number;
}

export default function CashCountModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  expectedAmount = 0,
}: CashCountModalProps) {
  const [bills, setBills] = useState<BillsCount>({});
  const [coins, setCoins] = useState<CoinsCount>({});
  const [vouchers, setVouchers] = useState(0);
  const [checks, setChecks] = useState(0);
  const [otherValues, setOtherValues] = useState(0);
  const [otherValuesNote, setOtherValuesNote] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setBills({});
      setCoins({});
      setVouchers(0);
      setChecks(0);
      setOtherValues(0);
      setOtherValuesNote('');
      setNotes('');
      setError(null);
      setShowSuccess(false);
    }
  }, [isOpen]);

  // Calcular totales
  const totals = useMemo(() => {
    let totalBills = 0;
    let totalCoins = 0;

    BILL_DENOMINATIONS.forEach((denom) => {
      totalBills += (bills[denom] || 0) * denom;
    });

    COIN_DENOMINATIONS.forEach((denom) => {
      totalCoins += (coins[denom] || 0) * denom;
    });

    const totalCash = totalBills + totalCoins;
    const totalWithOthers = totalCash + vouchers + checks + otherValues;
    const difference = totalWithOthers - expectedAmount;

    return {
      totalBills,
      totalCoins,
      totalCash,
      totalWithOthers,
      difference,
      differenceType: difference > 0 ? 'SURPLUS' : difference < 0 ? 'SHORTAGE' : null,
    };
  }, [bills, coins, vouchers, checks, otherValues, expectedAmount]);

  const handleBillChange = (denom: number, value: string) => {
    const count = parseInt(value) || 0;
    setBills((prev) => ({ ...prev, [denom]: count }));
  };

  const handleCoinChange = (denom: number, value: string) => {
    const count = parseInt(value) || 0;
    setCoins((prev) => ({ ...prev, [denom]: count }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'closing') {
        const response = await cashService.close({
          count: {
            bills,
            coins,
            vouchers,
            checks,
            otherValues,
            otherValuesNote: otherValuesNote || undefined,
          },
          notes: notes || undefined,
        });

        if (response.success) {
          setShowSuccess(true);
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1500);
        }
      } else {
        const response = await cashService.count({
          type: 'PARTIAL',
          bills,
          coins,
          vouchers,
          checks,
          otherValues,
          otherValuesNote: otherValuesNote || undefined,
          notes: notes || undefined,
        });

        if (response.success) {
          setShowSuccess(true);
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1500);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar el arqueo';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">
              {mode === 'closing' ? 'Cierre de Turno - Arqueo Final' : 'Arqueo de Caja'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-green-700">
                {mode === 'closing' ? 'Turno cerrado correctamente' : 'Arqueo registrado'}
              </h3>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Billetes */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">Billetes</h3>
                  <div className="space-y-2">
                    {BILL_DENOMINATIONS.map((denom) => (
                      <div key={denom} className="flex items-center gap-2">
                        <span className="w-20 text-sm text-gray-600">${denom.toLocaleString()}</span>
                        <input
                          type="number"
                          min="0"
                          value={bills[denom] || ''}
                          onChange={(e) => handleBillChange(denom, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-500">
                          = ${((bills[denom] || 0) * denom).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between font-medium">
                      <span>Total billetes:</span>
                      <span>${totals.totalBills.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Monedas */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">Monedas</h3>
                  <div className="space-y-2">
                    {COIN_DENOMINATIONS.map((denom) => (
                      <div key={denom} className="flex items-center gap-2">
                        <span className="w-20 text-sm text-gray-600">${denom}</span>
                        <input
                          type="number"
                          min="0"
                          value={coins[denom] || ''}
                          onChange={(e) => handleCoinChange(denom, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-center"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-500">
                          = ${((coins[denom] || 0) * denom).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between font-medium">
                      <span>Total monedas:</span>
                      <span>${totals.totalCoins.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Otros valores */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-700 mb-3">Otros valores en caja</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Vales</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        value={vouchers || ''}
                        onChange={(e) => setVouchers(parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-2 py-1 border rounded"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Cheques</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        value={checks || ''}
                        onChange={(e) => setChecks(parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-2 py-1 border rounded"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Otros</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        value={otherValues || ''}
                        onChange={(e) => setOtherValues(parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-2 py-1 border rounded"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                {otherValues > 0 && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={otherValuesNote}
                      onChange={(e) => setOtherValuesNote(e.target.value)}
                      placeholder="Descripcion de otros valores..."
                      className="w-full px-3 py-1 border rounded text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Resumen */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Resumen del Arqueo</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total efectivo contado:</span>
                    <span className="font-semibold">${totals.totalCash.toLocaleString()}</span>
                  </div>
                  {(vouchers > 0 || checks > 0 || otherValues > 0) && (
                    <div className="flex justify-between">
                      <span className="text-blue-700">Total con otros valores:</span>
                      <span className="font-semibold">${totals.totalWithOthers.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-blue-700">Monto esperado:</span>
                    <span className="font-semibold">${expectedAmount.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700 font-medium">Diferencia:</span>
                      <div className="flex items-center gap-2">
                        {totals.differenceType === 'SURPLUS' && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            SOBRANTE
                          </span>
                        )}
                        {totals.differenceType === 'SHORTAGE' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            FALTANTE
                          </span>
                        )}
                        <span
                          className={`font-bold text-lg ${
                            totals.difference > 0
                              ? 'text-green-600'
                              : totals.difference < 0
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                        >
                          ${Math.abs(totals.difference).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {totals.differenceType && (
                  <div
                    className={`mt-3 p-2 rounded flex items-center gap-2 ${
                      totals.differenceType === 'SHORTAGE'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">
                      {totals.differenceType === 'SHORTAGE'
                        ? 'Hay un faltante en caja. Verifique el conteo.'
                        : 'Hay un sobrante en caja. Verifique el conteo.'}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!showSuccess && (
          <div className="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`flex-1 py-2 px-4 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                mode === 'closing'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : mode === 'closing' ? (
                'Cerrar Turno'
              ) : (
                'Confirmar Arqueo'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
