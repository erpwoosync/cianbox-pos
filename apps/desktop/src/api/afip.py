"""
API de facturación electrónica AFIP.

Maneja la emisión de comprobantes electrónicos.
"""

from typing import Optional
from dataclasses import dataclass

from loguru import logger

from .client import APIClient, get_api_client, APIError, NetworkError


@dataclass
class InvoiceData:
    """Datos de una factura emitida."""

    id: str
    voucher_type: str
    number: int
    cae: str
    cae_expiration: str
    sales_point_number: int
    total: float
    receiver_name: str
    receiver_doc_num: str
    issue_date: str
    cuit: str
    business_name: str
    trade_name: Optional[str]
    address: str
    tax_category: str


@dataclass
class SaleForInvoice:
    """Datos de la venta para mostrar en factura."""

    id: str
    sale_number: str
    items: list


@dataclass
class InvoiceResult:
    """Resultado de emitir una factura."""

    success: bool
    invoice: Optional[InvoiceData] = None
    sale: Optional[SaleForInvoice] = None
    error: Optional[str] = None


class AfipAPI:
    """
    API de facturación electrónica AFIP.

    Maneja la emisión de comprobantes.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de AFIP.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def invoice_from_sale(
        self,
        sale_id: str,
        receiver_name: Optional[str] = None,
        receiver_doc_num: Optional[str] = None,
        receiver_doc_type: Optional[int] = None,
    ) -> InvoiceResult:
        """
        Emite una factura electrónica desde una venta.

        Args:
            sale_id: ID de la venta
            receiver_name: Nombre del receptor (opcional)
            receiver_doc_num: DNI/CUIT del receptor (opcional)
            receiver_doc_type: Tipo de documento (96=DNI, 99=CF)

        Returns:
            InvoiceResult con el resultado
        """
        logger.info(f"Emitiendo factura para venta {sale_id}")

        try:
            data = {"saleId": sale_id}

            if receiver_name:
                data["receiverName"] = receiver_name
            if receiver_doc_num:
                data["receiverDocNum"] = receiver_doc_num
            if receiver_doc_type:
                data["receiverDocType"] = receiver_doc_type

            response = self.client.post(
                "/api/afip/invoices/from-sale",
                data=data,
            )

            # Log completo de la respuesta para debug
            logger.debug(f"Respuesta AFIP: success={response.success}, error={response.error}, raw_data={response.raw_data}")

            if not response.success:
                error_msg = response.error or "Error de conexion con el servidor"
                logger.error(f"Error HTTP al emitir factura: {error_msg}")
                return InvoiceResult(success=False, error=error_msg)

            # AFIP endpoint devuelve {success, invoice, sale} directamente, no en 'data'
            result = response.raw_data
            if result:
                # Verificar si hay error en la respuesta
                if result.get("error"):
                    error_msg = result.get("error")
                    logger.error(f"Error del backend al emitir factura: {error_msg}")
                    return InvoiceResult(success=False, error=error_msg)

                if result.get("success"):
                    invoice_data = result.get("invoice", {})
                    sale_data = result.get("sale", {})

                    invoice = InvoiceData(
                        id=invoice_data.get("id", ""),
                        voucher_type=invoice_data.get("voucherType", "FACTURA_B"),
                        number=invoice_data.get("number", 0),
                        cae=invoice_data.get("cae", ""),
                        cae_expiration=invoice_data.get("caeExpiration", ""),
                        sales_point_number=invoice_data.get("salesPointNumber", 0),
                        total=float(invoice_data.get("total", 0)),
                        receiver_name=invoice_data.get("receiverName", "Consumidor Final"),
                        receiver_doc_num=invoice_data.get("receiverDocNum", "0"),
                        issue_date=invoice_data.get("issueDate", ""),
                        cuit=invoice_data.get("cuit", ""),
                        business_name=invoice_data.get("businessName", ""),
                        trade_name=invoice_data.get("tradeName"),
                        address=invoice_data.get("address", ""),
                        tax_category=invoice_data.get("taxCategory", ""),
                    )

                    sale = SaleForInvoice(
                        id=sale_data.get("id", ""),
                        sale_number=sale_data.get("saleNumber", ""),
                        items=sale_data.get("items", []),
                    )

                    logger.info(f"Factura emitida: CAE {invoice.cae}")
                    return InvoiceResult(success=True, invoice=invoice, sale=sale)

            # Si llegamos aqui, no hubo success=True en la respuesta
            error_msg = "La respuesta del servidor no contiene datos de factura"
            logger.error(f"Respuesta inesperada: {response.raw_data}")
            return InvoiceResult(success=False, error=error_msg)

        except NetworkError as e:
            # Error de conexion
            logger.error(f"Error de red al emitir factura: {e}")
            return InvoiceResult(
                success=False,
                error="Error de conexion con el servidor. Verifique su conexion a internet."
            )

        except APIError as e:
            # Error de la API (400, 404, etc.)
            error_msg = str(e.message) if hasattr(e, 'message') else str(e)
            logger.error(f"Error de API al emitir factura: {error_msg}")
            return InvoiceResult(success=False, error=error_msg)

        except Exception as e:
            logger.error(f"Error inesperado emitiendo factura: {e}")
            return InvoiceResult(success=False, error=str(e))

    def get_invoice(self, invoice_id: str) -> Optional[dict]:
        """
        Obtiene una factura por ID.

        Args:
            invoice_id: ID de la factura

        Returns:
            Datos de la factura o None
        """
        try:
            response = self.client.get(f"/api/afip/invoices/{invoice_id}")

            if response.success and response.data:
                return response.data

        except Exception as e:
            logger.error(f"Error obteniendo factura: {e}")

        return None

    def get_config(self) -> Optional[dict]:
        """
        Obtiene la configuración AFIP del tenant.

        Returns:
            Configuración o None
        """
        try:
            response = self.client.get("/api/afip/config")

            if response.success and response.data:
                return response.data

        except Exception as e:
            logger.error(f"Error obteniendo config AFIP: {e}")

        return None
