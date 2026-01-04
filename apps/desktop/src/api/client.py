"""
Cliente HTTP base para comunicacion con la API.

Proporciona:
- Manejo de autenticacion JWT
- Renovacion automatica de tokens
- Reintentos con backoff exponencial
- Manejo de errores tipado
"""

import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, TypeVar

import httpx
from loguru import logger

from src.config import get_settings
from src.config.constants import API_RETRY_DELAY, API_MAX_RETRIES, TOKEN_REFRESH_BEFORE_EXPIRY
from .exceptions import (
    APIError,
    AuthenticationError,
    AuthorizationError,
    NetworkError,
    ValidationError,
    NotFoundError,
    ServerError,
    TokenExpiredError,
    TokenRefreshError,
)


T = TypeVar("T")


class APIResponse:
    """
    Respuesta de la API.

    Attributes:
        success: Si la operacion fue exitosa
        data: Datos de la respuesta (campo 'data' del JSON)
        error: Mensaje de error
        pagination: Datos de paginacion
        status_code: Codigo HTTP
        raw_data: Respuesta JSON completa (para endpoints que no usan 'data')
    """

    def __init__(
        self,
        success: bool = False,
        data: Any = None,
        error: Optional[str] = None,
        pagination: Optional[Dict] = None,
        status_code: int = 200,
        raw_data: Any = None,
    ):
        self.success = success
        self.data = data
        self.error = error
        self.pagination = pagination
        self.status_code = status_code
        self.raw_data = raw_data

    @property
    def is_error(self) -> bool:
        """Verifica si hay error."""
        return not self.success or self.error is not None

    def __repr__(self) -> str:
        return f"APIResponse(success={self.success}, status_code={self.status_code})"


