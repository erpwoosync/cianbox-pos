"""
Repositorio de configuracion.

Maneja la configuracion persistente de la aplicacion.
"""

from typing import Any, Optional

from sqlalchemy.orm import Session

from .base import BaseRepository
from src.models import AppConfig


class ConfigRepository(BaseRepository[AppConfig]):
    """
    Repositorio para configuracion de la aplicacion.

    Proporciona acceso tipo clave-valor para configuracion persistente.
    """

    def __init__(self, session: Session):
        super().__init__(session, AppConfig)

    def get_value(self, key: str, default: Any = None) -> Any:
        """
        Obtiene un valor de configuracion.

        Args:
            key: Clave de configuracion
            default: Valor por defecto si no existe

        Returns:
            Valor de la configuracion
        """
        return AppConfig.get_value(self.session, key, default)

    def set_value(
        self,
        key: str,
        value: Any,
        category: str = "general",
    ) -> AppConfig:
        """
        Establece un valor de configuracion.

        Args:
            key: Clave de configuracion
            value: Valor a guardar
            category: Categoria de la configuracion

        Returns:
            Entidad AppConfig
        """
        return AppConfig.set_value(self.session, key, value, category)

    def get_by_category(self, category: str) -> dict[str, Any]:
        """
        Obtiene todas las configuraciones de una categoria.

        Args:
            category: Categoria a obtener

        Returns:
            Diccionario con clave-valor
        """
        from sqlalchemy import select

        stmt = select(AppConfig).where(AppConfig.category == category)
        result = self.session.execute(stmt)
        configs = result.scalars().all()

        return {config.key: config.get_typed_value() for config in configs}

    def delete_key(self, key: str) -> bool:
        """
        Elimina una configuracion.

        Args:
            key: Clave a eliminar

        Returns:
            True si se elimino
        """
        from sqlalchemy import select

        stmt = select(AppConfig).where(AppConfig.key == key)
        result = self.session.execute(stmt)
        config = result.scalar_one_or_none()

        if config:
            self.session.delete(config)
            self.session.flush()
            return True
        return False

    # =========================================================================
    # METODOS DE CONVENIENCIA PARA CONFIGURACIONES COMUNES
    # =========================================================================

    def get_last_tenant(self) -> Optional[str]:
        """Obtiene el ultimo tenant usado."""
        return self.get_value("last_tenant")

    def set_last_tenant(self, tenant_slug: str) -> None:
        """Guarda el ultimo tenant usado."""
        self.set_value("last_tenant", tenant_slug, "auth")

    def get_last_email(self) -> Optional[str]:
        """Obtiene el ultimo email usado."""
        return self.get_value("last_email")

    def set_last_email(self, email: str) -> None:
        """Guarda el ultimo email usado."""
        self.set_value("last_email", email, "auth")

    def get_last_branch_id(self) -> Optional[str]:
        """Obtiene la ultima sucursal usada."""
        return self.get_value("last_branch_id")

    def set_last_branch_id(self, branch_id: str) -> None:
        """Guarda la ultima sucursal usada."""
        self.set_value("last_branch_id", branch_id, "auth")

    def get_last_pos_id(self) -> Optional[str]:
        """Obtiene el ultimo punto de venta usado."""
        return self.get_value("last_pos_id")

    def set_last_pos_id(self, pos_id: str) -> None:
        """Guarda el ultimo punto de venta usado."""
        self.set_value("last_pos_id", pos_id, "auth")

    def get_printer_config(self) -> dict:
        """Obtiene configuracion de impresora."""
        return self.get_by_category("printer")

    def set_printer_config(self, config: dict) -> None:
        """Guarda configuracion de impresora."""
        for key, value in config.items():
            self.set_value(f"printer_{key}", value, "printer")

    def get_ui_config(self) -> dict:
        """Obtiene configuracion de UI."""
        return self.get_by_category("ui")

    def set_ui_config(self, config: dict) -> None:
        """Guarda configuracion de UI."""
        for key, value in config.items():
            self.set_value(f"ui_{key}", value, "ui")
