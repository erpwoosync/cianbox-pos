"""
Sistema de temas para la aplicacion.

Define colores, fuentes y estilos reutilizables.
"""

from dataclasses import dataclass, field
from typing import Dict, Optional

from src.config.constants import COLORS


@dataclass
class Theme:
    """
    Tema de la aplicacion.

    Define todos los colores y estilos usados en la UI.
    """

    # Nombre del tema
    name: str = "default"

    # Colores primarios
    primary: str = COLORS["primary"]
    primary_light: str = COLORS["primary_light"]
    primary_dark: str = COLORS["primary_dark"]
    primary_bg: str = COLORS["primary_bg"]

    # Colores secundarios
    secondary: str = COLORS["secondary"]
    secondary_light: str = COLORS["secondary_light"]
    secondary_dark: str = COLORS["secondary_dark"]

    # Estados
    success: str = COLORS["success"]
    success_light: str = COLORS["success_light"]
    success_dark: str = COLORS["success_dark"]
    success_bg: str = COLORS["success_bg"]

    warning: str = COLORS["warning"]
    warning_light: str = COLORS["warning_light"]
    warning_dark: str = COLORS["warning_dark"]
    warning_bg: str = COLORS["warning_bg"]

    danger: str = COLORS["danger"]
    danger_light: str = COLORS["danger_light"]
    danger_dark: str = COLORS["danger_dark"]
    danger_bg: str = COLORS["danger_bg"]

    info: str = COLORS["info"]
    info_light: str = COLORS["info_light"]
    info_dark: str = COLORS["info_dark"]
    info_bg: str = COLORS["info_bg"]

    # Fondos
    background: str = COLORS["background"]
    background_secondary: str = COLORS["background_secondary"]
    surface: str = COLORS["surface"]
    surface_variant: str = COLORS["gray_100"]  # Variante más oscura de surface

    # Bordes
    border: str = COLORS["border"]
    border_light: str = COLORS["border_light"]
    border_focus: str = COLORS["border_focus"]
    divider: str = COLORS["gray_200"]  # Color para divisores/separadores

    # Alias de estados
    error: str = COLORS["danger"]  # Alias para danger

    # Texto
    text_primary: str = COLORS["text_primary"]
    text_secondary: str = COLORS["text_secondary"]
    text_muted: str = COLORS["text_muted"]
    text_inverse: str = COLORS["text_inverse"]
    text: str = COLORS["text_primary"]  # Alias para text_primary

    # Escala de grises
    gray_50: str = COLORS["gray_50"]
    gray_100: str = COLORS["gray_100"]
    gray_200: str = COLORS["gray_200"]
    gray_300: str = COLORS["gray_300"]
    gray_400: str = COLORS["gray_400"]
    gray_500: str = COLORS["gray_500"]
    gray_600: str = COLORS["gray_600"]
    gray_700: str = COLORS["gray_700"]
    gray_800: str = COLORS["gray_800"]
    gray_900: str = COLORS["gray_900"]

    # Fuentes
    font_family: str = "Segoe UI, sans-serif"
    font_size_xs: int = 11
    font_size_sm: int = 12
    font_size_md: int = 14
    font_size_lg: int = 16
    font_size_xl: int = 20
    font_size_2xl: int = 24
    font_size_3xl: int = 30

    # Espaciado
    spacing_xs: int = 4
    spacing_sm: int = 8
    spacing_md: int = 12
    spacing_lg: int = 16
    spacing_xl: int = 24
    spacing_2xl: int = 32

    # Bordes redondeados
    radius_sm: int = 4
    radius_md: int = 6
    radius_lg: int = 8
    radius_xl: int = 12
    radius_full: int = 9999

    # Sombras
    shadow_sm: str = "0 1px 2px rgba(0,0,0,0.05)"
    shadow_md: str = "0 4px 6px rgba(0,0,0,0.1)"
    shadow_lg: str = "0 10px 15px rgba(0,0,0,0.1)"

    # Transiciones
    transition_fast: str = "0.1s ease"
    transition_normal: str = "0.2s ease"
    transition_slow: str = "0.3s ease"

    def get_button_style(
        self,
        variant: str = "primary",
        size: str = "md",
    ) -> str:
        """
        Genera estilo para un boton.

        Args:
            variant: primary, secondary, success, danger, warning, ghost
            size: sm, md, lg

        Returns:
            String QSS con el estilo
        """
        # Colores segun variante
        colors = {
            "primary": (self.primary, self.primary_dark, self.text_inverse),
            "secondary": (self.gray_200, self.gray_300, self.text_primary),
            "success": (self.success, self.success_dark, self.text_inverse),
            "danger": (self.danger, self.danger_dark, self.text_inverse),
            "warning": (self.warning, self.warning_dark, self.text_primary),
            "ghost": ("transparent", self.gray_100, self.text_primary),
        }

        bg, hover_bg, text = colors.get(variant, colors["primary"])

        # Tamanos
        sizes = {
            "sm": (8, 12, self.font_size_sm, 32),
            "md": (10, 16, self.font_size_md, 40),
            "lg": (12, 20, self.font_size_lg, 48),
        }

        padding_v, padding_h, font_size, min_height = sizes.get(size, sizes["md"])

        return f"""
            QPushButton {{
                background-color: {bg};
                color: {text};
                border: none;
                border-radius: {self.radius_md}px;
                padding: {padding_v}px {padding_h}px;
                font-size: {font_size}px;
                font-weight: 500;
                min-height: {min_height}px;
            }}
            QPushButton:hover {{
                background-color: {hover_bg};
            }}
            QPushButton:pressed {{
                background-color: {hover_bg};
            }}
            QPushButton:disabled {{
                background-color: {self.gray_300};
                color: {self.gray_500};
            }}
        """

    def get_input_style(self, size: str = "md") -> str:
        """
        Genera estilo para inputs.

        Args:
            size: sm, md, lg

        Returns:
            String QSS con el estilo
        """
        sizes = {
            "sm": (8, 10, self.font_size_sm, 32),
            "md": (10, 12, self.font_size_md, 40),
            "lg": (12, 14, self.font_size_lg, 48),
        }

        padding_v, padding_h, font_size, min_height = sizes.get(size, sizes["md"])

        return f"""
            QLineEdit {{
                background-color: {self.surface};
                color: {self.text_primary};
                border: 2px solid {self.border};
                border-radius: {self.radius_md}px;
                padding: {padding_v}px {padding_h}px;
                font-size: {font_size}px;
                min-height: {min_height - padding_v * 2 - 4}px;
            }}
            QLineEdit:focus {{
                border-color: {self.primary};
            }}
            QLineEdit:disabled {{
                background-color: {self.gray_100};
                color: {self.gray_500};
            }}
            QLineEdit::placeholder {{
                color: {self.gray_400};
            }}
        """

    def get_card_style(self) -> str:
        """Genera estilo para cards/frames."""
        return f"""
            QFrame[class="card"] {{
                background-color: {self.surface};
                border: 1px solid {self.border};
                border-radius: {self.radius_lg}px;
            }}
        """

    def get_label_style(self, variant: str = "default") -> str:
        """
        Genera estilo para labels.

        Args:
            variant: default, title, subtitle, caption, error

        Returns:
            String QSS con el estilo
        """
        styles = {
            "default": (self.text_primary, self.font_size_md, "normal"),
            "title": (self.text_primary, self.font_size_2xl, "bold"),
            "subtitle": (self.text_primary, self.font_size_lg, "600"),
            "caption": (self.text_muted, self.font_size_sm, "normal"),
            "error": (self.danger, self.font_size_sm, "normal"),
            "success": (self.success, self.font_size_sm, "normal"),
        }

        color, size, weight = styles.get(variant, styles["default"])

        return f"""
            QLabel {{
                color: {color};
                font-size: {size}px;
                font-weight: {weight};
            }}
        """


_theme_instance: Optional[Theme] = None


def get_theme() -> Theme:
    """
    Obtiene el tema actual (singleton).

    Returns:
        Instancia de Theme
    """
    global _theme_instance
    if _theme_instance is None:
        _theme_instance = Theme(name="dark_material")
    return _theme_instance


def reload_theme() -> Theme:
    """
    Recarga el tema (util para cambios en tiempo de ejecucion).

    Returns:
        Nueva instancia de Theme
    """
    global _theme_instance
    _theme_instance = Theme(name="dark_material")
    return _theme_instance
