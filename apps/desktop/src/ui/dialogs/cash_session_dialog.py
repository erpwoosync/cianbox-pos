"""
Dialogo para gestion de sesion de caja.

Permite abrir y cerrar turnos de caja con:
- Monto inicial de apertura
- Arqueo de cierre con conteo de billetes/monedas
- Resumen de ventas y movimientos
"""

from typing import Optional, Dict, Any, Callable
from decimal import Decimal

from PyQt6.QtWidgets import (
    QDialog,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QGridLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QTabWidget,
    QSpinBox,
    QTextEdit,
    QMessageBox,
    QScrollArea,
    QSizePolicy,
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont, QDoubleValidator

from loguru import logger

from src.ui.styles import get_theme
from src.api.cash import (
    CashAPI,
    CashSession,
    CashCount,
    SessionSummary,
    CashMovementReason,
    get_cash_api,
)
from src.config.constants import BILL_DENOMINATIONS, COIN_DENOMINATIONS


class CashSessionDialog(QDialog):
    """
    Dialogo para abrir o cerrar sesion de caja.

    Signals:
        session_opened: Emitido cuando se abre una sesion
        session_closed: Emitido cuando se cierra una sesion
    """

    session_opened = pyqtSignal(object)  # CashSession
    session_closed = pyqtSignal(object)  # SessionSummary

    def __init__(
        self,
        mode: str = "open",  # "open" o "close"
        point_of_sale_id: Optional[str] = None,
        point_of_sale_name: Optional[str] = None,
        current_session: Optional[CashSession] = None,
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)

        self.mode = mode
        self.point_of_sale_id = point_of_sale_id
        self.point_of_sale_name = point_of_sale_name or "Caja"
        self.current_session = current_session
        self.theme = get_theme()
        self.cash_api = get_cash_api()

        # Estado del conteo
        self.bill_inputs: Dict[int, QSpinBox] = {}
        self.coin_inputs: Dict[int, QSpinBox] = {}

        self._setup_ui()
        self._update_totals()

        if mode == "open":
            self.setWindowTitle("Abrir Turno de Caja")
            logger.info(f"Abriendo dialogo para abrir caja: {point_of_sale_name}")
        else:
            self.setWindowTitle("Cerrar Turno de Caja")
            logger.info(f"Abriendo dialogo para cerrar caja: {current_session.session_number if current_session else ''}")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setMinimumSize(600, 700)
        self.resize(700, 800)

        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(24, 24, 24, 24)
        main_layout.setSpacing(20)

        # Header
        header = self._create_header()
        main_layout.addWidget(header)

        # Contenido segun modo
        if self.mode == "open":
            content = self._create_open_content()
        else:
            content = self._create_close_content()

        main_layout.addWidget(content, 1)

        # Botones de accion
        buttons = self._create_buttons()
        main_layout.addLayout(buttons)

    def _create_header(self) -> QFrame:
        """Crea el header con informacion de la caja."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.primary};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(8)

        # Titulo
        title = QLabel("Abrir Turno" if self.mode == "open" else "Cerrar Turno")
        title.setFont(QFont("Segoe UI", 20, QFont.Weight.Bold))
        title.setStyleSheet("color: white;")
        layout.addWidget(title)

        # Info de caja
        pos_name = self.point_of_sale_name
        if self.current_session:
            pos_name = self.current_session.point_of_sale_name or pos_name

        info = QLabel(f"Punto de Venta: {pos_name}")
        info.setStyleSheet("color: rgba(255, 255, 255, 0.9); font-size: 14px;")
        layout.addWidget(info)

        # Numero de turno si es cierre
        if self.mode == "close" and self.current_session:
            turno = QLabel(f"Turno: {self.current_session.session_number}")
            turno.setStyleSheet("color: rgba(255, 255, 255, 0.8); font-size: 13px;")
            layout.addWidget(turno)

        return frame

    def _create_open_content(self) -> QWidget:
        """Crea el contenido para abrir turno."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(16)

        # Frame de monto inicial
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        frame_layout = QVBoxLayout(frame)
        frame_layout.setContentsMargins(24, 24, 24, 24)
        frame_layout.setSpacing(16)

        # Label
        label = QLabel("Monto Inicial en Caja")
        label.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        label.setStyleSheet(f"color: {self.theme.text_primary};")
        frame_layout.addWidget(label)

        # Input de monto
        self.opening_amount_input = QLineEdit()
        self.opening_amount_input.setPlaceholderText("0.00")
        self.opening_amount_input.setValidator(QDoubleValidator(0, 999999999, 2))
        self.opening_amount_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.opening_amount_input.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        self.opening_amount_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.gray_50};
                border: 2px solid {self.theme.border};
                border-radius: 8px;
                padding: 16px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        frame_layout.addWidget(self.opening_amount_input)

        # Nota
        note = QLabel("Ingrese el efectivo con el que inicia el turno")
        note.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        frame_layout.addWidget(note)

        layout.addWidget(frame)

        # Notas opcionales
        notes_frame = QFrame()
        notes_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        notes_layout = QVBoxLayout(notes_frame)
        notes_layout.setContentsMargins(24, 16, 24, 16)
        notes_layout.setSpacing(8)

        notes_label = QLabel("Notas (opcional)")
        notes_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        notes_layout.addWidget(notes_label)

        self.notes_input = QTextEdit()
        self.notes_input.setMaximumHeight(80)
        self.notes_input.setPlaceholderText("Observaciones para el turno...")
        self.notes_input.setStyleSheet(f"""
            QTextEdit {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 8px;
                color: {self.theme.text_primary};
            }}
        """)
        notes_layout.addWidget(self.notes_input)

        layout.addWidget(notes_frame)
        layout.addStretch()

        return widget

    def _create_close_content(self) -> QWidget:
        """Crea el contenido para cerrar turno con arqueo."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Tabs para arqueo
        tabs = QTabWidget()
        tabs.setStyleSheet(f"""
            QTabWidget::pane {{
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                background-color: {self.theme.surface};
            }}
            QTabBar::tab {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_secondary};
                padding: 10px 20px;
                border: 1px solid {self.theme.border};
                border-bottom: none;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
            }}
            QTabBar::tab:selected {{
                background-color: {self.theme.surface};
                color: {self.theme.text_primary};
                font-weight: bold;
            }}
        """)

        # Tab de billetes
        bills_tab = self._create_bills_tab()
        tabs.addTab(bills_tab, "Billetes")

        # Tab de monedas
        coins_tab = self._create_coins_tab()
        tabs.addTab(coins_tab, "Monedas")

        # Tab de otros valores
        others_tab = self._create_others_tab()
        tabs.addTab(others_tab, "Otros")

        layout.addWidget(tabs)

        # Resumen de totales
        summary = self._create_totals_summary()
        layout.addWidget(summary)

        return widget

    def _create_bills_tab(self) -> QWidget:
        """Crea la tab de conteo de billetes."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        for value, name in BILL_DENOMINATIONS:
            row = self._create_denomination_row(value, f"${value:,}", is_bill=True)
            layout.addLayout(row)

        layout.addStretch()
        return widget

    def _create_coins_tab(self) -> QWidget:
        """Crea la tab de conteo de monedas."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        for value, name in COIN_DENOMINATIONS:
            row = self._create_denomination_row(value, f"${value}", is_bill=False)
            layout.addLayout(row)

        layout.addStretch()
        return widget

    def _create_others_tab(self) -> QWidget:
        """Crea la tab de otros valores."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Vouchers
        vouchers_layout = QHBoxLayout()
        vouchers_label = QLabel("Vouchers:")
        vouchers_label.setMinimumWidth(150)
        vouchers_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 14px;")
        vouchers_layout.addWidget(vouchers_label)

        self.vouchers_input = QLineEdit("0")
        self.vouchers_input.setValidator(QDoubleValidator(0, 999999999, 2))
        self.vouchers_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.vouchers_input.setFixedWidth(120)
        self.vouchers_input.textChanged.connect(self._update_totals)
        self.vouchers_input.setStyleSheet(self._input_style())
        vouchers_layout.addWidget(self.vouchers_input)
        vouchers_layout.addStretch()
        layout.addLayout(vouchers_layout)

        # Cheques
        checks_layout = QHBoxLayout()
        checks_label = QLabel("Cheques:")
        checks_label.setMinimumWidth(150)
        checks_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 14px;")
        checks_layout.addWidget(checks_label)

        self.checks_input = QLineEdit("0")
        self.checks_input.setValidator(QDoubleValidator(0, 999999999, 2))
        self.checks_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.checks_input.setFixedWidth(120)
        self.checks_input.textChanged.connect(self._update_totals)
        self.checks_input.setStyleSheet(self._input_style())
        checks_layout.addWidget(self.checks_input)
        checks_layout.addStretch()
        layout.addLayout(checks_layout)

        # Otros valores
        others_layout = QHBoxLayout()
        others_label = QLabel("Otros valores:")
        others_label.setMinimumWidth(150)
        others_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 14px;")
        others_layout.addWidget(others_label)

        self.other_values_input = QLineEdit("0")
        self.other_values_input.setValidator(QDoubleValidator(0, 999999999, 2))
        self.other_values_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.other_values_input.setFixedWidth(120)
        self.other_values_input.textChanged.connect(self._update_totals)
        self.other_values_input.setStyleSheet(self._input_style())
        others_layout.addWidget(self.other_values_input)
        others_layout.addStretch()
        layout.addLayout(others_layout)

        # Nota de otros valores
        note_label = QLabel("Descripcion de otros valores:")
        note_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        layout.addWidget(note_label)

        self.other_values_note = QTextEdit()
        self.other_values_note.setMaximumHeight(60)
        self.other_values_note.setPlaceholderText("Detalle de otros valores...")
        self.other_values_note.setStyleSheet(f"""
            QTextEdit {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 8px;
            }}
        """)
        layout.addWidget(self.other_values_note)

        # Notas de cierre
        notes_label = QLabel("Notas de cierre:")
        notes_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        layout.addWidget(notes_label)

        self.close_notes_input = QTextEdit()
        self.close_notes_input.setMaximumHeight(60)
        self.close_notes_input.setPlaceholderText("Observaciones del cierre...")
        self.close_notes_input.setStyleSheet(f"""
            QTextEdit {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 8px;
            }}
        """)
        layout.addWidget(self.close_notes_input)

        layout.addStretch()
        return widget

    def _create_denomination_row(self, value: int, label: str, is_bill: bool) -> QHBoxLayout:
        """Crea una fila para contar una denominacion."""
        layout = QHBoxLayout()
        layout.setSpacing(12)

        # Label de denominacion
        denom_label = QLabel(label)
        denom_label.setFixedWidth(100)
        denom_label.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        denom_label.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(denom_label)

        # SpinBox para cantidad
        spin = QSpinBox()
        spin.setRange(0, 9999)
        spin.setValue(0)
        spin.setFixedWidth(80)
        spin.setAlignment(Qt.AlignmentFlag.AlignRight)
        spin.setStyleSheet(self._spinbox_style())
        spin.valueChanged.connect(self._update_totals)
        layout.addWidget(spin)

        # Label "x"
        x_label = QLabel("x")
        x_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        layout.addWidget(x_label)

        # Subtotal
        subtotal = QLabel("$0")
        subtotal.setFixedWidth(100)
        subtotal.setAlignment(Qt.AlignmentFlag.AlignRight)
        subtotal.setStyleSheet(f"color: {self.theme.text_primary}; font-weight: 500;")
        subtotal.setProperty("denomination", value)
        layout.addWidget(subtotal)

        layout.addStretch()

        # Guardar referencia
        if is_bill:
            self.bill_inputs[value] = spin
        else:
            self.coin_inputs[value] = spin

        # Guardar referencia al label de subtotal
        spin.setProperty("subtotal_label", subtotal)

        return layout

    def _create_totals_summary(self) -> QFrame:
        """Crea el resumen de totales."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                margin-top: 12px;
            }}
        """)

        layout = QGridLayout(frame)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Total billetes
        layout.addWidget(QLabel("Total Billetes:"), 0, 0)
        self.total_bills_label = QLabel("$0")
        self.total_bills_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.total_bills_label.setStyleSheet(f"font-weight: 500; color: {self.theme.text_primary};")
        layout.addWidget(self.total_bills_label, 0, 1)

        # Total monedas
        layout.addWidget(QLabel("Total Monedas:"), 1, 0)
        self.total_coins_label = QLabel("$0")
        self.total_coins_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.total_coins_label.setStyleSheet(f"font-weight: 500; color: {self.theme.text_primary};")
        layout.addWidget(self.total_coins_label, 1, 1)

        # Total otros
        layout.addWidget(QLabel("Total Otros:"), 2, 0)
        self.total_others_label = QLabel("$0")
        self.total_others_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.total_others_label.setStyleSheet(f"font-weight: 500; color: {self.theme.text_primary};")
        layout.addWidget(self.total_others_label, 2, 1)

        # Separador
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {self.theme.border};")
        layout.addWidget(sep, 3, 0, 1, 2)

        # Total contado
        total_label = QLabel("TOTAL CONTADO:")
        total_label.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        layout.addWidget(total_label, 4, 0)

        self.total_counted_label = QLabel("$0")
        self.total_counted_label.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        self.total_counted_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.total_counted_label.setStyleSheet(f"color: {self.theme.primary};")
        layout.addWidget(self.total_counted_label, 4, 1)

        # Efectivo esperado (si hay sesion)
        if self.current_session:
            expected_label = QLabel("Efectivo esperado:")
            expected_label.setStyleSheet(f"color: {self.theme.text_secondary};")
            layout.addWidget(expected_label, 5, 0)

            expected = self.current_session.expected_cash
            self.expected_label = QLabel(f"${expected:,.2f}")
            self.expected_label.setAlignment(Qt.AlignmentFlag.AlignRight)
            self.expected_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-weight: 500;")
            layout.addWidget(self.expected_label, 5, 1)

            # Diferencia
            diff_label = QLabel("Diferencia:")
            layout.addWidget(diff_label, 6, 0)

            self.difference_label = QLabel("$0")
            self.difference_label.setAlignment(Qt.AlignmentFlag.AlignRight)
            self.difference_label.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
            layout.addWidget(self.difference_label, 6, 1)

        return frame

    def _create_buttons(self) -> QHBoxLayout:
        """Crea los botones de accion."""
        layout = QHBoxLayout()
        layout.setSpacing(12)

        # Cancelar
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setFixedHeight(48)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.setStyleSheet(f"""
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
        cancel_btn.clicked.connect(self.reject)
        layout.addWidget(cancel_btn)

        layout.addStretch()

        # Confirmar
        if self.mode == "open":
            confirm_text = "Abrir Turno"
            confirm_color = self.theme.success
            confirm_color_hover = self.theme.success_dark
        else:
            confirm_text = "Cerrar Turno"
            confirm_color = self.theme.primary
            confirm_color_hover = self.theme.primary_dark

        confirm_btn = QPushButton(confirm_text)
        confirm_btn.setFixedHeight(48)
        confirm_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        confirm_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {confirm_color};
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0 32px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {confirm_color_hover};
            }}
        """)
        confirm_btn.clicked.connect(self._on_confirm)
        layout.addWidget(confirm_btn)

        return layout

    def _input_style(self) -> str:
        """Estilo comun para inputs."""
        return f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """

    def _spinbox_style(self) -> str:
        """Estilo comun para spinbox."""
        return f"""
            QSpinBox {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 6px 8px;
                font-size: 14px;
            }}
            QSpinBox:focus {{
                border-color: {self.theme.primary};
            }}
            QSpinBox::up-button, QSpinBox::down-button {{
                width: 20px;
            }}
        """

    def _update_totals(self) -> None:
        """Actualiza los totales del arqueo."""
        if self.mode == "open":
            return

        # Calcular total billetes
        total_bills = 0
        for value, spin in self.bill_inputs.items():
            qty = spin.value()
            subtotal = qty * value
            total_bills += subtotal

            # Actualizar label de subtotal
            label = spin.property("subtotal_label")
            if label:
                label.setText(f"${subtotal:,}")

        # Calcular total monedas
        total_coins = 0
        for value, spin in self.coin_inputs.items():
            qty = spin.value()
            subtotal = qty * value
            total_coins += subtotal

            # Actualizar label de subtotal
            label = spin.property("subtotal_label")
            if label:
                label.setText(f"${subtotal:,}")

        # Calcular otros
        try:
            vouchers = float(self.vouchers_input.text() or 0)
            checks = float(self.checks_input.text() or 0)
            other_values = float(self.other_values_input.text() or 0)
        except ValueError:
            vouchers = checks = other_values = 0

        total_others = vouchers + checks + other_values
        total = total_bills + total_coins + total_others

        # Actualizar labels
        self.total_bills_label.setText(f"${total_bills:,.2f}")
        self.total_coins_label.setText(f"${total_coins:,.2f}")
        self.total_others_label.setText(f"${total_others:,.2f}")
        self.total_counted_label.setText(f"${total:,.2f}")

        # Calcular diferencia si hay sesion
        if self.current_session and hasattr(self, 'difference_label'):
            expected = self.current_session.expected_cash
            diff = total - expected

            if diff >= 0:
                self.difference_label.setText(f"+${diff:,.2f}")
                self.difference_label.setStyleSheet(f"color: {self.theme.success}; font-weight: bold;")
            else:
                self.difference_label.setText(f"-${abs(diff):,.2f}")
                self.difference_label.setStyleSheet(f"color: {self.theme.danger}; font-weight: bold;")

    def _on_confirm(self) -> None:
        """Confirma la accion."""
        if self.mode == "open":
            self._open_session()
        else:
            self._close_session()

    def _open_session(self) -> None:
        """Abre el turno de caja."""
        try:
            amount_text = self.opening_amount_input.text().strip()
            if not amount_text:
                amount_text = "0"

            opening_amount = float(amount_text)
        except ValueError:
            QMessageBox.warning(self, "Error", "El monto ingresado no es valido")
            return

        if not self.point_of_sale_id:
            QMessageBox.warning(self, "Error", "No se ha seleccionado un punto de venta")
            return

        notes = self.notes_input.toPlainText().strip() or None

        # Llamar a la API
        session, error = self.cash_api.open_session(
            point_of_sale_id=self.point_of_sale_id,
            opening_amount=opening_amount,
            notes=notes,
        )

        if error:
            QMessageBox.critical(self, "Error", f"No se pudo abrir el turno:\n{error}")
            return

        QMessageBox.information(
            self,
            "Turno Abierto",
            f"Turno {session.session_number} abierto exitosamente.\n\n"
            f"Monto inicial: ${opening_amount:,.2f}"
        )

        self.session_opened.emit(session)
        self.accept()

    def _close_session(self) -> None:
        """Cierra el turno de caja."""
        # Construir objeto de arqueo
        count = CashCount(
            bills={str(v): spin.value() for v, spin in self.bill_inputs.items()},
            coins={str(v): spin.value() for v, spin in self.coin_inputs.items()},
            vouchers=float(self.vouchers_input.text() or 0),
            checks=float(self.checks_input.text() or 0),
            other_values=float(self.other_values_input.text() or 0),
            other_values_note=self.other_values_note.toPlainText().strip() or None,
        )

        notes = self.close_notes_input.toPlainText().strip() or None

        # Confirmar cierre
        total = count.calculate_total()
        reply = QMessageBox.question(
            self,
            "Confirmar Cierre",
            f"Confirma el cierre de turno?\n\n"
            f"Total contado: ${total:,.2f}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        # Llamar a la API
        summary, error = self.cash_api.close_session(count=count, notes=notes)

        if error:
            QMessageBox.critical(self, "Error", f"No se pudo cerrar el turno:\n{error}")
            return

        # Mostrar resumen
        diff_text = ""
        if summary.difference != 0:
            if summary.difference > 0:
                diff_text = f"\nSobrante: ${summary.difference:,.2f}"
            else:
                diff_text = f"\nFaltante: ${abs(summary.difference):,.2f}"

        QMessageBox.information(
            self,
            "Turno Cerrado",
            f"Turno cerrado exitosamente.\n\n"
            f"Ventas: {summary.sales_count} (${summary.sales_total:,.2f})\n"
            f"Efectivo esperado: ${summary.expected_amount:,.2f}\n"
            f"Efectivo contado: ${summary.closing_amount:,.2f}"
            f"{diff_text}"
        )

        self.session_closed.emit(summary)
        self.accept()
