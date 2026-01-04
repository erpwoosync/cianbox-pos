# Plan de Desarrollo: Cianbox POS Desktop para Windows x64

**Version:** 1.0.0
**Fecha:** 2025-12-20
**Autor:** Equipo de Desarrollo

---

## 1. Resumen Ejecutivo

Este documento describe el plan completo para desarrollar una aplicacion POS nativa para Windows x64 en Python, que se comunicara con el backend existente de Cianbox POS.

### 1.1 Objetivos Principales

- Aplicacion de escritorio nativa para Windows x64
- Comunicacion con API REST existente (https://cianbox-pos-api.ews-cdn.link)
- Modo offline con sincronizacion automatica
- Impresion de tickets en impresoras termicas (ESC/POS)
- Integracion con lectores de codigo de barras
- Integracion con terminales MercadoPago Point

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Arquitectura

```
+------------------------------------------------------------------+
|                     CIANBOX POS DESKTOP                           |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------+    +------------------+    +--------------+ |
|  |    UI Layer      |    |  Business Logic  |    |   Services   | |
|  |    (PyQt6)       |<-->|    (Controllers) |<-->|   Layer      | |
|  +------------------+    +------------------+    +--------------+ |
|          |                       |                      |         |
|          v                       v                      v         |
|  +------------------+    +------------------+    +--------------+ |
|  |   UI Components  |    |   Cart Manager   |    |  API Client  | |
|  |   - LoginWindow  |    |   Promo Engine   |    |  Sync Engine | |
|  |   - POSWindow    |    |   Payment Proc.  |    |  Print Svc   | |
|  |   - CashWindow   |    |   Cash Manager   |    |  MP Service  | |
|  +------------------+    +------------------+    +--------------+ |
|                                                         |         |
|                                                         v         |
|  +------------------------------------------------------+        |
|  |                   Data Layer                          |        |
|  |  +------------------+    +-------------------------+  |        |
|  |  |  SQLite Cache    |    |   Offline Queue        |  |        |
|  |  |  - Products      |    |   - Pending Sales      |  |        |
|  |  |  - Categories    |    |   - Pending Payments   |  |        |
|  |  |  - Prices        |    |   - Pending Syncs      |  |        |
|  |  +------------------+    +-------------------------+  |        |
|  +------------------------------------------------------+        |
|                                                                   |
+------------------------------------------------------------------+
                              |
                              | HTTPS/REST
                              v
+------------------------------------------------------------------+
|                 CIANBOX POS API BACKEND                           |
|           https://cianbox-pos-api.ews-cdn.link                    |
+------------------------------------------------------------------+
```

### 2.2 Patron de Arquitectura

Se utilizara una arquitectura **MVVM (Model-View-ViewModel)** adaptada:

- **Model**: Clases de datos con Pydantic + SQLAlchemy para persistencia local
- **View**: Interfaz grafica con PyQt6
- **ViewModel**: Controladores que conectan la logica con la UI
- **Services**: Servicios independientes (API, impresion, sincronizacion)

---

## 3. Estructura del Proyecto

```
cianbox-pos-desktop/
|
+-- src/
|   +-- main.py                      # Entry point
|   +-- app.py                       # Aplicacion principal
|   |
|   +-- config/
|   |   +-- __init__.py
|   |   +-- settings.py              # Configuracion global
|   |   +-- constants.py             # Constantes
|   |   +-- logging_config.py        # Configuracion de logs
|   |
|   +-- models/
|   |   +-- __init__.py
|   |   +-- base.py                  # Modelo base SQLAlchemy
|   |   +-- user.py                  # Usuario y sesion
|   |   +-- tenant.py                # Tenant
|   |   +-- product.py               # Producto, categoria, marca
|   |   +-- sale.py                  # Venta y items
|   |   +-- payment.py               # Pagos
|   |   +-- cash_session.py          # Turno de caja
|   |   +-- promotion.py             # Promociones
|   |   +-- offline_queue.py         # Cola offline
|   |
|   +-- schemas/
|   |   +-- __init__.py
|   |   +-- auth.py                  # Schemas de autenticacion
|   |   +-- product.py               # Schemas de productos
|   |   +-- sale.py                  # Schemas de ventas
|   |   +-- cash.py                  # Schemas de caja
|   |   +-- api_responses.py         # Respuestas de API
|   |
|   +-- api/
|   |   +-- __init__.py
|   |   +-- client.py                # Cliente HTTP base
|   |   +-- auth.py                  # Endpoints de autenticacion
|   |   +-- products.py              # Endpoints de productos
|   |   +-- sales.py                 # Endpoints de ventas
|   |   +-- cash.py                  # Endpoints de caja
|   |   +-- promotions.py            # Endpoints de promociones
|   |   +-- mercadopago.py           # Endpoints de MercadoPago
|   |
|   +-- services/
|   |   +-- __init__.py
|   |   +-- auth_service.py          # Servicio de autenticacion
|   |   +-- sync_service.py          # Sincronizacion con backend
|   |   +-- cart_service.py          # Gestion del carrito
|   |   +-- payment_service.py       # Procesamiento de pagos
|   |   +-- promotion_service.py     # Motor de promociones
|   |   +-- cash_service.py          # Gestion de caja
|   |   +-- print_service.py         # Impresion de tickets
|   |   +-- barcode_service.py       # Lectura de codigos
|   |   +-- mercadopago_service.py   # Integracion MP Point
|   |   +-- offline_service.py       # Gestion modo offline
|   |
|   +-- db/
|   |   +-- __init__.py
|   |   +-- database.py              # Conexion SQLite
|   |   +-- migrations.py            # Migraciones locales
|   |   +-- sync.py                  # Sincronizacion de datos
|   |
|   +-- ui/
|   |   +-- __init__.py
|   |   +-- main_window.py           # Ventana principal
|   |   +-- windows/
|   |   |   +-- __init__.py
|   |   |   +-- login_window.py      # Login
|   |   |   +-- pos_window.py        # POS principal
|   |   |   +-- cash_window.py       # Gestion de caja
|   |   |   +-- payment_window.py    # Ventana de cobro
|   |   |   +-- settings_window.py   # Configuracion
|   |   |   +-- sync_window.py       # Sincronizacion
|   |   |
|   |   +-- components/
|   |   |   +-- __init__.py
|   |   |   +-- product_grid.py      # Grilla de productos
|   |   |   +-- cart_widget.py       # Widget del carrito
|   |   |   +-- search_bar.py        # Barra de busqueda
|   |   |   +-- numpad.py            # Teclado numerico
|   |   |   +-- payment_buttons.py   # Botones de pago
|   |   |   +-- quick_categories.py  # Categorias rapidas
|   |   |   +-- status_bar.py        # Barra de estado
|   |   |   +-- cash_count.py        # Arqueo de caja
|   |   |
|   |   +-- dialogs/
|   |   |   +-- __init__.py
|   |   |   +-- quantity_dialog.py   # Dialogo cantidad
|   |   |   +-- discount_dialog.py   # Dialogo descuento
|   |   |   +-- supervisor_dialog.py # Autorizacion supervisor
|   |   |   +-- customer_dialog.py   # Seleccion cliente
|   |   |   +-- message_dialog.py    # Mensajes
|   |   |
|   |   +-- styles/
|   |       +-- __init__.py
|   |       +-- theme.py             # Tema y colores
|   |       +-- styles.qss           # Estilos Qt
|   |
|   +-- utils/
|       +-- __init__.py
|       +-- validators.py            # Validadores
|       +-- formatters.py            # Formateadores
|       +-- encryption.py            # Encriptacion de datos
|       +-- keyboard_hook.py         # Hook de teclado
|       +-- network_monitor.py       # Monitor de red
|
+-- assets/
|   +-- icons/                       # Iconos de la aplicacion
|   +-- images/                      # Imagenes
|   +-- fonts/                       # Fuentes
|   +-- sounds/                      # Sonidos de notificacion
|
+-- tests/
|   +-- __init__.py
|   +-- test_api/
|   +-- test_services/
|   +-- test_models/
|   +-- conftest.py
|
+-- scripts/
|   +-- build.py                     # Script de compilacion
|   +-- create_installer.py          # Crear instalador
|   +-- sign_executable.py           # Firmar ejecutable
|
+-- requirements.txt                 # Dependencias
+-- requirements-dev.txt             # Dependencias de desarrollo
+-- pyproject.toml                   # Configuracion del proyecto
+-- .env.example                     # Variables de entorno ejemplo
+-- cianbox-pos.spec                 # Spec de PyInstaller
+-- README.md                        # Documentacion
```

---

## 4. Dependencias

### 4.1 requirements.txt

```txt
# Core
python>=3.11

# GUI Framework
PyQt6>=6.6.0
PyQt6-Qt6>=6.6.0
PyQt6-sip>=13.6.0

# HTTP Client
httpx>=0.26.0
httpx[http2]>=0.26.0

# Database
SQLAlchemy>=2.0.0
alembic>=1.13.0

# Validation
pydantic>=2.5.0
pydantic-settings>=2.1.0

# Configuration
python-dotenv>=1.0.0

# Logging
loguru>=0.7.2

# Security
cryptography>=41.0.0
keyring>=24.3.0

# Printing (ESC/POS)
python-escpos>=3.1
pyusb>=1.2.0
pyserial>=3.5

# Utilities
Pillow>=10.0.0
qrcode>=7.4.2
pytz>=2024.1
python-dateutil>=2.8.2

# Async
anyio>=4.2.0
asyncio>=3.4.3

# System Integration (Windows)
pywin32>=306; sys_platform == 'win32'
winshell>=0.6; sys_platform == 'win32'
```

### 4.2 requirements-dev.txt

```txt
-r requirements.txt

# Testing
pytest>=7.4.0
pytest-asyncio>=0.23.0
pytest-cov>=4.1.0
pytest-qt>=4.2.0

# Code Quality
black>=24.1.0
ruff>=0.1.0
mypy>=1.8.0

# Type Stubs
types-python-dateutil
types-pytz
types-pywin32

# Build
pyinstaller>=6.3.0
nuitka>=1.9.0

# Documentation
mkdocs>=1.5.0
mkdocstrings>=0.24.0
```

---

## 5. Endpoints de API a Consumir

### 5.1 Autenticacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login con email/password/tenantSlug |
| POST | `/api/auth/login/pin` | Login rapido con PIN |
| POST | `/api/auth/refresh` | Renovar token |
| POST | `/api/auth/logout` | Cerrar sesion |
| GET | `/api/auth/me` | Usuario actual |
| POST | `/api/auth/verify-supervisor` | Verificar PIN supervisor |

### 5.2 Productos

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/products` | Listar productos |
| GET | `/api/products/:id` | Detalle de producto |
| GET | `/api/products/search` | Buscar productos |
| GET | `/api/products/barcode/:code` | Buscar por codigo de barras |

### 5.3 Categorias y Marcas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/categories` | Listar categorias |
| GET | `/api/brands` | Listar marcas |

### 5.4 Ventas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/sales` | Crear venta |
| GET | `/api/sales` | Listar ventas |
| GET | `/api/sales/:id` | Detalle de venta |
| POST | `/api/sales/:id/cancel` | Anular venta |
| GET | `/api/sales/reports/daily-summary` | Resumen diario |

### 5.5 Caja

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/cash/current` | Turno actual |
| GET | `/api/cash/status/:posId` | Estado de caja |
| POST | `/api/cash/open` | Abrir turno |
| POST | `/api/cash/close` | Cerrar turno |
| POST | `/api/cash/suspend` | Suspender turno |
| POST | `/api/cash/resume` | Reanudar turno |
| POST | `/api/cash/deposit` | Ingreso de efectivo |
| POST | `/api/cash/withdraw` | Retiro de efectivo |
| POST | `/api/cash/count` | Registrar arqueo |
| GET | `/api/cash/movements` | Movimientos del turno |

### 5.6 Promociones

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/promotions/active` | Promociones activas |
| POST | `/api/promotions/apply` | Aplicar promociones al carrito |

### 5.7 MercadoPago

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/mercadopago/devices` | Listar dispositivos Point |
| POST | `/api/mercadopago/point/create-order` | Crear orden Point |
| GET | `/api/mercadopago/point/order/:id/status` | Estado de orden |
| DELETE | `/api/mercadopago/point/order/:id` | Cancelar orden |

---

## 6. Plan de Implementacion por Fases

### Fase 1: Fundamentos (Semana 1-2)

**Objetivo:** Establecer la infraestructura base del proyecto.

1. **Configuracion del Proyecto**
   - Estructura de carpetas
   - Configuracion de entorno (.env)
   - Sistema de logging con loguru
   - Configuracion de linting y formateo

2. **Base de Datos Local**
   - Configurar SQLAlchemy con SQLite
   - Crear modelos base (User, Tenant, Product, etc.)
   - Implementar migraciones con Alembic

3. **Cliente API Base**
   - Cliente HTTP con httpx (async)
   - Manejo de tokens JWT
   - Renovacion automatica de tokens
   - Sistema de retry y manejo de errores

4. **UI Base**
   - Configurar PyQt6
   - Crear tema y estilos base
   - Ventana principal con menu

### Fase 2: Autenticacion y Sincronizacion (Semana 3-4)

**Objetivo:** Implementar login y sincronizacion inicial.

1. **Sistema de Autenticacion**
   - Pantalla de login
   - Almacenamiento seguro de credenciales (keyring)
   - Login con PIN rapido
   - Gestion de sesiones

2. **Sincronizacion Inicial**
   - Descargar productos, categorias, marcas
   - Almacenar en SQLite local
   - Sincronizacion incremental
   - Indicador de progreso

3. **Seleccion de POS**
   - Pantalla de seleccion de sucursal/caja
   - Verificar estado de caja
   - Abrir turno automatico

### Fase 3: POS Core (Semana 5-7)

**Objetivo:** Implementar funcionalidad principal del POS.

1. **Interfaz de Venta**
   - Grilla de productos
   - Busqueda por nombre/codigo/barras
   - Categorias de acceso rapido
   - Carrito de compras

2. **Gestion del Carrito**
   - Agregar/quitar productos
   - Modificar cantidades
   - Aplicar descuentos
   - Calcular totales

3. **Motor de Promociones**
   - Cargar promociones activas
   - Aplicar 2x1, descuentos, etc.
   - Mostrar descuentos aplicados
   - Prioridad de promociones

4. **Lectores de Codigo de Barras**
   - Captura de input de teclado
   - Parseo de codigos EAN/UPC
   - Busqueda automatica

### Fase 4: Pagos y Cierre (Semana 8-9)

**Objetivo:** Implementar sistema de cobro completo.

1. **Pantalla de Cobro**
   - Seleccion de metodo de pago
   - Ingreso de monto recibido
   - Calculo de vuelto
   - Pagos mixtos

2. **Integracion MercadoPago Point**
   - Listar dispositivos disponibles
   - Crear ordenes de pago
   - Polling de estado
   - Confirmacion de pago

3. **Cierre de Venta**
   - Confirmar venta
   - Sincronizar con backend
   - Imprimir ticket

### Fase 5: Caja y Arqueo (Semana 10-11)

**Objetivo:** Implementar gestion de caja.

1. **Apertura de Turno**
   - Ingresar monto inicial
   - Validaciones

2. **Movimientos de Caja**
   - Ingresos de efectivo
   - Retiros con autorizacion
   - Registro de movimientos

3. **Arqueo de Caja**
   - Conteo de billetes/monedas
   - Comparacion con esperado
   - Registro de diferencias

4. **Cierre de Turno**
   - Resumen de ventas
   - Totales por metodo de pago
   - Generar reporte

### Fase 6: Impresion (Semana 12)

**Objetivo:** Implementar impresion de tickets.

1. **Configuracion de Impresoras**
   - Detectar impresoras termicas
   - Configurar conexion (USB/Red)
   - Prueba de impresion

2. **Formato de Tickets**
   - Encabezado personalizable
   - Detalle de venta
   - Totales y pagos
   - Codigo QR (opcional)
   - Pie de ticket

3. **Comandos ESC/POS**
   - Corte de papel
   - Apertura de cajon
   - Formatos de texto

### Fase 7: Modo Offline (Semana 13-14)

**Objetivo:** Implementar operacion sin conexion.

1. **Deteccion de Conectividad**
   - Monitor de red
   - Indicador visual de estado

2. **Cola de Operaciones**
   - Almacenar ventas pendientes
   - Almacenar pagos pendientes
   - Cola de sincronizacion

3. **Sincronizacion Automatica**
   - Detectar recuperacion de red
   - Enviar operaciones pendientes
   - Resolver conflictos

### Fase 8: Empaquetado y Distribucion (Semana 15-16)

**Objetivo:** Crear instalador para Windows.

1. **Compilacion con PyInstaller**
   - Configurar spec file
   - Incluir dependencias
   - Optimizar tamano

2. **Instalador MSI/EXE**
   - Crear instalador con Inno Setup
   - Acceso directo en escritorio
   - Desinstalador

3. **Actualizaciones**
   - Sistema de verificacion de version
   - Descarga de actualizaciones
   - Instalacion automatica

---

## 7. Consideraciones de Seguridad

### 7.1 Almacenamiento de Credenciales

```python
# Usar keyring para almacenar tokens de forma segura
import keyring

def save_token(token: str, refresh_token: str):
    keyring.set_password("cianbox-pos", "access_token", token)
    keyring.set_password("cianbox-pos", "refresh_token", refresh_token)

def get_token() -> tuple[str, str]:
    token = keyring.get_password("cianbox-pos", "access_token")
    refresh = keyring.get_password("cianbox-pos", "refresh_token")
    return token, refresh
```

### 7.2 Encriptacion de Base de Datos

- SQLite con SQLCipher para encriptar datos locales
- Clave derivada de credenciales del usuario

### 7.3 Comunicacion Segura

- Solo HTTPS para comunicacion con API
- Verificacion de certificados SSL
- Timeout en requests

### 7.4 Validacion de Datos

- Validar todos los inputs con Pydantic
- Sanitizar datos antes de mostrar
- Escapar HTML en widgets

### 7.5 Permisos de Usuario

- Respetar permisos del backend
- Verificar permisos antes de mostrar opciones
- Autorizacion de supervisor para operaciones sensibles

---

## 8. Consideraciones de UX

### 8.1 Atajos de Teclado

| Tecla | Accion |
|-------|--------|
| F1 | Ayuda |
| F2 | Buscar producto |
| F3 | Nuevo cliente |
| F4 | Aplicar descuento |
| F5 | Actualizar precios |
| F6 | Abrir cajon |
| F7 | Reimprimir ultimo ticket |
| F8 | Consultar precio |
| F9 | Anular item |
| F10 | Suspender venta |
| F11 | Recuperar venta |
| F12 | Cobrar |
| ESC | Cancelar operacion |
| Enter | Confirmar |
| +/- | Aumentar/disminuir cantidad |
| * | Multiplicar cantidad |

### 8.2 Interfaz Responsiva

- Fuentes grandes y legibles (min 14px)
- Colores de alto contraste
- Botones grandes para pantallas tactiles
- Feedback visual inmediato

### 8.3 Sonidos

- Beep al escanear codigo
- Sonido de error
- Sonido de venta exitosa

---

## 9. Estrategia de Distribucion

### 9.1 Opciones de Empaquetado

| Herramienta | Ventajas | Desventajas |
|-------------|----------|-------------|
| PyInstaller | Simple, ampliamente usado | Tamano grande |
| Nuitka | Mejor rendimiento | Compilacion lenta |
| cx_Freeze | Compatible con MSI | Menos documentacion |

**Recomendacion:** PyInstaller para primera version, migrar a Nuitka para produccion.

### 9.2 Proceso de Build

```bash
# Crear ejecutable
pyinstaller cianbox-pos.spec --noconfirm

# Crear instalador (con Inno Setup)
iscc installer.iss
```

### 9.3 Estructura del Instalador

```
Cianbox POS/
|-- cianbox-pos.exe          # Ejecutable principal
|-- data/                    # Base de datos local
|-- logs/                    # Archivos de log
|-- config/                  # Configuracion
|-- assets/                  # Recursos
```

### 9.4 Actualizaciones

1. Al iniciar, verificar version en servidor
2. Si hay nueva version, mostrar notificacion
3. Descargar actualizador en background
4. Al cerrar, ejecutar actualizador
5. Actualizador reemplaza archivos y reinicia

---

## 10. Proximos Pasos

1. **Aprobar plan** - Revisar y aprobar este documento
2. **Configurar entorno** - Instalar dependencias y crear estructura
3. **Desarrollar MVP** - Fases 1-4 para demo funcional
4. **Testing interno** - Pruebas con datos reales
5. **Pilot** - Instalar en 2-3 tiendas piloto
6. **Feedback** - Recopilar y aplicar mejoras
7. **Release** - Distribucion general

---

## 11. Estimacion de Tiempos

| Fase | Duracion | Horas |
|------|----------|-------|
| Fase 1: Fundamentos | 2 semanas | 80h |
| Fase 2: Auth y Sync | 2 semanas | 80h |
| Fase 3: POS Core | 3 semanas | 120h |
| Fase 4: Pagos | 2 semanas | 80h |
| Fase 5: Caja | 2 semanas | 80h |
| Fase 6: Impresion | 1 semana | 40h |
| Fase 7: Offline | 2 semanas | 80h |
| Fase 8: Distribucion | 2 semanas | 80h |
| **Total** | **16 semanas** | **640h** |

---

## Anexo A: Ejemplo de Codigo - Cliente API

```python
"""
Cliente API base para comunicacion con el backend de Cianbox POS.
"""

import httpx
from typing import Any, Optional
from datetime import datetime, timedelta
from loguru import logger
from pydantic import BaseModel

from ..config.settings import settings
from ..schemas.api_responses import APIResponse, LoginResponse


class APIClient:
    """
    Cliente HTTP para comunicacion con la API de Cianbox POS.
    Maneja autenticacion, renovacion de tokens y reintentos.
    """

    def __init__(self):
        self.base_url = settings.API_URL
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Obtiene o crea el cliente HTTP."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
                http2=True,
            )
        return self._client

    def _get_headers(self) -> dict[str, str]:
        """Construye headers con autenticacion."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    async def _should_refresh_token(self) -> bool:
        """Verifica si el token necesita renovarse."""
        if not self.token_expires_at:
            return False
        # Renovar 5 minutos antes de expirar
        return datetime.now() > self.token_expires_at - timedelta(minutes=5)

    async def _refresh_token(self) -> bool:
        """Renueva el access token usando el refresh token."""
        if not self.refresh_token:
            return False

        try:
            client = await self._get_client()
            response = await client.post(
                "/api/auth/refresh",
                json={"refreshToken": self.refresh_token},
            )

            if response.status_code == 200:
                data = response.json()
                self.access_token = data["data"]["token"]
                logger.info("Token renovado exitosamente")
                return True
        except Exception as e:
            logger.error(f"Error al renovar token: {e}")

        return False

    async def request(
        self,
        method: str,
        endpoint: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
        retry_count: int = 3,
    ) -> APIResponse:
        """
        Realiza una peticion HTTP a la API.

        Args:
            method: Metodo HTTP (GET, POST, PUT, DELETE)
            endpoint: Ruta del endpoint (ej: /api/products)
            data: Datos a enviar en el body
            params: Parametros de query string
            retry_count: Numero de reintentos

        Returns:
            APIResponse con el resultado de la peticion
        """
        # Renovar token si es necesario
        if await self._should_refresh_token():
            await self._refresh_token()

        client = await self._get_client()
        last_error = None

        for attempt in range(retry_count):
            try:
                response = await client.request(
                    method=method,
                    url=endpoint,
                    json=data,
                    params=params,
                    headers=self._get_headers(),
                )

                # Parsear respuesta
                result = response.json()

                if response.status_code == 401:
                    # Token expirado, intentar renovar
                    if await self._refresh_token():
                        continue
                    return APIResponse(
                        success=False,
                        error="Sesion expirada, por favor inicie sesion nuevamente",
                    )

                return APIResponse(
                    success=result.get("success", response.is_success),
                    data=result.get("data"),
                    error=result.get("error"),
                    pagination=result.get("pagination"),
                )

            except httpx.TimeoutException:
                last_error = "Tiempo de espera agotado"
                logger.warning(f"Timeout en intento {attempt + 1}/{retry_count}")
            except httpx.NetworkError:
                last_error = "Error de conexion"
                logger.warning(f"Error de red en intento {attempt + 1}/{retry_count}")
            except Exception as e:
                last_error = str(e)
                logger.error(f"Error inesperado: {e}")
                break

        return APIResponse(success=False, error=last_error)

    async def login(
        self,
        email: str,
        password: str,
        tenant_slug: str,
    ) -> LoginResponse:
        """
        Realiza login en el sistema.

        Args:
            email: Email del usuario
            password: Contrasena
            tenant_slug: Slug del tenant

        Returns:
            LoginResponse con token y datos del usuario
        """
        response = await self.request(
            method="POST",
            endpoint="/api/auth/login",
            data={
                "email": email,
                "password": password,
                "tenantSlug": tenant_slug,
            },
        )

        if response.success and response.data:
            self.access_token = response.data.get("token")
            self.refresh_token = response.data.get("refreshToken")
            # Token expira en 24 horas por defecto
            self.token_expires_at = datetime.now() + timedelta(hours=24)

            return LoginResponse(
                success=True,
                token=self.access_token,
                refresh_token=self.refresh_token,
                user=response.data.get("user"),
                tenant=response.data.get("tenant"),
            )

        return LoginResponse(success=False, error=response.error)

    async def close(self):
        """Cierra el cliente HTTP."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Instancia global del cliente
