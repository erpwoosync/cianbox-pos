"""
Servicio de impresion de tickets.

Gestiona la impresion de tickets y comprobantes:
- Generacion de texto formateado para impresora termica
- Soporte para diferentes tipos de comprobantes
- Cola de impresion
- Reimpresion del ultimo ticket

Uso:
    >>> from src.services import get_print_service
    >>> printer = get_print_service()
    >>> ticket = printer.generate_sale_ticket(sale_data)
    >>> printer.print_ticket(ticket)
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
import logging

from src.config.constants import (
    CURRENCY_SYMBOL,
    DATETIME_FORMAT,
)
from src.utils.formatters import format_currency, format_datetime


logger = logging.getLogger(__name__)


class TicketType(str, Enum):
    """Tipos de ticket."""

    SALE = "SALE"
    REFUND = "REFUND"
    CASH_OPENING = "CASH_OPENING"
    CASH_CLOSING = "CASH_CLOSING"
    PRICE_CHECK = "PRICE_CHECK"
    X_REPORT = "X_REPORT"
    Z_REPORT = "Z_REPORT"


@dataclass
class PrinterConfig:
    """
    Configuracion de impresora.

    Attributes:
        name: Nombre de la impresora
        width: Ancho en caracteres (tipico: 42 para 80mm, 32 para 58mm)
        encoding: Codificacion de caracteres
        cut_command: Comando para cortar papel
    """

    name: str = "default"
    width: int = 42
    encoding: str = "cp850"
    cut_command: bytes = b"\x1d\x56\x00"  # ESC/POS full cut

    @classmethod
    def for_80mm(cls, name: str = "default") -> "PrinterConfig":
        """Configuracion para impresora de 80mm."""
        return cls(name=name, width=42)

    @classmethod
    def for_58mm(cls, name: str = "default") -> "PrinterConfig":
        """Configuracion para impresora de 58mm."""
        return cls(name=name, width=32)


@dataclass
class Ticket:
    """
    Ticket generado para impresion.

    Attributes:
        ticket_type: Tipo de ticket
        content: Contenido formateado
        raw_data: Datos originales
        created_at: Fecha de creacion
    """

    ticket_type: TicketType
    content: str
    raw_data: Dict[str, Any]
    created_at: datetime


class PrintService:
    """
    Servicio de impresion.

    Gestiona la generacion e impresion de tickets.

    Attributes:
        config: Configuracion de la impresora
        last_ticket: Ultimo ticket impreso (para reimpresion)
    """

    def __init__(self, config: Optional[PrinterConfig] = None):
        self._config = config or PrinterConfig.for_80mm()
        self._last_ticket: Optional[Ticket] = None
        self._store_name: str = "TIENDA"
        self._store_address: str = ""
        self._store_phone: str = ""
        self._store_cuit: str = ""
        self._footer_message: str = "Gracias por su compra!"

    # =========================================================================
    # CONFIGURACION
    # =========================================================================

    def configure(
        self,
        store_name: str = None,
        store_address: str = None,
        store_phone: str = None,
        store_cuit: str = None,
        footer_message: str = None,
    ) -> None:
        """
        Configura los datos de la tienda para los tickets.

        Args:
            store_name: Nombre de la tienda
            store_address: Direccion
            store_phone: Telefono
            store_cuit: CUIT
            footer_message: Mensaje de pie de ticket
        """
        if store_name:
            self._store_name = store_name
        if store_address:
            self._store_address = store_address
        if store_phone:
            self._store_phone = store_phone
        if store_cuit:
            self._store_cuit = store_cuit
        if footer_message:
            self._footer_message = footer_message

    def set_printer_config(self, config: PrinterConfig) -> None:
        """Establece la configuracion de impresora."""
        self._config = config

    @property
    def width(self) -> int:
        """Ancho de impresion en caracteres."""
        return self._config.width

    @property
    def last_ticket(self) -> Optional[Ticket]:
        """Ultimo ticket impreso."""
        return self._last_ticket

    # =========================================================================
    # GENERACION DE TICKETS
    # =========================================================================

    def generate_sale_ticket(self, sale_data: Dict[str, Any]) -> Ticket:
        """
        Genera un ticket de venta.

        Args:
            sale_data: Datos de la venta con estructura:
                {
                    "id": str,
                    "number": int,
                    "date": datetime,
                    "cashier": str,
                    "terminal": str,
                    "items": [
                        {
                            "name": str,
                            "quantity": Decimal,
                            "unit_price": Decimal,
                            "total": Decimal,
                            "discount": Decimal (opcional),
                        }
                    ],
                    "subtotal": Decimal,
                    "discount": Decimal,
                    "total": Decimal,
                    "payments": [
                        {
                            "method": str,
                            "amount": Decimal,
                        }
                    ],
                    "customer": str (opcional),
                }

        Returns:
            Ticket generado
        """
        lines = []

        # Encabezado
        lines.extend(self._generate_header())
        lines.append(self._separator("="))

        # Info de venta
        sale_date = sale_data.get("date", datetime.now())
        lines.append(f"Fecha: {format_datetime(sale_date)}")
        lines.append(f"Ticket: #{sale_data.get('number', 0):06d}")
        if sale_data.get("cashier"):
            lines.append(f"Cajero: {sale_data['cashier']}")
        if sale_data.get("terminal"):
            lines.append(f"Terminal: {sale_data['terminal']}")
        if sale_data.get("customer"):
            lines.append(f"Cliente: {sale_data['customer']}")

        lines.append(self._separator("-"))

        # Items
        for item in sale_data.get("items", []):
            lines.extend(self._format_sale_item(item))

        lines.append(self._separator("-"))

        # Totales
        subtotal = sale_data.get("subtotal", Decimal("0"))
        discount = sale_data.get("discount", Decimal("0"))
        total = sale_data.get("total", Decimal("0"))

        lines.append(self._format_total_line("Subtotal", subtotal))

        if discount > 0:
            lines.append(self._format_total_line("Descuento", -discount))

        lines.append(self._separator("="))
        lines.append(self._format_total_line("TOTAL", total, bold=True))
        lines.append(self._separator("="))

        # Pagos
        lines.append("")
        for payment in sale_data.get("payments", []):
            method = payment.get("method", "Efectivo")
            amount = payment.get("amount", Decimal("0"))
            lines.append(self._format_total_line(method, amount))

        # Vuelto (si hay)
        change = sale_data.get("change", Decimal("0"))
        if change > 0:
            lines.append(self._format_total_line("Vuelto", change))

        lines.append("")

        # Footer
        lines.extend(self._generate_footer())

        content = "\n".join(lines)

        ticket = Ticket(
            ticket_type=TicketType.SALE,
            content=content,
            raw_data=sale_data,
            created_at=datetime.now(),
        )

        self._last_ticket = ticket
        return ticket

    def generate_price_check_ticket(
        self,
        product_name: str,
        product_sku: str,
        price: Decimal,
        promo_price: Optional[Decimal] = None,
    ) -> Ticket:
        """
        Genera un ticket de consulta de precio.

        Args:
            product_name: Nombre del producto
            product_sku: SKU o codigo
            price: Precio normal
            promo_price: Precio promocional (opcional)

        Returns:
            Ticket generado
        """
        lines = []

        lines.append(self._center("CONSULTA DE PRECIO"))
        lines.append(self._separator("="))
        lines.append(f"Fecha: {format_datetime(datetime.now())}")
        lines.append(self._separator("-"))
        lines.append("")
        lines.append(self._center(product_name[:self.width]))
        if len(product_name) > self.width:
            lines.append(self._center(product_name[self.width:self.width*2]))
        lines.append(f"Codigo: {product_sku or 'N/A'}")
        lines.append("")
        lines.append(self._separator("-"))

        if promo_price and promo_price < price:
            lines.append(self._format_total_line("Precio normal", price))
            lines.append(self._format_total_line("PRECIO PROMO", promo_price, bold=True))
        else:
            lines.append(self._format_total_line("PRECIO", price, bold=True))

        lines.append(self._separator("="))
        lines.append("")

        content = "\n".join(lines)

        ticket = Ticket(
            ticket_type=TicketType.PRICE_CHECK,
            content=content,
            raw_data={
                "product_name": product_name,
                "product_sku": product_sku,
                "price": str(price),
                "promo_price": str(promo_price) if promo_price else None,
            },
            created_at=datetime.now(),
        )

        return ticket

    def generate_cash_opening_ticket(
        self,
        cashier: str,
        terminal: str,
        opening_amount: Decimal,
    ) -> Ticket:
        """
        Genera un ticket de apertura de caja.

        Args:
            cashier: Nombre del cajero
            terminal: ID del terminal
            opening_amount: Monto de apertura

        Returns:
            Ticket generado
        """
        lines = []

        lines.append(self._center("APERTURA DE CAJA"))
        lines.append(self._separator("="))
        lines.append(f"Fecha: {format_datetime(datetime.now())}")
        lines.append(f"Cajero: {cashier}")
        lines.append(f"Terminal: {terminal}")
        lines.append(self._separator("-"))
        lines.append(self._format_total_line("Fondo de caja", opening_amount))
        lines.append(self._separator("="))
        lines.append("")

        content = "\n".join(lines)

        ticket = Ticket(
            ticket_type=TicketType.CASH_OPENING,
            content=content,
            raw_data={
                "cashier": cashier,
                "terminal": terminal,
                "opening_amount": str(opening_amount),
            },
            created_at=datetime.now(),
        )

        return ticket

    def generate_cash_closing_ticket(
        self,
        cashier: str,
        terminal: str,
        summary: Dict[str, Any],
    ) -> Ticket:
        """
        Genera un ticket de cierre de caja.

        Args:
            cashier: Nombre del cajero
            terminal: ID del terminal
            summary: Resumen del turno

        Returns:
            Ticket generado
        """
        lines = []

        lines.append(self._center("CIERRE DE CAJA"))
        lines.append(self._separator("="))
        lines.append(f"Fecha: {format_datetime(datetime.now())}")
        lines.append(f"Cajero: {cashier}")
        lines.append(f"Terminal: {terminal}")
        lines.append(self._separator("-"))

        # Resumen de ventas
        lines.append(f"Ventas: {summary.get('sales_count', 0)}")
        lines.append(self._format_total_line("Total ventas", summary.get("sales_total", Decimal("0"))))

        lines.append(self._separator("-"))

        # Desglose por metodo de pago
        for payment in summary.get("payments_by_method", []):
            method = payment.get("method", "Otro")
            amount = payment.get("amount", Decimal("0"))
            lines.append(self._format_total_line(method, amount))

        lines.append(self._separator("-"))

        # Caja
        lines.append(self._format_total_line("Apertura", summary.get("opening_amount", Decimal("0"))))
        lines.append(self._format_total_line("Efectivo teorico", summary.get("expected_cash", Decimal("0"))))
        lines.append(self._format_total_line("Efectivo contado", summary.get("counted_cash", Decimal("0"))))

        diff = summary.get("difference", Decimal("0"))
        if diff != 0:
            lines.append(self._format_total_line("Diferencia", diff))

        lines.append(self._separator("="))
        lines.append("")

        content = "\n".join(lines)

        ticket = Ticket(
            ticket_type=TicketType.CASH_CLOSING,
            content=content,
            raw_data=summary,
            created_at=datetime.now(),
        )

        self._last_ticket = ticket
        return ticket

    # =========================================================================
    # IMPRESION
    # =========================================================================

    def print_ticket(self, ticket: Ticket) -> bool:
        """
        Envia un ticket a la impresora.

        Args:
            ticket: Ticket a imprimir

        Returns:
            True si se imprimio correctamente

        Note:
            En esta version basica solo loguea el contenido.
            Implementar conexion real con impresora segun sistema operativo.
        """
        try:
            logger.info(f"Imprimiendo ticket tipo {ticket.ticket_type.value}")
            logger.debug(f"Contenido:\n{ticket.content}")

            # TODO: Implementar impresion real
            # - Windows: win32print
            # - Linux: cups
            # - USB directo: pyusb

            return True

        except Exception as e:
            logger.error(f"Error al imprimir: {e}")
            return False

    def reprint_last(self) -> bool:
        """
        Reimprime el ultimo ticket.

        Returns:
            True si se reimprimio, False si no hay ticket previo
        """
        if not self._last_ticket:
            logger.warning("No hay ticket previo para reimprimir")
            return False

        return self.print_ticket(self._last_ticket)

    def preview(self, ticket: Ticket) -> str:
        """
        Obtiene una vista previa del ticket.

        Args:
            ticket: Ticket a previsualizar

        Returns:
            Contenido formateado del ticket
        """
        return ticket.content

    # =========================================================================
    # METODOS AUXILIARES DE FORMATEO
    # =========================================================================

    def _generate_header(self) -> List[str]:
        """Genera el encabezado del ticket."""
        lines = []
        lines.append(self._center(self._store_name))
        if self._store_address:
            lines.append(self._center(self._store_address))
        if self._store_phone:
            lines.append(self._center(f"Tel: {self._store_phone}"))
        if self._store_cuit:
            lines.append(self._center(f"CUIT: {self._store_cuit}"))
        return lines

    def _generate_footer(self) -> List[str]:
        """Genera el pie del ticket."""
        lines = []
        if self._footer_message:
            lines.append(self._center(self._footer_message))
        lines.append("")
        return lines

    def _center(self, text: str) -> str:
        """Centra texto en el ancho de impresion."""
        return text.center(self.width)

    def _separator(self, char: str = "-") -> str:
        """Genera una linea separadora."""
        return char * self.width

    def _format_sale_item(self, item: Dict[str, Any]) -> List[str]:
        """Formatea un item de venta."""
        lines = []

        name = item.get("name", "Producto")
        qty = item.get("quantity", Decimal("1"))
        unit_price = item.get("unit_price", Decimal("0"))
        total = item.get("total", Decimal("0"))
        discount = item.get("discount", Decimal("0"))

        # Nombre del producto (puede ocupar mas de una linea)
        if len(name) > self.width - 15:
            lines.append(name[:self.width])
            name = ""

        # Cantidad x Precio = Total
        qty_str = f"{qty:.0f}" if qty == int(qty) else f"{qty:.2f}"
        detail = f"  {qty_str} x {format_currency(unit_price, False)}"
        total_str = format_currency(total, False)

        line = f"{detail:<{self.width - len(total_str)}}{total_str}"
        lines.append(line)

        # Descuento (si hay)
        if discount > 0:
            disc_str = f"  Desc: -{format_currency(discount, False)}"
            lines.append(disc_str)

        return lines

    def _format_total_line(
        self,
        label: str,
        amount: Decimal,
        bold: bool = False,
    ) -> str:
        """Formatea una linea de total."""
        amount_str = format_currency(amount)
        space = self.width - len(label) - len(amount_str)

        if bold:
            # Simular negrita con mayusculas
            label = label.upper()

        return f"{label}{' ' * space}{amount_str}"


# =============================================================================
# SINGLETON
# =============================================================================

_print_service: Optional[PrintService] = None


def get_print_service() -> PrintService:
    """
    Obtiene la instancia singleton del servicio de impresion.

    Returns:
        Instancia de PrintService
    """
    global _print_service
    if _print_service is None:
        _print_service = PrintService()
    return _print_service


def reset_print_service() -> None:
    """
    Resetea la instancia singleton del servicio.

    Util para testing.
    """
    global _print_service
    _print_service = None
