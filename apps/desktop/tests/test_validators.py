"""
Tests para funciones de validacion.

Cubre:
- Validacion de codigos de barras
- Validacion de montos y cantidades
- Validacion de documentos (CUIT, DNI)
- Validacion de texto
"""

from decimal import Decimal

import pytest


class TestBarcodeValidation:
    """Tests para validacion de codigos de barras."""

    def test_valid_ean13(self):
        """Valida EAN-13."""
        from src.utils.validators import is_valid_barcode
        assert is_valid_barcode("7790001234567") is True

    def test_valid_ean8(self):
        """Valida EAN-8."""
        from src.utils.validators import is_valid_barcode
        assert is_valid_barcode("12345678") is True

    def test_empty_barcode(self):
        """Rechaza codigo vacio."""
        from src.utils.validators import is_valid_barcode
        assert is_valid_barcode("") is False

    def test_short_barcode(self):
        """Rechaza codigo muy corto."""
        from src.utils.validators import is_valid_barcode
        assert is_valid_barcode("12345") is False

    def test_long_barcode(self):
        """Rechaza codigo muy largo."""
        from src.utils.validators import is_valid_barcode
        assert is_valid_barcode("123456789012345") is False

    def test_non_numeric_barcode(self):
        """Rechaza codigo con letras."""
        from src.utils.validators import is_valid_barcode
        assert is_valid_barcode("7790ABC1234") is False


class TestEAN13Checksum:
    """Tests para validacion de checksum EAN-13."""

    def test_valid_checksum(self):
        """Valida checksum correcto."""
        from src.utils.validators import validate_ean13_checksum
        # EAN-13 con checksum valido (calculado correctamente)
        assert validate_ean13_checksum("7790895000218") is True

    def test_invalid_checksum(self):
        """Rechaza checksum incorrecto."""
        from src.utils.validators import validate_ean13_checksum
        assert validate_ean13_checksum("7790895000210") is False

    def test_wrong_length(self):
        """Rechaza longitud incorrecta."""
        from src.utils.validators import validate_ean13_checksum
        assert validate_ean13_checksum("779000123") is False


class TestNormalizeBarcode:
    """Tests para normalizacion de codigos de barras."""

    def test_remove_spaces(self):
        """Elimina espacios."""
        from src.utils.validators import normalize_barcode
        assert normalize_barcode("779 000 123") == "779000123"

    def test_remove_dashes(self):
        """Elimina guiones."""
        from src.utils.validators import normalize_barcode
        assert normalize_barcode("779-000-123") == "779000123"

    def test_empty_input(self):
        """Maneja entrada vacia."""
        from src.utils.validators import normalize_barcode
        assert normalize_barcode("") == ""


class TestAmountValidation:
    """Tests para validacion de montos."""

    def test_valid_amount(self):
        """Valida monto dentro de rango."""
        from src.utils.validators import is_valid_amount
        assert is_valid_amount(100) is True
        assert is_valid_amount(1000.50) is True
        assert is_valid_amount(Decimal("1234.56")) is True

    def test_string_amount(self):
        """Valida monto como string."""
        from src.utils.validators import is_valid_amount
        assert is_valid_amount("$1.234,56") is True

    def test_zero_amount(self):
        """Rechaza monto cero (por defecto)."""
        from src.utils.validators import is_valid_amount
        assert is_valid_amount(0) is False

    def test_negative_amount(self):
        """Rechaza monto negativo."""
        from src.utils.validators import is_valid_amount
        assert is_valid_amount(-100) is False

    def test_excessive_amount(self):
        """Rechaza monto excesivo."""
        from src.utils.validators import is_valid_amount
        assert is_valid_amount(100_000_000) is False


