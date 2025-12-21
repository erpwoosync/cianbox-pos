"""
Dialogo selector de variantes (talles).

Muestra un grid de talles disponibles para productos variables,
permitiendo seleccionar rapidamente una variante.
"""

from typing import Optional, Dict, List, Any

from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QGridLayout,
    QFrame,
    QWidget,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles import get_theme


class VariantSelectorDialog(QDialog):
    """
    Dialogo para seleccionar variante (talle) de un producto.

    Muestra un grid de talles con stock, similar a la UX especificada.
    """

    def __init__(
        self,
        product_name: str,
        variants: List[Dict[str, Any]],
        clicked_variant: Dict[str, Any],
        parent: Optional[QWidget] = None,
    ):
        """
        Inicializa el dialogo.

        Args:
            product_name: Nombre del producto
            variants: Lista de variantes con datos (id, size, color, stock)
            clicked_variant: Variante que se clickeo originalmente
            parent: Widget padre
        """
        super().__init__(parent)
        self.theme = get_theme()
        self.product_name = product_name
        self.variants = variants
        self.clicked_variant = clicked_variant
        self.selected_variant: Optional[Dict[str, Any]] = None

        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setWindowTitle("Seleccionar Talle")
        self.setModal(True)
        self.setMinimumWidth(400)

        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(20, 20, 20, 20)

        # Header con nombre del producto
        header = self._create_header()
        layout.addWidget(header)

        # Grid de talles
        grid_widget = self._create_size_grid()
        layout.addWidget(grid_widget)

        # Leyenda
        legend = self._create_legend()
        layout.addWidget(legend)

        # Boton cancelar
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 4px;
                padding: 10px 24px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        cancel_btn.clicked.connect(self.reject)
        layout.addWidget(cancel_btn, alignment=Qt.AlignmentFlag.AlignRight)

        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

    def _create_header(self) -> QWidget:
        """Crea el header con info del producto."""
        frame = QFrame()
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 8)
        layout.setSpacing(4)

        # Nombre del producto (sin talle/color)
        base_name = self.product_name.split(" - ")[0] if " - " in self.product_name else self.product_name
        name_label = QLabel(base_name)
        name_label.setFont(QFont(self.theme.font_family, 14, QFont.Weight.Bold))
        name_label.setStyleSheet(f"color: {self.theme.text_primary};")
        name_label.setWordWrap(True)
        layout.addWidget(name_label)

        # Precio
        price = self.clicked_variant.get("price", 0)
        price_label = QLabel(f"${price:,.0f}")
        price_label.setStyleSheet(f"color: {self.theme.primary}; font-size: 16px; font-weight: 600;")
        layout.addWidget(price_label)

        # Instruccion
        hint = QLabel("Seleccione el talle:")
        hint.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 12px; margin-top: 8px;")
        layout.addWidget(hint)

        return frame

    def _create_size_grid(self) -> QWidget:
        """Crea el grid de botones de talle."""
        container = QWidget()
        grid = QGridLayout(container)
        grid.setSpacing(8)

        # Agrupar por talle (puede haber multiples colores por talle)
        sizes_data: Dict[str, Dict[str, Any]] = {}
        for v in self.variants:
            size = v.get("size") or "U"
            if size not in sizes_data:
                sizes_data[size] = {
                    "total_stock": 0,
                    "variants": [],
                }
            sizes_data[size]["total_stock"] += v.get("stock", 0)
            sizes_data[size]["variants"].append(v)

        # Ordenar talles (numerico si es posible, sino alfabetico)
        def sort_key(s):
            try:
                return (0, float(s))
            except ValueError:
                # Orden para talles de letra
                order = {"XXS": 1, "XS": 2, "S": 3, "M": 4, "L": 5, "XL": 6, "XXL": 7, "XXXL": 8}
                return (1, order.get(s.upper(), 100), s)

        sorted_sizes = sorted(sizes_data.keys(), key=sort_key)

        # Crear botones en grid (5 columnas)
        cols = 5
        for idx, size in enumerate(sorted_sizes):
            data = sizes_data[size]
            stock = data["total_stock"]
            variants_for_size = data["variants"]

            row = idx // cols
            col = idx % cols

            btn = self._create_size_button(size, stock, variants_for_size)
            grid.addWidget(btn, row, col)

        return container

    def _create_size_button(
        self,
        size: str,
        stock: int,
        variants: List[Dict[str, Any]],
    ) -> QPushButton:
        """Crea un boton de talle."""
        btn = QPushButton()
        btn.setFixedSize(70, 50)

        # Texto: talle + stock
        btn.setText(f"{size}\n{stock}u")

        # Colores segun stock
        if stock >= 5:
            bg_color = self.theme.success
            text_color = "#FFFFFF"
            enabled = True
        elif stock > 0:
            bg_color = self.theme.warning
            text_color = "#000000"
            enabled = True
        else:
            bg_color = self.theme.gray_200
            text_color = self.theme.gray_500
            enabled = False

        btn.setEnabled(enabled)
        btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {bg_color};
                color: {text_color};
                border: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 13px;
            }}
            QPushButton:hover:enabled {{
                background-color: {self.theme.primary};
                color: white;
            }}
            QPushButton:pressed {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_200};
                color: {self.theme.gray_400};
            }}
        """)

        if enabled:
            # Si hay un solo color, seleccionar directamente
            # Si hay multiples colores, seleccionar el primero con stock
            def on_click(checked=False, v=variants):
                # Buscar variante con stock
                for variant in v:
                    if variant.get("stock", 0) > 0:
                        self.selected_variant = variant
                        break
                if not self.selected_variant and v:
                    self.selected_variant = v[0]
                logger.info(f"Talle seleccionado: {size}")
                self.accept()

            btn.clicked.connect(on_click)

        # Tooltip
        tooltip = f"Talle: {size}\nStock: {stock}"
        if len(variants) > 1:
            colors = ", ".join(set(v.get("color", "") for v in variants if v.get("color")))
            if colors:
                tooltip += f"\nColores: {colors}"
        btn.setToolTip(tooltip)

        return btn

    def _create_legend(self) -> QWidget:
        """Crea la leyenda de colores."""
        frame = QFrame()
        layout = QHBoxLayout(frame)
        layout.setSpacing(16)
        layout.setContentsMargins(0, 8, 0, 0)

        # Stock alto
        high = self._create_legend_item(self.theme.success, "Stock >= 5")
        layout.addWidget(high)

        # Stock bajo
        low = self._create_legend_item(self.theme.warning, "Stock 1-4")
        layout.addWidget(low)

        # Sin stock
        zero = self._create_legend_item(self.theme.gray_200, "Sin stock")
        layout.addWidget(zero)

        layout.addStretch()

        return frame

    def _create_legend_item(self, color: str, text: str) -> QWidget:
        """Crea un item de leyenda."""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        # Cuadro de color
        box = QLabel()
        box.setFixedSize(14, 14)
        box.setStyleSheet(f"background-color: {color}; border-radius: 3px;")
        layout.addWidget(box)

        # Texto
        label = QLabel(text)
        label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 11px;")
        layout.addWidget(label)

        return widget

    def get_selected_variant(self) -> Optional[Dict[str, Any]]:
        """Retorna la variante seleccionada."""
        return self.selected_variant
