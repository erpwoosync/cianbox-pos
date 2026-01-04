"""
Dialogo de devolucion orientado a producto.

Flujo:
1. Escanear/buscar producto a devolver
2. Ver ventas que contienen ese producto
3. Seleccionar venta y cantidad
4. Procesar devolucion
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLineEdit,
    QLabel,
    QPushButton,
    QFrame,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QAbstractItemView,
    QMessageBox,
    QSpinBox,
    QTextEdit,
    QSplitter,
    QWidget,
    QStackedWidget,
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QThread
from PyQt6.QtGui import QFont
from loguru import logger

from src.api.sales import SalesAPI
from src.ui.dialogs.supervisor_pin_dialog import SupervisorPinDialog

# Importacion condicional para evitar import circular
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from src.services.sync_service import SyncService


class SearchWorker(QThread):
    """Worker para buscar ventas por producto en cache local."""

    finished = pyqtSignal(dict)
    error = pyqtSignal(str)

    def __init__(self, sync_service: "SyncService", identifier: str):
        super().__init__()
        self.sync_service = sync_service
        self.identifier = identifier

    def run(self):
        try:
            # Buscar en cache local (SQLite)
            result = self.sync_service.search_sales_by_product(self.identifier)
            if result.get("success"):
                self.finished.emit(result.get("data", {}))
            else:
                self.error.emit(result.get("error", "Error desconocido"))
        except Exception as e:
            logger.error(f"Error en SearchWorker: {e}")
            self.error.emit(str(e))


class RefundWorker(QThread):
    """Worker para procesar devolucion."""

    finished = pyqtSignal(dict)
    error = pyqtSignal(str, int)  # error, status_code

    def __init__(
        self,
        api: SalesAPI,
        sale_id: str,
        items: List[dict],
        reason: str,
        supervisor_pin: Optional[str] = None,
    ):
        super().__init__()
        self.api = api
        self.sale_id = sale_id
        self.items = items
        self.reason = reason
        self.supervisor_pin = supervisor_pin

    def run(self):
        try:
            result = self.api.refund_sale(
                self.sale_id,
                self.items,
                self.reason,
                emit_credit_note=True,
                supervisor_pin=self.supervisor_pin,
            )
            if result.get("success"):
                self.finished.emit(result.get("data", {}))
            else:
                error = result.get("error", "Error desconocido")
                # Detectar si es error de autorizacion
                status_code = 403 if "permiso" in error.lower() or "autoriza" in error.lower() else 400
                self.error.emit(error, status_code)
        except Exception as e:
            logger.error(f"Error en RefundWorker: {e}")
            self.error.emit(str(e), 500)


class ProductRefundDialog(QDialog):
    """
    Dialogo para devoluciones orientado a producto.

    Flujo:
    1. Escanear/buscar producto
    2. Ver ventas que lo contienen
    3. Seleccionar cantidad a devolver
    4. Procesar
    """

    refund_completed = pyqtSignal(dict)

    def __init__(self, theme, sync_service: "SyncService", parent=None):
        super().__init__(parent)
        self.theme = theme
        self.sync_service = sync_service
        self.sales_api = SalesAPI()  # Para procesar devoluciones
        self._search_timer: Optional[QTimer] = None
        self._search_worker: Optional[SearchWorker] = None
        self._refund_worker: Optional[RefundWorker] = None

        # Estado
        self.current_product: Optional[dict] = None
        self.sales_list: List[dict] = []
        self.selected_sale: Optional[dict] = None
        self.selected_item: Optional[dict] = None

        self._setup_ui()
        logger.info("Dialogo de devolucion por producto abierto")

    def _setup_ui(self) -> None:
        """Configura la interfaz."""
        self.setWindowTitle("Devolucion de Producto")
        self.setMinimumSize(1000, 700)
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Header con busqueda
        header = self._create_header()
        layout.addWidget(header)

        # Contenido principal
        content = self._create_content()
        layout.addWidget(content, 1)

        # Footer
        footer = self._create_footer()
        layout.addWidget(footer)

    def _create_header(self) -> QFrame:
        """Crea el header con buscador de producto."""
        header = QFrame()
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(header)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(12)

        # Titulo y descripcion
        title_row = QHBoxLayout()
        title = QLabel("Devolucion de Producto")
        title.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        title_row.addWidget(title)
        title_row.addStretch()

        # Indicador de paso
        self.step_label = QLabel("Paso 1: Buscar producto")
        self.step_label.setStyleSheet(f"""
            color: {self.theme.primary};
            font-size: 13px;
            font-weight: 600;
            border: none;
        """)
        title_row.addWidget(self.step_label)
        layout.addLayout(title_row)

        # Campo de busqueda
        search_row = QHBoxLayout()
        search_row.setSpacing(12)

        search_label = QLabel("Escanee o busque el producto:")
        search_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 13px; border: none;")
        search_row.addWidget(search_label)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Codigo de barras, SKU o nombre del producto...")
        self.search_input.setFixedHeight(48)
        self.search_input.setStyleSheet(f"""
            QLineEdit {{
                background-color: {self.theme.background};
                border: 2px solid {self.theme.border};
                border-radius: 8px;
                padding: 0 16px;
                font-size: 15px;
                color: {self.theme.text_primary};
            }}
            QLineEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        self.search_input.returnPressed.connect(self._on_search)
        self.search_input.textChanged.connect(self._on_search_changed)
        search_row.addWidget(self.search_input, 1)

        search_btn = QPushButton("Buscar")
        search_btn.setFixedSize(100, 48)
        search_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        search_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        search_btn.clicked.connect(self._on_search)
        search_row.addWidget(search_btn)

        layout.addLayout(search_row)

        # Info del producto encontrado
        self.product_info = QFrame()
        self.product_info.setVisible(False)
        self.product_info.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.primary_bg};
                border: 1px solid {self.theme.primary};
                border-radius: 8px;
            }}
        """)
        product_layout = QHBoxLayout(self.product_info)
        product_layout.setContentsMargins(16, 12, 16, 12)

        self.product_name_label = QLabel()
        self.product_name_label.setFont(QFont("Segoe UI", 13, QFont.Weight.Bold))
        self.product_name_label.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        product_layout.addWidget(self.product_name_label)

        self.product_code_label = QLabel()
        self.product_code_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px; border: none;")
        product_layout.addWidget(self.product_code_label)

        product_layout.addStretch()

        clear_btn = QPushButton("Limpiar")
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        clear_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.primary};
                border: none;
                font-size: 12px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                text-decoration: underline;
            }}
        """)
        clear_btn.clicked.connect(self._clear_search)
        product_layout.addWidget(clear_btn)

        layout.addWidget(self.product_info)

        return header

    def _create_content(self) -> QWidget:
        """Crea el contenido principal."""
        # Stack para estados: sin busqueda, resultados, detalle
        self.content_stack = QStackedWidget()

        # Estado inicial: instrucciones
        empty_state = self._create_empty_state()
        self.content_stack.addWidget(empty_state)

        # Estado con resultados
        results_widget = self._create_results_widget()
        self.content_stack.addWidget(results_widget)

        return self.content_stack

    def _create_empty_state(self) -> QWidget:
        """Crea el estado vacio/inicial."""
        widget = QFrame()
        widget.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(widget)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        icon = QLabel("🔍")
        icon.setFont(QFont("Segoe UI", 48))
        icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon.setStyleSheet("border: none;")
        layout.addWidget(icon)

        title = QLabel("Busque un producto para iniciar")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        layout.addWidget(title)

        desc = QLabel("Escanee el codigo de barras o busque por nombre/SKU")
        desc.setAlignment(Qt.AlignmentFlag.AlignCenter)
        desc.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 13px; border: none;")
        layout.addWidget(desc)

        return widget

    def _create_results_widget(self) -> QWidget:
        """Crea el widget de resultados."""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(16)

        # Panel izquierdo: lista de ventas
        left_panel = self._create_sales_list_panel()
        layout.addWidget(left_panel, 1)

        # Panel derecho: detalle y cantidad
        right_panel = self._create_detail_panel()
        layout.addWidget(right_panel, 1)

        return widget

    def _create_sales_list_panel(self) -> QFrame:
        """Crea el panel con lista de ventas."""
        panel = QFrame()
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header del panel
        header = QFrame()
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_100};
                border: none;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                border-bottom: 1px solid {self.theme.border};
            }}
        """)
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(16, 12, 16, 12)

        header_title = QLabel("Ventas con este producto")
        header_title.setFont(QFont("Segoe UI", 13, QFont.Weight.Bold))
        header_title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        header_layout.addWidget(header_title)

        self.sales_count_label = QLabel("0 ventas")
        self.sales_count_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px; border: none;")
        header_layout.addWidget(self.sales_count_label)

        header_layout.addStretch()
        layout.addWidget(header)

        # Tabla de ventas
        self.sales_table = QTableWidget()
        self.sales_table.setColumnCount(5)
        self.sales_table.setHorizontalHeaderLabels([
            "Fecha", "Ticket", "Cliente", "Cantidad", "Disponible"
        ])

        header = self.sales_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.sales_table.setColumnWidth(0, 100)
        self.sales_table.setColumnWidth(1, 130)
        self.sales_table.setColumnWidth(3, 80)
        self.sales_table.setColumnWidth(4, 90)

        self.sales_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.sales_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.sales_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.sales_table.verticalHeader().setVisible(False)
        self.sales_table.setAlternatingRowColors(True)
        self.sales_table.verticalHeader().setDefaultSectionSize(56)

        self.sales_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {self.theme.surface};
                border: none;
                gridline-color: {self.theme.border_light};
                font-size: 13px;
            }}
            QTableWidget::item {{
                padding: 12px 8px;
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

        self.sales_table.itemSelectionChanged.connect(self._on_sale_selected)
        layout.addWidget(self.sales_table, 1)

        return panel

    def _create_detail_panel(self) -> QFrame:
        """Crea el panel de detalle y cantidad."""
        panel = QFrame()
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Titulo
        title = QLabel("Detalle de Devolucion")
        title.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        layout.addWidget(title)

        # Contenedor de detalle (se muestra al seleccionar venta)
        self.detail_container = QWidget()
        self.detail_container.setVisible(False)
        detail_layout = QVBoxLayout(self.detail_container)
        detail_layout.setContentsMargins(0, 0, 0, 0)
        detail_layout.setSpacing(16)

        # Info de la venta seleccionada
        sale_info = QFrame()
        sale_info.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.gray_50};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)
        sale_info_layout = QVBoxLayout(sale_info)
        sale_info_layout.setContentsMargins(16, 12, 16, 12)
        sale_info_layout.setSpacing(8)

        self.sale_info_label = QLabel()
        self.sale_info_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 13px; border: none;")
        self.sale_info_label.setWordWrap(True)
        sale_info_layout.addWidget(self.sale_info_label)

        detail_layout.addWidget(sale_info)

        # Cantidad a devolver
        qty_frame = QFrame()
        qty_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)
        qty_layout = QVBoxLayout(qty_frame)
        qty_layout.setContentsMargins(16, 16, 16, 16)
        qty_layout.setSpacing(12)

        qty_label = QLabel("Cantidad a devolver:")
        qty_label.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        qty_label.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        qty_layout.addWidget(qty_label)

        qty_row = QHBoxLayout()
        qty_row.setSpacing(12)

        self.qty_spinbox = QSpinBox()
        self.qty_spinbox.setMinimum(1)
        self.qty_spinbox.setMaximum(1)
        self.qty_spinbox.setValue(1)
        self.qty_spinbox.setFixedSize(120, 56)
        self.qty_spinbox.setStyleSheet(f"""
            QSpinBox {{
                background-color: {self.theme.surface};
                border: 2px solid {self.theme.border};
                border-radius: 8px;
                padding: 8px;
                font-size: 18px;
                font-weight: bold;
            }}
            QSpinBox:focus {{
                border-color: {self.theme.primary};
            }}
            QSpinBox::up-button, QSpinBox::down-button {{
                width: 32px;
            }}
        """)
        self.qty_spinbox.valueChanged.connect(self._update_refund_amount)
        qty_row.addWidget(self.qty_spinbox)

        self.available_label = QLabel("de X disponibles")
        self.available_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 13px; border: none;")
        qty_row.addWidget(self.available_label)

        qty_row.addStretch()
        qty_layout.addLayout(qty_row)

        # Monto a devolver
        self.refund_amount_label = QLabel("Monto: $0.00")
        self.refund_amount_label.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        self.refund_amount_label.setStyleSheet(f"color: {self.theme.primary}; border: none;")
        qty_layout.addWidget(self.refund_amount_label)

        detail_layout.addWidget(qty_frame)

        # Motivo
        reason_label = QLabel("Motivo de la devolucion:")
        reason_label.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        reason_label.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        detail_layout.addWidget(reason_label)

        self.reason_input = QTextEdit()
        self.reason_input.setPlaceholderText("Describa el motivo de la devolucion...")
        self.reason_input.setFixedHeight(80)
        self.reason_input.setStyleSheet(f"""
            QTextEdit {{
                background-color: {self.theme.background};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 12px;
                font-size: 13px;
            }}
            QTextEdit:focus {{
                border-color: {self.theme.primary};
            }}
        """)
        detail_layout.addWidget(self.reason_input)

        layout.addWidget(self.detail_container)

        # Mensaje cuando no hay seleccion
        self.no_selection_label = QLabel("Seleccione una venta de la lista\npara ver los detalles")
        self.no_selection_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.no_selection_label.setStyleSheet(f"color: {self.theme.gray_400}; font-size: 13px; border: none;")
        layout.addWidget(self.no_selection_label, 1)

        return panel

    def _create_footer(self) -> QFrame:
        """Crea el footer con botones."""
        footer = QFrame()
        layout = QHBoxLayout(footer)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Status
        self.status_label = QLabel()
        self.status_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        layout.addWidget(self.status_label)

        layout.addStretch()

        # Boton cancelar
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setFixedSize(120, 48)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_200};
                color: {self.theme.gray_700};
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_300};
            }}
        """)
        cancel_btn.clicked.connect(self.reject)
        layout.addWidget(cancel_btn)

        # Boton procesar
        self.process_btn = QPushButton("Procesar Devolucion")
        self.process_btn.setFixedSize(180, 48)
        self.process_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.process_btn.setEnabled(False)
        self.process_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.warning};
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: #D97706;
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
            }}
        """)
        self.process_btn.clicked.connect(self._process_refund)
        layout.addWidget(self.process_btn)

        return footer

    def _on_search_changed(self, text: str) -> None:
        """Maneja cambios en el texto (debounce)."""
        if self._search_timer:
            self._search_timer.stop()

        # Solo buscar automatico si parece un codigo de barras (numerico y largo)
        if text.isdigit() and len(text) >= 8:
            self._search_timer = QTimer()
            self._search_timer.setSingleShot(True)
            self._search_timer.timeout.connect(self._on_search)
            self._search_timer.start(300)

    def _on_search(self) -> None:
        """Ejecuta la busqueda."""
        query = self.search_input.text().strip()
        if not query:
            return

        self.status_label.setText("Buscando...")
        self.step_label.setText("Buscando producto...")

        # Cancelar busqueda anterior
        if self._search_worker and self._search_worker.isRunning():
            self._search_worker.terminate()
            self._search_worker.wait()

        # Buscar en cache local usando sync_service
        self._search_worker = SearchWorker(self.sync_service, query)
        self._search_worker.finished.connect(self._on_search_success)
        self._search_worker.error.connect(self._on_search_error)
        self._search_worker.start()

    def _on_search_success(self, data: dict) -> None:
        """Maneja resultados de busqueda exitosos."""
        product = data.get("product", {})
        sales = data.get("sales", [])

        self.current_product = product
        self.sales_list = sales

        # Mostrar info del producto
        self.product_name_label.setText(product.get("name", ""))
        codes = []
        if product.get("barcode"):
            codes.append(f"Cod: {product.get('barcode')}")
        if product.get("sku"):
            codes.append(f"SKU: {product.get('sku')}")
        self.product_code_label.setText(" | ".join(codes))
        self.product_info.setVisible(True)

        # Actualizar tabla
        self._update_sales_table(sales)

        if sales:
            self.step_label.setText("Paso 2: Seleccione la venta")
            self.status_label.setText(f"{len(sales)} ventas encontradas")
            self.content_stack.setCurrentIndex(1)
        else:
            self.status_label.setText("No se encontraron ventas con este producto disponibles para devolucion")

    def _on_search_error(self, error: str) -> None:
        """Maneja error de busqueda."""
        self.status_label.setText(f"Error: {error}")
        self.step_label.setText("Paso 1: Buscar producto")

        if "Producto" in error:
            QMessageBox.warning(self, "Producto no encontrado", f"No se encontro el producto buscado.\n\n{error}")

    def _update_sales_table(self, sales: List[dict]) -> None:
        """Actualiza la tabla de ventas."""
        self.sales_table.setRowCount(len(sales))
        self.sales_count_label.setText(f"{len(sales)} ventas")

        for row, sale in enumerate(sales):
            # Fecha
            sale_date = sale.get("saleDate", "")
            if sale_date:
                try:
                    dt = datetime.fromisoformat(sale_date.replace("Z", "+00:00"))
                    date_str = dt.strftime("%d/%m/%Y")
                except Exception:
                    date_str = sale_date[:10]
            else:
                date_str = "-"
            date_item = QTableWidgetItem(date_str)
            date_item.setData(Qt.ItemDataRole.UserRole, sale)
            self.sales_table.setItem(row, 0, date_item)

            # Numero de ticket
            ticket = sale.get("saleNumber", "-")
            ticket_item = QTableWidgetItem(ticket)
            self.sales_table.setItem(row, 1, ticket_item)

            # Cliente
            customer = sale.get("customer")
            customer_name = customer.get("name", "Sin cliente") if customer else "Sin cliente"
            customer_item = QTableWidgetItem(customer_name)
            self.sales_table.setItem(row, 2, customer_item)

            # Cantidad vendida del producto
            items = sale.get("items", [])
            total_qty = sum(abs(int(item.get("quantity", 0))) for item in items)
            qty_item = QTableWidgetItem(str(total_qty))
            qty_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.sales_table.setItem(row, 3, qty_item)

            # Cantidad disponible para devolucion
            available_qty = sum(int(item.get("availableQuantity", 0)) for item in items)
            available_item = QTableWidgetItem(str(available_qty))
            available_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            if available_qty > 0:
                available_item.setForeground(Qt.GlobalColor.darkGreen)
            else:
                available_item.setForeground(Qt.GlobalColor.red)
            self.sales_table.setItem(row, 4, available_item)

    def _on_sale_selected(self) -> None:
        """Maneja seleccion de venta."""
        selected = self.sales_table.selectedItems()
        if not selected:
            return

        row = selected[0].row()
        sale = self.sales_table.item(row, 0).data(Qt.ItemDataRole.UserRole)

        if sale:
            self.selected_sale = sale
            items = sale.get("items", [])
            # Tomamos el primer item (es el del producto buscado)
            self.selected_item = items[0] if items else None

            if self.selected_item:
                self._show_detail(sale, self.selected_item)

    def _show_detail(self, sale: dict, item: dict) -> None:
        """Muestra el detalle de la venta seleccionada."""
        self.no_selection_label.setVisible(False)
        self.detail_container.setVisible(True)
        self.step_label.setText("Paso 3: Confirme la devolucion")

        # Info de la venta
        sale_date = sale.get("saleDate", "")
        if sale_date:
            try:
                dt = datetime.fromisoformat(sale_date.replace("Z", "+00:00"))
                date_str = dt.strftime("%d/%m/%Y %H:%M")
            except Exception:
                date_str = sale_date[:16]
        else:
            date_str = "-"

        customer = sale.get("customer")
        customer_name = customer.get("name", "Sin cliente") if customer else "Sin cliente"

        self.sale_info_label.setText(
            f"<b>Ticket:</b> {sale.get('saleNumber', '-')}<br>"
            f"<b>Fecha:</b> {date_str}<br>"
            f"<b>Cliente:</b> {customer_name}<br>"
            f"<b>Producto:</b> {item.get('productName', '-')}"
        )

        # Configurar cantidad
        available = int(item.get("availableQuantity", 1))
        self.qty_spinbox.setMaximum(available)
        self.qty_spinbox.setValue(available)  # Por defecto devolver todo
        self.available_label.setText(f"de {available} disponibles")

        self._update_refund_amount()
        self.process_btn.setEnabled(True)

    def _update_refund_amount(self) -> None:
        """Actualiza el monto a devolver."""
        if not self.selected_item:
            return

        qty = self.qty_spinbox.value()
        subtotal = float(self.selected_item.get("subtotal", 0))
        original_qty = abs(int(self.selected_item.get("quantity", 1)))
        unit_price = subtotal / original_qty if original_qty else 0
        refund_amount = unit_price * qty

        self.refund_amount_label.setText(f"Monto: ${refund_amount:,.2f}")

    def _clear_search(self) -> None:
        """Limpia la busqueda y vuelve al estado inicial."""
        self.search_input.clear()
        self.search_input.setFocus()
        self.product_info.setVisible(False)
        self.current_product = None
        self.sales_list = []
        self.selected_sale = None
        self.selected_item = None
        self.content_stack.setCurrentIndex(0)
        self.step_label.setText("Paso 1: Buscar producto")
        self.status_label.clear()
        self.process_btn.setEnabled(False)
        self.detail_container.setVisible(False)
        self.no_selection_label.setVisible(True)

    def _process_refund(self, supervisor_pin: Optional[str] = None) -> None:
        """Procesa la devolucion."""
        if not self.selected_sale or not self.selected_item:
            return

        reason = self.reason_input.toPlainText().strip()
        if not reason:
            QMessageBox.warning(self, "Motivo requerido", "Debe indicar el motivo de la devolucion")
            self.reason_input.setFocus()
            return

        qty = self.qty_spinbox.value()

        # Preparar items para devolucion
        items = [{
            "saleItemId": self.selected_item.get("id"),
            "quantity": qty,
            "reason": reason,
        }]

        self.status_label.setText("Procesando devolucion...")
        self.process_btn.setEnabled(False)

        # Cancelar worker anterior
        if self._refund_worker and self._refund_worker.isRunning():
            self._refund_worker.terminate()
            self._refund_worker.wait()

        self._refund_worker = RefundWorker(
            self.sales_api,
            self.selected_sale.get("id"),
            items,
            reason,
            supervisor_pin=supervisor_pin,
        )
        self._refund_worker.finished.connect(self._on_refund_success)
        self._refund_worker.error.connect(self._on_refund_error)
        self._refund_worker.start()

    def _on_refund_success(self, data: dict) -> None:
        """Maneja devolucion exitosa."""
        refund_amount = data.get("refundAmount", 0)
        is_full = data.get("isFullRefund", False)
        credit_note = data.get("creditNote")

        msg = f"Devolucion procesada correctamente.\n\n"
        msg += f"Monto devuelto: ${refund_amount:,.2f}\n"
        msg += f"Tipo: {'Devolucion Total' if is_full else 'Devolucion Parcial'}"

        if credit_note:
            msg += f"\n\nNota de Credito AFIP generada:\nCAE: {credit_note.get('cae', '-')}"

        QMessageBox.information(self, "Devolucion Exitosa", msg)

        self.refund_completed.emit(data)
        self.accept()

    def _on_refund_error(self, error: str, status_code: int) -> None:
        """Maneja error de devolucion."""
        self.process_btn.setEnabled(True)

        # Si es error de autorizacion, pedir PIN de supervisor
        if status_code == 403:
            pin = SupervisorPinDialog.get_supervisor_pin(self)
            if pin:
                self._process_refund(supervisor_pin=pin)
            else:
                self.status_label.setText("Autorizacion cancelada")
            return

        self.status_label.setText(f"Error: {error}")
        QMessageBox.warning(self, "Error", f"Error al procesar devolucion:\n\n{error}")
