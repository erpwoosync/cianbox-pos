"""
Modelos de usuario, tenant y sucursal.

Almacena los datos del usuario logueado y su contexto
para operacion offline.
"""

from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class Tenant(BaseModel):
    """
    Modelo de tenant (empresa/cliente).

    Almacena la informacion del tenant al que pertenece el usuario.
    Se sincroniza desde el backend al hacer login.
    """

    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    logo: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Configuracion
    settings: Mapped[Optional[dict]] = mapped_column(JSON)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    users: Mapped[List["User"]] = relationship(back_populates="tenant")
    branches: Mapped[List["Branch"]] = relationship(back_populates="tenant")


class Branch(BaseModel):
    """
    Modelo de sucursal.

    Representa una sucursal/tienda del tenant.
    """

    __tablename__ = "branches"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    tenant: Mapped["Tenant"] = relationship(back_populates="branches")
    users: Mapped[List["User"]] = relationship(back_populates="branch")


class User(BaseModel):
    """
    Modelo de usuario.

    Almacena los datos del usuario logueado para operacion offline
    y referencia en ventas.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    branch_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        ForeignKey("branches.id"),
        index=True,
    )

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar: Mapped[Optional[str]] = mapped_column(String(500))

    # Rol y permisos
    role_id: Mapped[Optional[str]] = mapped_column(String(50))
    role_name: Mapped[Optional[str]] = mapped_column(String(50))
    permissions: Mapped[Optional[list]] = mapped_column(JSON)

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_current_user: Mapped[bool] = mapped_column(Boolean, default=False)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    tenant: Mapped["Tenant"] = relationship(back_populates="users")
    branch: Mapped[Optional["Branch"]] = relationship(back_populates="users")

    def has_permission(self, permission: str) -> bool:
        """
        Verifica si el usuario tiene un permiso especifico.

        Args:
            permission: Nombre del permiso a verificar

        Returns:
            True si tiene el permiso
        """
        if not self.permissions:
            return False
        # Permiso wildcard
        if "*" in self.permissions:
            return True
        return permission in self.permissions
