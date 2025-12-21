"""
Modulo de cliente API.

Proporciona comunicacion HTTP con el backend de Cianbox POS.
"""

from .client import APIClient, get_api_client, reset_api_client
from .auth import AuthAPI, DeviceStatusData, LoginResult, UserData, TenantData
from .products import ProductsAPI
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
    TerminalNotActiveError,
    register_terminal,
    send_heartbeat,
    get_terminal_status,
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
    "TerminalNotActiveError",
    "register_terminal",
    "send_heartbeat",
    "get_terminal_status",
]
