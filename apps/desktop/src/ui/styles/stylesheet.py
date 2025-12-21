"""
Stylesheet global de la aplicacion.

Define los estilos QSS para todos los widgets.
"""

from .theme import get_theme


def get_stylesheet() -> str:
    """
    Genera el stylesheet global de la aplicacion.

    Returns:
        String QSS completo
    """
    theme = get_theme()

    return f"""
/* ==========================================================================
   ESTILOS GLOBALES - CIANBOX POS
   ========================================================================== */

/* Widget Base */
QWidget {{
    font-family: {theme.font_family};
    font-size: {theme.font_size_md}px;
    color: {theme.text_primary};
}}

QMainWindow {{
    background-color: {theme.background};
}}

/* ==========================================================================
   BOTONES
   ========================================================================== */

QPushButton {{
    background-color: {theme.primary};
    color: {theme.text_inverse};
    border: none;
    border-radius: {theme.radius_md}px;
    padding: 10px 16px;
    font-weight: 500;
    min-height: 36px;
}}

QPushButton:hover {{
    background-color: {theme.primary_dark};
}}

QPushButton:pressed {{
    background-color: {theme.primary_dark};
}}

QPushButton:disabled {{
    background-color: {theme.gray_300};
    color: {theme.gray_500};
}}

QPushButton:focus {{
    outline: none;
    border: 2px solid {theme.primary_light};
}}

/* Variantes de botones */
QPushButton[class="secondary"] {{
    background-color: {theme.gray_100};
    color: {theme.text_primary};
    border: 1px solid {theme.border};
}}

QPushButton[class="secondary"]:hover {{
    background-color: {theme.gray_200};
}}

QPushButton[class="success"] {{
    background-color: {theme.success};
}}

QPushButton[class="success"]:hover {{
    background-color: {theme.success_dark};
}}

QPushButton[class="danger"] {{
    background-color: {theme.danger};
}}

QPushButton[class="danger"]:hover {{
    background-color: {theme.danger_dark};
}}

QPushButton[class="warning"] {{
    background-color: {theme.warning};
    color: {theme.text_primary};
}}

QPushButton[class="warning"]:hover {{
    background-color: {theme.warning_dark};
}}

QPushButton[class="ghost"] {{
    background-color: transparent;
    color: {theme.text_primary};
}}

QPushButton[class="ghost"]:hover {{
    background-color: {theme.gray_100};
}}

/* ==========================================================================
   INPUTS
   ========================================================================== */

QLineEdit {{
    background-color: {theme.surface};
    color: {theme.text_primary};
    border: 2px solid {theme.border};
    border-radius: {theme.radius_md}px;
    padding: 10px 12px;
    font-size: {theme.font_size_md}px;
    min-height: 20px;
    selection-background-color: {theme.primary_bg};
}}

QLineEdit:focus {{
    border-color: {theme.primary};
}}

QLineEdit:disabled {{
    background-color: {theme.gray_100};
    color: {theme.gray_500};
}}

QLineEdit[class="search"] {{
    padding-left: 36px;
    border-radius: 20px;
}}

/* SpinBox */
QSpinBox, QDoubleSpinBox {{
    background-color: {theme.surface};
    border: 2px solid {theme.border};
    border-radius: {theme.radius_md}px;
    padding: 8px 12px;
    min-height: 20px;
}}

QSpinBox:focus, QDoubleSpinBox:focus {{
    border-color: {theme.primary};
}}

QSpinBox::up-button, QSpinBox::down-button,
QDoubleSpinBox::up-button, QDoubleSpinBox::down-button {{
    width: 24px;
    border: none;
    background-color: {theme.gray_100};
}}

QSpinBox::up-button:hover, QSpinBox::down-button:hover,
QDoubleSpinBox::up-button:hover, QDoubleSpinBox::down-button:hover {{
    background-color: {theme.gray_200};
}}

/* ComboBox */
QComboBox {{
    background-color: {theme.surface};
    border: 2px solid {theme.border};
    border-radius: {theme.radius_md}px;
    padding: 10px 12px;
    min-height: 20px;
}}

QComboBox:focus {{
    border-color: {theme.primary};
}}

QComboBox::drop-down {{
    border: none;
    width: 30px;
}}

QComboBox QAbstractItemView {{
    background-color: {theme.surface};
    border: 1px solid {theme.border};
    border-radius: {theme.radius_md}px;
    selection-background-color: {theme.primary};
    selection-color: {theme.text_inverse};
    padding: 4px;
}}

/* ==========================================================================
   TABLAS Y LISTAS
   ========================================================================== */

QTableWidget, QTableView {{
    background-color: {theme.surface};
    border: 1px solid {theme.border};
    border-radius: {theme.radius_md}px;
    gridline-color: {theme.border_light};
    selection-background-color: {theme.primary_bg};
    selection-color: {theme.text_primary};
}}

QTableWidget::item, QTableView::item {{
    padding: 8px;
    border-bottom: 1px solid {theme.border_light};
}}

QTableWidget::item:selected, QTableView::item:selected {{
    background-color: {theme.primary_bg};
    color: {theme.text_primary};
}}

QTableWidget::item:hover, QTableView::item:hover {{
    background-color: {theme.gray_50};
}}

QHeaderView::section {{
    background-color: {theme.gray_100};
    color: {theme.text_primary};
    font-weight: 600;
    padding: 10px 8px;
    border: none;
    border-bottom: 2px solid {theme.border};
}}

QListWidget, QListView {{
    background-color: {theme.surface};
    border: 1px solid {theme.border};
    border-radius: {theme.radius_md}px;
}}

QListWidget::item, QListView::item {{
    padding: 10px;
    border-bottom: 1px solid {theme.border_light};
}}

QListWidget::item:selected, QListView::item:selected {{
    background-color: {theme.primary_bg};
    color: {theme.text_primary};
}}

QListWidget::item:hover, QListView::item:hover {{
    background-color: {theme.gray_50};
}}

/* ==========================================================================
   SCROLLBARS
   ========================================================================== */

QScrollBar:vertical {{
    background-color: {theme.gray_100};
    width: 12px;
    border-radius: 6px;
    margin: 0;
}}

QScrollBar::handle:vertical {{
    background-color: {theme.gray_300};
    min-height: 30px;
    border-radius: 6px;
    margin: 2px;
}}

QScrollBar::handle:vertical:hover {{
    background-color: {theme.gray_400};
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

QScrollBar:horizontal {{
    background-color: {theme.gray_100};
    height: 12px;
    border-radius: 6px;
    margin: 0;
}}

QScrollBar::handle:horizontal {{
    background-color: {theme.gray_300};
    min-width: 30px;
    border-radius: 6px;
    margin: 2px;
}}

QScrollBar::handle:horizontal:hover {{
    background-color: {theme.gray_400};
}}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0;
}}

/* ==========================================================================
   LABELS
   ========================================================================== */

QLabel {{
    color: {theme.text_primary};
}}

QLabel[class="title"] {{
    font-size: {theme.font_size_2xl}px;
    font-weight: bold;
}}

QLabel[class="subtitle"] {{
    font-size: {theme.font_size_lg}px;
    font-weight: 600;
}}

QLabel[class="caption"] {{
    font-size: {theme.font_size_sm}px;
    color: {theme.text_muted};
}}

QLabel[class="error"] {{
    color: {theme.danger};
    font-size: {theme.font_size_sm}px;
}}

QLabel[class="success"] {{
    color: {theme.success};
    font-size: {theme.font_size_sm}px;
}}

QLabel[class="price"] {{
    font-size: {theme.font_size_xl}px;
    font-weight: bold;
    color: {theme.primary};
}}

/* ==========================================================================
   FRAMES Y CONTENEDORES
   ========================================================================== */

QFrame {{
    border: none;
}}

QFrame[class="card"] {{
    background-color: {theme.surface};
    border: 1px solid {theme.border};
    border-radius: {theme.radius_lg}px;
}}

QFrame[class="card-header"] {{
    background-color: {theme.gray_50};
    border-bottom: 1px solid {theme.border};
    border-radius: {theme.radius_lg}px {theme.radius_lg}px 0 0;
}}

QGroupBox {{
    font-weight: 600;
    border: 1px solid {theme.border};
    border-radius: {theme.radius_md}px;
    margin-top: 12px;
    padding-top: 12px;
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 8px;
    color: {theme.text_primary};
}}

/* ==========================================================================
   TABS
   ========================================================================== */

QTabWidget::pane {{
    border: 1px solid {theme.border};
    border-radius: {theme.radius_md}px;
    background-color: {theme.surface};
}}

QTabBar::tab {{
    background-color: {theme.gray_100};
    color: {theme.text_secondary};
    padding: 10px 20px;
    margin-right: 2px;
    border: none;
    border-top-left-radius: {theme.radius_md}px;
    border-top-right-radius: {theme.radius_md}px;
}}

QTabBar::tab:selected {{
    background-color: {theme.surface};
    color: {theme.primary};
    font-weight: 600;
}}

QTabBar::tab:hover:!selected {{
    background-color: {theme.gray_200};
}}

/* ==========================================================================
   PROGRESS BAR
   ========================================================================== */

QProgressBar {{
    background-color: {theme.gray_200};
    border: none;
    border-radius: 4px;
    height: 8px;
    text-align: center;
}}

QProgressBar::chunk {{
    background-color: {theme.primary};
    border-radius: 4px;
}}

/* ==========================================================================
   CHECKBOX Y RADIO
   ========================================================================== */

QCheckBox, QRadioButton {{
    spacing: 8px;
}}

QCheckBox::indicator, QRadioButton::indicator {{
    width: 20px;
    height: 20px;
    border: 2px solid {theme.gray_300};
    border-radius: 4px;
    background-color: {theme.surface};
}}

QRadioButton::indicator {{
    border-radius: 10px;
}}

QCheckBox::indicator:checked, QRadioButton::indicator:checked {{
    background-color: {theme.primary};
    border-color: {theme.primary};
}}

QCheckBox::indicator:hover, QRadioButton::indicator:hover {{
    border-color: {theme.primary};
}}

/* ==========================================================================
   TOOLTIPS
   ========================================================================== */

QToolTip {{
    background-color: {theme.gray_800};
    color: {theme.text_inverse};
    border: none;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: {theme.font_size_sm}px;
}}

/* ==========================================================================
   MENUS
   ========================================================================== */

QMenuBar {{
    background-color: {theme.surface};
    border-bottom: 1px solid {theme.border};
    padding: 4px;
}}

QMenuBar::item {{
    padding: 8px 12px;
    background-color: transparent;
    border-radius: {theme.radius_sm}px;
}}

QMenuBar::item:selected {{
    background-color: {theme.gray_100};
}}

QMenu {{
    background-color: {theme.surface};
    border: 1px solid {theme.border};
    border-radius: {theme.radius_md}px;
    padding: 4px;
}}

QMenu::item {{
    padding: 8px 24px;
    border-radius: {theme.radius_sm}px;
}}

QMenu::item:selected {{
    background-color: {theme.primary_bg};
    color: {theme.primary};
}}

QMenu::separator {{
    height: 1px;
    background-color: {theme.border};
    margin: 4px 8px;
}}

/* ==========================================================================
   STATUSBAR
   ========================================================================== */

QStatusBar {{
    background-color: {theme.gray_50};
    border-top: 1px solid {theme.border};
    color: {theme.text_secondary};
    font-size: {theme.font_size_sm}px;
    padding: 4px;
}}

QStatusBar::item {{
    border: none;
}}

/* ==========================================================================
   DIALOG
   ========================================================================== */

QDialog {{
    background-color: {theme.surface};
}}

QDialogButtonBox QPushButton {{
    min-width: 80px;
}}

QMessageBox {{
    background-color: {theme.surface};
}}

QMessageBox QLabel {{
    color: {theme.text_primary};
}}

/* ==========================================================================
   TOOLBAR
   ========================================================================== */

QToolBar {{
    background-color: {theme.surface};
    border-bottom: 1px solid {theme.border};
    padding: 4px;
    spacing: 4px;
}}

QToolBar::separator {{
    width: 1px;
    background-color: {theme.border};
    margin: 4px 8px;
}}

QToolButton {{
    background-color: transparent;
    border: none;
    border-radius: {theme.radius_sm}px;
    padding: 8px;
}}

QToolButton:hover {{
    background-color: {theme.gray_100};
}}

QToolButton:pressed {{
    background-color: {theme.gray_200};
}}

/* ==========================================================================
   SPLITTER
   ========================================================================== */

QSplitter::handle {{
    background-color: {theme.border};
}}

QSplitter::handle:horizontal {{
    width: 2px;
}}

QSplitter::handle:vertical {{
    height: 2px;
}}

QSplitter::handle:hover {{
    background-color: {theme.primary};
}}
"""
