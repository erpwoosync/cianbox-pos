"""
Tests para funciones de formateo.

Cubre:
- Formateo de moneda (pesos argentinos)
- Formateo de fechas
- Formateo de numeros y porcentajes
"""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest


class TestFormatCurrency:
    """Tests para format_currency."""

    def test_format_integer(self):
        """Formatea un numero entero."""
        from src.utils.formatters import format_currency
        assert format_currency(1234) == "$1.234,00"

    def test_format_float(self):
        """Formatea un numero con decimales."""
        from src.utils.formatters import format_currency
        assert format_currency(1234.56) == "$1.234,56"

    def test_format_decimal(self):
        """Formatea un Decimal."""
        from src.utils.formatters import format_currency
        assert format_currency(Decimal("1234.56")) == "$1.234,56"

    def test_format_without_symbol(self):
        """Formatea sin simbolo de moneda."""
        from src.utils.formatters import format_currency
        assert format_currency(1234.56, include_symbol=False) == "1.234,56"

    def test_format_zero(self):
        """Formatea cero."""
        from src.utils.formatters import format_currency
        assert format_currency(0) == "$0,00"

    def test_format_none(self):
        """Formatea None como cero."""
        from src.utils.formatters import format_currency
        assert format_currency(None) == "$0,00"

    def test_format_negative(self):
        """Formatea valores negativos."""
        from src.utils.formatters import format_currency
        assert format_currency(-1234.56) == "$-1.234,56"

    def test_format_large_number(self):
        """Formatea numeros grandes con separadores."""
        from src.utils.formatters import format_currency
        assert format_currency(1234567.89) == "$1.234.567,89"

    def test_format_small_decimal(self):
        """Formatea decimales pequenos."""
        from src.utils.formatters import format_currency
        assert format_currency(0.01) == "$0,01"

    def test_format_custom_decimals(self):
        """Formatea con decimales personalizados."""
        from src.utils.formatters import format_currency
        assert format_currency(1234.567, decimals=0) == "$1.235"
        assert format_currency(1234.5, decimals=3) == "$1.234,500"


class TestParseCurrency:
    """Tests para parse_currency."""

    def test_parse_with_symbol(self):
        """Parsea string con simbolo de moneda."""
        from src.utils.formatters import parse_currency
        assert parse_currency("$1.234,56") == Decimal("1234.56")

    def test_parse_without_symbol(self):
        """Parsea string sin simbolo."""
        from src.utils.formatters import parse_currency
        assert parse_currency("1.234,56") == Decimal("1234.56")

    def test_parse_integer(self):
        """Parsea numero entero."""
        from src.utils.formatters import parse_currency
        assert parse_currency("1.234") == Decimal("1234")

    def test_parse_empty(self):
        """Parsea string vacio como cero."""
        from src.utils.formatters import parse_currency
        assert parse_currency("") == Decimal("0")

    def test_parse_invalid(self):
        """Parsea string invalido como cero."""
        from src.utils.formatters import parse_currency
        assert parse_currency("abc") == Decimal("0")


class TestToMoney:
    """Tests para to_money."""

    def test_from_int(self):
        """Convierte int a Decimal."""
        from src.utils.formatters import to_money
        assert to_money(100) == Decimal("100.00")

    def test_from_float(self):
        """Convierte float a Decimal."""
        from src.utils.formatters import to_money
        assert to_money(100.5) == Decimal("100.50")

    def test_from_string(self):
        """Convierte string formateado a Decimal."""
        from src.utils.formatters import to_money
        assert to_money("$1.234,56") == Decimal("1234.56")

    def test_from_none(self):
        """Convierte None a cero."""
        from src.utils.formatters import to_money
        assert to_money(None) == Decimal("0.00")

    def test_rounding(self):
        """Redondea a 2 decimales."""
        from src.utils.formatters import to_money
        assert to_money(100.555) == Decimal("100.56")
        assert to_money(100.554) == Decimal("100.55")


class TestFormatDate:
    """Tests para format_date."""

    def test_format_datetime(self):
        """Formatea un datetime."""
        from src.utils.formatters import format_date
        dt = datetime(2025, 12, 21)
        assert format_date(dt) == "21/12/2025"

    def test_format_none(self):
        """Formatea None como string vacio."""
        from src.utils.formatters import format_date
        assert format_date(None) == ""

    def test_format_custom(self):
        """Formatea con formato personalizado."""
        from src.utils.formatters import format_date
        dt = datetime(2025, 12, 21)
        assert format_date(dt, "%Y-%m-%d") == "2025-12-21"


