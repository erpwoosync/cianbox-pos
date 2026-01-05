import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  ArrowLeft,
  Tag,
  X,
  Check,
  Loader2,
  WifiOff,
  Wifi,
  RefreshCw,
  Smartphone,
  Layers,
  User,
  Receipt,
  RotateCcw,
  Ticket,
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import { productsService, salesService, pointsOfSaleService, mercadoPagoService, cashService, promotionsService, categoriesService, storeCreditsService, MPOrderResult, MPPaymentDetails, CashSession } from '../services/api';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useIndexedDB } from '../hooks/useIndexedDB';
import { STORES } from '../services/indexedDB';
import MPPointPaymentModal from '../components/MPPointPaymentModal';
import MPQRPaymentModal from '../components/MPQRPaymentModal';
import OrphanPaymentModal from '../components/OrphanPaymentModal';
import CashPanel from '../components/CashPanel';
import CashOpenModal from '../components/CashOpenModal';
import CashMovementModal from '../components/CashMovementModal';
import CashCountModal from '../components/CashCountModal';
import SizeCurveModal from '../components/SizeCurveModal';
import ProductSearchModal from '../components/ProductSearchModal';
import TalleSelectorModal from '../components/TalleSelectorModal';
import CustomerSelectorModal from '../components/CustomerSelectorModal';
import InvoiceModal from '../components/InvoiceModal';
import SalesHistoryModal from '../components/SalesHistoryModal';
import ProductRefundModal from '../components/ProductRefundModal';
import StoreCreditModal from '../components/StoreCreditModal';
import GiftCardPaymentSection, { AppliedGiftCard } from '../components/GiftCardPaymentSection';
import StoreCreditPaymentSection, { AppliedStoreCredit } from '../components/StoreCreditPaymentSection';
import CashRequiredOverlay from '../components/CashRequiredOverlay';
import { Customer, CONSUMIDOR_FINAL } from '../services/customers';
import { offlineSyncService } from '../services/offlineSync';

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

interface ActivePromotion {
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

// Helper para generar IDs únicos
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

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

// Helper para obtener el precio neto (sin IVA) del producto
const getProductPriceNet = (product: Product): number => {
  // Buscar en prices (primer precio disponible)
  if (product.prices && product.prices.length > 0 && product.prices[0].priceNet != null) {
    const priceNet = Number(product.prices[0].priceNet);
    if (!isNaN(priceNet)) return priceNet;
  }
  // Si no hay priceNet, calcular desde price y taxRate
  const price = getProductPrice(product);
  const taxRate = product.taxRate || 21;
  return price / (1 + taxRate / 100);
};

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  unitPriceNet: number;
  discount: number;
  subtotal: number;
  promotionId?: string;
  promotionName?: string;
  promotions?: AppliedPromotion[];
  // Propiedades de devolución
  isReturn?: boolean;
  originalSaleId?: string;
  originalSaleItemId?: string;
  returnReason?: string;
}

interface Ticket {
  id: string;
  number: number;
  name: string;
  items: CartItem[];
  createdAt: string;
  customerId?: string;
  customerName?: string;
  customerTaxId?: string;
  customerTaxIdType?: string;
}

interface QuickAccessCategory {
  id: string;
  name: string;
  quickAccessColor?: string | null;
  quickAccessIcon?: string | null;
  quickAccessOrder?: number;
  isDefaultQuickAccess?: boolean;
  _count?: { products: number };
}

interface PointOfSale {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  branch?: { id: string; name: string };
  priceList?: { id: string; name: string; currency: string };
  mpDeviceId?: string;
  mpDeviceName?: string;
}

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR' | 'TRANSFER' | 'GIFT_CARD' | 'VOUCHER';

interface SaleData {
  branchId: string;
  pointOfSaleId: string;
  items: Array<{
    productId: string;
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
}

interface PendingSale {
  id: string;
  saleData: SaleData;
  createdAt: string;
  attempts: number;
}

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Estado de tickets (múltiples ventas en paralelo) - persistido en IndexedDB
  const initialTicket: Ticket = {
    id: generateId(),
    number: 1,
    name: 'Ticket #1',
    items: [],
    createdAt: new Date().toISOString(),
  };

  const [tickets, setTickets] = useIndexedDB<Ticket>(STORES.TICKETS, [initialTicket]);
  const [currentTicketId, setCurrentTicketId] = useLocalStorage<string | null>(
    'pos_current_ticket',
    initialTicket.id
  );

  // Ref para tener siempre el ticket activo actualizado (evita problemas de closure)
  const currentTicketIdRef = useRef(currentTicketId);
  useEffect(() => {
    currentTicketIdRef.current = currentTicketId;
  }, [currentTicketId]);

  const [showTicketList, setShowTicketList] = useState(false);

  // Estado del carrito (computed from current ticket)
  const cart = tickets.find((t: Ticket) => t.id === currentTicketId)?.items || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estado de productos y categorías
  const [quickAccessCategories, setQuickAccessCategories] = useState<QuickAccessCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Estado de punto de venta
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [selectedPOS, setSelectedPOS] = useState<PointOfSale | null>(null);
  const [showPOSSelector, setShowPOSSelector] = useState(false);

  // Estado del pago
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Estado de Mercado Pago
  const [showMPPointModal, setShowMPPointModal] = useState(false);
  const [showMPQRModal, setShowMPQRModal] = useState(false);
  const [showOrphanPaymentModal, setShowOrphanPaymentModal] = useState(false);
  const [mpPointAvailable, setMpPointAvailable] = useState(false);
  const [mpQRAvailable, setMpQRAvailable] = useState(false);

  // Estado de Store Credit (Vales)
  const [showStoreCreditModal, setShowStoreCreditModal] = useState(false);

  // Estado de curva de talles (productos variables)
  const [showSizeCurveModal, setShowSizeCurveModal] = useState(false);
  const [selectedParentProduct, setSelectedParentProduct] = useState<Product | null>(null);

  // Estado de consultor de productos
  const [showProductSearchModal, setShowProductSearchModal] = useState(false);

