"""
Repositorios de acceso a datos.

Proporcionan una capa de abstraccion sobre SQLAlchemy
para operaciones CRUD en la base de datos local.
"""

from .base import BaseRepository
from .product_repository import ProductRepository, CategoryRepository, BrandRepository
from .user_repository import UserRepository
from .config_repository import ConfigRepository
from .device_repository import DeviceRepository

__all__ = [
    "BaseRepository",
    "ProductRepository",
    "CategoryRepository",
    "BrandRepository",
    "UserRepository",
    "ConfigRepository",
    "DeviceRepository",
]
