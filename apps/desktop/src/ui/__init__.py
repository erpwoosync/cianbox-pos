"""
Modulo de interfaz grafica con PyQt6.

Proporciona:
- Ventanas principales (login, POS, configuracion)
- Componentes reutilizables
- Dialogos modales
- Estilos y temas
"""

from .app import Application
from .navigation import NavigationManager

__all__ = [
    "Application",
    "NavigationManager",
]