api_client = APIClient()
```

---

## Anexo B: Ejemplo de Codigo - Modelo SQLAlchemy

```python
"""
Modelos de base de datos local con SQLAlchemy.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Numeric, ForeignKey, Text, JSON
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Clase base para todos los modelos."""
    pass


class Product(Base):
    """
    Modelo de producto almacenado localmente.
    Sincronizado desde el backend.
    """
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), index=True)
    cianbox_product_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Codigos
    sku: Mapped[Optional[str]] = mapped_column(String(50))
    barcode: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    internal_code: Mapped[Optional[str]] = mapped_column(String(50))

    # Informacion basica
    name: Mapped[str] = mapped_column(String(255))
    short_name: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Clasificacion
    category_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("categories.id"))
    brand_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("brands.id"))

    # Precios
    base_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    base_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))

    # Impuestos
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=21)
    tax_included: Mapped[bool] = mapped_column(Boolean, default=True)

    # Control
    track_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    stock: Mapped[int] = mapped_column(Integer, default=0)

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Imagen
    image_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Sincronizacion
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    category: Mapped[Optional["Category"]] = relationship(back_populates="products")
    brand: Mapped[Optional["Brand"]] = relationship(back_populates="products")
    prices: Mapped[List["ProductPrice"]] = relationship(back_populates="product")

    def get_price(self, price_list_id: Optional[str] = None) -> Decimal:
        """
        Obtiene el precio del producto para una lista de precios.
        Si no se especifica lista, retorna el precio base.
        """
        if price_list_id:
            for price in self.prices:
                if price.price_list_id == price_list_id:
                    return price.price
        return self.base_price or Decimal("0")


