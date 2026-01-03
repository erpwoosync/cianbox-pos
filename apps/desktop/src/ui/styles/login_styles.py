"""
Estilos para la ventana de login.

Este modulo centraliza todos los estilos QSS usados en la pantalla de login,
separando la logica de presentacion de la logica de negocio.

Todos los estilos usan unidades 'em' para escalado relativo al font-size base.
Esto permite que la UI escale proporcionalmente si se cambia el tamano de fuente.

Equivalencias con font-size base de 16px:
    - 0.125em = 2px   (bordes finos)
    - 0.25em  = 4px   (espaciado xs)
    - 0.375em = 6px   (espaciado sm)
    - 0.5em   = 8px   (espaciado md, border-radius)
    - 0.625em = 10px  (fuente pequena)
    - 0.75em  = 12px  (fuente caption)
    - 0.8125em = 13px (fuente input)
    - 0.875em = 14px  (fuente normal)
    - 1em     = 16px  (fuente base)
    - 1.25em  = 20px  (fuente grande)
    - 1.875em = 30px  (altura input)
    - 2em     = 32px  (icono grande)
    - 2.25em  = 36px  (border-radius circulo)

Uso:
    from src.ui.styles import get_login_styles

    styles = get_login_styles()
    widget.setStyleSheet(styles.input_container())
"""

from .theme import get_theme


