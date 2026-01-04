"""
Vistas del POS.

Cada vista es un widget independiente que se muestra en el stack principal.
"""

from .pos_view import POSView
from .refund_view import RefundView
from .product_lookup_view import ProductLookupView
from .sales_history_view import SalesHistoryView
from .cash_close_view import CashCloseView

__all__ = [
    "POSView",
    "RefundView",
    "ProductLookupView",
    "SalesHistoryView",
    "CashCloseView",
]
