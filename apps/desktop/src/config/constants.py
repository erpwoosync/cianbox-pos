"""
Constantes y enumeraciones de la aplicacion.

Define valores fijos usados en toda la aplicacion como:
- Enumeraciones de estados y tipos
- Colores del tema
- Atajos de teclado
- Denominaciones de billetes y monedas
"""

from enum import Enum


class PaymentMethod(str, Enum):
    """Metodos de pago soportados."""

    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    QR = "QR"
    MP_POINT = "MP_POINT"
    TRANSFER = "TRANSFER"
    CHECK = "CHECK"
    CREDIT = "CREDIT"
    VOUCHER = "VOUCHER"
    GIFTCARD = "GIFTCARD"
    OTHER = "OTHER"

    @classmethod
    def get_display_name(cls, method: "PaymentMethod") -> str:
        """Obtiene el nombre para mostrar del metodo de pago."""
        names = {
            cls.CASH: "Efectivo",
            cls.CREDIT_CARD: "Tarjeta de Credito",
            cls.DEBIT_CARD: "Tarjeta de Debito",
            cls.QR: "QR",
            cls.MP_POINT: "MercadoPago Point",
            cls.TRANSFER: "Transferencia",
            cls.CHECK: "Cheque",
            cls.CREDIT: "Cuenta Corriente",
            cls.VOUCHER: "Voucher",
            cls.GIFTCARD: "Gift Card",
            cls.OTHER: "Otro",
        }
        return names.get(method, method.value)


class SaleStatus(str, Enum):
    """Estados de venta."""

    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"
    PARTIAL_REFUND = "PARTIAL_REFUND"


class CashSessionStatus(str, Enum):
    """Estados de turno de caja."""

    OPEN = "OPEN"
    SUSPENDED = "SUSPENDED"
    COUNTING = "COUNTING"
    CLOSED = "CLOSED"
    TRANSFERRED = "TRANSFERRED"


class ReceiptType(str, Enum):
    """Tipos de comprobante fiscal."""

    TICKET = "TICKET"
    INVOICE_A = "INVOICE_A"
    INVOICE_B = "INVOICE_B"
    INVOICE_C = "INVOICE_C"
    CREDIT_NOTE_A = "CREDIT_NOTE_A"
    CREDIT_NOTE_B = "CREDIT_NOTE_B"
    CREDIT_NOTE_C = "CREDIT_NOTE_C"
    RECEIPT = "RECEIPT"


class PromotionType(str, Enum):
    """Tipos de promocion."""

    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"
    BUY_X_GET_Y = "BUY_X_GET_Y"
    SECOND_UNIT_DISCOUNT = "SECOND_UNIT_DISCOUNT"
    BUNDLE_PRICE = "BUNDLE_PRICE"
    FLASH_SALE = "FLASH_SALE"
    COUPON = "COUPON"


