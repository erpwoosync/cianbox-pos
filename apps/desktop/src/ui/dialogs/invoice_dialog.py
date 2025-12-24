"""
Dialogo de facturacion electronica AFIP.

Permite emitir facturas electronicas despues de una venta.
"""

from typing import Optional, List
from dataclasses import dataclass
import base64
import json

from PyQt6.QtWidgets import (
    QDialog,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QScrollArea,
    QMessageBox,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont, QPixmap
from PyQt6.QtNetwork import QNetworkAccessManager, QNetworkRequest, QNetworkReply
from PyQt6.QtCore import QUrl
from loguru import logger

from src.ui.styles import get_theme
from src.api.afip import AfipAPI, InvoiceResult, InvoiceData, SaleForInvoice


class InvoiceWorker(QThread):
    """Worker para emitir factura en background."""

    finished = pyqtSignal(object)  # InvoiceResult
    error = pyqtSignal(str)

    def __init__(self, sale_id: str, receiver_name: Optional[str] = None):
        super().__init__()
        self.sale_id = sale_id
        self.receiver_name = receiver_name

    def run(self):
        try:
            api = AfipAPI()
            result = api.invoice_from_sale(
                sale_id=self.sale_id,
                receiver_name=self.receiver_name,
            )
            self.finished.emit(result)
        except Exception as e:
            logger.error(f"Error en worker de facturacion: {e}")
            self.error.emit(str(e))


class InvoiceDialog(QDialog):
    """
    Dialogo para emitir factura electronica AFIP.

    Muestra opciones post-venta:
    - Emitir factura electronica
    - Ver factura emitida
    - Imprimir comprobante
    """

    def __init__(
        self,
        sale_id: str,
        sale_number: str,
        total: float,
        customer_name: Optional[str] = None,
        parent: QWidget = None,
    ):
        super().__init__(parent)

        self.sale_id = sale_id
        self.sale_number = sale_number
        self.total = total
        self.customer_name = customer_name or "Consumidor Final"
        self.theme = get_theme()

        # Estado
        self.invoice: Optional[InvoiceData] = None
        self.sale_data: Optional[SaleForInvoice] = None
        self.worker: Optional[InvoiceWorker] = None
        self.network_manager = QNetworkAccessManager()

        # Configurar dialogo
        self.setWindowTitle("Facturar Venta")
        self.setModal(True)
        self.setMinimumSize(500, 600)
        self.resize(550, 700)

        self._setup_ui()

        logger.info(f"Dialogo de facturacion abierto - Venta: {sale_number}")

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
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(24, 24, 24, 24)
        self.content_layout.setSpacing(16)

        # Vista inicial (preguntar si facturar)
        self._show_initial_view()

        main_layout.addWidget(self.content_widget, 1)

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

        # Icono y titulo
        title = QLabel("Facturar Venta")
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

    def _show_initial_view(self) -> None:
        """Muestra la vista inicial preguntando si facturar."""
        # Limpiar contenido anterior
        self._clear_content()

        # Icono de exito
        icon_frame = QFrame()
        icon_frame.setFixedSize(80, 80)
        icon_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.success_bg};
                border-radius: 40px;
            }}
        """)
        icon_layout = QVBoxLayout(icon_frame)
        icon_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        icon_label = QLabel("[OK]")
        icon_label.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        icon_label.setStyleSheet(f"color: {self.theme.success};")
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon_layout.addWidget(icon_label)

        icon_container = QWidget()
        icon_container_layout = QHBoxLayout(icon_container)
        icon_container_layout.addStretch()
        icon_container_layout.addWidget(icon_frame)
        icon_container_layout.addStretch()
        self.content_layout.addWidget(icon_container)

        # Titulo
        title = QLabel("Venta Completada")
        title.setFont(QFont("Segoe UI", 20, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.content_layout.addWidget(title)

        # Numero de venta
        sale_label = QLabel(f"#{self.sale_number}")
        sale_label.setFont(QFont("Segoe UI", 14))
        sale_label.setStyleSheet(f"color: {self.theme.gray_500};")
        sale_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.content_layout.addWidget(sale_label)

        # Total
        total_label = QLabel(f"${self.total:,.2f}")
        total_label.setFont(QFont("Segoe UI", 32, QFont.Weight.Bold))
        total_label.setStyleSheet(f"color: {self.theme.success};")
        total_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.content_layout.addWidget(total_label)

        # Mensaje de error (oculto inicialmente)
        self.error_frame = QFrame()
        self.error_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.danger_bg};
                border: 1px solid {self.theme.danger};
                border-radius: 8px;
            }}
        """)
        error_layout = QHBoxLayout(self.error_frame)
        error_layout.setContentsMargins(12, 8, 12, 8)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet(f"color: {self.theme.danger}; font-size: 13px;")
        self.error_label.setWordWrap(True)
        error_layout.addWidget(self.error_label)

        self.content_layout.addWidget(self.error_frame)
        self.error_frame.hide()

        self.content_layout.addSpacing(16)

        # Pregunta
        question = QLabel("Deseas emitir factura electronica?")
        question.setStyleSheet(f"color: {self.theme.gray_600}; font-size: 14px;")
        question.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.content_layout.addWidget(question)

        self.content_layout.addStretch()

        # Botones
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        # No, gracias
        no_btn = QPushButton("No, gracias")
        no_btn.setFixedHeight(50)
        no_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        no_btn.setFont(QFont("Segoe UI", 14))
        no_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_200};
            }}
        """)
        no_btn.clicked.connect(self.close)
        buttons_layout.addWidget(no_btn)

        # Facturar
        self.invoice_btn = QPushButton("Facturar")
        self.invoice_btn.setFixedHeight(50)
        self.invoice_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.invoice_btn.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.invoice_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background-color: {self.theme.gray_300};
            }}
        """)
        self.invoice_btn.clicked.connect(self._emit_invoice)
        buttons_layout.addWidget(self.invoice_btn)

        self.content_layout.addLayout(buttons_layout)

    def _emit_invoice(self) -> None:
        """Emite la factura electronica."""
        self.invoice_btn.setEnabled(False)
        self.invoice_btn.setText("Emitiendo...")
        self.error_frame.hide()

        # Crear worker
        self.worker = InvoiceWorker(
            sale_id=self.sale_id,
            receiver_name=self.customer_name,
        )
        self.worker.finished.connect(self._on_invoice_result)
        self.worker.error.connect(self._on_invoice_error)
        self.worker.start()

    def _on_invoice_result(self, result: InvoiceResult) -> None:
        """Maneja el resultado de la facturacion."""
        if result.success and result.invoice:
            self.invoice = result.invoice
            self.sale_data = result.sale
            logger.info(f"Factura emitida: CAE {result.invoice.cae}")
            self._show_invoice_view()
        else:
            self._on_invoice_error(result.error or "Error desconocido")

    def _on_invoice_error(self, error: str) -> None:
        """Maneja errores de facturacion."""
        logger.error(f"Error emitiendo factura: {error}")
        self.invoice_btn.setEnabled(True)
        self.invoice_btn.setText("Facturar")

        self.error_label.setText(error)
        self.error_frame.show()

    def _show_invoice_view(self) -> None:
        """Muestra la factura emitida."""
        self._clear_content()

        if not self.invoice:
            return

        # Mensaje de exito
        success_frame = QFrame()
        success_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.success_bg};
                border: 1px solid {self.theme.success};
                border-radius: 8px;
            }}
        """)
        success_layout = QHBoxLayout(success_frame)
        success_layout.setContentsMargins(12, 8, 12, 8)

        success_label = QLabel("[OK] Factura emitida correctamente")
        success_label.setStyleSheet(f"color: {self.theme.success_dark}; font-size: 14px; font-weight: 600;")
        success_layout.addWidget(success_label)

        self.content_layout.addWidget(success_frame)

        # Scroll area para la factura
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(f"""
            QScrollArea {{
                border: 1px solid {self.theme.border};
                border-radius: 8px;
                background-color: white;
            }}
        """)

        # Contenido de la factura (formato ticket)
        invoice_widget = self._create_invoice_content()
        scroll.setWidget(invoice_widget)

        self.content_layout.addWidget(scroll, 1)

        # Botones
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        # Cerrar
        close_btn = QPushButton("Cerrar")
        close_btn.setFixedHeight(50)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setFont(QFont("Segoe UI", 14))
        close_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.gray_100};
                color: {self.theme.text_primary};
                border: 1px solid {self.theme.border};
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.gray_200};
            }}
        """)
        close_btn.clicked.connect(self.close)
        buttons_layout.addWidget(close_btn)

        # Imprimir
        print_btn = QPushButton("Imprimir")
        print_btn.setFixedHeight(50)
        print_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        print_btn.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        print_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 8px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        print_btn.clicked.connect(self._print_invoice)
        buttons_layout.addWidget(print_btn)

        self.content_layout.addLayout(buttons_layout)

    def _create_invoice_content(self) -> QWidget:
        """Crea el contenido de la factura para visualizar."""
        widget = QWidget()
        widget.setStyleSheet("background-color: white;")

        layout = QVBoxLayout(widget)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(8)

        inv = self.invoice

        # Header - Nombre comercial
        business_name = inv.trade_name or inv.business_name
        header_label = QLabel(business_name)
        header_label.setFont(QFont("Courier New", 12, QFont.Weight.Bold))
        header_label.setStyleSheet("color: black;")
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(header_label)

        if inv.trade_name and inv.business_name:
            razon_label = QLabel(inv.business_name)
            razon_label.setFont(QFont("Courier New", 9))
            razon_label.setStyleSheet("color: black;")
            razon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(razon_label)

        # Direccion
        if inv.address:
            address_label = QLabel(inv.address)
            address_label.setFont(QFont("Courier New", 9))
            address_label.setStyleSheet("color: black;")
            address_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(address_label)

        # CUIT
        cuit_label = QLabel(f"CUIT: {inv.cuit}")
        cuit_label.setFont(QFont("Courier New", 9))
        cuit_label.setStyleSheet("color: black;")
        cuit_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(cuit_label)

        # Categoria fiscal
        tax_cat = self._format_tax_category(inv.tax_category)
        tax_label = QLabel(tax_cat)
        tax_label.setFont(QFont("Courier New", 9))
        tax_label.setStyleSheet("color: black;")
        tax_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(tax_label)

        # Separador
        layout.addWidget(self._separator())

        # Tipo de comprobante
        voucher_letter = self._get_voucher_letter(inv.voucher_type)
        voucher_frame = QFrame()
        voucher_frame.setStyleSheet("border: 2px solid black; padding: 4px;")
        voucher_frame.setFixedHeight(40)
        voucher_layout = QVBoxLayout(voucher_frame)
        voucher_layout.setContentsMargins(0, 0, 0, 0)

        voucher_label = QLabel(f"FACTURA {voucher_letter}")
        voucher_label.setFont(QFont("Courier New", 16, QFont.Weight.Bold))
        voucher_label.setStyleSheet("color: black; border: none;")
        voucher_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        voucher_layout.addWidget(voucher_label)

        layout.addWidget(voucher_frame)

        # Numero de comprobante
        num_str = f"{inv.sales_point_number:04d}-{inv.number:08d}"
        num_label = QLabel(f"Nro: {num_str}")
        num_label.setFont(QFont("Courier New", 11, QFont.Weight.Bold))
        num_label.setStyleSheet("color: black;")
        num_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(num_label)

        # Separador
        layout.addWidget(self._separator())

        # Fecha
        date_str = self._format_date(inv.issue_date)
        row_date = self._info_row("Fecha:", date_str)
        layout.addLayout(row_date)

        # Cliente
        row_client = self._info_row("Cliente:", inv.receiver_name)
        layout.addLayout(row_client)

        # DNI/CUIT del cliente
        if inv.receiver_doc_num and inv.receiver_doc_num != "0":
            row_doc = self._info_row("DNI/CUIT:", inv.receiver_doc_num)
            layout.addLayout(row_doc)

        # Separador
        layout.addWidget(self._separator())

        # Detalle
        detail_title = QLabel("DETALLE")
        detail_title.setFont(QFont("Courier New", 10, QFont.Weight.Bold))
        detail_title.setStyleSheet("color: black;")
        layout.addWidget(detail_title)

        # Tabla de items
        if self.sale_data and self.sale_data.items:
            table = QTableWidget()
            table.setColumnCount(3)
            table.setHorizontalHeaderLabels(["Descripcion", "Cant", "Importe"])
            table.horizontalHeader().setStyleSheet("font-family: Courier New; font-size: 9px;")
            table.setRowCount(len(self.sale_data.items))
            table.setStyleSheet("""
                QTableWidget {
                    border: none;
                    background-color: white;
                    font-family: Courier New;
                    font-size: 9px;
                }
                QTableWidget::item {
                    padding: 2px;
                }
                QHeaderView::section {
                    background-color: white;
                    border: none;
                    border-bottom: 1px solid black;
                    font-weight: bold;
                }
            """)
            table.verticalHeader().setVisible(False)
            table.setShowGrid(False)

            for i, item in enumerate(self.sale_data.items):
                name = item.get("productName", "Producto")
                qty = item.get("quantity", 1)
                subtotal = item.get("subtotal", 0)

                table.setItem(i, 0, QTableWidgetItem(name[:25]))
                table.setItem(i, 1, QTableWidgetItem(str(int(qty))))
                table.setItem(i, 2, QTableWidgetItem(f"${float(subtotal):.2f}"))

            table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
            table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
            table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
            table.setColumnWidth(1, 40)
            table.setColumnWidth(2, 70)

            table.setFixedHeight(min(30 + len(self.sale_data.items) * 25, 200))

            layout.addWidget(table)

        # Separador
        layout.addWidget(self._separator())

        # Total
        total_row = QHBoxLayout()
        total_text = QLabel("TOTAL:")
        total_text.setFont(QFont("Courier New", 12, QFont.Weight.Bold))
        total_text.setStyleSheet("color: black;")
        total_row.addWidget(total_text)

        total_value = QLabel(f"${inv.total:,.2f}")
        total_value.setFont(QFont("Courier New", 14, QFont.Weight.Bold))
        total_value.setStyleSheet("color: black;")
        total_value.setAlignment(Qt.AlignmentFlag.AlignRight)
        total_row.addWidget(total_value)

        layout.addLayout(total_row)

        # Separador
        layout.addWidget(self._separator())

        # CAE
        cae_label = QLabel(f"CAE: {inv.cae}")
        cae_label.setFont(QFont("Courier New", 9, QFont.Weight.Bold))
        cae_label.setStyleSheet("color: black;")
        layout.addWidget(cae_label)

        # Vto CAE
        cae_vto = self._format_date(inv.cae_expiration)
        cae_vto_label = QLabel(f"Vto CAE: {cae_vto}")
        cae_vto_label.setFont(QFont("Courier New", 9, QFont.Weight.Bold))
        cae_vto_label.setStyleSheet("color: black;")
        layout.addWidget(cae_vto_label)

        # QR Code
        layout.addSpacing(8)
        self.qr_label = QLabel("[Cargando QR...]")
        self.qr_label.setFixedSize(100, 100)
        self.qr_label.setStyleSheet("color: gray;")
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        qr_container = QWidget()
        qr_container_layout = QHBoxLayout(qr_container)
        qr_container_layout.addStretch()
        qr_container_layout.addWidget(self.qr_label)
        qr_container_layout.addStretch()
        layout.addWidget(qr_container)

        # Cargar QR
        self._load_qr_code()

        # Footer
        layout.addWidget(self._separator())
        footer = QLabel("Comprobante Autorizado - AFIP")
        footer.setFont(QFont("Courier New", 8))
        footer.setStyleSheet("color: gray;")
        footer.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(footer)

        layout.addStretch()

        return widget

    def _separator(self) -> QFrame:
        """Crea un separador punteado."""
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet("background-color: black;")
        return sep

    def _info_row(self, label: str, value: str) -> QHBoxLayout:
        """Crea una fila de informacion."""
        row = QHBoxLayout()

        label_widget = QLabel(label)
        label_widget.setFont(QFont("Courier New", 9, QFont.Weight.Bold))
        label_widget.setStyleSheet("color: black;")
        row.addWidget(label_widget)

        value_widget = QLabel(value)
        value_widget.setFont(QFont("Courier New", 9))
        value_widget.setStyleSheet("color: black;")
        value_widget.setAlignment(Qt.AlignmentFlag.AlignRight)
        row.addWidget(value_widget)

        return row

    def _format_date(self, date_str: str) -> str:
        """Formatea fecha AFIP."""
        if not date_str:
            return ""

        # Formato YYYYMMDD de AFIP
        if len(date_str) == 8 and date_str.isdigit():
            return f"{date_str[6:8]}/{date_str[4:6]}/{date_str[0:4]}"

        # Formato ISO
        if "T" in date_str:
            date_part = date_str.split("T")[0]
            parts = date_part.split("-")
            if len(parts) == 3:
                return f"{parts[2]}/{parts[1]}/{parts[0]}"

        return date_str

    def _format_tax_category(self, category: str) -> str:
        """Formatea categoria fiscal."""
        categories = {
            "RESPONSABLE_INSCRIPTO": "IVA Responsable Inscripto",
            "MONOTRIBUTO": "Monotributista",
            "EXENTO": "IVA Exento",
            "CONSUMIDOR_FINAL": "Consumidor Final",
        }
        return categories.get(category, category)

    def _get_voucher_letter(self, voucher_type: str) -> str:
        """Obtiene la letra del comprobante."""
        if "_A" in voucher_type:
            return "A"
        if "_B" in voucher_type:
            return "B"
        if "_C" in voucher_type:
            return "C"
        return "X"

    def _get_qr_url(self) -> str:
        """Genera la URL del QR de AFIP."""
        if not self.invoice:
            return ""

        inv = self.invoice

        # Determinar tipo de comprobante
        voucher_code = 6  # Default: Factura B
        if "FACTURA_A" in inv.voucher_type:
            voucher_code = 1
        elif "FACTURA_C" in inv.voucher_type:
            voucher_code = 11

        # Formatear fecha
        date_str = inv.issue_date
        if len(date_str) == 8:
            formatted_date = f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
        elif "T" in date_str:
            formatted_date = date_str.split("T")[0]
        else:
            formatted_date = date_str

        data = {
            "ver": 1,
            "fecha": formatted_date,
            "cuit": inv.cuit.replace("-", "").replace(" ", ""),
            "ptoVta": inv.sales_point_number,
            "tipoCmp": voucher_code,
            "nroCmp": inv.number,
            "importe": inv.total,
            "moneda": "PES",
            "ctz": 1,
            "tipoDocRec": 99 if inv.receiver_doc_num == "0" else 96,
            "nroDocRec": int(inv.receiver_doc_num) if inv.receiver_doc_num.isdigit() else 0,
            "tipoCodAut": "E",
            "codAut": int(inv.cae),
        }

        json_data = json.dumps(data)
        base64_data = base64.b64encode(json_data.encode()).decode()

        return f"https://www.afip.gob.ar/fe/qr/?p={base64_data}"

    def _load_qr_code(self) -> None:
        """Carga la imagen del QR."""
        qr_url = self._get_qr_url()
        if not qr_url:
            self.qr_label.setText("[QR no disponible]")
            return

        # URL del servicio QR
        qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=100x100&data={qr_url}"

        request = QNetworkRequest(QUrl(qr_image_url))
        reply = self.network_manager.get(request)
        reply.finished.connect(lambda: self._on_qr_loaded(reply))

    def _on_qr_loaded(self, reply: QNetworkReply) -> None:
        """Maneja la carga del QR."""
        if reply.error() == QNetworkReply.NetworkError.NoError:
            data = reply.readAll()
            pixmap = QPixmap()
            pixmap.loadFromData(data.data())

            if not pixmap.isNull():
                self.qr_label.setPixmap(pixmap)
            else:
                self.qr_label.setText("[QR]")
        else:
            self.qr_label.setText("[QR]")

        reply.deleteLater()

    def _print_invoice(self) -> None:
        """Imprime la factura."""
        if not self.invoice:
            return

        try:
            from PyQt6.QtPrintSupport import QPrinter, QPrintDialog
            from PyQt6.QtGui import QPainter, QTextDocument
            from PyQt6.QtCore import QSizeF, QRectF, QMarginsF

            printer = QPrinter(QPrinter.PrinterMode.HighResolution)

            dialog = QPrintDialog(printer, self)
            if dialog.exec() == QDialog.DialogCode.Accepted:
                # Crear documento HTML para imprimir
                html = self._generate_print_html()

                doc = QTextDocument()
                doc.setHtml(html)

                # Configurar tamano de pagina
                page_rect = printer.pageRect(QPrinter.Unit.DevicePixel)
                doc.setPageSize(QSizeF(page_rect.size()))

                # Usar QPainter para imprimir (compatible con todas las versiones de PyQt6)
                painter = QPainter()
                if painter.begin(printer):
                    # Escalar para ajustar al papel
                    scale_x = page_rect.width() / doc.size().width()
                    scale_y = page_rect.height() / doc.size().height()
                    scale = min(scale_x, scale_y, 1.0)  # No escalar hacia arriba

                    painter.scale(scale, scale)

                    # Dibujar el documento
                    doc.drawContents(painter)

                    painter.end()

                    logger.info("Factura impresa correctamente")
                    QMessageBox.information(self, "Impresion", "Factura enviada a imprimir")
                else:
                    raise Exception("No se pudo iniciar la impresion")

        except Exception as e:
            logger.error(f"Error al imprimir: {e}")
            QMessageBox.warning(self, "Error", f"No se pudo imprimir: {str(e)}")

    def _generate_print_html(self) -> str:
        """Genera HTML para impresion."""
        if not self.invoice:
            return ""

        inv = self.invoice
        voucher_letter = self._get_voucher_letter(inv.voucher_type)
        num_str = f"{inv.sales_point_number:04d}-{inv.number:08d}"
        date_str = self._format_date(inv.issue_date)
        cae_vto = self._format_date(inv.cae_expiration)

        items_html = ""
        if self.sale_data and self.sale_data.items:
            for item in self.sale_data.items:
                name = item.get("productName", "Producto")
                qty = item.get("quantity", 1)
                subtotal = item.get("subtotal", 0)
                items_html += f"""
                    <tr>
                        <td>{name}</td>
                        <td style="text-align: center;">{int(qty)}</td>
                        <td style="text-align: right;">${float(subtotal):.2f}</td>
                    </tr>
                """

        qr_url = self._get_qr_url()
        qr_img = f"https://api.qrserver.com/v1/create-qr-code/?size=100x100&data={qr_url}"

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Courier New', monospace;
                    font-size: 10px;
                    width: 72mm;
                    margin: 0;
                    padding: 3mm;
                }}
                .header {{
                    text-align: center;
                    border-bottom: 1px dashed black;
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }}
                .header h1 {{
                    font-size: 12px;
                    margin: 0;
                }}
                .voucher-type {{
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    border: 2px solid black;
                    padding: 4px;
                    margin: 8px 0;
                }}
                .total {{
                    font-size: 14px;
                    font-weight: bold;
                    text-align: right;
                    border-top: 1px dashed black;
                    border-bottom: 1px dashed black;
                    padding: 6px 0;
                    margin: 6px 0;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                }}
                th, td {{
                    padding: 2px;
                    font-size: 9px;
                }}
                th {{
                    border-bottom: 1px solid black;
                    text-align: left;
                }}
                .qr {{
                    text-align: center;
                    margin: 8px 0;
                }}
                .footer {{
                    text-align: center;
                    font-size: 8px;
                    border-top: 1px dashed black;
                    padding-top: 6px;
                    margin-top: 8px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>{inv.trade_name or inv.business_name}</h1>
                {f'<p>{inv.business_name}</p>' if inv.trade_name else ''}
                <p>{inv.address}</p>
                <p>CUIT: {inv.cuit}</p>
                <p>{self._format_tax_category(inv.tax_category)}</p>
            </div>

            <div class="voucher-type">FACTURA {voucher_letter}</div>

            <p style="text-align: center; font-weight: bold;">Nro: {num_str}</p>

            <p><b>Fecha:</b> {date_str}</p>
            <p><b>Cliente:</b> {inv.receiver_name}</p>
            {f'<p><b>DNI/CUIT:</b> {inv.receiver_doc_num}</p>' if inv.receiver_doc_num != '0' else ''}

            <h3>Detalle</h3>
            <table>
                <tr>
                    <th>Descripcion</th>
                    <th style="text-align: center;">Cant</th>
                    <th style="text-align: right;">Importe</th>
                </tr>
                {items_html}
            </table>

            <div class="total">TOTAL: ${inv.total:,.2f}</div>

            <p><b>CAE:</b> {inv.cae}</p>
            <p><b>Vto CAE:</b> {cae_vto}</p>

            <div class="qr">
                <img src="{qr_img}" width="90" height="90" />
            </div>

            <div class="footer">Comprobante Autorizado - AFIP</div>
        </body>
        </html>
        """

        return html

    def _clear_content(self) -> None:
        """Limpia el contenido del dialogo."""
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
            elif item.layout():
                self._clear_layout(item.layout())

    def _clear_layout(self, layout) -> None:
        """Limpia un layout recursivamente."""
        while layout.count():
            item = layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
            elif item.layout():
                self._clear_layout(item.layout())

    def closeEvent(self, event) -> None:
        """Maneja el cierre del dialogo."""
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.worker.wait()
        super().closeEvent(event)
