"""
API de ventas.

Maneja la creacion y consulta de ventas.
"""

from typing import Optional, List
from dataclasses import dataclass, field
from decimal import Decimal

from loguru import logger

from .client import APIClient, get_api_client
from src.config.constants import PaymentMethod, ReceiptType


@dataclass
class SaleItemData:
    """Datos de un item de venta."""

    product_id: Optional[str] = None
    product_code: Optional[str] = None
    product_name: str = ""
    product_barcode: Optional[str] = None
    quantity: float = 1.0
    unit_price: float = 0.0
    unit_price_net: Optional[float] = None
    discount: float = 0.0
    tax_rate: float = 21.0
    promotion_id: Optional[str] = None
    promotion_name: Optional[str] = None

    def to_dict(self) -> dict:
        """Convierte a diccionario para la API."""
        data = {
            "productName": self.product_name,
            "quantity": self.quantity,
            "unitPrice": self.unit_price,
            "discount": self.discount,
            "taxRate": self.tax_rate,
        }

        if self.product_id:
            data["productId"] = self.product_id
        if self.product_code:
            data["productCode"] = self.product_code
        if self.product_barcode:
            data["productBarcode"] = self.product_barcode
        if self.unit_price_net:
            data["unitPriceNet"] = self.unit_price_net
        if self.promotion_id:
            data["promotionId"] = self.promotion_id
        if self.promotion_name:
            data["promotionName"] = self.promotion_name

        return data


@dataclass
class PaymentData:
    """Datos de un pago."""

    method: PaymentMethod = PaymentMethod.CASH
    amount: float = 0.0
    reference: Optional[str] = None
    amount_tendered: Optional[float] = None
    card_brand: Optional[str] = None
    card_last_four: Optional[str] = None
    installments: int = 1

    def to_dict(self) -> dict:
        """Convierte a diccionario para la API."""
        data = {
            "method": self.method.value,
            "amount": self.amount,
            "installments": self.installments,
        }

        if self.reference:
            data["reference"] = self.reference
        if self.amount_tendered:
            data["amountTendered"] = self.amount_tendered
        if self.card_brand:
            data["cardBrand"] = self.card_brand
        if self.card_last_four:
            data["cardLastFour"] = self.card_last_four

        return data


@dataclass
class CreateSaleRequest:
    """Request para crear una venta."""

    branch_id: str
    point_of_sale_id: str
    items: List[SaleItemData] = field(default_factory=list)
    payments: List[PaymentData] = field(default_factory=list)
    customer_id: Optional[str] = None
    receipt_type: ReceiptType = ReceiptType.TICKET
    notes: Optional[str] = None

    def to_dict(self) -> dict:
        """Convierte a diccionario para la API."""
        return {
            "branchId": self.branch_id,
            "pointOfSaleId": self.point_of_sale_id,
            "items": [item.to_dict() for item in self.items],
            "payments": [payment.to_dict() for payment in self.payments],
            "customerId": self.customer_id,
            "receiptType": self.receipt_type.value,
            "notes": self.notes,
        }


@dataclass
class SaleResult:
    """Resultado de crear una venta."""

    success: bool
    sale_id: Optional[str] = None
    sale_number: Optional[str] = None
    total: float = 0.0
    error: Optional[str] = None
    data: Optional[dict] = None


class SalesAPI:
    """
    API de ventas.

    Maneja la creacion y consulta de ventas.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de ventas.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def create_sale(self, request: CreateSaleRequest) -> SaleResult:
        """
        Crea una nueva venta.

        Args:
            request: Datos de la venta

        Returns:
            SaleResult con el resultado
        """
        logger.info(f"Creando venta con {len(request.items)} items")

        try:
            response = self.client.post(
                "/api/sales",
                data=request.to_dict(),
            )

            if response.success and response.data:
                data = response.data
                logger.info(f"Venta creada: {data.get('saleNumber')}")

                return SaleResult(
                    success=True,
                    sale_id=data.get("id"),
                    sale_number=data.get("saleNumber"),
                    total=float(data.get("total", 0)),
                    data=data,
                )

            return SaleResult(
                success=False,
                error=response.error or "Error al crear venta",
            )

        except Exception as e:
            logger.error(f"Error creando venta: {e}")
            return SaleResult(success=False, error=str(e))

    def get_sale(self, sale_id: str) -> Optional[dict]:
        """
        Obtiene una venta por ID.

        Args:
            sale_id: ID de la venta

        Returns:
            Datos de la venta o None
        """
        try:
            response = self.client.get(f"/api/sales/{sale_id}")

            if response.success and response.data:
                return response.data

        except Exception as e:
            logger.error(f"Error obteniendo venta: {e}")

        return None

    def cancel_sale(
        self,
        sale_id: str,
        reason: str,
    ) -> bool:
        """
        Anula una venta.

        Args:
            sale_id: ID de la venta
            reason: Motivo de anulacion

        Returns:
            True si se anulo correctamente
        """
        logger.info(f"Anulando venta {sale_id}: {reason}")

        try:
            response = self.client.post(
                f"/api/sales/{sale_id}/cancel",
                data={"reason": reason},
            )

            if response.success:
                logger.info(f"Venta {sale_id} anulada")
                return True

            logger.warning(f"Error anulando venta: {response.error}")

        except Exception as e:
            logger.error(f"Error anulando venta: {e}")

        return False

    def get_daily_summary(
        self,
        branch_id: Optional[str] = None,
        point_of_sale_id: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Obtiene el resumen de ventas del dia.

        Args:
            branch_id: Filtrar por sucursal
            point_of_sale_id: Filtrar por punto de venta

        Returns:
            Resumen de ventas o None
        """
        params = {}
        if branch_id:
            params["branchId"] = branch_id
        if point_of_sale_id:
            params["pointOfSaleId"] = point_of_sale_id

        try:
            response = self.client.get(
                "/api/sales/reports/daily-summary",
                params=params,
            )

            if response.success and response.data:
                return response.data

        except Exception as e:
            logger.error(f"Error obteniendo resumen diario: {e}")

        return None

    def list_sales(
        self,
        branch_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[dict], Optional[dict]]:
        """
        Lista ventas con filtros.

        Args:
            branch_id: Filtrar por sucursal
            date_from: Fecha desde (YYYY-MM-DD)
            date_to: Fecha hasta (YYYY-MM-DD)
            page: Pagina
            page_size: Tamano de pagina

        Returns:
            Tupla de (lista de ventas, paginacion)
        """
        params = {
            "page": page,
            "pageSize": page_size,
        }

        if branch_id:
            params["branchId"] = branch_id
        if date_from:
            params["dateFrom"] = date_from
        if date_to:
            params["dateTo"] = date_to

        try:
            response = self.client.get("/api/sales", params=params)

            if response.success and response.data:
                return response.data, response.pagination

        except Exception as e:
            logger.error(f"Error listando ventas: {e}")

        return [], None
