"""
Ventana principal del POS.

Interfaz de ventas con busqueda de productos, carrito y cobro.
"""

from typing import Optional, Dict, Any

from PyQt6.QtWidgets import (
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QStatusBar,
    QMenuBar,
    QMenu,
    QToolBar,
    QMessageBox,
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QFont, QKeyEvent, QAction, QCloseEvent
from loguru import logger

from src.config import get_settings
from src.api import get_api_client
from src.ui.styles import get_theme


class POSWindow(QMainWindow):
    """
    Ventana principal del punto de venta.

    Attributes:
        user: Datos del usuario logueado
        tenant: Datos del tenant
    """

    def __init__(self, user: Dict[str, Any], tenant: Dict[str, Any]):
        super().__init__()

        self.user = user
        self.tenant = tenant
        self.settings = get_settings()
        self.theme = get_theme()

        # Estado del carrito
        self.cart_items: list = []
        self.cart_total: float = 0.0

        self._setup_ui()
        self._setup_shortcuts()

        logger.info(f"POS iniciado: {user.get('name')} @ {tenant.get('name')}")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setWindowTitle(f"{self.settings.APP_NAME} - {self.tenant.get('name', 'POS')}")
        self.setMinimumSize(1280, 720)
        self.showMaximized()

        # Menu bar
        self._create_menu()

        # Toolbar
        self._create_toolbar()

        # Contenido principal
        central = QWidget()
        self.setCentralWidget(central)

        layout = QHBoxLayout(central)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(12)

        # Splitter para redimensionar paneles
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Panel izquierdo - Productos
        left_panel = self._create_products_panel()
        splitter.addWidget(left_panel)

        # Panel derecho - Carrito
        right_panel = self._create_cart_panel()
        splitter.addWidget(right_panel)

        # Proporciones
        splitter.setSizes([700, 500])
        splitter.setStretchFactor(0, 2)
        splitter.setStretchFactor(1, 1)

        layout.addWidget(splitter)

        # Status bar
        self._create_statusbar()

    def _create_menu(self) -> None:
        """Crea la barra de menu."""
        menubar = self.menuBar()

        # Menu Archivo
        file_menu = menubar.addMenu("&Archivo")

        sync_action = QAction("Sincronizar productos", self)
        sync_action.setShortcut("F5")
        sync_action.triggered.connect(self._on_sync)
        file_menu.addAction(sync_action)

        file_menu.addSeparator()

        logout_action = QAction("Cerrar sesion", self)
        logout_action.triggered.connect(self._on_logout)
        file_menu.addAction(logout_action)

        exit_action = QAction("Salir", self)
        exit_action.setShortcut("Alt+F4")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # Menu Ventas
        sales_menu = menubar.addMenu("&Ventas")

        new_action = QAction("Nueva venta", self)
        new_action.setShortcut("Ctrl+N")
        new_action.triggered.connect(self._on_new_sale)
        sales_menu.addAction(new_action)

        # Menu Caja
        cash_menu = menubar.addMenu("&Caja")

        open_action = QAction("Abrir turno", self)
        open_action.triggered.connect(self._on_open_cash)
        cash_menu.addAction(open_action)

        close_action = QAction("Cerrar turno", self)
        close_action.triggered.connect(self._on_close_cash)
        cash_menu.addAction(close_action)

        # Menu Ayuda
        help_menu = menubar.addMenu("A&yuda")

        help_action = QAction("Ayuda", self)
        help_action.setShortcut("F1")
        help_action.triggered.connect(self._on_help)
        help_menu.addAction(help_action)

        about_action = QAction("Acerca de", self)
        about_action.triggered.connect(self._on_about)
        help_menu.addAction(about_action)

    def _create_toolbar(self) -> None:
        """Crea la barra de herramientas."""
        toolbar = QToolBar("Acciones")
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(24, 24))
        toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextUnderIcon)
        self.addToolBar(toolbar)

        new_btn = QAction("Nueva Venta", self)
        new_btn.triggered.connect(self._on_new_sale)
        toolbar.addAction(new_btn)

        toolbar.addSeparator()

        price_btn = QAction("Consultar Precio", self)
        price_btn.triggered.connect(self._on_price_check)
        toolbar.addAction(price_btn)

        drawer_btn = QAction("Abrir Cajon", self)
        drawer_btn.triggered.connect(self._on_open_drawer)
        toolbar.addAction(drawer_btn)

    def _create_products_panel(self) -> QFrame:
        """Crea el panel de productos."""
        panel = QFrame()
        panel.setProperty("class", "card")
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Barra de busqueda
        search_layout = QHBoxLayout()

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText(
            "Buscar por codigo, nombre o escanear codigo de barras..."
        )
        self.search_input.setFixedHeight(48)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.gray_50};
                border: 2px solid {self.theme.border};
                border-radius: 24px;
                padding: 0 20px;
                font-size: 15px;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
                background-color: white;
            }}
        """)
        self.search_input.returnPressed.connect(self._on_search)
        self.search_input.textChanged.connect(self._on_search_text_changed)
        search_layout.addWidget(self.search_input)

        search_btn = QPushButton("Buscar")
        search_btn.setFixedSize(100, 48)
        search_btn.clicked.connect(self._on_search)
        search_layout.addWidget(search_btn)

        layout.addLayout(search_layout)

        # Categorias rapidas
        categories = self._create_quick_categories()
        layout.addWidget(categories)

        # Tabla de productos
        self.products_table = QTableWidget()
        self.products_table.setColumnCount(5)
        self.products_table.setHorizontalHeaderLabels([
            "Codigo", "Producto", "Precio", "Stock", ""
        ])
        self.products_table.horizontalHeader().setSectionResizeMode(
            1, QHeaderView.ResizeMode.Stretch
        )
        self.products_table.setColumnWidth(0, 120)
        self.products_table.setColumnWidth(2, 100)
        self.products_table.setColumnWidth(3, 80)
        self.products_table.setColumnWidth(4, 80)
        self.products_table.setSelectionBehavior(
            QTableWidget.SelectionBehavior.SelectRows
        )
        self.products_table.setSelectionMode(
            QTableWidget.SelectionMode.SingleSelection
        )
        self.products_table.setAlternatingRowColors(True)
        self.products_table.verticalHeader().setVisible(False)
        self.products_table.doubleClicked.connect(self._on_product_double_click)
        layout.addWidget(self.products_table)

        return panel

    def _create_quick_categories(self) -> QWidget:
        """Crea los botones de categorias rapidas."""
        container = QWidget()
        layout = QHBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        categories = [
            ("Todos", None),
            ("Bebidas", "#3b82f6"),
            ("Lacteos", "#10b981"),
            ("Panaderia", "#f59e0b"),
            ("Limpieza", "#8b5cf6"),
        ]

        for name, color in categories:
            btn = QPushButton(name)
            btn.setFixedHeight(36)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            bg = color or self.theme.gray_200
            text = "white" if color else self.theme.gray_700
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {bg};
                    color: {text};
                    border: none;
                    border-radius: 18px;
                    padding: 0 16px;
                    font-weight: 500;
                }}
            """)
            layout.addWidget(btn)

        layout.addStretch()
        return container

    def _create_cart_panel(self) -> QFrame:
        """Crea el panel del carrito."""
        panel = QFrame()
        panel.setProperty("class", "card")
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Header
        header = QHBoxLayout()

        title = QLabel("Carrito")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        header.addWidget(title)

        clear_btn = QPushButton("Limpiar")
        clear_btn.setFixedHeight(32)
        clear_btn.setProperty("class", "ghost")
        clear_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.danger};
                border: 1px solid {self.theme.danger};
                border-radius: 4px;
                padding: 0 12px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.danger_bg};
            }}
        """)
        clear_btn.clicked.connect(self._on_clear_cart)
        header.addWidget(clear_btn)

        layout.addLayout(header)

        # Tabla del carrito
        self.cart_table = QTableWidget()
        self.cart_table.setColumnCount(5)
        self.cart_table.setHorizontalHeaderLabels([
            "Producto", "Cant.", "Precio", "Subtotal", ""
        ])
        self.cart_table.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.ResizeMode.Stretch
        )
        self.cart_table.setColumnWidth(1, 60)
        self.cart_table.setColumnWidth(2, 80)
        self.cart_table.setColumnWidth(3, 90)
        self.cart_table.setColumnWidth(4, 40)
        self.cart_table.verticalHeader().setVisible(False)
        layout.addWidget(self.cart_table)

        # Totales
        totals = QFrame()
        totals.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: none;
                border-radius: 8px;
                padding: 12px;
            }}
        """)
        totals_layout = QVBoxLayout(totals)
        totals_layout.setSpacing(8)

        # Subtotal
        row1 = QHBoxLayout()
        row1.addWidget(QLabel("Subtotal:"))
        self.subtotal_label = QLabel("$0.00")
        self.subtotal_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        row1.addWidget(self.subtotal_label)
        totals_layout.addLayout(row1)

        # Descuento
        row2 = QHBoxLayout()
        row2.addWidget(QLabel("Descuento:"))
        self.discount_label = QLabel("$0.00")
        self.discount_label.setStyleSheet(f"color: {self.theme.success};")
        self.discount_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        row2.addWidget(self.discount_label)
        totals_layout.addLayout(row2)

        # Total
        row3 = QHBoxLayout()
        total_text = QLabel("TOTAL:")
        total_text.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        row3.addWidget(total_text)
        self.total_label = QLabel("$0.00")
        self.total_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        self.total_label.setStyleSheet(f"color: {self.theme.primary};")
        self.total_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        row3.addWidget(self.total_label)
        totals_layout.addLayout(row3)

        layout.addWidget(totals)

        # Botones
        buttons_layout = QVBoxLayout()
        buttons_layout.setSpacing(8)

        # Boton Cobrar
        checkout_btn = QPushButton("COBRAR (F12)")
        checkout_btn.setFixedHeight(56)
        checkout_btn.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        checkout_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.success};
                color: white;
                border: none;
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.success_dark};
            }}
        """)
        checkout_btn.clicked.connect(self._on_checkout)
        buttons_layout.addWidget(checkout_btn)

        # Fila secundaria
        secondary = QHBoxLayout()
        secondary.setSpacing(8)

        discount_btn = QPushButton("Descuento (F4)")
        discount_btn.setFixedHeight(40)
        discount_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.warning};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 6px;
            }}
        """)
        discount_btn.clicked.connect(self._on_discount)
        secondary.addWidget(discount_btn)

        suspend_btn = QPushButton("Suspender (F10)")
        suspend_btn.setFixedHeight(40)
        suspend_btn.setProperty("class", "secondary")
        suspend_btn.clicked.connect(self._on_suspend)
        secondary.addWidget(suspend_btn)

        buttons_layout.addLayout(secondary)
        layout.addLayout(buttons_layout)

        return panel

    def _create_statusbar(self) -> None:
        """Crea la barra de estado."""
        statusbar = QStatusBar()
        self.setStatusBar(statusbar)

        user_label = QLabel(f"Usuario: {self.user.get('name', 'N/A')}")
        statusbar.addWidget(user_label)

        statusbar.addWidget(QLabel(" | "))

        branch = self.user.get("branch_name", "N/A")
        branch_label = QLabel(f"Sucursal: {branch}")
        statusbar.addWidget(branch_label)

        statusbar.addWidget(QLabel(" | "))

        self.connection_label = QLabel("Conectado")
        self.connection_label.setStyleSheet(f"color: {self.theme.success};")
        statusbar.addWidget(self.connection_label)

        statusbar.addPermanentWidget(QLabel(""))

        self.cash_label = QLabel("Turno: Sin abrir")
        statusbar.addPermanentWidget(self.cash_label)

    def _setup_shortcuts(self) -> None:
        """Configura atajos de teclado."""
        pass  # Los atajos principales estan en el menu

    # ==================================================================
    # EVENT HANDLERS
    # ==================================================================

    def _on_search(self) -> None:
        """Busca productos."""
        query = self.search_input.text().strip()
        if query:
            logger.info(f"Buscando: {query}")
            # TODO: Implementar busqueda

    def _on_search_text_changed(self, text: str) -> None:
        """Maneja cambios en el texto de busqueda."""
        pass

    def _on_product_double_click(self) -> None:
        """Agrega producto al carrito."""
        row = self.products_table.currentRow()
        if row >= 0:
            logger.info(f"Agregar producto fila {row}")

    def _on_clear_cart(self) -> None:
        """Limpia el carrito."""
        self.cart_items.clear()
        self.cart_table.setRowCount(0)
        self._update_totals()
        logger.info("Carrito limpiado")

    def _update_totals(self) -> None:
        """Actualiza los totales."""
        subtotal = sum(item.get("subtotal", 0) for item in self.cart_items)
        discount = 0
        total = subtotal - discount

        self.subtotal_label.setText(f"${subtotal:.2f}")
        self.discount_label.setText(f"-${discount:.2f}")
        self.total_label.setText(f"${total:.2f}")

    def _on_checkout(self) -> None:
        """Inicia el cobro."""
        if not self.cart_items:
            QMessageBox.warning(self, "Carrito vacio", "Agrega productos al carrito")
            return
        logger.info("Iniciar cobro")

    def _on_discount(self) -> None:
        """Aplica descuento."""
        logger.info("Aplicar descuento")

    def _on_suspend(self) -> None:
        """Suspende la venta."""
        logger.info("Suspender venta")

    def _on_new_sale(self) -> None:
        """Nueva venta."""
        self._on_clear_cart()
        self.search_input.clear()
        self.search_input.setFocus()

    def _on_sync(self) -> None:
        """Sincroniza productos."""
        logger.info("Sincronizar")

    def _on_open_cash(self) -> None:
        """Abre turno de caja."""
        logger.info("Abrir turno")

    def _on_close_cash(self) -> None:
        """Cierra turno de caja."""
        logger.info("Cerrar turno")

    def _on_price_check(self) -> None:
        """Consulta precio."""
        self.search_input.setFocus()

    def _on_open_drawer(self) -> None:
        """Abre el cajon."""
        logger.info("Abrir cajon")

    def _on_logout(self) -> None:
        """Cierra sesion."""
        reply = QMessageBox.question(
            self,
            "Cerrar sesion",
            "Estas seguro de cerrar sesion?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            logger.info("Cerrando sesion")
            get_api_client().clear_auth_data()

            from .login_window import LoginWindow
            self.login_window = LoginWindow()
            self.login_window.show()
            self.close()

    def _on_help(self) -> None:
        """Muestra ayuda."""
        QMessageBox.information(
            self,
            "Ayuda",
            "Atajos de teclado:\n\n"
            "F2 - Buscar producto\n"
            "F4 - Aplicar descuento\n"
            "F5 - Sincronizar\n"
            "F9 - Anular item\n"
            "F10 - Suspender venta\n"
            "F12 - Cobrar\n"
            "Esc - Cancelar\n"
        )

    def _on_about(self) -> None:
        """Muestra informacion."""
        QMessageBox.about(
            self,
            f"Acerca de {self.settings.APP_NAME}",
            f"{self.settings.APP_NAME}\n"
            f"Version {self.settings.APP_VERSION}\n\n"
            "Sistema de punto de venta.\n\n"
            "(c) 2024 Cianbox"
        )

    def keyPressEvent(self, event: QKeyEvent) -> None:
        """Maneja teclado."""
        key = event.key()

        if key == Qt.Key.Key_F12:
            self._on_checkout()
        elif key == Qt.Key.Key_F10:
            self._on_suspend()
        elif key == Qt.Key.Key_F4:
            self._on_discount()
        elif key == Qt.Key.Key_F2:
            self.search_input.setFocus()
        elif key == Qt.Key.Key_Escape:
            self.search_input.clear()
        else:
            super().keyPressEvent(event)

    def closeEvent(self, event: QCloseEvent) -> None:
        """Maneja cierre de ventana."""
        logger.info("Cerrando POS")
        event.accept()
