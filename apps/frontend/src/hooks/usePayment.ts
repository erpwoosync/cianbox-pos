import { useState, useEffect, useCallback } from 'react';
import { mercadoPagoService, storeCreditsService } from '../services/api';
import { CardPaymentData } from '../components/CardPaymentModal';
import { AppliedGiftCard } from '../components/GiftCardPaymentSection';
import { AppliedStoreCredit } from '../components/StoreCreditPaymentSection';
import { CONSUMIDOR_FINAL, Customer } from '../services/customers';
import { CartItem } from './useCart';

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR' | 'TRANSFER' | 'GIFT_CARD' | 'VOUCHER';

type SurchargeDisplayMode = 'SEPARATE_ITEM' | 'DISTRIBUTED';

interface PointOfSale {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  branch?: { id: string; name: string };
  priceList?: { id: string; name: string; currency: string };
  mpDeviceId?: string;
  mpDeviceName?: string;
  surchargeDisplayMode?: SurchargeDisplayMode;
  cianboxPointOfSaleId?: number | null;
}

// Helper para generar IDs únicos
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

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
  isParent?: boolean;
  parentProductId?: string | null;
  parentName?: string;
  size?: string | null;
  color?: string | null;
}

interface UsePaymentParams {
  total: number;
  productsSubtotal: number;
  selectedPOS: PointOfSale | null;
  updateCart: (updater: (items: CartItem[]) => CartItem[]) => void;
  selectedCustomer: Customer | null;
  tenant?: { surchargeDisplayMode?: SurchargeDisplayMode } | null;
}

