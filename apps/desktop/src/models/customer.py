"""
Modelo de cliente.

Almacena los clientes sincronizados desde el backend
para busqueda y seleccion en ventas.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Integer,
    Numeric,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class CustomerType(str, Enum):
    """Tipos de cliente."""

    CONSUMER = "CONSUMER"        # Consumidor final
    INDIVIDUAL = "INDIVIDUAL"    # Persona fisica
    BUSINESS = "BUSINESS"        # Empresa
    GOVERNMENT = "GOVERNMENT"    # Gobierno
    RESELLER = "RESELLER"        # Revendedor


class Customer(BaseModel):
    """
    Modelo de cliente.

    Almacena los datos de clientes sincronizados desde el backend
    para busqueda rapida y seleccion en el POS.
    """

    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # ID de Cianbox para sincronizacion
    cianbox_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Tipo de cliente
    customer_type: Mapped[str] = mapped_column(
        String(20),
        default=CustomerType.CONSUMER.value,
    )

    # Datos fiscales
    tax_id: Mapped[Optional[str]] = mapped_column(String(20))  # CUIT/CUIL/DNI
    tax_id_type: Mapped[Optional[str]] = mapped_column(String(20))  # CUIT, DNI, etc
    tax_category: Mapped[Optional[str]] = mapped_column(String(50))  # RI, Monotributo

    # Datos personales/empresa
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # Razon social
    trade_name: Mapped[Optional[str]] = mapped_column(String(200))  # Nombre fantasia
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))

    # Contacto
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    mobile: Mapped[Optional[str]] = mapped_column(String(50))

    # Direccion
    address: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    zip_code: Mapped[Optional[str]] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(10), default="AR")

    # Comercial
    price_list_id: Mapped[Optional[str]] = mapped_column(String(50))
    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
    )
    credit_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
    )
    payment_term_days: Mapped[int] = mapped_column(Integer, default=0)

    # Descuento
    global_discount: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("0"),
    )

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Indices para busqueda
    __table_args__ = (
        Index("ix_customers_search", "tenant_id", "name", "tax_id"),
        Index("ix_customers_tenant_active", "tenant_id", "is_active"),
        Index("ix_customers_cianbox", "tenant_id", "cianbox_id", unique=True),
    )

    @property
    def display_name(self) -> str:
        """Nombre para mostrar en la UI."""
        if self.trade_name:
            return self.trade_name
        return self.name

    @property
    def full_contact(self) -> str:
        """Informacion de contacto formateada."""
        parts = []
        if self.phone:
            parts.append(f"Tel: {self.phone}")
        if self.mobile:
            parts.append(f"Cel: {self.mobile}")
        if self.email:
            parts.append(self.email)
        return " | ".join(parts) if parts else ""

    @property
    def tax_info(self) -> str:
        """Informacion fiscal formateada."""
        if self.tax_id:
            return f"{self.tax_id_type or 'DOC'}: {self.tax_id}"
        return "Sin documento"

    @property
    def has_credit(self) -> bool:
        """Indica si el cliente tiene credito habilitado."""
        return self.credit_limit > 0

    @property
    def available_credit(self) -> Decimal:
        """Credito disponible."""
        return self.credit_limit - self.credit_balance

    def to_dict(self) -> dict:
        """Convierte a diccionario para serializar."""
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "tax_id": self.tax_id,
            "tax_id_type": self.tax_id_type,
            "tax_category": self.tax_category,
            "customer_type": self.customer_type,
            "email": self.email,
            "phone": self.phone,
            "mobile": self.mobile,
            "address": self.address,
            "city": self.city,
            "credit_limit": str(self.credit_limit),
            "credit_balance": str(self.credit_balance),
            "available_credit": str(self.available_credit),
            "global_discount": str(self.global_discount),
            "price_list_id": self.price_list_id,
        }
