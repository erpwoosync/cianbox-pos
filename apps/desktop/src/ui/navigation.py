"""
Sistema de navegacion entre ventanas.

Maneja las transiciones entre ventanas y el estado de navegacion.
"""

from typing import Optional, Type, Dict, Any
from enum import Enum, auto

from PyQt6.QtWidgets import QMainWindow
from loguru import logger


class Screen(Enum):
    """Pantallas disponibles en la aplicacion."""

    LOGIN = auto()
    POS = auto()
    CASH = auto()
    SETTINGS = auto()
    SYNC = auto()


class NavigationManager:
    """
    Gestor de navegacion entre ventanas.

    Mantiene el stack de ventanas y permite navegar
    entre ellas de forma ordenada.

    Attributes:
        current_screen: Pantalla actual
        current_window: Ventana actual
        context: Datos compartidos entre pantallas
    """

    _instance: Optional["NavigationManager"] = None

    def __new__(cls):
        """Implementa patron singleton."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Inicializa el gestor de navegacion."""
        if self._initialized:
            return

        self.current_screen: Optional[Screen] = None
        self.current_window: Optional[QMainWindow] = None
        self.previous_screen: Optional[Screen] = None
        self.context: Dict[str, Any] = {}
        self._window_cache: Dict[Screen, QMainWindow] = {}

        self._initialized = True
        logger.debug("NavigationManager inicializado")

    def navigate_to(
        self,
        screen: Screen,
        context: Dict[str, Any] = None,
        replace: bool = False,
    ) -> Optional[QMainWindow]:
        """
        Navega a una pantalla.

        Args:
            screen: Pantalla destino
            context: Datos a pasar a la pantalla
            replace: Si True, reemplaza la ventana actual sin guardarla

        Returns:
            Nueva ventana o None si falla
        """
        logger.info(f"Navegando de {self.current_screen} a {screen}")

        # Actualizar contexto
        if context:
            self.context.update(context)

        # Cerrar ventana actual
        if self.current_window and not replace:
            self.previous_screen = self.current_screen
            self.current_window.hide()

        # Crear o recuperar ventana
        window = self._get_or_create_window(screen)

        if window:
            self.current_screen = screen
            self.current_window = window
            window.show()
            return window

        logger.error(f"No se pudo crear ventana para {screen}")
        return None

    def go_back(self) -> Optional[QMainWindow]:
        """
        Vuelve a la pantalla anterior.

        Returns:
            Ventana anterior o None
        """
        if self.previous_screen:
            return self.navigate_to(self.previous_screen)
        return None

    def _get_or_create_window(self, screen: Screen) -> Optional[QMainWindow]:
        """
        Obtiene o crea una ventana para la pantalla.

        Args:
            screen: Pantalla a obtener

        Returns:
            Ventana o None
        """
        # Importar ventanas bajo demanda para evitar imports circulares
        from .windows.login_window import LoginWindow
        from .windows.pos_window import POSWindow

        window_classes = {
            Screen.LOGIN: LoginWindow,
            Screen.POS: POSWindow,
            # Screen.CASH: CashWindow,
            # Screen.SETTINGS: SettingsWindow,
        }

        window_class = window_classes.get(screen)
        if not window_class:
            logger.warning(f"Pantalla {screen} no implementada")
            return None

        # Crear nueva instancia
        try:
            if screen == Screen.POS:
                # POS necesita datos del contexto
                user = self.context.get("user")
                tenant = self.context.get("tenant")
                if user and tenant:
                    window = window_class(user, tenant)
                else:
                    logger.error("Faltan datos de usuario/tenant para POS")
                    return None
            else:
                window = window_class()

            return window

        except Exception as e:
            logger.error(f"Error creando ventana {screen}: {e}")
            return None

    def set_context(self, key: str, value: Any) -> None:
        """
        Establece un valor en el contexto.

        Args:
            key: Clave
            value: Valor
        """
        self.context[key] = value

    def get_context(self, key: str, default: Any = None) -> Any:
        """
        Obtiene un valor del contexto.

        Args:
            key: Clave
            default: Valor por defecto

        Returns:
            Valor o default
        """
        return self.context.get(key, default)

    def clear_context(self) -> None:
        """Limpia el contexto de navegacion."""
        self.context.clear()

    def close_all(self) -> None:
        """Cierra todas las ventanas."""
        if self.current_window:
            self.current_window.close()

        for window in self._window_cache.values():
            window.close()

        self._window_cache.clear()
        self.current_window = None
        self.current_screen = None


def get_navigation() -> NavigationManager:
    """
    Obtiene la instancia del gestor de navegacion.

    Returns:
        NavigationManager singleton
    """
    return NavigationManager()
