"""
Vista de historial de ventas.

Muestra las ventas del dia y permite reimprimir tickets.
"""

from typing import Optional, List, Dict, Any
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
    QComboBox,
)
from PyQt6.QtCore import Qt, pyqtSignal, QThread
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles.theme import Theme
from src.services.sync_service import SyncService


class SalesLoaderWorker(QThread):
    """Worker para cargar ventas."""

    sales_loaded = pyqtSignal(list)
    error = pyqtSignal(str)

    def __init__(self, sync_service: SyncService):
        super().__init__()
        self.sync_service = sync_service

    def run(self):
        try:
            sales = self.sync_service.get_local_sales()
            self.sales_loaded.emit(sales)
        except Exception as e:
            logger.error(f"Error cargando ventas: {e}")
            self.error.emit(str(e))


class SalesHistoryView(QWidget):
    """Vista de historial de ventas."""

    sale_selected = pyqtSignal(dict)

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
        self._filtered_sales: List[Dict] = []
        self._worker: Optional[SalesLoaderWorker] = None

        self._setup_ui()
        logger.debug("SalesHistoryView inicializado")

    def set_sync_service(self, sync_service: SyncService) -> None:
        """Establece el servicio de sincronizacion."""
        self.sync_service = sync_service
        self._load_sales()

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header
        header = QHBoxLayout()

        title = QLabel("Historial de Ventas")
        title.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        header.addWidget(title)

        header.addStretch()

        # Total del dia
        self.total_label = QLabel("Total del dia: $0.00")
        self.total_label.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        self.total_label.setStyleSheet(f"color: {self.theme.primary};")
        header.addWidget(self.total_label)

        layout.addLayout(header)

        # Filtros
        filters_frame = QFrame()
        filters_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)
        filters_layout = QHBoxLayout(filters_frame)
        filters_layout.setContentsMargins(16, 12, 16, 12)

        # Busqueda
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Buscar por ticket, cliente o producto...")
        self.search_input.setMinimumHeight(36)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 0 12px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        self.search_input.textChanged.connect(self._filter_sales)
        filters_layout.addWidget(self.search_input, 1)

        # Filtro por estado
        self.status_filter = QComboBox()
        self.status_filter.addItems(["Todas", "Completadas", "Anuladas", "Devoluciones"])
        self.status_filter.setMinimumHeight(36)
        self.status_filter.setStyleSheet(f"""
            QComboBox {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 6px;
                padding: 0 12px;
                min-width: 120px;
            }}
        """)
        self.status_filter.currentIndexChanged.connect(self._filter_sales)
        filters_layout.addWidget(self.status_filter)

        # Boton refrescar
        refresh_btn = QPushButton("Actualizar")
        refresh_btn.setMinimumHeight(36)
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        refresh_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 0 16px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        refresh_btn.clicked.connect(self._load_sales)
        filters_layout.addWidget(refresh_btn)

        layout.addWidget(filters_frame)

        # Status
        self.status_label = QLabel("")
        self.status_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 13px;")
        layout.addWidget(self.status_label)

        # Tabla
        self.sales_table = QTableWidget()
        self.sales_table.setColumnCount(7)
        self.sales_table.setHorizontalHeaderLabels([
            "Hora", "Comprobante", "Tipo", "Cliente", "Items", "Total", "Estado"
        ])
        self.sales_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        self.sales_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.sales_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.sales_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.sales_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.sales_table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)
        self.sales_table.horizontalHeader().setSectionResizeMode(6, QHeaderView.ResizeMode.Fixed)
        self.sales_table.setColumnWidth(0, 60)
        self.sales_table.setColumnWidth(1, 160)
        self.sales_table.setColumnWidth(2, 80)
        self.sales_table.setColumnWidth(4, 50)
        self.sales_table.setColumnWidth(5, 100)
        self.sales_table.setColumnWidth(6, 100)
        self.sales_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.sales_table.setAlternatingRowColors(True)
        self.sales_table.verticalHeader().setVisible(False)
        self.sales_table.setStyleSheet(f"""
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
        self.sales_table.doubleClicked.connect(self._on_sale_double_clicked)
        self.sales_table.itemSelectionChanged.connect(self._on_selection_changed)
        layout.addWidget(self.sales_table, 1)

        # Botones de acción
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
        self.detail_btn.clicked.connect(self._on_view_detail)
        btn_layout.addWidget(self.detail_btn)

        self.reprint_btn = QPushButton("Reimprimir")
        self.reprint_btn.setMinimumHeight(40)
        self.reprint_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.reprint_btn.setEnabled(False)
        self.reprint_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.text_primary};
                border: none;
                border-radius: 6px;
                padding: 0 24px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_muted};
            }}
        """)
        self.reprint_btn.clicked.connect(self._on_reprint)
        btn_layout.addWidget(self.reprint_btn)

        layout.addLayout(btn_layout)

    def _load_sales(self) -> None:
        """Carga ventas del dia."""
        if not self.sync_service:
            return

        self.status_label.setText("Cargando ventas...")

        self._worker = SalesLoaderWorker(self.sync_service)
        self._worker.sales_loaded.connect(self._on_sales_loaded)
        self._worker.error.connect(self._on_load_error)
        self._worker.start()

    def _on_sales_loaded(self, sales: List[Dict]) -> None:
        """Maneja ventas cargadas."""
        self._sales = sales
        self._filter_sales()

        # Calcular total
        total = sum(Decimal(str(s.get("total", 0))) for s in sales)
        self.total_label.setText(f"Total del dia: ${total:,.2f}")
        self.status_label.setText(f"{len(sales)} ventas encontradas")

    def _on_load_error(self, error: str) -> None:
        """Maneja error de carga."""
        self.status_label.setText(f"Error: {error}")
        logger.error(f"Error cargando ventas: {error}")

    def _filter_sales(self) -> None:
        """Filtra las ventas."""
        query = self.search_input.text().strip().lower()
        status = self.status_filter.currentText()

        self._filtered_sales = []
        for sale in self._sales:
            # Filtro por texto
            if query:
                ticket = str(sale.get("saleNumber", "")).lower()
                customer = (sale.get("customer", {}) or {}).get("name", "").lower()
                if query not in ticket and query not in customer:
                    continue

            # Filtro por estado
            sale_status = sale.get("status", "COMPLETED")
            if status == "Todas":
                pass  # No filtrar
            elif status == "Completadas" and sale_status != "COMPLETED":
                continue
            elif status == "Anuladas" and sale_status not in ["VOIDED", "CANCELLED", "CANCELED"]:
                continue
            elif status == "Devoluciones" and sale_status not in ["REFUNDED", "PARTIAL_REFUND"]:
                continue

            self._filtered_sales.append(sale)

        self._populate_table()

    def _populate_table(self) -> None:
        """Llena la tabla."""
        self.sales_table.setRowCount(0)

        for sale in self._filtered_sales:
            row = self.sales_table.rowCount()
            self.sales_table.insertRow(row)

            # Hora
            sale_date = sale.get("saleDate", "")
            if sale_date:
                try:
                    dt = datetime.fromisoformat(sale_date.replace("Z", "+00:00"))
                    time_str = dt.strftime("%H:%M")
                except:
                    time_str = sale_date[11:16] if len(sale_date) > 16 else ""
            else:
                time_str = ""
            self.sales_table.setItem(row, 0, QTableWidgetItem(time_str))

            # Comprobante (saleNumber)
            ticket = sale.get("saleNumber", "N/A")
            self.sales_table.setItem(row, 1, QTableWidgetItem(str(ticket)))

            # Tipo de comprobante
            receipt_type = sale.get("receiptType", "NDP_X")
            receipt_map = {
                "TICKET": "NDP X",     # @deprecated - mantener por compatibilidad
                "NDP_X": "NDP X",      # Nota de Pedido X (comprobante provisorio)
                "NDC_X": "NDC X",      # Nota de Crédito X (devolución provisoria)
                "INVOICE_A": "Fact. A",
                "INVOICE_B": "Fact. B",
                "INVOICE_C": "Fact. C",
                "CREDIT_NOTE_A": "NC A",
                "CREDIT_NOTE_B": "NC B",
                "CREDIT_NOTE_C": "NC C",
                "RECEIPT": "Recibo",
            }
            type_item = QTableWidgetItem(receipt_map.get(receipt_type, receipt_type or "NDP X"))
            if receipt_type and receipt_type.startswith("INVOICE"):
                type_item.setForeground(Qt.GlobalColor.darkGreen)
            elif receipt_type and (receipt_type.startswith("CREDIT_NOTE") or receipt_type == "NDC_X"):
                type_item.setForeground(Qt.GlobalColor.darkRed)
            self.sales_table.setItem(row, 2, type_item)

            # Cliente
            customer = sale.get("customer", {}) or {}
            customer_name = customer.get("name", "Consumidor Final")
            self.sales_table.setItem(row, 3, QTableWidgetItem(customer_name))

            # Items
            items = sale.get("items", [])
            self.sales_table.setItem(row, 4, QTableWidgetItem(str(len(items))))

            # Total
            total = Decimal(str(sale.get("total", 0)))
            self.sales_table.setItem(row, 5, QTableWidgetItem(f"${total:,.2f}"))

            # Estado
            sale_status = sale.get("status", "COMPLETED")
            status_map = {
                "COMPLETED": "Completada",
                "VOIDED": "Anulada",
                "CANCELLED": "Anulada",
                "CANCELED": "Anulada",
                "REFUNDED": "Devolución",
                "PARTIAL_REFUND": "Dev. Parcial",
            }
            status_item = QTableWidgetItem(status_map.get(sale_status, sale_status))
            if sale_status in ["VOIDED", "CANCELLED", "CANCELED"]:
                status_item.setForeground(Qt.GlobalColor.red)
            elif sale_status in ["REFUNDED", "PARTIAL_REFUND"]:
                status_item.setForeground(Qt.GlobalColor.darkYellow)
            self.sales_table.setItem(row, 6, status_item)

    def _on_selection_changed(self) -> None:
        """Habilita/deshabilita botones según selección."""
        has_selection = len(self.sales_table.selectedItems()) > 0
        self.detail_btn.setEnabled(has_selection)
        self.reprint_btn.setEnabled(has_selection)

    def _get_selected_sale(self) -> Optional[Dict]:
        """Obtiene la venta seleccionada."""
        row = self.sales_table.currentRow()
        if row >= 0 and row < len(self._filtered_sales):
            return self._filtered_sales[row]
        return None

    def _on_sale_double_clicked(self) -> None:
        """Maneja doble click en venta."""
        self._on_view_detail()

    def _on_view_detail(self) -> None:
        """Muestra detalle de la venta seleccionada."""
        sale = self._get_selected_sale()
        if not sale:
            return

        from src.ui.dialogs.sale_detail_dialog import SaleDetailDialog

        # Abrir dialog de detalle (sin filtro de devolución)
        dialog = SaleDetailDialog(sale, parent=self)
        dialog.exec()

        self.sale_selected.emit(sale)

    def _on_reprint(self) -> None:
        """Reimprime el ticket de la venta seleccionada."""
        sale = self._get_selected_sale()
        if not sale:
            return

        ticket = sale.get("saleNumber", "N/A")
        total = sale.get("total", 0)

        reply = QMessageBox.question(
            self,
            "Reimprimir Comprobante",
            f"¿Reimprimir comprobante #{ticket}?\n"
            f"Total: ${total:,.2f}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            # TODO: Implementar reimpresión real
            QMessageBox.information(
                self,
                "Reimprimir",
                f"Reimprimiendo ticket #{ticket}...\n\n"
                "Funcionalidad de impresión en desarrollo."
            )

    def refresh(self) -> None:
        """Refresca los datos."""
        self._load_sales()
