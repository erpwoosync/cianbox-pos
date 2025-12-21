"""
Componentes de visualizacion de datos.

Proporciona widgets para mostrar informacion:
- PriceDisplay: Muestra precios formateados
- TotalDisplay: Muestra total de venta
- StatusBadge: Badge de estado

Uso:
    >>> from src.ui.components import PriceDisplay, TotalDisplay
    >>> price = PriceDisplay(1234.56)
    >>> total = TotalDisplay()
    >>> total.setTotal(Decimal("5000.00"))
"""

from decimal import Decimal
from typing import Optional

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QLabel,
    QFrame,
)

from src.config.constants import COLORS
from src.utils.formatters import format_currency


class PriceDisplay(QLabel):
    """
    Widget para mostrar precios formateados.

    Muestra el precio con formato de moneda argentino.
    Opcionalmente muestra precio tachado para promociones.
    """

    def __init__(
        self,
        price: Decimal = Decimal("0"),
        parent=None,
        font_size: int = 16,
        show_symbol: bool = True,
    ):
        super().__init__(parent)
        self._price = price
        self._original_price: Optional[Decimal] = None
        self._font_size = font_size
        self._show_symbol = show_symbol

        self.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self._update_display()

    def _update_display(self) -> None:
        """Actualiza el display del precio."""
        font = self.font()
        font.setPointSize(self._font_size)
        font.setWeight(QFont.Weight.Bold)
        self.setFont(font)

        text = format_currency(self._price, self._show_symbol)
        self.setText(text)
        self.setStyleSheet(f"color: {COLORS['text_primary']};")

    def setPrice(self, price: Decimal) -> None:
        """Establece el precio."""
        self._price = price
        self._update_display()

    def setPromoPrice(self, original: Decimal, promo: Decimal) -> None:
        """
        Establece precio promocional.

        Args:
            original: Precio original (se muestra tachado)
            promo: Precio promocional
        """
        self._original_price = original
        self._price = promo
        self._update_promo_display()

    def _update_promo_display(self) -> None:
        """Actualiza display con precio promocional."""
        original_text = format_currency(self._original_price, self._show_symbol)
        promo_text = format_currency(self._price, self._show_symbol)

        self.setText(f"<s style='color:{COLORS['text_muted']}'>{original_text}</s> <b style='color:{COLORS['danger']}'>{promo_text}</b>")

    def price(self) -> Decimal:
        """Retorna el precio actual."""
        return self._price


