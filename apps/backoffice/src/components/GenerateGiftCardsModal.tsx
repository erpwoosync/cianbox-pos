import { useState } from 'react';
import { X, Gift, DollarSign, Hash, Calendar, CheckCircle } from 'lucide-react';
import { giftCardsApi, GiftCard } from '../services/api';

interface GenerateGiftCardsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function GenerateGiftCardsModal({
  onClose,
  onSuccess,
}: GenerateGiftCardsModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [generatedCards, setGeneratedCards] = useState<GiftCard[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseInt(quantity);
    const amt = parseFloat(amount);

    if (isNaN(qty) || qty < 1 || qty > 100) {
      setError('La cantidad debe estar entre 1 y 100');
      return;
    }

    if (isNaN(amt) || amt <= 0) {
      setError('Ingrese un monto valido');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const cards = await giftCardsApi.generate({
        quantity: qty,
        amount: amt,
        expiresAt: expiresAt || undefined,
      });

      setGeneratedCards(cards);
      setShowSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al generar las gift cards';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const copyToClipboard = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    alert('Codigos copiados al portapapeles');
  };

  // Vista de exito
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-lg font-semibold">Gift Cards Generadas</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-green-100 rounded-lg"
            >
              <X className="w-5 h-5 text-green-700" />
            </button>
          </div>

          <div className="p-4">
            <div className="text-center mb-4">
              <p className="text-gray-600">
                Se generaron <span className="font-bold">{generatedCards.length}</span> gift cards
                de{' '}
                <span className="font-bold">
                  {formatCurrency(generatedCards[0]?.initialAmount || 0)}
                </span>{' '}
                cada una.
              </p>
            </div>

            {/* Lista de codigos */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
              <div className="grid gap-2">
                {generatedCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between bg-white p-2 rounded border"
                  >
                    <span className="font-mono text-sm font-medium">{card.code}</span>
                    <span className="text-sm text-gray-500">
                      {formatCurrency(card.initialAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(generatedCards.map((c) => c.code))}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Copiar Codigos
              </button>
              <button
                onClick={onSuccess}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formulario
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Generar Gift Cards
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad de Gift Cards
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                max="100"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="1"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Maximo 100 por lote</p>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto por Gift Card
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="5000"
              />
            </div>
          </div>

          {/* Vencimiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Vencimiento (opcional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Dejar vacio para gift cards sin vencimiento
            </p>
          </div>

          {/* Resumen */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total a generar:</span>
              <span className="font-bold text-blue-700">
                {parseInt(quantity) || 0} gift cards
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Valor total:</span>
              <span className="font-bold text-blue-700">
                {formatCurrency((parseInt(quantity) || 0) * (parseFloat(amount) || 0))}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" />
              {isSubmitting ? 'Generando...' : 'Generar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
