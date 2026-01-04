"""
Modelos de ventas para cache local.

Almacena las ventas sincronizadas desde el backend
para busqueda rapida en devoluciones y reportes offline.
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
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class Sale(BaseModel):
    """
    Modelo de venta local.

    Almacena las ventas de los ultimos 180 dias para
    busqueda rapida en devoluciones.
    """

    __tablename__ = "sales"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    branch_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Numero de ticket
    sale_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Fecha de venta
    sale_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Cliente
    customer_id: Mapped[Optional[str]] = mapped_column(String(50))
    customer_name: Mapped[Optional[str]] = mapped_column(String(255))

    # Totales
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))

    # Estado
    status: Mapped[str] = mapped_column(String(30), default="COMPLETED")
    # COMPLETED, CANCELLED, REFUNDED, PARTIAL_REFUND

    # Tipo de comprobante (NDP_X = Nota de Pedido X, comprobante provisorio)
    receipt_type: Mapped[str] = mapped_column(String(30), default="NDP_X")

    # Numero fiscal (CAE para facturas electronicas)
    fiscal_number: Mapped[Optional[str]] = mapped_column(String(50))

    # Usuario que realizo la venta
    user_id: Mapped[Optional[str]] = mapped_column(String(50))
    user_name: Mapped[Optional[str]] = mapped_column(String(255))

    # Punto de venta
    point_of_sale_id: Mapped[Optional[str]] = mapped_column(String(50))
    point_of_sale_name: Mapped[Optional[str]] = mapped_column(String(100))

    # Sucursal
    branch_name: Mapped[Optional[str]] = mapped_column(String(100))

    # Notas
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    items: Mapped[List["SaleItem"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan",
    )

    # Indices
    __table_args__ = (
        Index("ix_sales_tenant_date", "tenant_id", "sale_date"),
        Index("ix_sales_tenant_status", "tenant_id", "status"),
        Index("ix_sales_sale_number", "tenant_id", "sale_number"),
    )


class SaleItem(BaseModel):
    """
    Modelo de item de venta.

    Detalle de productos vendidos en cada venta.
    """

    __tablename__ = "sale_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    sale_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("sales.id"),
        nullable=False,
    )

    # Producto
    product_id: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    product_code: Mapped[Optional[str]] = mapped_column(String(50))
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_barcode: Mapped[Optional[str]] = mapped_column(String(50))

    # Cantidad y precio
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Impuestos
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("21"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))

    # Promocion aplicada
    promotion_id: Mapped[Optional[str]] = mapped_column(String(50))
    promotion_name: Mapped[Optional[str]] = mapped_column(String(255))

    # Para devoluciones
    is_return: Mapped[bool] = mapped_column(Boolean, default=False)
    original_item_id: Mapped[Optional[str]] = mapped_column(String(50))

    # Cantidad ya devuelta (calculado)
    refunded_quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 3), default=Decimal("0")
    )

    # Relacion
    sale: Mapped["Sale"] = relationship(back_populates="items")

    # Indices
    __table_args__ = (
        Index("ix_sale_items_product", "product_id"),
        Index("ix_sale_items_sale", "sale_id"),
    )

    @property
    def available_quantity(self) -> Decimal:
        """Cantidad disponible para devolucion."""
        return abs(self.quantity) - abs(self.refunded_quantity)
