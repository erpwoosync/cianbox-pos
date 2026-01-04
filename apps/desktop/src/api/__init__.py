"""
Modulo de cliente API para Cianbox POS Desktop.

Proporciona comunicacion HTTP con el backend de Cianbox POS.
Incluye manejo de autenticacion JWT, reintentos y errores tipados.

Componentes principales:
    - APIClient: Cliente HTTP base con autenticacion JWT
    - AuthAPI: Autenticacion y registro de dispositivos
    - ProductsAPI: Consulta de productos, categorias, marcas
    - CustomersAPI: Consulta y busqueda de clientes
    - SalesAPI: Registro y consulta de ventas
    - PromotionsAPI: Promociones y calculos de descuentos
    - TerminalAPI: Control de terminales POS

Uso basico:
    >>> from src.api import get_api_client, AuthAPI
    >>> client = get_api_client()
    >>> auth = AuthAPI()
    >>> result = auth.login("demo", "user@demo.com", "password")

Manejo de errores:
    >>> from src.api import APIError, NetworkError
    >>> try:
    ...     result = api.get_products()
    ... except NetworkError:
    ...     print("Sin conexion")
    ... except APIError as e:
    ...     print(f"Error: {e.message}")
"""

from .client import APIClient, get_api_client, reset_api_client
from .auth import AuthAPI, DeviceStatusData, LoginResult, UserData, TenantData
from .products import ProductsAPI
from .customers import CustomersAPI, CustomerData, get_customers_api
from .sales import SalesAPI
from .promotions import (
    PromotionsAPI,
    PromotionData,
    PromotionType,
    ApplyTo,
    AppliedPromotionData,
    CalculatedItemData,
    CalculationResult,
)
from .exceptions import (
    APIError,
    AuthenticationError,
    AuthorizationError,
    NetworkError,
    ValidationError,
    NotFoundError,
    TokenExpiredError,
    TokenRefreshError,
    ServerError,
)
from .terminals import (
    TerminalInfo,
    TerminalIdentification,
    TerminalNotActiveError,
    register_terminal,
    send_heartbeat,
    get_terminal_status,
    identify_terminal,
)
from .cash import (
    CashAPI,
    CashSession,
    CashSessionStatus,
    CashMovement,
    CashMovementType,
    CashMovementReason,
    CashCount,
    SessionSummary,
    GiftCardAPI,
    GiftCardInfo,
    get_cash_api,
    get_gift_card_api,
)

__all__ = [
    "APIClient",
    "get_api_client",
    "reset_api_client",
    "AuthAPI",
    "DeviceStatusData",
    "LoginResult",
    "UserData",
    "TenantData",
    "ProductsAPI",
    # Clientes
    "CustomersAPI",
    "CustomerData",
    "get_customers_api",
    # Ventas
    "SalesAPI",
    "PromotionsAPI",
    "PromotionData",
    "PromotionType",
    "ApplyTo",
    "AppliedPromotionData",
    "CalculatedItemData",
    "CalculationResult",
    "APIError",
    "AuthenticationError",
    "AuthorizationError",
    "NetworkError",
    "ValidationError",
    "NotFoundError",
    "TokenExpiredError",
    "TokenRefreshError",
    "ServerError",
    # Terminals
    "TerminalInfo",
    "TerminalIdentification",
    "TerminalNotActiveError",
    "register_terminal",
    "send_heartbeat",
    "get_terminal_status",
    "identify_terminal",
    # Caja
    "CashAPI",
    "CashSession",
    "CashSessionStatus",
    "CashMovement",
    "CashMovementType",
    "CashMovementReason",
    "CashCount",
    "SessionSummary",
    "GiftCardAPI",
    "GiftCardInfo",
    "get_cash_api",
    "get_gift_card_api",
]
