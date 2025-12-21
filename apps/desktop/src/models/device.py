"""
Modelo de dispositivo.

Almacena localmente la informacion del dispositivo y su estado
de habilitacion para uso del POS.
"""

from datetime import datetime
from typing import Optional
from enum import Enum

from sqlalchemy import String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class DeviceStatus(str, Enum):
    """
    Estados posibles de un dispositivo.

    Attributes:
        PENDING: Pendiente de aprobacion (primer uso)
        APPROVED: Aprobado para usar el POS
        BLOCKED: Bloqueado por administrador
        UNKNOWN: Estado desconocido (sin respuesta del servidor)
    """
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    UNKNOWN = "UNKNOWN"


class Device(BaseModel):
    """
    Modelo de dispositivo registrado.

    Almacena la informacion del PC y su estado de habilitacion.
    Solo se guarda un registro (el dispositivo actual).

    Attributes:
        id: ID autoincremental (primary key)
        device_id: Hash unico del dispositivo
        hostname: Nombre del equipo
        mac_address: Direccion MAC
        ip_address: Direccion IP local
        os_version: Version del sistema operativo
        cpu_info: Informacion del procesador
        machine_guid: GUID de Windows
        disk_serial: Serial del disco
        app_version: Version de la app cuando se registro
        username: Usuario de Windows
        status: Estado de habilitacion
        status_message: Mensaje adicional del servidor
        last_check: Ultima verificacion con el servidor
        registered_at: Fecha de primer registro
        approved_at: Fecha de aprobacion (si aplica)
        approved_by: ID del usuario que aprobo (si aplica)
        server_device_id: ID del dispositivo en el servidor (si fue registrado)
    """

    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Identificadores del dispositivo
    device_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    mac_address: Mapped[str] = mapped_column(String(32), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)

    # Informacion del sistema
    os_version: Mapped[str] = mapped_column(String(255), nullable=False)
    cpu_info: Mapped[str] = mapped_column(String(255), nullable=False)
    machine_guid: Mapped[str] = mapped_column(String(64), nullable=False)
    disk_serial: Mapped[str] = mapped_column(String(128), nullable=False)
    app_version: Mapped[str] = mapped_column(String(32), nullable=False)
    username: Mapped[str] = mapped_column(String(128), nullable=True, default="")

    # Estado y habilitacion
    status: Mapped[DeviceStatus] = mapped_column(
        SQLEnum(DeviceStatus),
        nullable=False,
        default=DeviceStatus.UNKNOWN,
    )
    status_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Fechas de control
    last_check: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    registered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Referencia al servidor
    server_device_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    def is_approved(self) -> bool:
        """
        Verifica si el dispositivo esta aprobado.

        Returns:
            True si el dispositivo puede usar el POS
        """
        return self.status == DeviceStatus.APPROVED

    def is_blocked(self) -> bool:
        """
        Verifica si el dispositivo esta bloqueado.

        Returns:
            True si el dispositivo fue bloqueado
        """
        return self.status == DeviceStatus.BLOCKED

    def is_pending(self) -> bool:
        """
        Verifica si el dispositivo esta pendiente de aprobacion.

        Returns:
            True si esta pendiente
        """
        return self.status == DeviceStatus.PENDING

    def update_status(
        self,
        status: DeviceStatus,
        message: Optional[str] = None,
        server_device_id: Optional[str] = None,
        approved_at: Optional[datetime] = None,
        approved_by: Optional[str] = None,
    ) -> None:
        """
        Actualiza el estado del dispositivo.

        Args:
            status: Nuevo estado
            message: Mensaje del servidor
            server_device_id: ID en el servidor
            approved_at: Fecha de aprobacion
            approved_by: Usuario que aprobo
        """
        self.status = status
        self.status_message = message
        self.last_check = datetime.now()

        if server_device_id:
            self.server_device_id = server_device_id

        if approved_at:
            self.approved_at = approved_at

        if approved_by:
            self.approved_by = approved_by

    @classmethod
    def from_device_info(cls, device_info: "DeviceInfo") -> "Device":
        """
        Crea un modelo Device desde DeviceInfo.

        Args:
            device_info: Informacion detectada del dispositivo

        Returns:
            Nueva instancia de Device
        """
        return cls(
            device_id=device_info.device_id,
            hostname=device_info.hostname,
            mac_address=device_info.mac_address,
            ip_address=device_info.ip_address,
            os_version=device_info.os_version,
            cpu_info=device_info.cpu_info,
            machine_guid=device_info.machine_guid,
            disk_serial=device_info.disk_serial,
            app_version=device_info.app_version,
            username=device_info.username,
            status=DeviceStatus.UNKNOWN,
            registered_at=datetime.now(),
        )

    def update_from_device_info(self, device_info: "DeviceInfo") -> None:
        """
        Actualiza la informacion del dispositivo.

        Util cuando cambia la IP u otra info no critica.

        Args:
            device_info: Nueva informacion del dispositivo
        """
        self.ip_address = device_info.ip_address
        self.os_version = device_info.os_version
        self.app_version = device_info.app_version
        self.username = device_info.username
