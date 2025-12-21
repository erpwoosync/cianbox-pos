"""
Tests de importacion de modulos.

Verifica que todos los modulos se importan correctamente.
"""

import pytest


class TestImports:
    """Tests de importacion de modulos."""

    def test_import_config(self):
        """Verifica importacion de config."""
        from src.config import get_settings, Settings

        settings = get_settings()
        assert settings.APP_NAME == "Cianbox POS"
        assert isinstance(settings, Settings)

    def test_import_database(self):
        """Verifica importacion de database."""
        from src.db import (
            Base,
            get_engine,
            get_session,
            session_scope,
            init_database,
        )

        assert Base is not None
        assert callable(get_engine)
        assert callable(get_session)
        assert callable(init_database)

    def test_import_models(self):
        """Verifica importacion de models."""
        from src.models import (
            User,
            Tenant,
            Branch,
            Category,
            Brand,
            Product,
            ProductPrice,
            PriceList,
            Promotion,
            OfflineQueue,
            AppConfig,
        )

        assert User is not None
        assert Product is not None
        assert Promotion is not None

    def test_import_repositories(self):
        """Verifica importacion de repositories."""
        from src.repositories import (
            BaseRepository,
            ProductRepository,
            UserRepository,
            ConfigRepository,
        )

        assert BaseRepository is not None
        assert ProductRepository is not None

    def test_import_api(self):
        """Verifica importacion de api."""
        from src.api import (
            APIClient,
            get_api_client,
            AuthAPI,
            ProductsAPI,
            SalesAPI,
            APIError,
            AuthenticationError,
        )

        assert APIClient is not None
        assert callable(get_api_client)
        assert AuthAPI is not None

    def test_import_ui(self):
        """Verifica importacion de ui."""
        from src.ui import Application, NavigationManager

        assert Application is not None
        assert NavigationManager is not None

    def test_import_windows(self):
        """Verifica importacion de windows."""
        from src.ui.windows import LoginWindow, POSWindow

        assert LoginWindow is not None
        assert POSWindow is not None

    def test_import_styles(self):
        """Verifica importacion de styles."""
        from src.ui.styles import get_theme, get_stylesheet, Theme

        theme = get_theme()
        assert theme is not None
        assert isinstance(theme, Theme)

        stylesheet = get_stylesheet()
        assert isinstance(stylesheet, str)
        assert len(stylesheet) > 0


class TestConfig:
    """Tests de configuracion."""

    def test_settings_defaults(self):
        """Verifica valores por defecto de settings."""
        from src.config import get_settings

        settings = get_settings()

        assert settings.API_URL == "https://cianbox-pos-api.ews-cdn.link"
        assert settings.API_TIMEOUT == 30
        assert settings.APP_VERSION == "1.0.0"
        assert settings.LOG_LEVEL == "INFO"

    def test_settings_paths(self):
        """Verifica propiedades de paths."""
        from src.config import get_settings

        settings = get_settings()

        assert settings.base_path.exists()
        assert "sqlite" in settings.database_url
        assert settings.logs_dir is not None
        assert settings.data_dir is not None


class TestAPIClient:
    """Tests del cliente API."""

    def test_api_client_singleton(self):
        """Verifica patron singleton."""
        from src.api import get_api_client

        client1 = get_api_client()
        client2 = get_api_client()

        assert client1 is client2

    def test_api_client_headers(self):
        """Verifica headers por defecto."""
        from src.api import get_api_client

        client = get_api_client()
        headers = client._get_headers()

        assert "Content-Type" in headers
        assert headers["Content-Type"] == "application/json"
        assert "User-Agent" in headers
        assert "CianboxPOS-Desktop" in headers["User-Agent"]

    def test_api_client_auth_state(self):
        """Verifica estado de autenticacion."""
        from src.api import get_api_client

        client = get_api_client()

        # Sin autenticacion
        assert not client.is_authenticated
        assert not client.is_token_valid
