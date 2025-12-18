import { useState, useEffect, useCallback, useRef } from 'react';
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
  X,
  Check,
  Loader2,
  Edit3,
  AlertTriangle,
  Clock,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import { productsService, salesService, pointsOfSaleService, categoriesService, promotionsService } from '../services/api';

// ============ INTERFACES ============
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
  brand?: { id: string; name: string };
  prices?: Array<{
    priceListId: string;
    price: number;
    priceNet?: number;
    priceList?: { id: string; name: string }
  }>;
}

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

interface Category {
  id: string;
  name: string;
}

interface QuickAccessCategory {
  id: string;
  name: string;
  quickAccessColor?: string | null;
  quickAccessIcon?: string | null;
  quickAccessOrder: number;
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
}

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR';

// ============ HELPERS ============
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes}min`;
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

const calculateTicketTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice - item.discount), 0);
};

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

const getProductPriceNet = (product: Product): number => {
  if (product.prices && product.prices.length > 0 && product.prices[0].priceNet != null) {
    const priceNet = Number(product.prices[0].priceNet);
    if (!isNaN(priceNet)) return priceNet;
  }
  const price = getProductPrice(product);
  const taxRate = product.taxRate || 21;
  return price / (1 + taxRate / 100);
};

// ============ INTERFACES ADICIONALES ============
interface Ticket {
  id: string;
  name: string;
  items: CartItem[];
  createdAt: number;
}

// ============ STORAGE KEY ============
const TICKETS_STORAGE_KEY = 'pos_tickets';
const ACTIVE_TICKET_KEY = 'pos_active_ticket';

// ============ LOAD/SAVE FUNCTIONS ============
const createNewTicket = (): Ticket => ({
  id: generateId(),
  name: `Ticket ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
  items: [],
  createdAt: Date.now(),
});

const loadTicketsFromStorage = (): Ticket[] => {
  try {
    const saved = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('[POS] Tickets cargados:', parsed.length);
        return parsed;
      }
    }
  } catch (e) {
    console.error('[POS] Error cargando tickets:', e);
  }
  // Crear ticket inicial si no hay ninguno
  const initial = createNewTicket();
  console.log('[POS] Creando ticket inicial');
  return [initial];
};

const loadActiveTicketIdFromStorage = (): string => {
  try {
    const saved = localStorage.getItem(ACTIVE_TICKET_KEY);
    if (saved) return saved;
  } catch (e) {
    console.error('[POS] Error cargando ticket activo:', e);
  }
  return '';
};

const saveTicketsToStorage = (tickets: Ticket[]) => {
  try {
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
    console.log('[POS] Tickets guardados:', tickets.length);
  } catch (e) {
    console.error('[POS] Error guardando tickets:', e);
  }
};

const saveActiveTicketIdToStorage = (ticketId: string) => {
  try {
    localStorage.setItem(ACTIVE_TICKET_KEY, ticketId);
  } catch (e) {
    console.error('[POS] Error guardando ticket activo:', e);
  }
};

