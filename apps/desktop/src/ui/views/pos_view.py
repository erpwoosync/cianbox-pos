"""
Vista del punto de venta.

Contenedor para el layout de categorias, productos y carrito.
Esta vista es populada por MainWindow con los componentes existentes.
"""

from typing import Optional

from PyQt6.QtWidgets import QWidget, QHBoxLayout
from PyQt6.QtCore import pyqtSignal

from loguru import logger


class POSView(QWidget):
    """
    Vista principal del punto de venta.

    Esta es una vista contenedora que MainWindow usa para
    organizar las categorias, productos y carrito.

    El layout es horizontal:
    [Categorias] [Productos Grid] [Carrito]
    """

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._setup_ui()
        logger.debug("POSView inicializado")

    def _setup_ui(self) -> None:
        """Configura el layout base."""
        self.layout = QHBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)
        self.layout.setSpacing(0)

    def add_sidebar(self, widget: QWidget) -> None:
        """Agrega el sidebar de categorias."""
        self.layout.addWidget(widget)

    def add_products_panel(self, widget: QWidget) -> None:
        """Agrega el panel de productos con stretch."""
        self.layout.addWidget(widget, 1)

    def add_cart_panel(self, widget: QWidget) -> None:
        """Agrega el panel del carrito."""
        self.layout.addWidget(widget)
