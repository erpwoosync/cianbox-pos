"""
API de clientes.

Maneja la obtencion y busqueda de clientes desde el backend.
"""

from decimal import Decimal
from typing import Optional, List
from dataclasses import dataclass

from loguru import logger

from .client import APIClient, get_api_client
from .products import PaginationData


@dataclass
class CustomerData:
    """Datos de un cliente."""

    id: str
    name: str
    customer_type: str = "CONSUMER"
    tax_id: Optional[str] = None
    tax_id_type: Optional[str] = None
    tax_category: Optional[str] = None
    trade_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "AR"
    price_list_id: Optional[str] = None
    credit_limit: Decimal = Decimal("0")
    credit_balance: Decimal = Decimal("0")
    payment_term_days: int = 0
    global_discount: Decimal = Decimal("0")
    is_active: bool = True
    cianbox_id: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict) -> "CustomerData":
        """Crea CustomerData desde diccionario de la API."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            customer_type=data.get("customerType", "CONSUMER"),
            tax_id=data.get("taxId"),
            tax_id_type=data.get("taxIdType"),
            tax_category=data.get("taxCategory"),
            trade_name=data.get("tradeName"),
            first_name=data.get("firstName"),
            last_name=data.get("lastName"),
            email=data.get("email"),
            phone=data.get("phone"),
            mobile=data.get("mobile"),
            address=data.get("address"),
            city=data.get("city"),
            state=data.get("state"),
            zip_code=data.get("zipCode"),
            country=data.get("country", "AR"),
            price_list_id=data.get("priceListId"),
            credit_limit=Decimal(str(data.get("creditLimit", 0))),
            credit_balance=Decimal(str(data.get("creditBalance", 0))),
            payment_term_days=int(data.get("paymentTermDays", 0)),
            global_discount=Decimal(str(data.get("globalDiscount", 0))),
            is_active=data.get("isActive", True),
            cianbox_id=data.get("cianboxCustomerId"),
        )

    @property
    def display_name(self) -> str:
        """Nombre para mostrar."""
        return self.trade_name or self.name

    @property
    def tax_info(self) -> str:
        """Informacion fiscal formateada."""
        if self.tax_id:
            return f"{self.tax_id_type or 'DOC'}: {self.tax_id}"
        return ""


class CustomersAPI:
    """
    API de clientes.

    Maneja la obtencion y busqueda de clientes.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de clientes.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def search(
        self,
        query: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[CustomerData], Optional[PaginationData]]:
        """
        Busca clientes por texto.

        Busca en nombre, documento, email.

        Args:
            query: Texto de busqueda
            page: Pagina
            page_size: Tamano de pagina

        Returns:
            Tupla de (lista de clientes, datos de paginacion)
        """
        params = {
            "search": query,
            "page": page,
            "pageSize": page_size,
            "isActive": True,
        }

        try:
            response = self.client.get("/api/backoffice/customers", params=params)

            if response.success and response.data:
                customers = [CustomerData.from_dict(c) for c in response.data]
                pagination = (
                    PaginationData.from_dict(response.pagination)
                    if response.pagination
                    else None
                )
                return customers, pagination

        except Exception as e:
            logger.error(f"Error buscando clientes: {e}")

        return [], None

    def get_by_id(self, customer_id: str) -> Optional[CustomerData]:
        """
        Obtiene un cliente por ID.

        Args:
            customer_id: ID del cliente

        Returns:
            CustomerData o None
        """
        try:
            response = self.client.get(f"/api/backoffice/customers/{customer_id}")

            if response.success and response.data:
                return CustomerData.from_dict(response.data)

        except Exception as e:
            logger.warning(f"Cliente no encontrado (id={customer_id}): {e}")

        return None

    def get_by_tax_id(self, tax_id: str) -> Optional[CustomerData]:
        """
        Obtiene un cliente por documento (CUIT/DNI).

        Args:
            tax_id: Numero de documento

        Returns:
            CustomerData o None
        """
        customers, _ = self.search(tax_id, page_size=1)
        return customers[0] if customers else None

    def get_all(
        self,
        page: int = 1,
        page_size: int = 100,
    ) -> tuple[List[CustomerData], Optional[PaginationData]]:
        """
        Obtiene todos los clientes (paginado).

        Args:
            page: Pagina
            page_size: Tamano de pagina

        Returns:
            Tupla de (lista de clientes, datos de paginacion)
        """
        params = {
            "page": page,
            "pageSize": page_size,
            "isActive": True,
        }

        try:
            response = self.client.get("/api/backoffice/customers", params=params)

            if response.success and response.data:
                customers = [CustomerData.from_dict(c) for c in response.data]
                pagination = (
                    PaginationData.from_dict(response.pagination)
                    if response.pagination
                    else None
                )
                return customers, pagination

        except Exception as e:
            logger.error(f"Error obteniendo clientes: {e}")

        return [], None


# Instancia global
_customers_api: Optional[CustomersAPI] = None


def get_customers_api() -> CustomersAPI:
    """Obtiene la instancia global de CustomersAPI."""
    global _customers_api
    if _customers_api is None:
        _customers_api = CustomersAPI()
    return _customers_api
