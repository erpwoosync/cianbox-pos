"""
Modelos para sincronizacion y configuracion local.

Maneja la cola de operaciones offline y configuracion de la app.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class OfflineQueue(BaseModel):
    """
    Cola de operaciones pendientes para sincronizar.

    Cuando no hay conexion, las operaciones (ventas, pagos, etc)
    se guardan aqui para sincronizar cuando vuelva la conexion.
    """

    __tablename__ = "offline_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Tipo de operacion
    operation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # sale, payment, cash_movement, etc.

    # Datos de la request
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)  # POST, PUT, DELETE
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Control de reintentos
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=5)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Estado
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
    )  # pending, processing, completed, failed

    # Referencia local (para poder vincular luego)
    local_reference: Mapped[Optional[str]] = mapped_column(String(100))

    # Resultado
    response_data: Mapped[Optional[dict]] = mapped_column(JSON)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    def can_retry(self) -> bool:
        """Verifica si se puede reintentar la operacion."""
        return (
            self.status in ("pending", "failed")
            and self.retry_count < self.max_retries
        )

    def mark_processing(self) -> None:
        """Marca la operacion como en proceso."""
        self.status = "processing"
        self.last_attempt_at = datetime.now()

    def mark_completed(self, response_data: dict = None) -> None:
        """Marca la operacion como completada."""
        self.status = "completed"
        self.processed_at = datetime.now()
        self.response_data = response_data

    def mark_failed(self, error: str) -> None:
        """Marca la operacion como fallida."""
        self.status = "failed"
        self.retry_count += 1
        self.last_error = error
        self.last_attempt_at = datetime.now()


class AppConfig(BaseModel):
    """
    Configuracion local de la aplicacion.

    Almacena configuracion persistente como:
    - Ultimo tenant usado
    - Ultimo usuario
    - Preferencias de UI
    - Configuracion de impresora
    """

    __tablename__ = "app_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text)
    value_type: Mapped[str] = mapped_column(
        String(20),
        default="string",
    )  # string, int, bool, json

    # Categoria para agrupar
    category: Mapped[str] = mapped_column(String(50), default="general")

    def get_typed_value(self):
        """Obtiene el valor con el tipo correcto."""
        if self.value is None:
            return None

        if self.value_type == "int":
            return int(self.value)
        elif self.value_type == "bool":
            return self.value.lower() in ("true", "1", "yes")
        elif self.value_type == "json":
            import json
            return json.loads(self.value)
        else:
            return self.value

    @classmethod
    def set_value(cls, session, key: str, value, category: str = "general"):
        """
        Establece un valor de configuracion.

        Args:
            session: Sesion de SQLAlchemy
            key: Clave de configuracion
            value: Valor a guardar
            category: Categoria de la configuracion
        """
        import json

        # Determinar tipo
        if isinstance(value, bool):
            value_type = "bool"
            str_value = str(value).lower()
        elif isinstance(value, int):
            value_type = "int"
            str_value = str(value)
        elif isinstance(value, (dict, list)):
            value_type = "json"
            str_value = json.dumps(value)
        else:
            value_type = "string"
            str_value = str(value) if value is not None else None

        # Buscar o crear
        config = session.query(cls).filter_by(key=key).first()
        if config:
            config.value = str_value
            config.value_type = value_type
        else:
            config = cls(
                key=key,
                value=str_value,
                value_type=value_type,
                category=category,
            )
            session.add(config)

        return config

    @classmethod
    def get_value(cls, session, key: str, default=None):
        """
        Obtiene un valor de configuracion.

        Args:
            session: Sesion de SQLAlchemy
            key: Clave de configuracion
            default: Valor por defecto si no existe

        Returns:
            Valor de la configuracion o default
        """
        config = session.query(cls).filter_by(key=key).first()
        if config:
            return config.get_typed_value()
        return default
