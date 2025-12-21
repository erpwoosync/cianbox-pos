"""
Modulo de base de datos.

Proporciona:
- Configuracion de SQLAlchemy
- Sesiones de base de datos
- Utilidades de conexion
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
