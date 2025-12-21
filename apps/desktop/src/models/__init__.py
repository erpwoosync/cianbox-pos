"""
Modelos de base de datos SQLAlchemy.

Define las entidades que se almacenan localmente en SQLite
para cache y operacion offline.
"""

from .base import BaseModel, TimestampMixin
from .user import User, Tenant, Branch
from .product import Category, Brand, Product, ProductPrice, PriceList
from .promotion import Promotion, PromotionProduct
from .sync import OfflineQueue, AppConfig
from .device import Device, DeviceStatus

__all__ = [
    # Base
    "BaseModel",
    "TimestampMixin",
    # Usuario
    "User",
    "Tenant",
    "Branch",
    # Productos
    "Category",
    "Brand",
    "Product",
    "ProductPrice",
    "PriceList",
    # Promociones
    "Promotion",
    "PromotionProduct",
    # Sincronizacion
    "OfflineQueue",
    "AppConfig",
    # Dispositivo
    "Device",
    "DeviceStatus",
]
