import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import { productsService, salesService, pointsOfSaleService, mercadoPagoService, cashService, MPOrderResult, MPPaymentDetails, CashSession } from '../services/api';
import { useLocalStorage } from '../hooks/useLocalStorage';
import MPPointPaymentModal from '../components/MPPointPaymentModal';
import MPQRPaymentModal from '../components/MPQRPaymentModal';
import CashPanel from '../components/CashPanel';
import CashOpenModal from '../components/CashOpenModal';
import CashMovementModal from '../components/CashMovementModal';
import CashCountModal from '../components/CashCountModal';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  shortName?: string;
  imageUrl?: string;
  basePrice?: number;
  taxRate?: number;
  category?: { id: string; name: string };
  prices?: Array<{
    priceListId: string;
    price: number;
    priceNet?: number;
    priceList?: { id: string; name: string }
  }>;
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
}

interface Ticket {
  id: string;
  number: number;
  name: string;
  items: CartItem[];
  createdAt: string;
  customerId?: string;
  customerName?: string;
}

interface Category {
  id: string;
  name: string;
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

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR';

interface SaleData {
  branchId: string;
  pointOfSaleId: string;
  items: Array<{
    productId: string;
    productCode: string;
    productName: string;
    productBarcode: string;
    quantity: number;
    unitPrice: number;
    unitPriceNet: number;
    discount: number;
    taxRate: number;
    promotionId?: string;
    promotionName?: string;
    priceListId: string | null;
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
  }>;
}

interface PendingSale {
  id: string;
  saleData: SaleData;
  createdAt: string;
  attempts: number;
}

const STORAGE_KEY = 'pos_tickets';
const PENDING_SALES_KEY = 'pos_pending_sales';

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Estado de tickets (múltiples ventas en paralelo) - persistido en localStorage
  const initialTicket: Ticket = {
    id: generateId(),
    number: 1,
    name: 'Ticket #1',
    items: [],
    createdAt: new Date().toISOString(),
  };

  const [tickets, setTickets] = useLocalStorage<Ticket[]>(STORAGE_KEY, [initialTicket]);
  const [currentTicketId, setCurrentTicketId] = useLocalStorage<string | null>(
    'pos_current_ticket',
    tickets.length > 0 ? tickets[tickets.length - 1].id : initialTicket.id
  );

  const [showTicketList, setShowTicketList] = useState(false);

  // Estado del carrito (computed from current ticket)
  const cart = tickets.find((t) => t.id === currentTicketId)?.items || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estado de productos y categorías
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [mpPointAvailable, setMpPointAvailable] = useState(false);
  const [mpQRAvailable, setMpQRAvailable] = useState(false);

  // Estado offline/online
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estado de caja
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [expectedCash, setExpectedCash] = useState(0);
  const [showCashOpenModal, setShowCashOpenModal] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<'deposit' | 'withdraw'>('deposit');
  const [showCashCountModal, setShowCashCountModal] = useState(false);
  const [cashCountMode, setCashCountMode] = useState<'partial' | 'closing'>('partial');