class TestQuantityValidation:
    """Tests para validacion de cantidades."""

    def test_valid_quantity(self):
        """Valida cantidad entera."""
        from src.utils.validators import is_valid_quantity
        assert is_valid_quantity(1) is True
        assert is_valid_quantity(100) is True

    def test_zero_quantity(self):
        """Rechaza cantidad cero."""
        from src.utils.validators import is_valid_quantity
        assert is_valid_quantity(0) is False

    def test_negative_quantity(self):
        """Rechaza cantidad negativa."""
        from src.utils.validators import is_valid_quantity
        assert is_valid_quantity(-1) is False

    def test_fraction_without_allow(self):
        """Rechaza fraccion si no esta permitida."""
        from src.utils.validators import is_valid_quantity
        assert is_valid_quantity(1.5, allow_fractions=False) is False

    def test_fraction_with_allow(self):
        """Acepta fraccion si esta permitida."""
        from src.utils.validators import is_valid_quantity
        assert is_valid_quantity(1.5, allow_fractions=True) is True

    def test_excessive_quantity(self):
        """Rechaza cantidad excesiva."""
        from src.utils.validators import is_valid_quantity
        assert is_valid_quantity(99999) is False


class TestDiscountValidation:
    """Tests para validacion de descuentos."""

    def test_valid_percentage(self):
        """Valida porcentaje valido."""
        from src.utils.validators import is_valid_discount
        assert is_valid_discount(10, is_percentage=True) is True
        assert is_valid_discount(50, is_percentage=True) is True

    def test_zero_discount(self):
        """Acepta descuento cero."""
        from src.utils.validators import is_valid_discount
        assert is_valid_discount(0) is True

    def test_negative_discount(self):
        """Rechaza descuento negativo."""
        from src.utils.validators import is_valid_discount
        assert is_valid_discount(-10) is False

    def test_excessive_percentage(self):
        """Rechaza porcentaje mayor a 100."""
        from src.utils.validators import is_valid_discount
        assert is_valid_discount(150, is_percentage=True) is False

    def test_fixed_amount(self):
        """Acepta monto fijo grande."""
        from src.utils.validators import is_valid_discount
        assert is_valid_discount(5000, is_percentage=False) is True


class TestCUITValidation:
    """Tests para validacion de CUIT."""

    def test_valid_cuit_with_dashes(self):
        """Valida CUIT con guiones."""
        from src.utils.validators import is_valid_cuit
        # CUIT valido con digito verificador correcto (calculado)
        assert is_valid_cuit("20-27395042-8") is True

    def test_valid_cuit_without_dashes(self):
        """Valida CUIT sin guiones."""
        from src.utils.validators import is_valid_cuit
        assert is_valid_cuit("20273950428") is True

    def test_empty_cuit(self):
        """Rechaza CUIT vacio."""
        from src.utils.validators import is_valid_cuit
        assert is_valid_cuit("") is False

    def test_short_cuit(self):
        """Rechaza CUIT muy corto."""
        from src.utils.validators import is_valid_cuit
        assert is_valid_cuit("2012345678") is False

    def test_invalid_tipo(self):
        """Rechaza tipo invalido."""
        from src.utils.validators import is_valid_cuit
        assert is_valid_cuit("99-27395042-3") is False


class TestCUITFormat:
    """Tests para formateo de CUIT."""

    def test_format_cuit(self):
        """Formatea CUIT correctamente."""
        from src.utils.validators import format_cuit
        assert format_cuit("20123456789") == "20-12345678-9"

    def test_format_already_formatted(self):
        """Maneja CUIT ya formateado."""
        from src.utils.validators import format_cuit
        assert format_cuit("20-12345678-9") == "20-12345678-9"


class TestDNIValidation:
    """Tests para validacion de DNI."""

    def test_valid_dni_8_digits(self):
        """Valida DNI de 8 digitos."""
        from src.utils.validators import is_valid_dni
        assert is_valid_dni("12345678") is True

    def test_valid_dni_7_digits(self):
        """Valida DNI de 7 digitos."""
        from src.utils.validators import is_valid_dni
        assert is_valid_dni("1234567") is True

    def test_dni_with_dots(self):
        """Valida DNI con puntos."""
        from src.utils.validators import is_valid_dni
        assert is_valid_dni("12.345.678") is True

    def test_short_dni(self):
        """Rechaza DNI muy corto."""
        from src.utils.validators import is_valid_dni
        assert is_valid_dni("123456") is False