class SyncStatus(str, Enum):
    """Estados de sincronizacion."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ==============================================================================
# TEMA Y COLORES
# ==============================================================================

COLORS = {
    # Colores primarios (Estilo Office/Excel - Azul)
    "primary": "#217346",      # Verde Excel
    "primary_light": "#33a060",
    "primary_dark": "#1e5c38",
    "primary_bg": "#e6f4ea",

    # Colores secundarios (Azul Office)
    "secondary": "#0078d4",
    "secondary_light": "#1a86d9",
    "secondary_dark": "#005a9e",

    # Estados
    "success": "#107c10",
    "success_light": "#54a754",
    "success_dark": "#0b5c0b",
    "success_bg": "#dff6dd",

    "warning": "#ff8c00",
    "warning_light": "#ffb347",
    "warning_dark": "#cc7000",
    "warning_bg": "#fff4ce",

    "danger": "#d13438",
    "danger_light": "#e74856",
    "danger_dark": "#a52a2d",
    "danger_bg": "#fde7e9",

    "info": "#0078d4",
    "info_light": "#1a86d9",
    "info_dark": "#005a9e",
    "info_bg": "#e6f2fb",

    # Neutros
    "white": "#ffffff",
    "black": "#000000",
    "dark": "#201f1e",

    # Escala de grises (Estilo Office)
    "gray_50": "#faf9f8",
    "gray_100": "#f3f2f1",
    "gray_200": "#edebe9",
    "gray_300": "#d2d0ce",
    "gray_400": "#a19f9d",
    "gray_500": "#605e5c",
    "gray_600": "#484644",
    "gray_700": "#323130",
    "gray_800": "#252423",
    "gray_900": "#201f1e",

    # Fondos (claros estilo Office)
    "background": "#f3f2f1",
    "background_secondary": "#ffffff",
    "surface": "#ffffff",

    # Bordes
    "border": "#d2d0ce",
    "border_light": "#edebe9",
    "border_focus": "#217346",

    # Texto
    "text_primary": "#201f1e",
    "text_secondary": "#605e5c",
    "text_muted": "#a19f9d",
    "text_inverse": "#ffffff",
}


# ==============================================================================
# ATAJOS DE TECLADO
# ==============================================================================

KEYBOARD_SHORTCUTS = {
    # Teclas de funcion
    "F1": ("help", "Ayuda"),
    "F2": ("search", "Buscar producto"),
    "F3": ("new_customer", "Nuevo cliente"),
    "F4": ("discount", "Aplicar descuento"),
    "F5": ("refresh", "Actualizar/Sincronizar"),
    "F6": ("open_drawer", "Abrir cajon"),
    "F7": ("reprint", "Reimprimir ultimo ticket"),
    "F8": ("price_check", "Consultar precio"),
    "F9": ("void_item", "Anular item seleccionado"),
    "F10": ("suspend", "Suspender venta"),
    "F11": ("recall", "Recuperar venta"),
    "F12": ("checkout", "Cobrar"),

    # Teclas de control
    "Escape": ("cancel", "Cancelar operacion"),
    "Return": ("confirm", "Confirmar"),
    "Enter": ("confirm", "Confirmar"),

    # Modificadores de cantidad
    "+": ("qty_increase", "Aumentar cantidad"),
    "-": ("qty_decrease", "Disminuir cantidad"),
    "*": ("qty_multiply", "Multiplicar cantidad"),

    # Navegacion
    "Up": ("nav_up", "Navegar arriba"),
    "Down": ("nav_down", "Navegar abajo"),
    "Tab": ("nav_next", "Siguiente campo"),
}


# ==============================================================================
# DENOMINACIONES MONETARIAS (Argentina - ARS)
# ==============================================================================

BILL_DENOMINATIONS = [
    (10000, "Diez mil"),
    (5000, "Cinco mil"),
    (2000, "Dos mil"),
    (1000, "Mil"),
    (500, "Quinientos"),
    (200, "Doscientos"),
    (100, "Cien"),
]

COIN_DENOMINATIONS = [
    (500, "Quinientos"),
    (200, "Doscientos"),
    (100, "Cien"),
    (50, "Cincuenta"),
    (25, "Veinticinco"),
    (10, "Diez"),
    (5, "Cinco"),
    (2, "Dos"),
    (1, "Uno"),
]


# ==============================================================================
# CONFIGURACION POR DEFECTO
# ==============================================================================

DEFAULT_TAX_RATE = 21.0  # IVA en Argentina
DEFAULT_PAGE_SIZE = 50
MAX_CART_ITEMS = 100
BARCODE_MIN_LENGTH = 8
BARCODE_MAX_LENGTH = 14

# Tiempos (en segundos)
TOKEN_REFRESH_BEFORE_EXPIRY = 300  # 5 minutos antes
API_RETRY_DELAY = 2
API_MAX_RETRIES = 3
SYNC_INTERVAL = 300  # 5 minutos

# Formatos
DATE_FORMAT = "%d/%m/%Y"
TIME_FORMAT = "%H:%M:%S"
DATETIME_FORMAT = "%d/%m/%Y %H:%M:%S"
CURRENCY_SYMBOL = "$"
CURRENCY_DECIMALS = 2


# ==============================================================================
# DIMENSIONES DE VENTANA
# ==============================================================================

# Ventana principal
MAIN_WINDOW_MIN_WIDTH = 1024
MAIN_WINDOW_MIN_HEIGHT = 768
MAIN_WINDOW_DEFAULT_WIDTH = 1280
MAIN_WINDOW_DEFAULT_HEIGHT = 800

# Ventana de login
LOGIN_WINDOW_WIDTH = 450
LOGIN_WINDOW_HEIGHT = 600

# Dialogos
DIALOG_MIN_WIDTH = 400
DIALOG_MIN_HEIGHT = 300
CHECKOUT_DIALOG_WIDTH = 700
CHECKOUT_DIALOG_HEIGHT = 600
PRODUCT_LOOKUP_WIDTH = 900
PRODUCT_LOOKUP_HEIGHT = 600


# ==============================================================================
# LIMITES DE NEGOCIO
# ==============================================================================

# Ventas
MAX_SALE_AMOUNT = 10_000_000  # Monto maximo de venta en pesos
MIN_SALE_AMOUNT = 1  # Monto minimo de venta
MAX_ITEM_QUANTITY = 9999  # Cantidad maxima por item
MAX_DISCOUNT_PERCENT = 100  # Descuento maximo porcentual

# Busqueda
SEARCH_DEBOUNCE_MS = 300  # Tiempo de debounce en busqueda
SEARCH_MIN_CHARS = 2  # Caracteres minimos para buscar
SEARCH_MAX_RESULTS = 100  # Resultados maximos de busqueda

# Cache
PRODUCTS_CACHE_TTL_MINUTES = 60  # Tiempo de vida del cache de productos
PROMOTIONS_CACHE_TTL_MINUTES = 5  # Tiempo de vida del cache de promociones


# ==============================================================================
# MENSAJES DE ERROR COMUNES
# ==============================================================================

ERROR_MESSAGES = {
    "network": "Sin conexion a internet. Verifique su conexion.",
    "auth": "Credenciales invalidas. Verifique usuario y contrasena.",
    "session_expired": "Su sesion ha expirado. Inicie sesion nuevamente.",
    "permission": "No tiene permisos para realizar esta operacion.",
    "server": "Error del servidor. Intente nuevamente.",
    "invalid_barcode": "Codigo de barras no reconocido.",
    "product_not_found": "Producto no encontrado.",
    "insufficient_stock": "Stock insuficiente para esta operacion.",
    "invalid_amount": "Monto invalido.",
    "terminal_pending": "Terminal pendiente de activacion.",
    "terminal_blocked": "Terminal bloqueada. Contacte al administrador.",
}
