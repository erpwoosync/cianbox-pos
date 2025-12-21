"""
Modulo de base de datos SQLite para Cianbox POS Desktop.

Proporciona:
- Configuracion de SQLAlchemy con SQLite
- Factory de sesiones thread-safe
- Context manager para transacciones
- Inicializacion de esquema

La base de datos SQLite se usa para cache local de productos,
categorias y promociones, permitiendo operacion offline.

Optimizaciones SQLite aplicadas:
- WAL mode para mejor concurrencia
- Foreign keys habilitadas
- Cache en memoria (64MB)

Uso recomendado:
    >>> from src.db import session_scope
    >>> with session_scope() as session:
    ...     products = session.query(Product).all()

Para inicializar la base de datos:
    >>> from src.db import init_database
    >>> init_database()  # Crea todas las tablas

Exports:
    - Base: Clase base para modelos SQLAlchemy
    - get_engine: Obtiene el motor SQLite (singleton)
    - get_session: Crea una nueva sesion
    - get_session_factory: Factory de sesiones (singleton)
    - session_scope: Context manager con commit/rollback automatico
    - init_database: Crea todas las tablas
    - drop_all_tables: Elimina todas las tablas (DESTRUCTIVO)
"""

from .database import (
    Base,
    get_engine,
    get_session,
    get_session_factory,
    session_scope,
    init_database,
    drop_all_tables,
)

__all__ = [
    "Base",
    "get_engine",
    "get_session",
    "get_session_factory",
    "session_scope",
    "init_database",
    "drop_all_tables",
]
