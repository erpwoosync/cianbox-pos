"""
Configuracion global de la aplicacion.

Carga variables de entorno y proporciona configuracion tipada usando Pydantic.
Soporta archivo .env y variables de entorno del sistema.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def get_base_path() -> Path:
    """
    Obtiene el directorio base de la aplicacion.

    Returns:
        Path al directorio raiz del proyecto desktop
    """
    return Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    """
    Configuracion de la aplicacion.

    Los valores se cargan en orden de prioridad:
    1. Variables de entorno del sistema
    2. Archivo .env en el directorio raiz
    3. Valores por defecto definidos aqui

    Attributes:
        API_URL: URL base de la API de Cianbox POS
        API_TIMEOUT: Timeout de requests HTTP en segundos
        APP_NAME: Nombre de la aplicacion
        APP_VERSION: Version de la aplicacion
        DEBUG: Modo debug activo
        DATABASE_PATH: Ruta relativa a la base de datos SQLite
        LOG_LEVEL: Nivel de logging (DEBUG, INFO, WARNING, ERROR)
        LOG_PATH: Ruta relativa al directorio de logs
    """

    model_config = SettingsConfigDict(
        env_file=str(get_base_path() / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # API Backend
    API_URL: str = Field(
        default="https://cianbox-pos-api.ews-cdn.link",
        description="URL base de la API de Cianbox POS",
    )
    API_TIMEOUT: int = Field(
        default=30,
        description="Timeout de requests HTTP en segundos",
        ge=5,
        le=120,
    )

    # Aplicacion
    APP_NAME: str = Field(
        default="Cianbox POS",
        description="Nombre de la aplicacion",
    )
    APP_VERSION: str = Field(
        default="1.0.0",
        description="Version de la aplicacion",
    )
    DEBUG: bool = Field(
        default=False,
        description="Modo debug activo",
    )

    # Base de datos
    DATABASE_PATH: str = Field(
        default="data/cianbox_pos.db",
        description="Ruta relativa a la base de datos SQLite",
    )

    # Logging
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Nivel de logging",
        pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$",
    )
    LOG_PATH: str = Field(
        default="logs",
        description="Ruta relativa al directorio de logs",
    )

    # Credenciales guardadas (no en .env, se cargan dinamicamente)
    _saved_tenant: Optional[str] = None
    _saved_email: Optional[str] = None

    @property
    def base_path(self) -> Path:
        """Directorio base de la aplicacion."""
        return get_base_path()

    @property
    def database_url(self) -> str:
        """URL de conexion SQLite."""
        db_path = self.get_absolute_path(self.DATABASE_PATH)
        return f"sqlite:///{db_path}"

    @property
    def database_file(self) -> Path:
        """Ruta absoluta al archivo de base de datos."""
        return self.get_absolute_path(self.DATABASE_PATH)

    @property
    def logs_dir(self) -> Path:
        """Directorio de logs."""
        return self.get_absolute_path(self.LOG_PATH)

    @property
    def data_dir(self) -> Path:
        """Directorio de datos."""
        return self.database_file.parent

    def get_absolute_path(self, relative_path: str) -> Path:
        """
        Convierte una ruta relativa a absoluta.

        Args:
            relative_path: Ruta relativa desde el directorio base

        Returns:
            Path absoluto
        """
        path = Path(relative_path)
        if path.is_absolute():
            return path
        return self.base_path / path

    def ensure_directories(self) -> None:
        """
        Crea los directorios necesarios si no existen.

        Crea:
            - Directorio de base de datos
            - Directorio de logs
        """
        self.database_file.parent.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def get_saved_tenant(self) -> Optional[str]:
        """Obtiene el ultimo tenant usado."""
        return self._saved_tenant

    def save_tenant(self, tenant_slug: str) -> None:
        """
        Guarda el ultimo tenant usado.

        Args:
            tenant_slug: Slug del tenant
        """
        self._saved_tenant = tenant_slug

    def get_saved_email(self) -> Optional[str]:
        """Obtiene el ultimo email usado."""
        return self._saved_email

    def save_email(self, email: str) -> None:
        """
        Guarda el ultimo email usado.

        Args:
            email: Email del usuario
        """
        self._saved_email = email


@lru_cache()
def get_settings() -> Settings:
    """
    Obtiene la instancia de configuracion (singleton).

    Usa cache para evitar recargar la configuracion en cada llamada.

    Returns:
        Instancia de Settings
    """
    settings = Settings()
    settings.ensure_directories()
    return settings