class LoginStyles:
    """
    Clase que encapsula todos los estilos de la ventana de login.

    Cada metodo retorna un string QSS listo para usar con setStyleSheet().
    Los estilos estan organizados por componente/seccion de la UI.
    """

    def __init__(self):
        """Inicializa los estilos con el tema actual."""
        self.theme = get_theme()

    # =========================================================================
    # COMPONENTE: IconLineEdit (campo de entrada con icono)
    # =========================================================================

    def input_container(self, has_error: bool = False) -> str:
        """
        Contenedor del input con icono.

        Es el QFrame que envuelve al icono + QLineEdit.
        Tiene borde redondeado y cambia de color en focus/error.

        Args:
            has_error: Si True, muestra borde rojo de error

        Returns:
            QSS para QFrame#inputContainer
        """
        border_color = self.theme.danger if has_error else self.theme.border
        return f"""
            QFrame#inputContainer {{
                background-color: {self.theme.surface};
                border: 0.125em solid {border_color};
                border-radius: 0.5em;
                min-height: 1.875em;
                max-height: 1.875em;
            }}
            QFrame#inputContainer:focus-within {{
                border-color: {self.theme.primary};
            }}
        """

    def input_icon(self, has_error: bool = False) -> str:
        """
        Icono a la izquierda del input (emoji unicode).

        Args:
            has_error: Si True, muestra icono en rojo

        Returns:
            QSS para QLabel del icono
        """
        color = self.theme.danger if has_error else self.theme.gray_400
        return f"""
            color: {color};
            font-size: 0.875em;
            font-family: 'Segoe UI Symbol', 'Segoe UI Emoji', sans-serif;
        """

    def input_field(self) -> str:
        """
        Campo de texto editable.

        Sin bordes propios ya que el contenedor maneja el borde.
        Fondo transparente para integrarse con el contenedor.

        Returns:
            QSS para QLineEdit
        """
        return f"""
            QLineEdit {{
                background-color: transparent;
                border: none;
                color: {self.theme.text_primary};
                font-size: 0.8125em;
                padding: 0;
                min-height: 1.25em;
            }}
            QLineEdit::placeholder {{
                color: {self.theme.gray_400};
            }}
        """

    def password_toggle(self) -> str:
        """
        Boton para mostrar/ocultar password.

        Aparece solo en campos de password, a la derecha.

        Returns:
            QSS para QPushButton toggle
        """
        return f"""
            QPushButton {{
                background-color: transparent;
                border: none;
                color: {self.theme.gray_400};
                font-size: 0.625em;
            }}
            QPushButton:hover {{
                color: {self.theme.gray_600};
            }}
        """

    # =========================================================================
    # COMPONENTE: Card principal de login
    # =========================================================================

    def login_card(self) -> str:
        """
        Tarjeta blanca central que contiene el formulario.

        Tiene sombra sutil mediante borde claro y esquinas redondeadas.

        Returns:
            QSS para QFrame#loginCard
        """
        return f"""
            QFrame#loginCard {{
                background-color: {self.theme.surface};
                border-radius: 1.25em;
                border: 1px solid {self.theme.border_light};
            }}
        """

    def login_background(self) -> str:
        """
        Fondo de la ventana con degradado diagonal.

        Va de gris claro a blanco a un tono del color primario.

        Returns:
            QSS para QWidget central
        """
        return f"""
            QWidget {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 {self.theme.gray_50},
                    stop: 0.5 {self.theme.surface},
                    stop: 1 {self.theme.primary_bg}
                );
            }}
        """

    # =========================================================================
    # COMPONENTE: Logo y header
    # =========================================================================

    def logo_circle(self) -> str:
        """
        Circulo con degradado que contiene el icono/logo.

        Degradado diagonal del color primario a una version mas oscura.

        Returns:
            QSS para QFrame del circulo
        """
        return f"""
            QFrame {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 {self.theme.primary},
                    stop: 1 {self.theme.primary_dark}
                );
                border-radius: 2.25em;
            }}
        """

    def logo_icon(self) -> str:
        """
        Icono/simbolo dentro del circulo del logo.

        Returns:
            QSS para QLabel del icono
        """
        return f"""
            color: {self.theme.text_inverse};
            font-size: 2em;
            font-weight: bold;
            font-family: 'Segoe UI', sans-serif;
        """

    def app_title(self) -> str:
        """
        Titulo grande con el nombre de la aplicacion.

        Returns:
            QSS para QLabel titulo
        """
        return f"""
            color: {self.theme.text_primary};
            letter-spacing: -0.5px;
            background: transparent;
        """

    def subtitle(self) -> str:
        """
        Subtitulo debajo del nombre de la app.

        Returns:
            QSS para QLabel subtitulo
        """
        return f"color: {self.theme.text_secondary}; background: transparent;"

    # =========================================================================
    # COMPONENTE: Mensajes de error
    # =========================================================================

    def error_container(self) -> str:
        """
        Contenedor del mensaje de error.

        Fondo rojo claro con borde rojo, esquinas redondeadas.

        Returns:
            QSS para QFrame#errorContainer
        """
        return f"""
            QFrame#errorContainer {{
                background-color: {self.theme.danger_bg};
                border: 1px solid {self.theme.danger_light};
                border-radius: 0.625em;
                padding: 0;
            }}
        """

    def error_icon(self) -> str:
        """
        Icono de warning en el mensaje de error.

        Returns:
            QSS para QLabel del icono
        """
        return f"""
            color: {self.theme.danger};
            font-size: 1em;
        """

    def error_text(self) -> str:
        """
        Texto descriptivo del error.

        Returns:
            QSS para QLabel del mensaje
        """
        return f"""
            color: {self.theme.danger};
            font-size: 0.8125em;
            font-weight: 500;
        """

    # =========================================================================
    # COMPONENTE: Boton de login
    # =========================================================================

    def login_button(self) -> str:
        """
        Boton principal de iniciar sesion.

        Degradado horizontal del color primario, con estados hover/disabled.

        Returns:
            QSS para QPushButton principal
        """
        return f"""
            QPushButton {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 0,
                    stop: 0 {self.theme.primary},
                    stop: 1 {self.theme.primary_dark}
                );
                color: {self.theme.text_inverse};
                border: none;
                border-radius: 0.75em;
                font-size: 0.9375em;
                font-weight: 600;
                letter-spacing: 0.5px;
            }}
            QPushButton:hover {{
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 0,
                    stop: 0 {self.theme.primary_dark},
                    stop: 1 #2d2a7a
                );
            }}
            QPushButton:pressed {{
                background-color: {self.theme.primary_dark};
            }}
            QPushButton:disabled {{
                background: {self.theme.gray_300};
                color: {self.theme.gray_500};
            }}
        """

    def login_button_text(self) -> str:
        """
        Texto interno del boton (usado con layout interno).

        Returns:
            QSS para QLabel dentro del boton
        """
        return f"""
            color: {self.theme.text_inverse};
            font-size: 0.9375em;
            font-weight: 600;
            letter-spacing: 0.5px;
            background: transparent;
        """

    # =========================================================================
    # COMPONENTE: Info del dispositivo (footer del card)
    # =========================================================================

    def device_name(self) -> str:
        """
        Nombre del equipo/hostname.

        Returns:
            QSS para QLabel del hostname
        """
        return f"""
            color: {self.theme.gray_600};
            font-size: 0.75em;
            font-weight: 500;
        """

    def device_icon(self) -> str:
        """
        Icono de computadora junto al nombre.

        Returns:
            QSS para QLabel del icono
        """
        return f"""
            color: {self.theme.gray_400};
            font-size: 1em;
        """

    def device_badge(self) -> str:
        """
        Badge/chip que muestra el ID corto del dispositivo.

        Returns:
            QSS para QFrame del badge
        """
        return f"""
            QFrame {{
                background-color: {self.theme.gray_100};
                border-radius: 0.25em;
                padding: 0.125em 0.375em;
            }}
        """

    def device_id(self) -> str:
        """
        Texto del ID del dispositivo (monospace).

        Returns:
            QSS para QLabel del ID
        """
        return f"""
            color: {self.theme.gray_500};
            font-size: 0.625em;
            font-family: 'Consolas', 'Courier New', monospace;
            font-weight: 500;
        """

    # =========================================================================
    # COMPONENTE: Terminal identificada (reemplaza campo empresa)
    # =========================================================================

    def terminal_info_container(self) -> str:
        """
        Contenedor que muestra info cuando la terminal esta registrada.

        Fondo verde claro indicando estado exitoso.

        Returns:
            QSS para QFrame de terminal info
        """
        return f"""
            QFrame {{
                background-color: {self.theme.success}15;
                border: 1px solid {self.theme.success}50;
                border-radius: 0.625em;
                padding: 0.75em;
            }}
        """

    def terminal_tenant_label(self) -> str:
        """
        Label superior con nombre del tenant/empresa.

        Texto pequeno en mayusculas, color verde.

        Returns:
            QSS para QLabel
        """
        return f"""
            color: {self.theme.success};
            font-size: 0.6875em;
            font-weight: 600;
            text-transform: uppercase;
        """

    def terminal_name_label(self) -> str:
        """
        Nombre de la terminal.

        Texto principal, mas grande y bold.

        Returns:
            QSS para QLabel
        """
        return f"""
            color: {self.theme.text_primary};
            font-size: 0.9375em;
            font-weight: 600;
        """

    def terminal_branch_label(self) -> str:
        """
        Nombre de la sucursal asignada.

        Texto secundario, gris.

        Returns:
            QSS para QLabel
        """
        return f"""
            color: {self.theme.gray_600};
            font-size: 0.75em;
        """

    # =========================================================================
    # COMPONENTES: Footer y miscelaneos
    # =========================================================================

    def separator(self) -> str:
        """
        Linea horizontal separadora.

        Returns:
            QSS para QFrame de 1px de alto
        """
        return f"background-color: {self.theme.border_light};"

    def version_label(self) -> str:
        """
        Label con la version de la app (footer izquierdo).

        Returns:
            QSS para QLabel
        """
        return f"""
            color: {self.theme.gray_400};
            font-size: 0.6875em;
        """

    def help_link(self) -> str:
        """
        Link de ayuda (footer derecho).

        Estilo de link con subrayado.

        Returns:
            QSS para QPushButton estilo link
        """
        return f"""
            QPushButton {{
                background: transparent;
                border: none;
                color: {self.theme.primary};
                font-size: 0.6875em;
                text-decoration: underline;
            }}
            QPushButton:hover {{
                color: {self.theme.primary_dark};
            }}
        """

    def field_label(self) -> str:
        """
        Etiqueta encima de un campo (si se usa).

        Actualmente no se usa porque los campos usan placeholders.

        Returns:
            QSS para QLabel
        """
        return f"""
            color: {self.theme.gray_700};
            font-size: 0.8125em;
            font-weight: 600;
            margin-bottom: 0.375em;
        """


# =============================================================================
# SINGLETON
# =============================================================================

_login_styles: LoginStyles | None = None


def get_login_styles() -> LoginStyles:
    """
    Obtiene la instancia singleton de estilos de login.

    Returns:
        Instancia de LoginStyles
    """
    global _login_styles
    if _login_styles is None:
        _login_styles = LoginStyles()
    return _login_styles
