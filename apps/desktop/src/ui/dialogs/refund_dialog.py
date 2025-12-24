"""
Dialogo de devolucion de ventas.

Permite procesar devoluciones parciales o totales con nota de credito.
"""

from typing import Optional, List

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
    QTextEdit,
    QCheckBox,
    QSpinBox,
    QDoubleSpinBox,
    QAbstractItemView,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont

from loguru import logger

from src.ui.styles import get_theme
from src.api.sales import SalesAPI


class RefundWorker(QThread):
    """Worker para procesar devolucion en background."""

    finished = pyqtSignal(dict)
    error = pyqtSignal(str)

    def __init__(
        self,
        sale_id: str,
        items: List[dict],
        reason: str,
        emit_credit_note: bool,
        sales_point_id: Optional[str] = None,
    ):
        super().__init__()
        self.sale_id = sale_id
        self.items = items
        self.reason = reason
        self.emit_credit_note = emit_credit_note
        self.sales_point_id = sales_point_id

    def run(self):
        try:
            api = SalesAPI()
            result = api.refund_sale(
                sale_id=self.sale_id,
                items=self.items,
                reason=self.reason,
                emit_credit_note=self.emit_credit_note,
                sales_point_id=self.sales_point_id,
            )

            if result.get("success"):
                self.finished.emit(result.get("data", {}))
            else:
                self.error.emit(result.get("error", "Error desconocido"))

        except Exception as e:
            logger.error(f"Error procesando devolucion: {e}")
            self.error.emit(str(e))