  // Cargar ventas pendientes desde localStorage al montar
  useEffect(() => {
    const savedPendingSales = localStorage.getItem(PENDING_SALES_KEY);
    if (savedPendingSales) {
      try {
        const parsed: PendingSale[] = JSON.parse(savedPendingSales);
        setPendingSales(parsed);
      } catch (error) {
        console.error('Error loading pending sales from localStorage:', error);
      }
    }
  }, []);

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
      const [categoriesRes, productsRes, posRes] = await Promise.all([
        productsService.getCategories(),
        productsService.list({ pageSize: 100 }),
        pointsOfSaleService.list(),
      ]);

      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
      }

      if (productsRes.success) {
        setProducts(productsRes.data);
      }

      if (posRes.success) {
        // Filtrar puntos de venta activos de la sucursal del usuario
        const userBranchId = user?.branch?.id;
        const activePOS = posRes.data.filter(
          (pos: PointOfSale) => pos.isActive && (!userBranchId || pos.branch?.id === userBranchId)
        );
        setPointsOfSale(activePOS);

        // Auto-seleccionar si solo hay uno
        if (activePOS.length === 1) {
          setSelectedPOS(activePOS[0]);
        } else if (activePOS.length > 1) {
          // Mostrar selector si hay múltiples
          setShowPOSSelector(true);
        } else if (activePOS.length === 0) {
          alert('No hay puntos de venta configurados para esta sucursal');
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setIsLoadingProducts(false);
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
    setTickets((prev) => [...prev, newTicket]);
    setCurrentTicketId(newTicket.id);
    setShowTicketList(false);
  };

  const switchTicket = (ticketId: string) => {
    setCurrentTicketId(ticketId);
    setShowTicketList(false);
  };

  const deleteTicket = (ticketId: string) => {
    setTickets((prev) => {
      const filtered = prev.filter((t) => t.id !== ticketId);

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

  // Actualizar items del ticket actual
  const updateCart = (updater: (items: CartItem[]) => CartItem[]) => {
    if (!currentTicketId) return;
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === currentTicketId
          ? { ...ticket, items: updater(ticket.items) }
          : ticket
      )
    );
  };

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
        setSearchResults(response.data);

        // Si es un código de barras exacto y hay un resultado, agregar al carrito
        if (response.data.length === 1 && response.data[0].barcode === query) {
          addToCart(response.data[0]);
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
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Calcular vuelto
  const tenderedAmount = parseFloat(amountTendered) || 0;
  const change = tenderedAmount - total;

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

    // Actualizar lista de pendientes
    setPendingSales(remaining);
    localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(remaining));
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
      if (paymentDetails) {
        paymentData.mpPaymentId = paymentDetails.mpPaymentId;
        paymentData.mpOrderId = paymentDetails.mpOrderId;
        paymentData.mpOperationType = paymentDetails.mpOperationType;
        paymentData.mpPointType = paymentDetails.mpPointType;
        paymentData.cardFirstSix = paymentDetails.cardFirstSix;
        paymentData.cardExpirationMonth = paymentDetails.cardExpirationMonth;
        paymentData.cardExpirationYear = paymentDetails.cardExpirationYear;
        paymentData.cardholderName = paymentDetails.cardholderName;
        paymentData.cardType = paymentDetails.cardType;
        paymentData.payerEmail = paymentDetails.payerEmail;
        paymentData.payerIdType = paymentDetails.payerIdType;
        paymentData.payerIdNumber = paymentDetails.payerIdNumber;
        paymentData.authorizationCode = paymentDetails.authorizationCode;
        paymentData.mpFeeAmount = paymentDetails.mpFeeAmount;
        paymentData.mpFeeRate = paymentDetails.mpFeeRate;
        paymentData.netReceivedAmount = paymentDetails.netReceivedAmount;
        paymentData.bankOriginId = paymentDetails.bankOriginId;
        paymentData.bankOriginName = paymentDetails.bankOriginName;
        paymentData.bankTransferId = paymentDetails.bankTransferId;
        paymentData.mpDeviceId = paymentDetails.mpDeviceId;
        paymentData.mpPosId = paymentDetails.mpPosId;
        paymentData.mpStoreId = paymentDetails.mpStoreId;
      }

      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        items: cart.map((item) => ({
          productId: item.product.id,
          productCode: item.product.sku,
          productName: item.product.name,
          productBarcode: item.product.barcode,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          promotionId: item.promotionId,
          promotionName: item.promotionName,
          priceListId: selectedPOS.priceList?.id || null,
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
        const mpType = isQR ? 'Mercado Pago QR' : 'Mercado Pago Point';
        alert(`Venta #${response.data.saleNumber} registrada correctamente con ${mpType}`);

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
      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        items: cart.map((item) => ({
          productId: item.product.id,
          productCode: item.product.sku,
          productName: item.product.name,
          productBarcode: item.product.barcode,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          promotionId: item.promotionId,
          promotionName: item.promotionName,
          // IDs para sincronización con Cianbox
          priceListId: selectedPOS.priceList?.id || null,
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        })),
        payments: [
          {
            method: selectedPaymentMethod,
            amount: Number(total),
            amountTendered:
              selectedPaymentMethod === 'CASH' ? Number(tenderedAmount) : undefined,
          },
        ],
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
        localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(updatedPending));

        // Eliminar ticket completado y mostrar confirmación
        if (currentTicketId) {
          deleteTicket(currentTicketId);
        }
        setShowPayment(false);
        setAmountTendered('');
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
        alert(`Venta #${response.data.saleNumber} registrada correctamente`);

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

  // Filtrar productos por categoría
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category?.id === selectedCategory)
    : products;

  // Filtrar categorías que tienen productos
  const categoriesWithProducts = categories.filter((cat) =>
    products.some((p) => p.category?.id === cat.id)
  );

  return (
    <div className="pos-layout">
      {/* Modal selector de Punto de Venta */}
      {showPOSSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Seleccionar Punto de Venta</h3>
            <div className="space-y-2">
              {pointsOfSale.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => {
                    setSelectedPOS(pos);
                    setShowPOSSelector(false);
                  }}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedPOS?.id === pos.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{pos.name}</p>
                  <p className="text-sm text-gray-500">
                    {pos.code} {pos.branch && `• ${pos.branch.name}`}
                  </p>
                  {pos.priceList && (
                    <p className="text-xs text-gray-400 mt-1">
                      Lista: {pos.priceList.name}
                    </p>
                  )}
                </button>
              ))}
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
              onClick={() => pointsOfSale.length > 1 && setShowPOSSelector(true)}
              className={`px-3 py-1 rounded-lg text-sm ${
                selectedPOS
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              } ${pointsOfSale.length > 1 ? 'cursor-pointer hover:opacity-80' : ''}`}
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
                onClick={() => addToCart(product)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
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
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    {product.sku} | {product.barcode}
                  </p>
                </div>
                <p className="font-semibold">
                  ${getProductPrice(product).toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Categorías */}
        <div className="flex gap-2 p-4 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todos
          </button>
          {categoriesWithProducts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingProducts ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all text-left"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
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
                </button>
              ))}
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
                {tickets.find((t) => t.id === currentTicketId)?.name || 'Seleccionar ticket'}
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
              {tickets.map((ticket) => (
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
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-lg p-3 flex gap-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${item.unitPrice.toFixed(2)} c/u
                    </p>
                    {item.promotionName && (
                      <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3" />
                        {item.promotionName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
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
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
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
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuentos</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Botón de cobrar */}
          {!showPayment ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full btn btn-success py-4 text-lg disabled:opacity-50"
            >
              Cobrar ${total.toFixed(2)}
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
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
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
                    min={total}
                  />
                  {tenderedAmount >= total && (
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
                    (selectedPaymentMethod === 'CASH' && tenderedAmount < total)
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
    </div>
  );
}
