"""
Funciones de formateo para valores monetarios, fechas y numeros.

Proporciona funciones utilitarias para formatear valores de forma
consistente en toda la aplicacion.

Uso:
    >>> from src.utils.formatters import format_currency, format_date
    >>> format_currency(1234.56)
    '$1.234,56'
    >>> format_date(datetime.now())
    '21/12/2025'
"""

from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Union, Optional

from src.config.constants import (
    CURRENCY_SYMBOL,
    CURRENCY_DECIMALS,
    DATE_FORMAT,
    TIME_FORMAT,
    DATETIME_FORMAT,
)


# ==============================================================================
# FORMATEO DE MONEDA
# ==============================================================================

def format_currency(
    value: Union[int, float, Decimal, None],
    include_symbol: bool = True,
    decimals: int = CURRENCY_DECIMALS,
) -> str:
    """
    Formatea un valor como moneda.

    Args:
        value: Valor numerico a formatear
        include_symbol: Si incluir el simbolo de moneda
        decimals: Numero de decimales (default: 2)

    Returns:
        String formateado como moneda

    Examples:
        >>> format_currency(1234.56)
        '$1.234,56'
        >>> format_currency(1234.56, include_symbol=False)
        '1.234,56'
        >>> format_currency(1234)
        '$1.234,00'
    """
    if value is None:
        value = 0

    # Convertir a Decimal para precision
    if not isinstance(value, Decimal):
        value = Decimal(str(value))

    # Redondear
    quantize_str = '0.' + '0' * decimals if decimals > 0 else '0'
    value = value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)

    # Formatear con separadores argentinos (. para miles, , para decimales)
    abs_value = abs(value)
    is_negative = value < 0

    # Separar parte entera y decimal
    str_value = str(abs_value)
    if '.' in str_value:
        int_part, dec_part = str_value.split('.')
    else:
        int_part = str_value
        dec_part = '0' * decimals

    # Agregar separadores de miles
    int_part_formatted = ''
    for i, digit in enumerate(reversed(int_part)):
        if i > 0 and i % 3 == 0:
            int_part_formatted = '.' + int_part_formatted
        int_part_formatted = digit + int_part_formatted

    # Construir resultado
    if decimals > 0:
        result = f"{int_part_formatted},{dec_part.ljust(decimals, '0')[:decimals]}"
    else:
        result = int_part_formatted

    if is_negative:
        result = '-' + result

    if include_symbol:
        result = f"{CURRENCY_SYMBOL}{result}"

    return result


def parse_currency(value: str) -> Decimal:
    """
    Parsea un string de moneda a Decimal.

    Args:
        value: String con formato de moneda

    Returns:
        Valor como Decimal

    Examples:
        >>> parse_currency('$1.234,56')
        Decimal('1234.56')
        >>> parse_currency('1234,56')
        Decimal('1234.56')
    """
    if not value:
        return Decimal('0')

    # Remover simbolo de moneda y espacios
    cleaned = value.replace(CURRENCY_SYMBOL, '').strip()

    # Remover separadores de miles (puntos)
    cleaned = cleaned.replace('.', '')

    # Cambiar coma decimal por punto
    cleaned = cleaned.replace(',', '.')

    try:
        return Decimal(cleaned)
    except Exception:
        return Decimal('0')


def to_money(value: Union[int, float, Decimal, str, None]) -> Decimal:
    """
    Convierte cualquier valor a Decimal para operaciones monetarias.

    Garantiza precision de 2 decimales.

    Args:
        value: Valor a convertir

    Returns:
        Decimal con 2 decimales

    Examples:
        >>> to_money(1234.5)
        Decimal('1234.50')
        >>> to_money('$1.234,56')
        Decimal('1234.56')
    """
    if value is None:
        return Decimal('0.00')

    if isinstance(value, str):
        value = parse_currency(value)
    elif not isinstance(value, Decimal):
        value = Decimal(str(value))

    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ==============================================================================
# FORMATEO DE FECHAS
# ==============================================================================

