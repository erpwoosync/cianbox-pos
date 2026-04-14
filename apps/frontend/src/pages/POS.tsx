import { useState, useEffect } from 'react';
import {
  Loader2,
  X,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import { salesService, mercadoPagoService, cashService, MPOrderResult, MPPaymentDetails, CashSession } from '../services/api';
import { useCart, CartItem, Ticket } from '../hooks/useCart';
import { usePayment } from '../hooks/usePayment';
import { usePOSSetup, Product, PendingSale } from '../hooks/usePOSSetup';
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
import SalesHistoryModal from '../components/SalesHistoryModal';
import ProductRefundModal from '../components/ProductRefundModal';
import StoreCreditModal from '../components/StoreCreditModal';
import CardPaymentModal from '../components/CardPaymentModal';
import POSHeader from '../components/pos/POSHeader';
import ProductGrid from '../components/pos/ProductGrid';
import CartPanel from '../components/pos/CartPanel';
import CashRequiredOverlay from '../components/CashRequiredOverlay';
import { Customer, CONSUMIDOR_FINAL } from '../services/customers';
import { useQzPrinter } from '../hooks/useQzPrinter';
import { useCianboxSync } from '../hooks/useCianboxSync';
// receipt-printer.ts disponible para ESC/POS si se necesita en el futuro

// CartItem and Ticket types are imported from ../hooks/useCart

// Helper para generar IDs únicos
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR' | 'TRANSFER' | 'GIFT_CARD' | 'VOUCHER';

export default function POS() {
  const { user, tenant } = useAuthStore();

  // Cart hook - gestión de tickets y carrito
  const {
    tickets,
    setTickets,
    currentTicketId,
    setCurrentTicketId,
    showTicketList,
    setShowTicketList,
    currentTicket,
    cart,
    subtotal,
    totalDiscount,
    total,
    productsSubtotal,
    itemCount,
    createNewTicket,
    switchTicket,
    deleteTicket,
    updateCart,
    updateTicketCustomer,
    addToCart,
    addReturnItemToCart,
    updateQuantity,
    removeItem,
  } = useCart();

  // POS Setup hook - productos, búsqueda, POS, promociones, offline
  const {
    isLoadingProducts,
    quickAccessCategories,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    handleSearch,
    pointsOfSale,
    selectedPOS,
    setSelectedPOS,
    showPOSSelector,
    setShowPOSSelector,
    isOnline,
    pendingSales,
    setPendingSales,
    isSyncing,
    syncPendingSales,
    activePromotions,
    isCalculatingPromotions,
    getProductPromotion,
    formatPromotionBadge,
    pendingVariantProduct,
    setPendingVariantProduct,
    pendingTalleData,
    setPendingTalleData,
  } = usePOSSetup({
    cartItems: cart,
    currentTicketId,
    setTickets,
    addToCart,
    user,
  });

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
  const selectedCustomer: Customer | null = currentTicket?.customerId
    ? {
        id: currentTicket.customerId,
        name: currentTicket.customerName || 'Cliente',
        taxId: currentTicket.customerTaxId,
        taxIdType: currentTicket.customerTaxIdType as Customer['taxIdType'],
      }
    : null;

  // Payment hook - gestión de pagos, gift cards, vales, recargos y MP
  const {
    showPayment,
    setShowPayment,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    amountTendered,
    setAmountTendered,
    isProcessing,
    setIsProcessing,
    showMPPointModal,
    setShowMPPointModal,
    showMPQRModal,
    setShowMPQRModal,
    showOrphanPaymentModal,
    setShowOrphanPaymentModal,
    mpPointAvailable,
    mpQRAvailable,
    showStoreCreditModal,
    setShowStoreCreditModal,
    showCardPaymentModal,
    setShowCardPaymentModal,
    pendingCardPaymentMethod,
    setPendingCardPaymentMethod,
    cardPaymentData,
    setCardPaymentData,
    appliedGiftCards,
    setAppliedGiftCards,
    appliedStoreCredits,
    setAppliedStoreCredits,
    customerCredits,
    giftCardAmount,
    storeCreditAmount,
    totalAfterGiftCards,
    productsAmountForCard,
    tenderedAmount,
    amountToPay,
    change,
    handleMPPointPayment,
    handleMPQRPayment,
    handleMPPointPaymentSuccess,
    handleMPQRPaymentSuccess,
    handleMPPaymentError,
    generateExternalReference,
    updateSurchargeItem,
    removeSurchargeItem,
  } = usePayment({
    total,
    productsSubtotal,
    selectedPOS,
    updateCart,
    selectedCustomer,
    tenant,
  });

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

  // Reaccionar a señales del hook para abrir modales de variantes
  useEffect(() => {
    if (pendingVariantProduct) {
      setSelectedParentProduct(pendingVariantProduct);
      setShowSizeCurveModal(true);
      setPendingVariantProduct(null);
    }
  }, [pendingVariantProduct]);

  useEffect(() => {
    if (pendingTalleData) {
      setTalleVariantes(pendingTalleData.variantes);
      setTalleParentInfo(pendingTalleData.parentInfo);
      setShowTalleSelectorModal(true);
      setPendingTalleData(null);
    }
  }, [pendingTalleData]);

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

  // QZ Tray - impresion directa
  const { connected: qzConnected, connecting: qzConnecting, connect: qzConnect, selectedPrinter, printHtml: qzPrintHtml } = useQzPrinter();

  // Cianbox sync hook - talonarios, comprobantes, polling de factura
  const {
    receiptMode,
    setReceiptMode,
    cianboxTalonarios,
    setCianboxTalonarios,
    selectedTalonarioId,
    setSelectedTalonarioId,
    posTalonarios,
    showCianboxPopover,
    setShowCianboxPopover,
    invoicePolling,
    setInvoicePolling,
    invoiceReady,
    setInvoiceReady,
  } = useCianboxSync({
    selectedPOS,
    selectedPaymentMethod,
    appliedGiftCards,
    appliedStoreCredits,
    selectedCustomer,
    qzConnected,
    selectedPrinter,
    qzPrintHtml,
  });

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

  // Wrapper para addToCart que limpia búsqueda
  const handleAddToCart = (product: Product) => {
    addToCart(product);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Wrapper para addReturnItemToCart que cierra el modal
  const handleAddReturnItem = (returnItem: Parameters<typeof addReturnItemToCart>[0]) => {
    addReturnItemToCart(returnItem);
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
      handleAddToCart(product);
    }
  };

  // Handler cuando se selecciona una variante del modal
  const handleVariantSelect = (variant: Product) => {
    handleAddToCart(variant);
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

    handleAddToCart(product);
    setShowTalleSelectorModal(false);
    setTalleVariantes([]);
    setTalleParentInfo(null);
  };

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
          // No enviar productId para items de recargo (usan cianboxProductId: 0)
          productId: item.isSurcharge ? undefined : item.product.id,
          productCode: item.isSurcharge ? 'RECARGO' : (item.product.sku || undefined),
          productName: item.product.name,
          productBarcode: item.isSurcharge ? undefined : (item.product.barcode || undefined),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          // No aplicar promociones a items de recargo
          promotionId: item.isSurcharge ? undefined : (item.promotionId || undefined),
          promotionName: item.isSurcharge ? undefined : (item.promotionName || undefined),
          priceListId: item.isSurcharge ? undefined : (selectedPOS.priceList?.id || undefined),
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
          isSurcharge: item.isSurcharge || false,
        })),
        payments: [paymentData],
        // Comprobante Cianbox
        cianboxTalonarioId: receiptMode === 'FACTURA' && selectedTalonarioId ? selectedTalonarioId : undefined,
        cianboxTalonarioFiscal: receiptMode === 'FACTURA' ? true : undefined,
      };


      const pollingIsFiscal = receiptMode === 'FACTURA';
      const pollingItems = cart.map((i: CartItem) => ({ name: i.product.name, qty: Number(i.quantity), price: Number(i.unitPrice), discount: Number(i.discount || 0), subtotal: Number(i.unitPrice) * Number(i.quantity) - Number(i.discount || 0) }));
      const pollingTotal = Number(total);
      const pollingCustomer = selectedCustomer?.name !== 'Consumidor Final' ? selectedCustomer?.name : undefined;
      const response = await salesService.create(saleData);

      if (response.success) {
        if (currentTicketId) {
          deleteTicket(currentTicketId);
        }
        setShowPayment(false);
        setAmountTendered('');
        setAppliedGiftCards([]);
        setAppliedStoreCredits([]);
        setCardPaymentData(null);
        setReceiptMode('NDP');
        setSelectedTalonarioId(null);
        setCianboxTalonarios([]);
        const mpType = isQR ? 'Mercado Pago QR' : 'Mercado Pago Point';
        alert(`Venta #${response.data.saleNumber} registrada correctamente con ${mpType}`);

        // Refrescar datos de la sesión de caja
        loadCashSession();

        // Iniciar polling de comprobante Cianbox
        if (response.data?.id) {
          setInvoicePolling({ saleId: response.data.id, saleNumber: response.data.saleNumber || '', isFiscal: pollingIsFiscal, total: pollingTotal, customerName: pollingCustomer, items: pollingItems });
        }

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
        // Campos de terminal de tarjeta no integrado
        cardTerminalId?: string;
        authorizationCode?: string;
        voucherNumber?: string;
        batchNumber?: string;
        installments?: number;
        cardBrand?: string;
        cardLastFour?: string;
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
      if (pendingAmount > 0 && selectedPaymentMethod) {
        const isCardPayment = selectedPaymentMethod === 'CREDIT_CARD' || selectedPaymentMethod === 'DEBIT_CARD';
        payments.push({
          method: selectedPaymentMethod,
          amount: Number(pendingAmount),
          amountTendered:
            selectedPaymentMethod === 'CASH' ? Number(tenderedAmount) : undefined,
          // Datos del terminal de tarjeta (solo para crédito/débito)
          ...(isCardPayment && cardPaymentData ? {
            cardTerminalId: cardPaymentData.cardTerminalId,
            authorizationCode: cardPaymentData.authorizationCode,
            voucherNumber: cardPaymentData.voucherNumber,
            batchNumber: cardPaymentData.batchNumber,
            installments: cardPaymentData.installments,
            cardBrand: cardPaymentData.cardBrand,
            cardLastFour: cardPaymentData.cardLastFour,
            // Promoción bancaria y recargo financiero
            bankId: cardPaymentData.bankId,
            bankPromotionId: cardPaymentData.bankPromotionId,
            surchargeRate: cardPaymentData.surchargeRate,
            surchargeAmount: cardPaymentData.surchargeAmount,
          } : {}),
        });
      }

      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        customerId: selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined,
        customerName: selectedCustomer?.name,
        items: cart.map((item: CartItem) => ({
          // No enviar productId para items de recargo (usan cianboxProductId: 0)
          productId: item.isSurcharge ? undefined : item.product.id,
          productCode: item.isSurcharge ? 'RECARGO' : (item.product.sku || undefined),
          productName: item.product.name,
          productBarcode: item.isSurcharge ? undefined : (item.product.barcode || undefined),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          // No aplicar promociones a items de recargo
          promotionId: item.isSurcharge ? undefined : (item.promotionId || undefined),
          promotionName: item.isSurcharge ? undefined : (item.promotionName || undefined),
          priceListId: item.isSurcharge ? undefined : (selectedPOS.priceList?.id || undefined),
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
          isSurcharge: item.isSurcharge || false,
        })),
        payments,
        // Comprobante Cianbox
        cianboxTalonarioId: receiptMode === 'FACTURA' && selectedTalonarioId ? selectedTalonarioId : undefined,
        cianboxTalonarioFiscal: receiptMode === 'FACTURA' ? true : undefined,
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
        setCardPaymentData(null);
        setReceiptMode('NDP');
        setSelectedTalonarioId(null);
        setCianboxTalonarios([]);
        alert('Venta guardada. Se sincronizará cuando vuelva la conexión.');
        return;
      }

      // Si está online, procesar normalmente
      const pollingIsFiscal = receiptMode === 'FACTURA';
      const pollingItems = cart.map((i: CartItem) => ({ name: i.product.name, qty: Number(i.quantity), price: Number(i.unitPrice), discount: Number(i.discount || 0), subtotal: Number(i.unitPrice) * Number(i.quantity) - Number(i.discount || 0) }));
      const pollingTotal = Number(total);
      const pollingCustomer = selectedCustomer?.name !== 'Consumidor Final' ? selectedCustomer?.name : undefined;
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
        setCardPaymentData(null);
        setReceiptMode('NDP');
        setSelectedTalonarioId(null);
        setCianboxTalonarios([]);

        // Refrescar datos de la sesión de caja
        loadCashSession();

        // Iniciar polling de comprobante Cianbox
        if (response.data?.id) {
          setInvoicePolling({ saleId: response.data.id, saleNumber: response.data.saleNumber || '', isFiscal: pollingIsFiscal, total: pollingTotal, customerName: pollingCustomer, items: pollingItems });
        }

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
          // No enviar productId para items de recargo (usan cianboxProductId: 0)
          productId: item.isSurcharge ? undefined : item.product.id,
          productCode: item.isSurcharge ? 'RECARGO' : (item.product.sku || undefined),
          productName: item.product.name,
          productBarcode: item.isSurcharge ? undefined : (item.product.barcode || undefined),
          quantity: item.isReturn ? -Math.abs(item.quantity) : Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          // No aplicar promociones a items de recargo
          promotionId: item.isSurcharge ? undefined : (item.promotionId || undefined),
          promotionName: item.isSurcharge ? undefined : (item.promotionName || undefined),
          priceListId: item.isSurcharge ? undefined : (selectedPOS.priceList?.id || undefined),
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
          isReturn: item.isReturn,
          originalSaleId: item.originalSaleId,
          originalSaleItemId: item.originalSaleItemId,
          isSurcharge: item.isSurcharge || false,
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
        setCardPaymentData(null);
        setReceiptMode('NDP');
        setSelectedTalonarioId(null);
        setCianboxTalonarios([]);
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
        <POSHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          isSearching={isSearching}
          onOpenProductSearch={() => setShowProductSearchModal(true)}
          onOpenSalesHistory={() => setShowSalesHistoryModal(true)}
          onOpenRefund={() => setShowProductRefundModal(true)}
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingSalesCount={pendingSales.length}
          onSyncPending={syncPendingSales}
          selectedPOS={selectedPOS}
          onOpenPOSSelector={() => setShowPOSSelector(true)}
          pointsOfSaleCount={pointsOfSale.length}
          hasCashSession={!!cashSession}
          user={user}
          posTalonarios={posTalonarios}
          showCianboxPopover={showCianboxPopover}
          onToggleCianboxPopover={setShowCianboxPopover}
          qzConnected={qzConnected}
          qzConnecting={qzConnecting}
          onQzConnect={qzConnect}
          selectedPrinter={selectedPrinter}
        />

        <ProductGrid
          products={[]}
          filteredProducts={filteredProducts}
          searchResults={searchResults}
          selectedCategory={selectedCategory}
          quickAccessCategories={quickAccessCategories}
          onCategorySelect={setSelectedCategory}
          onProductClick={handleProductClick}
          getProductPromotion={getProductPromotion}
          formatPromotionBadge={formatPromotionBadge}
          isLoadingProducts={isLoadingProducts}
          searchQuery={searchQuery}
        />
      </div>

      <CartPanel
        tickets={tickets}
        currentTicket={currentTicket}
        cartItems={cart}
        showTicketList={showTicketList}
        onCreateTicket={createNewTicket}
        onSwitchTicket={switchTicket}
        onDeleteTicket={deleteTicket}
        onShowTicketList={setShowTicketList}
        selectedCustomer={selectedCustomer}
        onOpenCustomerModal={() => setShowCustomerModal(true)}
        updateQuantity={updateQuantity}
        removeItem={removeItem}
        subtotal={subtotal}
        totalDiscount={totalDiscount}
        total={total}
        itemCount={itemCount}
        discountsByPromotion={discountsByPromotion}
        onOpenPayment={() => setShowPayment(true)}
        cashSession={cashSession}
        showPayment={showPayment}
        onClosePayment={() => setShowPayment(false)}
        selectedPaymentMethod={selectedPaymentMethod}
        onSelectPaymentMethod={setSelectedPaymentMethod}
        amountTendered={amountTendered}
        onAmountTenderedChange={setAmountTendered}
        isProcessing={isProcessing}
        isCalculatingPromotions={isCalculatingPromotions}
        updateCart={updateCart}
        mpPointAvailable={mpPointAvailable}
        mpQRAvailable={mpQRAvailable}
        onOpenOrphanPaymentModal={() => setShowOrphanPaymentModal(true)}
        onOpenCardPaymentModal={(method) => {
          setPendingCardPaymentMethod(method);
          setShowCardPaymentModal(true);
        }}
        cardPaymentData={cardPaymentData}
        onClearCardPaymentData={() => setCardPaymentData(null)}
        removeSurchargeItem={removeSurchargeItem}
        appliedGiftCards={appliedGiftCards}
        onApplyGiftCard={(gc) => setAppliedGiftCards(prev => [...prev, gc])}
        onRemoveGiftCard={(code) => setAppliedGiftCards(prev => prev.filter(gc => gc.code !== code))}
        appliedStoreCredits={appliedStoreCredits}
        onApplyStoreCredit={(sc) => setAppliedStoreCredits(prev => [...prev, sc])}
        onRemoveStoreCredit={(code) => setAppliedStoreCredits(prev => prev.filter(sc => sc.code !== code))}
        customerCredits={customerCredits}
        giftCardAmount={giftCardAmount}
        storeCreditAmount={storeCreditAmount}
        totalAfterGiftCards={totalAfterGiftCards}
        amountToPay={amountToPay}
        tenderedAmount={tenderedAmount}
        change={change}
        receiptMode={receiptMode}
        onReceiptModeChange={setReceiptMode}
        cianboxTalonarios={cianboxTalonarios}
        selectedTalonarioId={selectedTalonarioId}
        onSelectedTalonarioIdChange={setSelectedTalonarioId}
        onProcessSale={processSale}
        onHandleExactExchange={handleExactExchange}
        onOpenStoreCreditModal={() => setShowStoreCreditModal(true)}
        productsAmountForCard={productsAmountForCard}
      />

      {/* Modal de pago MP Point */}
      <MPPointPaymentModal
        isOpen={showMPPointModal}
        onClose={() => setShowMPPointModal(false)}
        onSuccess={async (result: MPOrderResult) => {
          handleMPPointPaymentSuccess();
          await processSaleWithMPPayment(result, false);
        }}
        onError={handleMPPaymentError}
        pointOfSaleId={selectedPOS?.id || ''}
        amount={total}
        externalReference={generateExternalReference()}
      />

      {/* Modal de pago MP QR */}
      <MPQRPaymentModal
        isOpen={showMPQRModal}
        onClose={() => setShowMPQRModal(false)}
        onSuccess={async (result: MPOrderResult) => {
          handleMPQRPaymentSuccess();
          await processSaleWithMPPayment(result, true);
        }}
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
        onAddToCart={handleAddToCart}
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

      {/* Modal de facturación AFIP - removido: la selección de comprobante se hace antes de confirmar */}

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
        onAddToCart={handleAddReturnItem}
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

      {/* Modal de datos de cupón para pago con tarjeta */}
      <CardPaymentModal
        isOpen={showCardPaymentModal}
        onClose={() => {
          setShowCardPaymentModal(false);
          setPendingCardPaymentMethod(null);
          // Remover recargo si se cancela el pago con tarjeta
          removeSurchargeItem();
        }}
        onConfirm={(data) => {
          setCardPaymentData(data);
          setSelectedPaymentMethod(pendingCardPaymentMethod!);
          setShowCardPaymentModal(false);
          setPendingCardPaymentMethod(null);
          // Agregar o remover recargo según corresponda
          if (data.surchargeAmount && data.surchargeAmount > 0 && data.cardBrand && data.surchargeRate) {
            updateSurchargeItem(data.surchargeAmount, data.installments, data.cardBrand, data.surchargeRate);
          } else {
            removeSurchargeItem();
          }
        }}
        amount={productsAmountForCard}
        paymentMethod={pendingCardPaymentMethod || 'CREDIT_CARD'}
        initialData={cardPaymentData}
      />

      {/* Overlay de caja requerida */}
      {cashRequired && (
        <CashRequiredOverlay
          onOpenCash={() => setShowCashOpenModal(true)}
          userName={user?.name}
          posName={selectedPOS?.name}
        />
      )}

      {/* Indicador de generación de factura en curso */}
      {invoicePolling && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Generando comprobante...</span>
        </div>
      )}

      {/* Notificación de factura lista */}
      {invoiceReady && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up">
          <FileText className="w-5 h-5" />
          <div>
            <p className="font-medium text-sm">Comprobante listo</p>
            <p className="text-xs opacity-90">{invoiceReady.saleNumber}</p>
          </div>
          <a
            href={invoiceReady.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-white text-green-700 rounded text-sm font-medium hover:bg-green-50"
          >
            Ver PDF
          </a>
          <button
            onClick={() => setInvoiceReady(null)}
            className="ml-1 text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
