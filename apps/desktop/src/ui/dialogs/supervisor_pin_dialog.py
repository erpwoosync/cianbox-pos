"""
Dialog para solicitar PIN de supervisor.

Se muestra cuando un usuario sin permiso necesita autorización
de un supervisor para realizar una operación.
"""

from typing import Optional
from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from loguru import logger

from src.ui.styles import get_theme


class SupervisorPinDialog(QDialog):
    """
    Dialog para solicitar PIN de supervisor.

    Muestra un mensaje amigable y un campo para ingresar
    el PIN de 4 dígitos del supervisor.
    """

    def __init__(
        self,
        parent=None,
        message: str = "Esta operación requiere autorización de un supervisor.",
        operation: str = "operación",
    ):
        super().__init__(parent)
        self.theme = get_theme()
        self.message = message
        self.operation = operation
        self._pin: Optional[str] = None

        self._setup_ui()

        logger.info(f"Dialog de PIN de supervisor abierto para: {operation}")

    def _setup_ui(self):
        """Configura la interfaz del dialog."""
        self.setWindowTitle("Autorización Requerida")
        self.setFixedSize(400, 280)
        self.setModal(True)

        # Estilo del dialog
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(30, 30, 30, 30)

        # Icono y título
        header = QFrame()
        header_layout = QVBoxLayout(header)
        header_layout.setSpacing(10)

        # Icono de candado (usando emoji como fallback)
        icon_label = QLabel("🔐")
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon_label.setFont(QFont(self.theme.font_family, 36))
        header_layout.addWidget(icon_label)

        # Título
        title = QLabel("Autorización de Supervisor")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setFont(QFont(self.theme.font_family, 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        header_layout.addWidget(title)

        layout.addWidget(header)

        # Mensaje
        message_label = QLabel(self.message)
        message_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        message_label.setWordWrap(True)
        message_label.setFont(QFont(self.theme.font_family, 12))
        message_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        layout.addWidget(message_label)

        # Campo de PIN
        pin_container = QFrame()
        pin_layout = QHBoxLayout(pin_container)
        pin_layout.setContentsMargins(50, 0, 50, 0)

        self.pin_input = QLineEdit()
        self.pin_input.setPlaceholderText("PIN de 4 dígitos")
        self.pin_input.setMaxLength(4)
        self.pin_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.pin_input.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.pin_input.setFont(QFont(self.theme.font_family, 20, QFont.Weight.Bold))
        self.pin_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                border: 2px solid {self.theme.border};
                border-radius: 8px;
                padding: 12px;
                color: {self.theme.text_primary};
                letter-spacing: 10px;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        self.pin_input.textChanged.connect(self._on_pin_changed)
        self.pin_input.returnPressed.connect(self._on_accept)
        pin_layout.addWidget(self.pin_input)

        layout.addWidget(pin_container)

        # Mensaje de error (oculto inicialmente)
        self.error_label = QLabel()
        self.error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.error_label.setFont(QFont(self.theme.font_family, 11))
        self.error_label.setStyleSheet(f"color: {self.theme.danger};")
        self.error_label.hide()
        layout.addWidget(self.error_label)

        # Botones
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(15)

        self.cancel_btn = QPushButton("Cancelar")
        self.cancel_btn.setFont(QFont(self.theme.font_family, 12))
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 8px;
                padding: 12px 24px;
                min-width: 120px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        self.cancel_btn.clicked.connect(self.reject)
        buttons_layout.addWidget(self.cancel_btn)

        self.accept_btn = QPushButton("Autorizar")
        self.accept_btn.setFont(QFont(self.theme.font_family, 12, QFont.Weight.Bold))
        self.accept_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.accept_btn.setEnabled(False)
        self.accept_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
                padding: 12px 24px;
                min-width: 120px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
                color: {self.theme.gray_500};
            }}
        """)
        self.accept_btn.clicked.connect(self._on_accept)
        buttons_layout.addWidget(self.accept_btn)

        layout.addLayout(buttons_layout)

        # Foco en el campo de PIN
        self.pin_input.setFocus()

    def _on_pin_changed(self, text: str):
        """Maneja cambios en el campo de PIN."""
        # Solo permitir dígitos
        filtered = ''.join(c for c in text if c.isdigit())
        if filtered != text:
            self.pin_input.setText(filtered)
            return

        # Habilitar botón solo si hay 4 dígitos
        self.accept_btn.setEnabled(len(filtered) == 4)

        # Ocultar error al escribir
        self.error_label.hide()

    def _on_accept(self):
        """Maneja el click en Autorizar."""
        pin = self.pin_input.text()
        if len(pin) != 4:
            return

        self._pin = pin
        logger.info("PIN de supervisor ingresado")
        self.accept()

    def show_error(self, message: str):
        """Muestra un mensaje de error."""
        self.error_label.setText(message)
        self.error_label.show()
        self.pin_input.clear()
        self.pin_input.setFocus()

    def get_pin(self) -> Optional[str]:
        """Retorna el PIN ingresado o None si se canceló."""
        return self._pin

    @staticmethod
    def get_supervisor_pin(
        parent=None,
        message: str = "Esta operación requiere autorización de un supervisor.",
        operation: str = "operación",
    ) -> Optional[str]:
        """
        Método estático para mostrar el dialog y obtener el PIN.

        Returns:
            El PIN de 4 dígitos o None si se canceló.
        """
        dialog = SupervisorPinDialog(parent, message, operation)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            return dialog.get_pin()
        return None
