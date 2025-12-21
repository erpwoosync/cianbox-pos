"""
Repositorio de productos.

Proporciona acceso a productos, categorias y marcas
con metodos de busqueda optimizados.
"""

from typing import List, Optional

from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session, joinedload

from .base import BaseRepository
from src.models import Product, Category, Brand


class ProductRepository(BaseRepository[Product]):
    """
    Repositorio para operaciones con productos.

    Extiende BaseRepository con metodos especificos
    para busqueda y filtrado de productos.
    """

    def __init__(self, session: Session):
        super().__init__(session, Product)

    def search(
        self,
        tenant_id: str,
        query: str,
        limit: int = 50,
        category_id: str = None,
        brand_id: str = None,
        only_active: bool = True,
        exclude_variants: bool = True,
    ) -> List[Product]:
        """
        Busca productos por texto.

        Busca en nombre, SKU, codigo de barras y codigo interno.
        Si hay coincidencia exacta de codigo de barras/SKU, incluye variantes.

        Args:
            tenant_id: ID del tenant
            query: Texto de busqueda
            limit: Limite de resultados
            category_id: Filtrar por categoria
            brand_id: Filtrar por marca
            only_active: Solo productos activos
            exclude_variants: Excluir variantes (mostrar solo padres y simples)

        Returns:
            Lista de productos que coinciden
        """
        # Primero buscar coincidencia exacta de codigo de barras o SKU (incluye variantes)
        exact_stmt = (
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(
                or_(
                    Product.barcode == query,
                    Product.sku == query,
                    Product.internal_code == query,
                )
            )
        )
        if only_active:
            exact_stmt = exact_stmt.where(Product.is_active == True)

        exact_result = self.session.execute(exact_stmt)
        exact_match = exact_result.scalar_one_or_none()

        if exact_match:
            # Coincidencia exacta encontrada (puede ser variante)
            return [exact_match]

        # Si no hay coincidencia exacta, buscar por texto
        search_term = f"%{query}%"

        if exclude_variants:
            # Buscar en productos padre/simples
            stmt = (
                select(Product)
                .where(Product.tenant_id == tenant_id)
                .where(Product.parent_product_id == None)
                .where(
                    or_(
                        Product.name.ilike(search_term),
                        Product.sku.ilike(search_term),
                        Product.barcode.ilike(search_term),
                        Product.internal_code.ilike(search_term),
                    )
                )
            )

            if only_active:
                stmt = stmt.where(Product.is_active == True)
            if category_id:
                stmt = stmt.where(Product.category_id == category_id)
            if brand_id:
                stmt = stmt.where(Product.brand_id == brand_id)

            stmt = stmt.limit(limit)
            result = self.session.execute(stmt)
            products = list(result.scalars().all())

            # Si no hay resultados, buscar en variantes y retornar sus padres
            if not products:
                variant_stmt = (
                    select(Product)
                    .where(Product.tenant_id == tenant_id)
                    .where(Product.parent_product_id != None)
                    .where(
                        or_(
                            Product.name.ilike(search_term),
                            Product.sku.ilike(search_term),
                            Product.barcode.ilike(search_term),
                            Product.internal_code.ilike(search_term),
                            Product.color.ilike(search_term),
                            Product.size.ilike(search_term),
                        )
                    )
                )
                if only_active:
                    variant_stmt = variant_stmt.where(Product.is_active == True)

                variant_stmt = variant_stmt.limit(limit)
                variant_result = self.session.execute(variant_stmt)
                variants = list(variant_result.scalars().all())

                # Obtener los padres únicos de las variantes encontradas
                parent_ids = list(set(v.parent_product_id for v in variants if v.parent_product_id))
                if parent_ids:
                    parent_stmt = (
                        select(Product)
                        .where(Product.id.in_(parent_ids))
                    )
                    if only_active:
                        parent_stmt = parent_stmt.where(Product.is_active == True)
                    parent_result = self.session.execute(parent_stmt)
                    products = list(parent_result.scalars().all())

            return products
        else:
            # Buscar sin excluir variantes
            stmt = (
                select(Product)
                .where(Product.tenant_id == tenant_id)
                .where(
                    or_(
                        Product.name.ilike(search_term),
                        Product.sku.ilike(search_term),
                        Product.barcode.ilike(search_term),
                        Product.internal_code.ilike(search_term),
                    )
                )
            )

            if only_active:
                stmt = stmt.where(Product.is_active == True)
            if category_id:
                stmt = stmt.where(Product.category_id == category_id)
            if brand_id:
                stmt = stmt.where(Product.brand_id == brand_id)

            stmt = stmt.limit(limit)
            result = self.session.execute(stmt)
            return list(result.scalars().all())

    def get_by_barcode(
        self,
        tenant_id: str,
        barcode: str,
    ) -> Optional[Product]:
        """
        Obtiene un producto por codigo de barras.

        Args:
            tenant_id: ID del tenant
            barcode: Codigo de barras

        Returns:
            Producto o None
        """
        stmt = (
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(Product.barcode == barcode)
            .where(Product.is_active == True)
        )

        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_sku(
        self,
        tenant_id: str,
        sku: str,
    ) -> Optional[Product]:
        """
        Obtiene un producto por SKU.

        Args:
            tenant_id: ID del tenant
            sku: SKU del producto

        Returns:
            Producto o None
        """
        stmt = (
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(Product.sku == sku)
            .where(Product.is_active == True)
        )

        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_category(
        self,
        tenant_id: str,
        category_id: str,
        limit: int = 50,
        offset: int = 0,
        exclude_variants: bool = True,
    ) -> List[Product]:
        """
        Obtiene productos de una categoria.

        Args:
            tenant_id: ID del tenant
            category_id: ID de la categoria
            limit: Limite de resultados
            offset: Desplazamiento
            exclude_variants: Excluir variantes (mostrar solo padres y simples)

        Returns:
            Lista de productos
        """
        stmt = (
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(Product.category_id == category_id)
            .where(Product.is_active == True)
        )

        # Excluir variantes
        if exclude_variants:
            stmt = stmt.where(Product.parent_product_id == None)

        stmt = stmt.order_by(Product.name).offset(offset).limit(limit)

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def get_active_products(
        self,
        tenant_id: str,
        limit: int = 100,
        offset: int = 0,
        exclude_variants: bool = True,
    ) -> List[Product]:
        """
        Obtiene productos activos.

        Args:
            tenant_id: ID del tenant
            limit: Limite de resultados
            offset: Desplazamiento
            exclude_variants: Excluir variantes (mostrar solo padres y simples)

        Returns:
            Lista de productos activos
        """
        stmt = (
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(Product.is_active == True)
        )

        # Excluir variantes
        if exclude_variants:
            stmt = stmt.where(Product.parent_product_id == None)

        stmt = stmt.order_by(Product.name).offset(offset).limit(limit)

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def get_with_relations(self, product_id: str) -> Optional[Product]:
        """
        Obtiene un producto con sus relaciones cargadas.

        Args:
            product_id: ID del producto

        Returns:
            Producto con categoria, marca y precios
        """
        stmt = (
            select(Product)
            .options(
                joinedload(Product.category),
                joinedload(Product.brand),
                joinedload(Product.prices),
            )
            .where(Product.id == product_id)
        )

        result = self.session.execute(stmt)
        return result.unique().scalar_one_or_none()


