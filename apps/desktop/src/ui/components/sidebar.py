"""
Componente Sidebar para navegacion.

Sidebar colapsable con menu de navegacion y accesos rapidos.
"""

from typing import Optional, List, Callable
from dataclasses import dataclass

from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QScrollArea,
    QSizePolicy,
)
from PyQt6.QtCore import Qt, pyqtSignal, QPropertyAnimation, QEasingCurve
from PyQt6.QtGui import QFont, QIcon

from loguru import logger

from src.ui.styles.theme import Theme


@dataclass
class NavItem:
    """Item de navegacion."""
    id: str
    icon: str
    text: str
    shortcut: Optional[str] = None
    badge: Optional[int] = None


class SidebarNavButton(QPushButton):
    """Boton de navegacion del sidebar."""

    def __init__(
        self,
        item: NavItem,
        theme: Theme,
        collapsed: bool = False,
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)
        self.item = item
        self.theme = theme
        self._collapsed = collapsed
        self._active = False

        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la UI del boton."""
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setCheckable(True)
        self._update_content()
        self._apply_style()

    def _update_content(self) -> None:
        """Actualiza el contenido del boton."""
        if self._collapsed:
            self.setText(self.item.icon)
            self.setToolTip(f"{self.item.text} ({self.item.shortcut})" if self.item.shortcut else self.item.text)
        else:
            text = f"{self.item.icon}  {self.item.text}"
            if self.item.shortcut:
                # Agregar shortcut al final con espaciado
                self.setText(text)
            else:
                self.setText(text)

    def _apply_style(self) -> None:
        """Aplica estilos al boton."""
        active_bg = f"rgba(16, 185, 129, 0.15)"
        active_border = self.theme.primary
        hover_bg = "rgba(255, 255, 255, 0.08)"

        self.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: rgba(255, 255, 255, 0.7);
                border: none;
                border-left: 3px solid transparent;
                padding: 12px 15px;
                font-size: {self.theme.font_size_md}px;
                text-align: left;
            }}
            QPushButton:hover {{
                background-color: {hover_bg};
                color: white;
            }}
            QPushButton:checked {{
                background-color: {active_bg};
                border-left-color: {active_border};
                color: {self.theme.primary};
            }}
        """)

    def set_collapsed(self, collapsed: bool) -> None:
        """Cambia el estado colapsado."""
        self._collapsed = collapsed
        self._update_content()

    def set_active(self, active: bool) -> None:
        """Establece si el item esta activo."""
        self._active = active
        self.setChecked(active)


