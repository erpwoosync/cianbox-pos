"""
API de promociones.

Maneja la obtencion de promociones activas y el calculo de descuentos
para los items del carrito.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from loguru import logger

from .client import APIClient, get_api_client, APIResponse


class PromotionType(Enum):
    """Tipos de promocion soportados."""
    BUY_X_GET_Y = "BUY_X_GET_Y"  # 2x1, 3x2, etc.
    SECOND_UNIT_DISCOUNT = "SECOND_UNIT_DISCOUNT"  # 2da unidad al X%
    PERCENTAGE = "PERCENTAGE"  # Descuento porcentual
    FIXED_AMOUNT = "FIXED_AMOUNT"  # Descuento monto fijo
    FLASH_SALE = "FLASH_SALE"  # BlackFriday, CyberMonday


class ApplyTo(Enum):
    """A que aplica la promocion."""
    ALL_PRODUCTS = "ALL_PRODUCTS"
    SPECIFIC_PRODUCTS = "SPECIFIC_PRODUCTS"
    CATEGORIES = "CATEGORIES"
    BRANDS = "BRANDS"


@dataclass
class PromotionData:
    """
    Datos de una promocion activa.

    Attributes:
        id: ID de la promocion
        name: Nombre visible de la promocion
        type: Tipo de promocion
        apply_to: A que productos aplica
        discount_value: Valor del descuento (porcentaje o monto)
        discount_type: Tipo de descuento (PERCENTAGE o FIXED)
        buy_quantity: Cantidad a comprar (para BUY_X_GET_Y)
        get_quantity: Cantidad que lleva (para BUY_X_GET_Y)
        category_ids: IDs de categorias a las que aplica
        brand_ids: IDs de marcas a las que aplica
        product_ids: IDs de productos especificos
        badge_color: Color del badge (ej: #22C55E)
        is_active: Si la promocion esta activa
    """

    id: str
    name: str
    type: str
    apply_to: str = "ALL_PRODUCTS"
    discount_value: float = 0.0
    discount_type: str = "PERCENTAGE"
    buy_quantity: int = 1
    get_quantity: int = 1
    category_ids: List[str] = field(default_factory=list)
    brand_ids: List[str] = field(default_factory=list)
    product_ids: List[str] = field(default_factory=list)
    badge_color: Optional[str] = None
    is_active: bool = True

    @classmethod
    def from_dict(cls, data: dict) -> "PromotionData":
        """Crea PromotionData desde diccionario de la API."""
        # Extraer IDs de productos si vienen como objetos
        product_ids = []
        if data.get("applicableProducts"):
            product_ids = [
                p.get("productId") or p.get("id", "")
                for p in data.get("applicableProducts", [])
            ]

        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            type=data.get("type", "PERCENTAGE"),
            apply_to=data.get("applyTo", "ALL_PRODUCTS"),
            discount_value=float(data.get("discountValue", 0)),
            discount_type=data.get("discountType", "PERCENTAGE"),
            buy_quantity=int(data.get("buyQuantity", 1)),
            get_quantity=int(data.get("getQuantity", 1)),
            category_ids=data.get("categoryIds", []) or [],
            brand_ids=data.get("brandIds", []) or [],
            product_ids=product_ids,
            badge_color=data.get("badgeColor"),
            is_active=data.get("isActive", True),
        )

    def get_badge_text(self) -> str:
        """
        Genera el texto del badge segun el tipo de promocion.

        Returns:
            Texto formateado para mostrar en el badge
        """
        if self.type == "PERCENTAGE":
            return f"-{int(self.discount_value)}%"
        elif self.type == "FIXED_AMOUNT":
            return f"-${int(self.discount_value)}"
        elif self.type == "BUY_X_GET_Y":
            return f"{self.buy_quantity}x{self.get_quantity}"
        elif self.type == "SECOND_UNIT_DISCOUNT":
            return f"2da -{int(self.discount_value)}%"
        elif self.type == "FLASH_SALE":
            return f"-{int(self.discount_value)}%"
        else:
            return "Promo"

    def applies_to_product(
        self,
        product_id: str,
        category_id: Optional[str] = None,
        brand_id: Optional[str] = None,
    ) -> bool:
        """
        Verifica si la promocion aplica a un producto.

        Args:
            product_id: ID del producto
            category_id: ID de la categoria del producto
            brand_id: ID de la marca del producto

        Returns:
            True si la promocion aplica al producto
        """
        if not self.is_active:
            return False

        if self.apply_to == "ALL_PRODUCTS":
            return True

        if self.apply_to == "SPECIFIC_PRODUCTS":
            return product_id in self.product_ids

        if self.apply_to == "CATEGORIES":
            return category_id is not None and category_id in self.category_ids

        if self.apply_to == "BRANDS":
            return brand_id is not None and brand_id in self.brand_ids

        return False


@dataclass
class AppliedPromotionData:
    """Datos de una promocion aplicada a un item."""

    id: str
    name: str
    type: str
    discount: float

    @classmethod
    def from_dict(cls, data: dict) -> "AppliedPromotionData":
        """Crea AppliedPromotionData desde diccionario."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            type=data.get("type", ""),
            discount=float(data.get("discount", 0)),
        )


