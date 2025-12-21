"""
Componentes de entrada de datos.

Proporciona inputs estilizados y especializados:
- SearchBox: Caja de busqueda con icono
- QuantitySpinner: Selector de cantidad
- MoneyInput: Entrada de montos
- BarcodeInput: Entrada de codigos de barras

Uso:
    >>> from src.ui.components import SearchBox, QuantitySpinner
    >>> search = SearchBox(placeholder="Buscar producto...")
    >>> search.textChanged.connect(handle_search)
"""

from decimal import Decimal
from typing import Optional

from PyQt6.QtCore import Qt, pyqtSignal, QTimer
from PyQt6.QtGui import QIntValidator, QDoubleValidator, QFont
from PyQt6.QtWidgets import (
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QLineEdit,
    QPushButton,
    QLabel,
    QSpinBox,
    QDoubleSpinBox,
)

from src.config.constants import (
    COLORS,
    SEARCH_DEBOUNCE_MS,
    SEARCH_MIN_CHARS,
    MAX_ITEM_QUANTITY,
)
from src.utils.formatters import format_currency


class SearchBox(QLineEdit):
    """
    Caja de busqueda con debounce.

    Emite searchTriggered despues de un delay para evitar
    busquedas excesivas mientras el usuario escribe.

    Signals:
        searchTriggered: Emitido cuando se debe ejecutar la busqueda
    """

    searchTriggered = pyqtSignal(str)

    def __init__(
        self,
        placeholder: str = "Buscar...",
        parent=None,
        debounce_ms: int = SEARCH_DEBOUNCE_MS,
        min_chars: int = SEARCH_MIN_CHARS,
    ):
        super().__init__(parent)
        self._debounce_ms = debounce_ms
        self._min_chars = min_chars
        self._timer = QTimer()
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self._on_timer)

        self.setPlaceholderText(placeholder)
        self.setClearButtonEnabled(True)
        self.textChanged.connect(self._on_text_changed)

        self.setStyleSheet(f"""
            QLineEdit {{
                background-color: {COLORS['white']};
                border: 1px solid {COLORS['border']};
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
                color: {COLORS['text_primary']};
            }}
            QLineEdit:focus {{
                border-color: {COLORS['primary']};
                outline: none;
            }}
            QLineEdit::placeholder {{
                color: {COLORS['text_muted']};
            }}
        """)

    def _on_text_changed(self, text: str) -> None:
        """Maneja cambio de texto con debounce."""
        self._timer.stop()

        if len(text) >= self._min_chars or len(text) == 0:
            self._timer.start(self._debounce_ms)

    def _on_timer(self) -> None:
        """Emite la senal de busqueda."""
        self.searchTriggered.emit(self.text())


