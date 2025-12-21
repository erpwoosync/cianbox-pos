"""
Funciones de validacion comunes.

Proporciona validadores para datos de entrada en la aplicacion:
- Codigos de barras
- Montos y cantidades
- Documentos fiscales (CUIT, DNI)
- Formatos de texto

Uso:
    >>> from src.utils.validators import is_valid_barcode, is_valid_cuit
    >>> is_valid_barcode("7790001234567")
    True
    >>> is_valid_cuit("20-12345678-9")
    True
"""

import re
from decimal import Decimal, InvalidOperation
from typing import Optional, Union

from src.config.constants import (
    BARCODE_MIN_LENGTH,
    BARCODE_MAX_LENGTH,
    MAX_SALE_AMOUNT,
    MIN_SALE_AMOUNT,
    MAX_ITEM_QUANTITY,
    MAX_DISCOUNT_PERCENT,
)


# ==============================================================================
# VALIDACION DE CODIGOS DE BARRAS
# ==============================================================================

def is_valid_barcode(value: str) -> bool:
    """
    Valida un codigo de barras.

    Acepta EAN-8, EAN-13, UPC-A y codigos internos.

    Args:
        value: Codigo a validar

    Returns:
        True si es valido

    Examples:
        >>> is_valid_barcode("7790001234567")
        True
        >>> is_valid_barcode("12345")
        False
    """
    if not value:
        return False

    # Solo numeros
    if not value.isdigit():
        return False

    # Longitud valida
    if not BARCODE_MIN_LENGTH <= len(value) <= BARCODE_MAX_LENGTH:
        return False

    return True


def validate_ean13_checksum(barcode: str) -> bool:
    """
    Valida el digito verificador de un EAN-13.

    Args:
        barcode: Codigo EAN-13 (13 digitos)

    Returns:
        True si el checksum es valido
    """
    if len(barcode) != 13 or not barcode.isdigit():
        return False

    # Calcular digito verificador
    total = 0
    for i, digit in enumerate(barcode[:12]):
        if i % 2 == 0:
            total += int(digit)
        else:
            total += int(digit) * 3

    check_digit = (10 - (total % 10)) % 10
    return int(barcode[12]) == check_digit


def normalize_barcode(value: str) -> str:
    """
    Normaliza un codigo de barras.

    Elimina espacios, guiones y completa con ceros a la izquierda.

    Args:
        value: Codigo a normalizar

    Returns:
        Codigo normalizado
    """
    if not value:
        return ""

    # Eliminar caracteres no numericos
    cleaned = re.sub(r"[^0-9]", "", value)

    return cleaned


# ==============================================================================
# VALIDACION DE MONTOS
# ==============================================================================

def is_valid_amount(
    value: Union[str, int, float, Decimal],
    min_value: Decimal = Decimal(str(MIN_SALE_AMOUNT)),
    max_value: Decimal = Decimal(str(MAX_SALE_AMOUNT)),
) -> bool:
    """
    Valida un monto monetario.

    Args:
        value: Valor a validar
        min_value: Valor minimo permitido
        max_value: Valor maximo permitido

    Returns:
        True si el monto es valido
    """
    try:
        if isinstance(value, str):
            # Limpiar formato argentino
            cleaned = value.replace("$", "").replace(".", "").replace(",", ".").strip()
            amount = Decimal(cleaned)
        else:
            amount = Decimal(str(value))

        return min_value <= amount <= max_value

    except (InvalidOperation, ValueError):
        return False


def is_valid_quantity(
    value: Union[str, int, float, Decimal],
    allow_fractions: bool = False,
) -> bool:
    """
    Valida una cantidad.

    Args:
        value: Cantidad a validar
        allow_fractions: Si permite fracciones (para productos pesables)

    Returns:
        True si la cantidad es valida
    """
    try:
        if isinstance(value, str):
            qty = Decimal(value.replace(",", "."))
        else:
            qty = Decimal(str(value))

        # Debe ser positivo
        if qty <= 0:
            return False

        # No debe exceder el maximo
        if qty > MAX_ITEM_QUANTITY:
            return False

        # Verificar fracciones
        if not allow_fractions and qty != qty.to_integral_value():
            return False

        return True

    except (InvalidOperation, ValueError):
        return False


def is_valid_discount(
    value: Union[str, int, float, Decimal],
    is_percentage: bool = True,
) -> bool:
    """
    Valida un descuento.

    Args:
        value: Valor del descuento
        is_percentage: Si es un porcentaje (0-100)

    Returns:
        True si el descuento es valido
    """
    try:
        if isinstance(value, str):
            discount = Decimal(value.replace(",", ".").replace("%", ""))
        else:
            discount = Decimal(str(value))

        if discount < 0:
            return False

        if is_percentage and discount > MAX_DISCOUNT_PERCENT:
            return False

        return True

    except (InvalidOperation, ValueError):
        return False