@dataclass
class CalculatedItemData:
    """
    Resultado del calculo de promocion para un item.

    Attributes:
        product_id: ID del producto
        discount: Descuento total aplicado al item
        promotion: Promocion principal aplicada
        promotions: Lista de todas las promociones aplicadas
    """

    product_id: str
    discount: float = 0.0
    promotion: Optional[AppliedPromotionData] = None
    promotions: List[AppliedPromotionData] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "CalculatedItemData":
        """Crea CalculatedItemData desde diccionario de la API."""
        promotion = None
        if data.get("promotion"):
            promotion = AppliedPromotionData.from_dict(data["promotion"])

        promotions = []
        if data.get("promotions"):
            promotions = [
                AppliedPromotionData.from_dict(p)
                for p in data.get("promotions", [])
            ]
        elif promotion:
            # Fallback: usar la promocion principal
            promotions = [promotion]

        return cls(
            product_id=data.get("productId", ""),
            discount=float(data.get("discount", 0)),
            promotion=promotion,
            promotions=promotions,
        )


@dataclass
class CalculationResult:
    """
    Resultado del calculo de promociones para el carrito.

    Attributes:
        items: Lista de items con descuentos calculados
        total_discount: Descuento total del carrito
    """

    items: List[CalculatedItemData] = field(default_factory=list)
    total_discount: float = 0.0

    @classmethod
    def from_dict(cls, data: dict) -> "CalculationResult":
        """Crea CalculationResult desde diccionario de la API."""
        items = [
            CalculatedItemData.from_dict(item)
            for item in data.get("items", [])
        ]
        return cls(
            items=items,
            total_discount=float(data.get("totalDiscount", 0)),
        )


class PromotionsAPI:
    """
    API de promociones.

    Maneja la obtencion de promociones activas y el calculo de descuentos.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de promociones.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def get_active(self) -> List[PromotionData]:
        """
        Obtiene las promociones activas.

        Llama a GET /api/promotions/active para obtener todas las
        promociones vigentes.

        Returns:
            Lista de promociones activas
        """
        try:
            response = self.client.get("/api/promotions/active")

            if response.success and response.data:
                promotions = [PromotionData.from_dict(p) for p in response.data]
                logger.debug(f"Promociones activas obtenidas: {len(promotions)}")
                return promotions

        except Exception as e:
            logger.error(f"Error obteniendo promociones activas: {e}")

        return []

    def calculate(
        self,
        items: List[Dict[str, Any]],
        customer_id: Optional[str] = None,
    ) -> Optional[CalculationResult]:
        """
        Calcula las promociones para los items del carrito.

        Llama a POST /api/promotions/calculate con los items del carrito
        y retorna los descuentos aplicables.

        Args:
            items: Lista de items con formato:
                [{"productId": str, "quantity": int, "unitPrice": float}, ...]
            customer_id: ID del cliente (opcional, para promos personalizadas)

        Returns:
            CalculationResult con los descuentos calculados, o None si hay error
        """
        if not items:
            return CalculationResult()

        try:
            # Formatear items para la API
            formatted_items = [
                {
                    "productId": item.get("productId") or item.get("product_id"),
                    "quantity": item.get("quantity", 1),
                    "unitPrice": item.get("unitPrice") or item.get("unit_price", 0),
                }
                for item in items
            ]

            payload: Dict[str, Any] = {"items": formatted_items}
            if customer_id:
                payload["customerId"] = customer_id

            response = self.client.post("/api/promotions/calculate", data=payload)

            if response.success and response.data:
                result = CalculationResult.from_dict(response.data)
                logger.debug(
                    f"Promociones calculadas: {len(result.items)} items, "
                    f"descuento total: ${result.total_discount:.2f}"
                )
                return result

        except Exception as e:
            logger.error(f"Error calculando promociones: {e}")

        return None

    def get_promotion_for_product(
        self,
        promotions: List[PromotionData],
        product_id: str,
        category_id: Optional[str] = None,
        brand_id: Optional[str] = None,
    ) -> Optional[PromotionData]:
        """
        Busca la primera promocion aplicable a un producto.

        Args:
            promotions: Lista de promociones activas
            product_id: ID del producto
            category_id: ID de la categoria del producto
            brand_id: ID de la marca del producto

        Returns:
            PromotionData si hay promocion aplicable, None si no
        """
        for promo in promotions:
            if promo.applies_to_product(product_id, category_id, brand_id):
                return promo
        return None
