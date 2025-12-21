"""
Modulo de configuracion.

Exporta:
    - settings: Configuracion global de la aplicacion
    - constants: Constantes y enumeraciones
"""

from .settings import Settings, get_settings
from .constants import (
    PaymentMethod,
    SaleStatus,
    CashSessionStatus,
    ReceiptType,
    PromotionType,
    COLORS,
    KEYBOARD_SHORTCUTS,
)

__all__ = [
    "Settings",
    "get_settings",
    "PaymentMethod",
    "SaleStatus",
    "CashSessionStatus",
    "ReceiptType",
    "PromotionType",
    "COLORS",
    "KEYBOARD_SHORTCUTS",
]
