"""
Vista de cierre de caja.

Permite realizar el cierre del turno/caja.
"""

from typing import Optional, Dict, Any
from decimal import Decimal

from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QGridLayout,
    QMessageBox,
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles.theme import Theme


class CashCloseView(QWidget):
    """Vista para cierre de caja."""

    close_completed = pyqtSignal(dict)

    def __init__(self, theme: Theme, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.theme = theme
        self._summary: Dict[str, Any] = {}

        self._setup_ui()
        logger.debug("CashCloseView inicializado")

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(24)

        # Titulo
        title = QLabel("Cierre de Caja")
        title.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Descripcion
        desc = QLabel("Resumen del turno actual y cierre de caja")
        desc.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 14px;")
        layout.addWidget(desc)

        # Resumen en cards
        cards_layout = QHBoxLayout()
        cards_layout.setSpacing(16)

        # Card Ventas
        self.sales_card = self._create_summary_card(
            "Ventas del Turno",
            "$0.00",
            "0 transacciones",
            self.theme.primary
        )
        cards_layout.addWidget(self.sales_card)

        # Card Efectivo
        self.cash_card = self._create_summary_card(
            "Efectivo",
            "$0.00",
            "Cobrado en efectivo",
            self.theme.success
        )
        cards_layout.addWidget(self.cash_card)

        # Card Tarjeta
        self.card_card = self._create_summary_card(
            "Tarjeta/Otros",
            "$0.00",
            "Pagos electronicos",
            self.theme.info
        )
        cards_layout.addWidget(self.card_card)

        # Card Devoluciones
        self.refunds_card = self._create_summary_card(
            "Devoluciones",
            "$0.00",
            "0 devoluciones",
            self.theme.warning
        )
        cards_layout.addWidget(self.refunds_card)

        layout.addLayout(cards_layout)

        # Seccion de conteo
        count_frame = QFrame()
        count_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)
        count_layout = QVBoxLayout(count_frame)
        count_layout.setContentsMargins(24, 24, 24, 24)
        count_layout.setSpacing(16)

        count_title = QLabel("Conteo de Caja")
        count_title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        count_title.setStyleSheet(f"color: {self.theme.text_primary};")
        count_layout.addWidget(count_title)

        # Grid de conteo
        grid = QGridLayout()
        grid.setSpacing(12)

        # Fondo inicial
        grid.addWidget(QLabel("Fondo Inicial:"), 0, 0)
        self.initial_input = QLineEdit("0.00")
        self.initial_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.initial_input.setStyleSheet(self._input_style())
        grid.addWidget(self.initial_input, 0, 1)

        # Efectivo en caja
        grid.addWidget(QLabel("Efectivo Contado:"), 1, 0)
        self.counted_input = QLineEdit("0.00")
        self.counted_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.counted_input.setStyleSheet(self._input_style())
        self.counted_input.textChanged.connect(self._calculate_difference)
        grid.addWidget(self.counted_input, 1, 1)

        # Efectivo esperado
        grid.addWidget(QLabel("Efectivo Esperado:"), 2, 0)
        self.expected_label = QLabel("$0.00")
        self.expected_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.expected_label.setStyleSheet(f"font-weight: bold; color: {self.theme.text_primary};")
        grid.addWidget(self.expected_label, 2, 1)

        # Diferencia
        grid.addWidget(QLabel("Diferencia:"), 3, 0)
        self.difference_label = QLabel("$0.00")
        self.difference_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.difference_label.setStyleSheet(f"font-weight: bold; color: {self.theme.success};")
        grid.addWidget(self.difference_label, 3, 1)

        count_layout.addLayout(grid)
        layout.addWidget(count_frame)

        # Spacer
        layout.addStretch()

        # Botones
        buttons_layout = QHBoxLayout()
        buttons_layout.addStretch()

        # Imprimir resumen
        print_btn = QPushButton("Imprimir Resumen")
        print_btn.setMinimumHeight(44)
        print_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        print_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 8px;
                padding: 0 24px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        print_btn.clicked.connect(self._on_print)
        buttons_layout.addWidget(print_btn)

        # Cerrar caja
        close_btn = QPushButton("Cerrar Caja")
        close_btn.setMinimumHeight(44)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0 32px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        close_btn.clicked.connect(self._on_close_cash)
        buttons_layout.addWidget(close_btn)

        layout.addLayout(buttons_layout)

    def _create_summary_card(
        self,
        title: str,
        amount: str,
        subtitle: str,
        color: str
    ) -> QFrame:
        """Crea una card de resumen."""
        card = QFrame()
        card.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
                border-left: 4px solid {color};
            }}
        """)

        layout = QVBoxLayout(card)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        title_label = QLabel(title)
        title_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        layout.addWidget(title_label)

        amount_label = QLabel(amount)
        amount_label.setObjectName("amount")
        amount_label.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        amount_label.setStyleSheet(f"color: {color};")
        layout.addWidget(amount_label)

        subtitle_label = QLabel(subtitle)
        subtitle_label.setObjectName("subtitle")
        subtitle_label.setStyleSheet(f"color: {self.theme.text_muted}; font-size: 11px;")
        layout.addWidget(subtitle_label)

        return card

    def _input_style(self) -> str:
        """Estilo para inputs."""
        return f"""
            QLineEdit {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 16px;
                min-width: 150px;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """

    def _calculate_difference(self) -> None:
        """Calcula la diferencia."""
        try:
            counted = Decimal(self.counted_input.text() or "0")
            expected = Decimal(self.expected_label.text().replace("$", "").replace(",", "") or "0")
            diff = counted - expected

            if diff >= 0:
                self.difference_label.setText(f"${diff:,.2f}")
                self.difference_label.setStyleSheet(f"font-weight: bold; color: {self.theme.success};")
            else:
                self.difference_label.setText(f"-${abs(diff):,.2f}")
                self.difference_label.setStyleSheet(f"font-weight: bold; color: {self.theme.error};")
        except:
            self.difference_label.setText("$0.00")

    def set_summary(self, summary: Dict[str, Any]) -> None:
        """Actualiza el resumen."""
        self._summary = summary

        # Actualizar cards
        total = summary.get("total", 0)
        cash = summary.get("cash", 0)
        card = summary.get("card", 0)
        refunds = summary.get("refunds", 0)
        sales_count = summary.get("sales_count", 0)
        refunds_count = summary.get("refunds_count", 0)

        # Sales card
        amount_label = self.sales_card.findChild(QLabel, "amount")
        if amount_label:
            amount_label.setText(f"${total:,.2f}")
        subtitle_label = self.sales_card.findChild(QLabel, "subtitle")
        if subtitle_label:
            subtitle_label.setText(f"{sales_count} transacciones")

        # Cash card
        amount_label = self.cash_card.findChild(QLabel, "amount")
        if amount_label:
            amount_label.setText(f"${cash:,.2f}")

        # Card card
        amount_label = self.card_card.findChild(QLabel, "amount")
        if amount_label:
            amount_label.setText(f"${card:,.2f}")

        # Refunds card
        amount_label = self.refunds_card.findChild(QLabel, "amount")
        if amount_label:
            amount_label.setText(f"${refunds:,.2f}")
        subtitle_label = self.refunds_card.findChild(QLabel, "subtitle")
        if subtitle_label:
            subtitle_label.setText(f"{refunds_count} devoluciones")

        # Expected
        initial = Decimal(self.initial_input.text() or "0")
        expected = initial + Decimal(str(cash)) - Decimal(str(refunds))
        self.expected_label.setText(f"${expected:,.2f}")
        self._calculate_difference()

    def _on_print(self) -> None:
        """Imprime el resumen."""
        QMessageBox.information(
            self,
            "Imprimir",
            "Funcionalidad de impresion en desarrollo."
        )

    def _on_close_cash(self) -> None:
        """Cierra la caja."""
        reply = QMessageBox.question(
            self,
            "Confirmar Cierre",
            "¿Confirma el cierre de caja?\n\n"
            "Esta accion no se puede deshacer.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            QMessageBox.information(
                self,
                "Cierre de Caja",
                "Funcionalidad de cierre en desarrollo."
            )