class TotalDisplay(QFrame):
    """
    Widget para mostrar el total de la venta.

    Muestra subtotal, descuentos y total final.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._subtotal = Decimal("0")
        self._discount = Decimal("0")
        self._total = Decimal("0")

        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setFrameShape(QFrame.Shape.Box)
        self.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['surface']};
                border: 1px solid {COLORS['border']};
                border-radius: 8px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(8)

        # Subtotal
        subtotal_row = QHBoxLayout()
        self._subtotal_label = QLabel("Subtotal:")
        self._subtotal_label.setStyleSheet(f"color: {COLORS['text_secondary']};")
        self._subtotal_value = QLabel(format_currency(0))
        self._subtotal_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        subtotal_row.addWidget(self._subtotal_label)
        subtotal_row.addWidget(self._subtotal_value)
        layout.addLayout(subtotal_row)

        # Descuento (oculto por defecto)
        discount_row = QHBoxLayout()
        self._discount_label = QLabel("Descuento:")
        self._discount_label.setStyleSheet(f"color: {COLORS['success']};")
        self._discount_value = QLabel("-$0,00")
        self._discount_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        self._discount_value.setStyleSheet(f"color: {COLORS['success']};")
        discount_row.addWidget(self._discount_label)
        discount_row.addWidget(self._discount_value)
        self._discount_widget = QWidget()
        discount_widget_layout = QHBoxLayout(self._discount_widget)
        discount_widget_layout.setContentsMargins(0, 0, 0, 0)
        discount_widget_layout.addLayout(discount_row)
        self._discount_widget.hide()
        layout.addWidget(self._discount_widget)

        # Separador
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet(f"background-color: {COLORS['border']};")
        separator.setFixedHeight(1)
        layout.addWidget(separator)

        # Total
        total_row = QHBoxLayout()
        total_label = QLabel("TOTAL:")
        font = total_label.font()
        font.setPointSize(18)
        font.setWeight(QFont.Weight.Bold)
        total_label.setFont(font)

        self._total_value = QLabel(format_currency(0))
        self._total_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        font = self._total_value.font()
        font.setPointSize(24)
        font.setWeight(QFont.Weight.Bold)
        self._total_value.setFont(font)
        self._total_value.setStyleSheet(f"color: {COLORS['primary']};")

        total_row.addWidget(total_label)
        total_row.addWidget(self._total_value)
        layout.addLayout(total_row)

    def setSubtotal(self, value: Decimal) -> None:
        """Establece el subtotal."""
        self._subtotal = value
        self._subtotal_value.setText(format_currency(value))

    def setDiscount(self, value: Decimal) -> None:
        """Establece el descuento."""
        self._discount = value
        if value > 0:
            self._discount_value.setText(f"-{format_currency(value)}")
            self._discount_widget.show()
        else:
            self._discount_widget.hide()

    def setTotal(self, value: Decimal) -> None:
        """Establece el total."""
        self._total = value
        self._total_value.setText(format_currency(value))

    def setValues(
        self,
        subtotal: Decimal,
        discount: Decimal,
        total: Decimal,
    ) -> None:
        """Establece todos los valores."""
        self.setSubtotal(subtotal)
        self.setDiscount(discount)
        self.setTotal(total)

    def clear(self) -> None:
        """Limpia todos los valores."""
        self.setValues(Decimal("0"), Decimal("0"), Decimal("0"))


class StatusBadge(QLabel):
    """
    Badge de estado.

    Muestra un estado con color correspondiente.
    """

    STYLES = {
        "success": (COLORS["success_bg"], COLORS["success"]),
        "warning": (COLORS["warning_bg"], COLORS["warning"]),
        "danger": (COLORS["danger_bg"], COLORS["danger"]),
        "info": (COLORS["info_bg"], COLORS["info"]),
        "default": (COLORS["gray_200"], COLORS["text_secondary"]),
    }

    def __init__(
        self,
        text: str = "",
        variant: str = "default",
        parent=None,
    ):
        super().__init__(text, parent)
        self._variant = variant
        self._apply_style()

    def _apply_style(self) -> None:
        """Aplica estilo segun variante."""
        bg_color, text_color = self.STYLES.get(
            self._variant,
            self.STYLES["default"],
        )

        self.setStyleSheet(f"""
            QLabel {{
                background-color: {bg_color};
                color: {text_color};
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
            }}
        """)

    def setVariant(self, variant: str) -> None:
        """Cambia la variante de estilo."""
        self._variant = variant
        self._apply_style()


class ItemCountBadge(QLabel):
    """
    Badge de cantidad de items.

    Muestra la cantidad de items en el carrito.
    """

    def __init__(self, count: int = 0, parent=None):
        super().__init__(str(count), parent)
        self._count = count
        self._apply_style()

    def _apply_style(self) -> None:
        """Aplica estilo."""
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setStyleSheet(f"""
            QLabel {{
                background-color: {COLORS['primary']};
                color: {COLORS['white']};
                min-width: 24px;
                min-height: 24px;
                max-width: 36px;
                max-height: 24px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                padding: 2px 6px;
            }}
        """)

    def setCount(self, count: int) -> None:
        """Establece la cantidad."""
        self._count = count
        if count > 99:
            self.setText("99+")
        else:
            self.setText(str(count))
        self.setVisible(count > 0)

    def count(self) -> int:
        """Retorna la cantidad."""
        return self._count


class ConnectionStatus(QWidget):
    """
    Indicador de estado de conexion.

    Muestra si hay conexion con el servidor.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._is_connected = False
        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        self._indicator = QLabel()
        self._indicator.setFixedSize(10, 10)

        self._label = QLabel("Desconectado")
        self._label.setStyleSheet(f"color: {COLORS['text_secondary']}; font-size: 12px;")

        layout.addWidget(self._indicator)
        layout.addWidget(self._label)

        self._update_status()

    def _update_status(self) -> None:
        """Actualiza la visualizacion del estado."""
        if self._is_connected:
            color = COLORS["success"]
            text = "Conectado"
        else:
            color = COLORS["danger"]
            text = "Desconectado"

        self._indicator.setStyleSheet(f"""
            QLabel {{
                background-color: {color};
                border-radius: 5px;
            }}
        """)
        self._label.setText(text)

    def setConnected(self, connected: bool) -> None:
        """Establece el estado de conexion."""
        self._is_connected = connected
        self._update_status()

    def isConnected(self) -> bool:
        """Retorna si esta conectado."""
        return self._is_connected