class TestFormatTime:
    """Tests para format_time."""

    def test_format_time(self):
        """Formatea hora."""
        from src.utils.formatters import format_time
        dt = datetime(2025, 12, 21, 14, 30, 45)
        assert format_time(dt) == "14:30:45"

    def test_format_none(self):
        """Formatea None como string vacio."""
        from src.utils.formatters import format_time
        assert format_time(None) == ""


class TestFormatDatetime:
    """Tests para format_datetime."""

    def test_format_datetime(self):
        """Formatea fecha y hora."""
        from src.utils.formatters import format_datetime
        dt = datetime(2025, 12, 21, 14, 30, 45)
        assert format_datetime(dt) == "21/12/2025 14:30:45"

    def test_format_none(self):
        """Formatea None como string vacio."""
        from src.utils.formatters import format_datetime
        assert format_datetime(None) == ""


class TestFormatRelativeTime:
    """Tests para format_relative_time."""

    def test_just_now(self):
        """Muestra 'hace un momento' para tiempos recientes."""
        from src.utils.formatters import format_relative_time
        dt = datetime.now() - timedelta(seconds=30)
        assert format_relative_time(dt) == "hace un momento"

    def test_minutes(self):
        """Muestra minutos."""
        from src.utils.formatters import format_relative_time
        dt = datetime.now() - timedelta(minutes=5)
        assert format_relative_time(dt) == "hace 5 minutos"

    def test_one_minute(self):
        """Muestra singular para 1 minuto."""
        from src.utils.formatters import format_relative_time
        dt = datetime.now() - timedelta(minutes=1, seconds=30)
        assert format_relative_time(dt) == "hace 1 minuto"

    def test_hours(self):
        """Muestra horas."""
        from src.utils.formatters import format_relative_time
        dt = datetime.now() - timedelta(hours=3)
        assert format_relative_time(dt) == "hace 3 horas"

    def test_days(self):
        """Muestra dias."""
        from src.utils.formatters import format_relative_time
        dt = datetime.now() - timedelta(days=2)
        assert format_relative_time(dt) == "hace 2 dias"

    def test_old_date(self):
        """Muestra fecha para tiempos muy antiguos."""
        from src.utils.formatters import format_relative_time
        dt = datetime.now() - timedelta(days=30)
        result = format_relative_time(dt)
        assert "/" in result  # Formato de fecha

    def test_none(self):
        """Formatea None como string vacio."""
        from src.utils.formatters import format_relative_time
        assert format_relative_time(None) == ""


class TestFormatQuantity:
    """Tests para format_quantity."""

    def test_integer(self):
        """Formatea cantidad entera."""
        from src.utils.formatters import format_quantity
        assert format_quantity(5, "UN") == "5 UN"

    def test_float(self):
        """Formatea cantidad decimal."""
        from src.utils.formatters import format_quantity
        assert format_quantity(2.5, "KG") == "2,50 KG"

    def test_integer_as_float(self):
        """Formatea float entero sin decimales."""
        from src.utils.formatters import format_quantity
        assert format_quantity(5.0, "UN") == "5 UN"

    def test_none(self):
        """Formatea None como cero."""
        from src.utils.formatters import format_quantity
        assert format_quantity(None, "UN") == "0 UN"


class TestFormatPercentage:
    """Tests para format_percentage."""

    def test_integer(self):
        """Formatea porcentaje entero."""
        from src.utils.formatters import format_percentage
        assert format_percentage(25) == "25%"

    def test_decimal(self):
        """Formatea porcentaje decimal."""
        from src.utils.formatters import format_percentage
        assert format_percentage(25.5) == "25,5%"

    def test_fraction(self):
        """Convierte fraccion a porcentaje."""
        from src.utils.formatters import format_percentage
        assert format_percentage(0.25) == "25%"

    def test_none(self):
        """Formatea None como cero."""
        from src.utils.formatters import format_percentage
        assert format_percentage(None) == "0%"


class TestTruncateText:
    """Tests para truncate_text."""

    def test_short_text(self):
        """No trunca texto corto."""
        from src.utils.formatters import truncate_text
        assert truncate_text("Hola", 10) == "Hola"

    def test_long_text(self):
        """Trunca texto largo."""
        from src.utils.formatters import truncate_text
        result = truncate_text("Este es un texto muy largo", 15)
        assert result == "Este es un t..."
        assert len(result) == 15

    def test_custom_suffix(self):
        """Usa sufijo personalizado."""
        from src.utils.formatters import truncate_text
        result = truncate_text("Este es un texto muy largo", 15, "…")
        assert result.endswith("…")

    def test_empty(self):
        """Maneja string vacio."""
        from src.utils.formatters import truncate_text
        assert truncate_text("", 10) == ""

    def test_none_like(self):
        """Maneja valores None-like."""
        from src.utils.formatters import truncate_text
        assert truncate_text("", 10) == ""
