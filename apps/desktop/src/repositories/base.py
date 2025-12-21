"""
Repositorio base con operaciones CRUD genericas.

Proporciona metodos comunes para todos los repositorios.
"""

from typing import Generic, TypeVar, Type, Optional, List, Any

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.db.database import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """
    Repositorio base generico.

    Proporciona operaciones CRUD basicas que pueden ser
    heredadas y extendidas por repositorios especificos.

    Type Parameters:
        T: Tipo del modelo SQLAlchemy
    """

    def __init__(self, session: Session, model_class: Type[T]):
        """
        Inicializa el repositorio.

        Args:
            session: Sesion de SQLAlchemy
            model_class: Clase del modelo
        """
        self.session = session
        self.model_class = model_class

    def get_by_id(self, id: str) -> Optional[T]:
        """
        Obtiene una entidad por su ID.

        Args:
            id: ID de la entidad

        Returns:
            Entidad o None si no existe
        """
        return self.session.get(self.model_class, id)

    def get_all(self, limit: int = None, offset: int = None) -> List[T]:
        """
        Obtiene todas las entidades.

        Args:
            limit: Limite de resultados
            offset: Desplazamiento

        Returns:
            Lista de entidades
        """
        query = select(self.model_class)

        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)

        result = self.session.execute(query)
        return list(result.scalars().all())

    def get_by_tenant(
        self,
        tenant_id: str,
        limit: int = None,
        offset: int = None,
    ) -> List[T]:
        """
        Obtiene entidades filtradas por tenant.

        Args:
            tenant_id: ID del tenant
            limit: Limite de resultados
            offset: Desplazamiento

        Returns:
            Lista de entidades del tenant
        """
        query = select(self.model_class).where(
            self.model_class.tenant_id == tenant_id
        )

        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)

        result = self.session.execute(query)
        return list(result.scalars().all())

    def count(self, tenant_id: str = None) -> int:
        """
        Cuenta el total de entidades.

        Args:
            tenant_id: Filtrar por tenant (opcional)

        Returns:
            Numero de entidades
        """
        query = select(func.count()).select_from(self.model_class)

        if tenant_id and hasattr(self.model_class, "tenant_id"):
            query = query.where(self.model_class.tenant_id == tenant_id)

        result = self.session.execute(query)
        return result.scalar() or 0

    def create(self, entity: T) -> T:
        """
        Crea una nueva entidad.

        Args:
            entity: Entidad a crear

        Returns:
            Entidad creada
        """
        self.session.add(entity)
        self.session.flush()
        return entity

    def create_many(self, entities: List[T]) -> List[T]:
        """
        Crea multiples entidades.

        Args:
            entities: Lista de entidades

        Returns:
            Lista de entidades creadas
        """
        self.session.add_all(entities)
        self.session.flush()
        return entities

    def update(self, entity: T) -> T:
        """
        Actualiza una entidad.

        Args:
            entity: Entidad a actualizar

        Returns:
            Entidad actualizada
        """
        self.session.merge(entity)
        self.session.flush()
        return entity

    def delete(self, entity: T) -> None:
        """
        Elimina una entidad.

        Args:
            entity: Entidad a eliminar
        """
        self.session.delete(entity)
        self.session.flush()

    def delete_by_id(self, id: str) -> bool:
        """
        Elimina una entidad por ID.

        Args:
            id: ID de la entidad

        Returns:
            True si se elimino, False si no existia
        """
        entity = self.get_by_id(id)
        if entity:
            self.delete(entity)
            return True
        return False

    def exists(self, id: str) -> bool:
        """
        Verifica si existe una entidad.

        Args:
            id: ID de la entidad

        Returns:
            True si existe
        """
        return self.get_by_id(id) is not None

    def upsert(self, entity: T) -> T:
        """
        Crea o actualiza una entidad.

        Args:
            entity: Entidad a crear/actualizar

        Returns:
            Entidad creada/actualizada
        """
        # Obtener el valor de la primary key
        pk_columns = self.model_class.__table__.primary_key.columns
        pk_values = {col.name: getattr(entity, col.name) for col in pk_columns}

        # Verificar si existe
        existing = self.session.get(self.model_class, pk_values)

        if existing:
            # Actualizar campos
            for column in self.model_class.__table__.columns:
                if column.name not in pk_values:
                    value = getattr(entity, column.name, None)
                    if value is not None:
                        setattr(existing, column.name, value)
            self.session.flush()
            return existing
        else:
            return self.create(entity)

    def delete_all(self, tenant_id: str = None) -> int:
        """
        Elimina todas las entidades.

        Args:
            tenant_id: Filtrar por tenant (opcional)

        Returns:
            Numero de entidades eliminadas
        """
        query = self.session.query(self.model_class)

        if tenant_id and hasattr(self.model_class, "tenant_id"):
            query = query.filter(self.model_class.tenant_id == tenant_id)

        count = query.delete()
        self.session.flush()
        return count
