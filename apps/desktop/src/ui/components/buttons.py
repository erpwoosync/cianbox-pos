"""
Botones estilizados para el POS.

Proporciona botones con estilos consistentes para:
- Acciones primarias
- Acciones secundarias
- Acciones peligrosas
- Botones de icono

Uso:
    >>> from src.ui.components import PrimaryButton, DangerButton
    >>> btn = PrimaryButton("Cobrar")
    >>> btn.clicked.connect(handle_checkout)
"""

from typing import Optional

from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QIcon, QFont
from PyQt6.QtWidgets import QPushButton, QSizePolicy

from src.config.constants import COLORS


class BaseButton(QPushButton):
    """
    Boton base con estilos personalizados.

    Attributes:
        background_color: Color de fondo
        hover_color: Color al pasar el mouse
        text_color: Color del texto
        border_radius: Radio del borde
    """

    def __init__(
        self,
        text: str = "",
        parent=None,
        min_height: int = 40,
        font_size: int = 14,
    ):
        super().__init__(text, parent)
        self.setMinimumHeight(min_height)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setSizePolicy(
            QSizePolicy.Policy.Expanding,
            QSizePolicy.Policy.Fixed,
        )

        # Fuente
        font = self.font()
        font.setPointSize(font_size)
        font.setWeight(QFont.Weight.Medium)
        self.setFont(font)

    def _apply_style(
        self,
        bg_color: str,
        hover_color: str,
        text_color: str,
        border_radius: int = 6,
    ) -> None:
        """Aplica estilo al boton."""
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: {bg_color};
                color: {text_color};
                border: none;
                border-radius: {border_radius}px;
                padding: 8px 16px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {hover_color};
            }}
            QPushButton:pressed {{
                background-color: {bg_color};
            }}
            QPushButton:disabled {{
                background-color: {COLORS['gray_300']};
                color: {COLORS['gray_500']};
            }}
        """)


class PrimaryButton(BaseButton):
    """
    Boton de accion primaria.

    Usado para acciones principales como "Cobrar", "Guardar", etc.
    """

    def __init__(self, text: str = "", parent=None, **kwargs):
        super().__init__(text, parent, **kwargs)
        self._apply_style(
            bg_color=COLORS["primary"],
            hover_color=COLORS["primary_light"],
            text_color=COLORS["white"],
        )


class SecondaryButton(BaseButton):
    """
    Boton de accion secundaria.

    Usado para acciones alternativas como "Cancelar", "Volver", etc.
    """

    def __init__(self, text: str = "", parent=None, **kwargs):
        super().__init__(text, parent, **kwargs)
        self._apply_style(
            bg_color=COLORS["gray_200"],
            hover_color=COLORS["gray_300"],
            text_color=COLORS["text_primary"],
        )


class DangerButton(BaseButton):
    """
    Boton de accion peligrosa.

    Usado para acciones destructivas como "Eliminar", "Anular", etc.
    """

    def __init__(self, text: str = "", parent=None, **kwargs):
        super().__init__(text, parent, **kwargs)
        self._apply_style(
            bg_color=COLORS["danger"],
            hover_color=COLORS["danger_light"],
            text_color=COLORS["white"],
        )


class SuccessButton(BaseButton):
    """
    Boton de accion exitosa.

    Usado para confirmaciones como "Confirmar", "Aceptar", etc.
    """

    def __init__(self, text: str = "", parent=None, **kwargs):
        super().__init__(text, parent, **kwargs)
        self._apply_style(
            bg_color=COLORS["success"],
            hover_color=COLORS["success_light"],
            text_color=COLORS["white"],
        )


class IconButton(QPushButton):
    """
    Boton con solo icono.

    Usado para acciones rapidas como "Buscar", "Agregar", etc.
    """

    def __init__(
        self,
        icon: QIcon,
        parent=None,
        size: int = 36,
        tooltip: str = "",
    ):
        super().__init__(parent)
        self.setIcon(icon)
        self.setIconSize(QSize(size - 12, size - 12))
        self.setFixedSize(size, size)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        if tooltip:
            self.setToolTip(tooltip)

        self.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                border: none;
                border-radius: {size // 2}px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['gray_200']};
            }}
            QPushButton:pressed {{
                background-color: {COLORS['gray_300']};
            }}
        """)


class FunctionKeyButton(BaseButton):
    """
    Boton de tecla de funcion (F1-F12).

    Muestra la tecla y la accion correspondiente.
    """

    def __init__(
        self,
        key: str,
        action: str,
        parent=None,
        min_height: int = 50,
    ):
        super().__init__("", parent, min_height=min_height, font_size=10)
        self._key = key
        self._action = action
        self._update_text()

        self.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['gray_100']};
                color: {COLORS['text_primary']};
                border: 1px solid {COLORS['border']};
                border-radius: 4px;
                padding: 4px 8px;
                text-align: center;
            }}
            QPushButton:hover {{
                background-color: {COLORS['gray_200']};
                border-color: {COLORS['primary']};
            }}
            QPushButton:pressed {{
                background-color: {COLORS['gray_300']};
            }}
        """)

    def _update_text(self) -> None:
        """Actualiza el texto del boton."""
        self.setText(f"{self._key}\n{self._action}")


class QuickAccessButton(QPushButton):
    """
    Boton de acceso rapido a categoria/producto.

    Usado en la grilla de acceso rapido del POS.
    """

    def __init__(
        self,
        text: str,
        parent=None,
        color: Optional[str] = None,
        size: int = 80,
    ):
        super().__init__(text, parent)
        self.setFixedSize(size, size)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        bg_color = color or COLORS["secondary"]

        # Determinar color de texto segun luminosidad del fondo
        text_color = COLORS["white"]

        self.setStyleSheet(f"""
            QPushButton {{
                background-color: {bg_color};
                color: {text_color};
                border: none;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 500;
                padding: 8px;
            }}
            QPushButton:hover {{
                opacity: 0.9;
            }}
            QPushButton:pressed {{
                opacity: 0.8;
            }}
        """)

        # Ajustar texto
        font = self.font()
        font.setPointSize(10)
        self.setFont(font)
