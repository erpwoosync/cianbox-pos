import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useIndexedDB } from './useIndexedDB';
import { STORES } from '../services/indexedDB';
import { Customer } from '../services/customers';

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

interface AppliedPromotion {
  id: string;
  name: string;
  type: string;
  discount: number;
}

export interface CartItem {
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
  // Propiedad de recargo financiero
  isSurcharge?: boolean;
  // Propiedades para modo DISTRIBUTED (recargo distribuido en precios)
  originalUnitPrice?: number;
  originalUnitPriceNet?: number;
  appliedSurchargeRate?: number;
}

export interface Ticket {
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

// Helper para obtener el precio del producto
const getProductPrice = (product: Product): number => {
  if (product.basePrice != null) {
    const price = Number(product.basePrice);
    if (!isNaN(price)) return price;
  }
  if (product.prices && product.prices.length > 0) {
    const price = Number(product.prices[0].price);
    if (!isNaN(price)) return price;
  }
  return 0;
};

// Helper para obtener el precio neto (sin IVA) del producto
const getProductPriceNet = (product: Product): number => {
  if (product.prices && product.prices.length > 0 && product.prices[0].priceNet != null) {
    const priceNet = Number(product.prices[0].priceNet);
    if (!isNaN(priceNet)) return priceNet;
  }
  const price = getProductPrice(product);
  const taxRate = product.taxRate || 21;
  return price / (1 + taxRate / 100);
};

export function useCart() {
  // Estado de tickets (múltiples ventas en paralelo) - persistido en IndexedDB
  const initialTicket: Ticket = useMemo(() => ({
    id: generateId(),
    number: 1,
    name: 'Ticket #1',
    items: [],
    createdAt: new Date().toISOString(),
  }), []);

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
  const currentTicket = tickets.find((t: Ticket) => t.id === currentTicketId);
  const cart = currentTicket?.items || [];

  // Calcular totales
  const subtotal = cart.reduce((sum: number, item: CartItem) => sum + item.subtotal, 0);
  const totalDiscount = cart.reduce((sum: number, item: CartItem) => sum + item.discount, 0);
  const total = subtotal;
  // Subtotal SIN recargos financieros (para calcular recargo en modal de tarjeta)
  const productsSubtotal = cart.filter((item: CartItem) => !item.isSurcharge).reduce((sum: number, item: CartItem) => sum + item.subtotal, 0);
  const itemCount = cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

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
        discount: 0,
        subtotal: -returnItem.subtotal,
        isReturn: true,
        originalSaleId: returnItem.originalSaleId,
        originalSaleItemId: returnItem.originalSaleItemId,
        returnReason: returnItem.returnReason,
        promotionId: undefined,
        promotionName: undefined,
        promotions: [],
      };
      return [...prev, returnCartItem];
    });
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

  return {
    // State
    tickets,
    setTickets,
    currentTicketId,
    setCurrentTicketId,
    showTicketList,
    setShowTicketList,

    // Computed
    currentTicket,
    cart,
    subtotal,
    totalDiscount,
    total,
    productsSubtotal,
    itemCount,

    // Functions
    createNewTicket,
    switchTicket,
    deleteTicket,
    updateCart,
    updateTicketCustomer,
    addToCart,
    addReturnItemToCart,
    updateQuantity,
    removeItem,
  };
}
