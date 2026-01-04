"""
Modulo de servicios de negocio.

Contiene la logica de negocio de la aplicacion:
- CartService: Gestion del carrito de compras
- SyncService: Sincronizacion con backend
- PrintService: Impresion de tickets

Uso:
    >>> from src.services import get_cart_service, get_sync_service, get_print_service
    >>> cart = get_cart_service()
    >>> cart.add_item(product)
    >>> sync = get_sync_service()
    >>> await sync.sync_products()
    >>> printer = get_print_service()
    >>> ticket = printer.generate_sale_ticket(sale_data)
"""

from .sync_service import (
    SyncService,
    SyncStatus,
    SyncResult,
    get_sync_service,
    reset_sync_service,
)

from .cart_service import (
    CartService,
    CartItem,
    DiscountType,
    get_cart_service,
    reset_cart_service,
)

from .print_service import (
    PrintService,
    PrinterConfig,
    Ticket,
    TicketType,
    get_print_service,
    reset_print_service,
)

from .cash_session_manager import (
    CashSessionManager,
    get_cash_session_manager,
    reset_cash_session_manager,
)

__all__ = [
    # Sincronizacion
    "SyncService",
    "SyncStatus",
    "SyncResult",
    "get_sync_service",
    "reset_sync_service",
    # Carrito
    "CartService",
    "CartItem",
    "DiscountType",
    "get_cart_service",
    "reset_cart_service",
    # Impresion
    "PrintService",
    "PrinterConfig",
    "Ticket",
    "TicketType",
    "get_print_service",
    "reset_print_service",
    # Sesion de Caja
    "CashSessionManager",
    "get_cash_session_manager",
    "reset_cash_session_manager",
]
