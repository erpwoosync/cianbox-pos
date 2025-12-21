"""
Tests para el servicio de sincronizacion.
"""

import sys
import os

# Agregar src al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from unittest.mock import Mock, patch, MagicMock
from decimal import Decimal

from src.services.sync_service import (
    SyncService,
    SyncStatus,
    SyncResult,
    get_sync_service,
    reset_sync_service,
)
from src.api.products import ProductData, CategoryData, BrandData


class TestSyncService(unittest.TestCase):
    """Tests para SyncService."""

    def setUp(self):
        """Setup antes de cada test."""
        reset_sync_service()
        self.tenant_id = "test-tenant-123"
        self.sync_service = SyncService(self.tenant_id)

    def tearDown(self):
        """Cleanup despues de cada test."""
        reset_sync_service()

    def test_init(self):
        """Verifica la inicializacion del servicio."""
        self.assertEqual(self.sync_service.tenant_id, self.tenant_id)
        self.assertEqual(self.sync_service.status, SyncStatus.IDLE)
        self.assertIsNone(self.sync_service.last_sync)

    def test_get_sync_service_singleton(self):
        """Verifica que get_sync_service retorna la misma instancia."""
        service1 = get_sync_service(self.tenant_id)
        service2 = get_sync_service(self.tenant_id)

        self.assertIs(service1, service2)

    def test_get_sync_service_different_tenants(self):
        """Verifica que diferentes tenants tienen diferentes instancias."""
        service1 = get_sync_service("tenant-1")
        service2 = get_sync_service("tenant-2")

        self.assertIsNot(service1, service2)

    def test_sync_result_dataclass(self):
        """Verifica la estructura de SyncResult."""
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            products_synced=100,
            categories_synced=10,
            brands_synced=5,
        )

        self.assertEqual(result.status, SyncStatus.SUCCESS)
        self.assertEqual(result.products_synced, 100)
        self.assertEqual(result.categories_synced, 10)
        self.assertEqual(result.brands_synced, 5)
        self.assertIsNone(result.error_message)

    @patch('src.services.sync_service.ProductsAPI')
    @patch('src.services.sync_service.session_scope')
    def test_sync_categories(self, mock_session, mock_api):
        """Verifica sincronizacion de categorias."""
        # Configurar mock
        mock_api_instance = Mock()
        mock_api.return_value = mock_api_instance
        mock_api_instance.get_categories.return_value = [
            CategoryData(id="cat-1", name="Bebidas"),
            CategoryData(id="cat-2", name="Lacteos"),
        ]

        # Configurar session mock
        mock_session_context = MagicMock()
        mock_session.return_value.__enter__ = Mock(return_value=mock_session_context)
        mock_session.return_value.__exit__ = Mock(return_value=False)
        mock_session_context.query.return_value.filter_by.return_value.first.return_value = None

        # Crear servicio con API mockeada
        service = SyncService(self.tenant_id)
        service._api = mock_api_instance

        # Ejecutar
        count = service._sync_categories()

        # Verificar
        self.assertEqual(count, 2)
        mock_api_instance.get_categories.assert_called_once()

    def test_sync_status_enum(self):
        """Verifica los valores del enum SyncStatus."""
        self.assertEqual(SyncStatus.IDLE.value, "idle")
        self.assertEqual(SyncStatus.SYNCING.value, "syncing")
        self.assertEqual(SyncStatus.SUCCESS.value, "success")
        self.assertEqual(SyncStatus.ERROR.value, "error")
        self.assertEqual(SyncStatus.OFFLINE.value, "offline")


class TestProductData(unittest.TestCase):
    """Tests para ProductData."""

    def test_from_dict(self):
        """Verifica la conversion desde diccionario."""
        data = {
            "id": "prod-1",
            "name": "Coca Cola 2.25L",
            "sku": "CC225",
            "barcode": "7790001234567",
            "basePrice": 2500.50,
            "category": {"id": "cat-1", "name": "Bebidas"},
            "brand": {"id": "brand-1", "name": "Coca-Cola"},
            "isActive": True,
        }

        product = ProductData.from_dict(data)

        self.assertEqual(product.id, "prod-1")
        self.assertEqual(product.name, "Coca Cola 2.25L")
        self.assertEqual(product.sku, "CC225")
        self.assertEqual(product.barcode, "7790001234567")
        self.assertEqual(product.base_price, 2500.50)
        self.assertEqual(product.category_id, "cat-1")
        self.assertEqual(product.category_name, "Bebidas")
        self.assertTrue(product.is_active)


class TestCategoryData(unittest.TestCase):
    """Tests para CategoryData."""

    def test_from_dict(self):
        """Verifica la conversion desde diccionario."""
        data = {
            "id": "cat-1",
            "name": "Bebidas",
            "code": "BEB",
            "isQuickAccess": True,
            "quickAccessOrder": 1,
            "quickAccessColor": "#3b82f6",
            "isActive": True,
        }

        category = CategoryData.from_dict(data)

        self.assertEqual(category.id, "cat-1")
        self.assertEqual(category.name, "Bebidas")
        self.assertEqual(category.code, "BEB")
        self.assertTrue(category.is_quick_access)
        self.assertEqual(category.quick_access_order, 1)
        self.assertEqual(category.quick_access_color, "#3b82f6")


if __name__ == "__main__":
    unittest.main()
