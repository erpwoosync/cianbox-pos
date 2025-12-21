"""
Modulo de configuracion del POS Desktop.

Este modulo centraliza toda la configuracion de la aplicacion:
- Settings: Configuracion cargada desde .env y variables de entorno
- Constants: Enumeraciones, colores, atajos de teclado, denominaciones

Uso:
    >>> from src.config import get_settings, PaymentMethod
    >>> settings = get_settings()
    >>> print(settings.API_URL)

Exports:
    - Settings: Clase de configuracion Pydantic
    - get_settings: Factory para obtener configuracion (singleton)
    - PaymentMethod: Enum de metodos de pago
    - SaleStatus: Enum de estados de venta
    - CashSessionStatus: Enum de estados de turno
    - ReceiptType: Enum de tipos de comprobante
    - PromotionType: Enum de tipos de promocion
    - SyncStatus: Enum de estados de sincronizacion
    - COLORS: Diccionario de colores del tema
    - KEYBOARD_SHORTCUTS: Mapeo de atajos de teclado
    - BILL_DENOMINATIONS: Denominaciones de billetes (ARS)
    - COIN_DENOMINATIONS: Denominaciones de monedas (ARS)
"""

from .settings import Settings, get_settings
from .constants import (
    # Enumeraciones
    PaymentMethod,
    SaleStatus,
    CashSessionStatus,
    ReceiptType,
    PromotionType,
    SyncStatus,
    # Colores y UI
    COLORS,
    KEYBOARD_SHORTCUTS,
    # Denominaciones monetarias
    BILL_DENOMINATIONS,
    COIN_DENOMINATIONS,
    # Constantes de configuracion
    DEFAULT_TAX_RATE,
    DEFAULT_PAGE_SIZE,
    MAX_CART_ITEMS,
    BARCODE_MIN_LENGTH,
    BARCODE_MAX_LENGTH,
    TOKEN_REFRESH_BEFORE_EXPIRY,
    API_RETRY_DELAY,
    API_MAX_RETRIES,
    SYNC_INTERVAL,
    # Formatos
    DATE_FORMAT,
    TIME_FORMAT,
    DATETIME_FORMAT,
    CURRENCY_SYMBOL,
    CURRENCY_DECIMALS,
    # Dimensiones de ventana
    MAIN_WINDOW_MIN_WIDTH,
    MAIN_WINDOW_MIN_HEIGHT,
    MAIN_WINDOW_DEFAULT_WIDTH,
    MAIN_WINDOW_DEFAULT_HEIGHT,
    LOGIN_WINDOW_WIDTH,
    LOGIN_WINDOW_HEIGHT,
    DIALOG_MIN_WIDTH,
    DIALOG_MIN_HEIGHT,
    CHECKOUT_DIALOG_WIDTH,
    CHECKOUT_DIALOG_HEIGHT,
    PRODUCT_LOOKUP_WIDTH,
    PRODUCT_LOOKUP_HEIGHT,
    # Limites de negocio
    MAX_SALE_AMOUNT,
    MIN_SALE_AMOUNT,
    MAX_ITEM_QUANTITY,
    MAX_DISCOUNT_PERCENT,
    SEARCH_DEBOUNCE_MS,
    SEARCH_MIN_CHARS,
    SEARCH_MAX_RESULTS,
    PRODUCTS_CACHE_TTL_MINUTES,
    PROMOTIONS_CACHE_TTL_MINUTES,
    # Mensajes de error
    ERROR_MESSAGES,
)

__all__ = [
    # Settings
    "Settings",
    "get_settings",
    # Enumeraciones
    "PaymentMethod",
    "SaleStatus",
    "CashSessionStatus",
    "ReceiptType",
    "PromotionType",
    "SyncStatus",
    # UI
    "COLORS",
    "KEYBOARD_SHORTCUTS",
    # Denominaciones
    "BILL_DENOMINATIONS",
    "COIN_DENOMINATIONS",
    # Constantes
    "DEFAULT_TAX_RATE",
    "DEFAULT_PAGE_SIZE",
    "MAX_CART_ITEMS",
    "BARCODE_MIN_LENGTH",
    "BARCODE_MAX_LENGTH",
    "TOKEN_REFRESH_BEFORE_EXPIRY",
    "API_RETRY_DELAY",
    "API_MAX_RETRIES",
    "SYNC_INTERVAL",
    # Formatos
    "DATE_FORMAT",
    "TIME_FORMAT",
    "DATETIME_FORMAT",
    "CURRENCY_SYMBOL",
    "CURRENCY_DECIMALS",
    # Dimensiones de ventana
    "MAIN_WINDOW_MIN_WIDTH",
    "MAIN_WINDOW_MIN_HEIGHT",
    "MAIN_WINDOW_DEFAULT_WIDTH",
    "MAIN_WINDOW_DEFAULT_HEIGHT",
    "LOGIN_WINDOW_WIDTH",
    "LOGIN_WINDOW_HEIGHT",
    "DIALOG_MIN_WIDTH",
    "DIALOG_MIN_HEIGHT",
    "CHECKOUT_DIALOG_WIDTH",
    "CHECKOUT_DIALOG_HEIGHT",
    "PRODUCT_LOOKUP_WIDTH",
    "PRODUCT_LOOKUP_HEIGHT",
    # Limites de negocio
    "MAX_SALE_AMOUNT",
    "MIN_SALE_AMOUNT",
    "MAX_ITEM_QUANTITY",
    "MAX_DISCOUNT_PERCENT",
    "SEARCH_DEBOUNCE_MS",
    "SEARCH_MIN_CHARS",
    "SEARCH_MAX_RESULTS",
    "PRODUCTS_CACHE_TTL_MINUTES",
    "PROMOTIONS_CACHE_TTL_MINUTES",
    # Mensajes de error
    "ERROR_MESSAGES",
]
