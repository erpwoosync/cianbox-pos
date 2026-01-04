"""
Vista de devoluciones.

Permite buscar ventas y procesar devoluciones de productos.
"""

from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime

from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QAbstractItemView,
    QMessageBox,
)
from PyQt6.QtCore import Qt, pyqtSignal, QThread
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles.theme import Theme
from src.services.sync_service import SyncService


class SearchWorker(QThread):
    """Worker para buscar ventas en background."""

    search_complete = pyqtSignal(list)
    search_error = pyqtSignal(str)

    def __init__(self, sync_service: SyncService, query: str):
        super().__init__()
        self.sync_service = sync_service
        self.query = query

    def run(self):
        try:
            result = self.sync_service.search_sales_by_product(self.query)
            if result.get("success"):
                sales = result.get("data", {}).get("sales", [])
                self.search_complete.emit(sales)
            else:
                self.search_error.emit(result.get("error", "Error buscando"))
        except Exception as e:
            logger.error(f"Error en SearchWorker: {e}")
            self.search_error.emit(str(e))


class RefundView(QWidget):
    """Vista para gestionar devoluciones de productos."""

    refund_completed = pyqtSignal(dict)

    def __init__(
        self,
        theme: Theme,
        sync_service: Optional[SyncService] = None,
        parent: Optional[QWidget] = None
    ):
        super().__init__(parent)
        self.theme = theme
        self.sync_service = sync_service
        self._sales: List[Dict] = []
        self._search_worker: Optional[SearchWorker] = None

        self._setup_ui()
        logger.debug("RefundView inicializado")

    def set_sync_service(self, sync_service: SyncService) -> None:
        """Establece el servicio de sincronizacion."""
        self.sync_service = sync_service

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header
        header = QHBoxLayout()

        title = QLabel("Devoluciones")
        title.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        header.addWidget(title)

        header.addStretch()

        # Badge de resultados
        self.results_badge = QLabel("")
        self.results_badge.setStyleSheet(f"""
            QLabel {{
                background-color: {self.theme.primary};
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-weight: 600;
            }}
        """)
        self.results_badge.hide()
        header.addWidget(self.results_badge)

        layout.addLayout(header)

        # Descripcion
        desc = QLabel("Busca por producto, ticket o cliente para procesar devolucion")
        desc.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 14px;")
        layout.addWidget(desc)

        layout.addSpacing(8)

        # Barra de busqueda
        search_frame = QFrame()
        search_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)
        search_layout = QHBoxLayout(search_frame)
        search_layout.setContentsMargins(16, 12, 16, 12)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Buscar por producto, ticket o cliente...")
        self.search_input.setMinimumHeight(40)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 0 12px;
                font-size: 14px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        self.search_input.returnPressed.connect(self._on_search)
        search_layout.addWidget(self.search_input, 1)

        self.search_btn = QPushButton("Buscar")
        self.search_btn.setMinimumHeight(40)
        self.search_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.search_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 0 24px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_400};
            }}
        """)
        self.search_btn.clicked.connect(self._on_search)
        search_layout.addWidget(self.search_btn)

        layout.addWidget(search_frame)

        # Status de busqueda
        self.status_label = QLabel("")
        self.status_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 13px;")
        layout.addWidget(self.status_label)

        # Tabla de resultados - muestra ventas
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(4)
        self.results_table.setHorizontalHeaderLabels([
            "Fecha", "Venta #", "Cliente", "Total"
        ])
        self.results_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        self.results_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.results_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.results_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.results_table.setColumnWidth(0, 100)
        self.results_table.setColumnWidth(1, 100)
        self.results_table.setColumnWidth(3, 120)
        self.results_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.results_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.results_table.setAlternatingRowColors(True)
        self.results_table.verticalHeader().setVisible(False)
        self.results_table.doubleClicked.connect(self._on_row_double_click)
        self.results_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                gridline-color: {self.theme.border};
            }}
            QTableWidget::item {{
                padding: 8px;
            }}
            QHeaderView::section {{
                background-color: {self.theme.gray_100};
                padding: 10px;
                border: none;
                border-bottom: 1px solid {self.theme.border};
                font-weight: 600;
            }}
        """)
        layout.addWidget(self.results_table, 1)

        # Botón Ver Detalle
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        self.detail_btn = QPushButton("Ver Detalle")
        self.detail_btn.setMinimumHeight(40)
        self.detail_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.detail_btn.setEnabled(False)
        self.detail_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 0 32px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_400};
            }}
        """)
        self.detail_btn.clicked.connect(self._on_detail_click)
        btn_layout.addWidget(self.detail_btn)

        layout.addLayout(btn_layout)

        # Habilitar botón cuando hay selección
        self.results_table.itemSelectionChanged.connect(self._on_selection_changed)

    def _on_search(self) -> None:
        """Ejecuta la busqueda."""
        query = self.search_input.text().strip()
        if not query:
            return

        if not self.sync_service:
            QMessageBox.warning(self, "Error", "Servicio no disponible")
            return

        # Deshabilitar mientras busca
        self.search_btn.setEnabled(False)
        self.search_btn.setText("Buscando...")
        self.status_label.setText("Buscando ventas...")
        self.results_badge.hide()

        # Buscar en background
        self._search_worker = SearchWorker(self.sync_service, query)
        self._search_worker.search_complete.connect(
            self._on_search_complete,
            Qt.ConnectionType.UniqueConnection
        )
        self._search_worker.search_error.connect(
            self._on_search_error,
            Qt.ConnectionType.UniqueConnection
        )
        self._search_worker.start()

    def _on_search_complete(self, sales: List[Dict]) -> None:
        """Maneja resultados de busqueda."""
        self.search_btn.setEnabled(True)
        self.search_btn.setText("Buscar")

        self._sales = sales
        self._populate_table(sales)

        count = len(sales)
        if count > 0:
            self.status_label.setText(f"Se encontraron {count} ventas")
            self.results_badge.setText(str(count))
            self.results_badge.show()
        else:
            self.status_label.setText("No se encontraron ventas")
            self.results_badge.hide()

    def _on_search_error(self, error: str) -> None:
        """Maneja error de busqueda."""
        self.search_btn.setEnabled(True)
        self.search_btn.setText("Buscar")
        self.status_label.setText(f"Error: {error}")
        logger.error(f"Error buscando ventas: {error}")

    def _on_selection_changed(self) -> None:
        """Habilita/deshabilita botón según selección."""
        has_selection = len(self.results_table.selectedItems()) > 0
        self.detail_btn.setEnabled(has_selection)

    def _on_detail_click(self) -> None:
        """Abre detalle de la fila seleccionada."""
        row = self.results_table.currentRow()
        if row >= 0 and row < len(self._sales):
            self._show_sale_detail(self._sales[row])

    def _on_row_double_click(self) -> None:
        """Abre detalle con doble click."""
        self._on_detail_click()

    def _populate_table(self, sales: List[Dict]) -> None:
        """Llena la tabla con ventas (una fila por venta)."""
        self.results_table.setRowCount(0)
        self.detail_btn.setEnabled(False)

        for sale in sales:
            row = self.results_table.rowCount()
            self.results_table.insertRow(row)

            # Fecha
            date_str = sale.get("saleDate", "")[:10]
            self.results_table.setItem(row, 0, QTableWidgetItem(date_str))

            # Numero de venta
            sale_num = sale.get("saleNumber", "N/A")
            self.results_table.setItem(row, 1, QTableWidgetItem(str(sale_num)))

            # Cliente
            customer = sale.get("customer")
            customer_name = customer.get("name", "Consumidor Final") if customer else "Consumidor Final"
            self.results_table.setItem(row, 2, QTableWidgetItem(customer_name))

            # Total
            total = Decimal(str(sale.get("total", 0)))
            self.results_table.setItem(row, 3, QTableWidgetItem(f"${total:,.2f}"))

    def _show_sale_detail(self, sale: Dict) -> None:
        """Muestra el detalle completo de la venta."""
        from src.ui.dialogs.sale_detail_dialog import SaleDetailDialog

        # Pasar el query para filtrar qué items se pueden devolver
        search_query = self.search_input.text().strip()
        dialog = SaleDetailDialog(sale, refund_filter=search_query, parent=self)
        dialog.exec()

        # Refrescar busqueda por si hubo devoluciones
        self._on_search()

    def focus_search(self) -> None:
        """Da foco al campo de busqueda."""
        self.search_input.setFocus()
        self.search_input.selectAll()
