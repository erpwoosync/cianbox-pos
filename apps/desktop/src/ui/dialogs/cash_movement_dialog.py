"""
Dialogo para registrar movimientos de caja.

Permite registrar ingresos y retiros de efectivo con:
- Seleccion de tipo de movimiento
- Monto y descripcion
- Autorizacion de supervisor para retiros
"""

from typing import Optional, Callable

from PyQt6.QtWidgets import (
    QDialog,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QComboBox,
    QTextEdit,
    QMessageBox,
    QButtonGroup,
    QRadioButton,
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont, QDoubleValidator

from loguru import logger

from src.ui.styles import get_theme
from src.api.cash import (
    CashAPI,
    CashMovement,
    CashMovementType,
    CashMovementReason,
    get_cash_api,
)


class CashMovementDialog(QDialog):
    """
    Dialogo para registrar movimientos de caja.

    Signals:
        movement_registered: Emitido cuando se registra un movimiento
    """

    movement_registered = pyqtSignal(object)  # CashMovement

    # Razones disponibles para cada tipo
    DEPOSIT_REASONS = [
        (CashMovementReason.INITIAL_FUND, "Fondo Inicial"),
        (CashMovementReason.CHANGE_FUND, "Fondo de Cambio"),
        (CashMovementReason.LOAN_RETURN, "Devolucion de Prestamo"),
        (CashMovementReason.CORRECTION, "Correccion"),
        (CashMovementReason.OTHER, "Otro"),
    ]

    WITHDRAWAL_REASONS = [
        (CashMovementReason.SAFE_DEPOSIT, "Deposito en Caja Fuerte"),
        (CashMovementReason.BANK_DEPOSIT, "Deposito Bancario"),
        (CashMovementReason.SUPPLIER_PAYMENT, "Pago a Proveedor"),
        (CashMovementReason.EXPENSE, "Gasto"),
        (CashMovementReason.CHANGE_FUND, "Fondo de Cambio"),
        (CashMovementReason.OTHER, "Otro"),
    ]

    def __init__(
        self,
        movement_type: str = "deposit",  # "deposit" o "withdrawal"
        validate_supervisor: Optional[Callable[[str], tuple[bool, Optional[str]]]] = None,
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)

        self.movement_type = movement_type
        self.validate_supervisor = validate_supervisor
        self.theme = get_theme()
        self.cash_api = get_cash_api()
        self.supervisor_user_id: Optional[str] = None

        self._setup_ui()

        if movement_type == "deposit":
            self.setWindowTitle("Registrar Ingreso de Efectivo")
            logger.info("Abriendo dialogo de ingreso de efectivo")
        else:
            self.setWindowTitle("Registrar Retiro de Efectivo")
            logger.info("Abriendo dialogo de retiro de efectivo")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setMinimumSize(450, 500)
        self.resize(500, 550)

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

        # Formulario
        form = self._create_form()
        main_layout.addWidget(form)

        # Autorizacion para retiros
        if self.movement_type == "withdrawal":
            auth = self._create_authorization()
            main_layout.addWidget(auth)

        main_layout.addStretch()

        # Botones
        buttons = self._create_buttons()
        main_layout.addLayout(buttons)

    def _create_header(self) -> QFrame:
        """Crea el header."""
        frame = QFrame()

        if self.movement_type == "deposit":
            color = self.theme.success
            title = "Ingreso de Efectivo"
            icon = "+"
        else:
            color = self.theme.danger
            title = "Retiro de Efectivo"
            icon = "-"

        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {color};
                border-radius: 12px;
            }}
        """)

        layout = QHBoxLayout(frame)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Icono
        icon_label = QLabel(icon)
        icon_label.setFont(QFont("Segoe UI", 36, QFont.Weight.Bold))
        icon_label.setStyleSheet("color: white;")
        icon_label.setFixedSize(60, 60)
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(icon_label)

        # Titulo
        title_label = QLabel(title)
        title_label.setFont(QFont("Segoe UI", 20, QFont.Weight.Bold))
        title_label.setStyleSheet("color: white;")
        layout.addWidget(title_label)

        layout.addStretch()

        return frame

    def _create_form(self) -> QFrame:
        """Crea el formulario de movimiento."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Monto
        amount_layout = QVBoxLayout()
        amount_layout.setSpacing(8)

        amount_label = QLabel("Monto")
        amount_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        amount_layout.addWidget(amount_label)

        self.amount_input = QLineEdit()
        self.amount_input.setPlaceholderText("0.00")
        self.amount_input.setValidator(QDoubleValidator(0.01, 999999999, 2))
        self.amount_input.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.amount_input.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        self.amount_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.gray_50};
                border: 2px solid {self.theme.border};
                border-radius: 8px;
                padding: 12px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        amount_layout.addWidget(self.amount_input)
        layout.addLayout(amount_layout)

        # Razon
        reason_layout = QVBoxLayout()
        reason_layout.setSpacing(8)

        reason_label = QLabel("Motivo")
        reason_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        reason_layout.addWidget(reason_label)

        self.reason_combo = QComboBox()
        self.reason_combo.setFixedHeight(44)
        self.reason_combo.setStyleSheet(f"""
            QComboBox {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 14px;
            }}
            QComboBox:focus {{
                border-color: {self.theme.primary};
            }}
            QComboBox::drop-down {{
                border: none;
                width: 30px;
            }}
        """)

        # Agregar razones segun tipo
        reasons = self.DEPOSIT_REASONS if self.movement_type == "deposit" else self.WITHDRAWAL_REASONS
        for reason, display_name in reasons:
            self.reason_combo.addItem(display_name, reason)

        reason_layout.addWidget(self.reason_combo)
        layout.addLayout(reason_layout)

        # Descripcion
        desc_layout = QVBoxLayout()
        desc_layout.setSpacing(8)

        desc_label = QLabel("Descripcion (opcional)")
        desc_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        desc_layout.addWidget(desc_label)

        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(80)
        self.description_input.setPlaceholderText("Detalles del movimiento...")
        self.description_input.setStyleSheet(f"""
            QTextEdit {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px;
                color: {self.theme.text_primary};
            }}
            QTextEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        desc_layout.addWidget(self.description_input)
        layout.addLayout(desc_layout)

        # Referencia
        ref_layout = QVBoxLayout()
        ref_layout.setSpacing(8)

        ref_label = QLabel("Referencia (opcional)")
        ref_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        ref_layout.addWidget(ref_label)

        self.reference_input = QLineEdit()
        self.reference_input.setPlaceholderText("Nro. de recibo, factura, etc.")
        self.reference_input.setFixedHeight(40)
        self.reference_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px 12px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        ref_layout.addWidget(self.reference_input)
        layout.addLayout(ref_layout)

        return frame

    def _create_authorization(self) -> QFrame:
        """Crea la seccion de autorizacion de supervisor."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.warning_bg};
                border: 1px solid {self.theme.warning};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(12)

        # Titulo
        title = QLabel("Autorizacion de Supervisor")
        title.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.warning_dark};")
        layout.addWidget(title)

        note = QLabel("Los retiros de efectivo requieren autorizacion de un supervisor.")
        note.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 11px;")
        note.setWordWrap(True)
        layout.addWidget(note)

        # Input de PIN
        pin_layout = QHBoxLayout()
        pin_layout.setSpacing(12)

        self.pin_input = QLineEdit()
        self.pin_input.setPlaceholderText("PIN de Supervisor")
        self.pin_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.pin_input.setMaxLength(6)
        self.pin_input.setFixedHeight(44)
        self.pin_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 16px;
                letter-spacing: 4px;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        pin_layout.addWidget(self.pin_input)

        validate_btn = QPushButton("Validar")
        validate_btn.setFixedHeight(44)
        validate_btn.setFixedWidth(100)
        validate_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        validate_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.warning};
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.warning_dark};
            }}
        """)
        validate_btn.clicked.connect(self._validate_pin)
        pin_layout.addWidget(validate_btn)

        layout.addLayout(pin_layout)

        # Estado de validacion
        self.validation_label = QLabel("")
        self.validation_label.setStyleSheet(f"font-size: 11px;")
        layout.addWidget(self.validation_label)

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
        if self.movement_type == "deposit":
            confirm_text = "Registrar Ingreso"
            confirm_color = self.theme.success
            confirm_color_hover = self.theme.success_dark
        else:
            confirm_text = "Registrar Retiro"
            confirm_color = self.theme.danger
            confirm_color_hover = self.theme.danger_dark

        self.confirm_btn = QPushButton(confirm_text)
        self.confirm_btn.setFixedHeight(48)
        self.confirm_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.confirm_btn.setStyleSheet(f"""
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
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
                color: {self.theme.gray_500};
            }}
        """)
        self.confirm_btn.clicked.connect(self._on_confirm)

        # Deshabilitar si es retiro y no hay validacion
        if self.movement_type == "withdrawal":
            self.confirm_btn.setEnabled(False)

        layout.addWidget(self.confirm_btn)

        return layout

    def _validate_pin(self) -> None:
        """Valida el PIN del supervisor."""
        pin = self.pin_input.text().strip()

        if not pin:
            QMessageBox.warning(self, "Error", "Ingrese el PIN del supervisor")
            return

        if self.validate_supervisor:
            valid, user_id = self.validate_supervisor(pin)

            if valid and user_id:
                self.supervisor_user_id = user_id
                self.validation_label.setText("Supervisor validado correctamente")
                self.validation_label.setStyleSheet(f"color: {self.theme.success}; font-size: 11px;")
                self.confirm_btn.setEnabled(True)
                self.pin_input.setEnabled(False)
                logger.info(f"Supervisor validado: {user_id}")
            else:
                self.validation_label.setText("PIN incorrecto")
                self.validation_label.setStyleSheet(f"color: {self.theme.danger}; font-size: 11px;")
                self.confirm_btn.setEnabled(False)
        else:
            # Sin validacion, usar PIN como user_id (para pruebas)
            self.supervisor_user_id = pin
            self.validation_label.setText("PIN aceptado")
            self.validation_label.setStyleSheet(f"color: {self.theme.success}; font-size: 11px;")
            self.confirm_btn.setEnabled(True)

    def _on_confirm(self) -> None:
        """Confirma el movimiento."""
        # Validar monto
        try:
            amount_text = self.amount_input.text().strip()
            if not amount_text:
                QMessageBox.warning(self, "Error", "Ingrese el monto")
                return

            amount = float(amount_text)
            if amount <= 0:
                QMessageBox.warning(self, "Error", "El monto debe ser mayor a cero")
                return
        except ValueError:
            QMessageBox.warning(self, "Error", "El monto ingresado no es valido")
            return

        # Obtener datos
        reason = self.reason_combo.currentData()
        description = self.description_input.toPlainText().strip() or None
        reference = self.reference_input.text().strip() or None

        # Registrar movimiento
        if self.movement_type == "deposit":
            movement, error = self.cash_api.deposit(
                amount=amount,
                reason=reason,
                description=description,
                reference=reference,
            )
        else:
            # Validar autorizacion
            if not self.supervisor_user_id:
                QMessageBox.warning(self, "Error", "Se requiere autorizacion de supervisor")
                return

            movement, error = self.cash_api.withdraw(
                amount=amount,
                reason=reason,
                authorized_by_user_id=self.supervisor_user_id,
                description=description,
                reference=reference,
            )

        if error:
            QMessageBox.critical(self, "Error", f"No se pudo registrar el movimiento:\n{error}")
            return

        # Exito
        type_text = "ingreso" if self.movement_type == "deposit" else "retiro"
        QMessageBox.information(
            self,
            "Movimiento Registrado",
            f"Se registro el {type_text} de ${amount:,.2f} correctamente."
        )

        self.movement_registered.emit(movement)
        self.accept()


class QuickCashMovementDialog(QDialog):
    """
    Dialogo simplificado para movimientos rapidos.

    Permite elegir entre ingreso o retiro sin tantos campos.
    """

    movement_registered = pyqtSignal(object)  # CashMovement

    def __init__(
        self,
        validate_supervisor: Optional[Callable[[str], tuple[bool, Optional[str]]]] = None,
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)

        self.validate_supervisor = validate_supervisor
        self.theme = get_theme()

        self.setWindowTitle("Movimiento de Caja")
        self.setMinimumSize(400, 300)

        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Titulo
        title = QLabel("Seleccione el tipo de movimiento")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        # Botones de tipo
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(16)

        # Ingreso
        deposit_btn = QPushButton("Ingreso")
        deposit_btn.setFixedSize(150, 120)
        deposit_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        deposit_btn.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        deposit_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.success};
                color: white;
                border: none;
                border-radius: 12px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.success_dark};
            }}
        """)
        deposit_btn.clicked.connect(lambda: self._open_movement_dialog("deposit"))
        buttons_layout.addWidget(deposit_btn)

        # Retiro
        withdraw_btn = QPushButton("Retiro")
        withdraw_btn.setFixedSize(150, 120)
        withdraw_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        withdraw_btn.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        withdraw_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.danger};
                color: white;
                border: none;
                border-radius: 12px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.danger_dark};
            }}
        """)
        withdraw_btn.clicked.connect(lambda: self._open_movement_dialog("withdrawal"))
        buttons_layout.addWidget(withdraw_btn)

        layout.addLayout(buttons_layout)
        layout.addStretch()

        # Cancelar
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setFixedHeight(44)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.setStyleSheet(f"""
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
        cancel_btn.clicked.connect(self.reject)
        layout.addWidget(cancel_btn)

    def _open_movement_dialog(self, movement_type: str) -> None:
        """Abre el dialogo de movimiento correspondiente."""
        dialog = CashMovementDialog(
            movement_type=movement_type,
            validate_supervisor=self.validate_supervisor,
            parent=self,
        )

        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.accept()
