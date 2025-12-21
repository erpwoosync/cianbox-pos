"""
Dialogo de consulta de productos.

Permite buscar productos por codigo de barras, SKU o nombre
y ver informacion detallada del producto.
"""

from typing import Optional

from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLineEdit,
    QLabel,
    QPushButton,
    QFrame,
    QScrollArea,
    QWidget,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QAbstractItemView,
    QMessageBox,
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont
from loguru import logger

from src.models import Product


class ProductLookupDialog(QDialog):
    """
    Dialogo para consultar y buscar productos.

    Permite:
    - Buscar por codigo de barras, SKU o nombre
    - Ver detalles del producto (precio, stock, promociones)
    - Agregar producto al carrito
    """

    def __init__(self, sync_service, theme, parent=None):
        super().__init__(parent)

        self.sync_service = sync_service
        self.theme = theme
        self.selected_product: Optional[Product] = None
        self._search_timer: Optional[QTimer] = None

        self._setup_ui()
        self._load_initial_products()

    def _setup_ui(self) -> None:
        """Configura la interfaz del dialogo."""
        self.setWindowTitle("Consulta de Productos")
        self.setMinimumSize(900, 600)
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Header con titulo y buscador
        header = self._create_header()
        layout.addWidget(header)

        # Contenido principal (tabla + detalle)
        content = self._create_content()
        layout.addWidget(content, 1)

        # Footer con botones
        footer = self._create_footer()
        layout.addWidget(footer)

    def _create_header(self) -> QFrame:
        """Crea el header con buscador."""
        header = QFrame()
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QHBoxLayout(header)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(16)

        # Titulo
        title = QLabel("Consulta de Productos")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        layout.addWidget(title)

        layout.addStretch()

        # Campo de busqueda
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Buscar por codigo, SKU o nombre...")
        self.search_input.setFixedSize(400, 40)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 0 12px;
                font-size: 13px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        self.search_input.textChanged.connect(self._on_search_changed)
        self.search_input.returnPressed.connect(self._on_search)
        layout.addWidget(self.search_input)

        # Boton buscar
        search_btn = QPushButton("Buscar")
        search_btn.setFixedSize(80, 40)
        search_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        search_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        search_btn.clicked.connect(self._on_search)
        layout.addWidget(search_btn)

        return header

    def _create_content(self) -> QWidget:
        """Crea el contenido principal."""
        content = QWidget()
        layout = QHBoxLayout(content)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(16)

        # Tabla de productos
        table_container = self._create_table()
        layout.addWidget(table_container, 2)

        # Panel de detalle
        detail_panel = self._create_detail_panel()
        layout.addWidget(detail_panel, 1)

        return content

    def _create_table(self) -> QFrame:
        """Crea la tabla de productos."""
        container = QFrame()
        container.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)

        # Tabla
        self.products_table = QTableWidget()
        self.products_table.setColumnCount(5)
        self.products_table.setHorizontalHeaderLabels([
            "Codigo", "Nombre", "Categoria", "Stock", "Precio"
        ])
        self.products_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        self.products_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.products_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.products_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.products_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.products_table.setColumnWidth(0, 120)
        self.products_table.setColumnWidth(2, 120)
        self.products_table.setColumnWidth(3, 80)
        self.products_table.setColumnWidth(4, 100)

        self.products_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.products_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.products_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.products_table.verticalHeader().setVisible(False)
        self.products_table.setAlternatingRowColors(True)

        self.products_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {self.theme.surface};
                border: none;
                gridline-color: {self.theme.border_light};
                font-size: 12px;
            }}
            QTableWidget::item {{
                padding: 8px;
                border-bottom: 1px solid {self.theme.border_light};
            }}
            QTableWidget::item:selected {{
                background-color: {self.theme.primary_bg};
                color: {self.theme.text_primary};
            }}
            QHeaderView::section {{
                background-color: {self.theme.gray_100};
                color: {self.theme.gray_600};
                font-weight: 600;
                font-size: 11px;
                padding: 10px 8px;
                border: none;
                border-bottom: 2px solid {self.theme.border};
            }}
        """)

        self.products_table.itemSelectionChanged.connect(self._on_product_selected)
        self.products_table.doubleClicked.connect(self._on_product_double_clicked)

        layout.addWidget(self.products_table)
        return container

    def _create_detail_panel(self) -> QFrame:
        """Crea el panel de detalle del producto."""
        panel = QFrame()
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Titulo
        title = QLabel("Detalle del Producto")
        title.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Contenedor de detalle
        self.detail_container = QWidget()
        self.detail_layout = QVBoxLayout(self.detail_container)
        self.detail_layout.setContentsMargins(0, 0, 0, 0)
        self.detail_layout.setSpacing(8)

        # Mensaje inicial
        no_selection = QLabel("Selecciona un producto\npara ver los detalles")
        no_selection.setAlignment(Qt.AlignmentFlag.AlignCenter)
        no_selection.setStyleSheet(f"color: {self.theme.gray_400}; font-size: 13px;")
        self.detail_layout.addWidget(no_selection)

        layout.addWidget(self.detail_container, 1)

        return panel

    def _create_footer(self) -> QFrame:
        """Crea el footer con botones."""
        footer = QFrame()
        layout = QHBoxLayout(footer)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Contador de resultados
        self.results_label = QLabel("0 productos encontrados")
        self.results_label.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        layout.addWidget(self.results_label)

        layout.addStretch()

        # Boton agregar al carrito
        self.add_btn = QPushButton("Agregar al Carrito")
        self.add_btn.setFixedSize(160, 40)
        self.add_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.add_btn.setEnabled(False)
        self.add_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
            }}
        """)
        self.add_btn.clicked.connect(self._on_add_to_cart)
        layout.addWidget(self.add_btn)

        # Boton cerrar
        close_btn = QPushButton("Cerrar")
        close_btn.setFixedSize(100, 40)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.gray_700};
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        close_btn.clicked.connect(self.reject)
        layout.addWidget(close_btn)

        return footer

    def _load_initial_products(self) -> None:
        """Carga productos iniciales."""
        try:
            products = self.sync_service.get_local_products(limit=50)
            self._update_table(products)
            self.search_input.setFocus()
        except Exception as e:
            logger.error(f"Error cargando productos: {e}")
            self.results_label.setText(f"Error: {e}")

    def _on_search_changed(self, text: str) -> None:
        """Maneja cambios en el texto de busqueda (con debounce)."""
        if self._search_timer:
            self._search_timer.stop()

        self._search_timer = QTimer()
        self._search_timer.setSingleShot(True)
        self._search_timer.timeout.connect(self._on_search)
        self._search_timer.start(300)

    def _on_search(self) -> None:
        """Ejecuta la busqueda."""
        try:
            query = self.search_input.text().strip()

            if query:
                products = self.sync_service.get_local_products(search=query, limit=100)
            else:
                products = self.sync_service.get_local_products(limit=50)

            self._update_table(products)
        except Exception as e:
            logger.error(f"Error en busqueda: {e}")
            self.results_label.setText(f"Error: {e}")

    def _update_table(self, products: list) -> None:
        """Actualiza la tabla con los productos."""
        self.products_table.setRowCount(len(products))

        # Cargar categorias una sola vez para mapear
        category_map = {}
        try:
            categories = self.sync_service.get_local_categories()
            category_map = {cat.id: cat.name for cat in categories}
        except Exception:
            pass

        for row, product in enumerate(products):
            # Codigo
            code = product.barcode or product.sku or product.internal_code or "-"
            code_item = QTableWidgetItem(code)
            self.products_table.setItem(row, 0, code_item)

            # Nombre
            name_item = QTableWidgetItem(product.name)
            self.products_table.setItem(row, 1, name_item)

            # Categoria
            category_name = category_map.get(product.category_id, "-") if product.category_id else "-"
            cat_item = QTableWidgetItem(category_name)
            self.products_table.setItem(row, 2, cat_item)

            # Stock
            stock = product.current_stock or 0
            stock_item = QTableWidgetItem(str(stock))
            stock_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.products_table.setItem(row, 3, stock_item)

            # Precio
            price = float(product.base_price) if product.base_price else 0.0
            price_item = QTableWidgetItem(f"${price:,.2f}")
            price_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.products_table.setItem(row, 4, price_item)

            # Guardar referencia al producto
            code_item.setData(Qt.ItemDataRole.UserRole, product)

        self.results_label.setText(f"{len(products)} productos encontrados")
        self.selected_product = None
        self.add_btn.setEnabled(False)

    def _on_product_selected(self) -> None:
        """Maneja la seleccion de un producto."""
        selected = self.products_table.selectedItems()
        if not selected:
            return

        row = selected[0].row()
        product = self.products_table.item(row, 0).data(Qt.ItemDataRole.UserRole)

        if product:
            self.selected_product = product
            self.add_btn.setEnabled(True)
            self._show_product_detail(product)

    def _show_product_detail(self, product: Product) -> None:
        """Muestra los detalles del producto."""
        # Limpiar contenedor
        while self.detail_layout.count():
            item = self.detail_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        # Nombre
        name = QLabel(product.name)
        name.setWordWrap(True)
        name.setFont(QFont("Segoe UI", 13, QFont.Weight.Bold))
        name.setStyleSheet(f"color: {self.theme.text_primary};")
        self.detail_layout.addWidget(name)

        # Mostrar talle y color si es variante
        if product.size or product.color:
            variant_parts = []
            if product.size:
                variant_parts.append(f"Talle: {product.size}")
            if product.color:
                variant_parts.append(f"Color: {product.color}")
            variant_text = " | ".join(variant_parts)
            variant_label = QLabel(variant_text)
            variant_label.setStyleSheet(f"color: {self.theme.primary}; font-weight: 600; font-size: 12px;")
            self.detail_layout.addWidget(variant_label)

        # Codigo
        code = product.barcode or product.sku or product.internal_code or "-"
        self._add_detail_row("Codigo:", code)

        # SKU
        if product.sku:
            self._add_detail_row("SKU:", product.sku)

        # Codigo de barras
        if product.barcode:
            self._add_detail_row("Codigo de barras:", product.barcode)

        # Precio
        price = float(product.base_price) if product.base_price else 0.0
        price_label = QLabel(f"${price:,.2f}")
        price_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        price_label.setStyleSheet(f"color: {self.theme.primary};")
        self.detail_layout.addWidget(price_label)

        # Stock
        stock = product.current_stock or 0
        stock_color = self.theme.success if stock > 10 else (self.theme.warning if stock > 0 else self.theme.danger)
        stock_label = QLabel(f"Stock: {stock} unidades")
        stock_label.setStyleSheet(f"color: {stock_color}; font-weight: 600;")
        self.detail_layout.addWidget(stock_label)

        # Si es producto padre, mostrar tabla de variantes
        if product.is_parent:
            self._show_variants_table(product)

        # Promocion
        promo = self.sync_service.get_promotion_for_product(
            product.id, product.category_id, product.brand_id
        )
        if promo:
            promo_frame = QFrame()
            promo_color = promo.badge_color or "#22C55E"
            promo_frame.setStyleSheet(f"""
                QFrame {{
                    background-color: {promo_color}20;
                    border: 1px solid {promo_color};
                    border-radius: 6px;
                    padding: 8px;
                }}
            """)
            promo_layout = QVBoxLayout(promo_frame)
            promo_layout.setContentsMargins(12, 8, 12, 8)

            promo_title = QLabel(f"PROMOCION: {promo.name}")
            promo_title.setStyleSheet(f"color: {promo_color}; font-weight: 700; font-size: 12px;")
            promo_layout.addWidget(promo_title)

            promo_desc = QLabel(promo.get_badge_text())
            promo_desc.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 11px;")
            promo_layout.addWidget(promo_desc)

            self.detail_layout.addWidget(promo_frame)

        self.detail_layout.addStretch()

    def _show_variants_table(self, parent_product: Product) -> None:
        """Muestra la tabla de variantes del producto padre."""
        try:
            # Obtener curva de talles desde la API
            size_curve = self.sync_service.get_size_curve(parent_product.id)

            if not size_curve or not size_curve.get("variants"):
                return

            # Titulo de seccion
            variants_title = QLabel("Variantes disponibles:")
            variants_title.setStyleSheet(f"color: {self.theme.gray_600}; font-weight: 600; font-size: 12px; margin-top: 8px;")
            self.detail_layout.addWidget(variants_title)

            # Crear tabla de variantes
            variants = size_curve.get("variants", [])
            matrix = size_curve.get("matrix", {})

            variants_table = QTableWidget()
            variants_table.setColumnCount(3)
            variants_table.setHorizontalHeaderLabels(["Talle", "Color", "Stock"])
            variants_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
            variants_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
            variants_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
            variants_table.setColumnWidth(2, 60)
            variants_table.verticalHeader().setVisible(False)
            variants_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
            variants_table.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
            variants_table.setMaximumHeight(150)

            variants_table.setStyleSheet(f"""
                QTableWidget {{
                    background-color: {self.theme.gray_50};
                    border: 1px solid {self.theme.border};
                    border-radius: 4px;
                    font-size: 11px;
                }}
                QTableWidget::item {{
                    padding: 4px;
                }}
                QHeaderView::section {{
                    background-color: {self.theme.gray_100};
                    color: {self.theme.gray_600};
                    font-weight: 600;
                    font-size: 10px;
                    padding: 6px;
                    border: none;
                }}
            """)

            # Llenar tabla con variantes que tienen stock
            variants_with_stock = []
            for variant in variants:
                size = variant.get("size", "-")
                color = variant.get("color", "-")
                stock = variant.get("stock", 0)
                if stock > 0:
                    variants_with_stock.append((size, color, stock))

            # Si no hay variantes con stock, mostrar todas
            if not variants_with_stock:
                for variant in variants:
                    size = variant.get("size", "-")
                    color = variant.get("color", "-")
                    stock = variant.get("stock", 0)
                    variants_with_stock.append((size, color, stock))

            variants_table.setRowCount(len(variants_with_stock))
            total_stock = 0

            for row, (size, color, stock) in enumerate(variants_with_stock):
                # Talle
                size_item = QTableWidgetItem(str(size) if size else "-")
                size_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                variants_table.setItem(row, 0, size_item)

                # Color
                color_item = QTableWidgetItem(str(color) if color else "-")
                color_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                variants_table.setItem(row, 1, color_item)

                # Stock
                stock_item = QTableWidgetItem(str(stock))
                stock_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                if stock > 0:
                    stock_item.setForeground(Qt.GlobalColor.darkGreen)
                else:
                    stock_item.setForeground(Qt.GlobalColor.red)
                variants_table.setItem(row, 2, stock_item)
                total_stock += stock

            self.detail_layout.addWidget(variants_table)

            # Resumen de stock total
            total_label = QLabel(f"Stock total: {total_stock} unidades")
            total_color = self.theme.success if total_stock > 0 else self.theme.danger
            total_label.setStyleSheet(f"color: {total_color}; font-weight: 600; font-size: 11px;")
            self.detail_layout.addWidget(total_label)

        except Exception as e:
            logger.error(f"Error cargando variantes: {e}")

    def _add_detail_row(self, label: str, value: str) -> None:
        """Agrega una fila de detalle."""
        row = QHBoxLayout()
        row.setSpacing(8)

        lbl = QLabel(label)
        lbl.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        lbl.setFixedWidth(120)
        row.addWidget(lbl)

        val = QLabel(value)
        val.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 12px;")
        row.addWidget(val, 1)

        container = QWidget()
        container.setLayout(row)
        self.detail_layout.addWidget(container)

    def _on_product_double_clicked(self) -> None:
        """Maneja doble click en un producto."""
        if self.selected_product:
            self._on_add_to_cart()

    def _on_add_to_cart(self) -> None:
        """Agrega el producto seleccionado al carrito."""
        if self.selected_product:
            self.accept()
