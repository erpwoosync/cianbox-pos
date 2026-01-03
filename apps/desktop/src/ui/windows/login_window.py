"""
Ventana de login con diseno moderno y profesional.

Permite autenticacion con email/password y seleccion de tenant.
Muestra estado del dispositivo (aprobado, pendiente, bloqueado).
"""

from typing import Optional
from threading import Thread

from PyQt6.QtWidgets import (
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QMessageBox,
    QDialog,
    QGraphicsOpacityEffect,
    QSizePolicy,
)
from PyQt6.QtCore import (
    Qt,
    pyqtSignal,
    QTimer,
    QPropertyAnimation,
    QEasingCurve,
    QSize,
)
from PyQt6.QtGui import QFont, QKeyEvent, QIcon, QPainter, QColor, QPen
from PyQt6.QtSvg import QSvgRenderer
from loguru import logger

from src.config import get_settings
from src.api import (
    AuthAPI,
    get_api_client,
    register_terminal,
    TerminalNotActiveError,
    identify_terminal,
    TerminalIdentification,
)
from src.db import session_scope
from src.repositories import ConfigRepository
from src.utils.device import get_device_info
from src.ui.styles import get_theme, get_login_styles


# Iconos SVG inline para evitar dependencias de archivos externos
ICONS = {
    "building": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>""",
    "user": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>""",
    "lock": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>""",
    "monitor": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>""",
    "alert": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>""",
    "help": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>""",
    "eye": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>""",
    "eye-off": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>""",
}


class SvgIcon(QLabel):
    """Widget que renderiza iconos SVG con color personalizable."""

    def __init__(self, svg_data: str, size: int = 20, color: str = "#6b7280"):
        super().__init__()
        self._svg_data = svg_data
        self._size = size
        self._color = color
        self.setFixedSize(size, size)
        self._update_icon()

    def _update_icon(self) -> None:
        """Actualiza el icono con el color actual."""
        # Reemplazar currentColor con el color especificado
        colored_svg = self._svg_data.replace('stroke="currentColor"', f'stroke="{self._color}"')
        self.setStyleSheet(f"""
            QLabel {{
                background-color: transparent;
            }}
        """)
        # Usar el SVG como texto (simplificado)
        self.setText("")

    def set_color(self, color: str) -> None:
        """Cambia el color del icono."""
        self._color = color
        self._update_icon()