class TestDNIFormat:
    """Tests para formateo de DNI."""

    def test_format_dni(self):
        """Formatea DNI correctamente."""
        from src.utils.validators import format_dni
        assert format_dni("12345678") == "12.345.678"

    def test_format_dni_7_digits(self):
        """Formatea DNI de 7 digitos."""
        from src.utils.validators import format_dni
        assert format_dni("1234567") == "1.234.567"


class TestEmailValidation:
    """Tests para validacion de email."""

    def test_valid_email(self):
        """Valida email correcto."""
        from src.utils.validators import is_valid_email
        assert is_valid_email("user@example.com") is True
        assert is_valid_email("user.name@example.co.ar") is True

    def test_invalid_email(self):
        """Rechaza email invalido."""
        from src.utils.validators import is_valid_email
        assert is_valid_email("user@") is False
        assert is_valid_email("@example.com") is False
        assert is_valid_email("user") is False

    def test_empty_email(self):
        """Rechaza email vacio."""
        from src.utils.validators import is_valid_email
        assert is_valid_email("") is False


class TestPhoneValidation:
    """Tests para validacion de telefono."""

    def test_valid_phone(self):
        """Valida telefono correcto."""
        from src.utils.validators import is_valid_phone
        assert is_valid_phone("1122334455") is True
        assert is_valid_phone("11-2233-4455") is True

    def test_phone_with_prefix(self):
        """Valida telefono con prefijo internacional."""
        from src.utils.validators import is_valid_phone
        assert is_valid_phone("+54 11 2233 4455") is True

    def test_short_phone(self):
        """Rechaza telefono muy corto."""
        from src.utils.validators import is_valid_phone
        assert is_valid_phone("12345") is False


class TestPhoneNormalize:
    """Tests para normalizacion de telefono."""

    def test_normalize_phone(self):
        """Normaliza telefono a E.164."""
        from src.utils.validators import normalize_phone
        assert normalize_phone("11-2233-4455") == "+541122334455"

    def test_normalize_with_prefix(self):
        """Normaliza telefono con prefijo."""
        from src.utils.validators import normalize_phone
        assert normalize_phone("+54 11 2233 4455") == "+541122334455"


class TestSanitizeText:
    """Tests para sanitizacion de texto."""

    def test_remove_control_chars(self):
        """Elimina caracteres de control."""
        from src.utils.validators import sanitize_text
        # Los caracteres de control se eliminan (no se reemplazan por espacio)
        assert sanitize_text("Hola\x00Mundo") == "HolaMundo"

    def test_normalize_spaces(self):
        """Normaliza espacios multiples."""
        from src.utils.validators import sanitize_text
        assert sanitize_text("Hola    Mundo") == "Hola Mundo"

    def test_truncate(self):
        """Trunca texto largo."""
        from src.utils.validators import sanitize_text
        result = sanitize_text("Este es un texto muy largo", max_length=10)
        assert len(result) == 10

    def test_empty_input(self):
        """Maneja entrada vacia."""
        from src.utils.validators import sanitize_text
        assert sanitize_text("") == ""


class TestSKUValidation:
    """Tests para validacion de SKU."""

    def test_valid_sku(self):
        """Valida SKU correcto."""
        from src.utils.validators import is_valid_sku
        assert is_valid_sku("ABC123") is True
        assert is_valid_sku("PROD-001") is True
        assert is_valid_sku("SKU_123") is True

    def test_invalid_sku(self):
        """Rechaza SKU con caracteres invalidos."""
        from src.utils.validators import is_valid_sku
        assert is_valid_sku("SKU 123") is False
        assert is_valid_sku("SKU#123") is False

    def test_empty_sku(self):
        """Rechaza SKU vacio."""
        from src.utils.validators import is_valid_sku
        assert is_valid_sku("") is False