class QuantitySpinner(QWidget):
    """
    Selector de cantidad con botones +/-.

    Signals:
        valueChanged: Emitido cuando cambia la cantidad
    """

    valueChanged = pyqtSignal(int)

    def __init__(
        self,
        parent=None,
        min_value: int = 1,
        max_value: int = MAX_ITEM_QUANTITY,
        initial_value: int = 1,
    ):
        super().__init__(parent)
        self._min_value = min_value
        self._max_value = max_value
        self._value = initial_value

        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        # Boton -
        self._minus_btn = QPushButton("-")
        self._minus_btn.setFixedSize(36, 36)
        self._minus_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._minus_btn.clicked.connect(self._decrease)
        self._minus_btn.setStyleSheet(self._button_style())

        # Input
        self._input = QLineEdit(str(self._value))
        self._input.setFixedWidth(60)
        self._input.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._input.setValidator(QIntValidator(self._min_value, self._max_value))
        self._input.textChanged.connect(self._on_input_changed)
        self._input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {COLORS['white']};
                border: 1px solid {COLORS['border']};
                border-radius: 4px;
                padding: 8px;
                font-size: 14px;
                font-weight: 600;
            }}
            QLineEdit:focus {{
                border-color: {COLORS['primary']};
            }}
        """)

        # Boton +
        self._plus_btn = QPushButton("+")
        self._plus_btn.setFixedSize(36, 36)
        self._plus_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._plus_btn.clicked.connect(self._increase)
        self._plus_btn.setStyleSheet(self._button_style())

        layout.addWidget(self._minus_btn)
        layout.addWidget(self._input)
        layout.addWidget(self._plus_btn)

        self._update_buttons()

    def _button_style(self) -> str:
        """Retorna estilo para los botones."""
        return f"""
            QPushButton {{
                background-color: {COLORS['gray_100']};
                border: 1px solid {COLORS['border']};
                border-radius: 4px;
                font-size: 18px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {COLORS['gray_200']};
            }}
            QPushButton:pressed {{
                background-color: {COLORS['gray_300']};
            }}
            QPushButton:disabled {{
                color: {COLORS['gray_400']};
            }}
        """

    def _increase(self) -> None:
        """Incrementa el valor."""
        if self._value < self._max_value:
            self.setValue(self._value + 1)

    def _decrease(self) -> None:
        """Decrementa el valor."""
        if self._value > self._min_value:
            self.setValue(self._value - 1)

    def _on_input_changed(self, text: str) -> None:
        """Maneja cambio en el input."""
        if text:
            try:
                value = int(text)
                if self._min_value <= value <= self._max_value:
                    self._value = value
                    self._update_buttons()
                    self.valueChanged.emit(self._value)
            except ValueError:
                pass

    def _update_buttons(self) -> None:
        """Actualiza estado de botones."""
        self._minus_btn.setEnabled(self._value > self._min_value)
        self._plus_btn.setEnabled(self._value < self._max_value)

    def value(self) -> int:
        """Retorna el valor actual."""
        return self._value

    def setValue(self, value: int) -> None:
        """Establece el valor."""
        self._value = max(self._min_value, min(self._max_value, value))
        self._input.setText(str(self._value))
        self._update_buttons()
        self.valueChanged.emit(self._value)


class MoneyInput(QLineEdit):
    """
    Entrada de monto monetario.

    Formatea automaticamente el valor ingresado.

    Signals:
        amountChanged: Emitido cuando cambia el monto
    """

    amountChanged = pyqtSignal(object)  # Decimal

    def __init__(
        self,
        parent=None,
        placeholder: str = "$0,00",
        allow_negative: bool = False,
    ):
        super().__init__(parent)
        self._amount = Decimal("0")
        self._allow_negative = allow_negative

        self.setPlaceholderText(placeholder)
        self.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.editingFinished.connect(self._on_editing_finished)

        font = self.font()
        font.setPointSize(16)
        font.setWeight(QFont.Weight.Bold)
        self.setFont(font)

        self.setStyleSheet(f"""
            QLineEdit {{
                background-color: {COLORS['white']};
                border: 2px solid {COLORS['border']};
                border-radius: 8px;
                padding: 12px 16px;
                font-size: 18px;
                color: {COLORS['text_primary']};
            }}
            QLineEdit:focus {{
                border-color: {COLORS['primary']};
            }}
        """)

    def _on_editing_finished(self) -> None:
        """Formatea el monto al perder el foco."""
        text = self.text().strip()
        if not text:
            self._amount = Decimal("0")
        else:
            # Limpiar formato
            cleaned = text.replace("$", "").replace(".", "").replace(",", ".").strip()
            try:
                self._amount = Decimal(cleaned)
                if not self._allow_negative and self._amount < 0:
                    self._amount = Decimal("0")
            except Exception:
                self._amount = Decimal("0")

        self.setText(format_currency(self._amount))
        self.amountChanged.emit(self._amount)

    def amount(self) -> Decimal:
        """Retorna el monto actual."""
        return self._amount

    def setAmount(self, amount: Decimal) -> None:
        """Establece el monto."""
        self._amount = amount
        self.setText(format_currency(amount))


class BarcodeInput(QLineEdit):
    """
    Entrada de codigo de barras.

    Optimizado para lectores de codigo de barras:
    - Acepta Enter como confirmacion
    - Limpia automaticamente despues de confirmar

    Signals:
        barcodeScanned: Emitido cuando se escanea un codigo
    """

    barcodeScanned = pyqtSignal(str)

    def __init__(
        self,
        parent=None,
        placeholder: str = "Escanear codigo de barras...",
        auto_clear: bool = True,
    ):
        super().__init__(parent)
        self._auto_clear = auto_clear

        self.setPlaceholderText(placeholder)
        self.returnPressed.connect(self._on_enter)

        self.setStyleSheet(f"""
            QLineEdit {{
                background-color: {COLORS['white']};
                border: 1px solid {COLORS['border']};
                border-radius: 6px;
                padding: 10px 12px;
                font-size: 14px;
                font-family: monospace;
            }}
            QLineEdit:focus {{
                border-color: {COLORS['primary']};
            }}
        """)

    def _on_enter(self) -> None:
        """Procesa el codigo escaneado."""
        barcode = self.text().strip()
        if barcode:
            self.barcodeScanned.emit(barcode)
            if self._auto_clear:
                self.clear()