class CategoryRepository(BaseRepository[Category]):
    """
    Repositorio para operaciones con categorias.
    """

    def __init__(self, session: Session):
        super().__init__(session, Category)

    def get_root_categories(
        self,
        tenant_id: str,
        only_active: bool = True,
    ) -> List[Category]:
        """
        Obtiene categorias raiz (sin padre).

        Args:
            tenant_id: ID del tenant
            only_active: Solo categorias activas

        Returns:
            Lista de categorias raiz
        """
        stmt = (
            select(Category)
            .where(Category.tenant_id == tenant_id)
            .where(Category.parent_id == None)
            .order_by(Category.name)
        )

        if only_active:
            stmt = stmt.where(Category.is_active == True)

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def get_quick_access_categories(
        self,
        tenant_id: str,
    ) -> List[Category]:
        """
        Obtiene categorias de acceso rapido.

        Args:
            tenant_id: ID del tenant

        Returns:
            Lista de categorias ordenadas por quick_access_order
        """
        stmt = (
            select(Category)
            .where(Category.tenant_id == tenant_id)
            .where(Category.is_quick_access == True)
            .where(Category.is_active == True)
            .order_by(Category.quick_access_order)
        )

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def get_children(
        self,
        tenant_id: str,
        parent_id: str,
    ) -> List[Category]:
        """
        Obtiene subcategorias.

        Args:
            tenant_id: ID del tenant
            parent_id: ID de la categoria padre

        Returns:
            Lista de subcategorias
        """
        stmt = (
            select(Category)
            .where(Category.tenant_id == tenant_id)
            .where(Category.parent_id == parent_id)
            .where(Category.is_active == True)
            .order_by(Category.name)
        )

        result = self.session.execute(stmt)
        return list(result.scalars().all())


class BrandRepository(BaseRepository[Brand]):
    """
    Repositorio para operaciones con marcas.
    """

    def __init__(self, session: Session):
        super().__init__(session, Brand)

    def get_active_brands(
        self,
        tenant_id: str,
    ) -> List[Brand]:
        """
        Obtiene todas las marcas activas.

        Args:
            tenant_id: ID del tenant

        Returns:
            Lista de marcas activas ordenadas por nombre
        """
        stmt = (
            select(Brand)
            .where(Brand.tenant_id == tenant_id)
            .where(Brand.is_active == True)
            .order_by(Brand.name)
        )

        result = self.session.execute(stmt)
        return list(result.scalars().all())
