"""
Dialogos modales de la aplicacion.

Ventanas emergentes para:
- CheckoutDialog: Dialogo de cobro
- ProductLookupDialog: Dialogo de consulta de productos
- CustomerDialog: Dialogo de seleccion de cliente
- InvoiceDialog: Dialogo de facturacion electronica AFIP
- SalesHistoryDialog: Dialogo de historial de ventas
- ProductRefundDialog: Dialogo de devolucion orientado a producto
- CashSessionDialog: Dialogo de apertura/cierre de caja
- CashMovementDialog: Dialogo de movimientos de caja
- GiftCardDialog: Dialogo de gift cards
- PaymentDialog: Dialogo de pago (legacy)
- DiscountDialog: Dialogo de descuento
- QuantityDialog: Dialogo de cantidad
- ConfirmDialog: Dialogo de confirmacion
- MessageDialog: Dialogo de mensaje
"""

from .checkout_dialog import CheckoutDialog, CheckoutResult, PaymentData
from .product_lookup_dialog import ProductLookupDialog
from .customer_dialog import CustomerDialog
from .invoice_dialog import InvoiceDialog
from .sales_history_dialog import SalesHistoryDialog
from .product_refund_dialog import ProductRefundDialog
from .size_curve_dialog import SizeCurveDialog, VariantSelection
from .variant_selector_dialog import VariantSelectorDialog
from .supervisor_pin_dialog import SupervisorPinDialog
from .sale_detail_dialog import SaleDetailDialog
from .cash_session_dialog import CashSessionDialog
from .cash_movement_dialog import CashMovementDialog, QuickCashMovementDialog
from .gift_card_dialog import GiftCardDialog, GiftCardBalanceDialog

__all__ = [
    "CheckoutDialog",
    "CheckoutResult",
    "PaymentData",
    "ProductLookupDialog",
    "CustomerDialog",
    "InvoiceDialog",
    "SalesHistoryDialog",
    "ProductRefundDialog",
    "SizeCurveDialog",
    "VariantSelection",
    "VariantSelectorDialog",
    "SupervisorPinDialog",
    "SaleDetailDialog",
    # Caja
    "CashSessionDialog",
    "CashMovementDialog",
    "QuickCashMovementDialog",
    "GiftCardDialog",
    "GiftCardBalanceDialog",
]
