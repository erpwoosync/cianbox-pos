import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  X,
  Check,
  Loader2,
  Smartphone,
  User,
  RotateCcw,
  Ticket as TicketIcon,
  AlertCircle,
} from 'lucide-react';
import { CartItem, Ticket } from '../../hooks/useCart';
import { CashSession } from '../../services/api';
import { Customer, CONSUMIDOR_FINAL } from '../../services/customers';
import GiftCardPaymentSection, { AppliedGiftCard } from '../GiftCardPaymentSection';
import StoreCreditPaymentSection, { AppliedStoreCredit } from '../StoreCreditPaymentSection';

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR' | 'MP_POINT' | 'MP_QR' | 'TRANSFER' | 'GIFT_CARD' | 'VOUCHER';

interface CartPanelProps {
  tickets: Ticket[];
  currentTicket: Ticket | undefined;
  cartItems: CartItem[];
  showTicketList: boolean;
  onCreateTicket: () => void;
  onSwitchTicket: (ticketId: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onShowTicketList: (show: boolean) => void;
  selectedCustomer: Customer | null;
  onOpenCustomerModal: () => void;
  updateQuantity: (itemId: string, delta: number) => void;
  removeItem: (itemId: string) => void;
  subtotal: number;
  totalDiscount: number;
  total: number;
  itemCount: number;
  discountsByPromotion: Record<string, { name: string; total: number }>;
  onOpenPayment: () => void;
  cashSession: CashSession | null;
  // Payment state
  showPayment: boolean;
  onClosePayment: () => void;
  selectedPaymentMethod: PaymentMethod | null;
  onSelectPaymentMethod: (method: PaymentMethod | null) => void;
  amountTendered: string;
  onAmountTenderedChange: (value: string) => void;
  isProcessing: boolean;
  isCalculatingPromotions: boolean;
  updateCart: (updater: (items: CartItem[]) => CartItem[]) => void;
  // MP
  mpPointAvailable: boolean;
  mpQRAvailable: boolean;
  onOpenOrphanPaymentModal: () => void;
  // Card payment
  onOpenCardPaymentModal: (method: 'CREDIT_CARD' | 'DEBIT_CARD') => void;
  cardPaymentData: unknown;
  onClearCardPaymentData: () => void;
  removeSurchargeItem: () => void;
  // Gift cards & store credits
  appliedGiftCards: AppliedGiftCard[];
  onApplyGiftCard: (gc: AppliedGiftCard) => void;
  onRemoveGiftCard: (code: string) => void;
  appliedStoreCredits: AppliedStoreCredit[];
  onApplyStoreCredit: (sc: AppliedStoreCredit) => void;
  onRemoveStoreCredit: (code: string) => void;
  customerCredits: { totalAvailable: number; count: number } | null;
  giftCardAmount: number;
  storeCreditAmount: number;
  totalAfterGiftCards: number;
  amountToPay: number;
  tenderedAmount: number;
  change: number;
  // Receipt
  receiptMode: 'NDP' | 'FACTURA';
  onReceiptModeChange: (mode: 'NDP' | 'FACTURA') => void;
  cianboxTalonarios: Array<{ id: number; descripcion: string }>;
  selectedTalonarioId: number | null;
  onSelectedTalonarioIdChange: (id: number) => void;
  // Actions
  onProcessSale: () => void;
  onHandleExactExchange: () => void;
  onOpenStoreCreditModal: () => void;
  // Produccion amount for card
  productsAmountForCard: number;
}

export default function CartPanel({
  tickets,
  currentTicket,
  cartItems: cart,
  showTicketList,
  onCreateTicket,
  onSwitchTicket,
  onDeleteTicket,
  onShowTicketList,
  selectedCustomer,
  onOpenCustomerModal,
  updateQuantity,
  removeItem,
  subtotal,
  totalDiscount,
  total,
  itemCount,
  discountsByPromotion,
  onOpenPayment,
  cashSession: _cashSession,
  // Payment state
  showPayment,
  onClosePayment,
  selectedPaymentMethod,
  onSelectPaymentMethod,
  amountTendered,
  onAmountTenderedChange,
  isProcessing,
  isCalculatingPromotions,
  updateCart,
  // MP
  mpPointAvailable,
  mpQRAvailable,
  onOpenOrphanPaymentModal,
  // Card payment
  onOpenCardPaymentModal,
  cardPaymentData,
  onClearCardPaymentData,
  removeSurchargeItem,
  // Gift cards & store credits
  appliedGiftCards,
  onApplyGiftCard,
  onRemoveGiftCard,
  appliedStoreCredits,
  onApplyStoreCredit,
  onRemoveStoreCredit,
  customerCredits,
  giftCardAmount,
  storeCreditAmount,
  totalAfterGiftCards,
  amountToPay,
  tenderedAmount,
  change,
  // Receipt
  receiptMode,
  onReceiptModeChange,
  cianboxTalonarios,
  selectedTalonarioId,
  onSelectedTalonarioIdChange,
  // Actions
  onProcessSale,
  onHandleExactExchange,
  onOpenStoreCreditModal,
}: CartPanelProps) {
  const currentTicketId = currentTicket?.id;

  return (
    <div className="flex flex-col h-screen bg-white border-l">
      {/* Selector de tickets */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowTicketList(!showTicketList)}
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
            onClick={onCreateTicket}
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
                onClick={() => onSwitchTicket(ticket.id)}
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
                        onDeleteTicket(ticket.id);
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
          onClick={onOpenCustomerModal}
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
              <TicketIcon className="w-4 h-4 text-amber-600" />
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
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          {showPayment ? 'Resumen' : 'Carrito'}
          {itemCount > 0 && (
            <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {showPayment && (
            <button
              onClick={onClosePayment}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              ← Volver
            </button>
          )}
          {cart.length > 0 && !showPayment && (
            <button
              onClick={() => updateCart(() => [])}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Vaciar
            </button>
          )}
        </div>
      </div>

      {/* Contenido principal - dos columnas en modo pago */}
      <div className={`flex-1 overflow-hidden ${showPayment ? 'grid grid-cols-2 gap-0' : 'flex flex-col'}`}>
        {/* Columna izquierda: Lista de items */}
        <div className={`overflow-y-auto ${showPayment ? 'border-r flex flex-col' : 'flex-1'}`}>
          <div className="flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p>Carrito vacío</p>
                <p className="text-sm">Escanee o busque productos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item: CartItem) => (
                  <div
                    key={item.id}
                    className={`rounded-lg p-2 flex gap-2 ${
                      item.isReturn
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {item.isReturn && (
                          <RotateCcw className="w-3 h-3 text-red-500 flex-shrink-0" />
                        )}
                        <p className={`font-medium text-sm line-clamp-1 ${item.isReturn ? 'text-red-700' : ''}`}>
                          {item.product.shortName || item.product.name}
                        </p>
                      </div>
                      {/* Mostrar talle y color si existen */}
                      {(item.product.size || item.product.color) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {item.product.size && (
                            <span className={`inline-flex items-center px-1 py-0.5 text-[10px] font-medium rounded ${
                              item.isReturn ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              T:{item.product.size}
                            </span>
                          )}
                          {item.product.color && (
                            <span className={`inline-flex items-center px-1 py-0.5 text-[10px] font-medium rounded ${
                              item.isReturn ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.product.color}
                            </span>
                          )}
                        </div>
                      )}
                      <p className={`text-[10px] ${item.isReturn ? 'text-red-500' : 'text-gray-500'}`}>
                        {item.isReturn ? '-' : ''}${Math.abs(item.unitPrice).toFixed(2)} c/u
                      </p>
                      {item.promotionName && !item.isReturn && (
                        <p className="text-[10px] text-green-600 flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" />
                          {item.promotionName}
                        </p>
                      )}
                      {item.isReturn && item.returnReason && (
                        <p className="text-[10px] text-red-500 italic">
                          {item.returnReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {item.isReturn ? (
                        <span className="px-2 py-0.5 text-center text-sm font-bold text-red-600 bg-red-100 rounded">
                          {item.quantity < 0 ? '' : '-'}{Math.abs(item.quantity)}
                        </span>
                      ) : item.isSurcharge ? (
                        /* Items de recargo: mostrar cantidad sin botones */
                        <span className="px-2 py-0.5 text-center text-sm font-medium text-gray-600">
                          {item.quantity}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-6 h-6 rounded bg-white border flex items-center justify-center hover:bg-gray-100 text-xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-6 h-6 rounded bg-white border flex items-center justify-center hover:bg-gray-100 text-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end justify-center">
                      <p className={`font-semibold text-sm ${item.isReturn ? 'text-red-600' : ''}`}>
                        {item.isReturn ? '-' : ''}${Math.abs(item.subtotal).toFixed(2)}
                      </p>
                      {/* No mostrar botón eliminar para items de recargo */}
                      {!item.isSurcharge && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Subtotal en columna izquierda cuando está en modo pago */}
          {showPayment && cart.length > 0 && (
            <div className="border-t bg-gray-50 p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{itemCount} items</span>
                <span className="font-semibold">Subtotal: ${(subtotal + totalDiscount).toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-green-600 mt-1">
                  <span>Descuentos aplicados</span>
                  <span>-${totalDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha: Totales y pago */}
        <div className={`${showPayment ? 'flex flex-col overflow-hidden' : 'border-t'}`}>
          <div className={`p-3 space-y-3 ${showPayment ? 'flex-1 overflow-y-auto' : ''}`}>
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
                onOpenStoreCreditModal();
              } else if (total === 0) {
                // Cambio exacto = confirmar sin pago
                onHandleExactExchange();
              } else {
                // Total positivo = cobrar normal
                onOpenPayment();
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
                  onClick={() => {
                    // Para crédito y débito, abrir modal de datos de cupón
                    if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
                      // Si hace clic en el mismo tipo de tarjeta que ya tiene,
                      // abrir modal para editar pero mantener datos existentes
                      const isSameMethod = selectedPaymentMethod === method;
                      if (!isSameMethod) {
                        // Cambió de método, limpiar datos anteriores
                        onSelectPaymentMethod(null);
                        onClearCardPaymentData();
                      }
                      onOpenCardPaymentModal(method);
                    } else {
                      onSelectPaymentMethod(method);
                      // Limpiar datos de tarjeta y recargo si cambia a otro método
                      onClearCardPaymentData();
                      removeSurchargeItem();
                    }
                  }}
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
                      onClick={() => {
                        onSelectPaymentMethod('MP_POINT');
                        onClearCardPaymentData();
                        removeSurchargeItem();
                      }}
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
                      onClick={() => {
                        onSelectPaymentMethod('MP_QR');
                        onClearCardPaymentData();
                        removeSurchargeItem();
                      }}
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
                    onClick={onOpenOrphanPaymentModal}
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
              onApplyGiftCard={onApplyGiftCard}
              onRemoveGiftCard={(code) => onRemoveGiftCard(code)}
              disabled={isProcessing}
            />

            {/* Seccion de Vales de Credito */}
            <StoreCreditPaymentSection
              totalAmount={total - giftCardAmount}
              storeCreditAmount={storeCreditAmount}
              appliedStoreCredits={appliedStoreCredits}
              onApplyStoreCredit={onApplyStoreCredit}
              onRemoveStoreCredit={(code) => onRemoveStoreCredit(code)}
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
                  onChange={(e) => onAmountTenderedChange(e.target.value)}
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

            {/* Advertencia si hay monto pendiente sin cubrir */}
            {amountToPay > 0 && !selectedPaymentMethod && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Selecciona un método de pago
                  </p>
                  <p className="text-xs text-amber-600">
                    Aún quedan ${amountToPay.toFixed(2)} pendientes de cubrir
                  </p>
                </div>
              </div>
            )}

            {/* Selector de comprobante */}
            {selectedPaymentMethod && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="block text-xs font-medium text-gray-600 mb-2">Comprobante</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onReceiptModeChange('NDP')}
                    disabled={selectedPaymentMethod !== 'CASH' || appliedGiftCards.length > 0 || appliedStoreCredits.length > 0}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      receiptMode === 'NDP'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700'
                    } ${(selectedPaymentMethod !== 'CASH' || appliedGiftCards.length > 0 || appliedStoreCredits.length > 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Nota de Pedido
                  </button>
                  <button
                    type="button"
                    onClick={() => onReceiptModeChange('FACTURA')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      receiptMode === 'FACTURA'
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                  >
                    Factura
                  </button>
                </div>
                {receiptMode === 'FACTURA' && cianboxTalonarios.length > 1 && (
                  <select
                    value={selectedTalonarioId ?? ''}
                    onChange={(e) => onSelectedTalonarioIdChange(Number(e.target.value))}
                    className="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {cianboxTalonarios.map((t) => (
                      <option key={t.id} value={t.id}>{t.descripcion}</option>
                    ))}
                  </select>
                )}
                {receiptMode === 'FACTURA' && cianboxTalonarios.length === 1 && (
                  <p className="mt-2 text-xs text-green-700 font-medium">{cianboxTalonarios[0].descripcion}</p>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2">
              <button
                onClick={onClosePayment}
                className="flex-1 btn btn-secondary py-3"
              >
                <X className="w-5 h-5 mr-2" />
                Cancelar
              </button>
              <button
                onClick={onProcessSale}
                disabled={
                  isProcessing ||
                  // Si hay monto pendiente y es efectivo, validar monto entregado
                  (selectedPaymentMethod === 'CASH' && amountToPay > 0 && tenderedAmount < amountToPay) ||
                  // Si hay monto pendiente pero los vales/gift cards no cubren todo,
                  // y no hay un método de pago principal válido, deshabilitar
                  (amountToPay > 0 && !selectedPaymentMethod) ||
                  // Si el método es tarjeta, requiere haber completado los datos del cupón
                  (amountToPay > 0 && (selectedPaymentMethod === 'CREDIT_CARD' || selectedPaymentMethod === 'DEBIT_CARD') && !cardPaymentData)
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
      </div>
    </div>
  );
}
