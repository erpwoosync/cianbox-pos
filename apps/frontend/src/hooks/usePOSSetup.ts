import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { productsService, salesService, pointsOfSaleService, promotionsService, categoriesService, cashService } from '../services/api';
import { useIndexedDB } from './useIndexedDB';
import { STORES } from '../services/indexedDB';
import { CartItem, Ticket } from './useCart';
import { offlineSyncService } from '../services/offlineSync';

// Helper para obtener el precio del producto
const getProductPrice = (product: Product): number => {
  // Primero intentar basePrice
  if (product.basePrice != null) {
    const price = Number(product.basePrice);
    if (!isNaN(price)) return price;
  }
  // Luego buscar en prices (primer precio disponible)
  if (product.prices && product.prices.length > 0) {
    const price = Number(product.prices[0].price);
    if (!isNaN(price)) return price;
  }
  return 0;
};

export interface Product {
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
    priceList?: { id: string; name: string }
  }>;
  stock?: Array<{
    quantity?: number;
    reserved?: number;
    available?: number;
  }>;
  // Productos variables (curva de talles)
  isParent?: boolean;
  parentProductId?: string | null;
  parentName?: string;
  size?: string | null;
  color?: string | null;
}

interface AppliedPromotion {
  id: string;
  name: string;
  type: string;
  discount: number;
}

export interface ActivePromotion {
  id: string;
  name: string;
  type: string;
  applyTo: string;
  categoryIds?: string[];
  brandIds?: string[];
  discountValue: number;
  discountType: string;
  buyQuantity?: number;
  getQuantity?: number;
  applicableProducts?: { productId: string }[];
  badgeColor?: string | null;
}

export interface QuickAccessCategory {
  id: string;
  name: string;
  quickAccessColor?: string | null;
  quickAccessIcon?: string | null;
  quickAccessOrder?: number;
  isDefaultQuickAccess?: boolean;
  _count?: { products: number };
}

export interface PointOfSale {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  branch?: { id: string; name: string };
  priceList?: { id: string; name: string; currency: string };
  mpDeviceId?: string;
  mpDeviceName?: string;
  surchargeDisplayMode?: 'SEPARATE_ITEM' | 'DISTRIBUTED';
  cianboxPointOfSaleId?: number | null;
}

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR' | 'TRANSFER' | 'GIFT_CARD' | 'VOUCHER';

interface SaleData {
  branchId: string;
  pointOfSaleId: string;
  items: Array<{
    productId?: string;
    productCode?: string;
    productName: string;
    productBarcode?: string;
    quantity: number;
    unitPrice: number;
    unitPriceNet: number;
    discount: number;
    taxRate: number;
    promotionId?: string;
    promotionName?: string;
    priceListId?: string;
    branchId: string;
    isSurcharge?: boolean;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    amountTendered?: number;
    transactionId?: string;
    cardBrand?: string;
    cardLastFour?: string;
    installments?: number;
    giftCardCode?: string;
  }>;
  cianboxTalonarioId?: number;
  cianboxTalonarioFiscal?: boolean;
}

export interface PendingSale {
  id: string;
  saleData: SaleData;
  createdAt: string;
  attempts: number;
}

// Data para abrir el TalleSelectorModal desde POS.tsx
export interface PendingTalleData {
  variantes: Array<{
    id: string;
    sku: string;
    barcode: string;
    name: string;
    size: string;
    color?: string;
    stock: number;
    price: number;
  }>;
  parentInfo: { name: string; price: number };
}

interface UsePOSSetupParams {
  cartItems: CartItem[];
  currentTicketId: string | null;
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  addToCart: (product: Product) => void;
  user: { branch?: { id: string; name: string } } | null;
}

