"""
Modulo de servicios de negocio.

Contiene la logica de negocio de la aplicacion:
- CartService: Gestion del carrito de compras
- PaymentService: Procesamiento de pagos
- PromotionService: Calculo de promociones
- SyncService: Sincronizacion con backend
- PrinterService: Impresion de tickets
"""

from .sync_service import (
    SyncService,
    SyncStatus,
    SyncResult,
    get_sync_service,
    reset_sync_service,
)

__all__ = [
    "SyncService",
    "SyncStatus",
    "SyncResult",
    "get_sync_service",
    "reset_sync_service",
]