class APIClient:
    """
    Cliente HTTP para comunicacion con la API de Cianbox POS.

    Maneja autenticacion JWT, renovacion de tokens y reintentos.

    Attributes:
        base_url: URL base de la API
        timeout: Timeout de requests
        access_token: Token de acceso actual
        refresh_token: Token de refresco
    """

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[int] = None):
        """
        Inicializa el cliente API.

        Args:
            base_url: URL base (default: desde settings)
            timeout: Timeout en segundos (default: desde settings)
        """
        settings = get_settings()
        self.base_url = base_url or settings.API_URL
        self.timeout = timeout or settings.API_TIMEOUT

        # Autenticacion
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None

        # Datos de sesion
        self.user_id: Optional[str] = None
        self.tenant_id: Optional[str] = None
        self.session_id: Optional[str] = None

        # Cliente HTTP (se crea bajo demanda)
        self._client: Optional[httpx.Client] = None

        logger.debug(f"APIClient inicializado: {self.base_url}")

    def _get_client(self) -> httpx.Client:
        """
        Obtiene o crea el cliente HTTP.

        Returns:
            Cliente httpx configurado
        """
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            )
        return self._client

    def _get_headers(self) -> Dict[str, str]:
        """
        Construye headers de la request.

        Returns:
            Dict de headers HTTP
        """
        settings = get_settings()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"CianboxPOS-Desktop/{settings.APP_VERSION}",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _should_refresh_token(self) -> bool:
        """
        Verifica si el token necesita renovarse.

        Returns:
            True si el token esta proximo a expirar
        """
        if not self.token_expires_at or not self.refresh_token:
            return False

        # Renovar antes de que expire
        threshold = datetime.now() + timedelta(seconds=TOKEN_REFRESH_BEFORE_EXPIRY)
        return threshold >= self.token_expires_at

    def _refresh_access_token(self) -> bool:
        """
        Renueva el access token.

        Returns:
            True si la renovacion fue exitosa

        Raises:
            TokenRefreshError: Si falla la renovacion
        """
        if not self.refresh_token:
            logger.warning("No hay refresh token disponible")
            return False

        try:
            logger.debug("Renovando access token...")
            client = self._get_client()

            response = client.post(
                "/api/auth/refresh",
                json={"refreshToken": self.refresh_token},
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data", {}).get("token"):
                    self.access_token = data["data"]["token"]
                    # Asumir 24 horas de validez
                    self.token_expires_at = datetime.now() + timedelta(hours=24)
                    logger.info("Token renovado exitosamente")
                    return True

            logger.warning(f"Fallo renovacion de token: {response.status_code}")
            return False

        except Exception as e:
            logger.error(f"Error al renovar token: {e}")
            return False

    def _handle_error_response(self, response: httpx.Response, data: Dict) -> None:
        """
        Maneja respuestas de error de la API.

        Args:
            response: Respuesta HTTP
            data: Datos parseados

        Raises:
            APIError: Segun el tipo de error
        """
        status = response.status_code
        error_msg = data.get("error", "Error desconocido")
        details = data.get("details")

        if status == 401:
            raise AuthenticationError(error_msg, details)
        elif status == 403:
            raise AuthorizationError(error_msg, details)
        elif status == 404:
            raise NotFoundError(error_msg, details)
        elif status == 400:
            raise ValidationError(error_msg, details)
        elif status >= 500:
            raise ServerError(error_msg, status, details)
        else:
            raise APIError(error_msg, status, details)

    def request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        retry_count: int = API_MAX_RETRIES,
        skip_auth_refresh: bool = False,
    ) -> APIResponse:
        """
        Realiza una peticion HTTP a la API.

        Args:
            method: Metodo HTTP (GET, POST, PUT, DELETE)
            endpoint: Ruta del endpoint
            data: Body de la request (para POST/PUT)
            params: Query parameters
            retry_count: Numero de reintentos
            skip_auth_refresh: Saltar renovacion de token

        Returns:
            APIResponse con el resultado

        Raises:
            APIError: Si hay error despues de los reintentos
            NetworkError: Si hay problemas de conexion
        """
        # Renovar token si es necesario
        if not skip_auth_refresh and self._should_refresh_token():
            if not self._refresh_access_token():
                raise TokenExpiredError()

        client = self._get_client()
        last_error: Optional[Exception] = None

        for attempt in range(retry_count):
            try:
                logger.debug(f"Request {method} {endpoint} (intento {attempt + 1})")

                response = client.request(
                    method=method,
                    url=endpoint,
                    json=data,
                    params=params,
                    headers=self._get_headers(),
                )

                # Parsear respuesta
                try:
                    result = response.json()
                except Exception:
                    result = {}

                # Token expirado
                if response.status_code == 401 and not skip_auth_refresh:
                    logger.warning("Token expirado, intentando renovar...")
                    if self._refresh_access_token():
                        continue  # Reintentar con nuevo token
                    raise TokenExpiredError()

                # Error del servidor - reintentar
                if response.status_code >= 500:
                    last_error = ServerError(
                        result.get("error", "Error del servidor"),
                        response.status_code,
                    )
                    logger.warning(f"Error de servidor: {last_error}")
                    if attempt < retry_count - 1:
                        time.sleep(API_RETRY_DELAY * (attempt + 1))
                    continue

                # Error de cliente - no reintentar
                if response.status_code >= 400:
                    self._handle_error_response(response, result)

                # Exito
                return APIResponse(
                    success=result.get("success", True),
                    data=result.get("data"),
                    error=result.get("error"),
                    pagination=result.get("pagination"),
                    status_code=response.status_code,
                    raw_data=result,  # Respuesta completa para endpoints que no usan 'data'
                )

            except (httpx.TimeoutException, httpx.NetworkError) as e:
                last_error = NetworkError("Error de conexion", e)
                logger.warning(f"Error de red (intento {attempt + 1}): {e}")
                if attempt < retry_count - 1:
                    time.sleep(API_RETRY_DELAY * (attempt + 1))

            except APIError:
                raise

            except Exception as e:
                logger.error(f"Error inesperado: {e}")
                raise APIError(str(e))

        # Si llegamos aqui, fallaron todos los reintentos
        if last_error:
            raise last_error
        raise APIError("Error desconocido despues de reintentos")

    def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
    ) -> APIResponse:
        """Realiza una peticion GET."""
        return self.request("GET", endpoint, params=params)

    def post(
        self,
        endpoint: str,
        data: Optional[Dict] = None,
    ) -> APIResponse:
        """Realiza una peticion POST."""
        return self.request("POST", endpoint, data=data)

    def put(
        self,
        endpoint: str,
        data: Optional[Dict] = None,
    ) -> APIResponse:
        """Realiza una peticion PUT."""
        return self.request("PUT", endpoint, data=data)

    def delete(
        self,
        endpoint: str,
    ) -> APIResponse:
        """Realiza una peticion DELETE."""
        return self.request("DELETE", endpoint)

    def set_auth_data(
        self,
        access_token: str,
        refresh_token: str,
        user_id: str,
        tenant_id: str,
        session_id: Optional[str] = None,
        expires_in_hours: int = 24,
    ) -> None:
        """
        Establece los datos de autenticacion.

        Args:
            access_token: Token de acceso
            refresh_token: Token de refresco
            user_id: ID del usuario
            tenant_id: ID del tenant
            session_id: ID de la sesion
            expires_in_hours: Horas hasta expiracion
        """
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.session_id = session_id
        self.token_expires_at = datetime.now() + timedelta(hours=expires_in_hours)

        logger.info(f"Auth configurada para user={user_id}, tenant={tenant_id}")

    def clear_auth_data(self) -> None:
        """Limpia los datos de autenticacion."""
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = None
        self.user_id = None
        self.tenant_id = None
        self.session_id = None

        logger.info("Auth limpiada")

    @property
    def is_authenticated(self) -> bool:
        """Verifica si hay una sesion activa."""
        return self.access_token is not None

    @property
    def is_token_valid(self) -> bool:
        """Verifica si el token es valido."""
        if not self.access_token or not self.token_expires_at:
            return False
        return datetime.now() < self.token_expires_at

    def close(self) -> None:
        """Cierra el cliente HTTP."""
        if self._client:
            self._client.close()
            self._client = None
            logger.debug("Cliente HTTP cerrado")


# Instancia global (singleton)
_api_client: Optional[APIClient] = None


def get_api_client() -> APIClient:
    """
    Obtiene la instancia global del cliente API.

    Returns:
        APIClient singleton
    """
    global _api_client
    if _api_client is None:
        _api_client = APIClient()
    return _api_client


def reset_api_client() -> None:
    """
    Reinicia el cliente API.

    Util para testing o cuando cambia la configuracion.
    """
    global _api_client
    _api_client = None