export function usePOSSetup({
  cartItems,
  currentTicketId,
  setTickets,
  addToCart,
  user,
}: UsePOSSetupParams) {
  // Estado de productos y categorías
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [quickAccessCategories, setQuickAccessCategories] = useState<QuickAccessCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Estado de búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estado de punto de venta
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [selectedPOS, setSelectedPOS] = useState<PointOfSale | null>(null);
  const [showPOSSelector, setShowPOSSelector] = useState(false);

  // Estado offline/online
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useIndexedDB<PendingSale>(STORES.PENDING_SALES, []);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estado de promociones
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);
  const [isCalculatingPromotions, setIsCalculatingPromotions] = useState(false);
  const lastCalculatedCartKeyRef = useRef<string>('');

  // Estado para señalizar a POS.tsx qué modal abrir tras búsqueda
  const [pendingVariantProduct, setPendingVariantProduct] = useState<Product | null>(null);
  const [pendingTalleData, setPendingTalleData] = useState<PendingTalleData | null>(null);

  // Sincronizar ventas pendientes
  const syncPendingSales = async () => {
    if (isSyncing || pendingSales.length === 0 || !isOnline) {
      return;
    }

    setIsSyncing(true);
    console.log(`[POS] Sincronizando ${pendingSales.length} ventas pendientes...`);

    const remaining: PendingSale[] = [];

    for (const pendingSale of pendingSales) {
      try {
        const response = await salesService.create(pendingSale.saleData);
        if (response.success) {
          console.log(`[POS] Venta pendiente ${pendingSale.id} sincronizada`);
        } else {
          // Si falla, reintentar más tarde
          remaining.push({
            ...pendingSale,
            attempts: pendingSale.attempts + 1,
          });
        }
      } catch (error) {
        console.error(`[POS] Error sincronizando venta ${pendingSale.id}:`, error);
        // Guardar para reintentar (máximo 5 intentos)
        if (pendingSale.attempts < 5) {
          remaining.push({
            ...pendingSale,
            attempts: pendingSale.attempts + 1,
          });
        }
      }
    }

    // Actualizar lista de pendientes (IndexedDB se actualiza automáticamente)
    setPendingSales(remaining);
    setIsSyncing(false);

    if (remaining.length === 0) {
      console.log('[POS] Todas las ventas pendientes han sido sincronizadas');
    } else {
      console.log(`[POS] Quedan ${remaining.length} ventas pendientes`);
    }
  };

  // Detectar cambios de estado online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('[POS] Conexión restaurada');
      setIsOnline(true);
      // Auto-sincronizar ventas pendientes
      syncPendingSales();
    };

    const handleOffline = () => {
      console.log('[POS] Sin conexión');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingSales]);

  // Cargar categorías y productos
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [quickAccessRes, productsRes, posRes, promotionsRes] = await Promise.all([
        categoriesService.getQuickAccess(),
        productsService.list({ pageSize: 50 }),
        pointsOfSaleService.list(),
        promotionsService.getActive(),
      ]);

      if (quickAccessRes.success) {
        setQuickAccessCategories(quickAccessRes.data);

        // Seleccionar la categoría por defecto si existe
        const defaultCategory = quickAccessRes.data.find(
          (cat: QuickAccessCategory) => cat.isDefaultQuickAccess
        );
        if (defaultCategory) {
          setSelectedCategory(defaultCategory.id);
        }
      }

      if (productsRes.success) {
        setProducts(productsRes.data);
      }

      if (promotionsRes.success) {
        setActivePromotions(promotionsRes.data || []);
      }

      if (posRes.success) {
        // Filtrar puntos de venta activos de la sucursal del usuario
        const userBranchId = user?.branch?.id;
        const activePOS = posRes.data.filter(
          (pos: PointOfSale) => pos.isActive && (!userBranchId || pos.branch?.id === userBranchId)
        );
        setPointsOfSale(activePOS);

        if (activePOS.length === 0) {
          alert('No hay puntos de venta configurados para esta sucursal');
          return;
        }

        // Verificar si el usuario ya tiene una sesión de caja abierta
        try {
          const cashRes = await cashService.getCurrent();
          const openSession = cashRes.data?.session;
          if (cashRes.success && cashRes.data.hasOpenSession && openSession) {
            // Auto-seleccionar el POS de la sesión abierta
            const sessionPOS = activePOS.find(
              (pos: PointOfSale) => pos.id === openSession.pointOfSaleId
            );
            if (sessionPOS) {
              setSelectedPOS(sessionPOS);
              return;
            }
          }
        } catch (error) {
          console.error('Error verificando sesión de caja:', error);
        }

        // Si no hay sesión abierta, auto-seleccionar si solo hay un POS o mostrar selector
        if (activePOS.length === 1) {
          setSelectedPOS(activePOS[0]);
        } else {
          setShowPOSSelector(true);
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setIsLoadingProducts(false);

      // Sincronizar datos a IndexedDB en segundo plano
      offlineSyncService.syncAll().catch(console.error);
    }
  };

  // Clave única del carrito para detectar cambios en productos/cantidades
  const cartKey = useMemo(() => {
    return cartItems
      .map((item: CartItem) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(',');
  }, [cartItems]);

  // Efecto para calcular promociones cuando cambia el carrito
  useEffect(() => {
    if (cartItems.length === 0) {
      lastCalculatedCartKeyRef.current = '';
      return;
    }

    // Evitar recalcular si el carrito no ha cambiado
    if (cartKey === lastCalculatedCartKeyRef.current) {
      return;
    }

    const calculatePromotions = async () => {
      setIsCalculatingPromotions(true);
      try {
        // Excluir items de devolución y recargos del cálculo de promociones
        const regularItems = cartItems.filter((item: CartItem) => !item.isReturn && !item.isSurcharge);

        if (regularItems.length === 0) {
          // Si solo hay devoluciones, no calcular promociones
          lastCalculatedCartKeyRef.current = cartKey;
          setIsCalculatingPromotions(false);
          return;
        }

        const itemsForCalculation = regularItems.map((item: CartItem) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

        const response = await promotionsService.calculate(itemsForCalculation);

        if (response.success && response.data) {
          // Guardar la clave actual para evitar recálculos
          lastCalculatedCartKeyRef.current = cartKey;

          // Actualizar items con los descuentos calculados
          setTickets((prev: Ticket[]) =>
            prev.map((ticket: Ticket) =>
              ticket.id === currentTicketId
                ? {
                    ...ticket,
                    items: ticket.items.map((item: CartItem) => {
                      // NUNCA aplicar promociones a items de devolución o recargo
                      if (item.isReturn || item.isSurcharge) {
                        return item;
                      }

                      const promoItem = response.data.items?.find(
                        (pi: { productId: string; discount?: number; promotion?: { id: string; name: string; type: string } | null; promotions?: AppliedPromotion[] }) =>
                          pi.productId === item.product.id
                      );
                      if (promoItem && promoItem.discount > 0) {
                        return {
                          ...item,
                          discount: promoItem.discount,
                          subtotal: item.quantity * item.unitPrice - promoItem.discount,
                          promotionId: promoItem.promotion?.id,
                          promotionName: promoItem.promotion?.name,
                          promotions: promoItem.promotions || (promoItem.promotion ? [{
                            id: promoItem.promotion.id,
                            name: promoItem.promotion.name,
                            type: promoItem.promotion.type,
                            discount: promoItem.discount,
                          }] : []),
                        };
                      }
                      // Si no hay promo, resetear descuento
                      return {
                        ...item,
                        discount: 0,
                        subtotal: item.quantity * item.unitPrice,
                        promotionId: undefined,
                        promotionName: undefined,
                        promotions: [],
                      };
                    }),
                  }
                : ticket
            )
          );
        }
      } catch (error) {
        console.error('Error calculando promociones:', error);
      } finally {
        setIsCalculatingPromotions(false);
      }
    };

    // Debounce para evitar llamadas excesivas
    const timer = setTimeout(() => {
      calculatePromotions();
    }, 300);

    return () => clearTimeout(timer);
  }, [cartKey, currentTicketId]);

  // Búsqueda de productos
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await productsService.search(
        query,
        undefined,
        user?.branch?.id
      );
      if (response.success) {
        // Caso: Escaneo de código padre con múltiples variantes
        if (response.isParentSearch && response.data.length > 1) {
          // Detectar si hay múltiples colores
          const coloresUnicos = new Set(response.data.map((p: Product) => p.color).filter(Boolean));
          const tieneMultiplesColores = coloresUnicos.size > 1;

          // Si hay múltiples colores, usar SizeCurveModal (matriz talle x color)
          if (tieneMultiplesColores && response.parent) {
            const parentProduct: Product = {
              id: response.parent.id,
              sku: response.parent.sku || '',
              barcode: response.parent.barcode || '',
              name: response.parent.name,
              basePrice: response.parent.price,
              isParent: true,
            };
            setPendingVariantProduct(parentProduct);
            setSearchQuery('');
            setSearchResults([]);
            return;
          }

          // Si solo hay talles (o un solo color), usar TalleSelectorModal
          const variantes = response.data.map((p: Product) => ({
            id: p.id,
            sku: p.sku,
            barcode: p.barcode,
            name: p.name,
            size: p.size || '',
            color: p.color || undefined,
            stock: p.stock?.reduce((sum: number, s: { available?: number }) => sum + (s.available || 0), 0) || 0,
            price: getProductPrice(p),
          }));

          setPendingTalleData({
            variantes,
            parentInfo: {
              name: response.parent?.name || response.data[0].parentName || response.data[0].name,
              price: response.parent?.price || getProductPrice(response.data[0]),
            },
          });
          setSearchQuery('');
          setSearchResults([]);
          return;
        }

        setSearchResults(response.data);

        // Si es un código de barras exacto y hay un resultado, agregar al carrito
        if (response.data.length === 1 && response.data[0].barcode === query) {
          // Si es producto padre, señalizar para abrir modal
          if (response.data[0].isParent) {
            setPendingVariantProduct(response.data[0]);
          } else {
            addToCart(response.data[0]);
          }
          setSearchQuery('');
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
    } finally {
      setIsSearching(false);
    }
  }, [user?.branch?.id, addToCart]);

  // Obtener promoción aplicable para un producto
  const getProductPromotion = useCallback((product: Product): ActivePromotion | null => {
    if (!activePromotions.length) return null;

    for (const promo of activePromotions) {
      let isApplicable = false;

      switch (promo.applyTo) {
        case 'ALL_PRODUCTS':
          isApplicable = true;
          break;
        case 'SPECIFIC_PRODUCTS':
          isApplicable = promo.applicableProducts?.some(p => p.productId === product.id) || false;
          break;
        case 'CATEGORIES':
          isApplicable = !!product.category?.id && !!promo.categoryIds?.includes(product.category.id);
          break;
        case 'BRANDS':
          isApplicable = !!product.brand?.id && !!promo.brandIds?.includes(product.brand.id);
          break;
      }

      if (isApplicable) {
        return promo;
      }
    }
    return null;
  }, [activePromotions]);

  // Formatear descuento para mostrar badge
  const formatPromotionBadge = (promo: ActivePromotion): string => {
    switch (promo.type) {
      case 'PERCENTAGE':
        return `-${promo.discountValue}%`;
      case 'FIXED_AMOUNT':
        return `-$${promo.discountValue}`;
      case 'BUY_X_GET_Y':
        return `${promo.buyQuantity || 1}x${promo.getQuantity || 2}`;
      case 'SECOND_UNIT_DISCOUNT':
        return `2da -${promo.discountValue}%`;
      case 'FLASH_SALE':
        return `-${promo.discountValue}%`;
      default:
        return 'Promo';
    }
  };

  // Filtrar productos por categoría
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category?.id === selectedCategory)
    : products;

  return {
    // Productos y categorías
    products,
    setProducts,
    isLoadingProducts,
    quickAccessCategories,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,

    // Búsqueda
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    handleSearch,

    // Punto de venta
    pointsOfSale,
    setPointsOfSale,
    selectedPOS,
    setSelectedPOS,
    showPOSSelector,
    setShowPOSSelector,

    // Online/offline
    isOnline,
    pendingSales,
    setPendingSales,
    isSyncing,
    syncPendingSales,

    // Promociones
    activePromotions,
    isCalculatingPromotions,
    getProductPromotion,
    formatPromotionBadge,

    // Señales para modales de variantes (POS.tsx consume y resetea)
    pendingVariantProduct,
    setPendingVariantProduct,
    pendingTalleData,
    setPendingTalleData,

    // Helpers exportados
    getProductPrice,
  };
}

export { getProductPrice };