class Category(Base):
    """Modelo de categoria de producto."""
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), index=True)
    cianbox_category_id: Mapped[Optional[int]] = mapped_column(Integer)

    name: Mapped[str] = mapped_column(String(100))
    parent_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("categories.id"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_quick_access: Mapped[bool] = mapped_column(Boolean, default=False)
    quick_access_order: Mapped[int] = mapped_column(Integer, default=0)
    quick_access_color: Mapped[Optional[str]] = mapped_column(String(7))

    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    products: Mapped[List["Product"]] = relationship(back_populates="category")
    children: Mapped[List["Category"]] = relationship(back_populates="parent")
    parent: Mapped[Optional["Category"]] = relationship(back_populates="children", remote_side=[id])


class Brand(Base):
    """Modelo de marca de producto."""
    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), index=True)
    cianbox_brand_id: Mapped[Optional[int]] = mapped_column(Integer)

    name: Mapped[str] = mapped_column(String(100))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relaciones
    products: Mapped[List["Product"]] = relationship(back_populates="brand")


class ProductPrice(Base):
    """Precio de producto por lista de precios."""
    __tablename__ = "product_prices"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(50), ForeignKey("products.id"))
    price_list_id: Mapped[str] = mapped_column(String(50))

    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))

    # Relaciones
    product: Mapped["Product"] = relationship(back_populates="prices")