class Sidebar(QFrame):
    """
    Sidebar de navegacion colapsable.

    Signals:
        navigation_changed: Emitido cuando se selecciona un item (item_id)
        collapse_changed: Emitido cuando cambia el estado colapsado (collapsed)
    """

    navigation_changed = pyqtSignal(str)
    collapse_changed = pyqtSignal(bool)

    # Anchos del sidebar
    EXPANDED_WIDTH = 220
    COLLAPSED_WIDTH = 70

    def __init__(
        self,
        theme: Theme,
        tenant_name: str = "",
        branch_name: str = "",
        user_name: str = "",
        user_role: str = "",
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)
        self.theme = theme
        self.tenant_name = tenant_name
        self.branch_name = branch_name
        self.user_name = user_name
        self.user_role = user_role

        self._collapsed = False
        self._nav_buttons: List[SidebarNavButton] = []
        self._current_item: Optional[str] = None

        self._setup_ui()
        self._apply_style()

        logger.debug("Sidebar inicializado")

    def _setup_ui(self) -> None:
        """Configura la UI del sidebar."""
        self.setFixedWidth(self.EXPANDED_WIDTH)
        self.setObjectName("sidebar")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header con logo
        self._create_header(layout)

        # Info del tenant
        self._create_tenant_info(layout)

        # Area de navegacion scrolleable
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll.setStyleSheet("""
            QScrollArea {
                border: none;
                background: transparent;
            }
            QScrollArea > QWidget > QWidget {
                background: transparent;
            }
        """)

        nav_widget = QWidget()
        self._nav_layout = QVBoxLayout(nav_widget)
        self._nav_layout.setContentsMargins(0, 15, 0, 15)
        self._nav_layout.setSpacing(0)

        scroll.setWidget(nav_widget)
        layout.addWidget(scroll, 1)

        # Seccion de usuario
        self._create_user_section(layout)

    def _create_header(self, layout: QVBoxLayout) -> None:
        """Crea el header con logo."""
        header = QFrame()
        header.setObjectName("sidebarHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(15, 20, 15, 20)
        header_layout.setSpacing(12)

        # Logo
        self._logo = QLabel("C")
        self._logo.setFixedSize(40, 40)
        self._logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._logo.setStyleSheet(f"""
            QLabel {{
                background-color: {self.theme.primary};
                color: white;
                border-radius: 10px;
                font-size: 18px;
                font-weight: bold;
            }}
        """)
        header_layout.addWidget(self._logo)

        # Texto de marca
        self._brand_text = QLabel("Cianbox POS")
        self._brand_text.setStyleSheet(f"""
            QLabel {{
                color: white;
                font-size: 16px;
                font-weight: 600;
            }}
        """)
        header_layout.addWidget(self._brand_text)
        header_layout.addStretch()

        # Boton de colapsar
        self._collapse_btn = QPushButton("<")
        self._collapse_btn.setFixedSize(24, 24)
        self._collapse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._collapse_btn.clicked.connect(self.toggle_collapse)
        self._collapse_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        header_layout.addWidget(self._collapse_btn)

        layout.addWidget(header)

    def _create_tenant_info(self, layout: QVBoxLayout) -> None:
        """Crea la seccion de info del tenant."""
        self._tenant_frame = QFrame()
        self._tenant_frame.setObjectName("tenantInfo")
        tenant_layout = QVBoxLayout(self._tenant_frame)
        tenant_layout.setContentsMargins(15, 15, 15, 15)
        tenant_layout.setSpacing(2)

        self._tenant_label = QLabel(self.tenant_name)
        self._tenant_label.setStyleSheet(f"""
            QLabel {{
                color: {self.theme.primary};
                font-size: 13px;
                font-weight: 500;
            }}
        """)
        tenant_layout.addWidget(self._tenant_label)

        self._branch_label = QLabel(self.branch_name)
        self._branch_label.setStyleSheet(f"""
            QLabel {{
                color: rgba(255, 255, 255, 0.6);
                font-size: 11px;
            }}
        """)
        tenant_layout.addWidget(self._branch_label)

        layout.addWidget(self._tenant_frame)

    def _create_user_section(self, layout: QVBoxLayout) -> None:
        """Crea la seccion de usuario."""
        self._user_frame = QFrame()
        self._user_frame.setObjectName("userSection")
        user_layout = QHBoxLayout(self._user_frame)
        user_layout.setContentsMargins(15, 15, 15, 15)
        user_layout.setSpacing(10)

        # Avatar
        self._user_avatar = QLabel(self.user_name[0].upper() if self.user_name else "U")
        self._user_avatar.setFixedSize(36, 36)
        self._user_avatar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._user_avatar.setStyleSheet(f"""
            QLabel {{
                background-color: {self.theme.primary};
                color: white;
                border-radius: 18px;
                font-size: 14px;
                font-weight: 600;
            }}
        """)
        user_layout.addWidget(self._user_avatar)

        # Info usuario
        self._user_info = QWidget()
        user_info_layout = QVBoxLayout(self._user_info)
        user_info_layout.setContentsMargins(0, 0, 0, 0)
        user_info_layout.setSpacing(0)

        self._user_name_label = QLabel(self.user_name)
        self._user_name_label.setStyleSheet(f"""
            QLabel {{
                color: white;
                font-size: 13px;
                font-weight: 500;
            }}
        """)
        user_info_layout.addWidget(self._user_name_label)

        self._user_role_label = QLabel(self.user_role)
        self._user_role_label.setStyleSheet(f"""
            QLabel {{
                color: rgba(255, 255, 255, 0.5);
                font-size: 11px;
            }}
        """)
        user_info_layout.addWidget(self._user_role_label)

        user_layout.addWidget(self._user_info)
        user_layout.addStretch()

        layout.addWidget(self._user_frame)

    def _apply_style(self) -> None:
        """Aplica estilos al sidebar."""
        self.setStyleSheet(f"""
            QFrame#sidebar {{
                background: qlineargradient(
                    x1:0, y1:0, x2:0, y2:1,
                    stop:0 #1a1a2e,
                    stop:1 #16213e
                );
            }}
            QFrame#sidebarHeader {{
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }}
            QFrame#tenantInfo {{
                background-color: rgba(255, 255, 255, 0.05);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }}
            QFrame#userSection {{
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }}
        """)

    def add_section(self, label: str) -> None:
        """
        Agrega una seccion/etiqueta al menu.

        Args:
            label: Texto de la seccion
        """
        section_label = QLabel(label.upper())
        section_label.setObjectName("navSection")
        section_label.setStyleSheet(f"""
            QLabel {{
                color: rgba(255, 255, 255, 0.4);
                font-size: 11px;
                letter-spacing: 0.5px;
                padding: 15px 15px 10px 15px;
            }}
        """)
        self._nav_layout.addWidget(section_label)

        # Guardar referencia para ocultar cuando colapsado
        if not hasattr(self, '_section_labels'):
            self._section_labels = []
        self._section_labels.append(section_label)

    def add_item(self, item: NavItem) -> None:
        """
        Agrega un item de navegacion.

        Args:
            item: NavItem con los datos del item
        """
        btn = SidebarNavButton(item, self.theme, self._collapsed)
        btn.clicked.connect(lambda checked, i=item: self._on_item_clicked(i.id))
        self._nav_buttons.append(btn)
        self._nav_layout.addWidget(btn)

    def add_stretch(self) -> None:
        """Agrega espacio flexible."""
        self._nav_layout.addStretch()

    def _on_item_clicked(self, item_id: str) -> None:
        """Maneja click en un item."""
        self.set_current_item(item_id)
        self.navigation_changed.emit(item_id)

    def set_current_item(self, item_id: str) -> None:
        """
        Establece el item actual.

        Args:
            item_id: ID del item a activar
        """
        self._current_item = item_id
        for btn in self._nav_buttons:
            btn.set_active(btn.item.id == item_id)

    def get_current_item(self) -> Optional[str]:
        """Obtiene el item actual."""
        return self._current_item

    def toggle_collapse(self) -> None:
        """Alterna el estado colapsado."""
        self.set_collapsed(not self._collapsed)

    def set_collapsed(self, collapsed: bool) -> None:
        """
        Establece el estado colapsado.

        Args:
            collapsed: True para colapsar
        """
        self._collapsed = collapsed

        # Animar el ancho
        target_width = self.COLLAPSED_WIDTH if collapsed else self.EXPANDED_WIDTH
        self.setFixedWidth(target_width)

        # Actualizar botones
        for btn in self._nav_buttons:
            btn.set_collapsed(collapsed)

        # Ocultar/mostrar elementos
        self._brand_text.setVisible(not collapsed)
        self._tenant_label.setVisible(not collapsed)
        self._branch_label.setVisible(not collapsed)
        self._user_info.setVisible(not collapsed)
        self._collapse_btn.setText(">" if collapsed else "<")

        # Ocultar labels de seccion
        if hasattr(self, '_section_labels'):
            for label in self._section_labels:
                label.setVisible(not collapsed)

        self.collapse_changed.emit(collapsed)

    def is_collapsed(self) -> bool:
        """Retorna si esta colapsado."""
        return self._collapsed

    def update_user(self, name: str, role: str) -> None:
        """
        Actualiza la info del usuario.

        Args:
            name: Nombre del usuario
            role: Rol del usuario
        """
        self.user_name = name
        self.user_role = role
        self._user_avatar.setText(name[0].upper() if name else "U")
        self._user_name_label.setText(name)
        self._user_role_label.setText(role)

    def update_tenant(self, tenant: str, branch: str) -> None:
        """
        Actualiza la info del tenant.

        Args:
            tenant: Nombre del tenant
            branch: Nombre de la sucursal
        """
        self.tenant_name = tenant
        self.branch_name = branch
        self._tenant_label.setText(tenant)
        self._branch_label.setText(branch)
