"""
API de autenticacion.

Maneja login, logout y renovacion de tokens.
Incluye envio de informacion del dispositivo para control de acceso.
"""

from typing import Optional
from dataclasses import dataclass
from datetime import datetime

from loguru import logger

from .client import APIClient, get_api_client, APIResponse
from .exceptions import AuthenticationError
from src.utils.device import get_device_info, DeviceInfo


@dataclass
class UserData:
    """Datos del usuario autenticado."""

    id: str
    email: str
    name: str
    avatar: Optional[str] = None
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    permissions: list = None
    branch_id: Optional[str] = None
    branch_code: Optional[str] = None
    branch_name: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "UserData":
        """Crea UserData desde diccionario de la API."""
        role = data.get("role", {})
        branch = data.get("branch") or {}

        return cls(
            id=data.get("id", ""),
            email=data.get("email", ""),
            name=data.get("name", ""),
            avatar=data.get("avatar"),
            role_id=role.get("id"),
            role_name=role.get("name"),
            permissions=role.get("permissions", []),
            branch_id=branch.get("id"),
            branch_code=branch.get("code"),
            branch_name=branch.get("name"),
        )


@dataclass
class TenantData:
    """Datos del tenant."""

    id: str
    name: str
    slug: str
    logo: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "TenantData":
        """Crea TenantData desde diccionario de la API."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            slug=data.get("slug", ""),
            logo=data.get("logo"),
        )


@dataclass
class DeviceStatusData:
    """Estado del dispositivo segun el servidor."""

    status: str  # PENDING, APPROVED, BLOCKED
    message: Optional[str] = None
    server_device_id: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "DeviceStatusData":
        """Crea DeviceStatusData desde diccionario de la API."""
        if not data:
            return cls(status="UNKNOWN")

        return cls(
            status=data.get("status", "UNKNOWN"),
            message=data.get("message"),
            server_device_id=data.get("id"),
            approved_at=data.get("approvedAt"),
            approved_by=data.get("approvedBy"),
        )


@dataclass
class LoginResult:
    """Resultado de login."""

    success: bool
    user: Optional[UserData] = None
    tenant: Optional[TenantData] = None
    token: Optional[str] = None
    refresh_token: Optional[str] = None
    session_id: Optional[str] = None
    error: Optional[str] = None
    device_status: Optional[DeviceStatusData] = None
    device_blocked: bool = False
    device_pending: bool = False


class AuthAPI:
    """
    API de autenticacion.

    Maneja todas las operaciones de autenticacion con el backend.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de autenticacion.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def _get_device_payload(self) -> dict:
        """
        Obtiene la informacion del dispositivo para enviar al servidor.

        Returns:
            Diccionario con datos del dispositivo
        """
        device_info = get_device_info()
        return {
            "deviceId": device_info.device_id,
            "hostname": device_info.hostname,
            "macAddress": device_info.mac_address,
            "ipAddress": device_info.ip_address,
            "osVersion": device_info.os_version,
            "cpuInfo": device_info.cpu_info,
            "machineGuid": device_info.machine_guid,
            "diskSerial": device_info.disk_serial,
            "appVersion": device_info.app_version,
            "username": device_info.username,
        }

    def login(
        self,
        email: str,
        password: str,
        tenant_slug: str,
    ) -> LoginResult:
        """
        Realiza login con email y password.

        Incluye informacion del dispositivo para control de acceso.
        El servidor puede responder con estado del dispositivo (APPROVED, PENDING, BLOCKED).

        Args:
            email: Email del usuario
            password: Contrasena
            tenant_slug: Slug del tenant

        Returns:
            LoginResult con datos del usuario y estado del dispositivo
        """
        logger.info(f"Intentando login: {email} en {tenant_slug}")

        try:
            # Preparar datos con informacion del dispositivo
            login_data = {
                "email": email,
                "password": password,
                "tenantSlug": tenant_slug,
                "device": self._get_device_payload(),
            }

            response = self.client.request(
                method="POST",
                endpoint="/api/auth/login",
                data=login_data,
                skip_auth_refresh=True,
            )

            if response.success and response.data:
                data = response.data

                # Extraer datos
                user = UserData.from_dict(data.get("user", {}))
                tenant = TenantData.from_dict(data.get("tenant", {}))
                token = data.get("token")
                refresh_token = data.get("refreshToken")
                session_id = data.get("sessionId")

                # Extraer estado del dispositivo
                device_data = data.get("device", {})
                device_status = DeviceStatusData.from_dict(device_data)
                device_blocked = device_status.status == "BLOCKED"
                device_pending = device_status.status == "PENDING"

                # Si el dispositivo esta bloqueado, no configurar auth
                if device_blocked:
                    logger.warning(f"Dispositivo bloqueado: {device_status.message}")
                    return LoginResult(
                        success=False,
                        error=device_status.message or "Dispositivo bloqueado",
                        device_status=device_status,
                        device_blocked=True,
                    )

                # Configurar cliente con auth
                self.client.set_auth_data(
                    access_token=token,
                    refresh_token=refresh_token,
                    user_id=user.id,
                    tenant_id=tenant.id,
                    session_id=session_id,
                )

                logger.info(f"Login exitoso: {user.name}")
                if device_pending:
                    logger.info(f"Dispositivo pendiente de aprobacion")

                return LoginResult(
                    success=True,
                    user=user,
                    tenant=tenant,
                    token=token,
                    refresh_token=refresh_token,
                    session_id=session_id,
                    device_status=device_status,
                    device_pending=device_pending,
                )

            # Verificar si el error es por dispositivo bloqueado
            if response.error and "bloqueado" in response.error.lower():
                return LoginResult(
                    success=False,
                    error=response.error,
                    device_blocked=True,
                )

            return LoginResult(
                success=False,
                error=response.error or "Error de autenticacion",
            )

        except AuthenticationError as e:
            logger.warning(f"Login fallido: {e.message}")
            return LoginResult(success=False, error=e.message)

        except Exception as e:
            logger.error(f"Error en login: {e}")
            return LoginResult(success=False, error=str(e))

    def login_with_pin(
        self,
        pin: str,
        tenant_slug: str,
    ) -> LoginResult:
        """
        Realiza login rapido con PIN.

        Incluye informacion del dispositivo para control de acceso.

        Args:
            pin: PIN de 4 digitos
            tenant_slug: Slug del tenant

        Returns:
            LoginResult con datos del usuario y estado del dispositivo
        """
        logger.info(f"Intentando login con PIN en {tenant_slug}")

        try:
            # Preparar datos con informacion del dispositivo
            login_data = {
                "pin": pin,
                "tenantSlug": tenant_slug,
                "device": self._get_device_payload(),
            }

            response = self.client.request(
                method="POST",
                endpoint="/api/auth/login/pin",
                data=login_data,
                skip_auth_refresh=True,
            )

            if response.success and response.data:
                data = response.data

                user = UserData.from_dict(data.get("user", {}))
                tenant = TenantData.from_dict(data.get("tenant", {}))
                token = data.get("token")
                refresh_token = data.get("refreshToken")
                session_id = data.get("sessionId")

                # Extraer estado del dispositivo
                device_data = data.get("device", {})
                device_status = DeviceStatusData.from_dict(device_data)
                device_blocked = device_status.status == "BLOCKED"
                device_pending = device_status.status == "PENDING"

                # Si el dispositivo esta bloqueado, no configurar auth
                if device_blocked:
                    logger.warning(f"Dispositivo bloqueado: {device_status.message}")
                    return LoginResult(
                        success=False,
                        error=device_status.message or "Dispositivo bloqueado",
                        device_status=device_status,
                        device_blocked=True,
                    )

                self.client.set_auth_data(
                    access_token=token,
                    refresh_token=refresh_token,
                    user_id=user.id,
                    tenant_id=tenant.id,
                    session_id=session_id,
                )

                logger.info(f"Login con PIN exitoso: {user.name}")
                if device_pending:
                    logger.info(f"Dispositivo pendiente de aprobacion")

                return LoginResult(
                    success=True,
                    user=user,
                    tenant=tenant,
                    token=token,
                    refresh_token=refresh_token,
                    session_id=session_id,
                    device_status=device_status,
                    device_pending=device_pending,
                )

            # Verificar si el error es por dispositivo bloqueado
            if response.error and "bloqueado" in response.error.lower():
                return LoginResult(
                    success=False,
                    error=response.error,
                    device_blocked=True,
                )

            return LoginResult(
                success=False,
                error=response.error or "PIN invalido",
            )

        except AuthenticationError as e:
            logger.warning(f"Login con PIN fallido: {e.message}")
            return LoginResult(success=False, error=e.message)

        except Exception as e:
            logger.error(f"Error en login con PIN: {e}")
            return LoginResult(success=False, error=str(e))

    def logout(self) -> bool:
        """
        Cierra la sesion actual.

        Returns:
            True si el logout fue exitoso
        """
        try:
            if not self.client.is_authenticated:
                return True

            self.client.request(
                method="POST",
                endpoint="/api/auth/logout",
                data={"sessionId": self.client.session_id} if self.client.session_id else None,
            )

            logger.info("Logout exitoso")

        except Exception as e:
            logger.warning(f"Error en logout (ignorado): {e}")

        finally:
            self.client.clear_auth_data()

        return True

    def get_current_user(self) -> Optional[UserData]:
        """
        Obtiene los datos del usuario actual.

        Returns:
            UserData o None si no esta autenticado
        """
        if not self.client.is_authenticated:
            return None

        try:
            response = self.client.get("/api/auth/me")

            if response.success and response.data:
                return UserData.from_dict(response.data)

        except Exception as e:
            logger.error(f"Error al obtener usuario actual: {e}")

        return None

    def verify_supervisor(
        self,
        pin: str,
        required_permission: str,
    ) -> Optional[dict]:
        """
        Verifica el PIN de un supervisor.

        Args:
            pin: PIN del supervisor
            required_permission: Permiso requerido

        Returns:
            Datos del supervisor si es valido, None si no
        """
        try:
            response = self.client.post(
                "/api/auth/verify-supervisor",
                data={
                    "pin": pin,
                    "requiredPermission": required_permission,
                },
            )

            if response.success and response.data:
                return response.data.get("supervisor")

        except Exception as e:
            logger.warning(f"Error verificando supervisor: {e}")

        return None

    def refresh_token(self) -> bool:
        """
        Renueva el access token.

        Returns:
            True si la renovacion fue exitosa
        """
        return self.client._refresh_access_token()
