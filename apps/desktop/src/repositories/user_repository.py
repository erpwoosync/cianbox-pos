"""
Repositorio de usuarios.

Maneja el almacenamiento local de datos de usuario y tenant.
"""

from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .base import BaseRepository
from src.models import User, Tenant, Branch


class UserRepository(BaseRepository[User]):
    """
    Repositorio para operaciones con usuarios.
    """

    def __init__(self, session: Session):
        super().__init__(session, User)

    def get_current_user(self) -> Optional[User]:
        """
        Obtiene el usuario marcado como actual.

        Returns:
            Usuario actual o None
        """
        stmt = select(User).where(User.is_current_user == True)
        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def set_current_user(self, user_id: str) -> None:
        """
        Establece un usuario como el actual.

        Desmarca cualquier usuario anterior.

        Args:
            user_id: ID del usuario
        """
        # Desmarcar todos
        stmt = (
            update(User)
            .where(User.is_current_user == True)
            .values(is_current_user=False)
        )
        self.session.execute(stmt)

        # Marcar el nuevo
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(is_current_user=True)
        )
        self.session.execute(stmt)
        self.session.flush()

    def clear_current_user(self) -> None:
        """
        Desmarca cualquier usuario actual.

        Se usa al hacer logout.
        """
        stmt = (
            update(User)
            .where(User.is_current_user == True)
            .values(is_current_user=False)
        )
        self.session.execute(stmt)
        self.session.flush()

    def get_by_email(
        self,
        tenant_id: str,
        email: str,
    ) -> Optional[User]:
        """
        Obtiene un usuario por email.

        Args:
            tenant_id: ID del tenant
            email: Email del usuario

        Returns:
            Usuario o None
        """
        stmt = (
            select(User)
            .where(User.tenant_id == tenant_id)
            .where(User.email == email)
        )
        result = self.session.execute(stmt)
        return result.scalar_one_or_none()


class TenantRepository(BaseRepository[Tenant]):
    """
    Repositorio para operaciones con tenants.
    """

    def __init__(self, session: Session):
        super().__init__(session, Tenant)

    def get_by_slug(self, slug: str) -> Optional[Tenant]:
        """
        Obtiene un tenant por slug.

        Args:
            slug: Slug del tenant

        Returns:
            Tenant o None
        """
        stmt = select(Tenant).where(Tenant.slug == slug)
        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def get_active_tenant(self) -> Optional[Tenant]:
        """
        Obtiene el tenant activo (basado en el usuario actual).

        Returns:
            Tenant del usuario actual o None
        """
        stmt = (
            select(Tenant)
            .join(User)
            .where(User.is_current_user == True)
        )
        result = self.session.execute(stmt)
        return result.scalar_one_or_none()


class BranchRepository(BaseRepository[Branch]):
    """
    Repositorio para operaciones con sucursales.
    """

    def __init__(self, session: Session):
        super().__init__(session, Branch)

    def get_by_code(
        self,
        tenant_id: str,
        code: str,
    ) -> Optional[Branch]:
        """
        Obtiene una sucursal por codigo.

        Args:
            tenant_id: ID del tenant
            code: Codigo de la sucursal

        Returns:
            Sucursal o None
        """
        stmt = (
            select(Branch)
            .where(Branch.tenant_id == tenant_id)
            .where(Branch.code == code)
        )
        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def get_active_branches(self, tenant_id: str) -> list[Branch]:
        """
        Obtiene las sucursales activas de un tenant.

        Args:
            tenant_id: ID del tenant

        Returns:
            Lista de sucursales activas
        """
        stmt = (
            select(Branch)
            .where(Branch.tenant_id == tenant_id)
            .where(Branch.is_active == True)
            .order_by(Branch.name)
        )
        result = self.session.execute(stmt)
        return list(result.scalars().all())
