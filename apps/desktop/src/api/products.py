"""
API de productos.

Maneja la obtencion de productos, categorias y marcas desde el backend.
"""

from typing import Optional, List
from dataclasses import dataclass, field

from loguru import logger

from .client import APIClient, get_api_client, APIResponse


@dataclass
class ProductData:
    """Datos de un producto."""

    id: str
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    internal_code: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    base_price: float = 0.0
    base_cost: Optional[float] = None
    tax_rate: float = 21.0
    tax_included: bool = True
    track_stock: bool = False
    current_stock: int = 0
    unit: str = "UN"
    image_url: Optional[str] = None
    is_active: bool = True
    cianbox_id: Optional[int] = None
    # Productos variables (curva de talles)
    is_parent: bool = False
    parent_product_id: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "ProductData":
        """Crea ProductData desde diccionario de la API."""
        category = data.get("category") or {}
        brand = data.get("brand") or {}

        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            sku=data.get("sku"),
            barcode=data.get("barcode"),
            internal_code=data.get("internalCode"),
            short_name=data.get("shortName"),
            description=data.get("description"),
            category_id=category.get("id") or data.get("categoryId"),
            category_name=category.get("name"),
            brand_id=brand.get("id") or data.get("brandId"),
            brand_name=brand.get("name"),
            base_price=float(data.get("basePrice", 0)),
            base_cost=float(data.get("baseCost")) if data.get("baseCost") else None,
            tax_rate=float(data.get("taxRate", 21)),
            tax_included=data.get("taxIncluded", True),
            track_stock=data.get("trackStock", False),
            current_stock=int(data.get("currentStock", 0)),
            unit=data.get("unit", "UN"),
            image_url=data.get("imageUrl"),
            is_active=data.get("isActive", True),
            cianbox_id=data.get("cianboxProductId"),
            # Productos variables
            is_parent=data.get("isParent", False),
            parent_product_id=data.get("parentProductId"),
            size=data.get("size"),
            color=data.get("color"),
        )


@dataclass
class CategoryData:
    """Datos de una categoria."""

    id: str
    name: str
    code: Optional[str] = None
    parent_id: Optional[str] = None
    is_quick_access: bool = False
    quick_access_order: int = 0
    quick_access_color: Optional[str] = None
    is_active: bool = True
    cianbox_id: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict) -> "CategoryData":
        """Crea CategoryData desde diccionario de la API."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            code=data.get("code"),
            parent_id=data.get("parentId"),
            is_quick_access=data.get("isQuickAccess", False),
            quick_access_order=data.get("quickAccessOrder", 0),
            quick_access_color=data.get("quickAccessColor"),
            is_active=data.get("isActive", True),
            cianbox_id=data.get("cianboxCategoryId"),
        )


@dataclass
class BrandData:
    """Datos de una marca."""

    id: str
    name: str
    code: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True
    cianbox_id: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict) -> "BrandData":
        """Crea BrandData desde diccionario de la API."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            code=data.get("code"),
            logo_url=data.get("logoUrl"),
            is_active=data.get("isActive", True),
            cianbox_id=data.get("cianboxBrandId"),
        )


@dataclass
class PaginationData:
    """Datos de paginacion."""

    page: int = 1
    page_size: int = 50
    total: int = 0
    total_pages: int = 1

    @classmethod
    def from_dict(cls, data: dict) -> "PaginationData":
        """Crea PaginationData desde diccionario."""
        return cls(
            page=data.get("page", 1),
            page_size=data.get("pageSize", 50),
            total=data.get("total", 0),
            total_pages=data.get("totalPages", 1),
        )


