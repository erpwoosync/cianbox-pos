"""
Configuracion de base de datos SQLAlchemy.

Proporciona:
- Motor de base de datos SQLite
- Factory de sesiones
- Context manager para sesiones
- Inicializacion de esquema
"""

from contextlib import contextmanager
from functools import lru_cache
from typing import Generator

from loguru import logger
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker, DeclarativeBase


class Base(DeclarativeBase):
    """
    Clase base para todos los modelos SQLAlchemy.

    Todos los modelos deben heredar de esta clase para ser
    registrados en el metadata y creados automaticamente.
    """
    pass


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Configura pragmas de SQLite para mejor rendimiento.

    Se ejecuta cada vez que se establece una nueva conexion.
    """
    cursor = dbapi_connection.cursor()
    # Habilitar foreign keys
    cursor.execute("PRAGMA foreign_keys=ON")
    # Modo WAL para mejor concurrencia
    cursor.execute("PRAGMA journal_mode=WAL")
    # Sincronizacion normal (balance entre seguridad y velocidad)
    cursor.execute("PRAGMA synchronous=NORMAL")
    # Cache en memoria
    cursor.execute("PRAGMA cache_size=-64000")  # 64MB
    cursor.close()


@lru_cache()
def get_engine() -> Engine:
    """
    Obtiene el motor de base de datos (singleton).

    Returns:
        Engine de SQLAlchemy configurado para SQLite
    """
    from src.config import get_settings

    settings = get_settings()
    database_url = settings.database_url

    logger.debug(f"Creando engine de base de datos: {database_url}")

    engine = create_engine(
        database_url,
        echo=settings.DEBUG,  # Log SQL queries en modo debug
        pool_pre_ping=True,
        connect_args={
            "check_same_thread": False,  # Permitir uso multi-hilo
            "timeout": 30,
        },
    )

    return engine


@lru_cache()
def get_session_factory() -> sessionmaker:
    """
    Obtiene la factory de sesiones (singleton).

    Returns:
        sessionmaker configurado
    """
    engine = get_engine()
    return sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def get_session() -> Session:
    """
    Crea una nueva sesion de base de datos.

    Returns:
        Nueva instancia de Session

    Note:
        La sesion debe ser cerrada manualmente o usar el context manager.
    """
    factory = get_session_factory()
    return factory()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """
    Context manager para sesiones de base de datos.

    Maneja automaticamente commit/rollback y cierre de sesion.

    Yields:
        Session activa

    Example:
        >>> with session_scope() as session:
        ...     products = session.query(Product).all()
    """
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Error en transaccion de base de datos: {e}")
        raise
    finally:
        session.close()


def init_database() -> None:
    """
    Inicializa la base de datos.

    Crea todas las tablas definidas en los modelos si no existen.
    Debe llamarse al inicio de la aplicacion.
    """
    from src.config import get_settings

    settings = get_settings()

    # Asegurar que existe el directorio
    settings.database_file.parent.mkdir(parents=True, exist_ok=True)

    # Importar modelos para registrarlos en el metadata
    from src.models import (
        User,
        Tenant,
        Branch,
        Category,
        Brand,
        Product,
        ProductPrice,
        PriceList,
        Promotion,
        OfflineQueue,
        AppConfig,
        Device,
        Customer,
    )

    engine = get_engine()

    logger.info(f"Inicializando base de datos: {settings.database_file}")

    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)

    logger.info("Base de datos inicializada correctamente")


def drop_all_tables() -> None:
    """
    Elimina todas las tablas de la base de datos.

    WARNING: Esta operacion es destructiva y elimina todos los datos.
    Solo usar para desarrollo/testing.
    """
    engine = get_engine()
    logger.warning("Eliminando todas las tablas de la base de datos")
    Base.metadata.drop_all(bind=engine)
    logger.info("Tablas eliminadas")
