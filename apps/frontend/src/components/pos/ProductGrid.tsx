import {
  ShoppingCart,
  Loader2,
  Tag,
} from 'lucide-react';
import { Product, QuickAccessCategory, ActivePromotion, getProductPrice } from '../../hooks/usePOSSetup';

interface ProductGridProps {
  products: Product[];
  filteredProducts: Product[];
  searchResults: Product[];
  selectedCategory: string | null;
  quickAccessCategories: QuickAccessCategory[];
  onCategorySelect: (categoryId: string | null) => void;
  onProductClick: (product: Product) => void;
  getProductPromotion: (product: Product) => ActivePromotion | null;
  formatPromotionBadge: (promo: ActivePromotion) => string;
  isLoadingProducts: boolean;
  searchQuery: string;
}

export default function ProductGrid({
  filteredProducts,
  searchResults,
  selectedCategory,
  quickAccessCategories,
  onCategorySelect,
  onProductClick,
  getProductPromotion,
  formatPromotionBadge,
  isLoadingProducts,
}: ProductGridProps) {
  return (
    <>
      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <div className="absolute top-20 left-4 right-[396px] bg-white rounded-lg shadow-lg border z-10 max-h-96 overflow-y-auto">
          {searchResults.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                product.isParent ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <ShoppingCart className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{product.name}</p>
                  {product.isParent && (
                    <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                      Talles
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {product.sku} | {product.barcode}
                  {product.size && ` | T: ${product.size}`}
                  {product.color && ` | ${product.color}`}
                </p>
              </div>
              <p className="font-semibold">
                ${getProductPrice(product).toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Acceso Rápido - Categorías destacadas */}
      {quickAccessCategories.length > 0 && (
        <div className="shrink-0 bg-gradient-to-r from-primary-50 to-emerald-50 border-b">
          <div className="flex gap-2 p-3 overflow-x-auto">
            <button
              onClick={() => onCategorySelect(null)}
              className={`flex items-center justify-center px-5 py-3 rounded-xl border-2 font-semibold whitespace-nowrap transition-all hover:scale-105 hover:shadow-md min-w-[100px] ${
                !selectedCategory
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-primary-600 border-primary-600'
              }`}
            >
              Todos
            </button>
            {quickAccessCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategorySelect(selectedCategory === cat.id ? null : cat.id)}
                style={{
                  backgroundColor: selectedCategory === cat.id
                    ? (cat.quickAccessColor || '#3b82f6')
                    : 'white',
                  borderColor: cat.quickAccessColor || '#3b82f6',
                  color: selectedCategory === cat.id ? 'white' : (cat.quickAccessColor || '#3b82f6'),
                }}
                className="flex items-center justify-center px-5 py-3 rounded-xl border-2 font-semibold whitespace-nowrap transition-all hover:scale-105 hover:shadow-md min-w-[100px]"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid de productos */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingProducts ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => {
              const promo = getProductPromotion(product);
              return (
                <button
                  key={product.id}
                  onClick={() => onProductClick(product)}
                  style={promo ? {
                    borderColor: `${promo.badgeColor || '#22C55E'}40`,
                  } : product.isParent ? {
                    borderColor: '#a855f740',
                  } : undefined}
                  className={`bg-white rounded-xl p-3 shadow-sm border-2 transition-all text-left relative ${
                    promo
                      ? 'hover:shadow-md'
                      : product.isParent
                      ? 'hover:shadow-md hover:border-purple-400'
                      : 'border-gray-100 hover:shadow-md hover:border-primary-200'
                  }`}
                  onMouseEnter={(e) => {
                    if (promo) {
                      e.currentTarget.style.borderColor = `${promo.badgeColor || '#22C55E'}80`;
                    } else if (product.isParent) {
                      e.currentTarget.style.borderColor = '#a855f780';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (promo) {
                      e.currentTarget.style.borderColor = `${promo.badgeColor || '#22C55E'}40`;
                    } else if (product.isParent) {
                      e.currentTarget.style.borderColor = '#a855f740';
                    }
                  }}
                >
                  {/* Badge de promoción */}
                  {promo && (
                    <div
                      style={{ backgroundColor: promo.badgeColor || '#22C55E' }}
                      className="absolute -top-2 -right-2 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 z-10"
                    >
                      <Tag className="w-3 h-3" />
                      {formatPromotionBadge(promo)}
                    </div>
                  )}
                  {/* Badge de producto padre (curva de talles) - siempre visible */}
                  {product.isParent && (
                    <div className={`absolute ${promo ? '-top-2 -left-2' : '-top-2 -right-2'} bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10`}>
                      Talles
                    </div>
                  )}
                  <div className={`aspect-square rounded-lg mb-2 flex items-center justify-center overflow-hidden ${
                    product.isParent ? 'bg-purple-50' : 'bg-gray-100'
                  }`}>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingCart className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <p className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
                    {product.shortName || product.name}
                  </p>
                  <p className="text-primary-600 font-semibold mt-1">
                    ${getProductPrice(product).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 truncate">
                    {product.barcode && <span>{product.barcode}</span>}
                    {product.barcode && product.cianboxProductId && <span> | </span>}
                    {product.cianboxProductId && <span>CB:{product.cianboxProductId}</span>}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
