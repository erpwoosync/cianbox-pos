"""
Repositorio de dispositivos.

Maneja el almacenamiento local del dispositivo actual
y su estado de habilitacion.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session
from loguru import logger

from .base import BaseRepository
from src.models.device import Device, DeviceStatus
from src.utils.device import DeviceInfo, get_device_info


class DeviceRepository(BaseRepository[Device]):
    """
    Repositorio para gestionar el dispositivo local.

    Solo debe existir un registro de dispositivo en la base de datos
    (el dispositivo actual).
    """

    def __init__(self, session: Session):
        """
        Inicializa el repositorio.

        Args:
            session: Sesion de SQLAlchemy
        """
        super().__init__(session, Device)

    def get_current_device(self) -> Optional[Device]:
        """
        Obtiene el dispositivo actual registrado.

        Returns:
            Device o None si no hay registro
        """
        query = select(Device).limit(1)
        result = self.session.execute(query)
        return result.scalar_one_or_none()

    def get_by_device_id(self, device_id: str) -> Optional[Device]:
        """
        Obtiene un dispositivo por su device_id.

        Args:
            device_id: ID unico del dispositivo

        Returns:
            Device o None
        """
        query = select(Device).where(Device.device_id == device_id)
        result = self.session.execute(query)
        return result.scalar_one_or_none()

    def register_or_update_device(self, device_info: DeviceInfo) -> Device:
        """
        Registra o actualiza el dispositivo actual.

        Si el dispositivo ya existe, actualiza su informacion.
        Si no existe, lo crea.

        Args:
            device_info: Informacion del dispositivo

        Returns:
            Device creado o actualizado
        """
        existing = self.get_by_device_id(device_info.device_id)

        if existing:
            # Actualizar informacion que puede cambiar
            existing.update_from_device_info(device_info)
            self.session.flush()
            logger.debug(f"Dispositivo actualizado: {existing.hostname}")
            return existing
        else:
            # Crear nuevo registro
            device = Device.from_device_info(device_info)
            self.session.add(device)
            self.session.flush()
            logger.info(f"Dispositivo registrado: {device.hostname} ({device.device_id[:8]}...)")
            return device

    def update_device_status(
        self,
        device_id: str,
        status: DeviceStatus,
        message: Optional[str] = None,
        server_device_id: Optional[str] = None,
        approved_at: Optional[datetime] = None,
        approved_by: Optional[str] = None,
    ) -> Optional[Device]:
        """
        Actualiza el estado del dispositivo.

        Args:
            device_id: ID del dispositivo
            status: Nuevo estado
            message: Mensaje del servidor
            server_device_id: ID en el servidor
            approved_at: Fecha de aprobacion
            approved_by: Usuario que aprobo

        Returns:
            Device actualizado o None
        """
        device = self.get_by_device_id(device_id)
        if not device:
            logger.warning(f"Dispositivo no encontrado: {device_id[:8]}...")
            return None

        device.update_status(
            status=status,
            message=message,
            server_device_id=server_device_id,
            approved_at=approved_at,
            approved_by=approved_by,
        )

        self.session.flush()
        logger.info(f"Estado de dispositivo actualizado: {status.value}")
        return device

    def is_device_approved(self, device_id: str) -> bool:
        """
        Verifica si el dispositivo esta aprobado.

        Args:
            device_id: ID del dispositivo

        Returns:
            True si esta aprobado
        """
        device = self.get_by_device_id(device_id)
        return device.is_approved() if device else False

    def is_device_blocked(self, device_id: str) -> bool:
        """
        Verifica si el dispositivo esta bloqueado.

        Args:
            device_id: ID del dispositivo

        Returns:
            True si esta bloqueado
        """
        device = self.get_by_device_id(device_id)
        return device.is_blocked() if device else False

    def ensure_device_registered(self) -> Device:
        """
        Asegura que el dispositivo actual este registrado.

        Si no existe, lo registra automaticamente.

        Returns:
            Device actual
        """
        device_info = get_device_info()
        return self.register_or_update_device(device_info)
