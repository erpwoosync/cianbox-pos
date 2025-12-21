"""
Clase principal de la aplicacion PyQt6.

Maneja la inicializacion de la aplicacion, estilos y ciclo de vida.
"""

import sys
from typing import Optional

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QPalette, QColor
from loguru import logger

from src.config import get_settings

# Material Design theme
try:
    from qt_material import apply_stylesheet
    HAS_QT_MATERIAL = True
except ImportError:
    HAS_QT_MATERIAL = False


class Application(QApplication):
    """
    Aplicacion principal de Cianbox POS.

    Extiende QApplication para configurar estilos, fuentes y
    manejar el ciclo de vida de la aplicacion.
    """

    def __init__(self, argv: list = None):
        """
        Inicializa la aplicacion.

        Args:
            argv: Argumentos de linea de comandos
        """
        super().__init__(argv or sys.argv)

        self.settings = get_settings()
        self._setup_app_info()
        self._setup_style()
        self._setup_font()

        logger.info(f"Aplicacion {self.settings.APP_NAME} inicializada")

    def _setup_app_info(self) -> None:
        """Configura informacion de la aplicacion."""
        self.setApplicationName(self.settings.APP_NAME)
        self.setApplicationVersion(self.settings.APP_VERSION)
        self.setOrganizationName("Cianbox")
        self.setOrganizationDomain("cianbox.com")

    def _setup_style(self) -> None:
        """Configura el estilo visual tipo Office/Excel."""
        # Usar Fusion como base (mas limpio y profesional)
        self.setStyle("Fusion")

        # Aplicar paleta de colores Office
        palette = self._create_office_palette()
        self.setPalette(palette)

        # Aplicar stylesheet personalizado estilo Office
        stylesheet = self._get_office_stylesheet()
        self.setStyleSheet(stylesheet)

        logger.info("Tema estilo Office/Excel aplicado")

    def _create_office_palette(self) -> QPalette:
        """Crea paleta de colores estilo Office."""
        palette = QPalette()

        # Colores base
        palette.setColor(QPalette.ColorRole.Window, QColor("#f3f2f1"))
        palette.setColor(QPalette.ColorRole.WindowText, QColor("#201f1e"))
        palette.setColor(QPalette.ColorRole.Base, QColor("#ffffff"))
        palette.setColor(QPalette.ColorRole.AlternateBase, QColor("#faf9f8"))
        palette.setColor(QPalette.ColorRole.Text, QColor("#201f1e"))
        palette.setColor(QPalette.ColorRole.Button, QColor("#f3f2f1"))
        palette.setColor(QPalette.ColorRole.ButtonText, QColor("#201f1e"))
        palette.setColor(QPalette.ColorRole.Highlight, QColor("#217346"))
        palette.setColor(QPalette.ColorRole.HighlightedText, QColor("#ffffff"))
        palette.setColor(QPalette.ColorRole.Link, QColor("#0078d4"))

        return palette

    def _get_office_stylesheet(self) -> str:
        """Retorna stylesheet estilo Office/Excel."""
        return """
        /* ========== ESTILO OFFICE/EXCEL ========== */

        QMainWindow, QDialog {
            background-color: #f3f2f1;
        }

        /* Botones estilo Office */
        QPushButton {
            background-color: #ffffff;
            color: #201f1e;
            border: 1px solid #d2d0ce;
            border-radius: 2px;
            padding: 6px 16px;
            font-size: 13px;
            min-height: 28px;
        }

        QPushButton:hover {
            background-color: #f3f2f1;
            border-color: #a19f9d;
        }

        QPushButton:pressed {
            background-color: #edebe9;
        }

        QPushButton:disabled {
            background-color: #f3f2f1;
            color: #a19f9d;
            border-color: #edebe9;
        }

        /* Boton primario (verde Excel) */
        QPushButton[class="primary"], QPushButton#primaryBtn {
            background-color: #217346;
            color: #ffffff;
            border: none;
        }

        QPushButton[class="primary"]:hover, QPushButton#primaryBtn:hover {
            background-color: #1e5c38;
        }

        /* Inputs estilo Office */
        QLineEdit, QTextEdit, QPlainTextEdit {
            background-color: #ffffff;
            color: #201f1e;
            border: 1px solid #d2d0ce;
            border-radius: 2px;
            padding: 6px 8px;
            font-size: 13px;
            selection-background-color: #217346;
        }

        QLineEdit:focus, QTextEdit:focus {
            border-color: #217346;
        }

        QLineEdit:disabled {
            background-color: #f3f2f1;
            color: #a19f9d;
        }

        /* ComboBox */
        QComboBox {
            background-color: #ffffff;
            border: 1px solid #d2d0ce;
            border-radius: 2px;
            padding: 6px 8px;
            min-height: 28px;
        }

        QComboBox:hover {
            border-color: #a19f9d;
        }

        QComboBox:focus {
            border-color: #217346;
        }

        QComboBox::drop-down {
            border: none;
            width: 24px;
        }

        QComboBox QAbstractItemView {
            background-color: #ffffff;
            border: 1px solid #d2d0ce;
            selection-background-color: #217346;
            selection-color: #ffffff;
        }

        /* Labels */
        QLabel {
            color: #201f1e;
        }

        /* Tablas estilo Excel */
        QTableWidget, QTableView {
            background-color: #ffffff;
            gridline-color: #edebe9;
            border: 1px solid #d2d0ce;
            selection-background-color: #e6f4ea;
            selection-color: #201f1e;
        }

        QTableWidget::item, QTableView::item {
            padding: 4px 8px;
            border-bottom: 1px solid #edebe9;
        }

        QTableWidget::item:selected, QTableView::item:selected {
            background-color: #e6f4ea;
            color: #201f1e;
        }

        QHeaderView::section {
            background-color: #f3f2f1;
            color: #201f1e;
            font-weight: 600;
            padding: 8px;
            border: none;
            border-right: 1px solid #d2d0ce;
            border-bottom: 1px solid #d2d0ce;
        }

        /* ScrollBars estilo Office */
        QScrollBar:vertical {
            background-color: #f3f2f1;
            width: 14px;
            margin: 0;
        }

        QScrollBar::handle:vertical {
            background-color: #c8c6c4;
            min-height: 30px;
            margin: 2px;
            border-radius: 2px;
        }

        QScrollBar::handle:vertical:hover {
            background-color: #a19f9d;
        }

        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
            height: 0;
        }

        QScrollBar:horizontal {
            background-color: #f3f2f1;
            height: 14px;
        }

        QScrollBar::handle:horizontal {
            background-color: #c8c6c4;
            min-width: 30px;
            margin: 2px;
            border-radius: 2px;
        }

        /* Frames/Paneles */
        QFrame {
            border: none;
        }

        QFrame[class="card"] {
            background-color: #ffffff;
            border: 1px solid #d2d0ce;
            border-radius: 2px;
        }

        /* GroupBox */
        QGroupBox {
            font-weight: 600;
            border: 1px solid #d2d0ce;
            border-radius: 2px;
            margin-top: 8px;
            padding-top: 8px;
        }

        QGroupBox::title {
            subcontrol-origin: margin;
            padding: 0 4px;
        }

        /* StatusBar */
        QStatusBar {
            background-color: #f3f2f1;
            border-top: 1px solid #d2d0ce;
            color: #605e5c;
        }

        /* Tabs */
        QTabWidget::pane {
            border: 1px solid #d2d0ce;
            background-color: #ffffff;
        }

        QTabBar::tab {
            background-color: #edebe9;
            color: #605e5c;
            padding: 8px 16px;
            border: 1px solid #d2d0ce;
            border-bottom: none;
            margin-right: 2px;
        }

        QTabBar::tab:selected {
            background-color: #ffffff;
            color: #201f1e;
            font-weight: 600;
        }

        QTabBar::tab:hover:!selected {
            background-color: #f3f2f1;
        }

        /* ToolTip */
        QToolTip {
            background-color: #323130;
            color: #ffffff;
            border: none;
            padding: 6px 8px;
            font-size: 12px;
        }

        /* Menu */
        QMenuBar {
            background-color: #f3f2f1;
            border-bottom: 1px solid #d2d0ce;
        }

        QMenuBar::item {
            padding: 6px 12px;
        }

        QMenuBar::item:selected {
            background-color: #edebe9;
        }

        QMenu {
            background-color: #ffffff;
            border: 1px solid #d2d0ce;
        }

        QMenu::item {
            padding: 6px 24px;
        }

        QMenu::item:selected {
            background-color: #e6f4ea;
        }

        /* Progress Bar */
        QProgressBar {
            background-color: #edebe9;
            border: none;
            border-radius: 2px;
            height: 4px;
            text-align: center;
        }

        QProgressBar::chunk {
            background-color: #217346;
            border-radius: 2px;
        }

        /* CheckBox y Radio */
        QCheckBox, QRadioButton {
            spacing: 8px;
        }

        QCheckBox::indicator {
            width: 16px;
            height: 16px;
            border: 1px solid #605e5c;
            border-radius: 2px;
            background-color: #ffffff;
        }

        QCheckBox::indicator:checked {
            background-color: #217346;
            border-color: #217346;
        }

        QRadioButton::indicator {
            width: 16px;
            height: 16px;
            border: 1px solid #605e5c;
            border-radius: 8px;
            background-color: #ffffff;
        }

        QRadioButton::indicator:checked {
            background-color: #217346;
            border-color: #217346;
        }
        """

    def _get_custom_material_overrides(self) -> str:
        """Retorna estilos personalizados para el POS sobre Material Design (tema claro)."""
        return """
        /* ========== CIANBOX POS OVERRIDES (LIGHT THEME) ========== */

        /* Cards de productos */
        QFrame[class="product-card"] {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
        }

        QFrame[class="product-card"]:hover {
            border-color: #009688;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        /* Panel de carrito */
        QFrame[class="cart-panel"] {
            background-color: #ffffff;
            border-left: 2px solid #009688;
        }

        /* Header del POS */
        QFrame[class="pos-header"] {
            background-color: #009688;
            border-bottom: none;
        }

        /* Sidebar de categorias */
        QFrame[class="sidebar"] {
            background-color: #fafafa;
        }

        /* Botones de categoria */
        QPushButton[class="category-btn"] {
            background-color: transparent;
            color: #616161;
            border: none;
            border-radius: 8px;
            padding: 12px 16px;
            text-align: left;
            font-size: 14px;
        }

        QPushButton[class="category-btn"]:hover {
            background-color: #e0f2f1;
            color: #009688;
        }

        QPushButton[class="category-btn"][selected="true"] {
            background-color: #009688;
            color: #ffffff;
            font-weight: bold;
        }

        /* Boton cobrar grande */
        QPushButton[class="checkout-btn"] {
            background-color: #009688;
            color: #ffffff;
            font-size: 18px;
            font-weight: bold;
            border-radius: 8px;
            padding: 16px;
            min-height: 56px;
        }

        QPushButton[class="checkout-btn"]:hover {
            background-color: #00796b;
        }

        QPushButton[class="checkout-btn"]:disabled {
            background-color: #e0e0e0;
            color: #9e9e9e;
        }

        /* Boton de pago exitoso */
        QPushButton[class="success-btn"] {
            background-color: #4caf50;
            color: #ffffff;
            font-weight: bold;
        }

        QPushButton[class="success-btn"]:hover {
            background-color: #388e3c;
        }

        /* Boton cancelar */
        QPushButton[class="danger-btn"] {
            background-color: #f44336;
            color: #ffffff;
        }

        QPushButton[class="danger-btn"]:hover {
            background-color: #d32f2f;
        }

        /* Labels de precios */
        QLabel[class="price-large"] {
            font-size: 32px;
            font-weight: bold;
            color: #009688;
        }

        QLabel[class="price-medium"] {
            font-size: 20px;
            font-weight: bold;
            color: #212121;
        }

        QLabel[class="original-price"] {
            font-size: 14px;
            color: #9e9e9e;
            text-decoration: line-through;
        }

        /* Badge de promocion */
        QLabel[class="promo-badge"] {
            background-color: #ff5722;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            border-radius: 4px;
            padding: 2px 6px;
        }

        /* Items del carrito */
        QFrame[class="cart-item"] {
            background-color: #fafafa;
            border-radius: 8px;
            padding: 8px;
            margin: 4px 0;
        }

        QFrame[class="cart-item"]:hover {
            background-color: #e0f2f1;
        }

        /* Totales */
        QFrame[class="totals-panel"] {
            background-color: #fafafa;
            border-top: 2px solid #009688;
            padding: 16px;
        }

        /* ScrollArea transparente */
        QScrollArea {
            background-color: transparent;
            border: none;
        }

        QScrollArea > QWidget > QWidget {
            background-color: transparent;
        }

        /* Scrollbar personalizado */
        QScrollBar:vertical {
            background-color: #f5f5f5;
            width: 10px;
            border-radius: 5px;
        }

        QScrollBar::handle:vertical {
            background-color: #bdbdbd;
            border-radius: 5px;
            min-height: 30px;
        }

        QScrollBar::handle:vertical:hover {
            background-color: #009688;
        }

        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
            height: 0;
        }

        /* Input de busqueda */
        QLineEdit[class="search-input"] {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            padding: 10px 16px 10px 40px;
            font-size: 14px;
            color: #212121;
        }

        QLineEdit[class="search-input"]:focus {
            border-color: #009688;
        }

        /* Dialogs */
        QDialog {
            background-color: #ffffff;
        }

        /* Teclado numerico */
        QPushButton[class="numpad-btn"] {
            background-color: #fafafa;
            color: #212121;
            font-size: 24px;
            font-weight: bold;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            min-width: 70px;
            min-height: 60px;
        }

        QPushButton[class="numpad-btn"]:hover {
            background-color: #e0f2f1;
            border-color: #009688;
        }

        QPushButton[class="numpad-btn"]:pressed {
            background-color: #009688;
            color: #ffffff;
        }

        /* Metodos de pago */
        QPushButton[class="payment-method"] {
            background-color: #ffffff;
            color: #616161;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 20px;
            font-size: 16px;
        }

        QPushButton[class="payment-method"]:hover {
            border-color: #009688;
            color: #009688;
        }

        QPushButton[class="payment-method"][selected="true"] {
            background-color: #009688;
            border-color: #009688;
            color: #ffffff;
            font-weight: bold;
        }

        /* Status bar */
        QStatusBar {
            background-color: #fafafa;
            color: #757575;
            border-top: 1px solid #e0e0e0;
        }

        /* User info panel */
        QFrame[class="user-info"] {
            background-color: rgba(255,255,255,0.9);
            border-radius: 8px;
            padding: 8px 12px;
        }
        """

    def _setup_font(self) -> None:
        """Configura la fuente global."""
        font = QFont("Segoe UI", 10)
        font.setStyleHint(QFont.StyleHint.SansSerif)
        self.setFont(font)

    def run(self) -> int:
        """
        Ejecuta la aplicacion.

        Returns:
            Codigo de salida
        """
        from .windows.login_window import LoginWindow

        logger.info("Iniciando ventana de login")

        # Crear y mostrar ventana de login
        login_window = LoginWindow()
        login_window.show()

        # Ejecutar loop de eventos
        return self.exec()

    @staticmethod
    def center_window(window) -> None:
        """
        Centra una ventana en la pantalla.

        Args:
            window: Ventana a centrar
        """
        screen = QApplication.primaryScreen()
        if screen:
            screen_geometry = screen.geometry()
            window_geometry = window.frameGeometry()
            x = (screen_geometry.width() - window_geometry.width()) // 2
            y = (screen_geometry.height() - window_geometry.height()) // 2
            window.move(x, y)

    @staticmethod
    def get_screen_size() -> tuple[int, int]:
        """
        Obtiene el tamano de la pantalla principal.

        Returns:
            Tupla (ancho, alto)
        """
        screen = QApplication.primaryScreen()
        if screen:
            size = screen.size()
            return size.width(), size.height()
        return 1920, 1080  # Default


def create_application() -> Application:
    """
    Crea e inicializa la aplicacion.

    Returns:
        Instancia de Application
    """
    # Configurar atributos antes de crear QApplication
    # (necesario en algunas plataformas)

    app = Application()
    return app
