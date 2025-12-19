import { useState } from 'react';
import { X, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { cashService, CashSession } from '../services/api';

interface CashOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: CashSession) => void;
  pointOfSaleId: string;
  pointOfSaleName: string;
}

export default function CashOpenModal({
  isOpen,
  onClose,
  onSuccess,
  pointOfSaleId,
  pointOfSaleName,
}: CashOpenModalProps) {
  const [openingAmount, setOpeningAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      setError('Ingrese un monto valido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await cashService.open({
        pointOfSaleId,
        openingAmount: amount,
        notes: notes || undefined,
      });

      if (response.success) {
        onSuccess(response.data.session);
        setOpeningAmount('');
        setNotes('');
      } else {
        setError('Error al abrir el turno');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al abrir el turno';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    setOpeningAmount(amount.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">Abrir Turno de Caja</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Info de caja */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Punto de venta:</span> {pointOfSaleName}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Monto inicial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fondo Inicial
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 text-xl border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Montos rapidos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montos rapidos
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5000, 10000, 15000, 20000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAmount(amount)}
                  className="py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  ${amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Turno manana"
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !openingAmount}
            className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Abriendo...
              </>
            ) : (
              'Abrir Turno'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
