"""
Dialog de detalle de venta para devoluciones.

Muestra todos los items de una venta y permite seleccionar cuales devolver.
"""

from typing import Optional, Dict, List
from decimal import Decimal

from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QAbstractItemView,
    QSpinBox,
    QMessageBox,
    QWidget,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles import get_theme


class SaleDetailDialog(QDialog):
    """Dialog para ver detalle de venta y procesar devoluciones."""

    def __init__(self, sale: Dict, refund_filter: str = "", parent=None):
        super().__init__(parent)
        self.sale = sale
        self.theme = get_theme()
        self._refund_items: List[Dict] = []
        self._spinners: Dict[str, QSpinBox] = {}  # item_id -> spinner

        self.setWindowTitle(f"Venta #{sale.get('saleNumber', 'N/A')}")
        self.setModal(True)
        self.setMinimumSize(750, 500)
        self.resize(850, 550)

        self._setup_ui()
        self._populate_items()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header con info de la venta
        header = QFrame()
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(16, 16, 16, 16)

        # Info izquierda
        left_info = QVBoxLayout()

        sale_num = QLabel(f"Venta #{self.sale.get('saleNumber', 'N/A')}")
        sale_num.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        sale_num.setStyleSheet(f"color: {self.theme.text_primary};")
        left_info.addWidget(sale_num)

        date_str = self.sale.get("saleDate", "")[:10]
        date_label = QLabel(f"Fecha: {date_str}")
        date_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        left_info.addWidget(date_label)

        customer = self.sale.get("customer")
        customer_name = customer.get("name") if customer else "Consumidor Final"
        customer_label = QLabel(f"Cliente: {customer_name}")
        customer_label.setStyleSheet(f"color: {self.theme.text_secondary};")
        left_info.addWidget(customer_label)

        header_layout.addLayout(left_info)
        header_layout.addStretch()

        # Total
        total = Decimal(str(self.sale.get("total", 0)))
        total_label = QLabel(f"${total:,.2f}")
        total_label.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        total_label.setStyleSheet(f"color: {self.theme.primary};")
        header_layout.addWidget(total_label)

        layout.addWidget(header)

        # Titulo items
        items_title = QLabel("Items de la venta")
        items_title.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        items_title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(items_title)

        # Tabla de items
        self.items_table = QTableWidget()
        self.items_table.setColumnCount(6)
        self.items_table.setHorizontalHeaderLabels([
            "Producto", "Cant.", "Precio", "Subtotal", "Devolver", ""
        ])
        self.items_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.items_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.items_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.items_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.items_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.items_table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)
        self.items_table.setColumnWidth(1, 100)
        self.items_table.setColumnWidth(2, 100)
        self.items_table.setColumnWidth(3, 100)
        self.items_table.setColumnWidth(4, 70)
        self.items_table.setColumnWidth(5, 90)
        self.items_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.items_table.setAlternatingRowColors(True)
        self.items_table.verticalHeader().setVisible(False)
        self.items_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
            QTableWidget::item {{
                padding: 8px;
            }}
            QHeaderView::section {{
                background-color: {self.theme.gray_100};
                padding: 10px;
                border: none;
                font-weight: 600;
            }}
        """)
        layout.addWidget(self.items_table, 1)

        # Botones
        buttons = QHBoxLayout()
        buttons.addStretch()

        cancel_btn = QPushButton("Cerrar")
        cancel_btn.setMinimumHeight(40)
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 6px;
                padding: 0 24px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        cancel_btn.clicked.connect(self.reject)
        buttons.addWidget(cancel_btn)

        layout.addLayout(buttons)

    def _populate_items(self) -> None:
        """Llena la tabla con los items de la venta."""
        items = self.sale.get("items", [])
        self.items_table.setRowCount(len(items))

        for row, item in enumerate(items):
            item_id = item.get("id", str(row))

            # Producto
            name = item.get("productName", item.get("product", {}).get("name", ""))
            self.items_table.setItem(row, 0, QTableWidgetItem(name))

            # Cantidad comprada
            qty = int(item.get("quantity", 0))
            refunded = int(item.get("refundedQuantity", 0))
            available = int(item.get("availableQuantity", qty - refunded))
            qty_text = f"{qty}"
            if refunded > 0:
                qty_text += f" (dev: {refunded})"
            self.items_table.setItem(row, 1, QTableWidgetItem(qty_text))

            # Precio unitario
            price = Decimal(str(item.get("unitPrice", 0)))
            self.items_table.setItem(row, 2, QTableWidgetItem(f"${price:,.2f}"))

            # Subtotal
            subtotal = Decimal(str(item.get("subtotal", 0)))
            self.items_table.setItem(row, 3, QTableWidgetItem(f"${subtotal:,.2f}"))

            # Columna Devolver - solo si matchesSearch y available > 0
            matches_search = item.get("matchesSearch", False)

            if available > 0 and matches_search:
                # Spinner para cantidad a devolver
                spinner = QSpinBox()
                spinner.setMinimum(1)
                spinner.setMaximum(available)
                spinner.setValue(1)
                spinner.setMinimumHeight(32)
                spinner.setStyleSheet(f"""
                    QSpinBox {{
                        background-color: {self.theme.background};
                        border: 1px solid {self.theme.border};
                        border-radius: 4px;
                        padding: 4px 8px;
                        min-width: 60px;
                        min-height: 28px;
                        font-size: 14px;
                    }}
                    QSpinBox::up-button, QSpinBox::down-button {{
                        width: 20px;
                    }}
                """)
                self._spinners[item_id] = spinner
                self.items_table.setCellWidget(row, 4, spinner)

                # Botón confirmar devolución
                refund_btn = QPushButton("Devolver")
                refund_btn.setCursor(Qt.CursorShape.PointingHandCursor)
                refund_btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {self.theme.warning};
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 6px 10px;
                        font-size: 11px;
                    }}
                    QPushButton:hover {{
                        background-color: #d97706;
                    }}
                """)
                refund_btn.clicked.connect(lambda checked, i=item, iid=item_id: self._on_refund_item(i, iid))
                self.items_table.setCellWidget(row, 5, refund_btn)

            elif available <= 0:
                no_stock = QLabel("Devuelto")
                no_stock.setAlignment(Qt.AlignmentFlag.AlignCenter)
                no_stock.setStyleSheet(f"color: {self.theme.text_muted}; font-size: 11px;")
                self.items_table.setCellWidget(row, 4, no_stock)

    def _on_refund_item(self, item: Dict, item_id: str) -> None:
        """Maneja click en devolver item."""
        name = item.get("productName", "")

        # Obtener cantidad del spinner
        spinner = self._spinners.get(item_id)
        if not spinner:
            return

        qty_to_refund = spinner.value()

        reply = QMessageBox.question(
            self,
            "Confirmar Devolución",
            f"¿Devolver {qty_to_refund}x {name}?\n\n"
            f"Venta #{self.sale.get('saleNumber')}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            # TODO: Llamar a la API de devolucion
            QMessageBox.information(
                self,
                "Devolución",
                f"Devolución de {qty_to_refund}x {name}\n\n"
                "Funcionalidad en desarrollo."
            )

    def get_refund_items(self) -> List[Dict]:
        """Retorna los items a devolver."""
        return self._refund_items