class RefundDialog(QDialog):
    """
    Dialogo de devolucion de ventas.

    Permite seleccionar items a devolver y procesar la devolucion.
    """

    refund_processed = pyqtSignal(dict)  # Emitido cuando se procesa la devolucion

    def __init__(self, sale: dict, parent: QWidget = None):
        super().__init__(parent)

        self.theme = get_theme()
        self.sale = sale
        self.sale_items = sale.get("items", [])
        self.worker: Optional[RefundWorker] = None
        self.quantity_spinboxes: dict = {}

        # Configurar dialogo
        self.setWindowTitle(f"Devolucion - Venta #{sale.get('saleNumber', '')}")
        self.setModal(True)
        self.setMinimumSize(700, 500)
        self.resize(750, 550)

        self._setup_ui()

        logger.info(f"Dialogo de devolucion abierto para venta {sale.get('id')}")

    def _setup_ui(self) -> None:
        """Configura la interfaz de usuario."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {self.theme.background};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)

        # Header
        header = self._create_header()
        layout.addWidget(header)

        # Info de la venta
        info = self._create_sale_info()
        layout.addWidget(info)

        # Tabla de items
        self.items_table = self._create_items_table()
        layout.addWidget(self.items_table, 1)

        # Motivo
        reason_section = self._create_reason_section()
        layout.addWidget(reason_section)

        # Opciones
        options_section = self._create_options_section()
        layout.addWidget(options_section)

        # Resumen y botones
        footer = self._create_footer()
        layout.addWidget(footer)

    def _create_header(self) -> QFrame:
        """Crea el header del dialogo."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-radius: 8px;
                padding: 10px;
            }}
        """)

        layout = QHBoxLayout(frame)

        title = QLabel("Procesar Devolucion")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text};")
        layout.addWidget(title)

        layout.addStretch()

        # Botones de seleccion
        select_all_btn = QPushButton("Seleccionar Todo")
        select_all_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.primary};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.primary_dark};
            }}
        """)
        select_all_btn.clicked.connect(self._select_all_items)
        layout.addWidget(select_all_btn)

        deselect_btn = QPushButton("Deseleccionar")
        deselect_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.surface_variant};
                color: {self.theme.text};
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.divider};
            }}
        """)
        deselect_btn.clicked.connect(self._deselect_all_items)
        layout.addWidget(deselect_btn)

        return frame

    def _create_sale_info(self) -> QFrame:
        """Crea seccion de info de la venta."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-radius: 8px;
                padding: 10px;
            }}
        """)

        layout = QHBoxLayout(frame)

        # Numero de venta
        sale_num = QLabel(f"Venta: #{self.sale.get('saleNumber', 'N/A')}")
        sale_num.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        sale_num.setStyleSheet(f"color: {self.theme.text};")
        layout.addWidget(sale_num)

        layout.addStretch()

        # Fecha
        fecha = self.sale.get("createdAt", "")
        if fecha:
            from datetime import datetime
            try:
                dt = datetime.fromisoformat(fecha.replace("Z", "+00:00"))
                fecha_str = dt.strftime("%d/%m/%Y %H:%M")
            except:
                fecha_str = fecha[:10] if len(fecha) > 10 else fecha
        else:
            fecha_str = "N/A"

        fecha_label = QLabel(f"Fecha: {fecha_str}")
        fecha_label.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 12px;")
        layout.addWidget(fecha_label)

        layout.addSpacing(20)

        # Total original
        total = float(self.sale.get("total", 0))
        total_label = QLabel(f"Total: ${total:,.2f}")
        total_label.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        total_label.setStyleSheet(f"color: {self.theme.success};")
        layout.addWidget(total_label)

        return frame

    def _create_items_table(self) -> QTableWidget:
        """Crea la tabla de items."""
        table = QTableWidget()
        table.setColumnCount(6)
        table.setHorizontalHeaderLabels([
            "Devolver", "Producto", "Cant. Original", "Cant. Devolver", "P. Unit.", "Subtotal"
        ])

        # Estilos
        table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {self.theme.surface};
                border: 1px solid {self.theme.divider};
                border-radius: 8px;
                gridline-color: {self.theme.divider};
            }}
            QTableWidget::item {{
                padding: 8px;
                color: {self.theme.text};
            }}
            QHeaderView::section {{
                background-color: {self.theme.surface_variant};
                color: {self.theme.text};
                padding: 10px;
                border: none;
                font-weight: bold;
            }}
        """)

        table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        table.verticalHeader().setVisible(False)

        # Configurar columnas
        header = table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)

        table.setColumnWidth(0, 70)
        table.setColumnWidth(2, 100)
        table.setColumnWidth(3, 120)
        table.setColumnWidth(4, 100)
        table.setColumnWidth(5, 100)

        # Llenar tabla
        table.setRowCount(len(self.sale_items))
        for row, item in enumerate(self.sale_items):
            # Checkbox
            checkbox = QCheckBox()
            checkbox.setChecked(True)
            checkbox.stateChanged.connect(lambda state, r=row: self._on_checkbox_changed(r, state))
            checkbox_widget = QWidget()
            checkbox_layout = QHBoxLayout(checkbox_widget)
            checkbox_layout.addWidget(checkbox)
            checkbox_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
            checkbox_layout.setContentsMargins(0, 0, 0, 0)
            table.setCellWidget(row, 0, checkbox_widget)

            # Producto
            product_name = item.get("productName", "Producto")
            table.setItem(row, 1, QTableWidgetItem(product_name))

            # Cantidad original
            qty = float(item.get("quantity", 1))
            qty_item = QTableWidgetItem(f"{qty:.0f}" if qty == int(qty) else f"{qty:.2f}")
            qty_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            table.setItem(row, 2, qty_item)

            # Spinbox cantidad a devolver
            spinbox = QDoubleSpinBox()
            spinbox.setMinimum(0)
            spinbox.setMaximum(qty)
            spinbox.setValue(qty)
            spinbox.setDecimals(2 if qty != int(qty) else 0)
            spinbox.setSingleStep(1)
            spinbox.setStyleSheet(f"""
                QDoubleSpinBox {{
                    background-color: {self.theme.background};
                    color: {self.theme.text};
                    border: 1px solid {self.theme.divider};
                    border-radius: 4px;
                    padding: 4px;
                }}
            """)
            spinbox.valueChanged.connect(self._update_totals)
            self.quantity_spinboxes[item.get("id")] = spinbox
            table.setCellWidget(row, 3, spinbox)

            # Precio unitario
            unit_price = float(item.get("unitPrice", 0))
            price_item = QTableWidgetItem(f"${unit_price:,.2f}")
            price_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            table.setItem(row, 4, price_item)

            # Subtotal (se actualiza dinamicamente)
            subtotal = qty * unit_price
            subtotal_item = QTableWidgetItem(f"${subtotal:,.2f}")
            subtotal_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            table.setItem(row, 5, subtotal_item)

        return table

    def _create_reason_section(self) -> QFrame:
        """Crea seccion del motivo de devolucion."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-radius: 8px;
                padding: 10px;
            }}
        """)

        layout = QVBoxLayout(frame)

        label = QLabel("Motivo de la devolucion *")
        label.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        label.setStyleSheet(f"color: {self.theme.text};")
        layout.addWidget(label)

        self.reason_input = QTextEdit()
        self.reason_input.setPlaceholderText("Ingrese el motivo de la devolucion...")
        self.reason_input.setMaximumHeight(60)
        self.reason_input.setStyleSheet(f"""
            QTextEdit {{
                background-color: {self.theme.background};
                color: {self.theme.text};
                border: 1px solid {self.theme.divider};
                border-radius: 4px;
                padding: 8px;
            }}
        """)
        layout.addWidget(self.reason_input)

        return frame

    def _create_options_section(self) -> QFrame:
        """Crea seccion de opciones."""
        frame = QFrame()
        frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.surface};
                border-radius: 8px;
                padding: 10px;
            }}
        """)

        layout = QHBoxLayout(frame)

        # Checkbox nota de credito
        self.credit_note_checkbox = QCheckBox("Emitir Nota de Credito AFIP")
        self.credit_note_checkbox.setChecked(True)
        self.credit_note_checkbox.setStyleSheet(f"""
            QCheckBox {{
                color: {self.theme.text};
                font-size: 12px;
            }}
        """)
        layout.addWidget(self.credit_note_checkbox)

        # Verificar si la venta tiene factura
        afip_invoices = self.sale.get("afipInvoices", [])
        if not afip_invoices:
            self.credit_note_checkbox.setChecked(False)
            self.credit_note_checkbox.setEnabled(False)
            note = QLabel("(Venta sin factura electronica)")
            note.setStyleSheet(f"color: {self.theme.text_secondary}; font-size: 11px;")
            layout.addWidget(note)

        layout.addStretch()

        return frame

    def _create_footer(self) -> QFrame:
        """Crea el footer con resumen y botones."""
        frame = QFrame()
        layout = QHBoxLayout(frame)

        # Resumen
        summary_frame = QFrame()
        summary_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {self.theme.error}20;
                border: 1px solid {self.theme.error};
                border-radius: 8px;
                padding: 10px;
            }}
        """)
        summary_layout = QHBoxLayout(summary_frame)

        items_label = QLabel("Items a devolver:")
        items_label.setStyleSheet(f"color: {self.theme.text}; font-size: 12px;")
        summary_layout.addWidget(items_label)

        self.items_count_label = QLabel("0")
        self.items_count_label.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        self.items_count_label.setStyleSheet(f"color: {self.theme.error};")
        summary_layout.addWidget(self.items_count_label)

        summary_layout.addSpacing(30)

        total_label = QLabel("Total a devolver:")
        total_label.setStyleSheet(f"color: {self.theme.text}; font-size: 12px;")
        summary_layout.addWidget(total_label)

        self.refund_total_label = QLabel("$0.00")
        self.refund_total_label.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.refund_total_label.setStyleSheet(f"color: {self.theme.error};")
        summary_layout.addWidget(self.refund_total_label)

        layout.addWidget(summary_frame)
        layout.addStretch()

        # Botones
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.surface_variant};
                color: {self.theme.text};
                border: none;
                border-radius: 4px;
                padding: 12px 24px;
                font-size: 13px;
            }}
            QPushButton:hover {{
                background-color: {self.theme.divider};
            }}
        """)
        cancel_btn.clicked.connect(self.reject)
        layout.addWidget(cancel_btn)

        self.process_btn = QPushButton("Procesar Devolucion")
        self.process_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.theme.error};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 12px 24px;
                font-size: 13px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #c62828;
            }}
            QPushButton:disabled {{
                background-color: {self.theme.divider};
                color: {self.theme.text_secondary};
            }}
        """)
        self.process_btn.clicked.connect(self._process_refund)
        layout.addWidget(self.process_btn)

        # Actualizar totales iniciales
        self._update_totals()

        return frame

    def _on_checkbox_changed(self, row: int, state: int) -> None:
        """Maneja cambio en checkbox de item."""
        item = self.sale_items[row]
        spinbox = self.quantity_spinboxes.get(item.get("id"))

        if spinbox:
            if state == Qt.CheckState.Checked.value:
                spinbox.setEnabled(True)
            else:
                spinbox.setEnabled(False)
                spinbox.setValue(0)

        self._update_totals()

    def _select_all_items(self) -> None:
        """Selecciona todos los items."""
        for row in range(self.items_table.rowCount()):
            checkbox_widget = self.items_table.cellWidget(row, 0)
            if checkbox_widget:
                checkbox = checkbox_widget.findChild(QCheckBox)
                if checkbox:
                    checkbox.setChecked(True)

            # Restaurar cantidad original
            item = self.sale_items[row]
            spinbox = self.quantity_spinboxes.get(item.get("id"))
            if spinbox:
                spinbox.setValue(float(item.get("quantity", 1)))

    def _deselect_all_items(self) -> None:
        """Deselecciona todos los items."""
        for row in range(self.items_table.rowCount()):
            checkbox_widget = self.items_table.cellWidget(row, 0)
            if checkbox_widget:
                checkbox = checkbox_widget.findChild(QCheckBox)
                if checkbox:
                    checkbox.setChecked(False)

    def _update_totals(self) -> None:
        """Actualiza los totales de devolucion."""
        total = 0.0
        items_count = 0

        for row, item in enumerate(self.sale_items):
            spinbox = self.quantity_spinboxes.get(item.get("id"))
            if spinbox:
                qty = spinbox.value()
                if qty > 0:
                    unit_price = float(item.get("unitPrice", 0))
                    discount = float(item.get("discount", 0))

                    # Calcular subtotal con descuento
                    subtotal = qty * unit_price * (1 - discount / 100)
                    total += subtotal
                    items_count += 1

                    # Actualizar celda de subtotal
                    subtotal_item = self.items_table.item(row, 5)
                    if subtotal_item:
                        subtotal_item.setText(f"${subtotal:,.2f}")
                else:
                    subtotal_item = self.items_table.item(row, 5)
                    if subtotal_item:
                        subtotal_item.setText("$0.00")

        self.items_count_label.setText(str(items_count))
        self.refund_total_label.setText(f"${total:,.2f}")

        # Habilitar/deshabilitar boton
        self.process_btn.setEnabled(items_count > 0)

    def _process_refund(self) -> None:
        """Procesa la devolucion."""
        # Validar motivo
        reason = self.reason_input.toPlainText().strip()
        if not reason:
            QMessageBox.warning(
                self,
                "Motivo Requerido",
                "Debe ingresar el motivo de la devolucion.",
            )
            self.reason_input.setFocus()
            return

        # Recopilar items a devolver
        items_to_refund = []
        for item in self.sale_items:
            spinbox = self.quantity_spinboxes.get(item.get("id"))
            if spinbox and spinbox.value() > 0:
                items_to_refund.append({
                    "saleItemId": item.get("id"),
                    "quantity": spinbox.value(),
                })

        if not items_to_refund:
            QMessageBox.warning(
                self,
                "Sin Items",
                "Debe seleccionar al menos un item para devolver.",
            )
            return

        # Confirmar
        reply = QMessageBox.question(
            self,
            "Confirmar Devolucion",
            f"Esta por procesar una devolucion de {len(items_to_refund)} item(s).\n\n"
            f"Esta accion no se puede deshacer.\n\n"
            f"¿Desea continuar?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        # Deshabilitar UI
        self.process_btn.setEnabled(False)
        self.process_btn.setText("Procesando...")

        # Obtener punto de venta de la factura original
        afip_invoices = self.sale.get("afipInvoices", [])
        sales_point_id = None
        if afip_invoices:
            sales_point_id = afip_invoices[0].get("salesPointId")

        # Procesar en background
        self.worker = RefundWorker(
            sale_id=self.sale.get("id"),
            items=items_to_refund,
            reason=reason,
            emit_credit_note=self.credit_note_checkbox.isChecked(),
            sales_point_id=sales_point_id,
        )
        self.worker.finished.connect(self._on_refund_success)
        self.worker.error.connect(self._on_refund_error)
        self.worker.start()

    def _on_refund_success(self, result: dict) -> None:
        """Maneja exito de devolucion."""
        logger.info("Devolucion procesada exitosamente")

        data = result.get("data", {})
        refund_amount = data.get("refundAmount", 0)
        credit_note = data.get("creditNote")
        is_full_refund = data.get("isFullRefund", False)

        message = f"Devolucion procesada correctamente.\n\n"
        message += f"Monto devuelto: ${refund_amount:,.2f}\n"
        message += f"Tipo: {'Devolucion Total' if is_full_refund else 'Devolucion Parcial'}\n"

        if credit_note:
            message += f"\nNota de Credito: #{credit_note.get('voucherNumber', 'N/A')}\n"
            message += f"CAE: {credit_note.get('cae', 'N/A')}"

        QMessageBox.information(
            self,
            "Devolucion Exitosa",
            message,
        )

        self.refund_processed.emit(result)
        self.accept()

    def _on_refund_error(self, error: str) -> None:
        """Maneja error de devolucion."""
        logger.error(f"Error en devolucion: {error}")

        self.process_btn.setEnabled(True)
        self.process_btn.setText("Procesar Devolucion")

        QMessageBox.critical(
            self,
            "Error",
            f"Error al procesar devolucion:\n\n{error}",
        )