  // Estado de historial de ventas
  const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false);

  // Estado de devoluciones (flujo orientado a producto)
  const [showProductRefundModal, setShowProductRefundModal] = useState(false);

  // Estado de cliente (derivado del ticket actual)
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // El cliente se almacena en cada ticket, no globalmente
  const currentTicket = tickets.find((t: Ticket) => t.id === currentTicketId);
  const selectedCustomer: Customer | null = currentTicket?.customerId
    ? {
        id: currentTicket.customerId,
        name: currentTicket.customerName || 'Cliente',
        taxId: currentTicket.customerTaxId,
        taxIdType: currentTicket.customerTaxIdType as Customer['taxIdType'],
      }
    : null;

  // Estado de selector de talles (escaneo de código padre)
  const [showTalleSelectorModal, setShowTalleSelectorModal] = useState(false);
  const [talleVariantes, setTalleVariantes] = useState<Array<{
    id: string;
    sku: string;
    barcode: string;
    name: string;
    size: string;
    color?: string;
    stock: number;
    price: number;
  }>>([]);
  const [talleParentInfo, setTalleParentInfo] = useState<{ name: string; price: number } | null>(null);

  // Estado offline/online
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useIndexedDB<PendingSale>(STORES.PENDING_SALES, []);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estado de caja
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [expectedCash, setExpectedCash] = useState(0);
  const [showCashOpenModal, setShowCashOpenModal] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<'deposit' | 'withdraw'>('deposit');
  const [showCashCountModal, setShowCashCountModal] = useState(false);
  const [cashCountMode, setCashCountMode] = useState<'partial' | 'closing'>('partial');
  // Configuracion de caja: 'REQUIRED' = obligatorio, 'OPTIONAL' = opcional, 'AUTO' = automatico
  // Por ahora hardcodeado a 'OPTIONAL', se puede configurar desde backend/backoffice
  const [cashMode] = useState<'REQUIRED' | 'OPTIONAL' | 'AUTO'>('OPTIONAL');
  const cashRequired = cashMode === 'REQUIRED' && !cashSession;

  // Estado de gift cards
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  const giftCardAmount = appliedGiftCards.reduce((sum, gc) => sum + gc.amountApplied, 0);

  // Estado de store credits (vales)
  const [appliedStoreCredits, setAppliedStoreCredits] = useState<AppliedStoreCredit[]>([]);
  const storeCreditAmount = appliedStoreCredits.reduce((sum, sc) => sum + sc.amountApplied, 0);

  // Estado de créditos disponibles del cliente (para sugerir uso)
  const [customerCredits, setCustomerCredits] = useState<{
    totalAvailable: number;
    count: number;
  } | null>(null);

  // Estado de promociones
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);
  const [isCalculatingPromotions, setIsCalculatingPromotions] = useState(false);
  const lastCalculatedCartKeyRef = useRef<string>('');

  // Estado de facturación AFIP
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState<{
    id: string;
    saleNumber: string;
    total: number;
    customerName?: string;
  } | null>(null);

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

  // Cargar créditos disponibles del cliente cuando cambia
  useEffect(() => {
    const loadCustomerCredits = async () => {
      // Si no hay cliente o es Consumidor Final, limpiar créditos
      if (!selectedCustomer || selectedCustomer.id === CONSUMIDOR_FINAL.id) {
        setCustomerCredits(null);
        return;
      }

      try {
        const result = await storeCreditsService.getCustomerCredits(selectedCustomer.id);
        if (result.success && result.totalAvailable > 0) {
          setCustomerCredits({
            totalAvailable: result.totalAvailable,
            count: result.count,
          });
        } else {
          setCustomerCredits(null);
        }
      } catch (error) {
        console.error('Error cargando créditos del cliente:', error);
        setCustomerCredits(null);
      }
    };

    loadCustomerCredits();
  }, [selectedCustomer?.id]);

  // Cargar sesión de caja cuando se selecciona POS
  useEffect(() => {
    if (selectedPOS) {
      loadCashSession();
    }
  }, [selectedPOS]);

  const loadCashSession = async () => {
    try {
      const response = await cashService.getCurrent();
      if (response.success) {
        setCashSession(response.data.session);
        setExpectedCash(response.data.expectedCash || 0);
        // Si no hay sesión abierta, mostrar modal para abrir
        if (!response.data.hasOpenSession && selectedPOS) {
          setShowCashOpenModal(true);
        }
      }
    } catch (error) {
      console.error('Error cargando sesión de caja:', error);
    }
  };

  const handleCashSessionOpened = (session: CashSession) => {
    setCashSession(session);
    setExpectedCash(Number(session.openingAmount));
    setShowCashOpenModal(false);
  };

  const handleDeposit = () => {
    setCashMovementType('deposit');
    setShowCashMovementModal(true);
  };

  const handleWithdraw = () => {
    setCashMovementType('withdraw');
    setShowCashMovementModal(true);
  };

  const handleCount = () => {
    setCashCountMode('partial');
    setShowCashCountModal(true);
  };

  const handleCloseCash = () => {
    setCashCountMode('closing');
    setShowCashCountModal(true);
  };

  const handleCashMovementSuccess = () => {
    loadCashSession();
    setShowCashMovementModal(false);
  };

  const handleCashCountSuccess = () => {
    loadCashSession();
    setShowCashCountModal(false);
    if (cashCountMode === 'closing') {
      // Sesión cerrada, mostrar modal para abrir nueva si es necesario
      setCashSession(null);
      if (selectedPOS) {
        setShowCashOpenModal(true);
      }
    }
  };

  // Verificar disponibilidad de Mercado Pago cuando se selecciona un POS
  useEffect(() => {
    const checkMPAvailability = async () => {
      if (!selectedPOS) {
        setMpPointAvailable(false);
        setMpQRAvailable(false);
        return;
      }

      // Verificar MP Point (requiere device asociado al POS)
      try {
        const pointConfig = await mercadoPagoService.checkPointConfig(selectedPOS.id);
        setMpPointAvailable(pointConfig.hasDevice);
      } catch (error) {
        console.error('Error checking MP Point config:', error);
        setMpPointAvailable(false);
      }

      // Verificar MP QR
      try {
        const qrConfig = await mercadoPagoService.checkQRConfig();
        setMpQRAvailable(qrConfig.isConnected);
      } catch (error) {
        console.error('Error checking MP QR config:', error);
        setMpQRAvailable(false);
      }
    };

    checkMPAvailability();
  }, [selectedPOS]);

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
              setCashSession(openSession);
              setExpectedCash(cashRes.data.expectedCash || 0);
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

  // Gestión de tickets
  const createNewTicket = () => {
    const newTicket: Ticket = {
      id: generateId(),
      number: tickets.length + 1,
      name: `Ticket #${tickets.length + 1}`,
      items: [],
      createdAt: new Date().toISOString(),
    };
    setTickets((prev: Ticket[]) => [...prev, newTicket]);
    setCurrentTicketId(newTicket.id);
    setShowTicketList(false);
  };

  const switchTicket = (ticketId: string) => {
    setCurrentTicketId(ticketId);
    setShowTicketList(false);
  };

  const deleteTicket = (ticketId: string) => {
    setTickets((prev: Ticket[]) => {
      const filtered = prev.filter((t: Ticket) => t.id !== ticketId);

      // Si no quedan tickets, crear uno nuevo inmediatamente
      if (filtered.length === 0) {
        const newTicket: Ticket = {
          id: generateId(),
          number: 1,
          name: 'Ticket #1',
          items: [],
          createdAt: new Date().toISOString(),
        };
        setCurrentTicketId(newTicket.id);
        return [newTicket];
      }

      // Si eliminamos el ticket actual, seleccionar el último de los que quedan
      if (ticketId === currentTicketId) {
        setCurrentTicketId(filtered[filtered.length - 1].id);
      }

      return filtered;
    });
  };

  // Actualizar items del ticket actual (usa ref para evitar problemas de closure)
  const updateCart = (updater: (items: CartItem[]) => CartItem[]) => {
    const ticketId = currentTicketIdRef.current;
    if (!ticketId) return;
    setTickets((prev: Ticket[]) =>
      prev.map((ticket: Ticket) =>
        ticket.id === ticketId
          ? { ...ticket, items: updater(ticket.items) }
          : ticket
      )
    );
  };

  // Actualizar cliente del ticket actual (usa ref para evitar problemas de closure)
  const updateTicketCustomer = (customer: Customer | null) => {
    const ticketId = currentTicketIdRef.current;
    if (!ticketId) return;
    setTickets((prev: Ticket[]) =>
      prev.map((ticket: Ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              customerId: customer?.id,
              customerName: customer?.name,
              customerTaxId: customer?.taxId,
              customerTaxIdType: customer?.taxIdType,
            }
          : ticket
      )
    );
  };

  // Clave única del carrito para detectar cambios en productos/cantidades
  const cartKey = useMemo(() => {
    return cart
      .map((item: CartItem) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(',');
  }, [cart]);

  // Efecto para calcular promociones cuando cambia el carrito
  useEffect(() => {
    if (cart.length === 0) {
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
        // Excluir items de devolución del cálculo de promociones
        const regularItems = cart.filter((item: CartItem) => !item.isReturn);

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
                      // NUNCA aplicar promociones a items de devolución
                      if (item.isReturn) {
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
            setSelectedParentProduct(parentProduct);
            setShowSizeCurveModal(true);
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

          setTalleVariantes(variantes);
          setTalleParentInfo({
            name: response.parent?.name || response.data[0].parentName || response.data[0].name,
            price: response.parent?.price || getProductPrice(response.data[0]),
          });
          setShowTalleSelectorModal(true);
          setSearchQuery('');
          setSearchResults([]);
          return;
        }

        setSearchResults(response.data);

        // Si es un código de barras exacto y hay un resultado, agregar al carrito
        if (response.data.length === 1 && response.data[0].barcode === query) {
          // Si es producto padre, mostrar selector
          if (response.data[0].isParent) {
            handleProductClick(response.data[0]);
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
  }, [user?.branch?.id]);

  // Agregar producto al carrito
  const addToCart = (product: Product) => {
    updateCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].subtotal =
          updated[existingIndex].quantity * updated[existingIndex].unitPrice -
          updated[existingIndex].discount;
        return updated;
      }

      const price = getProductPrice(product);
      const priceNet = getProductPriceNet(product);
      return [
        ...prev,
        {
          id: generateId(),
          product,
          quantity: 1,
          unitPrice: price,
          unitPriceNet: priceNet,
          discount: 0,
          subtotal: price,
        },
      ];
    });

    setSearchQuery('');
    setSearchResults([]);
  };

  // Agregar item de devolución al carrito (negativo para cambio)
  const addReturnItemToCart = (returnItem: {
    product: {
      id: string;
      name: string;
      sku?: string;
      barcode?: string;
      taxRate?: number;
    };
    quantity: number;
    unitPrice: number;
    unitPriceNet: number;
    subtotal: number;
    originalSaleId: string;
    originalSaleItemId: string;
    returnReason?: string;
  }) => {
    updateCart((prev) => {
      // Crear item negativo (devolución) - SIN promociones
      const returnCartItem: CartItem = {
        id: generateId(),
        product: {
          id: returnItem.product.id,
          name: returnItem.product.name,
          sku: returnItem.product.sku || '',
          barcode: returnItem.product.barcode || '',
          taxRate: returnItem.product.taxRate || 21,
        } as Product,
        quantity: returnItem.quantity,
        unitPrice: returnItem.unitPrice,
        unitPriceNet: returnItem.unitPriceNet,
        discount: 0, // Sin descuento - precio original
        subtotal: -returnItem.subtotal, // Negativo porque es devolución
        isReturn: true,
        originalSaleId: returnItem.originalSaleId,
        originalSaleItemId: returnItem.originalSaleItemId,
        returnReason: returnItem.returnReason,
        // Explícitamente sin promociones
        promotionId: undefined,
        promotionName: undefined,
        promotions: [],
      };
      return [...prev, returnCartItem];
    });

    // Cerrar el modal de devolución
    setShowProductRefundModal(false);
  };

  // Handler para clic en producto - maneja productos padre (curva de talles)
  const handleProductClick = (product: Product) => {
    if (product.isParent) {
      // Si es producto padre, mostrar modal de curva de talles
      setSelectedParentProduct(product);
      setShowSizeCurveModal(true);
    } else {
      // Si es producto simple o variante, agregar directamente
      addToCart(product);
    }
  };

  // Handler cuando se selecciona una variante del modal
  const handleVariantSelect = (variant: Product) => {
    addToCart(variant);
    setShowSizeCurveModal(false);
    setSelectedParentProduct(null);
  };

  // Handler cuando se selecciona un talle del selector rápido
  const handleTalleSelect = (variante: {
    id: string;
    sku: string;
    barcode: string;
    name: string;
    size: string;
    color?: string;
    stock: number;
    price: number;
  }) => {
    // Construir producto para agregar al carrito
    // Usar nombre del padre (el carrito muestra badges separados para talle/color)
    const product: Product = {
      id: variante.id,
      sku: variante.sku,
      barcode: variante.barcode,
      name: talleParentInfo?.name || variante.name,
      basePrice: variante.price,
      size: variante.size,
      color: variante.color || null,
      isParent: false,
    };

    addToCart(product);
    setShowTalleSelectorModal(false);
    setTalleVariantes([]);
    setTalleParentInfo(null);
  };

  // Actualizar cantidad
  const updateQuantity = (itemId: string, delta: number) => {
    updateCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQty = Math.max(0, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.unitPrice - item.discount,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Eliminar item
  const removeItem = (itemId: string) => {
    updateCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Calcular totales
  const subtotal = cart.reduce((sum: number, item: CartItem) => sum + item.subtotal, 0);
  const totalDiscount = cart.reduce((sum: number, item: CartItem) => sum + item.discount, 0);
  const total = subtotal;
  const totalAfterGiftCards = total - giftCardAmount - storeCreditAmount; // Monto pendiente despues de gift cards y vales
  const itemCount = cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  // Si el total se vuelve negativo mientras el panel de pago está abierto,
  // redirigir al modal de vale de crédito
  useEffect(() => {
    if (showPayment && total < 0) {
      setShowPayment(false);
      setShowStoreCreditModal(true);
    }
  }, [showPayment, total]);

  // Agrupar descuentos por promoción
  const discountsByPromotion = cart.reduce((acc, item) => {
    // Usar el array de promotions si existe
    if (item.promotions && item.promotions.length > 0) {
      for (const promo of item.promotions) {
        if (!acc[promo.id]) {
          acc[promo.id] = { name: promo.name, total: 0 };
        }
        acc[promo.id].total += promo.discount;
      }
    } else if (item.promotionId && item.promotionName && item.discount > 0) {
      // Fallback para compatibilidad
      if (!acc[item.promotionId]) {
        acc[item.promotionId] = { name: item.promotionName, total: 0 };
      }
      acc[item.promotionId].total += item.discount;
    }
    return acc;
  }, {} as Record<string, { name: string; total: number }>);

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

  // Calcular vuelto (considerando gift cards y vales aplicados)
  const tenderedAmount = parseFloat(amountTendered) || 0;
  const amountToPay = total - giftCardAmount - storeCreditAmount; // Monto pendiente despues de gift cards y vales
  const change = tenderedAmount - amountToPay;

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

  // Generar referencia externa para órdenes de MP
  const generateExternalReference = () => {
    return `POS-${selectedPOS?.code || 'X'}-${Date.now()}`;
  };

  // Handler para iniciar pago con MP Point
  const handleMPPointPayment = () => {
    if (!selectedPOS) {
      setShowPOSSelector(true);
      return;
    }
    setShowMPPointModal(true);
  };

  // Handler para iniciar pago con MP QR
  const handleMPQRPayment = () => {
    if (!selectedPOS) {
      setShowPOSSelector(true);
      return;
    }
    setShowMPQRModal(true);
  };

  // Handler cuando el pago con MP Point es exitoso
  const handleMPPointPaymentSuccess = async (result: MPOrderResult) => {
    setShowMPPointModal(false);
    await processSaleWithMPPayment(result, false);
  };

  // Handler cuando el pago con MP QR es exitoso
  const handleMPQRPaymentSuccess = async (result: MPOrderResult) => {
    setShowMPQRModal(false);
    await processSaleWithMPPayment(result, true);
  };

  // Handler cuando el pago con MP falla
  const handleMPPaymentError = (error: string) => {
    console.error('Error en pago MP:', error);
    // Los modales manejan su propio estado de error
  };

  // Procesar venta con resultado de pago MP
  const processSaleWithMPPayment = async (mpResult: MPOrderResult, isQR: boolean = false) => {
    if (cart.length === 0 || !selectedPOS) return;

    setIsProcessing(true);
    try {
      // Obtener detalles completos del pago de MP si tenemos paymentId
      let paymentDetails: MPPaymentDetails | null = null;
      if (mpResult.paymentId) {
        try {
          const detailsResponse = await mercadoPagoService.getPaymentDetails(
            mpResult.paymentId,
            isQR ? 'QR' : 'POINT'
          );
          if (detailsResponse.success) {
            paymentDetails = detailsResponse.data;
          }
        } catch (err) {
          console.warn('No se pudieron obtener detalles del pago MP:', err);
        }
      }

      // Determinar el método de pago basado en el resultado
      let paymentMethod: PaymentMethod = 'CREDIT_CARD';
      if (mpResult.paymentMethod === 'debit_card' || paymentDetails?.cardType === 'debit') {
        paymentMethod = 'DEBIT_CARD';
      } else if (mpResult.paymentMethod === 'account_money' || isQR) {
        paymentMethod = 'QR';
      } else if (paymentDetails?.paymentMethodType === 'bank_transfer') {
        paymentMethod = 'TRANSFER';
      }

      // Construir el objeto de pago con todos los detalles de MP
      const paymentData: {
        method: PaymentMethod;
        amount: number;
        transactionId?: string;
        cardBrand?: string;
        cardLastFour?: string;
        installments?: number;
        mpPaymentId?: string;
        mpOrderId?: string;
        mpOperationType?: string;
        mpPointType?: string;
        cardFirstSix?: string;
        cardExpirationMonth?: number;
        cardExpirationYear?: number;
        cardholderName?: string;
        cardType?: string;
        payerEmail?: string;
        payerIdType?: string;
        payerIdNumber?: string;
        authorizationCode?: string;
        mpFeeAmount?: number;
        mpFeeRate?: number;
        netReceivedAmount?: number;
        bankOriginId?: string;
        bankOriginName?: string;
        bankTransferId?: string;
        mpDeviceId?: string;
        mpPosId?: string;
        mpStoreId?: string;
      } = {
        method: paymentMethod,
        amount: Number(total),
        transactionId: mpResult.paymentId || mpResult.orderId,
        cardBrand: paymentDetails?.cardBrand || mpResult.cardBrand,
        cardLastFour: paymentDetails?.cardLastFour || mpResult.cardLastFour,
        installments: paymentDetails?.installments || mpResult.installments,
      };

      // Agregar campos de MP si tenemos detalles
      // Convertir null a undefined para que Zod no falle en campos opcionales
      if (paymentDetails) {
        paymentData.mpPaymentId = paymentDetails.mpPaymentId || undefined;
        paymentData.mpOrderId = paymentDetails.mpOrderId || undefined;
        paymentData.mpOperationType = paymentDetails.mpOperationType || undefined;
        paymentData.mpPointType = paymentDetails.mpPointType || undefined;
        paymentData.cardFirstSix = paymentDetails.cardFirstSix || undefined;
        paymentData.cardExpirationMonth = paymentDetails.cardExpirationMonth || undefined;
        paymentData.cardExpirationYear = paymentDetails.cardExpirationYear || undefined;
        paymentData.cardholderName = paymentDetails.cardholderName || undefined;
        paymentData.cardType = paymentDetails.cardType || undefined;
        paymentData.payerEmail = paymentDetails.payerEmail || undefined;
        paymentData.payerIdType = paymentDetails.payerIdType || undefined;
        paymentData.payerIdNumber = paymentDetails.payerIdNumber || undefined;
        paymentData.authorizationCode = paymentDetails.authorizationCode || undefined;
        paymentData.mpFeeAmount = paymentDetails.mpFeeAmount || undefined;
        paymentData.mpFeeRate = paymentDetails.mpFeeRate || undefined;
        paymentData.netReceivedAmount = paymentDetails.netReceivedAmount || undefined;
        paymentData.bankOriginId = paymentDetails.bankOriginId || undefined;
        paymentData.bankOriginName = paymentDetails.bankOriginName || undefined;
        paymentData.bankTransferId = paymentDetails.bankTransferId || undefined;
        paymentData.mpDeviceId = paymentDetails.mpDeviceId || undefined;
        paymentData.mpPosId = paymentDetails.mpPosId || undefined;
        paymentData.mpStoreId = paymentDetails.mpStoreId || undefined;
      }

      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        customerId: selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined,
        customerName: selectedCustomer?.name,
        items: cart.map((item: CartItem) => ({
          productId: item.product.id,
          productCode: item.product.sku || undefined,
          productName: item.product.name,
          productBarcode: item.product.barcode || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          promotionId: item.promotionId || undefined,
          promotionName: item.promotionName || undefined,
          priceListId: selectedPOS.priceList?.id || undefined,
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        })),
        payments: [paymentData],
      };

      const response = await salesService.create(saleData);

      if (response.success) {
        if (currentTicketId) {
          deleteTicket(currentTicketId);
        }
        setShowPayment(false);
        setAmountTendered('');
        setAppliedGiftCards([]);
        setAppliedStoreCredits([]);
        const mpType = isQR ? 'Mercado Pago QR' : 'Mercado Pago Point';
        alert(`Venta #${response.data.saleNumber} registrada correctamente con ${mpType}`);

        // Refrescar datos de la sesión de caja
        loadCashSession();

        if (pendingSales.length > 0) {
          syncPendingSales();
        }
      }
    } catch (error) {
      console.error('Error procesando venta con MP:', error);
      alert('Error al registrar la venta. El pago fue procesado correctamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Procesar venta (para métodos de pago tradicionales)
  const processSale = async () => {
    if (cart.length === 0) return;

    if (!selectedPOS) {
      setShowPOSSelector(true);
      return;
    }

    // Si es pago con MP Point o QR, abrir el modal correspondiente
    if (selectedPaymentMethod === 'MP_POINT') {
      handleMPPointPayment();
      return;
    }

    if (selectedPaymentMethod === 'MP_QR') {
      handleMPQRPayment();
      return;
    }

    setIsProcessing(true);
    try {
      // Construir array de pagos incluyendo gift cards y vales
      const payments: Array<{
        method: PaymentMethod | 'GIFT_CARD' | 'VOUCHER';
        amount: number;
        amountTendered?: number;
        giftCardCode?: string;
        storeCreditCode?: string;
      }> = [];

      // Agregar pagos con gift cards
      for (const gc of appliedGiftCards) {
        payments.push({
          method: 'GIFT_CARD',
          amount: gc.amountApplied,
          giftCardCode: gc.code,
        });
      }

      // Agregar pagos con vales de credito
      for (const sc of appliedStoreCredits) {
        payments.push({
          method: 'VOUCHER',
          amount: sc.amountApplied,
          storeCreditCode: sc.code,
        });
      }

      // Agregar pago principal si hay monto pendiente
      const pendingAmount = total - giftCardAmount - storeCreditAmount;
      if (pendingAmount > 0) {
        payments.push({
          method: selectedPaymentMethod,
          amount: Number(pendingAmount),
          amountTendered:
            selectedPaymentMethod === 'CASH' ? Number(tenderedAmount) : undefined,
        });
      }

      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        customerId: selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined,
        customerName: selectedCustomer?.name,
        items: cart.map((item: CartItem) => ({
          productId: item.product.id,
          productCode: item.product.sku || undefined,
          productName: item.product.name,
          productBarcode: item.product.barcode || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          promotionId: item.promotionId || undefined,
          promotionName: item.promotionName || undefined,
          priceListId: selectedPOS.priceList?.id || undefined,
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        })),
        payments,
      };

      // Si está offline, encolar la venta
      if (!isOnline) {
        const pendingSale: PendingSale = {
          id: generateId(),
          saleData,
          createdAt: new Date().toISOString(),
          attempts: 0,
        };

        const updatedPending = [...pendingSales, pendingSale];
        setPendingSales(updatedPending);

        // Eliminar ticket completado y mostrar confirmación
        if (currentTicketId) {
          deleteTicket(currentTicketId);
        }
        setShowPayment(false);
        setAmountTendered('');
        setAppliedGiftCards([]);
        setAppliedStoreCredits([]);
        alert('Venta guardada. Se sincronizará cuando vuelva la conexión.');
        return;
      }

      // Si está online, procesar normalmente
      const response = await salesService.create(saleData);

      if (response.success) {
        // Eliminar ticket completado y mostrar confirmación
        if (currentTicketId) {
          deleteTicket(currentTicketId);
        }
        setShowPayment(false);
        setAmountTendered('');
        setAppliedGiftCards([]);
        setAppliedStoreCredits([]);

        // Mostrar modal de facturación con datos de la venta completada
        setCompletedSaleData({
          id: response.data.id,
          saleNumber: response.data.saleNumber,
          total: total,
          customerName: selectedCustomer?.name,
        });
        setShowInvoiceModal(true);

        // Refrescar datos de la sesión de caja
        loadCashSession();

        // Intentar sincronizar ventas pendientes si hay
        if (pendingSales.length > 0) {
          syncPendingSales();
        }
      }
    } catch (error) {
      console.error('Error procesando venta:', error);
      alert('Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  // Procesar cambio exacto (total = 0)
  const handleExactExchange = async () => {
    if (cart.length === 0) return;

    if (!selectedPOS) {
      setShowPOSSelector(true);
      return;
    }

    // Verificar que haya items de devolución
    const hasReturnItems = cart.some(item => item.isReturn);
    if (!hasReturnItems) {
      alert('No hay items de devolución en el carrito');
      return;
    }

    setIsProcessing(true);
    try {
      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        customerId: selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined,
        customerName: selectedCustomer?.name,
        receiptType: 'NDP_X',
        items: cart.map((item: CartItem) => ({
          productId: item.product.id,
          productCode: item.product.sku || undefined,
          productName: item.product.name,
          productBarcode: item.product.barcode || undefined,
          quantity: item.isReturn ? -Math.abs(item.quantity) : Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          promotionId: item.promotionId || undefined,
          promotionName: item.promotionName || undefined,
          priceListId: selectedPOS.priceList?.id || undefined,
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
          isReturn: item.isReturn,
          originalSaleId: item.originalSaleId,
          originalSaleItemId: item.originalSaleItemId,
        })),
        payments: [
          {
            method: 'VOUCHER' as const,
            amount: 0,
          },
        ],
      };

      const response = await salesService.create(saleData);

      if (response.success) {
        if (currentTicketId) {
          deleteTicket(currentTicketId);
        }
        setAppliedGiftCards([]);
        setAppliedStoreCredits([]);
        alert(`Cambio exacto procesado - Ticket #${response.data.saleNumber}`);
        loadCashSession();
      }
    } catch (error) {
      console.error('Error procesando cambio exacto:', error);
      alert('Error al procesar el cambio');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtrar productos por categoría
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category?.id === selectedCategory)
    : products;

  return (
    <div className={`pos-layout ${showPayment ? 'pos-layout-payment' : ''}`}>
      {/* Modal selector de Punto de Venta */}
      {showPOSSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Seleccionar Punto de Venta</h3>
            {cashSession && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  Tiene un turno de caja abierto. Debe cerrarlo antes de cambiar de punto de venta.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {pointsOfSale.map((pos) => {
                const isCurrentPOS = selectedPOS?.id === pos.id;
                const isDisabled = !!(cashSession && !isCurrentPOS);
                return (
                  <button
                    key={pos.id}
                    onClick={() => {
                      if (isDisabled) return;
                      if (isCurrentPOS) {
                        setShowPOSSelector(false);
                        return;
                      }
                      // Verificar si hay productos en algún ticket
                      const hasItems = tickets.some((t: Ticket) => t.items.length > 0);
                      if (hasItems) {
                        const confirmed = window.confirm(
                          '¿Está seguro de cambiar de punto de venta?\n\nLos productos en el carrito se perderán.'
                        );
                        if (!confirmed) return;
                      }
                      // Limpiar tickets y crear uno nuevo
                      const newTicket: Ticket = {
                        id: generateId(),
                        number: 1,
                        name: 'Ticket #1',
                        items: [],
                        createdAt: new Date().toISOString(),
                      };
                      setTickets([newTicket]);
                      setCurrentTicketId(newTicket.id);
                      setSelectedPOS(pos);
                      setShowPOSSelector(false);
                    }}
                    disabled={isDisabled}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                      isCurrentPOS
                        ? 'border-primary-600 bg-primary-50'
                        : isDisabled
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{pos.name}</p>
                        <p className="text-sm text-gray-500">
                          {pos.code} {pos.branch && `• ${pos.branch.name}`}
                        </p>
                        {pos.priceList && (
                          <p className="text-xs text-gray-400 mt-1">
                            Lista: {pos.priceList.name}
                          </p>
                        )}
                      </div>
                      {isCurrentPOS && cashSession && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          Caja abierta
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {pointsOfSale.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No hay puntos de venta configurados
              </p>
            )}
            {selectedPOS && (
              <button
                onClick={() => setShowPOSSelector(false)}
                className="w-full btn btn-primary mt-4"
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel izquierdo - Productos */}
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Panel de caja */}
        {cashSession && (
          <CashPanel
            session={cashSession}
            expectedCash={expectedCash}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            onCount={handleCount}
            onClose={handleCloseCash}
          />
        )}

        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Boton consulta de productos */}
          <button
            onClick={() => setShowProductSearchModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            title="Consultar productos y curva de talles"
          >
            <Layers className="w-5 h-5" />
            <span className="hidden sm:inline">Consultar</span>
          </button>

          {/* Boton historial de ventas */}
          <button
            onClick={() => setShowSalesHistoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            title="Historial de ventas y reimpresión"
          >
            <Receipt className="w-5 h-5" />
            <span className="hidden sm:inline">Ventas</span>
          </button>

          {/* Boton devoluciones */}
          <button
            onClick={() => setShowProductRefundModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
            title="Procesar devolución de producto"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="hidden sm:inline">Devoluciones</span>
          </button>

          <div className="text-right flex items-center gap-4">
            {/* Indicador de conexión y sincronización */}
            {!isOnline ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm">
                <WifiOff className="w-4 h-4" />
                <span>Sin conexión</span>
                {pendingSales.length > 0 && (
                  <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-xs font-medium">
                    {pendingSales.length} pendientes
                  </span>
                )}
              </div>
            ) : (
              <>
                {isSyncing && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sincronizando...</span>
                  </div>
                )}
                {!isSyncing && pendingSales.length > 0 && (
                  <button
                    onClick={syncPendingSales}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                    title="Sincronizar ventas pendientes"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{pendingSales.length} pendientes</span>
                  </button>
                )}
                {!isSyncing && pendingSales.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm">
                    <Wifi className="w-4 h-4" />
                    <span>Conectado</span>
                  </div>
                )}
              </>
            )}

            {/* Indicador de POS */}
            <button
              onClick={() => {
                if (cashSession) {
                  alert('Debe cerrar el turno de caja actual antes de cambiar de punto de venta');
                  return;
                }
                if (pointsOfSale.length > 1) {
                  setShowPOSSelector(true);
                }
              }}
              className={`px-3 py-1 rounded-lg text-sm ${
                selectedPOS
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              } ${pointsOfSale.length > 1 && !cashSession ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              {selectedPOS ? `Caja: ${selectedPOS.name}` : 'Sin caja'}
            </button>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.branch?.name}</p>
            </div>
          </div>
        </div>

        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <div className="absolute top-20 left-4 right-[396px] bg-white rounded-lg shadow-lg border z-10 max-h-96 overflow-y-auto">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
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
                onClick={() => setSelectedCategory(null)}
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
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
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
                    onClick={() => handleProductClick(product)}
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
      </div>

      {/* Panel derecho - Carrito */}
      <div className="flex flex-col h-screen bg-white border-l">
        {/* Selector de tickets */}
        <div className="p-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTicketList(!showTicketList)}
              className="flex-1 flex items-center justify-between px-3 py-2 bg-white border rounded-lg hover:bg-gray-50"
            >
              <span className="text-sm font-medium">
                {tickets.find((t: Ticket) => t.id === currentTicketId)?.name || 'Seleccionar ticket'}
              </span>
              <span className="text-xs text-gray-500">
                ({tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'})
              </span>
            </button>
            <button
              onClick={createNewTicket}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
              title="Nuevo ticket"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Lista de tickets */}
          {showTicketList && (
            <div className="mt-2 max-h-64 overflow-y-auto bg-white border rounded-lg shadow-lg">
              {tickets.map((ticket: Ticket) => (
                <div
                  key={ticket.id}
                  className={`p-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer ${
                    ticket.id === currentTicketId ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => switchTicket(ticket.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ticket.name}</p>
                      <p className="text-xs text-gray-500">
                        {ticket.items.length} items - {new Date(ticket.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {tickets.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTicket(ticket.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Eliminar ticket"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selector de cliente */}
        <div className="px-3 pb-3 border-b bg-gray-50">
          <button
            onClick={() => setShowCustomerModal(true)}
            className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors ${
              selectedCustomer && selectedCustomer.id !== CONSUMIDOR_FINAL.id
                ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                selectedCustomer && selectedCustomer.id !== CONSUMIDOR_FINAL.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
              </p>
              {selectedCustomer && selectedCustomer.taxId && (
                <p className="text-xs text-gray-500 truncate">
                  {selectedCustomer.taxIdType}: {selectedCustomer.taxId}
                </p>
              )}
            </div>
            <span className="text-xs text-gray-400">Cambiar</span>
          </button>

          {/* Notificación de créditos disponibles */}
          {customerCredits && customerCredits.totalAvailable > 0 && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Ticket className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800">
                  {customerCredits.count === 1 ? 'Tiene un vale disponible' : `Tiene ${customerCredits.count} vales disponibles`}
                </p>
                <p className="text-sm font-bold text-amber-900">
                  ${customerCredits.totalAvailable.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <span className="text-xs text-amber-600 flex-shrink-0">Usar al pagar</span>
            </div>
          )}
        </div>

        {/* Header del carrito */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito
              {itemCount > 0 && (
                <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {itemCount}
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={() => updateCart(() => [])}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p>Carrito vacío</p>
              <p className="text-sm">Escanee o busque productos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item: CartItem) => (
                <div
                  key={item.id}
                  className={`rounded-lg p-3 flex gap-3 ${
                    item.isReturn
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      {item.isReturn && (
                        <RotateCcw className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      )}
                      <p className={`font-medium text-sm line-clamp-1 ${item.isReturn ? 'text-red-700' : ''}`}>
                        {item.product.name}
                      </p>
                    </div>
                    {/* Mostrar talle y color si existen */}
                    {(item.product.size || item.product.color) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.product.size && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${
                            item.isReturn ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            T: {item.product.size}
                          </span>
                        )}
                        {item.product.color && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${
                            item.isReturn ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.product.color}
                          </span>
                        )}
                      </div>
                    )}
                    <p className={`text-xs ${item.isReturn ? 'text-red-500' : 'text-gray-500'}`}>
                      {item.isReturn ? '-' : ''}${Math.abs(item.unitPrice).toFixed(2)} c/u
                    </p>
                    {item.promotionName && !item.isReturn && (
                      <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3" />
                        {item.promotionName}
                      </p>
                    )}
                    {item.isReturn && item.returnReason && (
                      <p className="text-xs text-red-500 mt-1 italic">
                        {item.returnReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isReturn ? (
                      /* Para devoluciones, mostrar cantidad fija (no editable) */
                      <span className={`px-3 py-1 text-center font-bold text-red-600 bg-red-100 rounded-lg`}>
                        {item.quantity < 0 ? '' : '-'}{Math.abs(item.quantity)}
                      </span>
                    ) : (
                      /* Para items normales, mostrar controles de cantidad */
                      <>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <p className={`font-semibold ${item.isReturn ? 'text-red-600' : ''}`}>
                      {item.isReturn ? '-' : ''}${Math.abs(item.subtotal).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-600 mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales y pago */}
        <div className="border-t p-4 space-y-4">
          {/* Totales */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${(subtotal + totalDiscount).toFixed(2)}</span>
            </div>
            {isCalculatingPromotions && (
              <div className="flex justify-between text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  Calculando promociones
                  <Loader2 className="w-3 h-3 animate-spin" />
                </span>
              </div>
            )}
            {Object.entries(discountsByPromotion).map(([promoId, promo]) => (
              <div key={promoId} className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {promo.name}
                </span>
                <span>-${promo.total.toFixed(2)}</span>
              </div>
            ))}
            {totalDiscount > 0 && Object.keys(discountsByPromotion).length > 1 && (
              <div className="flex justify-between text-xs text-gray-500 border-t border-dashed pt-1">
                <span>Total descuentos</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className={`flex justify-between text-xl font-bold pt-2 border-t ${total < 0 ? 'text-red-600' : ''}`}>
              <span>Total</span>
              <span>{total < 0 ? '-' : ''}${Math.abs(total).toFixed(2)}</span>
            </div>
          </div>

          {/* Botón de cobrar / Generar Vale */}
          {!showPayment ? (
            <button
              onClick={() => {
                if (total < 0) {
                  // Total negativo = generar vale
                  setShowStoreCreditModal(true);
                } else if (total === 0) {
                  // Cambio exacto = confirmar sin pago
                  handleExactExchange();
                } else {
                  // Total positivo = cobrar normal
                  setShowPayment(true);
                }
              }}
              disabled={cart.length === 0}
              className={`w-full py-4 text-lg disabled:opacity-50 rounded-lg font-medium ${
                total < 0
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : total === 0
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'btn btn-success'
              }`}
            >
              {total < 0
                ? `Generar Vale $${Math.abs(total).toFixed(2)}`
                : total === 0
                  ? 'Cambio Exacto - Confirmar'
                  : `Cobrar $${total.toFixed(2)}`}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Métodos de pago tradicionales */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { method: 'CASH' as PaymentMethod, icon: Banknote, label: 'Efectivo' },
                  { method: 'CREDIT_CARD' as PaymentMethod, icon: CreditCard, label: 'Crédito' },
                  { method: 'DEBIT_CARD' as PaymentMethod, icon: CreditCard, label: 'Débito' },
                  { method: 'QR' as PaymentMethod, icon: QrCode, label: 'QR' },
                ].map(({ method, icon: Icon, label }) => (
                  <button
                    key={method}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                      selectedPaymentMethod === method
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>

              {/* Métodos de pago Mercado Pago */}
              {(mpPointAvailable || mpQRAvailable) && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Mercado Pago</p>
                  <div className="grid grid-cols-3 gap-2">
                    {mpPointAvailable && (
                      <button
                        onClick={() => setSelectedPaymentMethod('MP_POINT')}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                          selectedPaymentMethod === 'MP_POINT'
                            ? 'border-[#009EE3] bg-blue-50'
                            : 'border-gray-200 hover:border-[#009EE3]'
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-[#009EE3]" />
                        <span className="text-xs">Point</span>
                      </button>
                    )}
                    {mpQRAvailable && (
                      <button
                        onClick={() => setSelectedPaymentMethod('MP_QR')}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                          selectedPaymentMethod === 'MP_QR'
                            ? 'border-[#009EE3] bg-blue-50'
                            : 'border-gray-200 hover:border-[#009EE3]'
                        }`}
                      >
                        <QrCode className="w-5 h-5 text-[#009EE3]" />
                        <span className="text-xs">QR MP</span>
                      </button>
                    )}
                    {/* Botón de pagos huérfanos */}
                    <button
                      onClick={() => setShowOrphanPaymentModal(true)}
                      className="p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors border-amber-300 hover:border-amber-500 bg-amber-50"
                    >
                      <CreditCard className="w-5 h-5 text-amber-600" />
                      <span className="text-xs text-amber-700">Pago Previo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Seccion de Gift Cards */}
              <GiftCardPaymentSection
                totalAmount={total}
                giftCardAmount={giftCardAmount}
                appliedGiftCards={appliedGiftCards}
                onApplyGiftCard={(gc) => setAppliedGiftCards(prev => [...prev, gc])}
                onRemoveGiftCard={(code) => setAppliedGiftCards(prev => prev.filter(gc => gc.code !== code))}
                disabled={isProcessing}
              />

              {/* Seccion de Vales de Credito */}
              <StoreCreditPaymentSection
                totalAmount={total - giftCardAmount}
                storeCreditAmount={storeCreditAmount}
                appliedStoreCredits={appliedStoreCredits}
                onApplyStoreCredit={(sc) => setAppliedStoreCredits(prev => [...prev, sc])}
                onRemoveStoreCredit={(code) => setAppliedStoreCredits(prev => prev.filter(sc => sc.code !== code))}
                disabled={isProcessing}
                customerCredits={customerCredits}
                customerId={selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined}
              />

              {/* Mostrar monto pendiente si hay gift cards o vales aplicados */}
              {(giftCardAmount > 0 || storeCreditAmount > 0) && (
                <div className="flex justify-between items-center p-2 bg-purple-50 rounded-lg">
                  <span className="text-sm text-purple-700">Pendiente a pagar:</span>
                  <span className="font-bold text-lg text-purple-900">
                    ${totalAfterGiftCards.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Input de monto (solo efectivo) */}
              {selectedPaymentMethod === 'CASH' && (
                <div>
                  <label className="text-sm text-gray-500">Monto recibido</label>
                  <input
                    type="number"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder="0.00"
                    className="input text-xl text-right"
                    min={amountToPay}
                  />
                  {tenderedAmount >= amountToPay && (
                    <p className="text-right text-green-600 font-semibold mt-1">
                      Vuelto: ${change.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPayment(false)}
                  className="flex-1 btn btn-secondary py-3"
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </button>
                <button
                  onClick={processSale}
                  disabled={
                    isProcessing ||
                    (selectedPaymentMethod === 'CASH' && amountToPay > 0 && tenderedAmount < amountToPay)
                  }
                  className="flex-1 btn btn-success py-3 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 mr-2" />
                  )}
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de pago MP Point */}
      <MPPointPaymentModal
        isOpen={showMPPointModal}
        onClose={() => setShowMPPointModal(false)}
        onSuccess={handleMPPointPaymentSuccess}
        onError={handleMPPaymentError}
        pointOfSaleId={selectedPOS?.id || ''}
        amount={total}
        externalReference={generateExternalReference()}
      />

      {/* Modal de pago MP QR */}
      <MPQRPaymentModal
        isOpen={showMPQRModal}
        onClose={() => setShowMPQRModal(false)}
        onSuccess={handleMPQRPaymentSuccess}
        onError={handleMPPaymentError}
        pointOfSaleId={selectedPOS?.id || ''}
        amount={total}
        externalReference={generateExternalReference()}
        items={cart}
      />

      {/* Modal de pagos huérfanos */}
      <OrphanPaymentModal
        isOpen={showOrphanPaymentModal}
        onClose={() => setShowOrphanPaymentModal(false)}
        onSuccess={(sale) => {
          setShowOrphanPaymentModal(false);
          setShowPayment(false);
          if (currentTicketId) {
            deleteTicket(currentTicketId);
          }
          // Mostrar notificación de éxito
          const saleData = sale as { saleNumber?: string };
          alert(`Venta #${saleData.saleNumber || ''} creada exitosamente con pago previo`);
          // Refrescar datos de la sesión de caja
          loadCashSession();
        }}
        onError={(error) => {
          console.error('Error applying orphan payment:', error);
        }}
        pointOfSaleId={selectedPOS?.id || ''}
        items={cart}
        total={total}
        customerId={selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined}
        ticketNumber={currentTicket?.number}
      />

      {/* Modal de apertura de caja */}
      <CashOpenModal
        isOpen={showCashOpenModal}
        onClose={() => setShowCashOpenModal(false)}
        onSuccess={handleCashSessionOpened}
        pointOfSaleId={selectedPOS?.id || ''}
        pointOfSaleName={selectedPOS?.name || 'Caja'}
      />

      {/* Modal de movimientos de caja */}
      <CashMovementModal
        isOpen={showCashMovementModal}
        onClose={() => setShowCashMovementModal(false)}
        onSuccess={handleCashMovementSuccess}
        type={cashMovementType}
        availableCash={expectedCash}
      />

      {/* Modal de arqueo de caja */}
      <CashCountModal
        isOpen={showCashCountModal}
        onClose={() => setShowCashCountModal(false)}
        onSuccess={handleCashCountSuccess}
        mode={cashCountMode}
        expectedAmount={expectedCash}
      />

      {/* Modal de curva de talles */}
      {selectedParentProduct && (
        <SizeCurveModal
          isOpen={showSizeCurveModal}
          onClose={() => {
            setShowSizeCurveModal(false);
            setSelectedParentProduct(null);
          }}
          onSelectVariant={handleVariantSelect}
          parentProduct={selectedParentProduct}
          branchId={user?.branch?.id}
        />
      )}

      {/* Modal de consulta de productos */}
      <ProductSearchModal
        isOpen={showProductSearchModal}
        onClose={() => setShowProductSearchModal(false)}
        onAddToCart={addToCart}
        branchId={user?.branch?.id}
        activePromotions={activePromotions}
      />

      {/* Modal selector de cliente */}
      <CustomerSelectorModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={(customer) => updateTicketCustomer(customer)}
        selectedCustomerId={selectedCustomer?.id}
      />

      {/* Modal selector de talles (escaneo código padre) */}
      {talleParentInfo && (
        <TalleSelectorModal
          isOpen={showTalleSelectorModal}
          onClose={() => {
            setShowTalleSelectorModal(false);
            setTalleVariantes([]);
            setTalleParentInfo(null);
          }}
          onSelect={handleTalleSelect}
          productName={talleParentInfo.name}
          price={talleParentInfo.price}
          variantes={talleVariantes}
        />
      )}

      {/* Modal de facturación AFIP */}
      {completedSaleData && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setCompletedSaleData(null);
          }}
          saleId={completedSaleData.id}
          saleNumber={completedSaleData.saleNumber}
          total={completedSaleData.total}
          customerName={completedSaleData.customerName}
        />
      )}

      {/* Modal historial de ventas */}
      <SalesHistoryModal
        isOpen={showSalesHistoryModal}
        onClose={() => setShowSalesHistoryModal(false)}
        pointOfSaleId={selectedPOS?.id}
      />

      {/* Modal devoluciones orientado a producto */}
      <ProductRefundModal
        isOpen={showProductRefundModal}
        onClose={() => setShowProductRefundModal(false)}
        onRefundComplete={() => {
          setShowProductRefundModal(false);
          // Opcional: refrescar datos si es necesario
        }}
        onAddToCart={addReturnItemToCart}
      />

      {/* Modal de transaccion mixta (cuando total < 0) */}
      <StoreCreditModal
        isOpen={showStoreCreditModal}
        onClose={() => setShowStoreCreditModal(false)}
        onComplete={() => {
          // Limpiar carrito y cerrar modal
          if (currentTicketId) {
            deleteTicket(currentTicketId);
          }
          setShowStoreCreditModal(false);
          loadCashSession();
        }}
        amount={Math.abs(total)}
        customer={selectedCustomer}
        cartItems={cart}
        branchId={selectedPOS?.branch?.id || user?.branch?.id || ''}
        pointOfSaleId={selectedPOS?.id || ''}
        priceListId={selectedPOS?.priceList?.id}
      />

      {/* Overlay de caja requerida */}
      {cashRequired && (
        <CashRequiredOverlay
          onOpenCash={() => setShowCashOpenModal(true)}
          userName={user?.name}
          posName={selectedPOS?.name}
        />
      )}
    </div>
  );
}
