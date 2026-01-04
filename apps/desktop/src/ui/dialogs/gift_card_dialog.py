"""
Dialogo para consulta y aplicacion de Gift Cards.

Permite:
- Consultar saldo de una gift card
- Aplicar gift card como metodo de pago
"""

from typing import Optional

from PyQt6.QtWidgets import (
    QDialog,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QMessageBox,
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles import get_theme
from src.api.cash import GiftCardAPI, GiftCardInfo, get_gift_card_api


class GiftCardDialog(QDialog):
    """
    Dialogo para consultar y aplicar gift cards.

    Signals:
        gift_card_applied: Emitido cuando se aplica una gift card al pago
            args: (code, amount_to_apply, gift_card_info)
    """

    gift_card_applied = pyqtSignal(str, float, object)  # code, amount, GiftCardInfo

    def __init__(
        self,
        amount_needed: float = 0.0,
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)

        self.amount_needed = amount_needed
        self.theme = get_theme()
        self.gift_card_api = get_gift_card_api()
        self.current_gift_card: Optional[GiftCardInfo] = None

        self.setWindowTitle("Gift Card")
        self._setup_ui()

        logger.info(f"GiftCardDialog abierto - Monto necesario: ${amount_needed:,.2f}")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setMinimumSize(450, 400)
        self.resize(500, 450)

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

        # Input de codigo
        input_frame = self._create_input_frame()
        main_layout.addWidget(input_frame)

        # Info de gift card (oculto inicialmente)
        self.info_frame = self._create_info_frame()
        self.info_frame.hide()
        main_layout.addWidget(self.info_frame)

        # Monto a aplicar (si hay monto necesario)
        if self.amount_needed > 0:
            self.apply_frame = self._create_apply_frame()
            self.apply_frame.hide()
            main_layout.addWidget(self.apply_frame)

        main_layout.addStretch()

        # Botones
        buttons = self._create_buttons()
        main_layout.addLayout(buttons)

    def _create_header(self) -> QFrame:
        """Crea el header."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.secondary};
                border-radius: 12px;
            }}
        """)

        layout = QHBoxLayout(frame)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Icono
        icon = QLabel("GC")
        icon.setFont(QFont("Segoe UI", 20, QFont.Weight.Bold))
        icon.setStyleSheet(f"""
            color: white;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px 12px;
        """)
        layout.addWidget(icon)

        # Texto
        text_layout = QVBoxLayout()
        text_layout.setSpacing(4)

        title = QLabel("Gift Card")
        title.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        title.setStyleSheet("color: white;")
        text_layout.addWidget(title)

        if self.amount_needed > 0:
            subtitle = QLabel(f"Aplicar como pago (necesario: ${self.amount_needed:,.2f})")
        else:
            subtitle = QLabel("Consultar saldo")
        subtitle.setStyleSheet("color: rgba(255, 255, 255, 0.9); font-size: 12px;")
        text_layout.addWidget(subtitle)

        layout.addLayout(text_layout)
        layout.addStretch()

        return frame

    def _create_input_frame(self) -> QFrame:
        """Crea el frame de input de codigo."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(12)

        label = QLabel("Codigo de Gift Card")
        label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        layout.addWidget(label)

        input_layout = QHBoxLayout()
        input_layout.setSpacing(12)

        self.code_input = QLineEdit()
        self.code_input.setPlaceholderText("Ingrese o escanee el codigo")
        self.code_input.setFixedHeight(48)
        self.code_input.setFont(QFont("Segoe UI", 14))
        self.code_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.gray_50};
                border: 2px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px 16px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.secondary};
            }}
        """)
        self.code_input.returnPressed.connect(self._check_balance)
        input_layout.addWidget(self.code_input)

        check_btn = QPushButton("Consultar")
        check_btn.setFixedSize(100, 48)
        check_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        check_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.secondary};
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.secondary_dark};
            }}
        """)
        check_btn.clicked.connect(self._check_balance)
        input_layout.addWidget(check_btn)

        layout.addLayout(input_layout)

        return frame

    def _create_info_frame(self) -> QFrame:
        """Crea el frame de informacion de la gift card."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(12)

        # Saldo actual
        balance_layout = QHBoxLayout()
        balance_label = QLabel("Saldo disponible:")
        balance_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        balance_layout.addWidget(balance_label)

        self.balance_label = QLabel("$0.00")
        self.balance_label.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        self.balance_label.setStyleSheet(f"color: {self.theme.success};")
        self.balance_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        balance_layout.addWidget(self.balance_label)
        layout.addLayout(balance_layout)

        # Monto original
        original_layout = QHBoxLayout()
        original_label = QLabel("Monto original:")
        original_label.setStyleSheet(f"color: {self.theme.text_muted}; font-size: 12px;")
        original_layout.addWidget(original_label)

        self.original_label = QLabel("$0.00")
        self.original_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        self.original_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        original_layout.addWidget(self.original_label)
        layout.addLayout(original_layout)

        # Estado
        status_layout = QHBoxLayout()
        status_title = QLabel("Estado:")
        status_title.setStyleSheet(f"color: {self.theme.text_muted}; font-size: 12px;")
        status_layout.addWidget(status_title)

        self.status_label = QLabel("-")
        self.status_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        status_layout.addWidget(self.status_label)
        layout.addLayout(status_layout)

        # Vencimiento
        expiry_layout = QHBoxLayout()
        expiry_title = QLabel("Vence:")
        expiry_title.setStyleSheet(f"color: {self.theme.text_muted}; font-size: 12px;")
        expiry_layout.addWidget(expiry_title)

        self.expiry_label = QLabel("-")
        self.expiry_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        self.expiry_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        expiry_layout.addWidget(self.expiry_label)
        layout.addLayout(expiry_layout)

        return frame

    def _create_apply_frame(self) -> QFrame:
        """Crea el frame para aplicar la gift card."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.primary_bg};
                border: 2px solid {self.theme.primary};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(12)

        label = QLabel("Monto a aplicar")
        label.setStyleSheet(f"color: {self.theme.primary_dark}; font-size: 12px;")
        layout.addWidget(label)

        # Input de monto
        input_layout = QHBoxLayout()
        input_layout.setSpacing(8)

        self.apply_amount_input = QLineEdit()
        self.apply_amount_input.setPlaceholderText("0.00")
        self.apply_amount_input.setFixedHeight(44)
        self.apply_amount_input.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        self.apply_amount_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.apply_amount_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.primary};
                border-radius: 8px;
                padding: 8px 12px;
                color: {self.theme.text_primary};
            }}
        """)
        input_layout.addWidget(self.apply_amount_input)

        # Boton de monto maximo
        max_btn = QPushButton("Max")
        max_btn.setFixedSize(60, 44)
        max_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        max_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        max_btn.clicked.connect(self._set_max_amount)
        input_layout.addWidget(max_btn)

        layout.addLayout(input_layout)

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

        # Aplicar (solo si hay monto necesario)
        if self.amount_needed > 0:
            self.apply_btn = QPushButton("Aplicar Gift Card")
            self.apply_btn.setFixedHeight(48)
            self.apply_btn.setCursor(Qt.CursorShape.PointingHandCursor)
            self.apply_btn.setEnabled(False)
            self.apply_btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {self.theme.success};
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 0 32px;
                    font-size: 14px;
                    font-weight: 600;
                }}
                QPushButton:hover {{
                    background-color: {self.theme.success_dark};
                }}
                QPushButton:disabled {{
                    background-color: {self.theme.gray_300};
                    color: {self.theme.gray_500};
                }}
            """)
            self.apply_btn.clicked.connect(self._apply_gift_card)
            layout.addWidget(self.apply_btn)

        return layout

    def _check_balance(self) -> None:
        """Consulta el saldo de la gift card."""
        code = self.code_input.text().strip()

        if not code:
            QMessageBox.warning(self, "Error", "Ingrese el codigo de la gift card")
            return

        # Consultar API
        gift_card, error = self.gift_card_api.check_balance(code)

        if error:
            QMessageBox.critical(self, "Error", f"No se pudo consultar la gift card:\n{error}")
            self.info_frame.hide()
            if hasattr(self, 'apply_frame'):
                self.apply_frame.hide()
            if hasattr(self, 'apply_btn'):
                self.apply_btn.setEnabled(False)
            self.current_gift_card = None
            return

        # Guardar referencia
        self.current_gift_card = gift_card

        # Mostrar info
        self.balance_label.setText(f"${gift_card.current_balance:,.2f}")
        self.original_label.setText(f"${gift_card.initial_amount:,.2f}")

        # Estado
        status_map = {
            "ACTIVE": ("Activa", self.theme.success),
            "INACTIVE": ("Inactiva", self.theme.warning),
            "EXPIRED": ("Vencida", self.theme.danger),
            "DEPLETED": ("Agotada", self.theme.gray_500),
            "CANCELLED": ("Cancelada", self.theme.danger),
        }
        status_text, status_color = status_map.get(
            gift_card.status,
            (gift_card.status, self.theme.text_secondary)
        )
        self.status_label.setText(status_text)
        self.status_label.setStyleSheet(f"color: {status_color}; font-size: 12px; font-weight: bold;")

        # Vencimiento
        if gift_card.expires_at:
            from datetime import datetime
            try:
                exp_date = datetime.fromisoformat(gift_card.expires_at.replace('Z', '+00:00'))
                self.expiry_label.setText(exp_date.strftime("%d/%m/%Y"))
                if gift_card.is_expired:
                    self.expiry_label.setStyleSheet(f"color: {self.theme.danger}; font-size: 12px;")
            except:
                self.expiry_label.setText("-")
        else:
            self.expiry_label.setText("Sin vencimiento")

        self.info_frame.show()

        # Habilitar aplicacion si hay saldo
        if self.amount_needed > 0 and gift_card.current_balance > 0 and gift_card.status == "ACTIVE":
            if hasattr(self, 'apply_frame'):
                self.apply_frame.show()
                # Sugerir monto maximo aplicable
                self._set_max_amount()
            if hasattr(self, 'apply_btn'):
                self.apply_btn.setEnabled(True)
        else:
            if hasattr(self, 'apply_frame'):
                self.apply_frame.hide()
            if hasattr(self, 'apply_btn'):
                self.apply_btn.setEnabled(False)

    def _set_max_amount(self) -> None:
        """Establece el monto maximo aplicable."""
        if not self.current_gift_card:
            return

        # El maximo es el menor entre el saldo y el monto necesario
        max_amount = min(self.current_gift_card.current_balance, self.amount_needed)
        self.apply_amount_input.setText(f"{max_amount:.2f}")

    def _apply_gift_card(self) -> None:
        """Aplica la gift card al pago."""
        if not self.current_gift_card:
            QMessageBox.warning(self, "Error", "Consulte una gift card primero")
            return

        try:
            amount_text = self.apply_amount_input.text().strip()
            if not amount_text:
                QMessageBox.warning(self, "Error", "Ingrese el monto a aplicar")
                return

            amount = float(amount_text)
        except ValueError:
            QMessageBox.warning(self, "Error", "El monto ingresado no es valido")
            return

        if amount <= 0:
            QMessageBox.warning(self, "Error", "El monto debe ser mayor a cero")
            return

        if amount > self.current_gift_card.current_balance:
            QMessageBox.warning(
                self,
                "Error",
                f"El monto supera el saldo disponible (${self.current_gift_card.current_balance:,.2f})"
            )
            return

        if amount > self.amount_needed:
            QMessageBox.warning(
                self,
                "Error",
                f"El monto supera lo necesario (${self.amount_needed:,.2f})"
            )
            return

        # Emitir signal con los datos
        code = self.code_input.text().strip()
        logger.info(f"Gift card {code[:4]}**** aplicada por ${amount:,.2f}")

        self.gift_card_applied.emit(code, amount, self.current_gift_card)
        self.accept()


class GiftCardBalanceDialog(QDialog):
    """
    Dialogo simple solo para consultar saldo de gift cards.
    """

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)

        self.theme = get_theme()
        self.gift_card_api = get_gift_card_api()

        self.setWindowTitle("Consultar Saldo Gift Card")
        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setMinimumSize(400, 350)
        self.resize(450, 380)

        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Titulo
        title = QLabel("Consultar Saldo")
        title.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Input
        input_layout = QHBoxLayout()
        input_layout.setSpacing(12)

        self.code_input = QLineEdit()
        self.code_input.setPlaceholderText("Codigo de Gift Card")
        self.code_input.setFixedHeight(44)
        self.code_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 14px;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        self.code_input.returnPressed.connect(self._check_balance)
        input_layout.addWidget(self.code_input)

        check_btn = QPushButton("Consultar")
        check_btn.setFixedSize(100, 44)
        check_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        check_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        check_btn.clicked.connect(self._check_balance)
        input_layout.addWidget(check_btn)

        layout.addLayout(input_layout)

        # Resultado
        self.result_frame = QFrame()
        self.result_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)
        self.result_frame.hide()

        result_layout = QVBoxLayout(self.result_frame)
        result_layout.setContentsMargins(20, 20, 20, 20)
        result_layout.setSpacing(16)

        self.balance_label = QLabel("$0.00")
        self.balance_label.setFont(QFont("Segoe UI", 32, QFont.Weight.Bold))
        self.balance_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.balance_label.setStyleSheet(f"color: {self.theme.success};")
        result_layout.addWidget(self.balance_label)

        self.status_label = QLabel("")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        result_layout.addWidget(self.status_label)

        layout.addWidget(self.result_frame)
        layout.addStretch()

        # Cerrar
        close_btn = QPushButton("Cerrar")
        close_btn.setFixedHeight(44)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 8px;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn)

    def _check_balance(self) -> None:
        """Consulta el saldo."""
        code = self.code_input.text().strip()

        if not code:
            return

        gift_card, error = self.gift_card_api.check_balance(code)

        if error:
            self.balance_label.setText("Error")
            self.balance_label.setStyleSheet(f"color: {self.theme.danger};")
            self.status_label.setText(error)
            self.status_label.setStyleSheet(f"color: {self.theme.danger}; font-size: 12px;")
            self.result_frame.show()
            return

        self.balance_label.setText(f"${gift_card.current_balance:,.2f}")
        self.balance_label.setStyleSheet(f"color: {self.theme.success};")

        status_text = {
            "ACTIVE": "Activa",
            "INACTIVE": "Inactiva",
            "EXPIRED": "Vencida",
            "DEPLETED": "Agotada",
            "CANCELLED": "Cancelada",
        }.get(gift_card.status, gift_card.status)

        self.status_label.setText(f"Estado: {status_text}")
        self.status_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")

        self.result_frame.show()
