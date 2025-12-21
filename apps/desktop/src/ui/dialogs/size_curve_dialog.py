"""
Dialogo de seleccion de curva de talles.

Muestra una matriz de talle x color para productos variables,
permitiendo al usuario seleccionar una variante.
"""

from typing import Optional, Dict, List, Any
from dataclasses import dataclass

from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QGridLayout,
    QFrame,
    QScrollArea,
    QWidget,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles import get_theme


@dataclass
class VariantSelection:
    """Resultado de la seleccion de variante."""

    variant_id: str
    parent_id: str
    parent_name: str
    size: str
    color: str
    sku: Optional[str]
    barcode: Optional[str]
    stock: int
    price: float


class SizeCurveDialog(QDialog):
    """
    Dialogo para seleccionar variante de un producto con curva de talles.

    Muestra una matriz interactiva de talle x color con indicadores
    visuales de stock.
    """

    def __init__(
        self,
        parent_product: Dict[str, Any],
        size_curve_data: Dict[str, Any],
        parent: Optional[QWidget] = None,
    ):
        """
        Inicializa el dialogo.

        Args:
            parent_product: Datos del producto padre
            size_curve_data: Datos de la curva de talles desde la API
            parent: Widget padre
        """
        super().__init__(parent)
        self.theme = get_theme()
        self.parent_product = parent_product
        self.size_curve = size_curve_data
        self.selected_variant: Optional[VariantSelection] = None

        self._setup_ui()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setWindowTitle("Seleccionar Talle y Color")
        self.setModal(True)
        self.setMinimumSize(500, 400)

        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(20, 20, 20, 20)

        # Header con nombre del producto
        header = self._create_header()
        layout.addWidget(header)

        # Matriz de seleccion
        matrix = self._create_matrix()
        layout.addWidget(matrix, 1)

        # Leyenda
        legend = self._create_legend()
        layout.addWidget(legend)

        # Botones
        buttons = self._create_buttons()
        layout.addWidget(buttons)

        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

    def _create_header(self) -> QWidget:
        """Crea el header con info del producto."""
        frame = QFrame()
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        # Nombre del producto
        name = self.size_curve.get("parent", {}).get("name", self.parent_product.get("name", ""))
        name_label = QLabel(name)
        name_label.setFont(QFont(self.theme.font_family, 14, QFont.Weight.Bold))
        name_label.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(name_label)

        # SKU
        sku = self.size_curve.get("parent", {}).get("sku", "")
        if sku:
            sku_label = QLabel(f"SKU: {sku}")
            sku_label.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
            layout.addWidget(sku_label)

        # Totales
        totals = self.size_curve.get("totals", {})
        total_stock = totals.get("total", 0)
        total_label = QLabel(f"Stock total: {total_stock} unidades")
        total_label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 12px;")
        layout.addWidget(total_label)

        return frame

    def _create_matrix(self) -> QWidget:
        """Crea la matriz de seleccion de talle x color."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        container = QWidget()
        grid = QGridLayout(container)
        grid.setSpacing(4)

        sizes = self.size_curve.get("sizes", [])
        colors = self.size_curve.get("colors", [])
        matrix = self.size_curve.get("matrix", {})
        variants = self.size_curve.get("variants", [])

        if not sizes or not colors:
            # Sin variantes
            no_data = QLabel("No hay variantes disponibles")
            no_data.setAlignment(Qt.AlignmentFlag.AlignCenter)
            no_data.setStyleSheet(f"color: {self.theme.gray_500};")
            grid.addWidget(no_data, 0, 0)
            scroll.setWidget(container)
            return scroll

        # Header de colores
        grid.addWidget(QLabel(""), 0, 0)  # Esquina vacia
        for col_idx, color in enumerate(colors):
            color_label = QLabel(color)
            color_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            color_label.setStyleSheet(f"""
                font-weight: 600;
                color: {self.theme.text_primary};
                padding: 8px;
            """)
            grid.addWidget(color_label, 0, col_idx + 1)

        # Filas de talles
        for row_idx, size in enumerate(sizes):
            # Label de talle
            size_label = QLabel(size)
            size_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            size_label.setStyleSheet(f"""
                font-weight: 600;
                color: {self.theme.text_primary};
                padding: 8px;
                min-width: 50px;
            """)
            grid.addWidget(size_label, row_idx + 1, 0)

            # Celdas de la matriz
            for col_idx, color in enumerate(colors):
                key = f"{size}-{color}"
                cell_data = matrix.get(key, {})
                stock = cell_data.get("available", cell_data.get("stock", 0))
                variant_id = cell_data.get("variantId")

                cell = self._create_cell(
                    variant_id=variant_id,
                    size=size,
                    color=color,
                    stock=stock,
                    cell_data=cell_data,
                )
                grid.addWidget(cell, row_idx + 1, col_idx + 1)

        scroll.setWidget(container)
        return scroll

    def _create_cell(
        self,
        variant_id: Optional[str],
        size: str,
        color: str,
        stock: int,
        cell_data: Dict[str, Any],
    ) -> QPushButton:
        """Crea una celda de la matriz."""
        btn = QPushButton(str(stock) if stock > 0 else "-")
        btn.setFixedSize(60, 40)

        # Determinar color segun stock
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
                border-radius: 4px;
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

        if enabled and variant_id:
            btn.clicked.connect(
                lambda checked, vid=variant_id, s=size, c=color, st=stock, cd=cell_data:
                self._on_variant_selected(vid, s, c, st, cd)
            )

        # Tooltip
        sku = cell_data.get("sku", "")
        barcode = cell_data.get("barcode", "")
        tooltip = f"Talle: {size}\nColor: {color}\nStock: {stock}"
        if sku:
            tooltip += f"\nSKU: {sku}"
        if barcode:
            tooltip += f"\nCodigo: {barcode}"
        btn.setToolTip(tooltip)

        return btn

    def _create_legend(self) -> QWidget:
        """Crea la leyenda de colores."""
        frame = QFrame()
        layout = QHBoxLayout(frame)
        layout.setSpacing(16)

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
        box.setFixedSize(16, 16)
        box.setStyleSheet(f"background-color: {color}; border-radius: 3px;")
        layout.addWidget(box)

        # Texto
        label = QLabel(text)
        label.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 11px;")
        layout.addWidget(label)

        return widget

    def _create_buttons(self) -> QWidget:
        """Crea los botones de accion."""
        frame = QFrame()
        layout = QHBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)

        layout.addStretch()

        # Cancelar
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
        layout.addWidget(cancel_btn)

        return frame

    def _on_variant_selected(
        self,
        variant_id: str,
        size: str,
        color: str,
        stock: int,
        cell_data: Dict[str, Any],
    ) -> None:
        """Maneja la seleccion de una variante."""
        parent_name = self.size_curve.get("parent", {}).get("name", "")
        parent_id = self.parent_product.get("id", "")
        # Usar precio de la variante (cell_data) o del padre como fallback
        price = cell_data.get("price") or self.size_curve.get("parent", {}).get("basePrice") or self.parent_product.get("price", 0)

        self.selected_variant = VariantSelection(
            variant_id=variant_id,
            parent_id=parent_id,
            parent_name=parent_name,
            size=size,
            color=color,
            sku=cell_data.get("sku"),
            barcode=cell_data.get("barcode"),
            stock=stock,
            price=price,
        )

        logger.info(f"Variante seleccionada: {size} {color} (id={variant_id})")
        self.accept()

    def get_selected_variant(self) -> Optional[VariantSelection]:
        """Retorna la variante seleccionada."""
        return self.selected_variant
