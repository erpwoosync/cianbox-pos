"""
Dialogo de seleccion de cliente.

Permite buscar y seleccionar un cliente para asociarlo a la venta.
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
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QAbstractItemView,
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont
from loguru import logger

from src.models import Customer


class CustomerDialog(QDialog):
    """
    Dialogo para buscar y seleccionar clientes.

    Permite:
    - Buscar por nombre, documento, email, telefono
    - Ver detalles del cliente (credito, descuento)
    - Seleccionar un cliente para la venta
    - Opcion de "Consumidor Final" para ventas anonimas
    """

    def __init__(self, sync_service, theme, parent=None):
        super().__init__(parent)

        self.sync_service = sync_service
        self.theme = theme
        self.selected_customer: Optional[Customer] = None
        self._search_timer: Optional[QTimer] = None

        self._setup_ui()
        self._load_initial_customers()

    def _setup_ui(self) -> None:
        """Configura la interfaz del dialogo."""
        self.setWindowTitle("Seleccionar Cliente")
        self.setMinimumSize(800, 500)
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
        title = QLabel("Seleccionar Cliente")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary}; border: none;")
        layout.addWidget(title)

        layout.addStretch()

        # Campo de busqueda
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Buscar por nombre, CUIT, email o telefono...")
        self.search_input.setFixedSize(350, 40)
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

    def _create_content(self) -> QFrame:
        """Crea el contenido principal."""
        content = QFrame()
        layout = QHBoxLayout(content)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(16)

        # Tabla de clientes
        table_container = self._create_table()
        layout.addWidget(table_container, 2)

        # Panel de detalle
        detail_panel = self._create_detail_panel()
        layout.addWidget(detail_panel, 1)

        return content

    def _create_table(self) -> QFrame:
        """Crea la tabla de clientes."""
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
        self.customers_table = QTableWidget()
        self.customers_table.setColumnCount(4)
        self.customers_table.setHorizontalHeaderLabels([
            "Nombre", "Documento", "Email", "Telefono"
        ])
        self.customers_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.customers_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.customers_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.customers_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.customers_table.setColumnWidth(1, 130)
        self.customers_table.setColumnWidth(2, 180)
        self.customers_table.setColumnWidth(3, 120)

        self.customers_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.customers_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.customers_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.customers_table.verticalHeader().setVisible(False)
        self.customers_table.setAlternatingRowColors(True)

        self.customers_table.setStyleSheet(f"""
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

        self.customers_table.itemSelectionChanged.connect(self._on_customer_selected)
        self.customers_table.doubleClicked.connect(self._on_customer_double_clicked)

        layout.addWidget(self.customers_table)
        return container

    def _create_detail_panel(self) -> QFrame:
        """Crea el panel de detalle del cliente."""
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
        title = QLabel("Detalle del Cliente")
        title.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {self.theme.text_primary};")
        layout.addWidget(title)

        # Contenedor de detalle
        self.detail_container = QFrame()
        self.detail_layout = QVBoxLayout(self.detail_container)
        self.detail_layout.setContentsMargins(0, 0, 0, 0)
        self.detail_layout.setSpacing(8)

        # Mensaje inicial
        no_selection = QLabel("Selecciona un cliente\npara ver los detalles")
        no_selection.setAlignment(Qt.AlignmentFlag.AlignCenter)
        no_selection.setStyleSheet(f"color: {self.theme.gray_400}; font-size: 13px;")
        self.detail_layout.addWidget(no_selection)
        self.detail_layout.addStretch()

        layout.addWidget(self.detail_container, 1)

        return panel

    def _create_footer(self) -> QFrame:
        """Crea el footer con botones."""
        footer = QFrame()
        layout = QHBoxLayout(footer)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Contador de resultados
        self.results_label = QLabel("0 clientes encontrados")
        self.results_label.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        layout.addWidget(self.results_label)

        layout.addStretch()

        # Boton Consumidor Final
        consumer_btn = QPushButton("Consumidor Final")
        consumer_btn.setFixedSize(150, 40)
        consumer_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        consumer_btn.setStyleSheet(f"""
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
        consumer_btn.clicked.connect(self._on_consumer_final)
        layout.addWidget(consumer_btn)

        # Boton seleccionar
        self.select_btn = QPushButton("Seleccionar")
        self.select_btn.setFixedSize(120, 40)
        self.select_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.select_btn.setEnabled(False)
        self.select_btn.setStyleSheet(f"""
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
        self.select_btn.clicked.connect(self._on_select)
        layout.addWidget(self.select_btn)

        # Boton cerrar
        close_btn = QPushButton("Cancelar")
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

    def _load_initial_customers(self) -> None:
        """Carga clientes iniciales (recientes o primeros)."""
        try:
            customers = self.sync_service.get_local_customers(limit=50)
            self._update_table(customers)
            self.search_input.setFocus()
        except Exception as e:
            logger.error(f"Error cargando clientes: {e}")
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
                customers = self.sync_service.get_local_customers(search=query, limit=100)
            else:
                customers = self.sync_service.get_local_customers(limit=50)

            self._update_table(customers)
        except Exception as e:
            logger.error(f"Error en busqueda: {e}")
            self.results_label.setText(f"Error: {e}")

    def _update_table(self, customers: list) -> None:
        """Actualiza la tabla con los clientes."""
        self.customers_table.setRowCount(len(customers))

        for row, customer in enumerate(customers):
            # Nombre
            name = customer.display_name or customer.name or "-"
            name_item = QTableWidgetItem(name)
            self.customers_table.setItem(row, 0, name_item)

            # Documento
            doc = customer.tax_id or "-"
            doc_item = QTableWidgetItem(doc)
            self.customers_table.setItem(row, 1, doc_item)

            # Email
            email = customer.email or "-"
            email_item = QTableWidgetItem(email)
            self.customers_table.setItem(row, 2, email_item)

            # Telefono
            phone = customer.mobile or customer.phone or "-"
            phone_item = QTableWidgetItem(phone)
            self.customers_table.setItem(row, 3, phone_item)

            # Guardar referencia al cliente
            name_item.setData(Qt.ItemDataRole.UserRole, customer)

        self.results_label.setText(f"{len(customers)} clientes encontrados")
        self.selected_customer = None
        self.select_btn.setEnabled(False)

    def _on_customer_selected(self) -> None:
        """Maneja la seleccion de un cliente."""
        try:
            selected = self.customers_table.selectedItems()
            if not selected:
                return

            row = selected[0].row()
            customer = self.customers_table.item(row, 0).data(Qt.ItemDataRole.UserRole)

            if customer:
                self.selected_customer = customer
                self.select_btn.setEnabled(True)
                self._show_customer_detail(customer)
        except Exception as e:
            logger.error(f"Error al seleccionar cliente: {e}")

    def _show_customer_detail(self, customer: Customer) -> None:
        """Muestra los detalles del cliente."""
        # Limpiar contenedor
        while self.detail_layout.count():
            item = self.detail_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        # Nombre
        name = QLabel(customer.display_name or customer.name)
        name.setWordWrap(True)
        name.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        name.setStyleSheet(f"color: {self.theme.text_primary};")
        self.detail_layout.addWidget(name)

        # Tipo de cliente
        customer_type = customer.customer_type or "CONSUMER"
        type_labels = {
            "CONSUMER": "Consumidor Final",
            "INDIVIDUAL": "Persona Fisica",
            "BUSINESS": "Empresa",
            "GOVERNMENT": "Gobierno",
            "RESELLER": "Revendedor",
        }
        type_label = QLabel(type_labels.get(customer_type, customer_type))
        type_label.setStyleSheet(f"""
            background-color: {self.theme.primary_bg};
            color: {self.theme.primary};
            font-weight: 600;
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
        """)
        type_label.setFixedHeight(24)
        self.detail_layout.addWidget(type_label)

        # Documento
        if customer.tax_id:
            self._add_detail_row("Documento:", customer.tax_info)

        # Categoria fiscal
        if customer.tax_category:
            self._add_detail_row("Cat. Fiscal:", customer.tax_category)

        # Contacto
        if customer.email:
            self._add_detail_row("Email:", customer.email)
        if customer.phone:
            self._add_detail_row("Telefono:", customer.phone)
        if customer.mobile:
            self._add_detail_row("Celular:", customer.mobile)

        # Direccion
        if customer.address:
            address_parts = [customer.address]
            if customer.city:
                address_parts.append(customer.city)
            if customer.state:
                address_parts.append(customer.state)
            self._add_detail_row("Direccion:", ", ".join(address_parts))

        # Credito
        if customer.has_credit:
            credit_frame = QFrame()
            credit_frame.setStyleSheet(f"""
                QFrame {{
                    background-color: {self.theme.success}20;
                    border: 1px solid {self.theme.success};
                    border-radius: 6px;
                    padding: 8px;
                }}
            """)
            credit_layout = QVBoxLayout(credit_frame)
            credit_layout.setContentsMargins(12, 8, 12, 8)
            credit_layout.setSpacing(4)

            credit_title = QLabel("Credito habilitado")
            credit_title.setStyleSheet(f"color: {self.theme.success}; font-weight: 700; font-size: 12px;")
            credit_layout.addWidget(credit_title)

            limit_text = f"Limite: ${float(customer.credit_limit):,.2f}"
            limit_label = QLabel(limit_text)
            limit_label.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 11px;")
            credit_layout.addWidget(limit_label)

            available = float(customer.available_credit)
            avail_text = f"Disponible: ${available:,.2f}"
            avail_label = QLabel(avail_text)
            avail_color = self.theme.success if available > 0 else self.theme.danger
            avail_label.setStyleSheet(f"color: {avail_color}; font-weight: 600; font-size: 11px;")
            credit_layout.addWidget(avail_label)

            self.detail_layout.addWidget(credit_frame)

        # Descuento global
        if customer.global_discount and float(customer.global_discount) > 0:
            discount_label = QLabel(f"Descuento: {float(customer.global_discount)}%")
            discount_label.setStyleSheet(f"""
                background-color: {self.theme.warning}20;
                color: {self.theme.warning};
                font-weight: 600;
                font-size: 12px;
                padding: 6px 10px;
                border-radius: 4px;
            """)
            self.detail_layout.addWidget(discount_label)

        self.detail_layout.addStretch()

    def _add_detail_row(self, label: str, value: str) -> None:
        """Agrega una fila de detalle."""
        row = QHBoxLayout()
        row.setSpacing(8)

        lbl = QLabel(label)
        lbl.setStyleSheet(f"color: {self.theme.gray_500}; font-size: 12px;")
        lbl.setFixedWidth(90)
        row.addWidget(lbl)

        val = QLabel(value)
        val.setStyleSheet(f"color: {self.theme.text_primary}; font-size: 12px;")
        val.setWordWrap(True)
        row.addWidget(val, 1)

        container = QFrame()
        container.setLayout(row)
        self.detail_layout.addWidget(container)

    def _on_customer_double_clicked(self) -> None:
        """Maneja doble click en un cliente."""
        if self.selected_customer:
            self._on_select()

    def _on_consumer_final(self) -> None:
        """Selecciona Consumidor Final (sin cliente especifico)."""
        self.selected_customer = None
        self.accept()

    def _on_select(self) -> None:
        """Confirma la seleccion del cliente."""
        if self.selected_customer:
            self.accept()

    def get_selected_customer(self) -> Optional[Customer]:
        """
        Obtiene el cliente seleccionado.

        Returns:
            Customer seleccionado o None si es Consumidor Final
        """
        return self.selected_customer
