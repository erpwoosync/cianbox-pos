"""
Modelos de promociones.

Almacena las promociones activas sincronizadas desde el backend.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Integer,
    Numeric,
    Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel
from src.config.constants import PromotionType


class Promotion(BaseModel):
    """
    Modelo de promocion.

    Almacena promociones para aplicar automaticamente en el POS.
    """

    __tablename__ = "promotions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Identificacion
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Tipo de promocion
    promotion_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    # Configuracion segun tipo
    # PERCENTAGE: discount_percentage
    # FIXED_AMOUNT: discount_amount
    # BUY_X_GET_Y: buy_quantity, get_quantity
    # SECOND_UNIT_DISCOUNT: discount_percentage (para 2da unidad)
    discount_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    discount_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    buy_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    get_quantity: Mapped[Optional[int]] = mapped_column(Integer)

    # Condiciones
    min_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    min_quantity: Mapped[Optional[int]] = mapped_column(Integer)

    # Vigencia
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Aplicabilidad
    applies_to_all: Mapped[bool] = mapped_column(Boolean, default=False)
    category_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON como string
    brand_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON como string

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    # Flags especiales
    is_combinable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_flash_sale: Mapped[bool] = mapped_column(Boolean, default=False)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    products: Mapped[List["PromotionProduct"]] = relationship(
        back_populates="promotion",
        cascade="all, delete-orphan",
    )

    def is_valid_now(self) -> bool:
        """
        Verifica si la promocion esta vigente.

        Returns:
            True si la promocion esta activa y dentro del rango de fechas
        """
        if not self.is_active:
            return False

        now = datetime.now()

        if self.start_date and now < self.start_date:
            return False

        if self.end_date and now > self.end_date:
            return False

        return True

    def applies_to_product(self, product_id: str) -> bool:
        """
        Verifica si la promocion aplica a un producto.

        Args:
            product_id: ID del producto

        Returns:
            True si la promocion aplica al producto
        """
        if self.applies_to_all:
            return True

        for pp in self.products:
            if pp.product_id == product_id:
                return True

        return False


class PromotionProduct(BaseModel):
    """
    Relacion entre promocion y productos.

    Define que productos participan en una promocion.
    """

    __tablename__ = "promotion_products"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    promotion_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("promotions.id"),
        nullable=False,
    )
    product_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # Configuracion especifica por producto (opcional)
    custom_discount: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    custom_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))

    # Relaciones
    promotion: Mapped["Promotion"] = relationship(back_populates="products")
