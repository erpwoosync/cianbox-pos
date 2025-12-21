"""
Modelos de productos, categorias y precios.

Almacena el catalogo de productos sincronizado desde el backend
para busqueda y operacion offline.
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


class Category(BaseModel):
    """
    Modelo de categoria de productos.

    Categorias jerarquicas para organizar productos.
    """

    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Jerarquia
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        ForeignKey("categories.id"),
    )

    # Datos
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Acceso rapido en POS
    is_quick_access: Mapped[bool] = mapped_column(Boolean, default=False)
    quick_access_order: Mapped[int] = mapped_column(Integer, default=0)
    quick_access_color: Mapped[Optional[str]] = mapped_column(String(7))

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ID de Cianbox para sincronizacion
    cianbox_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        remote_side="Category.id",
        back_populates="children",
    )
    children: Mapped[List["Category"]] = relationship(
        "Category",
        back_populates="parent",
    )
    products: Mapped[List["Product"]] = relationship(back_populates="category")


class Brand(BaseModel):
    """
    Modelo de marca de productos.
    """

    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ID de Cianbox
    cianbox_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    products: Mapped[List["Product"]] = relationship(back_populates="brand")


class PriceList(BaseModel):
    """
    Modelo de lista de precios.

    Diferentes listas de precios por canal o tipo de cliente.
    """

    __tablename__ = "price_lists"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    prices: Mapped[List["ProductPrice"]] = relationship(back_populates="price_list")


class Product(BaseModel):
    """
    Modelo de producto.

    Almacena el catalogo completo de productos para busqueda
    y operacion offline.
    """

    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Clasificacion
    category_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        ForeignKey("categories.id"),
    )
    brand_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        ForeignKey("brands.id"),
    )

    # Codigos
    sku: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    internal_code: Mapped[Optional[str]] = mapped_column(String(50))

    # Datos basicos
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Precios base (IVA incluido por defecto)
    base_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
    )
    base_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))

    # Impuestos
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("21"),
    )
    tax_included: Mapped[bool] = mapped_column(Boolean, default=True)

    # Stock
    track_stock: Mapped[bool] = mapped_column(Boolean, default=False)
    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)

    # Unidad
    unit: Mapped[str] = mapped_column(String(20), default="UN")
    unit_fraction: Mapped[bool] = mapped_column(Boolean, default=False)

    # Imagen
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_weighable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_service: Mapped[bool] = mapped_column(Boolean, default=False)

    # Productos variables (curva de talles)
    is_parent: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_product_id: Mapped[Optional[str]] = mapped_column(String(50))
    size: Mapped[Optional[str]] = mapped_column(String(50))
    color: Mapped[Optional[str]] = mapped_column(String(100))

    # ID de Cianbox
    cianbox_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    category: Mapped[Optional["Category"]] = relationship(back_populates="products")
    brand: Mapped[Optional["Brand"]] = relationship(back_populates="products")
    prices: Mapped[List["ProductPrice"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )

    # Indices para busqueda
    __table_args__ = (
        Index("ix_products_search", "tenant_id", "name", "sku", "barcode"),
        Index("ix_products_tenant_active", "tenant_id", "is_active"),
    )

    def get_price(self, price_list_id: Optional[str] = None) -> Decimal:
        """
        Obtiene el precio del producto.

        Args:
            price_list_id: ID de lista de precios (opcional)

        Returns:
            Precio del producto (usa base_price si no hay lista especifica)
        """
        if price_list_id:
            for price in self.prices:
                if price.price_list_id == price_list_id:
                    return price.price
        return self.base_price

    def get_net_price(self, price_list_id: Optional[str] = None) -> Decimal:
        """
        Obtiene el precio neto (sin IVA) del producto.

        Args:
            price_list_id: ID de lista de precios (opcional)

        Returns:
            Precio neto del producto
        """
        price = self.get_price(price_list_id)
        if self.tax_included:
            # Calcular precio neto
            divisor = Decimal("1") + (self.tax_rate / Decimal("100"))
            return (price / divisor).quantize(Decimal("0.01"))
        return price


class ProductPrice(BaseModel):
    """
    Modelo de precio por lista de precios.

    Permite tener diferentes precios segun la lista de precios
    configurada en el punto de venta.
    """

    __tablename__ = "product_prices"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("products.id"),
        nullable=False,
    )
    price_list_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("price_lists.id"),
        nullable=False,
    )

    # Precio
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    price_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))

    # Relaciones
    product: Mapped["Product"] = relationship(back_populates="prices")
    price_list: Mapped["PriceList"] = relationship(back_populates="prices")

    # Indice unico
    __table_args__ = (
        Index("ix_product_prices_unique", "product_id", "price_list_id", unique=True),
    )