class ProductsAPI:
    """
    API de productos.

    Maneja la obtencion de productos, categorias y marcas.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de productos.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def search(
        self,
        query: str,
        category_id: Optional[str] = None,
        brand_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[ProductData], Optional[PaginationData]]:
        """
        Busca productos por texto.

        Args:
            query: Texto de busqueda
            category_id: Filtrar por categoria
            brand_id: Filtrar por marca
            page: Pagina
            page_size: Tamano de pagina

        Returns:
            Tupla de (lista de productos, datos de paginacion)
        """
        params = {
            "search": query,
            "page": page,
            "pageSize": page_size,
            "isActive": True,
        }

        if category_id:
            params["categoryId"] = category_id
        if brand_id:
            params["brandId"] = brand_id

        try:
            response = self.client.get("/api/products", params=params)

            if response.success and response.data:
                products = [ProductData.from_dict(p) for p in response.data]
                pagination = (
                    PaginationData.from_dict(response.pagination)
                    if response.pagination
                    else None
                )
                return products, pagination

        except Exception as e:
            logger.error(f"Error buscando productos: {e}")

        return [], None

    def get_by_barcode(self, barcode: str) -> Optional[ProductData]:
        """
        Obtiene un producto por codigo de barras.

        Args:
            barcode: Codigo de barras

        Returns:
            ProductData o None
        """
        try:
            response = self.client.get(f"/api/products/barcode/{barcode}")

            if response.success and response.data:
                return ProductData.from_dict(response.data)

        except Exception as e:
            logger.warning(f"Producto no encontrado (barcode={barcode}): {e}")

        return None

    def get_by_id(self, product_id: str) -> Optional[ProductData]:
        """
        Obtiene un producto por ID.

        Args:
            product_id: ID del producto

        Returns:
            ProductData o None
        """
        try:
            response = self.client.get(f"/api/products/{product_id}")

            if response.success and response.data:
                return ProductData.from_dict(response.data)

        except Exception as e:
            logger.warning(f"Producto no encontrado (id={product_id}): {e}")

        return None

    def get_all(
        self,
        page: int = 1,
        page_size: int = 100,
        category_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> tuple[List[ProductData], Optional[PaginationData]]:
        """
        Obtiene todos los productos (paginado).

        Args:
            page: Pagina
            page_size: Tamano de pagina
            category_id: Filtrar por categoria
            branch_id: ID de sucursal para obtener stock

        Returns:
            Tupla de (lista de productos, datos de paginacion)
        """
        params = {
            "page": page,
            "pageSize": page_size,
            "isActive": True,
        }

        if category_id:
            params["categoryId"] = category_id

        if branch_id:
            params["branchId"] = branch_id

        try:
            response = self.client.get("/api/products", params=params)

            if response.success and response.data:
                products = [ProductData.from_dict(p) for p in response.data]
                pagination = (
                    PaginationData.from_dict(response.pagination)
                    if response.pagination
                    else None
                )
                return products, pagination

        except Exception as e:
            logger.error(f"Error obteniendo productos: {e}")

        return [], None

    def get_categories(self) -> List[CategoryData]:
        """
        Obtiene todas las categorias.

        Returns:
            Lista de categorias
        """
        try:
            response = self.client.get("/api/products/categories")

            if response.success and response.data:
                return [CategoryData.from_dict(c) for c in response.data]

        except Exception as e:
            logger.error(f"Error obteniendo categorias: {e}")

        return []

    def get_quick_access_categories(self) -> List[CategoryData]:
        """
        Obtiene las categorias de acceso rapido.

        Returns:
            Lista de categorias ordenadas
        """
        try:
            response = self.client.get("/api/products/categories/quick-access")

            if response.success and response.data:
                categories = [CategoryData.from_dict(c) for c in response.data]
                return sorted(categories, key=lambda c: c.quick_access_order)

        except Exception as e:
            logger.error(f"Error obteniendo categorias rapidas: {e}")

        return []

    def get_brands(self) -> List[BrandData]:
        """
        Obtiene todas las marcas.

        Returns:
            Lista de marcas
        """
        try:
            response = self.client.get("/api/products/brands")

            if response.success and response.data:
                return [BrandData.from_dict(b) for b in response.data]

        except Exception as e:
            logger.error(f"Error obteniendo marcas: {e}")

        return []

    def get_size_curve(
        self,
        product_id: str,
        branch_id: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Obtiene la curva de talles de un producto padre.

        Args:
            product_id: ID del producto padre
            branch_id: ID de sucursal para obtener stock

        Returns:
            Diccionario con la curva de talles o None
        """
        try:
            params = {}
            if branch_id:
                params["branchId"] = branch_id

            response = self.client.get(
                f"/api/backoffice/products/{product_id}/size-curve",
                params=params,
            )

            if response.success and response.data:
                return response.data

        except Exception as e:
            logger.error(f"Error obteniendo curva de talles: {e}")

        return None
