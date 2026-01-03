"""
Dialogo de historial de ventas.

Permite consultar ventas realizadas y reimprimir facturas.
"""

from typing import Optional, List
from datetime import datetime, timedelta

from PyQt6.QtWidgets import (
    QDialog,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QMessageBox,
    QDateEdit,
    QAbstractItemView,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QDate
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles import get_theme
from src.api.sales import SalesAPI
from src.api.afip import AfipAPI, InvoiceData, SaleForInvoice
from src.ui.dialogs.refund_dialog import RefundDialog


class SalesLoaderWorker(QThread):
    """Worker para cargar ventas en background."""

    finished = pyqtSignal(list, object)  # sales, pagination
    error = pyqtSignal(str)

    def __init__(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
    ):
        super().__init__()
        self.date_from = date_from
        self.date_to = date_to
        self.page = page

    def run(self):
        try:
            api = SalesAPI()
            sales, pagination = api.list_sales(
                date_from=self.date_from,
                date_to=self.date_to,
                page=self.page,
                page_size=20,
            )
            self.finished.emit(sales, pagination)
        except Exception as e:
            logger.error(f"Error cargando ventas: {e}")
            self.error.emit(str(e))


class SalesHistoryDialog(QDialog):
    """
    Dialogo de historial de ventas.

    Permite consultar ventas y reimprimir facturas.
    """

    def __init__(self, parent: QWidget = None):
        super().__init__(parent)

        self.theme = get_theme()
        self.sales: List[dict] = []
        self.selected_sale: Optional[dict] = None
        self.worker: Optional[SalesLoaderWorker] = None

        # Configurar dialogo
        self.setWindowTitle("Historial de Ventas")
        self.setModal(True)
        self.setMinimumSize(800, 600)
        self.resize(900, 650)

        self._setup_ui()
        self._load_sales()

        logger.info("Dialogo de historial de ventas abierto")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Header
        header = self._create_header()
        main_layout.addWidget(header)

        # Contenido
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(24, 16, 24, 24)
        content_layout.setSpacing(16)

        # Filtros
        filters = self._create_filters()
        content_layout.addWidget(filters)

        # Tabla de ventas
        self.table = self._create_table()
        content_layout.addWidget(self.table, 1)

        # Paginacion
        self.pagination_widget = self._create_pagination()
        content_layout.addWidget(self.pagination_widget)

        # Botones de accion
        actions = self._create_actions()
        content_layout.addWidget(actions)

        main_layout.addWidget(content, 1)

    def _create_header(self) -> QFrame:
        """Crea el header del dialogo."""
        header = QFrame()
        header.setFixedHeight(60)
        header.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-bottom: 1px solid {self.theme.border};
            }}
        """)

        layout = QHBoxLayout(header)
        layout.setContentsMargins(20, 0, 20, 0)

        # Titulo
        title = QLabel("Historial de Ventas")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        layout.addWidget(title)

        layout.addStretch()

        # Boton cerrar
        close_btn = QPushButton("X")
        close_btn.setFixedSize(32, 32)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {self.theme.gray_500};
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_100};
                color: {self.theme.danger};
            }}
        """)
        close_btn.clicked.connect(self.close)
        layout.addWidget(close_btn)

        return header

    def _create_filters(self) -> QFrame:
        """Crea la barra de filtros."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
        """)

        layout = QHBoxLayout(frame)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(16)

        # Fecha desde
        from_label = QLabel("Desde:")
        from_label.setStyleSheet(f"color: {self.theme.text_secondary}; border: none;")
        layout.addWidget(from_label)

        self.date_from = QDateEdit()
        self.date_from.setCalendarPopup(True)
        self.date_from.setDate(QDate.currentDate())
        self.date_from.setStyleSheet(f"""
            QDateEdit {{
                background-color: white;
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                padding: 6px 10px;
                min-width: 120px;
            }}
        """)
        layout.addWidget(self.date_from)

        # Fecha hasta
        to_label = QLabel("Hasta:")
        to_label.setStyleSheet(f"color: {self.theme.text_secondary}; border: none;")
        layout.addWidget(to_label)

        self.date_to = QDateEdit()
        self.date_to.setCalendarPopup(True)
        self.date_to.setDate(QDate.currentDate())
        self.date_to.setStyleSheet(f"""
            QDateEdit {{
                background-color: white;
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                padding: 6px 10px;
                min-width: 120px;
            }}
        """)
        layout.addWidget(self.date_to)

        # Boton buscar
        search_btn = QPushButton("Buscar")
        search_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        search_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 20px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        search_btn.clicked.connect(self._load_sales)
        layout.addWidget(search_btn)

        layout.addStretch()

        # Contador
        self.count_label = QLabel("")
        self.count_label.setStyleSheet(f"color: {self.theme.gray_500}; border: none;")
        layout.addWidget(self.count_label)

        return frame

    def _create_table(self) -> QTableWidget:
        """Crea la tabla de ventas."""
        table = QTableWidget()
        table.setColumnCount(6)
        table.setHorizontalHeaderLabels([
            "Fecha/Hora",
            "Nro Venta",
            "Cliente",
            "Items",
            "Total",
            "Factura",
        ])

        table.setStyleSheet(f"""
            QTableWidget {{
                background-color: white;
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                gridline-color: {self.theme.gray_200};
            }}
            QTableWidget::item {{
                padding: 8px;
            }}
            QTableWidget::item:selected {{
                background-color: {self.theme.primary_light};
                color: {self.theme.primary_dark};
            }}
            QHeaderView::section {{
                background-color: {self.theme.gray_100};
                padding: 10px;
                border: none;
                border-bottom: 1px solid {self.theme.border};
                font-weight: 600;
            }}
        """)

        table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        table.verticalHeader().setVisible(False)

        # Ajustar columnas
        header = table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)

        table.setColumnWidth(0, 140)
        table.setColumnWidth(1, 100)
        table.setColumnWidth(3, 60)
        table.setColumnWidth(4, 100)
        table.setColumnWidth(5, 120)

        table.itemSelectionChanged.connect(self._on_selection_changed)
        table.doubleClicked.connect(self._on_double_click)

        return table

    def _create_pagination(self) -> QWidget:
        """Crea los controles de paginacion."""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)

        layout.addStretch()

        self.prev_btn = QPushButton("< Anterior")
        self.prev_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.prev_btn.setEnabled(False)
        self.prev_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 4px;
                padding: 6px 16px;
            }}
            QPushButton:hover:enabled {{
                background-color: {self.theme.gray_200};
            }}
            QPushButton:disabled {{
                color: {self.theme.gray_400};
            }}
        """)
        self.prev_btn.clicked.connect(self._prev_page)
        layout.addWidget(self.prev_btn)

        self.page_label = QLabel("Pagina 1")
        self.page_label.setStyleSheet(f"color: {self.theme.text_secondary}; margin: 0 12px;")
        layout.addWidget(self.page_label)

        self.next_btn = QPushButton("Siguiente >")
        self.next_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.next_btn.setEnabled(False)
        self.next_btn.setStyleSheet(self.prev_btn.styleSheet())
        self.next_btn.clicked.connect(self._next_page)
        layout.addWidget(self.next_btn)

        layout.addStretch()

        self.current_page = 1
        self.total_pages = 1

        return widget

    def _create_actions(self) -> QFrame:
        """Crea los botones de accion."""
        frame = QFrame()
        layout = QHBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        layout.addStretch()

        # Ver detalle
        self.detail_btn = QPushButton("Ver Detalle")
        self.detail_btn.setFixedHeight(44)
        self.detail_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.detail_btn.setEnabled(False)
        self.detail_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                padding: 0 24px;
                font-size: 14px;
            }}
            QPushButton:hover:enabled {{
                background-color: {self.theme.gray_200};
            }}
            QPushButton:disabled {{
                color: {self.theme.gray_400};
            }}
        """)
        self.detail_btn.clicked.connect(self._show_detail)
        layout.addWidget(self.detail_btn)

        # Devolver
        self.refund_btn = QPushButton("Devolver")
        self.refund_btn.setFixedHeight(44)
        self.refund_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.refund_btn.setEnabled(False)
        self.refund_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: #ff9800;
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0 24px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover:enabled {{
                background-color: #f57c00;
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
            }}
        """)
        self.refund_btn.clicked.connect(self._show_refund_dialog)
        layout.addWidget(self.refund_btn)

        # Reimprimir factura
        self.reprint_btn = QPushButton("Reimprimir Factura")
        self.reprint_btn.setFixedHeight(44)
        self.reprint_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.reprint_btn.setEnabled(False)
        self.reprint_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0 24px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton:hover:enabled {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
            }}
        """)
        self.reprint_btn.clicked.connect(self._reprint_invoice)
        layout.addWidget(self.reprint_btn)

        return frame

    def _load_sales(self, page: int = 1) -> None:
        """Carga las ventas."""
        self.current_page = page

        date_from = self.date_from.date().toString("yyyy-MM-dd")
        date_to = self.date_to.date().toString("yyyy-MM-dd")

        self.table.setRowCount(0)
        self.count_label.setText("Cargando...")

        self.worker = SalesLoaderWorker(
            date_from=date_from,
            date_to=date_to,
            page=page,
        )
        self.worker.finished.connect(self._on_sales_loaded)
        self.worker.error.connect(self._on_load_error)
        self.worker.start()

    def _on_sales_loaded(self, sales: list, pagination: dict) -> None:
        """Maneja las ventas cargadas."""
        self.sales = sales
        self.table.setRowCount(len(sales))

        for i, sale in enumerate(sales):
            # Fecha/Hora
            created_at = sale.get("createdAt", "")
            if created_at:
                try:
                    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    date_str = dt.strftime("%d/%m/%Y %H:%M")
                except Exception:
                    date_str = created_at[:16]
            else:
                date_str = "-"
            self.table.setItem(i, 0, QTableWidgetItem(date_str))

            # Numero de venta
            sale_number = sale.get("saleNumber", "-")
            self.table.setItem(i, 1, QTableWidgetItem(sale_number))

            # Cliente
            customer = sale.get("customer")
            if customer:
                customer_name = customer.get("name", "Consumidor Final")
            else:
                customer_name = "Consumidor Final"
            self.table.setItem(i, 2, QTableWidgetItem(customer_name))

            # Items (backend devuelve _count.items)
            count_data = sale.get("_count", {})
            items_count = count_data.get("items", 0) if count_data else len(sale.get("items", []))
            self.table.setItem(i, 3, QTableWidgetItem(str(items_count)))

            # Total
            total = float(sale.get("total", 0))
            total_item = QTableWidgetItem(f"${total:,.2f}")
            total_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.table.setItem(i, 4, total_item)

            # Factura (backend devuelve afipInvoices[])
            afip_invoices = sale.get("afipInvoices", [])
            invoice = afip_invoices[0] if afip_invoices else None
            if invoice:
                # Construir numero de comprobante
                sales_point = invoice.get("salesPoint", {})
                sp_num = sales_point.get("number", 0) if sales_point else 0
                inv_num = invoice.get("number", 0)
                invoice_text = f"{sp_num:04d}-{inv_num:08d}"
                invoice_item = QTableWidgetItem(invoice_text)
                invoice_item.setForeground(Qt.GlobalColor.darkGreen)
            else:
                invoice_item = QTableWidgetItem("Sin factura")
                invoice_item.setForeground(Qt.GlobalColor.gray)
            self.table.setItem(i, 5, invoice_item)

        # Actualizar paginacion
        if pagination:
            total = pagination.get("total", 0)
            page_size = pagination.get("pageSize", 20)
            self.total_pages = max(1, (total + page_size - 1) // page_size)
            self.count_label.setText(f"{total} ventas encontradas")
        else:
            self.total_pages = 1
            self.count_label.setText(f"{len(sales)} ventas")

        self.page_label.setText(f"Pagina {self.current_page} de {self.total_pages}")
        self.prev_btn.setEnabled(self.current_page > 1)
        self.next_btn.setEnabled(self.current_page < self.total_pages)

    def _on_load_error(self, error: str) -> None:
        """Maneja errores de carga."""
        self.count_label.setText("Error al cargar")
        QMessageBox.warning(self, "Error", f"Error al cargar ventas: {error}")

    def _on_selection_changed(self) -> None:
        """Maneja cambio de seleccion."""
        selected = self.table.selectedItems()
        if selected:
            row = selected[0].row()
            if row < len(self.sales):
                self.selected_sale = self.sales[row]
                self.detail_btn.setEnabled(True)

                # Habilitar reimpresion solo si tiene factura
                afip_invoices = self.selected_sale.get("afipInvoices", [])
                has_invoice = len(afip_invoices) > 0
                self.reprint_btn.setEnabled(has_invoice)

                # Habilitar devolucion solo si:
                # - La venta no esta devuelta ni anulada
                # - No es una devolucion (tiene originalSaleId)
                status = self.selected_sale.get("status", "")
                is_refund = self.selected_sale.get("originalSaleId") is not None
                can_refund = status not in ["REFUNDED", "CANCELLED"] and not is_refund
                self.refund_btn.setEnabled(can_refund)
            else:
                self.selected_sale = None
                self.detail_btn.setEnabled(False)
                self.reprint_btn.setEnabled(False)
                self.refund_btn.setEnabled(False)
        else:
            self.selected_sale = None
            self.detail_btn.setEnabled(False)
            self.reprint_btn.setEnabled(False)
            self.refund_btn.setEnabled(False)

    def _on_double_click(self) -> None:
        """Maneja doble click en una fila."""
        if self.selected_sale:
            afip_invoices = self.selected_sale.get("afipInvoices", [])
            if afip_invoices:
                self._reprint_invoice()
            else:
                self._show_detail()

    def _prev_page(self) -> None:
        """Va a la pagina anterior."""
        if self.current_page > 1:
            self._load_sales(self.current_page - 1)

    def _next_page(self) -> None:
        """Va a la pagina siguiente."""
        if self.current_page < self.total_pages:
            self._load_sales(self.current_page + 1)

    def _show_detail(self) -> None:
        """Muestra el detalle de la venta."""
        if not self.selected_sale:
            return

        try:
            # Cargar venta completa para obtener items
            sale_id = self.selected_sale.get("id", "")
            api = SalesAPI()
            sale = api.get_sale(sale_id)

            if not sale:
                QMessageBox.warning(self, "Error", "No se pudo cargar la venta.")
                return

            items = sale.get("items", [])

            # Crear mensaje con detalle
            msg = f"Venta #{sale.get('saleNumber', '-')}\n\n"
            created_at = sale.get('createdAt', '')
            if created_at:
                msg += f"Fecha: {created_at[:10]}\n"

            customer = sale.get("customer")
            if customer:
                msg += f"Cliente: {customer.get('name', 'Consumidor Final')}\n"
            else:
                msg += "Cliente: Consumidor Final\n"

            msg += f"\nProductos ({len(items)}):\n"
            msg += "-" * 40 + "\n"

            for item in items:
                name = item.get("productName", "Producto")
                qty = float(item.get("quantity", 1))
                subtotal = float(item.get("subtotal", 0))
                if qty > 0:
                    msg += f"{name}\n  {int(qty)} x ${subtotal/qty:.2f} = ${subtotal:.2f}\n"
                else:
                    msg += f"{name}\n  ${subtotal:.2f}\n"

            msg += "-" * 40 + "\n"
            msg += f"TOTAL: ${float(sale.get('total', 0)):,.2f}\n"

            afip_invoices = sale.get("afipInvoices", [])
            if afip_invoices:
                inv = afip_invoices[0]
                sales_point = inv.get("salesPoint", {})
                sp_num = sales_point.get("number", 0) if sales_point else 0
                inv_num = inv.get("number", 0)
                cae = inv.get("cae", "")
                msg += f"\nFactura: {sp_num:04d}-{inv_num:08d}"
                if cae:
                    msg += f"\nCAE: {cae}"

            QMessageBox.information(self, "Detalle de Venta", msg)

        except Exception as e:
            logger.error(f"Error mostrando detalle: {e}")
            QMessageBox.warning(self, "Error", f"Error al cargar detalle: {str(e)}")

    def _reprint_invoice(self) -> None:
        """Reimprime la factura de la venta seleccionada."""
        if not self.selected_sale:
            return

        afip_invoices = self.selected_sale.get("afipInvoices", [])
        if not afip_invoices:
            QMessageBox.warning(
                self,
                "Sin Factura",
                "Esta venta no tiene factura electronica."
            )
            return

        # Cargar datos completos de la venta (incluye items y factura completa)
        sale_id = self.selected_sale.get("id", "")
        api = SalesAPI()
        full_sale = api.get_sale(sale_id)

        if not full_sale:
            QMessageBox.warning(
                self,
                "Error",
                "No se pudo cargar los datos de la venta."
            )
            return

        # Obtener factura completa
        afip_invoices_full = full_sale.get("afipInvoices", [])
        if not afip_invoices_full:
            QMessageBox.warning(
                self,
                "Error",
                "No se encontraron datos de factura."
            )
            return

        invoice_data = afip_invoices_full[0]
        afip_config = invoice_data.get("afipConfig", {})
        sales_point = invoice_data.get("salesPoint", {})

        # Abrir dialogo de factura para reimprimir
        from src.ui.dialogs.invoice_dialog import InvoiceDialog, InvoiceData, SaleForInvoice

        # Crear datos de factura desde la venta
        # El total viene de la venta, no de la factura
        sale_total = float(full_sale.get("total", 0))

        invoice = InvoiceData(
            id=invoice_data.get("id", ""),
            voucher_type=invoice_data.get("voucherType", "FACTURA_B"),
            number=invoice_data.get("number", 0),
            cae=invoice_data.get("cae", ""),
            cae_expiration=invoice_data.get("caeExpiration", ""),
            sales_point_number=sales_point.get("number", 0) if sales_point else 0,
            total=sale_total,
            receiver_name=invoice_data.get("receiverName", "Consumidor Final"),
            receiver_doc_num=invoice_data.get("receiverDocNum", "0"),
            issue_date=invoice_data.get("issueDate", ""),
            cuit=afip_config.get("cuit", ""),
            business_name=afip_config.get("businessName", ""),
            trade_name=afip_config.get("tradeName"),
            address=afip_config.get("address", ""),
            tax_category=afip_config.get("taxCategory", ""),
        )

        # Crear datos de venta con items
        sale = SaleForInvoice(
            id=full_sale.get("id", ""),
            sale_number=full_sale.get("saleNumber", ""),
            items=full_sale.get("items", []),
        )

        # Crear dialogo en modo visualizacion
        dialog = InvoiceDialog(
            sale_id=full_sale.get("id", ""),
            sale_number=full_sale.get("saleNumber", ""),
            total=float(full_sale.get("total", 0)),
            parent=self,
        )

        # Establecer datos de factura directamente (sin emitir nueva)
        dialog.invoice = invoice
        dialog.sale_data = sale
        dialog._show_invoice_view()

        dialog.exec()

    def _show_refund_dialog(self) -> None:
        """Muestra el dialogo de devolucion."""
        if not self.selected_sale:
            return

        try:
            # Cargar venta completa
            sale_id = self.selected_sale.get("id", "")
            api = SalesAPI()
            sale = api.get_sale(sale_id)

            if not sale:
                QMessageBox.warning(self, "Error", "No se pudo cargar la venta.")
                return

            # Verificar estado
            status = sale.get("status", "")
            if status == "REFUNDED":
                QMessageBox.warning(
                    self,
                    "Venta Devuelta",
                    "Esta venta ya fue devuelta completamente."
                )
                return

            if status == "CANCELLED":
                QMessageBox.warning(
                    self,
                    "Venta Anulada",
                    "No se puede procesar devolucion de una venta anulada."
                )
                return

            # Abrir dialogo de devolucion
            dialog = RefundDialog(sale, self)
            dialog.refund_processed.connect(self._on_refund_processed)
            dialog.exec()

        except Exception as e:
            logger.error(f"Error abriendo dialogo de devolucion: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"Error al abrir dialogo de devolucion: {str(e)}"
            )

    def _on_refund_processed(self, result: dict) -> None:
        """Maneja la finalizacion de una devolucion."""
        # Recargar ventas para reflejar cambios
        self._load_sales(self.current_page)

    def closeEvent(self, event) -> None:
        """Maneja el cierre del dialogo."""
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.worker.wait()
        super().closeEvent(event)
