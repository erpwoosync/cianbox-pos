"""
Ventana principal del POS - Layout completo.

Interfaz moderna de punto de venta con:
- Header con info de usuario y tenant
- Sidebar de categorias
- Grid de productos con badges de promocion
- Panel de carrito con descuentos
- Sincronizacion de productos y promociones desde backend
"""

from typing import Optional, Dict, Any, List
from decimal import Decimal
import threading

from PyQt6.QtWidgets import (
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QGridLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QScrollArea,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QStatusBar,
    QMenuBar,
    QMenu,
    QToolBar,
    QMessageBox,
    QSizePolicy,
    QSpacerItem,
    QAbstractItemView,
    QProgressBar,
    QSpinBox,
)
from PyQt6.QtCore import Qt, QSize, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QKeyEvent, QAction, QCloseEvent, QPixmap, QColor
from loguru import logger

from src.config import get_settings
from src.api import get_api_client, PromotionData, CalculationResult
from src.api.products import ProductsAPI
from src.ui.styles import get_theme
from src.services import get_sync_service, SyncStatus, SyncResult
from src.models import Product, Category
from src.ui.dialogs import CheckoutDialog, CheckoutResult, SizeCurveDialog


class MainWindow(QMainWindow):
    """
    Ventana principal del punto de venta.

    Layout:
    +----------------------------------------------------------+
    | HEADER: Logo | Busqueda | Usuario | Tenant | [Salir]     |
    +----------------------------------------------------------+
    | SIDEBAR  |  PRODUCTOS (Grid)           | CARRITO         |
    | Categorias|  [Card] [Card] [Card]      | Items           |
    |           |  [Card] [Card] [Card]      | Subtotal        |
    |           |  [Card] [Card] [Card]      | Total           |
    |           |                            | [COBRAR]        |
    +----------------------------------------------------------+
    | STATUSBAR: Usuario | Sucursal | Conexion | Turno         |
    +----------------------------------------------------------+

    Attributes:
        user: Datos del usuario logueado
        tenant: Datos del tenant
    """

    logout_requested = pyqtSignal()
    sync_progress = pyqtSignal(str, int, int)  # mensaje, actual, total
    sync_complete = pyqtSignal(object)  # SyncResult
    promotions_calculated = pyqtSignal(object)  # CalculationResult

    def __init__(
        self,
        user: Dict[str, Any],
        tenant: Dict[str, Any],
        terminal: Optional[Dict[str, Any]] = None,
    ):
        super().__init__()

        self.user = user
        self.tenant = tenant
        self.terminal = terminal  # Info de la terminal registrada
        self.settings = get_settings()
        self.theme = get_theme()

        # Estado
        self.cart_items: List[Dict[str, Any]] = []
        self.selected_category: Optional[str] = None
        self.products: List[Product] = []
        self.categories: List[Category] = []
        self.is_syncing = False
        self.view_mode: str = "grid"  # "grid" o "list"
        self.show_only_promotions: bool = False

        # Estado de promociones
        self.active_promotions: List[PromotionData] = []
        self.is_calculating_promotions = False
        self._last_cart_key: str = ""
        self._promotion_calc_timer: Optional[QTimer] = None

        # Servicio de sincronizacion
        tenant_id = tenant.get("id", "")
        branch_id = user.get("branch_id")
        self.sync_service = get_sync_service(tenant_id, branch_id)

        # Log de terminal
        if terminal:
            logger.info(
                f"Terminal activa: {terminal.get('name') or terminal.get('hostname')} "
                f"- Sucursal: {terminal.get('branch_name')}"
            )

        # Conectar signals de sincronizacion
        self.sync_progress.connect(self._on_sync_progress)
        self.sync_complete.connect(self._on_sync_complete)
        self.promotions_calculated.connect(self._on_promotions_calculated)

        self._setup_ui()
        self._setup_shortcuts()

        # Iniciar sincronizacion de datos
        QTimer.singleShot(100, self._start_initial_sync)

        # Focus en el buscador al iniciar
        QTimer.singleShot(200, self._focus_search)

        logger.info(f"MainWindow iniciado: {user.get('name')} @ {tenant.get('name')}")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario completa."""
        self.setWindowTitle(f"{self.settings.APP_NAME} - {self.tenant.get('name', 'POS')}")
        self.setMinimumSize(1366, 768)
        self.showMaximized()

        # Widget central
        central = QWidget()
        self.setCentralWidget(central)

        # Layout principal vertical
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 1. HEADER
        header = self._create_header()
        main_layout.addWidget(header)

        # 2. BARRA DE SINCRONIZACION (oculta por defecto)
        self.sync_bar = self._create_sync_bar()
        main_layout.addWidget(self.sync_bar)
        self.sync_bar.hide()

        # 3. CONTENIDO PRINCIPAL (sidebar + productos + carrito)
        content = self._create_content()
        main_layout.addWidget(content, 1)  # stretch=1 para que ocupe el espacio

        # 4. STATUS BAR
        self._create_statusbar()

    def _create_header(self) -> QFrame:
        """Crea el header superior con logo, busqueda y usuario."""
        header = QFrame()
        header.setFixedHeight(70)
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_900};
                border-bottom: 1px solid {self.theme.gray_700};
            }}
        """)

        layout = QHBoxLayout(header)
        layout.setContentsMargins(16, 0, 16, 0)
        layout.setSpacing(20)

        # Logo
        logo = QLabel(self.settings.APP_NAME)
        logo.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        logo.setStyleSheet(f"color: {self.theme.primary}; background: transparent;")
        layout.addWidget(logo)

        # Separador
        sep = QFrame()
        sep.setFixedWidth(1)
        sep.setStyleSheet(f"background-color: {self.theme.gray_700};")
        layout.addWidget(sep)

        # Barra de busqueda
        search_container = QWidget()
        search_container.setStyleSheet("background: transparent;")
        search_layout = QHBoxLayout(search_container)
        search_layout.setContentsMargins(0, 0, 0, 0)
        search_layout.setSpacing(8)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Buscar producto o escanear codigo de barras... (F2)")
        self.search_input.setFixedHeight(44)
        self.search_input.setMinimumWidth(400)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.gray_800};
                border: 2px solid {self.theme.gray_700};
                border-radius: 22px;
                padding: 0 20px;
                font-size: 14px;
                color: {self.theme.text_inverse};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
                background-color: {self.theme.gray_700};
            }}
            QLineEdit::placeholder {{
                color: {self.theme.gray_500};
            }}
        """)
        self.search_input.returnPressed.connect(self._on_search)
        self.search_input.textChanged.connect(self._on_search_text_changed)
        search_layout.addWidget(self.search_input)

        layout.addWidget(search_container, 1)

        # Spacer
        layout.addStretch()

        # Boton sincronizar
        sync_btn = QPushButton("Sincronizar")
        sync_btn.setFixedSize(100, 36)
        sync_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        sync_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.gray_400};
                border: 1px solid {self.theme.gray_600};
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary};
                border-color: {self.theme.primary};
                color: white;
            }}
        """)
        sync_btn.clicked.connect(self._on_sync_click)
        layout.addWidget(sync_btn)
        self.sync_btn = sync_btn

        # Info del usuario
        user_info = QWidget()
        user_info.setStyleSheet("background: transparent;")
        user_layout = QHBoxLayout(user_info)
        user_layout.setContentsMargins(0, 0, 0, 0)
        user_layout.setSpacing(12)

        # Avatar placeholder
        avatar = QLabel()
        avatar.setFixedSize(40, 40)
        avatar.setStyleSheet(f"""
            background-color: {self.theme.primary};
            border-radius: 20px;
            color: white;
            font-weight: bold;
            font-size: 16px;
        """)
        avatar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        initials = "".join([n[0].upper() for n in self.user.get("name", "U").split()[:2]])
        avatar.setText(initials)
        user_layout.addWidget(avatar)

        # Nombre y tenant
        user_text = QWidget()
        user_text.setStyleSheet("background: transparent;")
        user_text_layout = QVBoxLayout(user_text)
        user_text_layout.setContentsMargins(0, 0, 0, 0)
        user_text_layout.setSpacing(2)

        user_name = QLabel(self.user.get("name", "Usuario"))
        user_name.setStyleSheet(f"""
            color: {self.theme.text_inverse};
            font-size: 13px;
            font-weight: 600;
            background: transparent;
        """)
        user_text_layout.addWidget(user_name)

        tenant_name = QLabel(self.tenant.get("name", "Empresa"))
        tenant_name.setStyleSheet(f"""
            color: {self.theme.gray_400};
            font-size: 11px;
            background: transparent;
        """)
        user_text_layout.addWidget(tenant_name)

        user_layout.addWidget(user_text)
        layout.addWidget(user_info)

        # Boton cerrar sesion
        logout_btn = QPushButton("Salir")
        logout_btn.setFixedSize(80, 36)
        logout_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        logout_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.gray_400};
                border: 1px solid {self.theme.gray_600};
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {self.theme.danger};
                border-color: {self.theme.danger};
                color: white;
            }}
        """)
        logout_btn.clicked.connect(self._on_logout)
        layout.addWidget(logout_btn)

        return header

    def _create_sync_bar(self) -> QFrame:
        """Crea la barra de progreso de sincronizacion."""
        bar = QFrame()
        bar.setFixedHeight(40)
        bar.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.primary_bg};
                border-bottom: 1px solid {self.theme.primary};
            }}
        """)

        layout = QHBoxLayout(bar)
        layout.setContentsMargins(16, 0, 16, 0)
        layout.setSpacing(12)

        # Icono de sincronizacion
        self.sync_icon = QLabel("Sincronizando")
        self.sync_icon.setStyleSheet(f"""
            color: {self.theme.primary};
            font-size: 13px;
            font-weight: 600;
            background: transparent;
        """)
        layout.addWidget(self.sync_icon)

        # Mensaje de progreso
        self.sync_message = QLabel("Cargando productos...")
        self.sync_message.setStyleSheet(f"""
            color: {self.theme.gray_700};
            font-size: 12px;
            background: transparent;
        """)
        layout.addWidget(self.sync_message)

        # Barra de progreso
        self.sync_progress_bar = QProgressBar()
        self.sync_progress_bar.setFixedWidth(200)
        self.sync_progress_bar.setFixedHeight(8)
        self.sync_progress_bar.setRange(0, 100)
        self.sync_progress_bar.setValue(0)
        self.sync_progress_bar.setTextVisible(False)
        self.sync_progress_bar.setStyleSheet(f"""
            QProgressBar {{
                background-color: {self.theme.gray_200};
                border: none;
                border-radius: 4px;
            }}
            QProgressBar::chunk {{
                background-color: {self.theme.primary};
                border-radius: 4px;
            }}
        """)
        layout.addWidget(self.sync_progress_bar)

        layout.addStretch()

        return bar

    def _create_content(self) -> QWidget:
        """Crea el contenido principal con sidebar, productos y carrito."""
        content = QWidget()
        layout = QHBoxLayout(content)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # SIDEBAR - Categorias
        sidebar = self._create_sidebar()
        layout.addWidget(sidebar)

        # PRODUCTOS - Grid
        products_panel = self._create_products_panel()
        layout.addWidget(products_panel, 1)  # stretch=1

        # CARRITO
        cart_panel = self._create_cart_panel()
        layout.addWidget(cart_panel)

        return content

    def _create_sidebar(self) -> QFrame:
        """Crea el sidebar con categorias."""
        sidebar = QFrame()
        sidebar.setFixedWidth(180)
        sidebar.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_100};
                border-right: 1px solid {self.theme.border};
            }}
        """)

        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(12, 16, 12, 16)
        layout.setSpacing(8)

        # Titulo
        title = QLabel("CATEGORIAS")
        title.setStyleSheet(f"""
            color: {self.theme.gray_500};
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
        """)
        layout.addWidget(title)

        layout.addSpacing(8)

        # Scroll area para categorias
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet("""
            QScrollArea {
                border: none;
                background: transparent;
            }
            QScrollArea > QWidget > QWidget {
                background: transparent;
            }
        """)

        self.categories_widget = QWidget()
        self.categories_layout = QVBoxLayout(self.categories_widget)
        self.categories_layout.setContentsMargins(0, 0, 0, 0)
        self.categories_layout.setSpacing(4)

        self.category_buttons: Dict[str, QPushButton] = {}

        # Agregar categoria "Todos" por defecto
        all_cat = {"id": "all", "name": "Todos", "color": None}
        btn = self._create_category_button(all_cat)
        self.category_buttons["all"] = btn
        self.categories_layout.addWidget(btn)

        self.categories_layout.addStretch()
        scroll.setWidget(self.categories_widget)
        layout.addWidget(scroll, 1)

        return sidebar

    def _create_category_button(self, category: Dict[str, Any]) -> QPushButton:
        """Crea un boton de categoria."""
        btn = QPushButton(category.get("name", "Sin nombre"))
        btn.setFixedHeight(42)
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.setProperty("category_id", category.get("id"))
        btn.setProperty("category_color", category.get("color"))

        btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.gray_700};
                border: none;
                border-radius: 8px;
                padding: 0 12px;
                font-size: 13px;
                font-weight: 500;
                text-align: left;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_200};
            }}
        """)

        cat_id = category.get("id")
        btn.clicked.connect(lambda: self._select_category(cat_id))
        return btn

    def _rebuild_categories(self) -> None:
        """Reconstruye la lista de categorias desde los datos sincronizados."""
        # Limpiar categorias existentes (excepto stretch)
        while self.categories_layout.count() > 1:
            item = self.categories_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        self.category_buttons.clear()

        # Agregar "Todos"
        all_cat = {"id": "all", "name": "Todos", "color": None}
        btn = self._create_category_button(all_cat)
        self.category_buttons["all"] = btn
        self.categories_layout.insertWidget(0, btn)

        # Agregar categorias del backend
        for i, cat in enumerate(self.categories):
            cat_dict = {
                "id": cat.id,
                "name": cat.name,
                "color": cat.quick_access_color,
            }
            btn = self._create_category_button(cat_dict)
            self.category_buttons[cat.id] = btn
            self.categories_layout.insertWidget(i + 1, btn)

        # Seleccionar "Todos" por defecto
        self._select_category("all")

        logger.debug(f"Categorias reconstruidas: {len(self.categories)} categorias")

    def _select_category(self, category_id: str) -> None:
        """Selecciona una categoria."""
        self.selected_category = category_id

        for cat_id, btn in self.category_buttons.items():
            color = btn.property("category_color")
            if cat_id == category_id:
                bg = color if color else self.theme.primary
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {bg};
                        color: white;
                        border: none;
                        border-radius: 8px;
                        padding: 0 12px;
                        font-size: 13px;
                        font-weight: 600;
                        text-align: left;
                    }}
                """)
            else:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: transparent;
                        color: {self.theme.gray_700};
                        border: none;
                        border-radius: 8px;
                        padding: 0 12px;
                        font-size: 13px;
                        font-weight: 500;
                        text-align: left;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.gray_200};
                    }}
                """)

        self._filter_products()

    def _create_quick_access_bar(self) -> QFrame:
        """Crea barra de acceso rapido a categorias (F1-F9)."""
        bar = QFrame()
        bar.setFixedHeight(36)
        bar.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
            }}
        """)

        layout = QHBoxLayout(bar)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.setSpacing(4)

        # Label
        label = QLabel("Acceso Rapido:")
        label.setStyleSheet(f"""
            color: {self.theme.gray_500};
            font-size: 11px;
            font-weight: 500;
        """)
        layout.addWidget(label)

        # Contenedor de botones de categorias
        self.quick_category_buttons: List[QPushButton] = []
        for i in range(9):  # F1-F9
            btn = QPushButton(f"F{i+1}")
            btn.setFixedSize(60, 26)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setProperty("quick_index", i)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {self.theme.gray_100};
                    color: {self.theme.gray_400};
                    border: 1px solid {self.theme.border_light};
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                }}
                QPushButton:hover {{
                    background-color: {self.theme.primary_bg};
                    border-color: {self.theme.primary};
                    color: {self.theme.primary};
                }}
                QPushButton:disabled {{
                    background-color: {self.theme.gray_50};
                    color: {self.theme.gray_300};
                }}
            """)
            btn.setEnabled(False)
            btn.clicked.connect(lambda checked, idx=i: self._on_quick_category(idx))
            self.quick_category_buttons.append(btn)
            layout.addWidget(btn)

        layout.addStretch()
        return bar

    def _update_quick_access_buttons(self) -> None:
        """Actualiza los botones de acceso rapido con las categorias."""
        # Obtener las primeras 9 categorias (excluyendo "Todos")
        active_categories = [c for c in self.categories if c.is_active][:9]

        for i, btn in enumerate(self.quick_category_buttons):
            if i < len(active_categories):
                cat = active_categories[i]
                # Truncar nombre si es muy largo
                name = cat.name[:8] + ".." if len(cat.name) > 10 else cat.name
                btn.setText(f"F{i+1} {name}")
                btn.setProperty("category_id", cat.id)
                btn.setEnabled(True)
                btn.setToolTip(f"F{i+1}: {cat.name}")

                # Estilo con color de categoria si existe
                cat_color = getattr(cat, 'color', None) or self.theme.primary
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.surface};
                        color: {self.theme.gray_700};
                        border: 1px solid {self.theme.border};
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 500;
                    }}
                    QPushButton:hover {{
                        background-color: {self.theme.primary_bg};
                        border-color: {self.theme.primary};
                        color: {self.theme.primary};
                    }}
                """)
            else:
                btn.setText(f"F{i+1}")
                btn.setProperty("category_id", None)
                btn.setEnabled(False)
                btn.setToolTip("")

    def _on_quick_category(self, index: int) -> None:
        """Maneja click en boton de acceso rapido."""
        if index < len(self.quick_category_buttons):
            btn = self.quick_category_buttons[index]
            cat_id = btn.property("category_id")
            if cat_id:
                self._select_category(cat_id)
                self._focus_search()

    def _create_products_panel(self) -> QFrame:
        """Crea el panel central con grid de productos."""
        panel = QFrame()
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 12, 16, 16)
        layout.setSpacing(8)

        # Barra de acceso rapido a categorias (F1-F9)
        quick_access = self._create_quick_access_bar()
        layout.addWidget(quick_access)

        # Header con contador y controles de vista
        header = QHBoxLayout()

        self.products_count_label = QLabel("Cargando productos...")
        self.products_count_label.setStyleSheet(f"""
            color: {self.theme.gray_600};
            font-size: 13px;
        """)
        header.addWidget(self.products_count_label)

        header.addStretch()

        # Boton para mostrar solo promociones (F6)
        self.promo_filter_btn = QPushButton("🏷️ Promociones (F6)")
        self.promo_filter_btn.setFixedHeight(28)
        self.promo_filter_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.promo_filter_btn.setCheckable(True)
        self.promo_filter_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.surface};
                color: {self.theme.gray_600};
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                padding: 0 12px;
                font-size: 11px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.warning_bg};
                border-color: {self.theme.warning};
            }}
            QPushButton:checked {{
                background-color: {self.theme.warning};
                color: white;
                border-color: {self.theme.warning};
            }}
        """)
        self.promo_filter_btn.clicked.connect(self._toggle_promotions_filter)
        header.addWidget(self.promo_filter_btn)

        header.addSpacing(8)

        # Boton de consulta de productos (F3)
        self.lookup_btn = QPushButton("🔍 Consultar (F3)")
        self.lookup_btn.setFixedHeight(28)
        self.lookup_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.lookup_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.surface};
                color: {self.theme.gray_600};
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                padding: 0 12px;
                font-size: 11px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.info_bg};
                border-color: {self.theme.info};
            }}
        """)
        self.lookup_btn.clicked.connect(self._open_product_lookup)
        header.addWidget(self.lookup_btn)

        header.addSpacing(8)

        # Toggle de vista Grid/Lista (F7)
        self.view_toggle_btn = QPushButton("☰ Lista (F7)")
        self.view_toggle_btn.setFixedHeight(28)
        self.view_toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.view_toggle_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.surface};
                color: {self.theme.gray_600};
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                padding: 0 12px;
                font-size: 11px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_100};
            }}
        """)
        self.view_toggle_btn.clicked.connect(self._toggle_view_mode)
        header.addWidget(self.view_toggle_btn)

        layout.addLayout(header)

        # Scroll area para productos
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(f"""
            QScrollArea {{
                border: none;
                background: transparent;
            }}
        """)

        # Widget contenedor del grid
        self.products_container = QWidget()
        self.products_container.setStyleSheet("background: transparent;")
        self.products_grid = QGridLayout(self.products_container)
        self.products_grid.setContentsMargins(0, 0, 0, 0)
        self.products_grid.setSpacing(12)

        scroll.setWidget(self.products_container)
        layout.addWidget(scroll, 1)

        return panel

    def _create_product_card(self, product: Product) -> QFrame:
        """Crea una card de producto desde modelo Product."""
        # Verificar si hay promocion para este producto
        promo = self.sync_service.get_promotion_for_product(
            product.id,
            product.category_id,
            product.brand_id,
        )

        # Determinar color del borde segun promocion
        border_color = self.theme.border
        hover_border_color = self.theme.primary
        if promo:
            promo_color = promo.badge_color or "#22C55E"
            border_color = f"{promo_color}66"  # Con transparencia
            hover_border_color = promo_color

        card = QFrame()
        card.setFixedSize(145, 165)
        card.setCursor(Qt.CursorShape.PointingHandCursor)
        card.setProperty("product_id", product.id)
        card.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 2px solid {border_color};
                border-radius: 10px;
            }}
            QFrame:hover {{
                border-color: {hover_border_color};
                background-color: {self.theme.primary_bg};
            }}
        """)

        layout = QVBoxLayout(card)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(4)

        # Contenedor de imagen con badge
        img_wrapper = QWidget()
        img_wrapper.setStyleSheet("background: transparent; border: none;")

        # Imagen placeholder
        img_container = QFrame(img_wrapper)
        img_container.setGeometry(0, 0, 129, 55)
        img_container.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_100};
                border-radius: 6px;
                border: none;
            }}
        """)
        img_layout = QVBoxLayout(img_container)
        img_layout.setContentsMargins(0, 0, 0, 0)

        img_icon = QLabel("[IMG]")
        img_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        img_icon.setStyleSheet(f"color: {self.theme.gray_400}; font-size: 10px; border: none;")
        img_layout.addWidget(img_icon)

        # Badge de promocion (esquina superior derecha)
        if promo:
            badge_color = promo.badge_color or "#22C55E"
            badge_text = promo.get_badge_text()

            badge = QLabel(badge_text, img_wrapper)
            badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
            badge.setStyleSheet(f"""
                QLabel {{
                    background-color: {badge_color};
                    color: white;
                    font-size: 8px;
                    font-weight: 700;
                    padding: 2px 4px;
                    border-radius: 6px;
                    border: none;
                }}
            """)
            badge.adjustSize()
            # Posicionar en esquina superior derecha
            badge.move(129 - badge.width() + 6, -3)

        # Badge de producto padre (curva de talles) - esquina superior izquierda
        if product.is_parent:
            parent_badge = QLabel("Talles", img_wrapper)
            parent_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
            parent_badge.setStyleSheet(f"""
                QLabel {{
                    background-color: {self.theme.info};
                    color: white;
                    font-size: 8px;
                    font-weight: 700;
                    padding: 2px 4px;
                    border-radius: 6px;
                    border: none;
                }}
            """)
            parent_badge.adjustSize()
            parent_badge.move(-3, -3)

        img_wrapper.setFixedHeight(55)
        layout.addWidget(img_wrapper)

        # Nombre del producto
        name = QLabel(product.name)
        name.setWordWrap(True)
        name.setMaximumHeight(28)
        name.setStyleSheet(f"""
            color: {self.theme.text_primary};
            font-size: 10px;
            font-weight: 500;
            border: none;
        """)
        layout.addWidget(name)

        # Codigo
        code = product.barcode or product.sku or product.internal_code or "-"
        code_label = QLabel(code)
        code_label.setStyleSheet(f"""
            color: {self.theme.gray_500};
            font-size: 9px;
            border: none;
        """)
        layout.addWidget(code_label)

        layout.addStretch()

        # Precio
        price_value = float(product.base_price) if product.base_price else 0.0
        price = QLabel(f"${price_value:,.2f}")
        price.setStyleSheet(f"""
            color: {self.theme.primary};
            font-size: 13px;
            font-weight: 700;
            border: none;
        """)
        layout.addWidget(price)

        # Hacer clickeable - convertir Product a dict para carrito
        product_dict = {
            "id": product.id,
            "code": product.barcode or product.sku or "",
            "name": product.name,
            "price": price_value,
            "stock": product.current_stock,
            "category_id": product.category_id,
            "brand_id": product.brand_id,
            "is_parent": product.is_parent,
            "parent_product_id": product.parent_product_id,
            "size": product.size,
            "color": product.color,
        }
        card.mousePressEvent = lambda e: self._add_to_cart(product_dict)

        return card

    def _create_cart_panel(self) -> QFrame:
        """Crea el panel derecho del carrito."""
        panel = QFrame()
        panel.setFixedWidth(380)
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-left: 1px solid {self.theme.border};
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header del carrito
        header = QFrame()
        header.setFixedHeight(60)
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border-bottom: 1px solid {self.theme.border};
            }}
        """)
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(16, 0, 16, 0)

        cart_title = QLabel("Carrito")
        cart_title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        cart_title.setStyleSheet(f"color: {self.theme.text_primary}; background: transparent;")
        header_layout.addWidget(cart_title)

        self.cart_count_label = QLabel("0 items")
        self.cart_count_label.setStyleSheet(f"""
            color: {self.theme.gray_500};
            font-size: 12px;
            background: transparent;
        """)
        header_layout.addWidget(self.cart_count_label)

        header_layout.addStretch()

        clear_btn = QPushButton("Limpiar")
        clear_btn.setFixedHeight(32)
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        clear_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.danger};
                border: 1px solid {self.theme.danger};
                border-radius: 6px;
                padding: 0 12px;
                font-size: 11px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {self.theme.danger_bg};
            }}
        """)
        clear_btn.clicked.connect(self._on_clear_cart)
        header_layout.addWidget(clear_btn)

        layout.addWidget(header)

        # Lista de items del carrito
        self.cart_scroll = QScrollArea()
        self.cart_scroll.setWidgetResizable(True)
        self.cart_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.cart_scroll.setStyleSheet(f"""
            QScrollArea {{
                border: none;
                background-color: {self.theme.surface};
            }}
        """)

        self.cart_items_container = QWidget()
        self.cart_items_container.setStyleSheet(f"background-color: {self.theme.surface};")
        self.cart_items_layout = QVBoxLayout(self.cart_items_container)
        self.cart_items_layout.setContentsMargins(16, 16, 16, 16)
        self.cart_items_layout.setSpacing(8)
        self.cart_items_layout.addStretch()

        self.cart_scroll.setWidget(self.cart_items_container)
        layout.addWidget(self.cart_scroll, 1)

        # Panel de totales
        totals_panel = QFrame()
        totals_panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border-top: 1px solid {self.theme.border};
            }}
        """)
        totals_layout = QVBoxLayout(totals_panel)
        totals_layout.setContentsMargins(16, 16, 16, 16)
        totals_layout.setSpacing(8)

        # Subtotal
        subtotal_row = QHBoxLayout()
        subtotal_label = QLabel("Subtotal")
        subtotal_label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 13px; background: transparent;")
        subtotal_row.addWidget(subtotal_label)
        self.subtotal_value = QLabel("$0.00")
        self.subtotal_value.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 13px; font-weight: 500; background: transparent;")
        self.subtotal_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        subtotal_row.addWidget(self.subtotal_value)
        totals_layout.addLayout(subtotal_row)

        # Contenedor para promociones (dinamico)
        self.promotions_container = QWidget()
        self.promotions_container.setStyleSheet("background: transparent;")
        self.promotions_layout = QVBoxLayout(self.promotions_container)
        self.promotions_layout.setContentsMargins(0, 0, 0, 0)
        self.promotions_layout.setSpacing(4)
        totals_layout.addWidget(self.promotions_container)

        # Linea separadora
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {self.theme.border};")
        totals_layout.addWidget(sep)

        # Total
        total_row = QHBoxLayout()
        total_label = QLabel("TOTAL")
        total_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 16px; font-weight: 700; background: transparent;")
        total_row.addWidget(total_label)
        self.total_value = QLabel("$0.00")
        self.total_value.setStyleSheet(f"color: {self.theme.primary}; font-size: 24px; font-weight: 700; background: transparent;")
        self.total_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        total_row.addWidget(self.total_value)
        totals_layout.addLayout(total_row)

        layout.addWidget(totals_panel)

        # Botones de accion
        actions_panel = QFrame()
        actions_panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-top: 1px solid {self.theme.border};
            }}
        """)
        actions_layout = QVBoxLayout(actions_panel)
        actions_layout.setContentsMargins(16, 16, 16, 16)
        actions_layout.setSpacing(8)

        # Boton COBRAR
        checkout_btn = QPushButton("COBRAR (F12)")
        checkout_btn.setFixedHeight(56)
        checkout_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        checkout_btn.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        checkout_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.success};
                color: white;
                border: none;
                border-radius: 12px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.success_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
            }}
        """)
        checkout_btn.clicked.connect(self._on_checkout)
        actions_layout.addWidget(checkout_btn)

        # Botones secundarios
        secondary_row = QHBoxLayout()
        secondary_row.setSpacing(8)

        discount_btn = QPushButton("Descuento (F4)")
        discount_btn.setFixedHeight(40)
        discount_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        discount_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.warning};
                color: {self.theme.gray_900};
                border: none;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.warning_dark};
            }}
        """)
        discount_btn.clicked.connect(self._on_discount)
        secondary_row.addWidget(discount_btn)

        suspend_btn = QPushButton("Suspender (F10)")
        suspend_btn.setFixedHeight(40)
        suspend_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        suspend_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.gray_700};
                border: none;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        suspend_btn.clicked.connect(self._on_suspend)
        secondary_row.addWidget(suspend_btn)

        actions_layout.addLayout(secondary_row)
        layout.addWidget(actions_panel)

        return panel

    def _create_cart_item_widget(self, item: Dict[str, Any]) -> QFrame:
        """Crea un widget para un item del carrito."""
        has_discount = item.get("discount", 0) > 0
        promo_name = item.get("promotion_name")

        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QHBoxLayout(frame)
        layout.setContentsMargins(12, 10, 12, 10)
        layout.setSpacing(8)

        # Info del producto
        info = QWidget()
        info.setStyleSheet("background: transparent;")
        info_layout = QVBoxLayout(info)
        info_layout.setContentsMargins(0, 0, 0, 0)
        info_layout.setSpacing(2)

        name = QLabel(item["name"])
        name.setStyleSheet(f"""
            color: {self.theme.text_primary};
            font-size: 12px;
            font-weight: 500;
            background: transparent;
        """)
        name.setWordWrap(True)
        info_layout.addWidget(name)

        # Mostrar talle y color si existen (producto variable)
        size = item.get("size")
        color = item.get("color")
        if size or color:
            variant_parts = []
            if size:
                variant_parts.append(f"Talle: {size}")
            if color:
                variant_parts.append(f"Color: {color}")
            variant_text = " | ".join(variant_parts)
            variant_label = QLabel(variant_text)
            variant_label.setStyleSheet(f"""
                color: {self.theme.primary};
                font-size: 10px;
                font-weight: 500;
                background: transparent;
            """)
            info_layout.addWidget(variant_label)

        price_label = QLabel(f"${item['price']:,.2f}")
        price_label.setStyleSheet(f"""
            color: {self.theme.gray_500};
            font-size: 11px;
            background: transparent;
        """)
        info_layout.addWidget(price_label)

        # Mostrar nombre de promocion si hay descuento
        if has_discount and promo_name:
            promo_label = QLabel(promo_name)
            promo_label.setStyleSheet(f"""
                color: {self.theme.success};
                font-size: 10px;
                font-weight: 500;
                background: transparent;
            """)
            info_layout.addWidget(promo_label)

        layout.addWidget(info, 1)

        # Control de cantidad
        qty_widget = QWidget()
        qty_widget.setStyleSheet("background: transparent;")
        qty_layout = QHBoxLayout(qty_widget)
        qty_layout.setContentsMargins(0, 0, 0, 0)
        qty_layout.setSpacing(4)

        # Boton -
        minus_btn = QPushButton("-")
        minus_btn.setFixedSize(24, 24)
        minus_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        minus_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        item_id = item["id"]
        minus_btn.clicked.connect(lambda: self._update_item_quantity(item_id, -1))
        qty_layout.addWidget(minus_btn)

        # Campo de cantidad editable
        qty_input = QLineEdit(str(item["quantity"]))
        qty_input.setFixedSize(40, 24)
        qty_input.setAlignment(Qt.AlignmentFlag.AlignCenter)
        qty_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.surface};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        qty_input.returnPressed.connect(lambda: self._set_item_quantity(item_id, qty_input.text()))
        qty_input.editingFinished.connect(lambda: self._set_item_quantity(item_id, qty_input.text()))
        qty_layout.addWidget(qty_input)

        # Boton +
        plus_btn = QPushButton("+")
        plus_btn.setFixedSize(24, 24)
        plus_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        plus_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        plus_btn.clicked.connect(lambda: self._update_item_quantity(item_id, 1))
        qty_layout.addWidget(plus_btn)

        layout.addWidget(qty_widget)

        # Subtotal (con descuento aplicado)
        subtotal_value = item['subtotal']
        discount_value = item.get('discount', 0)

        subtotal_widget = QWidget()
        subtotal_widget.setStyleSheet("background: transparent;")
        subtotal_widget.setFixedWidth(70)
        subtotal_layout = QVBoxLayout(subtotal_widget)
        subtotal_layout.setContentsMargins(0, 0, 0, 0)
        subtotal_layout.setSpacing(0)

        subtotal = QLabel(f"${subtotal_value:,.2f}")
        subtotal.setStyleSheet(f"""
            color: {self.theme.primary};
            font-size: 13px;
            font-weight: 600;
            background: transparent;
        """)
        subtotal.setAlignment(Qt.AlignmentFlag.AlignRight)
        subtotal_layout.addWidget(subtotal)

        # Mostrar descuento si aplica
        if has_discount:
            discount_label = QLabel(f"-${discount_value:,.2f}")
            discount_label.setStyleSheet(f"""
                color: {self.theme.success};
                font-size: 10px;
                background: transparent;
            """)
            discount_label.setAlignment(Qt.AlignmentFlag.AlignRight)
            subtotal_layout.addWidget(discount_label)

        layout.addWidget(subtotal_widget)

        # Boton eliminar
        delete_btn = QPushButton("✕")
        delete_btn.setFixedSize(24, 24)
        delete_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        delete_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.danger};
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #DC2626;
            }}
        """)
        delete_btn.clicked.connect(lambda: self._remove_from_cart(item["id"]))
        layout.addWidget(delete_btn)

        return frame

    def _create_statusbar(self) -> None:
        """Crea la barra de estado."""
        statusbar = QStatusBar()
        self.setStatusBar(statusbar)

        # Usuario
        user_label = QLabel(f"Usuario: {self.user.get('name', 'N/A')}")
        user_label.setStyleSheet(f"color: {self.theme.gray_600};")
        statusbar.addWidget(user_label)

        statusbar.addWidget(QLabel(" | "))

        # Sucursal
        branch = self.user.get("branch_name", "N/A")
        branch_label = QLabel(f"Sucursal: {branch}")
        branch_label.setStyleSheet(f"color: {self.theme.gray_600};")
        statusbar.addWidget(branch_label)

        statusbar.addWidget(QLabel(" | "))

        # Estado de conexion
        self.connection_label = QLabel("Conectado")
        self.connection_label.setStyleSheet(f"color: {self.theme.success};")
        statusbar.addWidget(self.connection_label)

        # Espaciador
        statusbar.addPermanentWidget(QLabel(""))

        # Cantidad de productos
        self.products_status_label = QLabel("Productos: -")
        self.products_status_label.setStyleSheet(f"color: {self.theme.gray_500};")
        statusbar.addPermanentWidget(self.products_status_label)

        statusbar.addPermanentWidget(QLabel(" | "))

        # Turno
        self.cash_label = QLabel("Turno: Sin abrir")
        self.cash_label.setStyleSheet(f"color: {self.theme.gray_500};")
        statusbar.addPermanentWidget(self.cash_label)

    def _setup_shortcuts(self) -> None:
        """Configura atajos de teclado."""
        # Los atajos principales se manejan en keyPressEvent
        pass

    # =========================================================================
    # SINCRONIZACION
    # =========================================================================

    def _start_initial_sync(self) -> None:
        """Inicia la sincronizacion inicial de datos."""
        # Verificar si hay datos locales
        if self.sync_service.has_local_data():
            logger.info("Hay datos en cache local, cargando...")
            self._load_local_data()

        # Sincronizar en background
        self._start_sync()

    def _start_sync(self) -> None:
        """Inicia la sincronizacion en background."""
        if self.is_syncing:
            logger.warning("Ya hay una sincronizacion en progreso")
            return

        self.is_syncing = True
        self.sync_bar.show()
        self.sync_btn.setEnabled(False)

        # Configurar callbacks
        def on_progress(message: str, current: int, total: int):
            self.sync_progress.emit(message, current, total)

        def on_complete(result: SyncResult):
            self.sync_complete.emit(result)

        self.sync_service.set_callbacks(on_progress, on_complete)

        # Iniciar sincronizacion
        self.sync_service.sync_all_async()

    def _on_sync_progress(self, message: str, current: int, total: int) -> None:
        """Callback de progreso de sincronizacion (en hilo principal)."""
        self.sync_message.setText(message)
        if total > 0:
            percent = int((current / total) * 100)
            self.sync_progress_bar.setValue(percent)

    def _on_sync_complete(self, result: SyncResult) -> None:
        """Callback de finalizacion de sincronizacion (en hilo principal)."""
        self.is_syncing = False
        self.sync_bar.hide()
        self.sync_btn.setEnabled(True)

        if result.status == SyncStatus.SUCCESS:
            logger.info(
                f"Sincronizacion completada: {result.products_synced} productos, "
                f"{result.categories_synced} categorias"
            )
            self._load_local_data()
            self.connection_label.setText("Conectado")
            self.connection_label.setStyleSheet(f"color: {self.theme.success};")

        elif result.status == SyncStatus.OFFLINE:
            logger.warning("Sin conexion, usando datos locales")
            self.connection_label.setText("Sin conexion")
            self.connection_label.setStyleSheet(f"color: {self.theme.warning};")
            # Cargar datos locales si hay
            if self.sync_service.has_local_data():
                self._load_local_data()
            else:
                QMessageBox.warning(
                    self,
                    "Sin conexion",
                    "No hay conexion a internet y no hay datos en cache.\n"
                    "Conéctate a internet y presiona Sincronizar.",
                )

        else:
            logger.error(f"Error en sincronizacion: {result.error_message}")
            self.connection_label.setText("Error")
            self.connection_label.setStyleSheet(f"color: {self.theme.danger};")
            QMessageBox.warning(
                self,
                "Error de sincronizacion",
                f"No se pudieron sincronizar los datos:\n{result.error_message}",
            )

    def _load_local_data(self) -> None:
        """Carga productos y categorias desde la base de datos local."""
        try:
            # Cargar categorias
            self.categories = self.sync_service.get_local_categories()
            self._rebuild_categories()
            self._update_quick_access_buttons()

            # Cargar productos
            self.products = self.sync_service.get_local_products(limit=100)
            self._render_products(self.products)

            # Actualizar contador
            total_products = self.sync_service.get_products_count()
            self.products_status_label.setText(f"Productos: {total_products}")

            logger.info(f"Datos locales cargados: {len(self.products)} productos, {len(self.categories)} categorias")

        except Exception as e:
            logger.error(f"Error cargando datos locales: {e}")

    def _on_sync_click(self) -> None:
        """Manejador de click en boton sincronizar."""
        self._start_sync()

    def _focus_search(self) -> None:
        """Pone el focus en el campo de busqueda."""
        self.search_input.setFocus()
        self.search_input.selectAll()

    # =========================================================================
    # PRODUCTOS Y BUSQUEDA
    # =========================================================================

    def _render_products(self, products: List[Product]) -> None:
        """Renderiza los productos en grid o lista segun el modo."""
        # Limpiar grid existente
        while self.products_grid.count():
            item = self.products_grid.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        # Filtrar por promociones si esta activo
        if self.show_only_promotions:
            products = [p for p in products if self.sync_service.get_promotion_for_product(
                p.id, p.category_id, p.brand_id
            )]

        # Actualizar contador
        promo_text = " (en promocion)" if self.show_only_promotions else ""
        self.products_count_label.setText(f"{len(products)} productos{promo_text}")

        if not products:
            # Mostrar mensaje de sin productos
            msg = "No hay productos en promocion" if self.show_only_promotions else "No hay productos para mostrar"
            no_products = QLabel(msg)
            no_products.setStyleSheet(f"""
                color: {self.theme.gray_500};
                font-size: 14px;
                padding: 40px;
            """)
            no_products.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.products_grid.addWidget(no_products, 0, 0)
            return

        if self.view_mode == "grid":
            self._render_products_grid(products)
        else:
            self._render_products_list(products)

    def _render_products_grid(self, products: List[Product]) -> None:
        """Renderiza productos en formato grid (cards)."""
        cols = 5  # Numero de columnas
        for i, product in enumerate(products):
            row = i // cols
            col = i % cols
            card = self._create_product_card(product)
            self.products_grid.addWidget(card, row, col)

        # Agregar espaciador al final
        spacer = QSpacerItem(20, 40, QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Expanding)
        self.products_grid.addItem(spacer, (len(products) // cols) + 1, 0, 1, cols)

    def _render_products_list(self, products: List[Product]) -> None:
        """Renderiza productos en formato lista (filas)."""
        for i, product in enumerate(products):
            row_widget = self._create_product_list_row(product)
            self.products_grid.addWidget(row_widget, i, 0, 1, 1)

        # Agregar espaciador al final
        spacer = QSpacerItem(20, 40, QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Expanding)
        self.products_grid.addItem(spacer, len(products), 0)

    def _create_product_list_row(self, product: Product) -> QFrame:
        """Crea una fila de producto para la vista de lista."""
        promo = self.sync_service.get_promotion_for_product(
            product.id, product.category_id, product.brand_id
        )

        row = QFrame()
        row.setCursor(Qt.CursorShape.PointingHandCursor)
        row.setFixedHeight(50)

        border_color = self.theme.border
        if promo:
            promo_color = promo.badge_color or "#22C55E"
            border_color = promo_color

        row.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {border_color};
                border-radius: 6px;
                margin-bottom: 4px;
            }}
            QFrame:hover {{
                background-color: {self.theme.primary_bg};
                border-color: {self.theme.primary};
            }}
        """)

        layout = QHBoxLayout(row)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(16)

        # Codigo
        code = product.barcode or product.sku or product.internal_code or "-"
        code_label = QLabel(code)
        code_label.setFixedWidth(100)
        code_label.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 11px; font-weight: 500;")
        layout.addWidget(code_label)

        # Nombre
        name_label = QLabel(product.name)
        name_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 12px;")
        layout.addWidget(name_label, 1)

        # Badge promocion
        if promo:
            badge = QLabel(promo.get_badge_text())
            badge_color = promo.badge_color or "#22C55E"
            badge.setStyleSheet(f"""
                background-color: {badge_color};
                color: white;
                font-size: 9px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
            """)
            layout.addWidget(badge)

        # Stock
        stock = product.current_stock or 0
        stock_label = QLabel(f"Stock: {stock}")
        stock_label.setFixedWidth(70)
        stock_color = self.theme.success if stock > 10 else (self.theme.warning if stock > 0 else self.theme.danger)
        stock_label.setStyleSheet(f"color: {stock_color}; font-size: 11px;")
        layout.addWidget(stock_label)

        # Precio
        price_value = float(product.base_price) if product.base_price else 0.0
        price_label = QLabel(f"${price_value:,.2f}")
        price_label.setFixedWidth(90)
        price_label.setStyleSheet(f"color: {self.theme.primary}; font-size: 14px; font-weight: 700;")
        price_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        layout.addWidget(price_label)

        # Hacer clickeable
        product_dict = {
            "id": product.id,
            "code": product.barcode or product.sku or "",
            "name": product.name,
            "price": price_value,
            "stock": product.current_stock,
            "category_id": product.category_id,
            "brand_id": product.brand_id,
            "is_parent": product.is_parent,
            "parent_product_id": product.parent_product_id,
            "size": product.size,
            "color": product.color,
        }
        row.mousePressEvent = lambda e: self._add_to_cart(product_dict)

        return row

    def _toggle_view_mode(self) -> None:
        """Alterna entre vista grid y lista."""
        if self.view_mode == "grid":
            self.view_mode = "list"
            self.view_toggle_btn.setText("▦ Grid (F7)")
        else:
            self.view_mode = "grid"
            self.view_toggle_btn.setText("☰ Lista (F7)")

        self._filter_products()
        self._focus_search()

    def _toggle_promotions_filter(self) -> None:
        """Alterna filtro de solo promociones."""
        self.show_only_promotions = self.promo_filter_btn.isChecked()
        self._filter_products()
        self._focus_search()

    def _open_product_lookup(self) -> None:
        """Abre el dialogo de consulta de productos."""
        try:
            from src.ui.dialogs.product_lookup_dialog import ProductLookupDialog

            dialog = ProductLookupDialog(self.sync_service, self.theme, self)
            if dialog.exec():
                # Si se selecciono un producto, agregarlo al carrito
                product = dialog.selected_product
                if product:
                    product_dict = {
                        "id": product.id,
                        "code": product.barcode or product.sku or "",
                        "name": product.name,
                        "price": float(product.base_price) if product.base_price else 0.0,
                        "stock": product.current_stock,
                        "category_id": product.category_id,
                        "brand_id": product.brand_id,
                        "is_parent": product.is_parent,
                        "parent_product_id": product.parent_product_id,
                        "size": product.size,
                        "color": product.color,
                    }
                    self._add_to_cart(product_dict)
        except Exception as e:
            logger.error(f"Error en consulta de productos: {e}")
            QMessageBox.warning(self, "Error", f"Error al abrir consulta:\n{e}")

        self._focus_search()

    def _filter_products(self) -> None:
        """Filtra productos por categoria seleccionada."""
        category_id = None if self.selected_category == "all" else self.selected_category

        try:
            products = self.sync_service.get_local_products(
                category_id=category_id,
                limit=100,
            )
            self._render_products(products)
        except Exception as e:
            logger.error(f"Error filtrando productos: {e}")

    def _search_products(self, query: str) -> None:
        """Busca productos por texto."""
        if not query:
            self._filter_products()
            return

        try:
            products = self.sync_service.get_local_products(
                search=query,
                limit=50,
            )
            self._render_products(products)
            logger.debug(f"Busqueda: '{query}' - {len(products)} resultados")
        except Exception as e:
            logger.error(f"Error buscando productos: {e}")

    def _add_to_cart(self, product: Dict[str, Any]) -> None:
        """Agrega un producto al carrito."""
        # Si es producto padre (curva de talles), mostrar dialogo de seleccion
        if product.get("is_parent", False):
            self._show_size_curve_dialog(product)
            return

        # Si es variante (tiene parent_product_id), mostrar selector de variantes
        parent_id = product.get("parent_product_id")
        if parent_id:
            self._show_variant_selector(product, parent_id)
            return

        self._add_product_to_cart(product)

    def _add_product_to_cart(self, product: Dict[str, Any]) -> None:
        """Agrega el producto directamente al carrito (sin verificar si es padre)."""
        # Buscar si ya existe
        existing = next((item for item in self.cart_items if item["id"] == product["id"]), None)

        if existing:
            existing["quantity"] += 1
            existing["subtotal"] = existing["quantity"] * existing["price"]
        else:
            self.cart_items.append({
                "id": product["id"],
                "code": product.get("code", ""),
                "name": product["name"],
                "price": product["price"],
                "quantity": 1,
                "subtotal": product["price"],
                "discount": 0,
                "promotion_id": None,
                "promotion_name": None,
                "category_id": product.get("category_id"),
                "brand_id": product.get("brand_id"),
                "size": product.get("size"),
                "color": product.get("color"),
            })

        self._update_cart_display()
        self._schedule_promotion_calculation()
        self._focus_search()
        logger.debug(f"Agregado al carrito: {product['name']}")

    def _show_variant_selector(self, clicked_product: Dict[str, Any], parent_id: str) -> None:
        """Muestra selector de variantes para productos con curva de talles."""
        try:
            from src.ui.dialogs.variant_selector_dialog import VariantSelectorDialog

            # Obtener todas las variantes del mismo padre desde la BD local
            variants = self.sync_service.get_variants_by_parent(parent_id)

            if not variants:
                # Si no hay variantes, agregar directamente
                self._add_product_to_cart(clicked_product)
                return

            # Mostrar dialogo
            dialog = VariantSelectorDialog(
                product_name=clicked_product["name"],
                variants=variants,
                clicked_variant=clicked_product,
                parent=self,
            )

            if dialog.exec() == VariantSelectorDialog.DialogCode.Accepted:
                selected = dialog.get_selected_variant()
                if selected:
                    # Construir nombre con variante
                    base_name = clicked_product.get("name", selected.get("name", ""))
                    # Limpiar nombre base si ya tiene info de variante
                    if " - " in base_name:
                        base_name = base_name.split(" - ")[0]

                    variant_product = {
                        "id": selected["id"],
                        "code": selected.get("barcode") or selected.get("sku") or "",
                        "name": base_name,
                        "price": clicked_product["price"],
                        "category_id": clicked_product.get("category_id"),
                        "brand_id": clicked_product.get("brand_id"),
                        "size": selected.get("size"),
                        "color": selected.get("color"),
                    }
                    self._add_product_to_cart(variant_product)

        except Exception as e:
            logger.error(f"Error mostrando selector de variantes: {e}")
            # En caso de error, agregar el producto clickeado directamente
            self._add_product_to_cart(clicked_product)

    def _show_size_curve_dialog(self, parent_product: Dict[str, Any]) -> None:
        """Muestra el dialogo de curva de talles para un producto padre."""
        try:
            # Obtener curva de talles desde la API
            api = ProductsAPI()
            branch_id = self.user.get("branch_id")
            size_curve = api.get_size_curve(parent_product["id"], branch_id)

            if not size_curve:
                QMessageBox.warning(
                    self,
                    "Sin variantes",
                    "No se encontraron variantes para este producto.",
                )
                return

            # Mostrar dialogo
            dialog = SizeCurveDialog(parent_product, size_curve, self)
            if dialog.exec() == SizeCurveDialog.DialogCode.Accepted:
                variant = dialog.get_selected_variant()
                if variant:
                    # Agregar la variante al carrito
                    variant_product = {
                        "id": variant.variant_id,
                        "code": variant.sku or "",
                        "name": variant.parent_name,
                        "price": variant.price,
                        "category_id": parent_product.get("category_id"),
                        "brand_id": parent_product.get("brand_id"),
                        "size": variant.size,
                        "color": variant.color,
                    }
                    self._add_product_to_cart(variant_product)

        except Exception as e:
            logger.error(f"Error mostrando curva de talles: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"Error al cargar las variantes: {str(e)}",
            )

    def _remove_from_cart(self, product_id: str) -> None:
        """Elimina un producto del carrito."""
        self.cart_items = [item for item in self.cart_items if item["id"] != product_id]
        self._update_cart_display()
        self._schedule_promotion_calculation()
        self._focus_search()

    def _update_item_quantity(self, product_id: str, delta: int) -> None:
        """Actualiza la cantidad de un item del carrito (incremento/decremento)."""
        for item in self.cart_items:
            if item["id"] == product_id:
                new_qty = item["quantity"] + delta
                if new_qty <= 0:
                    # Si llega a 0 o menos, eliminar el item
                    self._remove_from_cart(product_id)
                    return
                item["quantity"] = new_qty
                item["subtotal"] = item["quantity"] * item["price"]
                break

        self._update_cart_display()
        self._schedule_promotion_calculation()

    def _set_item_quantity(self, product_id: str, quantity_str: str) -> None:
        """Establece la cantidad de un item del carrito desde un input de texto."""
        try:
            new_qty = int(quantity_str)
            if new_qty <= 0:
                self._remove_from_cart(product_id)
                return

            for item in self.cart_items:
                if item["id"] == product_id:
                    if item["quantity"] != new_qty:  # Solo actualizar si cambio
                        item["quantity"] = new_qty
                        item["subtotal"] = item["quantity"] * item["price"]
                        self._update_cart_display()
                        self._schedule_promotion_calculation()
                    break
        except ValueError:
            # Si no es un numero valido, refrescar display para restaurar valor
            self._update_cart_display()

    def _update_cart_display(self) -> None:
        """Actualiza la visualizacion del carrito."""
        # Limpiar items existentes
        while self.cart_items_layout.count() > 1:  # Mantener el stretch
            item = self.cart_items_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        # Agregar items
        for cart_item in self.cart_items:
            widget = self._create_cart_item_widget(cart_item)
            self.cart_items_layout.insertWidget(self.cart_items_layout.count() - 1, widget)

        # Actualizar contador
        total_items = sum(item["quantity"] for item in self.cart_items)
        self.cart_count_label.setText(f"{total_items} items")

        # Calcular totales
        subtotal_before_discount = sum(item["price"] * item["quantity"] for item in self.cart_items)
        total_discount = sum(item.get("discount", 0) for item in self.cart_items)
        total = subtotal_before_discount - total_discount

        self.subtotal_value.setText(f"${subtotal_before_discount:,.2f}")
        self.total_value.setText(f"${total:,.2f}")

        # Actualizar desglose de promociones
        self._update_promotions_display()

    def _on_clear_cart(self) -> None:
        """Limpia el carrito."""
        if not self.cart_items:
            return

        reply = QMessageBox.question(
            self,
            "Limpiar carrito",
            "Estas seguro de eliminar todos los items?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            self.cart_items.clear()
            self._update_cart_display()
            self._last_cart_key = ""
            self._focus_search()
            logger.info("Carrito limpiado")

    # =========================================================================
    # PROMOCIONES
    # =========================================================================

    def _get_cart_key(self) -> str:
        """Genera una clave unica basada en productos y cantidades del carrito."""
        if not self.cart_items:
            return ""
        items = sorted(
            [(item["id"], item["quantity"]) for item in self.cart_items],
            key=lambda x: x[0]
        )
        return ",".join(f"{pid}:{qty}" for pid, qty in items)

    def _schedule_promotion_calculation(self) -> None:
        """
        Programa el calculo de promociones con debounce.

        Espera 300ms despues del ultimo cambio antes de calcular
        para evitar llamadas excesivas a la API.
        """
        if not self.cart_items:
            self._last_cart_key = ""
            return

        # Verificar si el carrito realmente cambio
        new_key = self._get_cart_key()
        if new_key == self._last_cart_key:
            return

        # Cancelar timer anterior si existe
        if self._promotion_calc_timer:
            self._promotion_calc_timer.stop()

        # Crear nuevo timer
        self._promotion_calc_timer = QTimer()
        self._promotion_calc_timer.setSingleShot(True)
        self._promotion_calc_timer.timeout.connect(self._calculate_promotions_async)
        self._promotion_calc_timer.start(300)

    def _calculate_promotions_async(self) -> None:
        """Calcula promociones en un thread separado."""
        if not self.cart_items:
            return

        self.is_calculating_promotions = True

        def do_calculate():
            items = [
                {
                    "productId": item["id"],
                    "quantity": item["quantity"],
                    "unitPrice": item["price"],
                }
                for item in self.cart_items
            ]
            result = self.sync_service.calculate_promotions(items)
            self.promotions_calculated.emit(result)

        thread = threading.Thread(target=do_calculate, daemon=True)
        thread.start()

    def _on_promotions_calculated(self, result: Optional[CalculationResult]) -> None:
        """
        Callback cuando se completa el calculo de promociones.

        Actualiza los items del carrito con los descuentos calculados
        y refresca la visualizacion.
        """
        self.is_calculating_promotions = False

        if not result or not result.items:
            # Resetear descuentos si no hay promociones
            for item in self.cart_items:
                item["discount"] = 0
                item["subtotal"] = item["price"] * item["quantity"]
                item["promotion_id"] = None
                item["promotion_name"] = None
            self._last_cart_key = self._get_cart_key()
            self._update_cart_display()
            return

        # Aplicar descuentos calculados
        for item in self.cart_items:
            calc_item = next(
                (ci for ci in result.items if ci.product_id == item["id"]),
                None
            )
            if calc_item and calc_item.discount > 0:
                item["discount"] = calc_item.discount
                item["subtotal"] = item["price"] * item["quantity"] - calc_item.discount
                # Guardar TODAS las promociones aplicadas (soporta acumulables)
                item["promotions"] = [
                    {"id": p.id, "name": p.name, "type": p.type, "discount": p.discount}
                    for p in calc_item.promotions
                ] if calc_item.promotions else []
                # Compatibilidad: mantener promotion_name para mostrar en carrito
                if calc_item.promotions:
                    item["promotion_name"] = ", ".join(p.name for p in calc_item.promotions)
                elif calc_item.promotion:
                    item["promotion_name"] = calc_item.promotion.name
            else:
                item["discount"] = 0
                item["subtotal"] = item["price"] * item["quantity"]
                item["promotions"] = []
                item["promotion_name"] = None

        self._last_cart_key = self._get_cart_key()
        self._update_cart_display()

        logger.debug(
            f"Promociones calculadas: descuento total ${result.total_discount:.2f}"
        )

    def _update_promotions_display(self) -> None:
        """Actualiza el desglose de promociones en el panel de totales."""
        # Limpiar promociones existentes
        while self.promotions_layout.count():
            item = self.promotions_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        # Agrupar descuentos por promocion (soporta promociones acumulables)
        discounts_by_promo: Dict[str, Dict[str, Any]] = {}
        for item in self.cart_items:
            # Usar el array de promociones si existe (acumulables)
            promotions = item.get("promotions", [])
            if promotions:
                for promo in promotions:
                    promo_id = promo.get("id")
                    promo_name = promo.get("name")
                    promo_discount = promo.get("discount", 0)
                    if promo_id and promo_name and promo_discount > 0:
                        if promo_id not in discounts_by_promo:
                            discounts_by_promo[promo_id] = {"name": promo_name, "total": 0}
                        discounts_by_promo[promo_id]["total"] += promo_discount

        # Mostrar cada promocion
        for promo_id, promo_data in discounts_by_promo.items():
            row = QHBoxLayout()
            row.setContentsMargins(0, 0, 0, 0)

            # Nombre de la promocion (con icono)
            name_label = QLabel(f"* {promo_data['name']}")
            name_label.setStyleSheet(f"""
                color: {self.theme.success};
                font-size: 12px;
                background: transparent;
            """)
            row.addWidget(name_label)

            row.addStretch()

            # Valor del descuento
            value_label = QLabel(f"-${promo_data['total']:,.2f}")
            value_label.setStyleSheet(f"""
                color: {self.theme.success};
                font-size: 12px;
                font-weight: 500;
                background: transparent;
            """)
            value_label.setAlignment(Qt.AlignmentFlag.AlignRight)
            row.addWidget(value_label)

            # Contenedor del row
            row_widget = QWidget()
            row_widget.setStyleSheet("background: transparent;")
            row_widget.setLayout(row)
            self.promotions_layout.addWidget(row_widget)

    def _on_search(self) -> None:
        """Busca productos (Enter en el campo de busqueda)."""
        query = self.search_input.text().strip()

        # Verificar si es un codigo de barras (solo numeros)
        if query.isdigit() and len(query) >= 8:
            product = self.sync_service.get_product_by_barcode(query)
            if product:
                # Agregar directamente al carrito
                product_dict = {
                    "id": product.id,
                    "code": product.barcode or product.sku or "",
                    "name": product.name,
                    "price": float(product.base_price),
                    "stock": product.current_stock,
                    "category_id": product.category_id,
                    "brand_id": product.brand_id,
                    "is_parent": product.is_parent,
                    "parent_product_id": product.parent_product_id,
                    "size": product.size,
                    "color": product.color,
                }
                self._add_to_cart(product_dict)
                self.search_input.clear()
                logger.info(f"Producto escaneado: {product.name}")
                return

        # Busqueda normal por texto
        self._search_products(query)

    def _on_search_text_changed(self, text: str) -> None:
        """Maneja cambios en el texto de busqueda."""
        if not text.strip():
            self._filter_products()

    def _on_checkout(self) -> None:
        """Inicia el proceso de cobro."""
        if not self.cart_items:
            QMessageBox.warning(self, "Carrito vacio", "Agrega productos al carrito antes de cobrar.")
            return

        # Calcular totales con descuentos de promociones
        subtotal_before_discount = sum(item["price"] * item["quantity"] for item in self.cart_items)
        discount = sum(item.get("discount", 0) for item in self.cart_items)
        total = subtotal_before_discount - discount

        logger.info(f"Iniciar cobro - Subtotal: ${subtotal_before_discount:,.2f}, Descuento: ${discount:,.2f}, Total: ${total:,.2f}")

        # Abrir dialogo de checkout
        dialog = CheckoutDialog(
            items=self.cart_items,
            total=total,
            subtotal=subtotal_before_discount,
            discount=discount,
            parent=self,
        )

        # Conectar signals
        dialog.payment_confirmed.connect(self._on_payment_confirmed)
        dialog.payment_cancelled.connect(self._on_payment_cancelled)

        # Mostrar dialogo
        dialog.exec()

    def _on_payment_confirmed(self, result: CheckoutResult) -> None:
        """Maneja la confirmacion del pago."""
        logger.info(
            f"Pago confirmado - Total: ${result.total_paid:,.2f}, "
            f"Vuelto: ${result.change:,.2f}, "
            f"Metodos: {[p.method.value for p in result.payments]}"
        )

        # Limpiar el carrito
        self.cart_items.clear()
        self._update_cart_display()

        # TODO: Registrar venta en el backend
        # TODO: Imprimir ticket

    def _on_payment_cancelled(self) -> None:
        """Maneja la cancelacion del pago."""
        logger.info("Pago cancelado por el usuario")

    def _on_discount(self) -> None:
        """Aplica descuento."""
        logger.info("Aplicar descuento")
        # TODO: Implementar dialogo de descuento

    def _on_suspend(self) -> None:
        """Suspende la venta actual."""
        logger.info("Suspender venta")
        # TODO: Implementar suspension de venta

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

    def keyPressEvent(self, event: QKeyEvent) -> None:
        """Maneja eventos de teclado."""
        key = event.key()

        # F1-F9: Acceso rapido a categorias
        if key == Qt.Key.Key_F1:
            self._on_quick_category(0)
        elif key == Qt.Key.Key_F2:
            self.search_input.setFocus()
            self.search_input.selectAll()
        elif key == Qt.Key.Key_F3:
            self._open_product_lookup()
        elif key == Qt.Key.Key_F4:
            self._on_discount()
        elif key == Qt.Key.Key_F5:
            self._on_sync_click()
        elif key == Qt.Key.Key_F6:
            self.promo_filter_btn.setChecked(not self.promo_filter_btn.isChecked())
            self._toggle_promotions_filter()
        elif key == Qt.Key.Key_F7:
            self._toggle_view_mode()
        elif key == Qt.Key.Key_F8:
            self._on_quick_category(7)
        elif key == Qt.Key.Key_F9:
            self._on_quick_category(8)
        elif key == Qt.Key.Key_F10:
            self._on_suspend()
        elif key == Qt.Key.Key_F12:
            self._on_checkout()
        elif key == Qt.Key.Key_Escape:
            self.search_input.clear()
            self.search_input.setFocus()
        # Ctrl+1 a Ctrl+9 para categorias adicionales
        elif event.modifiers() == Qt.KeyboardModifier.ControlModifier:
            if key >= Qt.Key.Key_1 and key <= Qt.Key.Key_9:
                idx = key - Qt.Key.Key_1
                self._on_quick_category(idx)
            else:
                super().keyPressEvent(event)
        else:
            super().keyPressEvent(event)

    def closeEvent(self, event: QCloseEvent) -> None:
        """Maneja el cierre de la ventana."""
        logger.info("Cerrando MainWindow")
        event.accept()
