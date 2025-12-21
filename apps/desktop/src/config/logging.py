"""
Configuracion del sistema de logging.

Utiliza loguru para proporcionar logging estructurado con:
- Salida a consola con colores
- Rotacion de archivos diaria
- Archivo separado para errores
- Formato consistente con timestamps
"""

import sys
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from .settings import Settings


def setup_logging(settings: "Settings") -> None:
    """
    Configura el sistema de logging.

    Args:
        settings: Instancia de configuracion

    Configura:
        - Handler de consola con colores
        - Handler de archivo con rotacion diaria
        - Handler separado para errores
    """
    # Remover handlers por defecto
    logger.remove()

    # Formato de log
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )

    # Formato simplificado para archivos
    file_format = (
        "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
        "{level: <8} | "
        "{name}:{function}:{line} | "
        "{message}"
    )

    # Handler de consola
    logger.add(
        sys.stderr,
        format=log_format,
        level=settings.LOG_LEVEL,
        colorize=True,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
    )

    # Asegurar que existe el directorio de logs
    logs_dir = settings.logs_dir
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Handler de archivo principal (rotacion diaria)
    logger.add(
        str(logs_dir / "app_{time:YYYY-MM-DD}.log"),
        format=file_format,
        level=settings.LOG_LEVEL,
        rotation="00:00",  # Rotar a medianoche
        retention="7 days",  # Mantener 7 dias
        compression="zip",
        encoding="utf-8",
        enqueue=True,  # Thread-safe
    )

    # Handler separado para errores
    logger.add(
        str(logs_dir / "errors_{time:YYYY-MM-DD}.log"),
        format=file_format,
        level="ERROR",
        rotation="00:00",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
    )

    # Log inicial
    logger.info("=" * 60)
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Nivel de log: {settings.LOG_LEVEL}")
    logger.info(f"Directorio de logs: {logs_dir}")
    logger.info(f"API URL: {settings.API_URL}")
    logger.info(f"Debug: {settings.DEBUG}")
    logger.info("=" * 60)


def get_logger(name: str = None):
    """
    Obtiene un logger con contexto.

    Args:
        name: Nombre del modulo (opcional)

    Returns:
        Logger configurado

    Example:
        >>> log = get_logger(__name__)
        >>> log.info("Mensaje de info")
    """
    if name:
        return logger.bind(name=name)
    return logger
