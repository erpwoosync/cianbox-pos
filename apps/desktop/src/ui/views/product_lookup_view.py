"""
Vista de consulta de productos.

Permite buscar productos y ver precios/stock sin agregar al carrito.
"""

from typing import Optional, List
from decimal import Decimal

from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QGridLayout,
    QScrollArea,
)
from PyQt6.QtCore import Qt, pyqtSignal, QTimer
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles.theme import Theme
from src.models import Product


class ProductLookupView(QWidget):
    """Vista para consultar productos y precios."""

    product_selected = pyqtSignal(object)  # Product

    def __init__(self, theme: Theme, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.theme = theme
        self._products: List[Product] = []
        self._debounce_timer: Optional[QTimer] = None

        self._setup_ui()
        logger.debug("ProductLookupView inicializado")

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Titulo
        title = QLabel("Consulta de Productos")
        title.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Descripcion
        desc = QLabel("Escanea o busca productos para ver precios y stock")
        desc.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 14px;")
        layout.addWidget(desc)

        layout.addSpacing(16)

        # Barra de busqueda grande
        search_frame = QFrame()
        search_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 2px solid {self.theme.primary};
                border-radius: 12px;
            }}
        """)
        search_layout = QHBoxLayout(search_frame)
        search_layout.setContentsMargins(20, 16, 20, 16)

        search_icon = QLabel("\U0001F50D")
        search_icon.setStyleSheet("font-size: 24px;")
        search_layout.addWidget(search_icon)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Escanea codigo de barras o escribe nombre...")
        self.search_input.setMinimumHeight(50)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: transparent;
                border: none;
                font-size: 18px;
                color: {self.theme.text_primary};
            }}
        """)
        self.search_input.textChanged.connect(self._on_text_changed)
        self.search_input.returnPressed.connect(self._on_search)
        search_layout.addWidget(self.search_input, 1)

        layout.addWidget(search_frame)

        # Status
        self.status_label = QLabel("")
        self.status_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 13px;")
        layout.addWidget(self.status_label)

        # Area de resultado
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
        result_layout.setContentsMargins(24, 24, 24, 24)
        result_layout.setSpacing(12)

        # Nombre producto
        self.product_name_label = QLabel()
        self.product_name_label.setFont(QFont("Segoe UI", 22, QFont.Weight.Bold))
        self.product_name_label.setStyleSheet(f"color: {self.theme.text_primary};")
        self.product_name_label.setWordWrap(True)
        result_layout.addWidget(self.product_name_label)

        # SKU y codigo
        self.product_sku_label = QLabel()
        self.product_sku_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 14px;")
        result_layout.addWidget(self.product_sku_label)

        result_layout.addSpacing(16)

        # Precio grande
        price_row = QHBoxLayout()

        self.price_label = QLabel()
        self.price_label.setFont(QFont("Segoe UI", 48, QFont.Weight.Bold))
        self.price_label.setStyleSheet(f"color: {self.theme.primary};")
        price_row.addWidget(self.price_label)

        price_row.addStretch()

        # Badge de promocion
        self.promo_badge = QLabel("EN OFERTA")
        self.promo_badge.setStyleSheet(f"""
            QLabel {{
                background-color: {self.theme.error};
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
            }}
        """)
        self.promo_badge.hide()
        price_row.addWidget(self.promo_badge)

        result_layout.addLayout(price_row)

        # Stock
        self.stock_frame = QFrame()
        stock_layout = QHBoxLayout(self.stock_frame)
        stock_layout.setContentsMargins(0, 0, 0, 0)

        self.stock_label = QLabel()
        self.stock_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 16px;")
        stock_layout.addWidget(self.stock_label)

        stock_layout.addStretch()

        self.category_label = QLabel()
        self.category_label.setStyleSheet(f"""
            QLabel {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_secondary};
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
            }}
        """)
        stock_layout.addWidget(self.category_label)

        result_layout.addWidget(self.stock_frame)

        layout.addWidget(self.result_frame)

        # Spacer
        layout.addStretch()

        # Mensaje de ayuda
        self.help_label = QLabel("Escanea un codigo de barras o escribe para buscar")
        self.help_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.help_label.setStyleSheet(f"color: {self.theme.text_muted}; font-size: 16px;")
        layout.addWidget(self.help_label)

    def _on_text_changed(self, text: str) -> None:
        """Busqueda con debounce."""
        if self._debounce_timer:
            self._debounce_timer.stop()

        if len(text) >= 3:
            self._debounce_timer = QTimer()
            self._debounce_timer.setSingleShot(True)
            self._debounce_timer.timeout.connect(self._on_search)
            self._debounce_timer.start(300)

    def _on_search(self) -> None:
        """Ejecuta la busqueda."""
        query = self.search_input.text().strip().lower()
        if not query:
            self.result_frame.hide()
            self.help_label.show()
            self.status_label.setText("")
            return

        # Buscar en productos locales
        matches = []
        for p in self._products:
            if (query in (p.name or "").lower() or
                query in (p.sku or "").lower() or
                query in (p.barcode or "").lower()):
                matches.append(p)

        if matches:
            # Mostrar primer resultado (o exacto por barcode)
            product = matches[0]
            for p in matches:
                if p.barcode and p.barcode.lower() == query:
                    product = p
                    break

            self._show_product(product)
            self.status_label.setText(f"{len(matches)} producto(s) encontrado(s)")
            if len(matches) > 1:
                self.status_label.setText(f"{len(matches)} productos encontrados - Mostrando: {product.name}")
        else:
            self.result_frame.hide()
            self.help_label.show()
            self.status_label.setText("No se encontraron productos")

    def _show_product(self, product: Product) -> None:
        """Muestra un producto encontrado."""
        self.help_label.hide()
        self.result_frame.show()

        self.product_name_label.setText(product.name or "Sin nombre")

        sku_text = f"SKU: {product.sku or 'N/A'}"
        if product.barcode:
            sku_text += f"  |  Codigo: {product.barcode}"
        self.product_sku_label.setText(sku_text)

        # Precio
        price = product.price or Decimal("0")
        self.price_label.setText(f"${price:,.2f}")

        # Stock
        stock = product.stock or 0
        if stock > 10:
            self.stock_label.setText(f"Stock disponible: {stock} unidades")
            self.stock_label.setStyleSheet(f"color: {self.theme.success}; font-size: 16px;")
        elif stock > 0:
            self.stock_label.setText(f"Stock bajo: {stock} unidades")
            self.stock_label.setStyleSheet(f"color: {self.theme.warning}; font-size: 16px;")
        else:
            self.stock_label.setText("Sin stock")
            self.stock_label.setStyleSheet(f"color: {self.theme.error}; font-size: 16px;")

        # Categoria
        if product.category_name:
            self.category_label.setText(product.category_name)
            self.category_label.show()
        else:
            self.category_label.hide()

        # Promocion (si tiene precio especial)
        if hasattr(product, 'special_price') and product.special_price:
            self.promo_badge.show()
        else:
            self.promo_badge.hide()

    def set_products(self, products: List[Product]) -> None:
        """Establece la lista de productos para buscar."""
        self._products = products
        logger.debug(f"ProductLookupView: {len(products)} productos cargados")

    def focus_search(self) -> None:
        """Da foco al campo de busqueda."""
        self.search_input.setFocus()
        self.search_input.selectAll()
