"""
Modelo base y mixins para SQLAlchemy.

Proporciona funcionalidad comun para todos los modelos:
- Timestamps automaticos
- Metodos de serializacion
- Representacion string
"""

from datetime import datetime
from typing import Any, Dict

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from src.db.database import Base


class TimestampMixin:
    """
    Mixin que agrega campos de timestamp automaticos.

    Attributes:
        created_at: Fecha de creacion (automatica)
        updated_at: Fecha de ultima actualizacion (automatica)
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class BaseModel(Base, TimestampMixin):
    """
    Modelo base abstracto para todas las entidades.

    Proporciona:
    - Timestamps automaticos (created_at, updated_at)
    - Metodo to_dict() para serializacion
    - Representacion string legible
    """

    __abstract__ = True

    def to_dict(self, exclude: set = None) -> Dict[str, Any]:
        """
        Convierte el modelo a diccionario.

        Args:
            exclude: Conjunto de campos a excluir

        Returns:
            Diccionario con los datos del modelo
        """
        exclude = exclude or set()
        result = {}

        for column in self.__table__.columns:
            if column.name not in exclude:
                value = getattr(self, column.name)
                # Convertir datetime a ISO string
                if isinstance(value, datetime):
                    value = value.isoformat()
                result[column.name] = value

        return result

    def __repr__(self) -> str:
        """Representacion string del modelo."""
        class_name = self.__class__.__name__
        # Obtener campos de primary key
        pk_columns = [col.name for col in self.__table__.primary_key]
        pk_values = [f"{col}={getattr(self, col)!r}" for col in pk_columns]
        return f"<{class_name}({', '.join(pk_values)})>"
