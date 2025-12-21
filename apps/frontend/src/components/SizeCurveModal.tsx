import { useState, useEffect } from 'react';
import { X, Loader2, Package, Grid3x3 } from 'lucide-react';
import { productsService, SizeCurveData } from '../services/api';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  shortName?: string;
  imageUrl?: string;
  basePrice?: number;
  taxRate?: number;
  cianboxProductId?: number;
  category?: { id: string; name: string };
  brand?: { id: string; name: string };
  prices?: Array<{
    priceListId: string;
    price: number;
    priceNet?: number;
    priceList?: { id: string; name: string };
  }>;
  isParent?: boolean;
  size?: string | null;
  color?: string | null;
}

interface SizeCurveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVariant: (variant: Product) => void;
  parentProduct: Product;
  branchId?: string;
}

export default function SizeCurveModal({
  isOpen,
  onClose,
  onSelectVariant,
  parentProduct,
  branchId,
}: SizeCurveModalProps) {
  const [loading, setLoading] = useState(true);
  const [sizeCurve, setSizeCurve] = useState<SizeCurveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && parentProduct.id) {
      loadSizeCurve();
    }
  }, [isOpen, parentProduct.id]);

  const loadSizeCurve = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await productsService.getSizeCurve(parentProduct.id, branchId);
      if (response.success) {
        setSizeCurve(response.data);
      } else {
        setError('No se pudo cargar la curva de talles');
      }
    } catch (err) {
      console.error('Error loading size curve:', err);
      setError('Error al cargar la curva de talles');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (size: string, color: string) => {
    if (!sizeCurve) return;

    const key = `${size}-${color}`;
    const cell = sizeCurve.matrix[key];

    if (!cell || cell.available <= 0) {
      return; // No hay stock
    }

    // Buscar la variante completa
    const variant = sizeCurve.variants.find(v => v.id === cell.variantId);
    if (!variant) return;

    // Construir el producto variante para agregar al carrito
    // Usar nombre del padre (el carrito muestra badges separados para talle/color)
    const variantProduct: Product = {
      id: variant.id,
      sku: variant.sku || parentProduct.sku,
      barcode: variant.barcode || parentProduct.barcode,
      name: parentProduct.name,
      shortName: parentProduct.shortName,
      imageUrl: parentProduct.imageUrl,
      basePrice: parentProduct.basePrice,
      taxRate: parentProduct.taxRate,
      cianboxProductId: parentProduct.cianboxProductId,
      category: parentProduct.category,
      brand: parentProduct.brand,
      prices: parentProduct.prices,
      isParent: false,
      size: variant.size,
      color: variant.color,
    };

    onSelectVariant(variantProduct);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              {parentProduct.imageUrl ? (
                <img
                  src={parentProduct.imageUrl}
                  alt={parentProduct.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Grid3x3 className="w-6 h-6 text-purple-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{parentProduct.name}</h3>
              <p className="text-sm text-gray-500">Selecciona talle y color</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-500">Cargando curva de talles...</span>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-500">{error}</p>
              <button
                onClick={loadSizeCurve}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Reintentar
              </button>
            </div>
          ) : sizeCurve ? (
            <div>
              {/* Totales */}
              <div className="mb-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
                  <Package size={16} />
                  <span>Stock total: <strong>{sizeCurve.totals.total}</strong></span>
                </div>
                <div className="text-gray-500">
                  {sizeCurve.variants.length} variantes
                </div>
              </div>

              {/* Matriz de talles/colores */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[400px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase border">
                        Talle / Color
                      </th>
                      {sizeCurve.colors.map((color) => (
                        <th
                          key={color}
                          className="px-3 py-2 bg-gray-100 text-center text-xs font-medium text-gray-600 uppercase border min-w-[80px]"
                        >
                          {color}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizeCurve.sizes.map((size) => (
                      <tr key={size}>
                        <td className="px-3 py-2 bg-gray-50 font-medium text-gray-900 border">
                          {size}
                        </td>
                        {sizeCurve.colors.map((color) => {
                          const key = `${size}-${color}`;
                          const cell = sizeCurve.matrix[key];
                          const stock = cell?.available ?? 0;
                          const hasStock = stock > 0;

                          return (
                            <td
                              key={key}
                              onClick={() => hasStock && handleCellClick(size, color)}
                              className={`px-3 py-3 text-center border font-medium transition-all ${
                                hasStock
                                  ? 'cursor-pointer hover:scale-105 hover:shadow-md'
                                  : 'cursor-not-allowed opacity-50'
                              } ${
                                stock <= 0
                                  ? 'bg-red-50 text-red-400'
                                  : stock < 5
                                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                  : 'bg-green-50 text-green-600 hover:bg-green-100'
                              }`}
                              title={
                                hasStock
                                  ? `${size} ${color} - ${stock} disponibles. Click para agregar`
                                  : `${size} ${color} - Sin stock`
                              }
                            >
                              {stock}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Leyenda */}
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-50 border rounded"></div>
                  <span>Stock OK</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-amber-50 border rounded"></div>
                  <span>Stock bajo</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-red-50 border rounded"></div>
                  <span>Sin stock</span>
                </div>
                <div className="ml-auto text-gray-400">
                  Click en una celda con stock para agregar al carrito
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
