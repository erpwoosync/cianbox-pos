"""
Dialogo de checkout/cobro para el POS.

Permite procesar el pago de una venta con:
- Multiples metodos de pago (efectivo, tarjeta, QR)
- Calculo de vuelto para efectivo
- Teclado numerico en pantalla
- Montos rapidos
- Pago multiple (split payment)
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

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
    QScrollArea,
    QStackedWidget,
    QComboBox,
    QButtonGroup,
    QRadioButton,
    QMessageBox,
    QSizePolicy,
    QSpacerItem,
)
from PyQt6.QtCore import Qt, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QKeyEvent
from loguru import logger

from src.config.constants import PaymentMethod, BILL_DENOMINATIONS
from src.ui.styles import get_theme


@dataclass
class PaymentData:
    """Datos de un pago individual."""
    method: PaymentMethod
    amount: float
    card_last_digits: Optional[str] = None
    installments: int = 1
    reference: Optional[str] = None


@dataclass
class CheckoutResult:
    """Resultado del proceso de checkout."""
    success: bool
    payments: List[PaymentData] = field(default_factory=list)
    total_paid: float = 0.0
    change: float = 0.0
    cancelled: bool = False


class CheckoutDialog(QDialog):
    """
    Dialogo modal para procesar el cobro de una venta.

    Caracteristicas:
    - Muestra resumen de la venta
    - Multiples metodos de pago
    - Teclado numerico tactil
    - Calculo de vuelto
    - Soporte para pago multiple

    Signals:
        payment_confirmed: Emitido cuando se confirma el pago
        payment_cancelled: Emitido cuando se cancela el pago
    """

    payment_confirmed = pyqtSignal(object)  # CheckoutResult
    payment_cancelled = pyqtSignal()

    def __init__(
        self,
        items: List[Dict[str, Any]],
        total: float,
        subtotal: float = None,
        discount: float = 0.0,
        parent: QWidget = None,
    ):
        super().__init__(parent)

        self.items = items
        self.total = total
        self.subtotal = subtotal or total
        self.discount = discount
        self.theme = get_theme()

        # Estado de pagos
        self.payments: List[PaymentData] = []
        self.current_method: PaymentMethod = PaymentMethod.CASH
        self.cash_amount: float = 0.0
        self.remaining_amount: float = total

        # Configurar dialogo
        self.setWindowTitle("Cobrar Venta")
        self.setModal(True)
        self.setMinimumSize(900, 700)
        self.resize(1000, 750)

        self._setup_ui()
        self._setup_shortcuts()
        self._update_display()

        logger.info(f"Checkout iniciado - Total: ${total:,.2f}")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        main_layout = QHBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Panel izquierdo - Resumen de venta
        left_panel = self._create_summary_panel()
        main_layout.addWidget(left_panel)

        # Panel derecho - Metodos de pago
        right_panel = self._create_payment_panel()
        main_layout.addWidget(right_panel, 1)

    def _create_summary_panel(self) -> QFrame:
        """Crea el panel izquierdo con el resumen de la venta."""
        panel = QFrame()
        panel.setFixedWidth(320)
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_900};
                border-right: 1px solid {self.theme.gray_700};
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Titulo
        title = QLabel("Resumen de Venta")
        title.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_inverse}; background: transparent;")
        layout.addWidget(title)

        # Lista de items
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(f"""
            QScrollArea {{
                border: none;
                background: transparent;
            }}
            QScrollArea > QWidget > QWidget {{
                background: transparent;
            }}
        """)

        items_widget = QWidget()
        items_widget.setStyleSheet("background: transparent;")
        items_layout = QVBoxLayout(items_widget)
        items_layout.setContentsMargins(0, 0, 0, 0)
        items_layout.setSpacing(8)

        for item in self.items:
            item_frame = self._create_item_row(item)
            items_layout.addWidget(item_frame)

        items_layout.addStretch()
        scroll.setWidget(items_widget)
        layout.addWidget(scroll, 1)

        # Separador
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {self.theme.gray_700};")
        layout.addWidget(sep)

        # Totales
        totals_widget = QWidget()
        totals_widget.setStyleSheet("background: transparent;")
        totals_layout = QVBoxLayout(totals_widget)
        totals_layout.setContentsMargins(0, 0, 0, 0)
        totals_layout.setSpacing(8)

        # Subtotal
        row1 = QHBoxLayout()
        row1.addWidget(self._styled_label("Subtotal", color=self.theme.gray_400))
        row1.addWidget(self._styled_label(
            f"${self.subtotal:,.2f}",
            color=self.theme.text_inverse,
            align=Qt.AlignmentFlag.AlignRight
        ))
        totals_layout.addLayout(row1)

        # Descuento
        if self.discount > 0:
            row2 = QHBoxLayout()
            row2.addWidget(self._styled_label("Descuento", color=self.theme.success))
            row2.addWidget(self._styled_label(
                f"-${self.discount:,.2f}",
                color=self.theme.success,
                align=Qt.AlignmentFlag.AlignRight
            ))
            totals_layout.addLayout(row2)

        # Total
        row3 = QHBoxLayout()
        total_label = QLabel("TOTAL")
        total_label.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        total_label.setStyleSheet(f"color: {self.theme.text_inverse}; background: transparent;")
        row3.addWidget(total_label)

        total_value = QLabel(f"${self.total:,.2f}")
        total_value.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        total_value.setStyleSheet(f"color: {self.theme.primary_light}; background: transparent;")
        total_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        row3.addWidget(total_value)
        totals_layout.addLayout(row3)

        layout.addWidget(totals_widget)

        # Monto restante (para pagos multiples)
        self.remaining_widget = QWidget()
        self.remaining_widget.setStyleSheet("background: transparent;")
        remaining_layout = QVBoxLayout(self.remaining_widget)
        remaining_layout.setContentsMargins(0, 12, 0, 0)
        remaining_layout.setSpacing(4)

        sep2 = QFrame()
        sep2.setFixedHeight(1)
        sep2.setStyleSheet(f"background-color: {self.theme.gray_700};")
        remaining_layout.addWidget(sep2)

        remaining_row = QHBoxLayout()
        remaining_row.addWidget(self._styled_label("Restante", color=self.theme.warning))
        self.remaining_label = QLabel(f"${self.remaining_amount:,.2f}")
        self.remaining_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        self.remaining_label.setStyleSheet(f"color: {self.theme.warning}; background: transparent;")
        self.remaining_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        remaining_row.addWidget(self.remaining_label)
        remaining_layout.addLayout(remaining_row)

        layout.addWidget(self.remaining_widget)
        self.remaining_widget.hide()  # Oculto inicialmente

        # Lista de pagos realizados
        self.payments_widget = QWidget()
        self.payments_widget.setStyleSheet("background: transparent;")
        self.payments_layout = QVBoxLayout(self.payments_widget)
        self.payments_layout.setContentsMargins(0, 12, 0, 0)
        self.payments_layout.setSpacing(4)

        payments_title = QLabel("Pagos:")
        payments_title.setStyleSheet(f"color: {self.theme.gray_400}; font-size: 12px; background: transparent;")
        self.payments_layout.addWidget(payments_title)

        layout.addWidget(self.payments_widget)
        self.payments_widget.hide()  # Oculto inicialmente

        return panel

    def _create_item_row(self, item: Dict[str, Any]) -> QFrame:
        """Crea una fila para un item del carrito."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_800};
                border-radius: 6px;
                padding: 8px;
            }}
        """)

        layout = QHBoxLayout(frame)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(8)

        # Cantidad
        qty = QLabel(f"{item.get('quantity', 1)}x")
        qty.setFixedWidth(30)
        qty.setStyleSheet(f"""
            color: {self.theme.primary_light};
            font-size: 12px;
            font-weight: 600;
            background: transparent;
        """)
        layout.addWidget(qty)

        # Nombre
        name = QLabel(item.get("name", "Producto"))
        name.setStyleSheet(f"""
            color: {self.theme.text_inverse};
            font-size: 12px;
            background: transparent;
        """)
        name.setWordWrap(True)
        layout.addWidget(name, 1)

        # Subtotal
        subtotal = item.get("subtotal", item.get("price", 0) * item.get("quantity", 1))
        price = QLabel(f"${subtotal:,.2f}")
        price.setStyleSheet(f"""
            color: {self.theme.text_inverse};
            font-size: 12px;
            font-weight: 500;
            background: transparent;
        """)
        layout.addWidget(price)

        return frame

    def _styled_label(
        self,
        text: str,
        color: str = None,
        size: int = 13,
        weight: QFont.Weight = QFont.Weight.Normal,
        align: Qt.AlignmentFlag = Qt.AlignmentFlag.AlignLeft,
    ) -> QLabel:
        """Crea un label estilizado."""
        label = QLabel(text)
        label.setFont(QFont("Segoe UI", size, weight))
        color = color or self.theme.text_inverse
        label.setStyleSheet(f"color: {color}; background: transparent;")
        label.setAlignment(align | Qt.AlignmentFlag.AlignVCenter)
        return label

    def _create_payment_panel(self) -> QFrame:
        """Crea el panel derecho con los metodos de pago."""
        panel = QFrame()
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(16)

        # Titulo y metodos de pago
        header = QHBoxLayout()

        title = QLabel("Metodo de Pago")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        header.addWidget(title)

        header.addStretch()
        layout.addLayout(header)

        # Botones de metodos de pago
        methods_layout = QHBoxLayout()
        methods_layout.setSpacing(8)

        self.method_buttons: Dict[PaymentMethod, QPushButton] = {}
        methods = [
            (PaymentMethod.CASH, "Efectivo", self.theme.success),
            (PaymentMethod.DEBIT_CARD, "Debito", self.theme.info),
            (PaymentMethod.CREDIT_CARD, "Credito", self.theme.primary),
            (PaymentMethod.QR, "QR / MP", self.theme.secondary),
            (PaymentMethod.GIFTCARD, "Gift Card", "#9b59b6"),  # Morado para GC
        ]

        for method, name, color in methods:
            btn = QPushButton(name)
            btn.setFixedHeight(50)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setCheckable(True)
            btn.setProperty("method", method)
            btn.setProperty("color", color)
            btn.clicked.connect(lambda checked, m=method: self._select_method(m))
            self.method_buttons[method] = btn
            methods_layout.addWidget(btn)

        layout.addLayout(methods_layout)

        # Contenedor de contenido por metodo (stacked widget)
        self.payment_stack = QStackedWidget()

        # Panel de efectivo
        cash_panel = self._create_cash_panel()
        self.payment_stack.addWidget(cash_panel)

        # Panel de tarjeta de debito
        debit_panel = self._create_card_panel(is_credit=False)
        self.payment_stack.addWidget(debit_panel)

        # Panel de tarjeta de credito
        credit_panel = self._create_card_panel(is_credit=True)
        self.payment_stack.addWidget(credit_panel)

        # Panel de QR
        qr_panel = self._create_qr_panel()
        self.payment_stack.addWidget(qr_panel)

        # Panel de Gift Card
        giftcard_panel = self._create_giftcard_panel()
        self.payment_stack.addWidget(giftcard_panel)

        layout.addWidget(self.payment_stack, 1)

        # Botones de accion
        actions_layout = QHBoxLayout()
        actions_layout.setSpacing(12)

        # Boton cancelar
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setFixedHeight(56)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 12px;
                padding: 0 32px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        cancel_btn.clicked.connect(self._on_cancel)
        actions_layout.addWidget(cancel_btn)

        # Boton confirmar
        self.confirm_btn = QPushButton("CONFIRMAR PAGO")
        self.confirm_btn.setFixedHeight(56)
        self.confirm_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.confirm_btn.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        self.confirm_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.success};
                color: white;
                border: none;
                border-radius: 12px;
                padding: 0 48px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.success_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
                color: {self.theme.gray_500};
            }}
        """)
        self.confirm_btn.clicked.connect(self._on_confirm)
        actions_layout.addWidget(self.confirm_btn, 1)

        layout.addLayout(actions_layout)

        # Seleccionar efectivo por defecto
        self._select_method(PaymentMethod.CASH)

        return panel

    def _create_cash_panel(self) -> QWidget:
        """Crea el panel de pago en efectivo."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 16, 0, 0)
        layout.setSpacing(20)

        # Monto a pagar (display)
        amount_frame = QFrame()
        amount_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: 2px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)
        amount_layout = QVBoxLayout(amount_frame)
        amount_layout.setContentsMargins(20, 16, 20, 16)
        amount_layout.setSpacing(4)

        amount_label = QLabel("Monto recibido")
        amount_label.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        amount_layout.addWidget(amount_label)

        self.cash_display = QLabel("$0.00")
        self.cash_display.setFont(QFont("Segoe UI", 36, QFont.Weight.Bold))
        self.cash_display.setStyleSheet(f"color: {self.theme.text_primary};")
        self.cash_display.setAlignment(Qt.AlignmentFlag.AlignCenter)
        amount_layout.addWidget(self.cash_display)

        layout.addWidget(amount_frame)

        # Vuelto
        self.change_frame = QFrame()
        self.change_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.success_bg};
                border: 2px solid {self.theme.success};
                border-radius: 12px;
            }}
        """)
        change_layout = QHBoxLayout(self.change_frame)
        change_layout.setContentsMargins(20, 12, 20, 12)

        change_label = QLabel("Vuelto:")
        change_label.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        change_label.setStyleSheet(f"color: {self.theme.success_dark};")
        change_layout.addWidget(change_label)

        self.change_display = QLabel("$0.00")
        self.change_display.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        self.change_display.setStyleSheet(f"color: {self.theme.success_dark};")
        self.change_display.setAlignment(Qt.AlignmentFlag.AlignRight)
        change_layout.addWidget(self.change_display)

        layout.addWidget(self.change_frame)
        self.change_frame.hide()

        # Montos rapidos
        quick_layout = QHBoxLayout()
        quick_layout.setSpacing(8)

        quick_amounts = [
            ("$500", 500),
            ("$1000", 1000),
            ("$2000", 2000),
            ("$5000", 5000),
            ("$10000", 10000),
            ("Exacto", -1),  # -1 significa monto exacto
        ]

        for label, amount in quick_amounts:
            btn = QPushButton(label)
            btn.setFixedHeight(48)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setFont(QFont("Segoe UI", 12, QFont.Weight.Medium))

            if amount == -1:
                # Boton de monto exacto
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.primary};
                        color: white;
                        border: none;
                        border-radius: 8px;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.primary_dark};
                    }}
                """)
                btn.clicked.connect(self._set_exact_amount)
            else:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.gray_100};
                        color: {self.theme.text_primary};
                        border: 1px solid {self.theme.border};
                        border-radius: 8px;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.gray_200};
                        border-color: {self.theme.primary};
                    }}
                """)
                btn.clicked.connect(lambda checked, a=amount: self._set_quick_amount(a))

            quick_layout.addWidget(btn)

        layout.addLayout(quick_layout)

        # Teclado numerico
        numpad = self._create_numpad()
        layout.addWidget(numpad)

        layout.addStretch()

        return panel

    def _create_numpad(self) -> QFrame:
        """Crea el teclado numerico tactil."""
        frame = QFrame()
        frame.setStyleSheet("background: transparent;")

        layout = QGridLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        # Botones del teclado
        buttons = [
            ("7", 0, 0), ("8", 0, 1), ("9", 0, 2),
            ("4", 1, 0), ("5", 1, 1), ("6", 1, 2),
            ("1", 2, 0), ("2", 2, 1), ("3", 2, 2),
            ("0", 3, 0), ("00", 3, 1), ("C", 3, 2),
        ]

        for text, row, col in buttons:
            btn = QPushButton(text)
            btn.setFixedSize(80, 60)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))

            if text == "C":
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.danger_bg};
                        color: {self.theme.danger};
                        border: 1px solid {self.theme.danger};
                        border-radius: 8px;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.danger};
                        color: white;
                    }}
                """)
                btn.clicked.connect(self._clear_cash_amount)
            else:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.surface};
                        color: {self.theme.text_primary};
                        border: 1px solid {self.theme.border};
                        border-radius: 8px;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.gray_100};
                        border-color: {self.theme.primary};
                    }}
                    QPushButton:pressed {{
                        background-color: {self.theme.primary_bg};
                    }}
                """)
                btn.clicked.connect(lambda checked, t=text: self._append_digit(t))

            layout.addWidget(btn, row, col)

        # Boton de borrar (backspace)
        backspace = QPushButton("<")
        backspace.setFixedSize(80, 60)
        backspace.setCursor(Qt.CursorShape.PointingHandCursor)
        backspace.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        backspace.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.warning_bg};
                color: {self.theme.warning_dark};
                border: 1px solid {self.theme.warning};
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.warning};
                color: white;
            }}
        """)
        backspace.clicked.connect(self._backspace_cash)
        layout.addWidget(backspace, 0, 3)

        # Boton de punto decimal
        decimal = QPushButton(".")
        decimal.setFixedSize(80, 60)
        decimal.setCursor(Qt.CursorShape.PointingHandCursor)
        decimal.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        decimal.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.surface};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_100};
            }}
        """)
        decimal.clicked.connect(lambda: self._append_digit("."))
        layout.addWidget(decimal, 1, 3)

        # Espaciadores para los otros slots
        for row in [2, 3]:
            spacer = QWidget()
            spacer.setFixedSize(80, 60)
            layout.addWidget(spacer, row, 3)

        return frame

    def _create_card_panel(self, is_credit: bool = False) -> QWidget:
        """Crea el panel de pago con tarjeta."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 16, 0, 0)
        layout.setSpacing(20)

        # Tipo de tarjeta
        card_type = "Credito" if is_credit else "Debito"
        title = QLabel(f"Pago con Tarjeta de {card_type}")
        title.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Cuotas (solo para credito)
        if is_credit:
            installments_frame = QFrame()
            installments_frame.setStyleSheet(f"""
                QFrame {{
                    background-color: {self.theme.gray_50};
                    border: 1px solid {self.theme.border};
                    border-radius: 8px;
                }}
            """)
            inst_layout = QVBoxLayout(installments_frame)
            inst_layout.setContentsMargins(16, 12, 16, 12)
            inst_layout.setSpacing(8)

            inst_label = QLabel("Cantidad de cuotas:")
            inst_label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 12px;")
            inst_layout.addWidget(inst_label)

            inst_buttons = QHBoxLayout()
            inst_buttons.setSpacing(8)

            self.installments_group = QButtonGroup(self)
            installments = [1, 3, 6, 12]

            for i, num in enumerate(installments):
                btn = QPushButton(f"{num} cuota{'s' if num > 1 else ''}")
                btn.setFixedHeight(44)
                btn.setCheckable(True)
                btn.setCursor(Qt.CursorShape.PointingHandCursor)

                if num == 1:
                    btn.setChecked(True)

                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.surface};
                        color: {self.theme.text_primary};
                        border: 1px solid {self.theme.border};
                        border-radius: 6px;
                        padding: 0 16px;
                    }}
                    QPushButton:hover {{
                        border-color: {self.theme.primary};
                    }}
                    QPushButton:checked {{
                        background-color: {self.theme.primary};
                        color: white;
                        border-color: {self.theme.primary};
                    }}
                """)
                btn.setProperty("installments", num)
                self.installments_group.addButton(btn, i)
                inst_buttons.addWidget(btn)

            inst_layout.addLayout(inst_buttons)
            layout.addWidget(installments_frame)

        # Ultimos 4 digitos (opcional)
        digits_frame = QFrame()
        digits_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)
        digits_layout = QVBoxLayout(digits_frame)
        digits_layout.setContentsMargins(16, 12, 16, 12)
        digits_layout.setSpacing(8)

        digits_label = QLabel("Ultimos 4 digitos (opcional):")
        digits_label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 12px;")
        digits_layout.addWidget(digits_label)

        if is_credit:
            self.credit_digits_input = QLineEdit()
            self.credit_digits_input.setPlaceholderText("0000")
            self.credit_digits_input.setMaxLength(4)
            self.credit_digits_input.setFixedHeight(44)
            self.credit_digits_input.setStyleSheet(f"""
                QLineEdit {{
                    background-color: {self.theme.surface};
                    border: 1px solid {self.theme.border};
                    border-radius: 6px;
                    padding: 0 12px;
                    font-size: 16px;
                    letter-spacing: 4px;
                }}
                QLineEdit:focus {{
                    border-color: {self.theme.primary};
                }}
            """)
            digits_layout.addWidget(self.credit_digits_input)
        else:
            self.debit_digits_input = QLineEdit()
            self.debit_digits_input.setPlaceholderText("0000")
            self.debit_digits_input.setMaxLength(4)
            self.debit_digits_input.setFixedHeight(44)
            self.debit_digits_input.setStyleSheet(f"""
                QLineEdit {{
                    background-color: {self.theme.surface};
                    border: 1px solid {self.theme.border};
                    border-radius: 6px;
                    padding: 0 12px;
                    font-size: 16px;
                    letter-spacing: 4px;
                }}
                QLineEdit:focus {{
                    border-color: {self.theme.primary};
                }}
            """)
            digits_layout.addWidget(self.debit_digits_input)

        layout.addWidget(digits_frame)

        # Monto a cobrar
        amount_frame = QFrame()
        amount_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.primary_bg};
                border: 2px solid {self.theme.primary};
                border-radius: 12px;
            }}
        """)
        amount_layout = QVBoxLayout(amount_frame)
        amount_layout.setContentsMargins(20, 16, 20, 16)
        amount_layout.setSpacing(4)

        amount_label = QLabel("Monto a cobrar")
        amount_label.setStyleSheet(f"color: {self.theme.primary_dark}; font-size: 12px;")
        amount_layout.addWidget(amount_label)

        if is_credit:
            self.credit_amount_display = QLabel(f"${self.total:,.2f}")
            self.credit_amount_display.setFont(QFont("Segoe UI", 28, QFont.Weight.Bold))
            self.credit_amount_display.setStyleSheet(f"color: {self.theme.primary_dark};")
            self.credit_amount_display.setAlignment(Qt.AlignmentFlag.AlignCenter)
            amount_layout.addWidget(self.credit_amount_display)
        else:
            self.debit_amount_display = QLabel(f"${self.total:,.2f}")
            self.debit_amount_display.setFont(QFont("Segoe UI", 28, QFont.Weight.Bold))
            self.debit_amount_display.setStyleSheet(f"color: {self.theme.primary_dark};")
            self.debit_amount_display.setAlignment(Qt.AlignmentFlag.AlignCenter)
            amount_layout.addWidget(self.debit_amount_display)

        layout.addWidget(amount_frame)

        # Instrucciones
        instructions = QLabel(
            "Pase la tarjeta por el lector o ingrese manualmente\n"
            "y presione CONFIRMAR PAGO"
        )
        instructions.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        instructions.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(instructions)

        layout.addStretch()

        return panel

    def _create_qr_panel(self) -> QWidget:
        """Crea el panel de pago QR / Mercado Pago."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 16, 0, 0)
        layout.setSpacing(20)

        # Titulo
        title = QLabel("Pago con QR / Mercado Pago")
        title.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Placeholder de QR
        qr_frame = QFrame()
        qr_frame.setFixedSize(250, 250)
        qr_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_100};
                border: 2px dashed {self.theme.gray_300};
                border-radius: 12px;
            }}
        """)
        qr_layout = QVBoxLayout(qr_frame)
        qr_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        qr_icon = QLabel("[QR]")
        qr_icon.setFont(QFont("Segoe UI", 48, QFont.Weight.Bold))
        qr_icon.setStyleSheet(f"color: {self.theme.gray_400};")
        qr_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        qr_layout.addWidget(qr_icon)

        qr_text = QLabel("Escanea el codigo QR\ncon la app de Mercado Pago")
        qr_text.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 11px;")
        qr_text.setAlignment(Qt.AlignmentFlag.AlignCenter)
        qr_layout.addWidget(qr_text)

        # Centrar QR
        qr_container = QWidget()
        qr_container_layout = QHBoxLayout(qr_container)
        qr_container_layout.addStretch()
        qr_container_layout.addWidget(qr_frame)
        qr_container_layout.addStretch()
        layout.addWidget(qr_container)

        # Monto
        self.qr_amount_display = QLabel(f"${self.total:,.2f}")
        self.qr_amount_display.setFont(QFont("Segoe UI", 28, QFont.Weight.Bold))
        self.qr_amount_display.setStyleSheet(f"color: {self.theme.secondary};")
        self.qr_amount_display.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.qr_amount_display)

        # Estado
        status_label = QLabel("Esperando pago...")
        status_label.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(status_label)

        # Nota
        note = QLabel(
            "Esta funcionalidad estara disponible proximamente.\n"
            "Por ahora, confirme el pago manualmente."
        )
        note.setStyleSheet(f"color: {self.theme.warning}; font-size: 11px;")
        note.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(note)

        layout.addStretch()

        return panel

    def _create_giftcard_panel(self) -> QWidget:
        """Crea el panel de pago con Gift Card."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 16, 0, 0)
        layout.setSpacing(20)

        # Titulo
        title = QLabel("Pago con Gift Card")
        title.setFont(QFont("Segoe UI", 14, QFont.Weight.Medium))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Frame de ingreso de codigo
        input_frame = QFrame()
        input_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)
        input_layout = QVBoxLayout(input_frame)
        input_layout.setContentsMargins(20, 16, 20, 16)
        input_layout.setSpacing(12)

        code_label = QLabel("Codigo de Gift Card")
        code_label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 12px;")
        input_layout.addWidget(code_label)

        code_input_layout = QHBoxLayout()
        code_input_layout.setSpacing(8)

        self.giftcard_code_input = QLineEdit()
        self.giftcard_code_input.setPlaceholderText("Ingrese o escanee el codigo")
        self.giftcard_code_input.setFixedHeight(44)
        self.giftcard_code_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 0 12px;
                font-size: 14px;
            }}
            QLineEdit:focus {{
                border-color: #9b59b6;
            }}
        """)
        self.giftcard_code_input.returnPressed.connect(self._check_giftcard_balance)
        code_input_layout.addWidget(self.giftcard_code_input)

        check_btn = QPushButton("Consultar")
        check_btn.setFixedSize(90, 44)
        check_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        check_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: #9b59b6;
                color: white;
                border: none;
                border-radius: 6px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: #8e44ad;
            }}
        """)
        check_btn.clicked.connect(self._check_giftcard_balance)
        code_input_layout.addWidget(check_btn)

        input_layout.addLayout(code_input_layout)
        layout.addWidget(input_frame)

        # Frame de info de gift card (oculto inicialmente)
        self.giftcard_info_frame = QFrame()
        self.giftcard_info_frame.setStyleSheet(f"""
            QFrame {{
                background-color: #f3e5f5;
                border: 2px solid #9b59b6;
                border-radius: 12px;
            }}
        """)
        self.giftcard_info_frame.hide()

        info_layout = QVBoxLayout(self.giftcard_info_frame)
        info_layout.setContentsMargins(20, 16, 20, 16)
        info_layout.setSpacing(8)

        # Saldo
        balance_row = QHBoxLayout()
        balance_label = QLabel("Saldo disponible:")
        balance_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        balance_row.addWidget(balance_label)

        self.giftcard_balance_label = QLabel("$0.00")
        self.giftcard_balance_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        self.giftcard_balance_label.setStyleSheet("color: #9b59b6;")
        self.giftcard_balance_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        balance_row.addWidget(self.giftcard_balance_label)
        info_layout.addLayout(balance_row)

        # Monto a aplicar
        apply_row = QHBoxLayout()
        apply_label = QLabel("Aplicar al pago:")
        apply_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        apply_row.addWidget(apply_label)

        self.giftcard_apply_label = QLabel("$0.00")
        self.giftcard_apply_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        self.giftcard_apply_label.setStyleSheet(f"color: {self.theme.success};")
        self.giftcard_apply_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        apply_row.addWidget(self.giftcard_apply_label)
        info_layout.addLayout(apply_row)

        layout.addWidget(self.giftcard_info_frame)

        # Monto a cobrar
        self.giftcard_amount_display = QLabel(f"${self.total:,.2f}")
        self.giftcard_amount_display.setFont(QFont("Segoe UI", 28, QFont.Weight.Bold))
        self.giftcard_amount_display.setStyleSheet("color: #9b59b6;")
        self.giftcard_amount_display.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.giftcard_amount_display)

        # Instrucciones
        instructions = QLabel(
            "Ingrese el codigo de la gift card y presione Consultar.\n"
            "El saldo disponible se aplicara automaticamente al pago."
        )
        instructions.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        instructions.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(instructions)

        layout.addStretch()

        # Atributos para tracking
        self._giftcard_code: str = ""
        self._giftcard_balance: float = 0.0
        self._giftcard_amount_to_apply: float = 0.0

        return panel

    def _check_giftcard_balance(self) -> None:
        """Consulta el saldo de la gift card ingresada."""
        from src.api.cash import get_gift_card_api

        code = self.giftcard_code_input.text().strip()
        if not code:
            QMessageBox.warning(self, "Error", "Ingrese el codigo de la gift card")
            return

        api = get_gift_card_api()
        gift_card, error = api.check_balance(code)

        if error:
            QMessageBox.warning(self, "Gift Card", f"No se pudo consultar la gift card:\n{error}")
            self.giftcard_info_frame.hide()
            self._giftcard_code = ""
            self._giftcard_balance = 0.0
            self._giftcard_amount_to_apply = 0.0
            self.confirm_btn.setEnabled(False)
            return

        if gift_card.status != "ACTIVE":
            QMessageBox.warning(
                self,
                "Gift Card",
                f"Esta gift card no esta activa.\nEstado: {gift_card.status}"
            )
            self.giftcard_info_frame.hide()
            self.confirm_btn.setEnabled(False)
            return

        if gift_card.current_balance <= 0:
            QMessageBox.warning(self, "Gift Card", "Esta gift card no tiene saldo disponible")
            self.giftcard_info_frame.hide()
            self.confirm_btn.setEnabled(False)
            return

        # Guardar datos
        self._giftcard_code = code
        self._giftcard_balance = gift_card.current_balance

        # Calcular monto a aplicar (menor entre saldo y restante)
        self._giftcard_amount_to_apply = min(gift_card.current_balance, self.remaining_amount)

        # Mostrar info
        self.giftcard_balance_label.setText(f"${gift_card.current_balance:,.2f}")
        self.giftcard_apply_label.setText(f"${self._giftcard_amount_to_apply:,.2f}")
        self.giftcard_info_frame.show()

        # Habilitar confirmar si hay monto a aplicar
        self.confirm_btn.setEnabled(self._giftcard_amount_to_apply > 0)

        logger.info(f"Gift card consultada: saldo ${gift_card.current_balance}, aplicar ${self._giftcard_amount_to_apply}")

    def _select_method(self, method: PaymentMethod) -> None:
        """Selecciona un metodo de pago."""
        self.current_method = method

        # Actualizar estilos de botones
        for m, btn in self.method_buttons.items():
            color = btn.property("color")
            if m == method:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {color};
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 13px;
                    }}
                """)
                btn.setChecked(True)
            else:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.gray_100};
                        color: {self.theme.text_primary};
                        border: 1px solid {self.theme.border};
                        border-radius: 8px;
                        font-size: 13px;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.gray_200};
                        border-color: {color};
                    }}
                """)
                btn.setChecked(False)

        # Cambiar panel
        index_map = {
            PaymentMethod.CASH: 0,
            PaymentMethod.DEBIT_CARD: 1,
            PaymentMethod.CREDIT_CARD: 2,
            PaymentMethod.QR: 3,
            PaymentMethod.GIFTCARD: 4,
        }
        self.payment_stack.setCurrentIndex(index_map.get(method, 0))

        logger.debug(f"Metodo de pago seleccionado: {method.value}")

    def _append_digit(self, digit: str) -> None:
        """Agrega un digito al monto en efectivo."""
        current = self.cash_display.text().replace("$", "").replace(",", "").replace(".", "")

        if digit == ".":
            # No permitir multiples puntos
            if "." in str(self.cash_amount):
                return
            self.cash_amount = float(current + ".") if current else 0.0
        elif digit == "00":
            if current == "" or current == "0":
                return
            new_value = current + "00"
            self.cash_amount = float(new_value) / 100
        else:
            new_value = current + digit
            self.cash_amount = float(new_value) / 100

        self._update_cash_display()

    def _backspace_cash(self) -> None:
        """Borra el ultimo digito del monto en efectivo."""
        current = str(int(self.cash_amount * 100))
        if len(current) > 1:
            self.cash_amount = float(current[:-1]) / 100
        else:
            self.cash_amount = 0.0
        self._update_cash_display()

    def _clear_cash_amount(self) -> None:
        """Limpia el monto en efectivo."""
        self.cash_amount = 0.0
        self._update_cash_display()

    def _set_quick_amount(self, amount: float) -> None:
        """Establece un monto rapido."""
        self.cash_amount = amount
        self._update_cash_display()

    def _set_exact_amount(self) -> None:
        """Establece el monto exacto."""
        self.cash_amount = self.remaining_amount
        self._update_cash_display()

    def _update_cash_display(self) -> None:
        """Actualiza el display de efectivo y calcula el vuelto."""
        self.cash_display.setText(f"${self.cash_amount:,.2f}")

        # Calcular vuelto
        change = self.cash_amount - self.remaining_amount

        if change >= 0 and self.cash_amount > 0:
            self.change_display.setText(f"${change:,.2f}")
            self.change_frame.show()
        else:
            self.change_frame.hide()

        # Habilitar/deshabilitar boton confirmar
        self.confirm_btn.setEnabled(self.cash_amount >= self.remaining_amount)

    def _update_display(self) -> None:
        """Actualiza todos los displays."""
        # Actualizar montos en paneles de tarjeta
        if hasattr(self, 'debit_amount_display'):
            self.debit_amount_display.setText(f"${self.remaining_amount:,.2f}")
        if hasattr(self, 'credit_amount_display'):
            self.credit_amount_display.setText(f"${self.remaining_amount:,.2f}")
        if hasattr(self, 'qr_amount_display'):
            self.qr_amount_display.setText(f"${self.remaining_amount:,.2f}")

        # Actualizar monto restante
        self.remaining_label.setText(f"${self.remaining_amount:,.2f}")

        # Mostrar/ocultar widget de restante
        if len(self.payments) > 0:
            self.remaining_widget.show()
            self.payments_widget.show()
        else:
            self.remaining_widget.hide()
            self.payments_widget.hide()

    def _add_payment_to_list(self, payment: PaymentData) -> None:
        """Agrega un pago a la lista visual."""
        row = QHBoxLayout()

        method_name = PaymentMethod.get_display_name(payment.method)
        method_label = QLabel(method_name)
        method_label.setStyleSheet(f"color: {self.theme.gray_400}; font-size: 11px; background: transparent;")
        row.addWidget(method_label)

        amount_label = QLabel(f"${payment.amount:,.2f}")
        amount_label.setStyleSheet(f"color: {self.theme.success}; font-size: 11px; font-weight: 600; background: transparent;")
        amount_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        row.addWidget(amount_label)

        self.payments_layout.addLayout(row)

    def _on_confirm(self) -> None:
        """Confirma el pago."""
        # Validar segun metodo
        if self.current_method == PaymentMethod.CASH:
            if self.cash_amount < self.remaining_amount:
                QMessageBox.warning(
                    self,
                    "Monto insuficiente",
                    f"El monto recibido (${self.cash_amount:,.2f}) es menor al total (${self.remaining_amount:,.2f})"
                )
                return

            # Crear pago
            payment = PaymentData(
                method=PaymentMethod.CASH,
                amount=self.remaining_amount,
            )
            change = self.cash_amount - self.remaining_amount

        elif self.current_method == PaymentMethod.DEBIT_CARD:
            digits = self.debit_digits_input.text().strip() if hasattr(self, 'debit_digits_input') else None
            payment = PaymentData(
                method=PaymentMethod.DEBIT_CARD,
                amount=self.remaining_amount,
                card_last_digits=digits if digits else None,
            )
            change = 0.0

        elif self.current_method == PaymentMethod.CREDIT_CARD:
            digits = self.credit_digits_input.text().strip() if hasattr(self, 'credit_digits_input') else None
            installments = 1
            if hasattr(self, 'installments_group'):
                checked_btn = self.installments_group.checkedButton()
                if checked_btn:
                    installments = checked_btn.property("installments") or 1

            payment = PaymentData(
                method=PaymentMethod.CREDIT_CARD,
                amount=self.remaining_amount,
                card_last_digits=digits if digits else None,
                installments=installments,
            )
            change = 0.0

        elif self.current_method == PaymentMethod.QR:
            payment = PaymentData(
                method=PaymentMethod.QR,
                amount=self.remaining_amount,
            )
            change = 0.0

        elif self.current_method == PaymentMethod.GIFTCARD:
            if not hasattr(self, '_giftcard_amount_to_apply') or self._giftcard_amount_to_apply <= 0:
                QMessageBox.warning(self, "Error", "Consulte primero una gift card valida")
                return

            payment = PaymentData(
                method=PaymentMethod.GIFTCARD,
                amount=self._giftcard_amount_to_apply,
                reference=self._giftcard_code,  # Guardar codigo como referencia
            )
            change = 0.0

        else:
            return

        # Agregar pago
        self.payments.append(payment)

        # Calcular total pagado
        total_paid = sum(p.amount for p in self.payments)

        # Crear resultado
        result = CheckoutResult(
            success=True,
            payments=self.payments,
            total_paid=total_paid,
            change=change,
            cancelled=False,
        )

        logger.info(f"Pago confirmado: {payment.method.value} - ${payment.amount:,.2f}")
        if change > 0:
            logger.info(f"Vuelto: ${change:,.2f}")

        # Mostrar mensaje de exito
        QMessageBox.information(
            self,
            "Pago exitoso",
            f"Pago registrado correctamente.\n\n"
            f"Total: ${self.total:,.2f}\n"
            f"Pagado: ${total_paid:,.2f}\n"
            + (f"Vuelto: ${change:,.2f}" if change > 0 else "")
        )

        # Emitir signal y cerrar
        self.payment_confirmed.emit(result)
        self.accept()

    def _on_cancel(self) -> None:
        """Cancela el pago."""
        if self.payments:
            reply = QMessageBox.question(
                self,
                "Cancelar pago",
                "Ya hay pagos registrados. Estas seguro de cancelar?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            )
            if reply != QMessageBox.StandardButton.Yes:
                return

        result = CheckoutResult(
            success=False,
            cancelled=True,
        )

        logger.info("Pago cancelado")
        self.payment_cancelled.emit()
        self.reject()

    def _setup_shortcuts(self) -> None:
        """Configura atajos de teclado."""
        pass  # Los atajos se manejan en keyPressEvent

    def keyPressEvent(self, event: QKeyEvent) -> None:
        """Maneja eventos de teclado."""
        key = event.key()

        if key == Qt.Key.Key_Escape:
            self._on_cancel()
        elif key == Qt.Key.Key_Return or key == Qt.Key.Key_Enter:
            if self.confirm_btn.isEnabled():
                self._on_confirm()
        elif key == Qt.Key.Key_F1:
            self._select_method(PaymentMethod.CASH)
        elif key == Qt.Key.Key_F5:
            self._select_method(PaymentMethod.GIFTCARD)
        elif key == Qt.Key.Key_F2:
            self._select_method(PaymentMethod.DEBIT_CARD)
        elif key == Qt.Key.Key_F3:
            self._select_method(PaymentMethod.CREDIT_CARD)
        elif key == Qt.Key.Key_F4:
            self._select_method(PaymentMethod.QR)
        else:
            # Pasar digitos al teclado numerico si estamos en efectivo
            if self.current_method == PaymentMethod.CASH:
                text = event.text()
                if text.isdigit():
                    self._append_digit(text)
                elif text == ".":
                    self._append_digit(".")
                elif key == Qt.Key.Key_Backspace:
                    self._backspace_cash()
                elif key == Qt.Key.Key_Delete:
                    self._clear_cash_amount()
                else:
                    super().keyPressEvent(event)
            else:
                super().keyPressEvent(event)
