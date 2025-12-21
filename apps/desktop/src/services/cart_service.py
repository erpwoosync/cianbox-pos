"""
Servicio de carrito de compras.

Gestiona la logica del carrito de compras del POS:
- Agregar/eliminar items
- Calcular totales
- Aplicar descuentos
- Aplicar promociones
- Validaciones de negocio

Uso:
    >>> from src.services import get_cart_service
    >>> cart = get_cart_service()
    >>> cart.add_item(product, quantity=1)
    >>> print(cart.total)
    1234.56
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Optional, List, Dict, Callable
from uuid import uuid4

from src.config.constants import (
    MAX_CART_ITEMS,
    MAX_ITEM_QUANTITY,
    MAX_DISCOUNT_PERCENT,
)
from src.models import Product


class DiscountType(str, Enum):
    """Tipos de descuento."""

    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"


@dataclass
class CartItem:
    """
    Item del carrito de compras.

    Attributes:
        id: ID unico del item en el carrito
        product_id: ID del producto
        product_name: Nombre del producto (cache)
        sku: SKU del producto
        barcode: Codigo de barras
        unit_price: Precio unitario
        quantity: Cantidad
        discount_type: Tipo de descuento aplicado
        discount_value: Valor del descuento
        notes: Notas del item
        added_at: Timestamp de cuando se agrego
    """

    id: str
    product_id: str
    product_name: str
    sku: Optional[str]
    barcode: Optional[str]
    unit_price: Decimal
    quantity: Decimal
    discount_type: Optional[DiscountType] = None
    discount_value: Decimal = field(default_factory=lambda: Decimal("0"))
    notes: Optional[str] = None
    added_at: datetime = field(default_factory=datetime.now)

    # Datos adicionales para productos variables
    size: Optional[str] = None
    color: Optional[str] = None

    @property
    def subtotal(self) -> Decimal:
        """Subtotal sin descuento."""
        return (self.unit_price * self.quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    @property
    def discount_amount(self) -> Decimal:
        """Monto del descuento."""
        if not self.discount_type or self.discount_value <= 0:
            return Decimal("0")

        if self.discount_type == DiscountType.PERCENTAGE:
            return (self.subtotal * self.discount_value / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:  # FIXED_AMOUNT
            return min(self.discount_value, self.subtotal)

    @property
    def total(self) -> Decimal:
        """Total con descuento aplicado."""
        return (self.subtotal - self.discount_amount).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    def to_dict(self) -> dict:
        """Convierte a diccionario para serializar."""
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "sku": self.sku,
            "barcode": self.barcode,
            "unit_price": str(self.unit_price),
            "quantity": str(self.quantity),
            "discount_type": self.discount_type.value if self.discount_type else None,
            "discount_value": str(self.discount_value),
            "subtotal": str(self.subtotal),
            "discount_amount": str(self.discount_amount),
            "total": str(self.total),
            "size": self.size,
            "color": self.color,
            "notes": self.notes,
        }


class CartService:
    """
    Servicio de gestion del carrito de compras.

    Singleton que mantiene el estado del carrito durante la sesion.

    Attributes:
        items: Lista de items en el carrito
        customer_id: ID del cliente asociado (opcional)
        global_discount_type: Tipo de descuento global
        global_discount_value: Valor del descuento global

    Events:
        on_item_added: Callback cuando se agrega un item
        on_item_removed: Callback cuando se elimina un item
        on_item_updated: Callback cuando se actualiza un item
        on_cart_cleared: Callback cuando se limpia el carrito
    """

    def __init__(self):
        self._items: List[CartItem] = []
        self._customer_id: Optional[str] = None
        self._customer_name: Optional[str] = None
        self._global_discount_type: Optional[DiscountType] = None
        self._global_discount_value: Decimal = Decimal("0")
        self._notes: Optional[str] = None

        # Callbacks para eventos
        self._on_item_added: Optional[Callable[[CartItem], None]] = None
        self._on_item_removed: Optional[Callable[[str], None]] = None
        self._on_item_updated: Optional[Callable[[CartItem], None]] = None
        self._on_cart_cleared: Optional[Callable[[], None]] = None

    # =========================================================================
    # PROPIEDADES
    # =========================================================================

    @property
    def items(self) -> List[CartItem]:
        """Lista de items en el carrito."""
        return self._items.copy()

    @property
    def item_count(self) -> int:
        """Cantidad de items en el carrito."""
        return len(self._items)

    @property
    def total_quantity(self) -> Decimal:
        """Cantidad total de unidades."""
        return sum(item.quantity for item in self._items)

    @property
    def subtotal(self) -> Decimal:
        """Subtotal sin descuentos."""
        return sum(item.subtotal for item in self._items)

    @property
    def items_discount(self) -> Decimal:
        """Total de descuentos por item."""
        return sum(item.discount_amount for item in self._items)

    @property
    def global_discount_amount(self) -> Decimal:
        """Monto del descuento global."""
        if not self._global_discount_type or self._global_discount_value <= 0:
            return Decimal("0")

        subtotal_after_items = self.subtotal - self.items_discount

        if self._global_discount_type == DiscountType.PERCENTAGE:
            return (
                subtotal_after_items * self._global_discount_value / Decimal("100")
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            return min(self._global_discount_value, subtotal_after_items)

    @property
    def total_discount(self) -> Decimal:
        """Total de todos los descuentos."""
        return self.items_discount + self.global_discount_amount

    @property
    def total(self) -> Decimal:
        """Total a pagar."""
        return (self.subtotal - self.total_discount).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    @property
    def is_empty(self) -> bool:
        """Indica si el carrito esta vacio."""
        return len(self._items) == 0

    @property
    def customer_id(self) -> Optional[str]:
        """ID del cliente asociado."""
        return self._customer_id

    @property
    def customer_name(self) -> Optional[str]:
        """Nombre del cliente asociado."""
        return self._customer_name

    @property
    def notes(self) -> Optional[str]:
        """Notas de la venta."""
        return self._notes

    # =========================================================================
    # OPERACIONES CON ITEMS
    # =========================================================================

    def add_item(
        self,
        product: Product,
        quantity: Decimal = Decimal("1"),
        price_list_id: Optional[str] = None,
    ) -> CartItem:
        """
        Agrega un producto al carrito.

        Si el producto ya existe, incrementa la cantidad.

        Args:
            product: Producto a agregar
            quantity: Cantidad a agregar
            price_list_id: ID de lista de precios

        Returns:
            CartItem agregado o actualizado

        Raises:
            ValueError: Si se excede el limite de items o cantidad
        """
        if quantity <= 0:
            raise ValueError("La cantidad debe ser mayor a cero")

        # Buscar si ya existe el producto
        existing = self._find_item_by_product(product.id)

        if existing:
            # Incrementar cantidad
            new_qty = existing.quantity + quantity
            if new_qty > MAX_ITEM_QUANTITY:
                raise ValueError(
                    f"Cantidad maxima por item: {MAX_ITEM_QUANTITY}"
                )
            existing.quantity = new_qty

            if self._on_item_updated:
                self._on_item_updated(existing)

            return existing

        # Verificar limite de items
        if len(self._items) >= MAX_CART_ITEMS:
            raise ValueError(f"Maximo de items permitidos: {MAX_CART_ITEMS}")

        # Crear nuevo item
        item = CartItem(
            id=str(uuid4()),
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            barcode=product.barcode,
            unit_price=product.get_price(price_list_id),
            quantity=quantity,
            size=getattr(product, 'size', None),
            color=getattr(product, 'color', None),
        )

        self._items.append(item)

        if self._on_item_added:
            self._on_item_added(item)

        return item

    def remove_item(self, item_id: str) -> bool:
        """
        Elimina un item del carrito.

        Args:
            item_id: ID del item a eliminar

        Returns:
            True si se elimino, False si no existia
        """
        for i, item in enumerate(self._items):
            if item.id == item_id:
                self._items.pop(i)

                if self._on_item_removed:
                    self._on_item_removed(item_id)

                return True

        return False

    def update_quantity(self, item_id: str, quantity: Decimal) -> Optional[CartItem]:
        """
        Actualiza la cantidad de un item.

        Args:
            item_id: ID del item
            quantity: Nueva cantidad

        Returns:
            Item actualizado o None si no existe

        Raises:
            ValueError: Si la cantidad es invalida
        """
        if quantity <= 0:
            raise ValueError("La cantidad debe ser mayor a cero")

        if quantity > MAX_ITEM_QUANTITY:
            raise ValueError(f"Cantidad maxima: {MAX_ITEM_QUANTITY}")

        item = self._find_item(item_id)
        if item:
            item.quantity = quantity

            if self._on_item_updated:
                self._on_item_updated(item)

            return item

        return None

    def apply_item_discount(
        self,
        item_id: str,
        discount_type: DiscountType,
        discount_value: Decimal,
    ) -> Optional[CartItem]:
        """
        Aplica un descuento a un item.

        Args:
            item_id: ID del item
            discount_type: Tipo de descuento
            discount_value: Valor del descuento

        Returns:
            Item actualizado o None si no existe

        Raises:
            ValueError: Si el descuento es invalido
        """
        if discount_value < 0:
            raise ValueError("El descuento no puede ser negativo")

        if (
            discount_type == DiscountType.PERCENTAGE
            and discount_value > MAX_DISCOUNT_PERCENT
        ):
            raise ValueError(f"Descuento maximo: {MAX_DISCOUNT_PERCENT}%")

        item = self._find_item(item_id)
        if item:
            item.discount_type = discount_type
            item.discount_value = discount_value

            if self._on_item_updated:
                self._on_item_updated(item)

            return item

        return None

    def clear_item_discount(self, item_id: str) -> Optional[CartItem]:
        """
        Elimina el descuento de un item.

        Args:
            item_id: ID del item

        Returns:
            Item actualizado o None si no existe
        """
        item = self._find_item(item_id)
        if item:
            item.discount_type = None
            item.discount_value = Decimal("0")

            if self._on_item_updated:
                self._on_item_updated(item)

            return item

        return None

    # =========================================================================
    # DESCUENTO GLOBAL
    # =========================================================================

    def apply_global_discount(
        self,
        discount_type: DiscountType,
        discount_value: Decimal,
    ) -> None:
        """
        Aplica un descuento global al carrito.

        Args:
            discount_type: Tipo de descuento
            discount_value: Valor del descuento

        Raises:
            ValueError: Si el descuento es invalido
        """
        if discount_value < 0:
            raise ValueError("El descuento no puede ser negativo")

        if (
            discount_type == DiscountType.PERCENTAGE
            and discount_value > MAX_DISCOUNT_PERCENT
        ):
            raise ValueError(f"Descuento maximo: {MAX_DISCOUNT_PERCENT}%")

        self._global_discount_type = discount_type
        self._global_discount_value = discount_value

    def clear_global_discount(self) -> None:
        """Elimina el descuento global."""
        self._global_discount_type = None
        self._global_discount_value = Decimal("0")

    # =========================================================================
    # CLIENTE
    # =========================================================================

    def set_customer(self, customer_id: str, customer_name: str) -> None:
        """
        Asocia un cliente al carrito.

        Args:
            customer_id: ID del cliente
            customer_name: Nombre del cliente
        """
        self._customer_id = customer_id
        self._customer_name = customer_name

    def clear_customer(self) -> None:
        """Elimina el cliente asociado."""
        self._customer_id = None
        self._customer_name = None

    # =========================================================================
    # NOTAS
    # =========================================================================

    def set_notes(self, notes: str) -> None:
        """Establece notas para la venta."""
        self._notes = notes

    def clear_notes(self) -> None:
        """Elimina las notas."""
        self._notes = None

    # =========================================================================
    # OPERACIONES GENERALES
    # =========================================================================

    def clear(self) -> None:
        """
        Limpia completamente el carrito.

        Elimina todos los items, descuentos, cliente y notas.
        """
        self._items.clear()
        self._customer_id = None
        self._customer_name = None
        self._global_discount_type = None
        self._global_discount_value = Decimal("0")
        self._notes = None

        if self._on_cart_cleared:
            self._on_cart_cleared()

    def to_dict(self) -> dict:
        """
        Convierte el carrito a diccionario para serializar.

        Returns:
            Diccionario con todos los datos del carrito
        """
        return {
            "items": [item.to_dict() for item in self._items],
            "item_count": self.item_count,
            "total_quantity": str(self.total_quantity),
            "subtotal": str(self.subtotal),
            "items_discount": str(self.items_discount),
            "global_discount_type": (
                self._global_discount_type.value
                if self._global_discount_type
                else None
            ),
            "global_discount_value": str(self._global_discount_value),
            "global_discount_amount": str(self.global_discount_amount),
            "total_discount": str(self.total_discount),
            "total": str(self.total),
            "customer_id": self._customer_id,
            "customer_name": self._customer_name,
            "notes": self._notes,
        }

    # =========================================================================
    # EVENTOS
    # =========================================================================

    def on_item_added(self, callback: Callable[[CartItem], None]) -> None:
        """Registra callback para cuando se agrega un item."""
        self._on_item_added = callback

    def on_item_removed(self, callback: Callable[[str], None]) -> None:
        """Registra callback para cuando se elimina un item."""
        self._on_item_removed = callback

    def on_item_updated(self, callback: Callable[[CartItem], None]) -> None:
        """Registra callback para cuando se actualiza un item."""
        self._on_item_updated = callback

    def on_cart_cleared(self, callback: Callable[[], None]) -> None:
        """Registra callback para cuando se limpia el carrito."""
        self._on_cart_cleared = callback

    # =========================================================================
    # METODOS PRIVADOS
    # =========================================================================

    def _find_item(self, item_id: str) -> Optional[CartItem]:
        """Busca un item por ID."""
        for item in self._items:
            if item.id == item_id:
                return item
        return None

    def _find_item_by_product(self, product_id: str) -> Optional[CartItem]:
        """Busca un item por ID de producto."""
        for item in self._items:
            if item.product_id == product_id:
                return item
        return None


# =============================================================================
# SINGLETON
# =============================================================================

_cart_service: Optional[CartService] = None


def get_cart_service() -> CartService:
    """
    Obtiene la instancia singleton del servicio de carrito.

    Returns:
        Instancia de CartService
    """
    global _cart_service
    if _cart_service is None:
        _cart_service = CartService()
    return _cart_service


def reset_cart_service() -> None:
    """
    Resetea la instancia singleton del servicio.

    Util para testing.
    """
    global _cart_service
    if _cart_service:
        _cart_service.clear()
    _cart_service = None
