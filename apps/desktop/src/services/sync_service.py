"""
Servicio de sincronizacion de datos.

Sincroniza productos, categorias, marcas y promociones desde el backend a SQLite local.
Permite operacion offline usando datos cacheados localmente.
"""

from datetime import datetime
from typing import List, Optional, Callable, Tuple, Dict, Any
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum
import threading
import uuid

from loguru import logger
from sqlalchemy.orm import Session

from src.api import get_api_client, NetworkError
from src.api.products import ProductsAPI, ProductData, CategoryData, BrandData
from src.api.promotions import PromotionsAPI, PromotionData, CalculationResult
from src.api.customers import CustomersAPI, CustomerData
from src.db import session_scope, get_session
from src.models import Product, Category, Brand, Customer


class SyncStatus(Enum):
    """Estado de sincronizacion."""
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    ERROR = "error"
    OFFLINE = "offline"


@dataclass
class SyncResult:
    """Resultado de una sincronizacion."""
    status: SyncStatus
    products_synced: int = 0
    categories_synced: int = 0
    brands_synced: int = 0
    promotions_synced: int = 0
    customers_synced: int = 0
    error_message: Optional[str] = None
    duration_seconds: float = 0.0


class SyncService:
    """
    Servicio de sincronizacion de datos.

    Sincroniza productos, categorias y marcas desde el backend
    a la base de datos local SQLite para operacion offline.

    Attributes:
        tenant_id: ID del tenant actual
        status: Estado actual de sincronizacion
        last_sync: Fecha de ultima sincronizacion exitosa
    """

    def __init__(self, tenant_id: str, branch_id: Optional[str] = None):
        """
        Inicializa el servicio de sincronizacion.

        Args:
            tenant_id: ID del tenant a sincronizar
            branch_id: ID de la sucursal para obtener stock
        """
        self.tenant_id = tenant_id
        self.branch_id = branch_id
        self.status = SyncStatus.IDLE
        self.last_sync: Optional[datetime] = None
        self.last_result: Optional[SyncResult] = None

        self._api = ProductsAPI()
        self._promotions_api = PromotionsAPI()
        self._customers_api = CustomersAPI()
        self._lock = threading.Lock()
        self._on_progress: Optional[Callable[[str, int, int], None]] = None
        self._on_complete: Optional[Callable[[SyncResult], None]] = None

        # Cache de promociones en memoria
        self._active_promotions: List[PromotionData] = []
        self._promotions_last_sync: Optional[datetime] = None

        logger.info(f"SyncService inicializado para tenant: {tenant_id}, branch: {branch_id}")

    def set_callbacks(
        self,
        on_progress: Optional[Callable[[str, int, int], None]] = None,
        on_complete: Optional[Callable[[SyncResult], None]] = None,
    ) -> None:
        """
        Establece callbacks para notificaciones de sincronizacion.

        Args:
            on_progress: Callback (mensaje, actual, total) para progreso
            on_complete: Callback (result) al completar
        """
        self._on_progress = on_progress
        self._on_complete = on_complete

    def _notify_progress(self, message: str, current: int = 0, total: int = 0) -> None:
        """Notifica progreso de sincronizacion."""
        if self._on_progress:
            try:
                self._on_progress(message, current, total)
            except Exception as e:
                logger.warning(f"Error en callback de progreso: {e}")

    def _notify_complete(self, result: SyncResult) -> None:
        """Notifica finalizacion de sincronizacion."""
        if self._on_complete:
            try:
                self._on_complete(result)
            except Exception as e:
                logger.warning(f"Error en callback de completion: {e}")

    def sync_all(self) -> SyncResult:
        """
        Sincroniza todos los datos (categorias, marcas, productos, promociones).

        Esta es la sincronizacion completa que debe ejecutarse al iniciar
        la aplicacion o cuando el usuario lo solicite.

        Returns:
            SyncResult con el resultado de la sincronizacion
        """
        with self._lock:
            if self.status == SyncStatus.SYNCING:
                logger.warning("Ya hay una sincronizacion en progreso")
                return SyncResult(
                    status=SyncStatus.ERROR,
                    error_message="Sincronizacion en progreso"
                )

            self.status = SyncStatus.SYNCING

        start_time = datetime.now()
        result = SyncResult(status=SyncStatus.SYNCING)

        try:
            self._notify_progress("Sincronizando categorias...", 0, 5)

            # 1. Sincronizar categorias
            categories_count = self._sync_categories()
            result.categories_synced = categories_count
            logger.info(f"Categorias sincronizadas: {categories_count}")

            self._notify_progress("Sincronizando marcas...", 1, 5)

            # 2. Sincronizar marcas
            brands_count = self._sync_brands()
            result.brands_synced = brands_count
            logger.info(f"Marcas sincronizadas: {brands_count}")

            self._notify_progress("Sincronizando productos...", 2, 5)

            # 3. Sincronizar productos
            products_count = self._sync_products()
            result.products_synced = products_count
            logger.info(f"Productos sincronizados: {products_count}")

            self._notify_progress("Sincronizando promociones...", 3, 5)

            # 4. Sincronizar promociones
            promotions_count = self._sync_promotions()
            result.promotions_synced = promotions_count
            logger.info(f"Promociones sincronizadas: {promotions_count}")

            self._notify_progress("Sincronizando clientes...", 4, 5)

            # 5. Sincronizar clientes
            customers_count = self._sync_customers()
            result.customers_synced = customers_count
            logger.info(f"Clientes sincronizados: {customers_count}")

            # Calcular duracion
            duration = (datetime.now() - start_time).total_seconds()
            result.duration_seconds = duration
            result.status = SyncStatus.SUCCESS

            self.last_sync = datetime.now()
            self.last_result = result
            self.status = SyncStatus.SUCCESS

            logger.info(
                f"Sincronizacion completada en {duration:.1f}s: "
                f"{categories_count} categorias, {brands_count} marcas, "
                f"{products_count} productos, {promotions_count} promociones, "
                f"{customers_count} clientes"
            )

            self._notify_progress("Sincronizacion completada", 5, 5)
            self._notify_complete(result)

            return result

        except NetworkError as e:
            logger.warning(f"Error de red durante sincronizacion: {e}")
            result.status = SyncStatus.OFFLINE
            result.error_message = "Sin conexion a internet"
            self.status = SyncStatus.OFFLINE

        except Exception as e:
            logger.error(f"Error durante sincronizacion: {e}")
            result.status = SyncStatus.ERROR
            result.error_message = str(e)
            self.status = SyncStatus.ERROR

        result.duration_seconds = (datetime.now() - start_time).total_seconds()
        self.last_result = result
        self._notify_complete(result)

        return result

    def sync_all_async(self) -> threading.Thread:
        """
        Ejecuta sincronizacion completa en un thread separado.

        Returns:
            Thread de sincronizacion (ya iniciado)
        """
        thread = threading.Thread(target=self.sync_all, daemon=True)
        thread.start()
        return thread

    def _sync_categories(self) -> int:
        """
        Sincroniza categorias desde el backend.

        Returns:
            Numero de categorias sincronizadas
        """
        categories = self._api.get_categories()

        if not categories:
            logger.debug("No se obtuvieron categorias de la API")
            return 0

        synced = 0

        with session_scope() as session:
            for cat_data in categories:
                try:
                    self._upsert_category(session, cat_data)
                    synced += 1
                except Exception as e:
                    logger.error(f"Error sincronizando categoria {cat_data.id}: {e}")

        return synced

    def _upsert_category(self, session: Session, data: CategoryData) -> Category:
        """
        Inserta o actualiza una categoria.

        Args:
            session: Sesion de base de datos
            data: Datos de la categoria desde API

        Returns:
            Categoria creada o actualizada
        """
        category = session.query(Category).filter_by(id=data.id).first()

        if category:
            # Actualizar existente
            category.name = data.name
            category.code = data.code
            category.parent_id = data.parent_id
            category.is_quick_access = data.is_quick_access
            category.quick_access_order = data.quick_access_order
            category.quick_access_color = data.quick_access_color
            category.is_active = data.is_active
            category.cianbox_id = data.cianbox_id
            category.last_synced_at = datetime.now()
        else:
            # Crear nueva
            category = Category(
                id=data.id,
                tenant_id=self.tenant_id,
                name=data.name,
                code=data.code,
                parent_id=data.parent_id,
                is_quick_access=data.is_quick_access,
                quick_access_order=data.quick_access_order,
                quick_access_color=data.quick_access_color,
                is_active=data.is_active,
                cianbox_id=data.cianbox_id,
                last_synced_at=datetime.now(),
            )
            session.add(category)

        return category

    def _sync_brands(self) -> int:
        """
        Sincroniza marcas desde el backend.

        Returns:
            Numero de marcas sincronizadas
        """
        brands = self._api.get_brands()

        if not brands:
            logger.debug("No se obtuvieron marcas de la API")
            return 0

        synced = 0

        with session_scope() as session:
            for brand_data in brands:
                try:
                    self._upsert_brand(session, brand_data)
                    synced += 1
                except Exception as e:
                    logger.error(f"Error sincronizando marca {brand_data.id}: {e}")

        return synced

    def _upsert_brand(self, session: Session, data: BrandData) -> Brand:
        """
        Inserta o actualiza una marca.

        Args:
            session: Sesion de base de datos
            data: Datos de la marca desde API

        Returns:
            Marca creada o actualizada
        """
        brand = session.query(Brand).filter_by(id=data.id).first()

        if brand:
            # Actualizar existente
            brand.name = data.name
            brand.code = data.code
            brand.logo_url = data.logo_url
            brand.is_active = data.is_active
            brand.cianbox_id = data.cianbox_id
            brand.last_synced_at = datetime.now()
        else:
            # Crear nueva
            brand = Brand(
                id=data.id,
                tenant_id=self.tenant_id,
                name=data.name,
                code=data.code,
                logo_url=data.logo_url,
                is_active=data.is_active,
                cianbox_id=data.cianbox_id,
                last_synced_at=datetime.now(),
            )
            session.add(brand)

        return brand

    def _sync_products(self) -> int:
        """
        Sincroniza productos desde el backend.

        Obtiene todos los productos paginados y los guarda localmente.
        Si hay branch_id configurado, obtiene el stock de esa sucursal.

        Returns:
            Numero de productos sincronizados
        """
        synced = 0
        page = 1
        page_size = 100
        has_more = True

        while has_more:
            products, pagination = self._api.get_all(
                page=page,
                page_size=page_size,
                branch_id=self.branch_id,
            )

            if not products:
                break

            with session_scope() as session:
                for product_data in products:
                    try:
                        self._upsert_product(session, product_data)
                        synced += 1
                    except Exception as e:
                        logger.error(f"Error sincronizando producto {product_data.id}: {e}")

            # Verificar si hay mas paginas
            if pagination:
                has_more = page < pagination.total_pages
                page += 1
                self._notify_progress(
                    f"Sincronizando productos... ({synced}/{pagination.total})",
                    synced,
                    pagination.total,
                )
            else:
                has_more = False

        return synced

    def _upsert_product(self, session: Session, data: ProductData) -> Product:
        """
        Inserta o actualiza un producto.

        Args:
            session: Sesion de base de datos
            data: Datos del producto desde API

        Returns:
            Producto creado o actualizado
        """
        product = session.query(Product).filter_by(id=data.id).first()

        if product:
            # Actualizar existente
            product.name = data.name
            product.sku = data.sku
            product.barcode = data.barcode
            product.internal_code = data.internal_code
            product.short_name = data.short_name
            product.description = data.description
            product.category_id = data.category_id
            product.brand_id = data.brand_id
            product.base_price = Decimal(str(data.base_price))
            product.base_cost = Decimal(str(data.base_cost)) if data.base_cost else None
            product.tax_rate = Decimal(str(data.tax_rate))
            product.tax_included = data.tax_included
            product.track_stock = data.track_stock
            product.current_stock = data.current_stock
            product.unit = data.unit
            product.image_url = data.image_url
            product.is_active = data.is_active
            product.cianbox_id = data.cianbox_id
            # Productos variables
            product.is_parent = data.is_parent
            product.parent_product_id = data.parent_product_id
            product.size = data.size
            product.color = data.color
            product.last_synced_at = datetime.now()
        else:
            # Crear nuevo
            product = Product(
                id=data.id,
                tenant_id=self.tenant_id,
                name=data.name,
                sku=data.sku,
                barcode=data.barcode,
                internal_code=data.internal_code,
                short_name=data.short_name,
                description=data.description,
                category_id=data.category_id,
                brand_id=data.brand_id,
                base_price=Decimal(str(data.base_price)),
                base_cost=Decimal(str(data.base_cost)) if data.base_cost else None,
                tax_rate=Decimal(str(data.tax_rate)),
                tax_included=data.tax_included,
                track_stock=data.track_stock,
                current_stock=data.current_stock,
                unit=data.unit,
                image_url=data.image_url,
                is_active=data.is_active,
                cianbox_id=data.cianbox_id,
                # Productos variables
                is_parent=data.is_parent,
                parent_product_id=data.parent_product_id,
                size=data.size,
                color=data.color,
                last_synced_at=datetime.now(),
            )
            session.add(product)

        return product

    def get_local_products(
        self,
        search: Optional[str] = None,
        category_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Product]:
        """
        Obtiene productos desde la base de datos local.

        Args:
            search: Texto de busqueda (nombre, SKU, codigo de barras)
            category_id: Filtrar por categoria
            limit: Limite de resultados

        Returns:
            Lista de productos
        """
        from src.repositories.product_repository import ProductRepository

        with session_scope() as session:
            repo = ProductRepository(session)

            if search:
                products = repo.search(
                    tenant_id=self.tenant_id,
                    query=search,
                    limit=limit,
                    category_id=category_id,
                )
            elif category_id:
                products = repo.get_by_category(
                    tenant_id=self.tenant_id,
                    category_id=category_id,
                    limit=limit,
                )
            else:
                products = repo.get_active_products(
                    tenant_id=self.tenant_id,
                    limit=limit,
                )

            # Detach de session para usar fuera del context
            session.expunge_all()
            return products

    def get_variants_by_parent(self, parent_product_id: str) -> List[Dict[str, Any]]:
        """
        Obtiene todas las variantes de un producto padre.

        Args:
            parent_product_id: ID del producto padre

        Returns:
            Lista de diccionarios con datos de variantes
        """
        with session_scope() as session:
            products = session.query(Product).filter(
                Product.tenant_id == self.tenant_id,
                Product.parent_product_id == parent_product_id,
                Product.is_active == True,
            ).order_by(Product.size, Product.color).all()

            variants = []
            for p in products:
                variants.append({
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "barcode": p.barcode,
                    "size": p.size,
                    "color": p.color,
                    "stock": p.current_stock,
                    "price": float(p.base_price) if p.base_price else 0.0,
                })

            return variants

    def get_local_categories(self) -> List[Category]:
        """
        Obtiene categorias desde la base de datos local.

        Returns:
            Lista de categorias activas
        """
        from src.repositories.product_repository import CategoryRepository

        with session_scope() as session:
            repo = CategoryRepository(session)
            categories = repo.get_root_categories(
                tenant_id=self.tenant_id,
                only_active=True,
            )
            session.expunge_all()
            return categories

    def get_quick_access_categories(self) -> List[Category]:
        """
        Obtiene categorias de acceso rapido.

        Returns:
            Lista de categorias quick access ordenadas
        """
        from src.repositories.product_repository import CategoryRepository

        with session_scope() as session:
            repo = CategoryRepository(session)
            categories = repo.get_quick_access_categories(
                tenant_id=self.tenant_id,
            )
            session.expunge_all()
            return categories

    def get_product_by_barcode(self, barcode: str) -> Optional[Product]:
        """
        Busca un producto por codigo de barras en la base local.

        Primero busca localmente; si no encuentra, intenta buscar
        en la API (si hay conexion).

        Args:
            barcode: Codigo de barras

        Returns:
            Producto o None si no se encuentra
        """
        from src.repositories.product_repository import ProductRepository

        # Buscar localmente
        with session_scope() as session:
            repo = ProductRepository(session)
            product = repo.get_by_barcode(
                tenant_id=self.tenant_id,
                barcode=barcode,
            )

            if product:
                session.expunge(product)
                return product

        # Si no esta localmente, intentar buscar en API
        try:
            product_data = self._api.get_by_barcode(barcode)
            if product_data:
                # Guardar localmente para futuras busquedas
                with session_scope() as session:
                    product = self._upsert_product(session, product_data)
                    session.expunge(product)
                    return product
        except NetworkError:
            logger.debug(f"Sin conexion para buscar barcode: {barcode}")
        except Exception as e:
            logger.warning(f"Error buscando barcode {barcode}: {e}")

        return None

    def get_products_count(self) -> int:
        """
        Obtiene el numero de productos en cache local.

        Returns:
            Cantidad de productos activos
        """
        from sqlalchemy import select, func

        with session_scope() as session:
            count = session.execute(
                select(func.count(Product.id))
                .where(Product.tenant_id == self.tenant_id)
                .where(Product.is_active == True)
            ).scalar()
            return count or 0

    def is_cache_valid(self, max_age_minutes: int = 60) -> bool:
        """
        Verifica si el cache local es valido (no muy antiguo).

        Args:
            max_age_minutes: Edad maxima en minutos

        Returns:
            True si el cache es valido
        """
        if not self.last_sync:
            return False

        age = (datetime.now() - self.last_sync).total_seconds() / 60
        return age < max_age_minutes

    def has_local_data(self) -> bool:
        """
        Verifica si hay datos en cache local.

        Returns:
            True si hay productos cacheados
        """
        return self.get_products_count() > 0

    # =========================================================================
    # PROMOCIONES
    # =========================================================================

    def _sync_promotions(self) -> int:
        """
        Sincroniza promociones activas desde el backend.

        Las promociones se guardan en memoria (no en SQLite) porque
        son datos dinamicos que cambian frecuentemente.

        Returns:
            Numero de promociones sincronizadas
        """
        try:
            promotions = self._promotions_api.get_active()
            self._active_promotions = promotions
            self._promotions_last_sync = datetime.now()
            return len(promotions)
        except Exception as e:
            logger.error(f"Error sincronizando promociones: {e}")
            return 0

    def get_active_promotions(self) -> List[PromotionData]:
        """
        Obtiene las promociones activas en cache.

        Si no hay promociones en cache o el cache es muy antiguo,
        intenta obtenerlas del backend.

        Returns:
            Lista de promociones activas
        """
        # Si no hay promociones en cache o son muy antiguas, refrescar
        cache_age_minutes = 5  # Refrescar cada 5 minutos
        if not self._active_promotions or not self._promotions_last_sync:
            try:
                self._sync_promotions()
            except Exception:
                pass  # Usar cache vacio si falla
        elif (datetime.now() - self._promotions_last_sync).total_seconds() > cache_age_minutes * 60:
            try:
                self._sync_promotions()
            except Exception:
                pass  # Usar cache existente si falla

        return self._active_promotions

    def refresh_promotions(self) -> List[PromotionData]:
        """
        Fuerza la actualizacion de promociones desde el backend.

        Returns:
            Lista de promociones activas actualizadas
        """
        try:
            self._sync_promotions()
        except Exception as e:
            logger.warning(f"Error refrescando promociones: {e}")

        return self._active_promotions

    def calculate_promotions(
        self,
        items: List[Dict[str, Any]],
        customer_id: Optional[str] = None,
    ) -> Optional[CalculationResult]:
        """
        Calcula las promociones para los items del carrito.

        Llama al endpoint POST /api/promotions/calculate para obtener
        los descuentos aplicables a cada item.

        Args:
            items: Lista de items del carrito con formato:
                [{"productId": str, "quantity": int, "unitPrice": float}, ...]
            customer_id: ID del cliente (opcional)

        Returns:
            CalculationResult con los descuentos calculados, o None si hay error
        """
        if not items:
            return CalculationResult()

        try:
            return self._promotions_api.calculate(items, customer_id)
        except NetworkError:
            logger.debug("Sin conexion para calcular promociones")
            return None
        except Exception as e:
            logger.error(f"Error calculando promociones: {e}")
            return None

    def get_promotion_for_product(
        self,
        product_id: str,
        category_id: Optional[str] = None,
        brand_id: Optional[str] = None,
    ) -> Optional[PromotionData]:
        """
        Busca la primera promocion aplicable a un producto.

        Usa las promociones en cache para determinar si hay
        alguna promocion que aplique al producto.

        Args:
            product_id: ID del producto
            category_id: ID de la categoria del producto
            brand_id: ID de la marca del producto

        Returns:
            PromotionData si hay promocion aplicable, None si no
        """
        promotions = self.get_active_promotions()
        return self._promotions_api.get_promotion_for_product(
            promotions, product_id, category_id, brand_id
        )

    # =========================================================================
    # CLIENTES
    # =========================================================================

    def _sync_customers(self) -> int:
        """
        Sincroniza clientes desde el backend.

        Obtiene todos los clientes paginados y los guarda localmente.

        Returns:
            Numero de clientes sincronizados
        """
        synced = 0
        page = 1
        page_size = 100
        has_more = True

        while has_more:
            customers, pagination = self._customers_api.get_all(
                page=page,
                page_size=page_size,
            )

            if not customers:
                break

            with session_scope() as session:
                for customer_data in customers:
                    try:
                        self._upsert_customer(session, customer_data)
                        synced += 1
                    except Exception as e:
                        logger.error(f"Error sincronizando cliente {customer_data.id}: {e}")

            # Verificar si hay mas paginas
            if pagination:
                has_more = page < pagination.total_pages
                page += 1
                self._notify_progress(
                    f"Sincronizando clientes... ({synced}/{pagination.total})",
                    synced,
                    pagination.total,
                )
            else:
                has_more = False

        return synced

    def _upsert_customer(self, session: Session, data: CustomerData) -> Customer:
        """
        Inserta o actualiza un cliente.

        Args:
            session: Sesion de base de datos
            data: Datos del cliente desde API

        Returns:
            Cliente creado o actualizado
        """
        customer = session.query(Customer).filter_by(id=data.id).first()

        if customer:
            # Actualizar existente
            customer.name = data.name
            customer.customer_type = data.customer_type
            customer.tax_id = data.tax_id
            customer.tax_id_type = data.tax_id_type
            customer.tax_category = data.tax_category
            customer.trade_name = data.trade_name
            customer.first_name = data.first_name
            customer.last_name = data.last_name
            customer.email = data.email
            customer.phone = data.phone
            customer.mobile = data.mobile
            customer.address = data.address
            customer.city = data.city
            customer.state = data.state
            customer.zip_code = data.zip_code
            customer.country = data.country
            customer.price_list_id = data.price_list_id
            customer.credit_limit = data.credit_limit
            customer.credit_balance = data.credit_balance
            customer.payment_term_days = data.payment_term_days
            customer.global_discount = data.global_discount
            customer.is_active = data.is_active
            customer.cianbox_id = data.cianbox_id
            customer.last_synced_at = datetime.now()
        else:
            # Crear nuevo
            customer = Customer(
                id=data.id,
                tenant_id=self.tenant_id,
                name=data.name,
                customer_type=data.customer_type,
                tax_id=data.tax_id,
                tax_id_type=data.tax_id_type,
                tax_category=data.tax_category,
                trade_name=data.trade_name,
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                phone=data.phone,
                mobile=data.mobile,
                address=data.address,
                city=data.city,
                state=data.state,
                zip_code=data.zip_code,
                country=data.country,
                price_list_id=data.price_list_id,
                credit_limit=data.credit_limit,
                credit_balance=data.credit_balance,
                payment_term_days=data.payment_term_days,
                global_discount=data.global_discount,
                is_active=data.is_active,
                cianbox_id=data.cianbox_id,
                last_synced_at=datetime.now(),
            )
            session.add(customer)

        return customer

    def get_local_customers(
        self,
        search: Optional[str] = None,
        limit: int = 50,
    ) -> List[Customer]:
        """
        Obtiene clientes desde la base de datos local.

        Args:
            search: Texto de busqueda (nombre, documento, email)
            limit: Limite de resultados

        Returns:
            Lista de clientes
        """
        from src.repositories.customer_repository import CustomerRepository

        with session_scope() as session:
            repo = CustomerRepository(session)

            if search:
                customers = repo.search(
                    tenant_id=self.tenant_id,
                    query=search,
                    limit=limit,
                )
            else:
                customers = repo.get_active(
                    tenant_id=self.tenant_id,
                    limit=limit,
                )

            # Detach de session para usar fuera del context
            session.expunge_all()
            return customers

    def get_customer_by_tax_id(self, tax_id: str) -> Optional[Customer]:
        """
        Busca un cliente por documento fiscal.

        Args:
            tax_id: CUIT/CUIL/DNI

        Returns:
            Cliente o None
        """
        from src.repositories.customer_repository import CustomerRepository

        with session_scope() as session:
            repo = CustomerRepository(session)
            customer = repo.get_by_tax_id(
                tenant_id=self.tenant_id,
                tax_id=tax_id,
            )

            if customer:
                session.expunge(customer)
                return customer

        return None

    def get_customers_count(self) -> int:
        """
        Obtiene el numero de clientes en cache local.

        Returns:
            Cantidad de clientes activos
        """
        from sqlalchemy import select, func

        with session_scope() as session:
            count = session.execute(
                select(func.count(Customer.id))
                .where(Customer.tenant_id == self.tenant_id)
                .where(Customer.is_active == True)
            ).scalar()
            return count or 0


# Instancia singleton por tenant
_sync_services: dict[str, SyncService] = {}


def get_sync_service(tenant_id: str, branch_id: Optional[str] = None) -> SyncService:
    """
    Obtiene o crea el servicio de sincronizacion para un tenant.

    Args:
        tenant_id: ID del tenant
        branch_id: ID de la sucursal para obtener stock

    Returns:
        SyncService para el tenant
    """
    global _sync_services

    # Si el servicio no existe o el branch_id cambió, crear nuevo
    if tenant_id not in _sync_services:
        _sync_services[tenant_id] = SyncService(tenant_id, branch_id)
    elif branch_id and _sync_services[tenant_id].branch_id != branch_id:
        # Si el branch cambió, actualizar el servicio
        _sync_services[tenant_id].branch_id = branch_id

    return _sync_services[tenant_id]


def reset_sync_service(tenant_id: Optional[str] = None) -> None:
    """
    Reinicia el servicio de sincronizacion.

    Args:
        tenant_id: ID del tenant (None para reiniciar todos)
    """
    global _sync_services

    if tenant_id:
        if tenant_id in _sync_services:
            del _sync_services[tenant_id]
    else:
        _sync_services.clear()
