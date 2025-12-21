"""
Modulo de utilidades del POS Desktop.

Funciones de ayuda y utilidades generales:
- Formateo de moneda y fechas
- Validaciones de datos
- Deteccion de dispositivos

Uso:
    >>> from src.utils import format_currency, get_device_info, is_valid_barcode
    >>> format_currency(1234.56)
    '$1.234,56'
    >>> device = get_device_info()
    >>> print(device.hostname)
    >>> is_valid_barcode("7790001234567")
    True

Exports:
    Dispositivo:
        - DeviceInfo: Dataclass con info del dispositivo
        - get_device_info: Obtiene info completa del PC
        - get_device_id: Obtiene solo el ID unico
        - clear_device_cache: Limpia cache de info del dispositivo

    Formateo:
        - format_currency: Formatea valores monetarios
        - parse_currency: Parsea string de moneda
        - to_money: Convierte a Decimal
        - format_date: Formatea fechas
        - format_time: Formatea horas
        - format_datetime: Formatea fecha y hora
        - format_relative_time: Tiempo relativo (hace X minutos)
        - format_quantity: Formatea cantidad con unidad
        - format_percentage: Formatea porcentaje
        - truncate_text: Trunca texto largo

    Validaciones:
        - is_valid_barcode: Valida codigos de barras
        - validate_ean13_checksum: Valida checksum EAN-13
        - normalize_barcode: Normaliza codigo de barras
        - is_valid_amount: Valida montos
        - is_valid_quantity: Valida cantidades
        - is_valid_discount: Valida descuentos
        - is_valid_cuit: Valida CUIT argentino
        - format_cuit: Formatea CUIT
        - is_valid_dni: Valida DNI argentino
        - format_dni: Formatea DNI
        - is_valid_email: Valida email
        - is_valid_phone: Valida telefono
        - normalize_phone: Normaliza telefono
        - sanitize_text: Sanitiza texto
        - is_valid_sku: Valida SKU
"""

from .device import (
    DeviceInfo,
    get_device_info,
    get_device_id,
    clear_device_cache,
)

from .formatters import (
    # Moneda
    format_currency,
    parse_currency,
    to_money,
    # Fechas
    format_date,
    format_time,
    format_datetime,
    format_relative_time,
    # Numeros
    format_quantity,
    format_percentage,
    truncate_text,
)

from .validators import (
    # Codigos de barras
    is_valid_barcode,
    validate_ean13_checksum,
    normalize_barcode,
    # Montos y cantidades
    is_valid_amount,
    is_valid_quantity,
    is_valid_discount,
    # Documentos
    is_valid_cuit,
    format_cuit,
    is_valid_dni,
    format_dni,
    # Texto
    is_valid_email,
    is_valid_phone,
    normalize_phone,
    sanitize_text,
    is_valid_sku,
)

__all__ = [
    # Dispositivo
    "DeviceInfo",
    "get_device_info",
    "get_device_id",
    "clear_device_cache",
    # Formateo - Moneda
    "format_currency",
    "parse_currency",
    "to_money",
    # Formateo - Fechas
    "format_date",
    "format_time",
    "format_datetime",
    "format_relative_time",
    # Formateo - Numeros
    "format_quantity",
    "format_percentage",
    "truncate_text",
    # Validaciones - Codigos
    "is_valid_barcode",
    "validate_ean13_checksum",
    "normalize_barcode",
    # Validaciones - Montos
    "is_valid_amount",
    "is_valid_quantity",
    "is_valid_discount",
    # Validaciones - Documentos
    "is_valid_cuit",
    "format_cuit",
    "is_valid_dni",
    "format_dni",
    # Validaciones - Texto
    "is_valid_email",
    "is_valid_phone",
    "normalize_phone",
    "sanitize_text",
    "is_valid_sku",
]