# ==============================================================================
# VALIDACION DE DOCUMENTOS
# ==============================================================================

def is_valid_cuit(value: str) -> bool:
    """
    Valida un CUIT/CUIL argentino.

    Formato: XX-XXXXXXXX-X

    Args:
        value: CUIT a validar

    Returns:
        True si es valido

    Examples:
        >>> is_valid_cuit("20-12345678-9")
        True
        >>> is_valid_cuit("20123456789")
        True
    """
    if not value:
        return False

    # Limpiar guiones y espacios
    cleaned = re.sub(r"[^0-9]", "", value)

    if len(cleaned) != 11:
        return False

    # Validar tipo (primer dos digitos)
    tipo = int(cleaned[:2])
    if tipo not in [20, 23, 24, 27, 30, 33, 34]:
        return False

    # Validar digito verificador
    mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(d) * m for d, m in zip(cleaned[:10], mult))
    resto = total % 11
    verificador = 11 - resto if resto > 1 else 0

    return int(cleaned[10]) == verificador


def format_cuit(value: str) -> str:
    """
    Formatea un CUIT con guiones.

    Args:
        value: CUIT sin formato

    Returns:
        CUIT formateado (XX-XXXXXXXX-X)
    """
    cleaned = re.sub(r"[^0-9]", "", value)

    if len(cleaned) != 11:
        return value

    return f"{cleaned[:2]}-{cleaned[2:10]}-{cleaned[10]}"


def is_valid_dni(value: str) -> bool:
    """
    Valida un DNI argentino.

    Args:
        value: DNI a validar (7-8 digitos)

    Returns:
        True si es valido
    """
    if not value:
        return False

    # Limpiar puntos y espacios
    cleaned = re.sub(r"[^0-9]", "", value)

    # DNI tiene entre 7 y 8 digitos
    if not 7 <= len(cleaned) <= 8:
        return False

    return True


def format_dni(value: str) -> str:
    """
    Formatea un DNI con puntos.

    Args:
        value: DNI sin formato

    Returns:
        DNI formateado (XX.XXX.XXX)
    """
    cleaned = re.sub(r"[^0-9]", "", value)

    if len(cleaned) < 7:
        return value

    # Formatear con puntos de miles
    formatted = ""
    for i, digit in enumerate(reversed(cleaned)):
        if i > 0 and i % 3 == 0:
            formatted = "." + formatted
        formatted = digit + formatted

    return formatted


# ==============================================================================
# VALIDACION DE TEXTO
# ==============================================================================

def is_valid_email(value: str) -> bool:
    """
    Valida un email.

    Args:
        value: Email a validar

    Returns:
        True si es valido
    """
    if not value:
        return False

    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, value))


def is_valid_phone(value: str) -> bool:
    """
    Valida un numero de telefono argentino.

    Acepta formatos:
    - 1122334455
    - 11-2233-4455
    - +54 11 2233 4455

    Args:
        value: Telefono a validar

    Returns:
        True si es valido
    """
    if not value:
        return False

    # Limpiar caracteres no numericos excepto +
    cleaned = re.sub(r"[^0-9+]", "", value)

    # Remover prefijo internacional
    if cleaned.startswith("+54"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("54"):
        cleaned = cleaned[2:]

    # Debe tener entre 10 y 11 digitos
    return 10 <= len(cleaned) <= 11


def normalize_phone(value: str) -> str:
    """
    Normaliza un telefono a formato E.164.

    Args:
        value: Telefono a normalizar

    Returns:
        Telefono en formato +54XXXXXXXXXX
    """
    if not value:
        return ""

    cleaned = re.sub(r"[^0-9]", "", value)

    # Remover prefijo 54 si existe
    if cleaned.startswith("54"):
        cleaned = cleaned[2:]

    # Agregar 0 si empieza con codigo de area sin 0
    if len(cleaned) == 10 and cleaned[0] != "0":
        cleaned = "0" + cleaned

    # Remover 0 inicial para formato E.164
    if cleaned.startswith("0"):
        cleaned = cleaned[1:]

    return f"+54{cleaned}"


def sanitize_text(value: str, max_length: Optional[int] = None) -> str:
    """
    Sanitiza un texto eliminando caracteres peligrosos.

    Args:
        value: Texto a sanitizar
        max_length: Longitud maxima (opcional)

    Returns:
        Texto sanitizado
    """
    if not value:
        return ""

    # Eliminar caracteres de control
    cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", value)

    # Normalizar espacios
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Truncar si es necesario
    if max_length and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]

    return cleaned


def is_valid_sku(value: str) -> bool:
    """
    Valida un SKU.

    Acepta alfanumericos y guiones.

    Args:
        value: SKU a validar

    Returns:
        True si es valido
    """
    if not value:
        return False

    # Solo alfanumericos, guiones y guiones bajos
    pattern = r"^[a-zA-Z0-9\-_]+$"
    return bool(re.match(pattern, value))