export function usePayment({
  total,
  productsSubtotal,
  selectedPOS,
  updateCart,
  selectedCustomer,
  tenant,
}: UsePaymentParams) {
  // Estado del pago
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>('CASH');
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

  // Estado de pago con tarjeta (terminales no integrados)
  const [showCardPaymentModal, setShowCardPaymentModal] = useState(false);
  const [pendingCardPaymentMethod, setPendingCardPaymentMethod] = useState<'CREDIT_CARD' | 'DEBIT_CARD' | null>(null);
  const [cardPaymentData, setCardPaymentData] = useState<CardPaymentData | null>(null);

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

  // Si el total se vuelve negativo mientras el panel de pago está abierto,
  // redirigir al modal de vale de crédito
  useEffect(() => {
    if (showPayment && total < 0) {
      setShowPayment(false);
      setShowStoreCreditModal(true);
    }
  }, [showPayment, total]);

  // Totales derivados + gift cards/vales
  const totalAfterGiftCards = total - giftCardAmount - storeCreditAmount;
  const productsAmountForCard = productsSubtotal - giftCardAmount - storeCreditAmount;

  // Calcular vuelto (considerando gift cards y vales aplicados)
  const tenderedAmount = parseFloat(amountTendered) || 0;
  const amountToPay = total - giftCardAmount - storeCreditAmount;
  const change = tenderedAmount - amountToPay;

  // Generar referencia externa para órdenes de MP
  const generateExternalReference = useCallback(() => {
    return `POS-${selectedPOS?.code || 'X'}-${Date.now()}`;
  }, [selectedPOS?.code]);

  // Handler para iniciar pago con MP Point
  const handleMPPointPayment = useCallback(() => {
    setShowMPPointModal(true);
  }, []);

  // Handler para iniciar pago con MP QR
  const handleMPQRPayment = useCallback(() => {
    setShowMPQRModal(true);
  }, []);

  // Handler cuando el pago con MP Point es exitoso
  const handleMPPointPaymentSuccess = useCallback(() => {
    setShowMPPointModal(false);
  }, []);

  // Handler cuando el pago con MP QR es exitoso
  const handleMPQRPaymentSuccess = useCallback(() => {
    setShowMPQRModal(false);
  }, []);

  // Handler cuando el pago con MP falla
  const handleMPPaymentError = useCallback((error: string) => {
    console.error('Error en pago MP:', error);
    // Los modales manejan su propio estado de error
  }, []);

  // Obtener el modo efectivo de visualización de recargo (POS override > tenant default)
  const getEffectiveSurchargeDisplayMode = useCallback((): SurchargeDisplayMode => {
    // Prioridad: POS override > tenant default > 'SEPARATE_ITEM'
    if (selectedPOS?.surchargeDisplayMode) {
      return selectedPOS.surchargeDisplayMode;
    }
    return tenant?.surchargeDisplayMode || 'SEPARATE_ITEM';
  }, [selectedPOS?.surchargeDisplayMode, tenant?.surchargeDisplayMode]);

  // Agregar o actualizar recargo financiero al carrito
  const updateSurchargeItem = useCallback((surchargeAmount: number, installments: number, cardBrandName: string, surchargeRate: number = 0) => {
    const displayMode = getEffectiveSurchargeDisplayMode();

    updateCart((prev) => {
      // Primero restaurar precios originales si había recargo distribuido
      const itemsRestored = prev.map((item) => {
        if (item.originalUnitPrice !== undefined && !item.isSurcharge && !item.isReturn) {
          return {
            ...item,
            unitPrice: item.originalUnitPrice,
            unitPriceNet: item.originalUnitPriceNet || item.originalUnitPrice / 1.21,
            subtotal: item.quantity * item.originalUnitPrice - item.discount,
            originalUnitPrice: undefined,
            originalUnitPriceNet: undefined,
            appliedSurchargeRate: undefined,
          };
        }
        return item;
      });

      // Filtrar items de recargo existentes
      const itemsWithoutSurcharge = itemsRestored.filter((item) => !item.isSurcharge);

      // Si no hay recargo, retornar items restaurados
      if (surchargeAmount <= 0 || surchargeRate <= 0) {
        return itemsWithoutSurcharge;
      }

      if (displayMode === 'DISTRIBUTED') {
        // MODO DISTRIBUIDO: aumentar precios de productos proporcionalmente
        const multiplier = 1 + (surchargeRate / 100);
        return itemsWithoutSurcharge.map((item) => {
          if (item.isReturn) return item; // No aplicar a devoluciones

          const newUnitPrice = item.unitPrice * multiplier;
          const newUnitPriceNet = item.unitPriceNet * multiplier;
          return {
            ...item,
            originalUnitPrice: item.unitPrice,
            originalUnitPriceNet: item.unitPriceNet,
            unitPrice: newUnitPrice,
            unitPriceNet: newUnitPriceNet,
            subtotal: item.quantity * newUnitPrice - item.discount,
            appliedSurchargeRate: surchargeRate,
          };
        });
      } else {
        // MODO ITEM SEPARADO (comportamiento actual)
        const surchargeItem: CartItem = {
          id: generateId(),
          product: {
            id: 'surcharge',
            sku: 'RECARGO',
            barcode: '',
            name: `Recargo financiero - ${cardBrandName} ${installments} cuotas`,
            cianboxProductId: 0, // Producto ficticio para sincronización
            taxRate: 21,
          } as Product,
          quantity: 1,
          unitPrice: surchargeAmount,
          unitPriceNet: surchargeAmount / 1.21, // Asumimos IVA 21%
          discount: 0,
          subtotal: surchargeAmount,
          isSurcharge: true,
        };

        return [...itemsWithoutSurcharge, surchargeItem];
      }
    });
  }, [getEffectiveSurchargeDisplayMode, updateCart]);

  // Remover recargo del carrito (ambos modos)
  const removeSurchargeItem = useCallback(() => {
    updateCart((prev) => {
      // Restaurar precios originales si había recargo distribuido
      const itemsRestored = prev.map((item) => {
        if (item.originalUnitPrice !== undefined && !item.isSurcharge && !item.isReturn) {
          return {
            ...item,
            unitPrice: item.originalUnitPrice,
            unitPriceNet: item.originalUnitPriceNet || item.originalUnitPrice / 1.21,
            subtotal: item.quantity * item.originalUnitPrice - item.discount,
            originalUnitPrice: undefined,
            originalUnitPriceNet: undefined,
            appliedSurchargeRate: undefined,
          };
        }
        return item;
      });

      // Filtrar items de recargo (modo SEPARATE_ITEM)
      return itemsRestored.filter((item) => !item.isSurcharge);
    });
  }, [updateCart]);

  return {
    // State
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
    setMpPointAvailable,
    mpQRAvailable,
    setMpQRAvailable,
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
    setCustomerCredits,

    // Computed
    giftCardAmount,
    storeCreditAmount,
    totalAfterGiftCards,
    productsAmountForCard,
    tenderedAmount,
    amountToPay,
    change,

    // Functions
    handleMPPointPayment,
    handleMPQRPayment,
    handleMPPointPaymentSuccess,
    handleMPQRPaymentSuccess,
    handleMPPaymentError,
    generateExternalReference,
    updateSurchargeItem,
    removeSurchargeItem,
    getEffectiveSurchargeDisplayMode,
  };
}