// ============ COMPONENT ============
export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Ref para el campo de búsqueda (mantener foco para lector de código de barras)
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Función para enfocar el campo de búsqueda
  const focusSearchInput = useCallback(() => {
    // Pequeño delay para asegurar que otros elementos perdieron el foco
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  // Tickets - inicializar desde localStorage
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTicketsFromStorage());
  const [activeTicketId, setActiveTicketId] = useState<string>(() => {
    const savedId = loadActiveTicketIdFromStorage();
    const tickets = loadTicketsFromStorage();
    // Validar que el ID guardado existe
    if (savedId && tickets.some(t => t.id === savedId)) {
      return savedId;
    }
    return tickets[0]?.id || '';
  });

  // Guardar tickets en localStorage cada vez que cambien
  useEffect(() => {
    saveTicketsToStorage(tickets);
  }, [tickets]);

  // Guardar ticket activo en localStorage
  useEffect(() => {
    saveActiveTicketIdToStorage(activeTicketId);
  }, [activeTicketId]);

  // Obtener ticket actual
  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];
  const cart = activeTicket?.items || [];

  // Función para actualizar el carrito del ticket activo
  const setCart = (updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setTickets(prevTickets => {
      return prevTickets.map(ticket => {
        if (ticket.id === activeTicketId) {
          const newItems = typeof updater === 'function' ? updater(ticket.items) : updater;
          return { ...ticket, items: newItems };
        }
        return ticket;
      });
    });
  };

  // Crear nuevo ticket
  const handleNewTicket = () => {
    const newTicket = createNewTicket();
    setTickets(prev => [...prev, newTicket]);
    setActiveTicketId(newTicket.id);
  };

  // Estado para confirmación de eliminación
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);

  // Estado para renombrar ticket
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editingTicketName, setEditingTicketName] = useState('');

  // Solicitar eliminar ticket (con confirmación si tiene items)
  const requestDeleteTicket = (ticket: Ticket) => {
    if (ticket.items.length > 0) {
      setTicketToDelete(ticket);
    } else {
      confirmDeleteTicket(ticket.id);
    }
  };

  // Confirmar eliminación de ticket
  const confirmDeleteTicket = (ticketId: string) => {
    setTicketToDelete(null);
    setTickets(prev => {
      const remaining = prev.filter(t => t.id !== ticketId);
      if (ticketId === activeTicketId) {
        if (remaining.length > 0) {
          setActiveTicketId(remaining[0].id);
        } else {
          const newTicket = createNewTicket();
          setActiveTicketId(newTicket.id);
          return [newTicket];
        }
      }
      return remaining;
    });
  };

  // Iniciar edición de nombre de ticket
  const startEditingTicketName = (ticket: Ticket) => {
    setEditingTicketId(ticket.id);
    setEditingTicketName(ticket.name);
  };

  // Guardar nombre de ticket
  const saveTicketName = () => {
    if (editingTicketId && editingTicketName.trim()) {
      setTickets(prev => prev.map(t =>
        t.id === editingTicketId
          ? { ...t, name: editingTicketName.trim() }
          : t
      ));
    }
    setEditingTicketId(null);
    setEditingTicketName('');
  };

  // Cancelar edición
  const cancelEditingTicketName = () => {
    setEditingTicketId(null);
    setEditingTicketName('');
  };

  // Estado de búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estado de productos y categorías
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickAccessCategories, setQuickAccessCategories] = useState<QuickAccessCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingCategoryProducts, setIsLoadingCategoryProducts] = useState(false);

  // Promociones activas
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
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);

  // Estado de punto de venta
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [selectedPOS, setSelectedPOS] = useState<PointOfSale | null>(null);
  const [showPOSSelector, setShowPOSSelector] = useState(false);

  // Estado del pago
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No procesar si estamos editando un nombre de ticket
      if (editingTicketId) return;

      // Ctrl+T o Ctrl+N: Nuevo ticket
      if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'n')) {
        e.preventDefault();
        handleNewTicket();
        return;
      }

      // Ctrl+1-9: Cambiar a ticket por número
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < tickets.length) {
          setActiveTicketId(tickets[index].id);
        }
        return;
      }

      // Ctrl+Tab: Siguiente ticket
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tickets.findIndex(t => t.id === activeTicketId);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tickets.length) % tickets.length
          : (currentIndex + 1) % tickets.length;
        setActiveTicketId(tickets[nextIndex].id);
        return;
      }

      // F2: Cobrar (si hay items)
      if (e.key === 'F2' && cart.length > 0) {
        e.preventDefault();
        setShowPayment(true);
        return;
      }

      // Escape: Cerrar modales y volver al campo de búsqueda
      if (e.key === 'Escape') {
        if (ticketToDelete) {
          setTicketToDelete(null);
        } else if (showPayment) {
          setShowPayment(false);
        }
        focusSearchInput();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tickets, activeTicketId, editingTicketId, cart.length, showPayment, ticketToDelete]);

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [categoriesRes, quickAccessRes, productsRes, posRes, promotionsRes] = await Promise.all([
        productsService.getCategories(),
        categoriesService.getQuickAccess(),
        productsService.list({ pageSize: 100 }),
        pointsOfSaleService.list(),
        promotionsService.getActive(),
      ]);

      if (categoriesRes.success) setCategories(categoriesRes.data);

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

      if (productsRes.success) setProducts(productsRes.data);

      // Cargar promociones activas
      if (promotionsRes.success) {
        setActivePromotions(promotionsRes.data || []);
      }

      if (posRes.success) {
        const userBranchId = user?.branch?.id;
        const activePOS = posRes.data.filter(
          (pos: PointOfSale) => pos.isActive && (!userBranchId || pos.branch?.id === userBranchId)
        );
        setPointsOfSale(activePOS);

        if (activePOS.length === 1) {
          setSelectedPOS(activePOS[0]);
        } else if (activePOS.length > 1) {
          setShowPOSSelector(true);
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Cargar productos de una categoría específica
  const loadCategoryProducts = useCallback(async (categoryId: string | null) => {
    if (!categoryId) {
      setCategoryProducts([]);
      return;
    }

    setIsLoadingCategoryProducts(true);
    try {
      const response = await productsService.list({ categoryId, pageSize: 500 });
      if (response.success) {
        setCategoryProducts(response.data);
      }
    } catch (error) {
      console.error('Error cargando productos de categoría:', error);
    } finally {
      setIsLoadingCategoryProducts(false);
    }
  }, []);

  // Efecto para cargar productos cuando cambia la categoría
  useEffect(() => {
    loadCategoryProducts(selectedCategory);
  }, [selectedCategory, loadCategoryProducts]);

  // Búsqueda de productos
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await productsService.search(query, undefined, user?.branch?.id);
      if (response.success) {
        setSearchResults(response.data);
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
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);

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
    focusSearchInput();
  };

  // Actualizar cantidad
  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
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
        .filter(item => item.quantity > 0)
    );
  };

  // Eliminar item
  const removeItem = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  // Vaciar carrito
  const clearCart = () => {
    setCart([]);
  };

  // Calcular promociones cuando cambia el carrito
  useEffect(() => {
    const calculatePromotions = async () => {
      if (cart.length === 0) return;

      try {
        const items = cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

        const response = await promotionsService.calculate(items);
        if (response.success && response.data) {
          const { items: calculatedItems } = response.data;

          setCart(prevCart => {
            return prevCart.map(cartItem => {
              const calculated = calculatedItems.find(
                (c: { productId: string }) => c.productId === cartItem.product.id
              );
              if (calculated && calculated.discount > 0) {
                return {
                  ...cartItem,
                  discount: calculated.discount,
                  subtotal: cartItem.quantity * cartItem.unitPrice - calculated.discount,
                  promotionId: calculated.promotion?.id,
                  promotionName: calculated.promotion?.name,
                };
              }
              // Si no hay descuento, limpiar promocion anterior
              if (cartItem.discount > 0 || cartItem.promotionId) {
                return {
                  ...cartItem,
                  discount: 0,
                  subtotal: cartItem.quantity * cartItem.unitPrice,
                  promotionId: undefined,
                  promotionName: undefined,
                };
              }
              return cartItem;
            });
          });
        }
      } catch (error) {
        console.error('Error calculando promociones:', error);
      }
    };

    // Debounce para evitar llamadas excesivas
    const timeoutId = setTimeout(calculatePromotions, 300);
    return () => clearTimeout(timeoutId);
  }, [cart.length, cart.map(i => `${i.product.id}:${i.quantity}`).join(',')]);

  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  // Formatear descuento para mostrar
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

  // Calcular vuelto
  const tenderedAmount = parseFloat(amountTendered) || 0;
  const change = tenderedAmount - total;

  // Procesar venta
  const processSale = async () => {
    if (cart.length === 0) return;

    if (!selectedPOS) {
      setShowPOSSelector(true);
      return;
    }

    setIsProcessing(true);
    try {
      const saleData = {
        branchId: selectedPOS.branch?.id || user?.branch?.id || '',
        pointOfSaleId: selectedPOS.id,
        items: cart.map(item => ({
          productId: item.product.id,
          productCode: item.product.sku,
          productName: item.product.name,
          productBarcode: item.product.barcode,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitPriceNet: Number(item.unitPriceNet),
          discount: Number(item.discount || 0),
          taxRate: Number(item.product.taxRate || 21),
          priceListId: selectedPOS.priceList?.id || null,
          branchId: selectedPOS.branch?.id || user?.branch?.id || '',
          promotionId: item.promotionId || undefined,
          promotionName: item.promotionName || undefined,
        })),
        payments: [
          {
            method: selectedPaymentMethod,
            amount: Number(total),
            amountTendered: selectedPaymentMethod === 'CASH' ? Number(tenderedAmount) : undefined,
          },
        ],
      };

      const response = await salesService.create(saleData);

      if (response.success) {
        clearCart();
        setShowPayment(false);
        setAmountTendered('');
        alert(`Venta #${response.data.saleNumber} registrada correctamente`);
        focusSearchInput();
      }
    } catch (error) {
      console.error('Error procesando venta:', error);
      alert('Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtrar productos - usar productos de categoría si hay una seleccionada
  const filteredProducts = selectedCategory
    ? categoryProducts
    : products;

  const categoriesWithProducts = categories.filter(cat =>
    products.some(p => p.category?.id === cat.id)
  );

  return (
    <div className="pos-layout">
      {/* Modal selector de Punto de Venta */}
      {showPOSSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Seleccionar Punto de Venta</h3>
            <div className="space-y-2">
              {pointsOfSale.map(pos => (
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
                </button>
              ))}
            </div>
            {selectedPOS && (
              <button onClick={() => setShowPOSSelector(false)} className="w-full btn btn-primary mt-4">
                Continuar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel izquierdo - Productos */}
      <div className="flex flex-col h-full min-h-0 bg-gray-50">
        {/* Header */}
        <div className="shrink-0 bg-white border-b p-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          <div className="text-right flex items-center gap-4">
            <button
              onClick={() => pointsOfSale.length > 1 && setShowPOSSelector(true)}
              className={`px-3 py-1 rounded-lg text-sm ${
                selectedPOS ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
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
            {searchResults.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <ShoppingCart className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-500">{product.sku} | {product.barcode}</p>
                </div>
                <p className="font-semibold">${getProductPrice(product).toFixed(2)}</p>
              </button>
            ))}
          </div>
        )}

        {/* Acceso Rápido - Categorías destacadas */}
        {quickAccessCategories.length > 0 && (
          <div className="shrink-0 bg-gradient-to-r from-primary-50 to-emerald-50 border-b">
            <div className="flex gap-2 p-3 overflow-x-auto">
              {quickAccessCategories.map(cat => (
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

        {/* Categorías */}
        <div className="shrink-0 flex gap-2 p-3 overflow-x-auto bg-gray-50/50">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todos
          </button>
          {categoriesWithProducts.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {isLoadingProducts || isLoadingCategoryProducts ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">No hay productos en esta categoría</p>
              <p className="text-sm">Selecciona otra categoría o busca un producto</p>
            </div>
          ) : (
            <div className="product-grid pb-4">
              {filteredProducts.map(product => {
                const promo = getProductPromotion(product);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    style={promo ? {
                      borderColor: `${promo.badgeColor || '#22C55E'}40`,
                    } : undefined}
                    className={`bg-white rounded-xl p-3 shadow-sm border-2 transition-all text-left relative ${
                      promo
                        ? 'hover:shadow-md'
                        : 'border-gray-100 hover:shadow-md hover:border-primary-200'
                    }`}
                    onMouseEnter={(e) => {
                      if (promo) {
                        e.currentTarget.style.borderColor = `${promo.badgeColor || '#22C55E'}80`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (promo) {
                        e.currentTarget.style.borderColor = `${promo.badgeColor || '#22C55E'}40`;
                      }
                    }}
                  >
                    {promo && (
                      <div
                        style={{ backgroundColor: promo.badgeColor || '#22C55E' }}
                        className="absolute -top-2 -right-2 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 z-10"
                      >
                        <Tag className="w-3 h-3" />
                        {formatPromotionBadge(promo)}
                      </div>
                    )}
                    <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingCart className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <p className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
                      {product.shortName || product.name}
                    </p>
                    <p className="text-primary-600 font-semibold mt-1">${getProductPrice(product).toFixed(2)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {ticketToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar ticket</h3>
                <p className="text-sm text-gray-500">{ticketToDelete.name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-2">
              Este ticket tiene <strong>{ticketToDelete.items.length} producto{ticketToDelete.items.length !== 1 ? 's' : ''}</strong> con un total de:
            </p>
            <p className="text-2xl font-bold text-gray-900 mb-4">
              ${calculateTicketTotal(ticketToDelete.items).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTicketToDelete(null)}
                className="flex-1 btn btn-secondary py-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDeleteTicket(ticketToDelete.id)}
                className="flex-1 btn bg-red-600 hover:bg-red-700 text-white py-2"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel derecho - Carrito */}
      <div className="flex flex-col h-full min-h-0 bg-white border-l">
        {/* Tabs de tickets - Diseño mejorado */}
        <div className="shrink-0 bg-gray-100 border-b">
          <div className="flex items-stretch gap-0 overflow-x-auto">
            {tickets.map((ticket, index) => {
              const ticketTotal = calculateTicketTotal(ticket.items);
              const isActive = activeTicketId === ticket.id;
              const hasItems = ticket.items.length > 0;

              return (
                <div
                  key={ticket.id}
                  onClick={() => !editingTicketId && setActiveTicketId(ticket.id)}
                  className={`relative group flex flex-col min-w-[140px] max-w-[180px] cursor-pointer transition-all ${
                    isActive
                      ? 'bg-white border-t-2 border-t-primary-600 z-10'
                      : 'bg-gray-50 hover:bg-gray-100 border-t-2 border-t-transparent'
                  } ${index > 0 ? 'border-l border-gray-200' : ''}`}
                >
                  {/* Contenido del tab */}
                  <div className="flex-1 px-3 py-2">
                    {/* Nombre del ticket - Editable */}
                    <div className="flex items-center gap-1 mb-1">
                      {editingTicketId === ticket.id ? (
                        <input
                          type="text"
                          value={editingTicketName}
                          onChange={(e) => setEditingTicketName(e.target.value)}
                          onBlur={saveTicketName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTicketName();
                            if (e.key === 'Escape') cancelEditingTicketName();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-1 py-0.5 text-sm font-medium border border-primary-400 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                            #{index + 1} {ticket.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTicketName(ticket);
                            }}
                            className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              isActive ? 'hover:bg-gray-100' : 'hover:bg-gray-200'
                            }`}
                            title="Renombrar"
                          >
                            <Edit3 className="w-3 h-3 text-gray-400" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Info del ticket */}
                    <div className="flex items-center justify-between">
                      {hasItems ? (
                        <>
                          <span className={`text-lg font-bold ${isActive ? 'text-primary-600' : 'text-gray-700'}`}>
                            ${ticketTotal.toFixed(2)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {ticket.items.reduce((sum, item) => sum + item.quantity, 0)} items
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Vacío
                        </span>
                      )}
                    </div>

                    {/* Tiempo */}
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(ticket.createdAt)}
                    </div>
                  </div>

                  {/* Botón eliminar */}
                  {tickets.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeleteTicket(ticket);
                      }}
                      className={`absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all ${
                        isActive
                          ? 'hover:bg-red-100 text-red-500'
                          : 'hover:bg-red-100 text-gray-400 hover:text-red-500'
                      }`}
                      title="Eliminar ticket"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Botón nuevo ticket */}
            <button
              onClick={handleNewTicket}
              className="flex items-center justify-center min-w-[50px] px-3 py-4 bg-gray-50 hover:bg-emerald-50 border-l border-gray-200 text-gray-500 hover:text-emerald-600 transition-colors"
              title="Nuevo ticket (Ctrl+T)"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Header del carrito - Simplificado */}
        <div className="shrink-0 p-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-600 hover:underline"
              >
                Vaciar carrito
              </button>
            )}
          </div>
        </div>

        {/* Lista de items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-600 font-medium mb-1">Ticket vacío</p>
              <p className="text-sm text-gray-400 mb-4 max-w-[200px]">
                Escanea un código de barras o busca productos para agregar
              </p>
              <div className="flex flex-col gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-500 font-mono">Enter</kbd>
                  <span>Buscar producto</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-500 font-mono">F2</kbd>
                  <span>Cobrar</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm line-clamp-1">{item.product.name}</p>
                      <p className="text-xs text-gray-500">${item.unitPrice.toFixed(2)} c/u</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      {item.discount > 0 ? (
                        <>
                          <p className="text-xs text-gray-400 line-through">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </p>
                          <p className="font-semibold text-green-600">${item.subtotal.toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
                      )}
                      <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-600 mt-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {item.promotionName && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      <Tag className="w-3 h-3" />
                      <span>{item.promotionName}</span>
                      <span className="ml-auto font-medium">-${item.discount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales y pago */}
        <div className="shrink-0 border-t p-4 space-y-3 bg-white">
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

              {selectedPaymentMethod === 'CASH' && (
                <div>
                  <label className="text-sm text-gray-500">Monto recibido</label>
                  <input
                    type="number"
                    value={amountTendered}
                    onChange={e => setAmountTendered(e.target.value)}
                    placeholder="0.00"
                    className="input text-xl text-right"
                    min={total}
                  />
                  {tenderedAmount >= total && (
                    <p className="text-right text-green-600 font-semibold mt-1">Vuelto: ${change.toFixed(2)}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setShowPayment(false); focusSearchInput(); }} className="flex-1 btn btn-secondary py-3">
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </button>
                <button
                  onClick={processSale}
                  disabled={isProcessing || (selectedPaymentMethod === 'CASH' && tenderedAmount < total)}
                  className="flex-1 btn btn-success py-3 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
