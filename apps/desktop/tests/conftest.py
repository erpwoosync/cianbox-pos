"""
Configuracion y fixtures para pytest.

Este modulo proporciona fixtures compartidas para todos los tests:
- Base de datos de testing
- Mocks de API
- Datos de prueba

Uso:
    Los fixtures se inyectan automaticamente en los tests:

    def test_example(db_session, mock_api):
        # db_session es una sesion de BD limpia
        # mock_api es un cliente API mockeado
        pass
"""

import os
import sys
import tempfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Agregar src al path
src_path = Path(__file__).parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))


# ==============================================================================
# FIXTURES DE BASE DE DATOS
# ==============================================================================

@pytest.fixture(scope="session")
def db_engine():
    """
    Crea un engine de base de datos en memoria para testing.

    Se crea una vez por sesion de tests.
    """
    from src.db.database import Base

    # Base de datos SQLite en memoria
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    # Importar modelos para registrar en metadata
    from src.models import (
        User, Tenant, Branch,
        Category, Brand, Product, ProductPrice, PriceList,
        Promotion, PromotionProduct,
        OfflineQueue, AppConfig,
        Device,
    )

    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)

    yield engine

    # Limpiar
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(db_engine) -> Generator[Session, None, None]:
    """
    Proporciona una sesion de base de datos limpia para cada test.

    La sesion hace rollback al finalizar el test.
    """
    Session = sessionmaker(bind=db_engine)
    session = Session()

    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ==============================================================================
# FIXTURES DE DATOS DE PRUEBA
# ==============================================================================

@pytest.fixture
def sample_tenant(db_session) -> dict:
    """Crea un tenant de prueba."""
    from src.models import Tenant

    tenant = Tenant(
        id="test-tenant-001",
        name="Test Store",
        slug="test-store",
        is_active=True,
    )
    db_session.add(tenant)
    db_session.commit()

    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
    }


@pytest.fixture
def sample_category(db_session, sample_tenant) -> dict:
    """Crea una categoria de prueba."""
    from src.models import Category

    category = Category(
        id="test-cat-001",
        tenant_id=sample_tenant["id"],
        name="Categoria Test",
        code="CAT001",
        is_active=True,
    )
    db_session.add(category)
    db_session.commit()

    return {
        "id": category.id,
        "name": category.name,
        "code": category.code,
    }


@pytest.fixture
def sample_brand(db_session, sample_tenant) -> dict:
    """Crea una marca de prueba."""
    from src.models import Brand

    brand = Brand(
        id="test-brand-001",
        tenant_id=sample_tenant["id"],
        name="Marca Test",
        code="BRAND001",
        is_active=True,
    )
    db_session.add(brand)
    db_session.commit()

    return {
        "id": brand.id,
        "name": brand.name,
        "code": brand.code,
    }


@pytest.fixture
def sample_product(db_session, sample_tenant, sample_category, sample_brand) -> dict:
    """Crea un producto de prueba."""
    from src.models import Product

    product = Product(
        id="test-prod-001",
        tenant_id=sample_tenant["id"],
        category_id=sample_category["id"],
        brand_id=sample_brand["id"],
        name="Producto Test",
        sku="SKU001",
        barcode="7790001234567",
        base_price=Decimal("1234.56"),
        current_stock=100,
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()

    return {
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "barcode": product.barcode,
        "price": float(product.base_price),
        "stock": product.current_stock,
    }


@pytest.fixture
def sample_products(db_session, sample_tenant, sample_category) -> list:
    """Crea multiples productos de prueba."""
    from src.models import Product

    products = []
    for i in range(1, 6):
        product = Product(
            id=f"test-prod-{i:03d}",
            tenant_id=sample_tenant["id"],
            category_id=sample_category["id"],
            name=f"Producto Test {i}",
            sku=f"SKU{i:03d}",
            barcode=f"779000123456{i}",
            base_price=Decimal(str(100 * i)),
            current_stock=10 * i,
            is_active=True,
        )
        db_session.add(product)
        products.append({
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "price": float(product.base_price),
        })

    db_session.commit()
    return products


# ==============================================================================
# FIXTURES DE API MOCK
# ==============================================================================

@pytest.fixture
def mock_api_client():
    """
    Proporciona un cliente API mockeado.

    Util para tests que no deben hacer requests reales.
    """
    with patch("src.api.client.get_api_client") as mock:
        client = MagicMock()
        client.is_authenticated = False
        client.access_token = None
        mock.return_value = client
        yield client


@pytest.fixture
def mock_api_response():
    """
    Factory para crear respuestas de API mockeadas.
    """
    def _create_response(success=True, data=None, error=None, status_code=200):
        from src.api.client import APIResponse
        return APIResponse(
            success=success,
            data=data,
            error=error,
            status_code=status_code,
        )

    return _create_response


# ==============================================================================
# FIXTURES DE CONFIGURACION
# ==============================================================================

@pytest.fixture
def test_settings():
    """
    Proporciona settings de prueba.
    """
    from src.config import get_settings
    return get_settings()


@pytest.fixture
def temp_data_dir():
    """
    Proporciona un directorio temporal para datos de prueba.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


# ==============================================================================
# MARKERS
# ==============================================================================

def pytest_configure(config):
    """Configura markers personalizados."""
    config.addinivalue_line(
        "markers", "slow: marca tests lentos"
    )
    config.addinivalue_line(
        "markers", "integration: marca tests de integracion"
    )
    config.addinivalue_line(
        "markers", "ui: marca tests de interfaz"
    )
