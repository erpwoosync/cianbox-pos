"""
Componentes reutilizables de UI.

Widgets personalizados para la aplicacion POS.

Uso:
    >>> from src.ui.components import PrimaryButton, SearchBox, PriceDisplay
    >>> btn = PrimaryButton("Cobrar")
    >>> search = SearchBox(placeholder="Buscar producto...")
    >>> price = PriceDisplay(Decimal("1234.56"))

Exports:
    Botones:
        - BaseButton: Boton base para heredar
        - PrimaryButton: Boton de accion primaria
        - SecondaryButton: Boton de accion secundaria
        - DangerButton: Boton de accion peligrosa
        - SuccessButton: Boton de confirmacion
        - IconButton: Boton con solo icono
        - FunctionKeyButton: Boton de tecla de funcion
        - QuickAccessButton: Boton de acceso rapido

    Inputs:
        - SearchBox: Caja de busqueda con debounce
        - QuantitySpinner: Selector de cantidad +/-
        - MoneyInput: Entrada de montos
        - BarcodeInput: Entrada de codigos de barras

    Displays:
        - PriceDisplay: Muestra precios formateados
        - TotalDisplay: Muestra total de venta
        - StatusBadge: Badge de estado
        - ItemCountBadge: Badge de cantidad
        - ConnectionStatus: Indicador de conexion
"""

from .buttons import (
    BaseButton,
    PrimaryButton,
    SecondaryButton,
    DangerButton,
    SuccessButton,
    IconButton,
    FunctionKeyButton,
    QuickAccessButton,
)

from .inputs import (
    SearchBox,
    QuantitySpinner,
    MoneyInput,
    BarcodeInput,
)

from .displays import (
    PriceDisplay,
    TotalDisplay,
    StatusBadge,
    ItemCountBadge,
    ConnectionStatus,
)

from .sidebar import (
    Sidebar,
    SidebarNavButton,
    NavItem,
)

__all__ = [
    # Botones
    "BaseButton",
    "PrimaryButton",
    "SecondaryButton",
    "DangerButton",
    "SuccessButton",
    "IconButton",
    "FunctionKeyButton",
    "QuickAccessButton",
    # Inputs
    "SearchBox",
    "QuantitySpinner",
    "MoneyInput",
    "BarcodeInput",
    # Displays
    "PriceDisplay",
    "TotalDisplay",
    "StatusBadge",
    "ItemCountBadge",
    "ConnectionStatus",
    # Sidebar
    "Sidebar",
    "SidebarNavButton",
    "NavItem",
]
