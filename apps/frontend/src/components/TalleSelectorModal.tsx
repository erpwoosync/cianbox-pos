import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface Variante {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  size: string;
  color?: string;
  stock: number;
  price: number;
}

interface TalleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (variante: Variante) => void;
  productName: string;
  price: number;
  variantes: Variante[];
}

export default function TalleSelectorModal({
  isOpen,
  onClose,
  onSelect,
  productName,
  price,
  variantes,
}: TalleSelectorModalProps) {
  // Ordenar variantes por talle (numerico o alfabetico)
  const variantesOrdenadas = [...variantes].sort((a, b) => {
    const aNum = parseFloat(a.size);
    const bNum = parseFloat(b.size);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.size.localeCompare(b.size);
  });

  // Handler para seleccion de talle
  const handleSelect = useCallback((variante: Variante) => {
    if (variante.stock > 0) {
      onSelect(variante);
    }
  }, [onSelect]);

  // Atajos de teclado (1-9 para seleccionar talle, ESC para cerrar)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC para cerrar
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Numeros 1-9 para seleccionar talle
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const index = num - 1;
        if (index < variantesOrdenadas.length) {
          const variante = variantesOrdenadas[index];
          if (variante.stock > 0) {
            handleSelect(variante);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, variantesOrdenadas, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-900">{productName}</h3>
              <p className="text-2xl font-bold text-blue-600">
                ${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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

        {/* Selector de talles */}
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-3">
            Seleccione el talle: <span className="text-gray-400">(o presione 1-9)</span>
          </p>

          <div className="grid grid-cols-5 gap-2">
            {variantesOrdenadas.map((variante, index) => {
              const hasStock = variante.stock > 0;
              const keyNumber = index < 9 ? index + 1 : null;

              return (
                <button
                  key={variante.id}
                  onClick={() => handleSelect(variante)}
                  disabled={!hasStock}
                  className={`relative p-3 rounded-xl border-2 transition-all ${
                    hasStock
                      ? 'border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400 hover:scale-105 cursor-pointer'
                      : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                  }`}
                >
                  {/* Numero de atajo */}
                  {keyNumber && hasStock && (
                    <span className="absolute -top-1 -left-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {keyNumber}
                    </span>
                  )}

                  {/* Talle */}
                  <div className={`text-xl font-bold ${hasStock ? 'text-gray-900' : 'text-gray-400'}`}>
                    {variante.size}
                  </div>

                  {/* Stock */}
                  <div className={`text-xs mt-1 ${
                    hasStock
                      ? variante.stock < 3
                        ? 'text-amber-600 font-medium'
                        : 'text-green-600'
                      : 'text-gray-400'
                  }`}>
                    {variante.stock}u
                  </div>

                  {/* Indicador visual */}
                  {!hasStock && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-red-400 text-2xl">✗</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Color si existe */}
          {variantes[0]?.color && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              Color: <span className="font-medium text-gray-700">{variantes[0].color}</span>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancelar (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}
