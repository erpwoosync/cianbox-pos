"""
API para registro y gestion de terminales POS.

Maneja:
- Registro de terminal al iniciar
- Heartbeat periodico
- Consulta de estado
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any

from loguru import logger

from .client import get_api_client, APIResponse
from .exceptions import APIError
import httpx


@dataclass
class TerminalIdentification:
    """
    Resultado de identificar una terminal.

    Attributes:
        registered: Si la terminal está registrada
        is_active: Si está activa para operar
        tenant_slug: Slug del tenant (empresa)
        tenant_name: Nombre del tenant
        terminal_name: Nombre de la terminal
        branch_name: Nombre de la sucursal
        message: Mensaje de estado (si hay error)
    """
    registered: bool
    is_active: bool = False
    tenant_slug: Optional[str] = None
    tenant_name: Optional[str] = None
    terminal_name: Optional[str] = None
    branch_name: Optional[str] = None
    message: Optional[str] = None


@dataclass
class TerminalInfo:
    """
    Informacion de la terminal registrada en el backend.

    Attributes:
        id: ID de la terminal en el backend
        device_id: ID unico del dispositivo
        hostname: Nombre del equipo
        mac_address: Direccion MAC
        name: Nombre amigable asignado por admin
        status: Estado (PENDING, ACTIVE, DISABLED, BLOCKED)
        point_of_sale: Info del punto de venta vinculado
        is_new: Si es una terminal recien registrada
    """
    id: str
    device_id: str
    hostname: str
    mac_address: str
    name: Optional[str]
    status: str
    point_of_sale: Optional[Dict[str, Any]]
    is_new: bool = False

    @property
    def is_active(self) -> bool:
        """Verifica si la terminal esta activa."""
        return self.status == "ACTIVE"

    @property
    def is_pending(self) -> bool:
        """Verifica si la terminal esta pendiente de activacion."""
        return self.status == "PENDING"

    @property
    def branch_id(self) -> Optional[str]:
        """Obtiene el ID de sucursal del punto de venta."""
        if self.point_of_sale and self.point_of_sale.get("branch"):
            return self.point_of_sale["branch"].get("id")
        return None

    @property
    def branch_name(self) -> Optional[str]:
        """Obtiene el nombre de sucursal."""
        if self.point_of_sale and self.point_of_sale.get("branch"):
            return self.point_of_sale["branch"].get("name")
        return None

    @property
    def price_list_id(self) -> Optional[str]:
        """Obtiene el ID de lista de precios."""
        if self.point_of_sale and self.point_of_sale.get("priceList"):
            return self.point_of_sale["priceList"].get("id")
        return None

    @property
    def price_list_name(self) -> Optional[str]:
        """Obtiene el nombre de lista de precios."""
        if self.point_of_sale and self.point_of_sale.get("priceList"):
            return self.point_of_sale["priceList"].get("name")
        return None

    @property
    def pos_id(self) -> Optional[str]:
        """Obtiene el ID del punto de venta."""
        if self.point_of_sale:
            return self.point_of_sale.get("id")
        return None

    @property
    def pos_code(self) -> Optional[str]:
        """Obtiene el codigo del punto de venta."""
        if self.point_of_sale:
            return self.point_of_sale.get("code")
        return None

    @property
    def pos_name(self) -> Optional[str]:
        """Obtiene el nombre del punto de venta."""
        if self.point_of_sale:
            return self.point_of_sale.get("name")
        return None


class TerminalNotActiveError(APIError):
    """Error cuando la terminal no esta activa."""

    def __init__(self, status: str, message: str = "Terminal no activa"):
        super().__init__(message, status_code=403)
        self.terminal_status = status


def register_terminal(
    hostname: str,
    mac_address: str,
    os_version: str,
    app_version: str,
    ip_address: str,
) -> TerminalInfo:
    """
    Registra o actualiza la terminal en el backend.

    Esta funcion se llama despues del login exitoso para
    identificar la terminal desde donde se opera.

    Args:
        hostname: Nombre del equipo
        mac_address: Direccion MAC de la placa de red
        os_version: Version del sistema operativo
        app_version: Version de la aplicacion POS
        ip_address: Direccion IP local

    Returns:
        TerminalInfo con los datos de la terminal

    Raises:
        TerminalNotActiveError: Si la terminal no esta activa
        APIError: Si hay error de comunicacion
    """
    logger.info(f"Registrando terminal: {hostname} ({mac_address})")

    client = get_api_client()

    try:
        response = client.post(
            "/api/pos/terminals/register",
            data={
                "hostname": hostname,
                "macAddress": mac_address,
                "osVersion": os_version,
                "appVersion": app_version,
                "ipAddress": ip_address,
            },
        )

        if not response.success:
            # Verificar si es error de terminal no activa
            error_data = response.data or {}
            if error_data.get("code") == "TERMINAL_NOT_ACTIVE":
                status = error_data.get("status", "PENDING")
                raise TerminalNotActiveError(
                    status=status,
                    message=error_data.get("message", "Terminal pendiente de activacion"),
                )
            raise APIError(response.error or "Error al registrar terminal")

        data = response.data
        is_new = response.data is not None and data.get("isNewTerminal", False)

        terminal = TerminalInfo(
            id=data["id"],
            device_id=data["deviceId"],
            hostname=data["hostname"],
            mac_address=data["macAddress"],
            name=data.get("name"),
            status=data["status"],
            point_of_sale=data.get("pointOfSale"),
            is_new=is_new,
        )

        if terminal.is_active:
            logger.info(
                f"Terminal activa: {terminal.name or terminal.hostname} "
                f"- Sucursal: {terminal.branch_name}"
            )
        elif terminal.is_pending:
            logger.warning(
                f"Terminal pendiente de activacion: {terminal.hostname}"
            )
        else:
            logger.warning(f"Terminal con estado: {terminal.status}")

        return terminal

    except TerminalNotActiveError:
        raise
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error registrando terminal: {e}")
        raise APIError(f"Error al registrar terminal: {e}")


def send_heartbeat(device_id: str) -> bool:
    """
    Envia heartbeat para indicar que la terminal esta activa.

    Deberia llamarse periodicamente (cada 5 minutos).

    Args:
        device_id: ID unico del dispositivo

    Returns:
        True si el heartbeat fue exitoso
    """
    try:
        client = get_api_client()
        response = client.post(
            "/api/pos/terminals/heartbeat",
            data={"deviceId": device_id},
        )
        return response.success

    except Exception as e:
        logger.warning(f"Error enviando heartbeat: {e}")
        return False


def get_terminal_status(device_id: str) -> Optional[str]:
    """
    Consulta el estado actual de la terminal.

    Args:
        device_id: ID unico del dispositivo

    Returns:
        Estado de la terminal o None si hay error
    """
    try:
        client = get_api_client()
        response = client.get(f"/api/pos/terminals/{device_id}/status")

        if response.success and response.data:
            return response.data.get("status")
        return None

    except Exception as e:
        logger.warning(f"Error consultando estado de terminal: {e}")
        return None


def identify_terminal(mac_address: str, api_url: str) -> TerminalIdentification:
    """
    Identifica una terminal por MAC address ANTES del login.

    Este endpoint es público y no requiere autenticación.
    Se usa para determinar a qué tenant pertenece la terminal.

    Args:
        mac_address: Dirección MAC del dispositivo
        api_url: URL base de la API

    Returns:
        TerminalIdentification con los datos del tenant
    """
    logger.info(f"Identificando terminal: {mac_address}")

    try:
        # Usamos httpx directamente porque no tenemos auth todavía
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                f"{api_url}/api/pos/terminals/identify",
                json={"macAddress": mac_address},
            )

            if response.status_code != 200:
                logger.warning(f"Error identificando terminal: HTTP {response.status_code}")
                return TerminalIdentification(
                    registered=False,
                    message="Error de conexión con el servidor",
                )

            data = response.json()

            if not data.get("success"):
                return TerminalIdentification(
                    registered=False,
                    message=data.get("error", {}).get("message", "Error desconocido"),
                )

            result = data.get("data", {})

            if not result.get("registered"):
                return TerminalIdentification(
                    registered=False,
                    message=result.get("message", "Terminal no registrada"),
                )

            # Terminal registrada
            tenant = result.get("tenant", {})
            terminal = result.get("terminal", {})
            branch = result.get("branch", {})

            identification = TerminalIdentification(
                registered=True,
                is_active=result.get("isActive", False),
                tenant_slug=tenant.get("slug"),
                tenant_name=tenant.get("name"),
                terminal_name=terminal.get("name"),
                branch_name=branch.get("name") if branch else None,
                message=result.get("message"),
            )

            if identification.is_active:
                logger.info(
                    f"Terminal identificada: {identification.terminal_name} "
                    f"@ {identification.tenant_name}"
                )
            else:
                logger.warning(
                    f"Terminal no activa: {identification.terminal_name} "
                    f"- {identification.message}"
                )

            return identification

    except httpx.ConnectError:
        logger.error("No se pudo conectar al servidor")
        return TerminalIdentification(
            registered=False,
            message="No se pudo conectar al servidor. Verifique la conexión.",
        )
    except Exception as e:
        logger.error(f"Error identificando terminal: {e}")
        return TerminalIdentification(
            registered=False,
            message=f"Error: {e}",
        )
