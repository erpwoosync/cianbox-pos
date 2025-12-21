"""
Excepciones personalizadas para el cliente API.

Define una jerarquia de excepciones para manejar diferentes
tipos de errores de la API.
"""

from typing import Optional, Any


class APIError(Exception):
    """
    Error base de la API.

    Attributes:
        message: Mensaje de error
        status_code: Codigo HTTP (si aplica)
        details: Detalles adicionales del error
    """

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        details: Optional[Any] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)

    def __str__(self) -> str:
        if self.status_code:
            return f"[{self.status_code}] {self.message}"
        return self.message


class AuthenticationError(APIError):
    """
    Error de autenticacion.

    Se lanza cuando las credenciales son invalidas o el token expiro.
    """

    def __init__(
        self,
        message: str = "Credenciales invalidas",
        details: Optional[Any] = None,
    ):
        super().__init__(message, status_code=401, details=details)


class AuthorizationError(APIError):
    """
    Error de autorizacion.

    Se lanza cuando el usuario no tiene permisos para la operacion.
    """

    def __init__(
        self,
        message: str = "No tiene permisos para esta operacion",
        details: Optional[Any] = None,
    ):
        super().__init__(message, status_code=403, details=details)


class NotFoundError(APIError):
    """
    Error de recurso no encontrado.
    """

    def __init__(
        self,
        resource: str = "Recurso",
        details: Optional[Any] = None,
    ):
        super().__init__(f"{resource} no encontrado", status_code=404, details=details)


class ValidationError(APIError):
    """
    Error de validacion de datos.

    Se lanza cuando los datos enviados son invalidos.
    """

    def __init__(
        self,
        message: str = "Datos invalidos",
        details: Optional[Any] = None,
    ):
        super().__init__(message, status_code=400, details=details)


class NetworkError(APIError):
    """
    Error de red.

    Se lanza cuando hay problemas de conexion.
    """

    def __init__(
        self,
        message: str = "Error de conexion",
        original_error: Optional[Exception] = None,
    ):
        super().__init__(message, details=str(original_error) if original_error else None)
        self.original_error = original_error


class ServerError(APIError):
    """
    Error del servidor.

    Se lanza cuando el servidor responde con error 5xx.
    """

    def __init__(
        self,
        message: str = "Error del servidor",
        status_code: int = 500,
        details: Optional[Any] = None,
    ):
        super().__init__(message, status_code=status_code, details=details)


class TokenExpiredError(AuthenticationError):
    """
    Error de token expirado.

    Indica que el token JWT expiro y necesita renovarse.
    """

    def __init__(self):
        super().__init__("Sesion expirada. Por favor inicie sesion nuevamente.")


class TokenRefreshError(AuthenticationError):
    """
    Error al renovar el token.

    Indica que fallo la renovacion del token.
    """

    def __init__(self):
        super().__init__("No se pudo renovar la sesion. Por favor inicie sesion nuevamente.")