class LoadingSpinner(QWidget):
    """Spinner de carga animado."""

    def __init__(self, size: int = 20, parent=None):
        super().__init__(parent)
        self._size = size
        self._angle = 0
        self._color = "#ffffff"
        self.setFixedSize(size, size)

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._rotate)

    def start(self) -> None:
        """Inicia la animacion."""
        self._timer.start(50)

    def stop(self) -> None:
        """Detiene la animacion."""
        self._timer.stop()

    def _rotate(self) -> None:
        """Rota el spinner."""
        self._angle = (self._angle + 30) % 360
        self.update()

    def paintEvent(self, event) -> None:
        """Dibuja el spinner."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Centrar
        painter.translate(self._size / 2, self._size / 2)
        painter.rotate(self._angle)

        # Dibujar arco
        pen = QPen(QColor(self._color))
        pen.setWidth(3)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(pen)

        from PyQt6.QtCore import QRectF
        rect = QRectF(-self._size / 2 + 3, -self._size / 2 + 3,
                      self._size - 6, self._size - 6)
        painter.drawArc(rect, 0, 270 * 16)  # 270 grados


class IconLineEdit(QWidget):
    """Campo de entrada con icono a la izquierda."""

    textChanged = pyqtSignal(str)

    def __init__(
        self,
        icon_name: str,
        placeholder: str = "",
        is_password: bool = False,
        parent=None,
    ):
        super().__init__(parent)
        self.theme = get_theme()
        self.styles = get_login_styles()
        self._is_password = is_password
        self._password_visible = False
        self._has_error = False

        self._setup_ui(icon_name, placeholder)

    def _setup_ui(self, icon_name: str, placeholder: str) -> None:
        """Configura la interfaz."""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Contenedor principal
        self.container = QFrame()
        self.container.setObjectName("inputContainer")
        self._update_container_style()

        container_layout = QHBoxLayout(self.container)
        container_layout.setContentsMargins(10, 0, 10, 0)
        container_layout.setSpacing(8)

        # Icono izquierdo (usando texto como fallback)
        self.icon_label = QLabel(self._get_icon_char(icon_name))
        self.icon_label.setFixedSize(18, 18)
        self.icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.icon_label.setStyleSheet(self.styles.input_icon())
        container_layout.addWidget(self.icon_label)

        # Campo de entrada
        self.line_edit = QLineEdit()
        self.line_edit.setPlaceholderText(placeholder)
        self.line_edit.setStyleSheet(self.styles.input_field())
        self.line_edit.textChanged.connect(self.textChanged.emit)
        self.line_edit.textChanged.connect(self._on_text_changed)
        container_layout.addWidget(self.line_edit, 1)

        # Boton mostrar/ocultar password
        if self._is_password:
            self.line_edit.setEchoMode(QLineEdit.EchoMode.Password)
            self.toggle_btn = QPushButton()
            self.toggle_btn.setFixedSize(18, 18)
            self.toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
            self.toggle_btn.setText("O")  # Ojo cerrado
            self.toggle_btn.setStyleSheet(self.styles.password_toggle())
            self.toggle_btn.clicked.connect(self._toggle_password)
            container_layout.addWidget(self.toggle_btn)

        layout.addWidget(self.container)

    def _get_icon_char(self, icon_name: str) -> str:
        """Obtiene el caracter unicode para el icono."""
        icons = {
            "building": "\U0001F3E2",  # Edificio
            "user": "\U0001F464",      # Usuario
            "lock": "\U0001F512",      # Candado
        }
        return icons.get(icon_name, "\U00002022")

    def _update_container_style(self) -> None:
        """Actualiza el estilo del contenedor."""
        self.container.setStyleSheet(self.styles.input_container(self._has_error))

    def _toggle_password(self) -> None:
        """Alterna visibilidad del password."""
        self._password_visible = not self._password_visible
        if self._password_visible:
            self.line_edit.setEchoMode(QLineEdit.EchoMode.Normal)
            self.toggle_btn.setText("X")  # Ojo abierto/tachado
        else:
            self.line_edit.setEchoMode(QLineEdit.EchoMode.Password)
            self.toggle_btn.setText("O")

    def _on_text_changed(self, text: str) -> None:
        """Limpia el error al escribir."""
        if self._has_error and text:
            self.set_error(False)

    def text(self) -> str:
        """Obtiene el texto del campo."""
        return self.line_edit.text()

    def setText(self, text: str) -> None:
        """Establece el texto del campo."""
        self.line_edit.setText(text)

    def setFocus(self) -> None:
        """Establece el foco en el campo."""
        self.line_edit.setFocus()

    def setEnabled(self, enabled: bool) -> None:
        """Habilita/deshabilita el campo."""
        self.line_edit.setEnabled(enabled)
        opacity = 1.0 if enabled else 0.6
        self.container.setStyleSheet(self.container.styleSheet() + f"""
            QFrame#inputContainer {{
                opacity: {opacity};
            }}
        """)

    def set_error(self, has_error: bool) -> None:
        """Establece el estado de error."""
        self._has_error = has_error
        self._update_container_style()
        self.icon_label.setStyleSheet(self.styles.input_icon(has_error))


class LoginWindow(QMainWindow):
    """
    Ventana de inicio de sesion con diseno moderno.

    Signals:
        login_successful: Emitida al loguearse exitosamente
        _login_finished: Signal interno para comunicar resultado del login
    """

    login_successful = pyqtSignal(dict)
    _login_finished = pyqtSignal(object)

    def __init__(self):
        super().__init__()

        self.settings = get_settings()
        self.theme = get_theme()
        self.auth_api = AuthAPI()
        self._is_loading = False
        self._device_info = None
        self._terminal_id: Optional[TerminalIdentification] = None
        self._spinner = None

        # Conectar signal interno
        self._login_finished.connect(self._on_login_result)

        self._setup_ui()
        self._load_saved_credentials()
        self._prefill_demo_credentials()
        self._center_window()
        self._detect_device()

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setWindowTitle(f"{self.settings.APP_NAME} - Iniciar Sesion")
        self.setFixedSize(520, 720)

        # Widget central con fondo degradado
        central = QWidget()
        central.setStyleSheet(f"""
            QWidget {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 {self.theme.gray_50},
                    stop: 0.5 {self.theme.surface},
                    stop: 1 {self.theme.primary_bg}
                );
            }}
        """)
        self.setCentralWidget(central)

        layout = QVBoxLayout(central)
        layout.setContentsMargins(40, 40, 40, 30)
        layout.setSpacing(0)

        # Card principal
        self.card = self._create_card()
        layout.addWidget(self.card, 1)

        layout.addSpacing(20)

        # Footer
        self._create_footer(layout)

    def _create_card(self) -> QFrame:
        """Crea la tarjeta principal de login."""
        card = QFrame()
        card.setObjectName("loginCard")
        card.setStyleSheet(f"""
            QFrame#loginCard {{
                background-color: {self.theme.surface};
                border-radius: 20px;
                border: 1px solid {self.theme.border_light};
            }}
        """)

        # Sombra mediante efecto de opacidad en el borde
        shadow_frame = QFrame()
        shadow_frame.setStyleSheet(f"""
            background-color: transparent;
        """)

        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(40, 36, 40, 36)
        card_layout.setSpacing(0)

        # Header con logo
        self._create_header(card_layout)

        card_layout.addSpacing(32)

        # Formulario
        self._create_form(card_layout)

        card_layout.addSpacing(16)

        # Mensaje de error
        self._create_error_label(card_layout)

        card_layout.addSpacing(20)

        # Boton de login
        self._create_login_button(card_layout)

        card_layout.addStretch()

        # Info del dispositivo
        self._create_device_info(card_layout)

        return card

    def _create_header(self, layout: QVBoxLayout) -> None:
        """Crea el encabezado con logo y titulo."""
        # Icono/Logo
        logo_container = QWidget()
        logo_container.setStyleSheet("background: transparent;")
        logo_layout = QHBoxLayout(logo_container)
        logo_layout.setContentsMargins(0, 0, 0, 0)
        logo_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # Circulo con icono
        logo_circle = QFrame()
        logo_circle.setFixedSize(72, 72)
        logo_circle.setStyleSheet(f"""
            QFrame {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 {self.theme.primary},
                    stop: 1 {self.theme.primary_dark}
                );
                border-radius: 36px;
            }}
        """)

        logo_icon = QLabel("$")  # Simbolo de caja/dinero
        logo_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo_icon.setStyleSheet(f"""
            color: {self.theme.text_inverse};
            font-size: 32px;
            font-weight: bold;
            font-family: 'Segoe UI', sans-serif;
        """)

        circle_layout = QVBoxLayout(logo_circle)
        circle_layout.setContentsMargins(0, 0, 0, 0)
        circle_layout.addWidget(logo_icon)

        logo_layout.addWidget(logo_circle)
        layout.addWidget(logo_container)

        layout.addSpacing(20)

        # Nombre de la app
        app_name = QLabel(self.settings.APP_NAME)
        app_name.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        app_name.setAlignment(Qt.AlignmentFlag.AlignCenter)
        app_name.setStyleSheet(f"""
            color: {self.theme.text_primary};
            letter-spacing: -0.5px;
            background: transparent;
        """)
        layout.addWidget(app_name)

        layout.addSpacing(8)

        # Subtitulo
        subtitle = QLabel("Inicia sesion para continuar")
        subtitle.setFont(QFont("Segoe UI", 13))
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setStyleSheet(f"color: {self.theme.text_secondary}; background: transparent;")
        layout.addWidget(subtitle)

    def _create_form(self, layout: QVBoxLayout) -> None:
        """Crea el formulario de login."""
        form_layout = QVBoxLayout()
        form_layout.setSpacing(20)

        # Contenedor para campo Tenant (se oculta si terminal identificada)
        self.tenant_container = QWidget()
        tenant_layout = QVBoxLayout(self.tenant_container)
        tenant_layout.setContentsMargins(0, 0, 0, 0)
        tenant_layout.setSpacing(0)

        self.tenant_input = IconLineEdit(
            icon_name="building",
            placeholder="Empresa (codigo)",
        )
        tenant_layout.addWidget(self.tenant_input)
        form_layout.addWidget(self.tenant_container)

        # Info de terminal identificada (oculta por defecto)
        self.terminal_info_container = QFrame()
        self.terminal_info_container.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.success}15;
                border: 1px solid {self.theme.success}50;
                border-radius: 10px;
                padding: 12px;
            }}
        """)
        terminal_info_layout = QVBoxLayout(self.terminal_info_container)
        terminal_info_layout.setContentsMargins(12, 10, 12, 10)
        terminal_info_layout.setSpacing(4)

        self.terminal_tenant_label = QLabel("Empresa")
        self.terminal_tenant_label.setStyleSheet(f"""
            color: {self.theme.success};
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        """)
        terminal_info_layout.addWidget(self.terminal_tenant_label)

        self.terminal_name_label = QLabel("Terminal")
        self.terminal_name_label.setStyleSheet(f"""
            color: {self.theme.text_primary};
            font-size: 15px;
            font-weight: 600;
        """)
        terminal_info_layout.addWidget(self.terminal_name_label)

        self.terminal_branch_label = QLabel("Sucursal")
        self.terminal_branch_label.setStyleSheet(f"""
            color: {self.theme.gray_600};
            font-size: 12px;
        """)
        terminal_info_layout.addWidget(self.terminal_branch_label)

        self.terminal_info_container.hide()
        form_layout.addWidget(self.terminal_info_container)

        form_layout.addSpacing(8)

        # Campo Email (sin label, solo placeholder)
        self.email_input = IconLineEdit(
            icon_name="user",
            placeholder="Correo electronico",
        )
        form_layout.addWidget(self.email_input)

        form_layout.addSpacing(8)

        # Campo Password (sin label, solo placeholder)
        self.password_input = IconLineEdit(
            icon_name="lock",
            placeholder="Contrasena",
            is_password=True,
        )
        form_layout.addWidget(self.password_input)

        layout.addLayout(form_layout)

    def _create_field_label(self, layout: QVBoxLayout, text: str) -> None:
        """Crea la etiqueta de un campo."""
        label = QLabel(text)
        label.setStyleSheet(f"""
            color: {self.theme.gray_700};
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 6px;
        """)
        layout.addWidget(label)

    def _create_error_label(self, layout: QVBoxLayout) -> None:
        """Crea el label de error con animacion."""
        self.error_container = QFrame()
        self.error_container.setObjectName("errorContainer")
        self.error_container.setStyleSheet(f"""
            QFrame#errorContainer {{
                background-color: {self.theme.danger_bg};
                border: 1px solid {self.theme.danger_light};
                border-radius: 10px;
                padding: 0;
            }}
        """)
        self.error_container.hide()

        error_layout = QHBoxLayout(self.error_container)
        error_layout.setContentsMargins(14, 12, 14, 12)
        error_layout.setSpacing(10)

        # Icono de warning
        warning_icon = QLabel("\u26A0")  # Warning symbol
        warning_icon.setStyleSheet(f"""
            color: {self.theme.danger};
            font-size: 16px;
        """)
        warning_icon.setFixedWidth(20)
        error_layout.addWidget(warning_icon)

        # Texto del error
        self.error_label = QLabel()
        self.error_label.setStyleSheet(f"""
            color: {self.theme.danger};
            font-size: 13px;
            font-weight: 500;
        """)
        self.error_label.setWordWrap(True)
        error_layout.addWidget(self.error_label, 1)

        layout.addWidget(self.error_container)

        # Efecto de opacidad para animacion
        self.error_opacity = QGraphicsOpacityEffect(self.error_container)
        self.error_container.setGraphicsEffect(self.error_opacity)

    def _create_login_button(self, layout: QVBoxLayout) -> None:
        """Crea el boton de login con estado de carga."""
        self.login_button = QPushButton()
        self.login_button.setFixedHeight(56)
        self.login_button.setCursor(Qt.CursorShape.PointingHandCursor)
        self.login_button.setStyleSheet(f"""
            QPushButton {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 0,
                    stop: 0 {self.theme.primary},
                    stop: 1 {self.theme.primary_dark}
                );
                color: {self.theme.text_inverse};
                border: none;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }}
            QPushButton:hover {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 0,
                    stop: 0 {self.theme.primary_dark},
                    stop: 1 #2d2a7a
                );
            }}
            QPushButton:pressed {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background: {self.theme.gray_300};
                color: {self.theme.gray_500};
            }}
        """)
        self.login_button.clicked.connect(self._on_login_clicked)

        # Layout interno para texto y spinner
        btn_layout = QHBoxLayout(self.login_button)
        btn_layout.setContentsMargins(0, 0, 0, 0)
        btn_layout.setSpacing(10)
        btn_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # Spinner (oculto inicialmente)
        self._spinner = LoadingSpinner(20)
        self._spinner.hide()
        btn_layout.addWidget(self._spinner)

        # Texto del boton
        self.btn_text = QLabel("INICIAR SESION")
        self.btn_text.setStyleSheet(f"""
            color: {self.theme.text_inverse};
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.5px;
            background: transparent;
        """)
        btn_layout.addWidget(self.btn_text)

        layout.addWidget(self.login_button)

    def _create_device_info(self, layout: QVBoxLayout) -> None:
        """Crea la seccion de informacion del dispositivo."""
        layout.addSpacing(24)

        # Separador
        separator = QFrame()
        separator.setFixedHeight(1)
        separator.setStyleSheet(f"background-color: {self.theme.border_light};")
        layout.addWidget(separator)

        layout.addSpacing(16)

        device_container = QFrame()
        device_container.setStyleSheet("background: transparent;")

        device_layout = QHBoxLayout(device_container)
        device_layout.setContentsMargins(0, 0, 0, 0)
        device_layout.setSpacing(10)

        # Icono de monitor
        monitor_icon = QLabel("\U0001F4BB")  # Laptop emoji
        monitor_icon.setStyleSheet(f"""
            color: {self.theme.gray_400};
            font-size: 16px;
        """)
        device_layout.addWidget(monitor_icon)

        # Nombre del equipo
        self.device_name_label = QLabel("Detectando dispositivo...")
        self.device_name_label.setStyleSheet(f"""
            color: {self.theme.gray_600};
            font-size: 12px;
            font-weight: 500;
        """)
        device_layout.addWidget(self.device_name_label)

        device_layout.addStretch()

        # Badge con ID
        self.device_id_badge = QFrame()
        self.device_id_badge.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_100};
                border-radius: 4px;
                padding: 2px 6px;
            }}
        """)

        badge_layout = QHBoxLayout(self.device_id_badge)
        badge_layout.setContentsMargins(8, 4, 8, 4)
        badge_layout.setSpacing(0)

        self.device_id_label = QLabel("")
        self.device_id_label.setStyleSheet(f"""
            color: {self.theme.gray_500};
            font-size: 10px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-weight: 500;
        """)
        badge_layout.addWidget(self.device_id_label)

        device_layout.addWidget(self.device_id_badge)

        # Tooltip con info completa
        device_container.setToolTip("Informacion del dispositivo para autorizacion")

        layout.addWidget(device_container)

    def _create_footer(self, layout: QVBoxLayout) -> None:
        """Crea el pie con version y ayuda."""
        footer = QWidget()
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(0, 0, 0, 0)
        footer_layout.setSpacing(16)

        # Version
        version = QLabel(f"v{self.settings.APP_VERSION}")
        version.setStyleSheet(f"""
            color: {self.theme.gray_400};
            font-size: 11px;
        """)
        footer_layout.addWidget(version)

        footer_layout.addStretch()

        # Link de ayuda
        help_link = QPushButton("Necesitas ayuda?")
        help_link.setCursor(Qt.CursorShape.PointingHandCursor)
        help_link.setStyleSheet(f"""
            QPushButton {{
                background: transparent;
                border: none;
                color: {self.theme.primary};
                font-size: 11px;
                text-decoration: underline;
            }}
            QPushButton:hover {{
                color: {self.theme.primary_dark};
            }}
        """)
        help_link.clicked.connect(self._show_help)
        footer_layout.addWidget(help_link)

        layout.addWidget(footer)

    def _center_window(self) -> None:
        """Centra la ventana en la pantalla."""
        from src.ui.app import Application
        Application.center_window(self)

    def _detect_device(self) -> None:
        """Detecta y muestra la informacion del dispositivo."""
        try:
            self._device_info = get_device_info()
            self.device_name_label.setText(self._device_info.hostname)
            # Mostrar solo los primeros 8 caracteres del device_id
            short_id = self._device_info.device_id[:8].upper()
            self.device_id_label.setText(f"ID: {short_id}")

            # Tooltip completo
            tooltip = (
                f"Nombre: {self._device_info.hostname}\n"
                f"ID: {self._device_info.device_id}\n"
                f"Sistema: {self._device_info.os_version}"
            )
            self.device_name_label.parent().setToolTip(tooltip)

            logger.debug(f"Dispositivo detectado: {self._device_info.hostname}")

            # Identificar terminal en el backend
            self._identify_terminal()

        except Exception as e:
            logger.error(f"Error detectando dispositivo: {e}")
            self.device_name_label.setText("Error de deteccion")
            self.device_id_label.setText("")
            self.device_id_badge.hide()

    def _identify_terminal(self) -> None:
        """Identifica la terminal en el backend para auto-detectar tenant."""
        if not self._device_info or not self._device_info.mac_address:
            logger.warning("No hay MAC address para identificar terminal")
            return

        try:
            self._terminal_id = identify_terminal(
                mac_address=self._device_info.mac_address,
                api_url=self.settings.API_URL,
            )

            if self._terminal_id.registered and self._terminal_id.is_active:
                # Terminal registrada y activa - ocultar campo empresa
                self.tenant_container.hide()
                self.terminal_info_container.show()

                # Mostrar info de la terminal
                self.terminal_tenant_label.setText(
                    self._terminal_id.tenant_name or "Empresa"
                )
                self.terminal_name_label.setText(
                    self._terminal_id.terminal_name or "Terminal"
                )
                if self._terminal_id.branch_name:
                    self.terminal_branch_label.setText(
                        f"Sucursal: {self._terminal_id.branch_name}"
                    )
                    self.terminal_branch_label.show()
                else:
                    self.terminal_branch_label.hide()

                # Auto-llenar tenant (oculto)
                self.tenant_input.setText(self._terminal_id.tenant_slug or "")

                logger.info(
                    f"Terminal identificada: {self._terminal_id.terminal_name} "
                    f"@ {self._terminal_id.tenant_name}"
                )

            elif self._terminal_id.registered and not self._terminal_id.is_active:
                # Terminal registrada pero no activa
                logger.warning(f"Terminal no activa: {self._terminal_id.message}")
                # Mostrar mensaje pero permitir login manual
                self.tenant_container.show()
                self.terminal_info_container.hide()

            else:
                # Terminal no registrada
                logger.info("Terminal no registrada, mostrando campo empresa")
                self.tenant_container.show()
                self.terminal_info_container.hide()

        except Exception as e:
            logger.error(f"Error identificando terminal: {e}")
            # En caso de error, mostrar campo empresa
            self.tenant_container.show()
            self.terminal_info_container.hide()

    def _load_saved_credentials(self) -> None:
        """Carga credenciales guardadas."""
        try:
            with session_scope() as session:
                config_repo = ConfigRepository(session)
                last_tenant = config_repo.get_last_tenant()
                last_email = config_repo.get_last_email()

                if last_tenant:
                    self.tenant_input.setText(last_tenant)
                if last_email:
                    self.email_input.setText(last_email)
                    self.password_input.setFocus()
                else:
                    self.tenant_input.setFocus()

        except Exception as e:
            logger.warning(f"No se pudieron cargar credenciales: {e}")
            self.tenant_input.setFocus()

    def _prefill_demo_credentials(self) -> None:
        """Pre-llena el formulario con credenciales demo si esta vacio."""
        # Solo pre-llenar si los campos estan vacios
        if not self.tenant_input.text():
            self.tenant_input.setText("demo")
        if not self.email_input.text():
            self.email_input.setText("cajero1@demo.com")
        if not self.password_input.text():
            self.password_input.setText("cajero1@demo.com")

    def _on_login_clicked(self) -> None:
        """Maneja el click en el boton de login."""
        if self._is_loading:
            return

        # Limpiar errores previos
        self._hide_error()
        self.tenant_input.set_error(False)
        self.email_input.set_error(False)
        self.password_input.set_error(False)

        tenant = self.tenant_input.text().strip()
        email = self.email_input.text().strip()
        password = self.password_input.text()

        # Validar campos
        if not tenant:
            self._show_error("Ingresa el codigo de empresa")
            self.tenant_input.set_error(True)
            self.tenant_input.setFocus()
            return

        if not email:
            self._show_error("Ingresa tu email")
            self.email_input.set_error(True)
            self.email_input.setFocus()
            return

        if not password:
            self._show_error("Ingresa tu contrasena")
            self.password_input.set_error(True)
            self.password_input.setFocus()
            return

        # Iniciar login
        self._set_loading(True)

        # Ejecutar login en un thread separado para no bloquear la UI
        thread = Thread(target=self._do_login, args=(tenant, email, password))
        thread.daemon = True
        thread.start()

    def _do_login(self, tenant: str, email: str, password: str) -> None:
        """
        Realiza el login de forma sincrona en un thread.

        Args:
            tenant: Slug del tenant
            email: Email del usuario
            password: Contrasena
        """
        try:
            result = self.auth_api.login(email, password, tenant)
            # Emitir signal para manejar resultado en el hilo principal
            self._login_finished.emit(result)

        except Exception as e:
            logger.error(f"Error en login: {e}")
            # Crear un resultado de error
            from src.api import LoginResult
            error_result = LoginResult(success=False, error="Error de conexion. Verifica tu red.")
            self._login_finished.emit(error_result)

    def _on_login_result(self, result) -> None:
        """
        Maneja el resultado del login en el hilo principal de Qt.

        Args:
            result: LoginResult con el resultado
        """
        try:
            # Manejar dispositivo bloqueado
            if result.device_blocked:
                self._show_device_blocked_dialog(result.error)
                self._set_loading(False)
                return

            if result.success:
                logger.info(f"Login exitoso: {result.user.name}")

                # Guardar credenciales
                try:
                    tenant = self.tenant_input.text().strip()
                    email = self.email_input.text().strip()
                    with session_scope() as session:
                        config_repo = ConfigRepository(session)
                        config_repo.set_last_tenant(tenant)
                        config_repo.set_last_email(email)
                except Exception as e:
                    logger.warning(f"No se pudieron guardar credenciales: {e}")

                # Registrar terminal en el backend
                terminal_info = self._register_terminal()

                # Si la terminal no esta activa, manejar segun su estado
                if terminal_info and not terminal_info.is_active:
                    if terminal_info.is_pending:
                        self._show_terminal_pending_dialog(result, terminal_info)
                        return
                    else:
                        # DISABLED o BLOCKED
                        self._show_terminal_blocked_dialog(terminal_info)
                        self._set_loading(False)
                        return

                # Manejar dispositivo pendiente de aprobacion (legacy)
                if result.device_pending:
                    self._show_device_pending_dialog(result)
                    return

                # Navegar al POS con info de terminal
                self._open_pos_window(result, terminal_info)

            else:
                self._show_error(result.error or "Credenciales invalidas")

        except Exception as e:
            logger.error(f"Error procesando login: {e}")
            self._show_error("Error de conexion. Verifica tu red.")

        finally:
            self._set_loading(False)

    def _register_terminal(self):
        """
        Registra la terminal en el backend.

        Returns:
            TerminalInfo o None si falla
        """
        if not self._device_info:
            logger.warning("No hay info del dispositivo para registrar")
            return None

        try:
            terminal_info = register_terminal(
                hostname=self._device_info.hostname,
                mac_address=self._device_info.mac_address,
                os_version=self._device_info.os_version,
                app_version=self._device_info.app_version,
                ip_address=self._device_info.ip_address,
            )

            if terminal_info.is_new:
                logger.info(f"Nueva terminal registrada: {terminal_info.hostname}")
            else:
                logger.info(f"Terminal actualizada: {terminal_info.hostname} ({terminal_info.status})")

            return terminal_info

        except TerminalNotActiveError as e:
            logger.warning(f"Terminal no activa: {e.terminal_status}")
            # Crear un TerminalInfo basico para mostrar el dialogo
            from src.api import TerminalInfo
            return TerminalInfo(
                id="",
                device_id=self._device_info.device_id,
                hostname=self._device_info.hostname,
                mac_address=self._device_info.mac_address,
                name=None,
                status=e.terminal_status,
                point_of_sale=None,
            )
        except Exception as e:
            logger.error(f"Error registrando terminal: {e}")
            # Continuar sin registro de terminal (modo offline)
            return None

    def _show_terminal_pending_dialog(self, login_result, terminal_info) -> None:
        """
        Muestra dialogo de terminal pendiente de activacion.

        Args:
            login_result: Resultado del login
            terminal_info: Info de la terminal
        """
        dialog = QDialog(self)
        dialog.setWindowTitle("Terminal Pendiente")
        dialog.setFixedSize(480, 340)
        dialog.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.surface};
            }}
        """)

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(32, 32, 32, 32)
        layout.setSpacing(20)

        # Icono de warning
        icon_container = QWidget()
        icon_layout = QHBoxLayout(icon_container)
        icon_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        warning_circle = QFrame()
        warning_circle.setFixedSize(56, 56)
        warning_circle.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.warning_bg};
                border-radius: 28px;
            }}
        """)
        warning_icon = QLabel("\u26A0")
        warning_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        warning_icon.setStyleSheet(f"""
            color: {self.theme.warning};
            font-size: 28px;
        """)
        circle_layout = QVBoxLayout(warning_circle)
        circle_layout.setContentsMargins(0, 0, 0, 0)
        circle_layout.addWidget(warning_icon)

        icon_layout.addWidget(warning_circle)
        layout.addWidget(icon_container)

        # Titulo
        title = QLabel("Terminal Pendiente de Activacion")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Mensaje
        message = QLabel(
            f"Esta terminal ({terminal_info.hostname}) se ha registrado pero "
            f"aun no ha sido activada por un administrador.\n\n"
            f"MAC: {terminal_info.mac_address}\n\n"
            f"Un administrador debe ir a Backoffice > Terminales POS "
            f"para activar esta terminal y asignarle un punto de venta."
        )
        message.setWordWrap(True)
        message.setAlignment(Qt.AlignmentFlag.AlignCenter)
        message.setStyleSheet(f"""
            color: {self.theme.text_secondary};
            font-size: 13px;
            line-height: 1.5;
        """)
        layout.addWidget(message)

        layout.addStretch()

        # Boton aceptar
        ok_btn = QPushButton("Entendido")
        ok_btn.setFixedHeight(44)
        ok_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        ok_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: {self.theme.text_inverse};
                border: none;
                border-radius: 10px;
                padding: 0 32px;
                font-weight: 600;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        ok_btn.clicked.connect(dialog.accept)
        layout.addWidget(ok_btn, alignment=Qt.AlignmentFlag.AlignCenter)

        dialog.exec()
        self._set_loading(False)

    def _show_terminal_blocked_dialog(self, terminal_info) -> None:
        """
        Muestra dialogo de terminal bloqueada/deshabilitada.

        Args:
            terminal_info: Info de la terminal
        """
        msg_box = QMessageBox(self)
        msg_box.setWindowTitle("Terminal Deshabilitada")
        msg_box.setIcon(QMessageBox.Icon.Critical)
        msg_box.setText("Esta terminal ha sido deshabilitada")
        msg_box.setInformativeText(
            f"Terminal: {terminal_info.hostname}\n"
            f"MAC: {terminal_info.mac_address}\n\n"
            f"Contacte al administrador para reactivar esta terminal."
        )
        msg_box.setStandardButtons(QMessageBox.StandardButton.Ok)
        msg_box.setStyleSheet(f"""
            QMessageBox {{
                background-color: {self.theme.surface};
            }}
            QMessageBox QLabel {{
                color: {self.theme.text_primary};
                min-width: 300px;
            }}
        """)
        msg_box.exec()

    def _open_pos_window(self, login_result, terminal_info=None) -> None:
        """
        Abre la ventana principal del POS.

        Args:
            login_result: Resultado del login
            terminal_info: Info de la terminal registrada (opcional)
        """
        from .main_window import MainWindow

        # Preparar datos para el POS
        user_data = {
            "id": login_result.user.id,
            "email": login_result.user.email,
            "name": login_result.user.name,
            "role_name": login_result.user.role_name,
            "permissions": login_result.user.permissions,
            "branch_id": login_result.user.branch_id,
            "branch_name": login_result.user.branch_name,
        }

        tenant_data = {
            "id": login_result.tenant.id,
            "name": login_result.tenant.name,
            "slug": login_result.tenant.slug,
        }

        # Datos de terminal (si esta disponible, usar sucursal/lista de terminal)
        terminal_data = None
        if terminal_info and terminal_info.is_active:
            terminal_data = {
                "id": terminal_info.id,
                "device_id": terminal_info.device_id,
                "hostname": terminal_info.hostname,
                "name": terminal_info.name,
                "point_of_sale_id": terminal_info.pos_id,
                "pos_code": terminal_info.pos_code,
                "pos_name": terminal_info.pos_name,
                "branch_id": terminal_info.branch_id,
                "branch_name": terminal_info.branch_name,
                "price_list_id": terminal_info.price_list_id,
                "price_list_name": terminal_info.price_list_name,
            }
            # Si la terminal tiene sucursal asignada, usarla
            if terminal_info.branch_id:
                user_data["branch_id"] = terminal_info.branch_id
                user_data["branch_name"] = terminal_info.branch_name
                logger.info(f"Usando sucursal de terminal: {terminal_info.branch_name}")

        # Crear y mostrar ventana principal
        self.main_window = MainWindow(user_data, tenant_data, terminal_data)
        self.main_window.show()

        # Cerrar ventana de login
        self.close()

    def _show_error(self, message: str) -> None:
        """Muestra un mensaje de error con animacion."""
        self.error_label.setText(message)
        self.error_container.show()

        # Animacion de fade in
        self.error_opacity.setOpacity(0)
        self.fade_anim = QPropertyAnimation(self.error_opacity, b"opacity")
        self.fade_anim.setDuration(200)
        self.fade_anim.setStartValue(0)
        self.fade_anim.setEndValue(1)
        self.fade_anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.fade_anim.start()

    def _hide_error(self) -> None:
        """Oculta el mensaje de error."""
        self.error_container.hide()

    def _set_loading(self, loading: bool) -> None:
        """Establece el estado de carga."""
        self._is_loading = loading
        self.login_button.setEnabled(not loading)

        if loading:
            self.btn_text.setText("INGRESANDO...")
            self._spinner.show()
            self._spinner.start()
        else:
            self.btn_text.setText("INICIAR SESION")
            self._spinner.stop()
            self._spinner.hide()

        self.tenant_input.setEnabled(not loading)
        self.email_input.setEnabled(not loading)
        self.password_input.setEnabled(not loading)

    def _show_help(self) -> None:
        """Muestra dialogo de ayuda."""
        msg = QMessageBox(self)
        msg.setWindowTitle("Ayuda")
        msg.setIcon(QMessageBox.Icon.Information)
        msg.setText("Soporte de Cianbox POS")
        msg.setInformativeText(
            "Si tienes problemas para iniciar sesion:\n\n"
            "1. Verifica que el codigo de empresa sea correcto\n"
            "2. Asegurate de usar el email registrado\n"
            "3. Revisa que la contrasena sea correcta\n\n"
            "Contacto: soporte@cianbox.com"
        )
        msg.setStyleSheet(f"""
            QMessageBox {{
                background-color: {self.theme.surface};
            }}
            QMessageBox QLabel {{
                color: {self.theme.text_primary};
            }}
        """)
        msg.exec()

    def keyPressEvent(self, event: QKeyEvent) -> None:
        """Maneja eventos de teclado."""
        if event.key() in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
            self._on_login_clicked()
        elif event.key() == Qt.Key.Key_Escape:
            self.close()
        elif event.key() == Qt.Key.Key_Tab:
            # Tab funciona normalmente
            super().keyPressEvent(event)
        else:
            super().keyPressEvent(event)

    def _show_device_blocked_dialog(self, message: Optional[str] = None) -> None:
        """
        Muestra dialogo de dispositivo bloqueado.

        Args:
            message: Mensaje del servidor
        """
        device_id = self._device_info.device_id[:8] if self._device_info else "UNKNOWN"

        msg_box = QMessageBox(self)
        msg_box.setWindowTitle("Dispositivo Bloqueado")
        msg_box.setIcon(QMessageBox.Icon.Critical)
        msg_box.setText("Este dispositivo ha sido bloqueado")
        msg_box.setInformativeText(
            f"{message or 'Contacte al administrador para mas informacion.'}\n\n"
            f"ID del dispositivo: {device_id}..."
        )
        msg_box.setStandardButtons(QMessageBox.StandardButton.Ok)
        msg_box.setStyleSheet(f"""
            QMessageBox {{
                background-color: {self.theme.surface};
            }}
            QMessageBox QLabel {{
                color: {self.theme.text_primary};
                min-width: 300px;
            }}
        """)
        msg_box.exec()

    def _show_device_pending_dialog(self, login_result) -> None:
        """
        Muestra dialogo de dispositivo pendiente de aprobacion.

        Permite al usuario continuar de todos modos o esperar aprobacion.

        Args:
            login_result: Resultado del login
        """
        device_id = self._device_info.device_id[:8] if self._device_info else "UNKNOWN"
        hostname = self._device_info.hostname if self._device_info else "Desconocido"

        dialog = QDialog(self)
        dialog.setWindowTitle("Dispositivo Pendiente")
        dialog.setFixedSize(480, 320)
        dialog.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.surface};
            }}
        """)

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(32, 32, 32, 32)
        layout.setSpacing(20)

        # Icono de warning
        icon_container = QWidget()
        icon_layout = QHBoxLayout(icon_container)
        icon_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        warning_circle = QFrame()
        warning_circle.setFixedSize(56, 56)
        warning_circle.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.warning_bg};
                border-radius: 28px;
            }}
        """)
        warning_icon = QLabel("\u26A0")
        warning_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        warning_icon.setStyleSheet(f"""
            color: {self.theme.warning};
            font-size: 28px;
        """)
        circle_layout = QVBoxLayout(warning_circle)
        circle_layout.setContentsMargins(0, 0, 0, 0)
        circle_layout.addWidget(warning_icon)

        icon_layout.addWidget(warning_circle)
        layout.addWidget(icon_container)

        # Titulo
        title = QLabel("Dispositivo Pendiente de Aprobacion")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Mensaje
        message = QLabel(
            f"Este equipo ({hostname}) se ha registrado pero aun no ha sido "
            f"aprobado por un administrador.\n\n"
            f"ID: {device_id}...\n\n"
            f"Puede continuar trabajando, pero un administrador debe aprobar "
            f"este dispositivo para uso permanente."
        )
        message.setWordWrap(True)
        message.setAlignment(Qt.AlignmentFlag.AlignCenter)
        message.setStyleSheet(f"""
            color: {self.theme.text_secondary};
            font-size: 13px;
            line-height: 1.5;
        """)
        layout.addWidget(message)

        layout.addStretch()

        # Botones
        button_layout = QHBoxLayout()
        button_layout.setSpacing(12)

        # Boton cancelar
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setFixedHeight(44)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 10px;
                padding: 0 24px;
                font-weight: 500;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_200};
            }}
        """)
        cancel_btn.clicked.connect(dialog.reject)
        button_layout.addWidget(cancel_btn)

        # Boton continuar
        continue_btn = QPushButton("Continuar de Todos Modos")
        continue_btn.setFixedHeight(44)
        continue_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        continue_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.warning};
                color: {self.theme.text_inverse};
                border: none;
                border-radius: 10px;
                padding: 0 24px;
                font-weight: 600;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.warning_dark};
            }}
        """)
        continue_btn.clicked.connect(dialog.accept)
        button_layout.addWidget(continue_btn)

        layout.addLayout(button_layout)

        # Ejecutar dialogo
        if dialog.exec() == QDialog.DialogCode.Accepted:
            # Usuario eligio continuar
            self._open_pos_window(login_result)
        else:
            # Usuario cancelo
            self._set_loading(False)