def format_date(
    value: Union[datetime, date, None],
    format_str: str = DATE_FORMAT,
) -> str:
    """
    Formatea una fecha.

    Args:
        value: Fecha a formatear
        format_str: Formato de salida (default: dd/mm/yyyy)

    Returns:
        String con la fecha formateada

    Examples:
        >>> format_date(datetime(2025, 12, 21))
        '21/12/2025'
    """
    if value is None:
        return ''

    return value.strftime(format_str)


def format_time(value: Union[datetime, None]) -> str:
    """
    Formatea una hora.

    Args:
        value: Datetime a formatear

    Returns:
        String con la hora formateada (HH:MM:SS)

    Examples:
        >>> format_time(datetime(2025, 12, 21, 14, 30, 45))
        '14:30:45'
    """
    if value is None:
        return ''

    return value.strftime(TIME_FORMAT)


def format_datetime(value: Union[datetime, None]) -> str:
    """
    Formatea fecha y hora.

    Args:
        value: Datetime a formatear

    Returns:
        String con fecha y hora formateadas

    Examples:
        >>> format_datetime(datetime(2025, 12, 21, 14, 30, 45))
        '21/12/2025 14:30:45'
    """
    if value is None:
        return ''

    return value.strftime(DATETIME_FORMAT)


def format_relative_time(value: Union[datetime, None]) -> str:
    """
    Formatea una fecha como tiempo relativo (hace X minutos, etc).

    Args:
        value: Datetime a formatear

    Returns:
        String con tiempo relativo

    Examples:
        >>> format_relative_time(datetime.now() - timedelta(minutes=5))
        'hace 5 minutos'
    """
    if value is None:
        return ''

    now = datetime.now()
    diff = now - value

    seconds = diff.total_seconds()

    if seconds < 60:
        return 'hace un momento'
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f'hace {minutes} minuto{"s" if minutes > 1 else ""}'
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f'hace {hours} hora{"s" if hours > 1 else ""}'
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f'hace {days} dia{"s" if days > 1 else ""}'
    else:
        return format_date(value)


# ==============================================================================
# FORMATEO DE NUMEROS
# ==============================================================================

def format_quantity(value: Union[int, float, None], unit: str = 'UN') -> str:
    """
    Formatea una cantidad con unidad.

    Args:
        value: Cantidad
        unit: Unidad de medida

    Returns:
        String formateado

    Examples:
        >>> format_quantity(5, 'UN')
        '5 UN'
        >>> format_quantity(2.5, 'KG')
        '2,50 KG'
    """
    if value is None:
        value = 0

    if isinstance(value, float) and not value.is_integer():
        # Mostrar decimales para fracciones
        str_value = f'{value:.2f}'.replace('.', ',')
    else:
        str_value = str(int(value))

    return f'{str_value} {unit}'


def format_percentage(value: Union[int, float, Decimal, None]) -> str:
    """
    Formatea un valor como porcentaje.

    Args:
        value: Valor (0-100 o 0-1)

    Returns:
        String con formato de porcentaje

    Examples:
        >>> format_percentage(25)
        '25%'
        >>> format_percentage(0.25)
        '25%'
    """
    if value is None:
        return '0%'

    # Si es menor a 1, asumir que es fraccion
    if isinstance(value, (int, float)) and 0 < value < 1:
        value = value * 100

    if isinstance(value, float) and not value.is_integer():
        return f'{value:.1f}%'.replace('.', ',')

    return f'{int(value)}%'


def truncate_text(text: str, max_length: int, suffix: str = '...') -> str:
    """
    Trunca un texto a una longitud maxima.

    Args:
        text: Texto a truncar
        max_length: Longitud maxima
        suffix: Sufijo a agregar si se trunca

    Returns:
        Texto truncado

    Examples:
        >>> truncate_text('Este es un texto muy largo', 15)
        'Este es un t...'
    """
    if not text:
        return ''

    if len(text) <= max_length:
        return text

    return text[:max_length - len(suffix)] + suffix