class OfflineQueueItem(Base):
    """
    Cola de operaciones pendientes para sincronizar.
    Se usa cuando no hay conexion a internet.
    """
    __tablename__ = "offline_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(50), index=True)

    operation_type: Mapped[str] = mapped_column(String(50))  # "sale", "payment", "cash_movement"
    endpoint: Mapped[str] = mapped_column(String(255))
    method: Mapped[str] = mapped_column(String(10))  # POST, PUT, DELETE
    payload: Mapped[dict] = mapped_column(JSON)

    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=5)
    last_error: Mapped[Optional[str]] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, processing, failed, completed

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
```

---

## Anexo C: Ejemplo de Codigo - Ventana de Login

```python
"""
Ventana de login para Cianbox POS Desktop.
"""

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QMessageBox, QFrame
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QPixmap, QFont
from loguru import logger

from ..services.auth_service import AuthService
from ..config.settings import settings


class LoginWindow(QMainWindow):
    """
    Ventana de inicio de sesion.
    Permite login con email/password y slug de tenant.
    """

    # Senales
    login_successful = pyqtSignal(dict)  # Emite datos del usuario al loguearse

    def __init__(self):
        super().__init__()
        self.auth_service = AuthService()
        self._setup_ui()

    def _setup_ui(self):
        """Configura la interfaz de usuario."""
        self.setWindowTitle("Cianbox POS - Iniciar Sesion")
        self.setFixedSize(450, 550)
        self.setWindowFlag(Qt.WindowType.FramelessWindowHint)

        # Widget central
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Logo
        logo_label = QLabel()
        logo_pixmap = QPixmap("assets/images/logo.png")
        if not logo_pixmap.isNull():
            logo_label.setPixmap(logo_pixmap.scaled(200, 80, Qt.AspectRatioMode.KeepAspectRatio))
        logo_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(logo_label)

        # Titulo
        title = QLabel("Iniciar Sesion")
        title.setFont(QFont("Segoe UI", 24, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("color: #1a1a2e; margin-bottom: 20px;")
        layout.addWidget(title)

        # Formulario
        form_frame = QFrame()
        form_frame.setStyleSheet("""
            QFrame {
                background-color: #f8f9fa;
                border-radius: 10px;
                padding: 20px;
            }
        """)
        form_layout = QVBoxLayout(form_frame)
        form_layout.setSpacing(15)

        # Campo Tenant
        self.tenant_input = self._create_input("Empresa (slug)", "mi-tienda")
        form_layout.addWidget(self.tenant_input)

        # Campo Email
        self.email_input = self._create_input("Email", "usuario@ejemplo.com")
        form_layout.addWidget(self.email_input)

        # Campo Password
        self.password_input = self._create_input("Contrasena", "", is_password=True)
        form_layout.addWidget(self.password_input)

        layout.addWidget(form_frame)

        # Boton de Login
        self.login_button = QPushButton("INGRESAR")
        self.login_button.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.login_button.setFixedHeight(50)
        self.login_button.setStyleSheet("""
            QPushButton {
                background-color: #4361ee;
                color: white;
                border: none;
                border-radius: 8px;
            }
            QPushButton:hover {
                background-color: #3730a3;
            }
            QPushButton:pressed {
                background-color: #312e81;
            }
            QPushButton:disabled {
                background-color: #9ca3af;
            }
        """)
        self.login_button.clicked.connect(self._on_login_clicked)
        layout.addWidget(self.login_button)

        # Mensaje de error
        self.error_label = QLabel()
        self.error_label.setStyleSheet("color: #dc2626; font-size: 12px;")
        self.error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.error_label.hide()
        layout.addWidget(self.error_label)

        # Espaciador
        layout.addStretch()

        # Version
        version_label = QLabel(f"Version {settings.APP_VERSION}")
        version_label.setStyleSheet("color: #9ca3af; font-size: 11px;")
        version_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(version_label)

        # Estilos del widget principal
        central_widget.setStyleSheet("""
            QWidget {
                background-color: white;
            }
            QLineEdit {
                padding: 12px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 14px;
                background-color: white;
            }
            QLineEdit:focus {
                border-color: #4361ee;
            }
            QLabel {
                font-size: 13px;
                color: #4b5563;
                margin-bottom: 4px;
            }
        """)

        # Cargar ultimo tenant usado
        self._load_last_tenant()

    def _create_input(self, label: str, placeholder: str, is_password: bool = False) -> QWidget:
        """Crea un campo de entrada con etiqueta."""
        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(5)

        lbl = QLabel(label)
        layout.addWidget(lbl)

        input_field = QLineEdit()
        input_field.setPlaceholderText(placeholder)
        if is_password:
            input_field.setEchoMode(QLineEdit.EchoMode.Password)
        layout.addWidget(input_field)

        # Guardar referencia al campo de entrada
        if "empresa" in label.lower():
            self.tenant_field = input_field
        elif "email" in label.lower():
            self.email_field = input_field
        elif "contrasena" in label.lower():
            self.password_field = input_field

        return container

    def _load_last_tenant(self):
        """Carga el ultimo tenant usado."""
        last_tenant = settings.get_last_tenant()
        if last_tenant:
            self.tenant_field.setText(last_tenant)

    async def _on_login_clicked(self):
        """Maneja el click en el boton de login."""
        tenant = self.tenant_field.text().strip()
        email = self.email_field.text().strip()
        password = self.password_field.text()

        if not all([tenant, email, password]):
            self._show_error("Por favor complete todos los campos")
            return

        self.login_button.setEnabled(False)
        self.login_button.setText("Ingresando...")
        self.error_label.hide()

        try:
            result = await self.auth_service.login(email, password, tenant)

            if result.success:
                logger.info(f"Login exitoso: {email} en {tenant}")
                settings.save_last_tenant(tenant)
                self.login_successful.emit(result.data)
                self.close()
            else:
                self._show_error(result.error or "Error de autenticacion")
        except Exception as e:
            logger.error(f"Error en login: {e}")
            self._show_error("Error de conexion. Verifique su red.")
        finally:
            self.login_button.setEnabled(True)
            self.login_button.setText("INGRESAR")

    def _show_error(self, message: str):
        """Muestra un mensaje de error."""
        self.error_label.setText(message)
        self.error_label.show()

    def keyPressEvent(self, event):
        """Maneja eventos de teclado."""
        if event.key() == Qt.Key.Key_Return or event.key() == Qt.Key.Key_Enter:
            self._on_login_clicked()
        elif event.key() == Qt.Key.Key_Escape:
            self.close()
        else:
            super().keyPressEvent(event)
```

---

**Documento generado para el proyecto Cianbox POS Desktop**
**Ultima actualizacion: 2025-12-20**
