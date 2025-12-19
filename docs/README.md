# Documentación Cianbox POS

Índice maestro de la documentación técnica y de usuario del sistema Cianbox POS.

## Estructura de la Documentación

La documentación está organizada en módulos para facilitar su lectura y mantenimiento (máximo 400 líneas por archivo).

---

## 📋 Inicio Rápido

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| [USER_MANUAL.md](./USER_MANUAL.md) | Manual de usuario del sistema POS | Usuario final |
| [USUARIOS_FRONTENDS.md](./USUARIOS_FRONTENDS.md) | Credenciales de acceso a los frontends | Operadores |
| [GUIA-TECNICA-POS-CIANBOX.md](./GUIA-TECNICA-POS-CIANBOX.md) | Guía técnica completa del proyecto | Desarrolladores |

---

## 🏗️ Arquitectura

Documentación de arquitectura dividida en módulos especializados.

| Documento | Descripción | Líneas |
|-----------|-------------|--------|
| [ARQUITECTURA-OVERVIEW.md](./ARQUITECTURA-OVERVIEW.md) | Resumen general y stack tecnológico | ~200 |
| [ARQUITECTURA.md](./ARQUITECTURA.md) | Arquitectura completa del sistema (legacy) | ~1342 |

**Próximamente:**
- ARQUITECTURA-MULTITENANCY.md - Sistema multi-tenant y sharding
- ARQUITECTURA-INTEGRACIONES.md - Cianbox, Socket.io, PM2
- ARQUITECTURA-SEGURIDAD.md - Autenticación, JWT, CORS
- ARQUITECTURA-CICD.md - GitHub Actions y despliegue

---

## 🔌 API Documentation

Documentación completa de endpoints REST del backend.

### Autenticación y Seguridad

| Documento | Descripción | Endpoints |
|-----------|-------------|-----------|
| [API-AUTH.md](./API-AUTH.md) | Autenticación y autorización | 7 endpoints |

**Endpoints principales:**
- `POST /api/auth/login` - Login de usuarios tenant
- `POST /api/agency/login` - Login de super admin
- `GET /api/auth/me` - Información del usuario actual
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/change-password` - Cambiar contraseña
- `POST /api/auth/login-pin` - Login con PIN de 4 dígitos

### Módulo de Productos

| Documento | Descripción | Endpoints |
|-----------|-------------|-----------|
| [API-PRODUCTS.md](./API-PRODUCTS.md) | Gestión de productos, categorías, marcas y stock | 15+ endpoints |

**Endpoints principales:**
- `GET /api/products` - Listar productos con filtros
- `POST /api/products` - Crear producto
- `GET /api/products/barcode/:barcode` - Buscar por código de barras
- `GET /api/categories` - Listar categorías
- `GET /api/brands` - Listar marcas
- `PUT /api/products/:id/stock/:branchId` - Actualizar stock

### Módulo de Ventas

| Documento | Descripción | Endpoints |
|-----------|-------------|-----------|
| [API-SALES.md](./API-SALES.md) | Operaciones de venta | 5 endpoints |

**Endpoints principales:**
- `POST /api/sales` - Crear venta con items y pagos
- `GET /api/sales` - Listar ventas con filtros
- `GET /api/sales/:id` - Detalle de venta
- `POST /api/sales/:id/cancel` - Anular venta
- `GET /api/sales/reports/daily-summary` - Resumen diario

### Módulo de Caja

| Documento | Descripción | Endpoints |
|-----------|-------------|-----------|
| [API-CASH.md](./API-CASH.md) | Gestión de turnos, arqueos y movimientos | 15+ endpoints |

**Endpoints principales:**
- `GET /api/cash/current` - Turno actual del usuario
- `POST /api/cash/open` - Abrir turno
- `POST /api/cash/close` - Cerrar turno con arqueo
- `POST /api/cash/deposit` - Registrar ingreso
- `POST /api/cash/withdraw` - Registrar retiro
- `POST /api/cash/count` - Realizar arqueo
- `POST /api/cash/transfer` - Relevo de turno
- `GET /api/cash/report/daily` - Reporte diario

### Integración Mercado Pago

| Documento | Descripción | Endpoints |
|-----------|-------------|-----------|
| [API-MERCADOPAGO.md](./API-MERCADOPAGO.md) | Integración completa con MP Point y QR | 20+ endpoints |

**Funcionalidades:**
- **OAuth 2.0:** Vinculación de cuentas MP (Point y QR separados)
- **Point:** Órdenes de pago en terminales físicas
- **QR:** Órdenes dinámicas con código QR
- **Dispositivos:** Gestión de terminales Point
- **Cajas QR:** Gestión de stores y cashiers
- **Sincronización:** Actualización de pagos con datos de MP
- **Webhooks:** Notificaciones en tiempo real

**Endpoints principales:**
- `GET /api/mercadopago/oauth/authorize` - URL de autorización
- `GET /api/mercadopago/oauth/callback` - Callback OAuth
- `POST /api/mercadopago/orders` - Crear orden Point
- `GET /api/mercadopago/orders/:id` - Estado de orden
- `POST /api/mercadopago/qr/orders` - Crear orden QR
- `GET /api/mercadopago/devices` - Listar dispositivos
- `GET /api/mercadopago/qr/cashiers` - Listar cajas QR
- `POST /api/mercadopago/payments/sync` - Sincronizar pagos

---

## 🎁 Promociones

| Documento | Descripción |
|-----------|-------------|
| [PROMOCIONES-FLUJO.md](./PROMOCIONES-FLUJO.md) | Sistema completo de promociones y combos |

**Tipos soportados:**
- **PERCENTAGE:** Descuento porcentual
- **FIXED_AMOUNT:** Monto fijo de descuento
- **BUY_X_GET_Y:** Lleve X pague Y (2x1, 3x2)
- **SECOND_UNIT_DISCOUNT:** 2da unidad al X%
- **FLASH_SALE:** Ventas relámpago (Black Friday)
- **BUNDLE_PRICE:** Precio por paquete
- **COUPON:** Cupones de descuento

**Características:**
- Vigencia por fechas, días de semana y horarios
- Aplicable a productos, categorías o marcas
- Stackable (apilamiento de descuentos)
- Límites de uso globales y por cliente
- Sistema de prioridades
- Cálculo automático en carrito

---

## 🗄️ Base de Datos

Modelos de datos organizados por módulo funcional.

| Módulo | Descripción | Líneas |
|--------|-------------|--------|
| [DATABASE-CORE.md](./DATABASE-CORE.md) | Modelos fundamentales (Tenant, User, Role, Branch) | ~350 |
| [DATABASE-CATALOG.md](./DATABASE-CATALOG.md) | Catálogo (Products, Categories, Brands, Stock) | ~380 |
| [DATABASE-SALES.md](./DATABASE-SALES.md) | Ventas (Sale, Payment, Promotion, Combo) | ~390 |
| [DATABASE-CASH.md](./DATABASE-CASH.md) | Sistema de caja (CashSession, Movements, Counts) | ~385 |

**Modelos Principales:**
- **Tenant:** Cliente/Empresa (multi-tenant)
- **User:** Usuarios por tenant con roles y permisos
- **Product:** Productos con precios, stock y categorías
- **Sale:** Ventas con items y múltiples pagos
- **CashSession:** Turnos de caja con arqueos y movimientos
- **Promotion:** Promociones (2x1, descuentos, flash sales)
- **MercadoPagoConfig:** Configuración OAuth de MP (Point/QR)

**Ver también:**
- [DATABASE.md](./DATABASE.md) - Esquema completo (DEPRECADO - migrado a DATABASE-*.md)

---

## 🚀 Infraestructura

| Documento | Descripción |
|-----------|-------------|
| [INFRAESTRUCTURA.md](./INFRAESTRUCTURA.md) | Configuración de servidor y despliegue |
| [DISENO-SISTEMA-CAJA.md](./DISENO-SISTEMA-CAJA.md) | Diseño del sistema de caja |
| [SSE-SINCRONIZACION-STREAMS.md](./SSE-SINCRONIZACION-STREAMS.md) | Server-Sent Events para sincronización |

### Temas Cubiertos:
- Configuración PM2 (clustering, restart policies)
- Nginx como reverse proxy
- GitHub Actions (self-hosted runner)
- Variables de entorno
- SSL/TLS con Let's Encrypt
- Monitoreo y logs

---

## 🔗 Integraciones

### Cianbox ERP

| Documento | Descripción |
|-----------|-------------|
| [cianbox_api_docs.md](./cianbox_api_docs.md) | Documentación de la API de Cianbox |

**Endpoints Principales:**
- `POST /auth/credentials` - Obtener token
- `GET /productos/lista` - Listar productos
- `GET /productos/categorias` - Listar categorías
- `GET /productos/marcas` - Listar marcas
- `POST /pedidos/crear` - Crear pedido
- `POST /pedidos/editar-estado` - Actualizar estado

**Características:**
- Autenticación por API Key
- Tokens cacheados con renovación automática
- Sincronización bidireccional de productos
- Paginación automática
- Configuración por tenant

### Mercado Pago

Ver [API-MERCADOPAGO.md](./API-MERCADOPAGO.md) para documentación completa.

**Aplicaciones Soportadas:**
- **Point:** Terminales físicas Bluetooth/USB
- **QR:** Códigos QR dinámicos para billetera virtual

**Flujos implementados:**
1. OAuth 2.0 con refresh tokens
2. Creación de órdenes Point/QR
3. Polling de estado de pago
4. Sincronización de datos de pago
5. Webhooks para notificaciones

---

## 📊 Stack Tecnológico

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express 4.21.1
- **ORM:** Prisma 5.22.0
- **Base de Datos:** PostgreSQL 15+
- **Validación:** Zod 3.23.8
- **Autenticación:** JWT (jsonwebtoken 9.0.2)
- **Tiempo Real:** Socket.io 4.8.1
- **Hash:** bcryptjs 2.4.3
- **Seguridad:** Helmet 8.0.0

### Frontend
- **Framework:** React 18.3.1
- **Build Tool:** Vite 5.4.11
- **Estilos:** TailwindCSS 3.4.15
- **Routing:** React Router 6.28.0
- **Estado:** Zustand 5.0.1
- **HTTP:** Axios 1.7.7
- **Iconos:** Lucide React 0.460.0

### Infraestructura
- **Gestor de Procesos:** PM2
- **Servidor Web:** Nginx
- **CI/CD:** GitHub Actions (self-hosted runner)
- **Certificados:** Let's Encrypt
- **Base de Datos:** PostgreSQL 15 (preparado para sharding)

---

## 🎯 Características Principales

### Sistema POS
- ✅ Múltiples tickets simultáneos
- ✅ Múltiples métodos de pago por venta
- ✅ Cobro con MercadoPago (Point y QR)
- ✅ Sistema de sesiones de caja con arqueos
- ✅ Categorías de acceso rápido personalizables
- ✅ Búsqueda por código de barras y SKU
- ✅ Gestión de stock en tiempo real
- ✅ Registro de ventas con IVA incluido

### Promociones
- ✅ 2x1, 3x2 (BUY_X_GET_Y)
- ✅ 2da unidad al X% de descuento
- ✅ Descuentos por porcentaje o monto fijo
- ✅ Flash Sales (BlackFriday, CyberMonday)
- ✅ Restricciones por horario y días de semana
- ✅ Límites de uso globales y por cliente
- ✅ Apilamiento de promociones (stackable)
- ✅ Sistema de prioridades

### Sistema de Caja
- ✅ Apertura/cierre de turnos
- ✅ Arqueos con conteo de billetes y monedas
- ✅ Movimientos de efectivo (ingresos/egresos)
- ✅ Relevos de turno entre cajeros
- ✅ Suspensión temporal de turnos
- ✅ Cálculo automático de diferencias
- ✅ Reportes diarios y por sesión

### Multi-Tenant
- ✅ Aislamiento total de datos por tenant
- ✅ Configuración de servidor de BD por tenant (sharding ready)
- ✅ Usuarios y roles por tenant
- ✅ Backoffice independiente por tenant
- ✅ URLs por slug (`/demo`, `/cliente1`)

### Integraciones
- ✅ Sincronización bidireccional con Cianbox ERP
- ✅ Mercado Pago Point (terminales físicas)
- ✅ Mercado Pago QR (código QR dinámico)
- ✅ OAuth 2.0 para vinculación de cuentas MP
- ✅ Webhooks para notificaciones en tiempo real
- ✅ Sincronización de datos de pagos MP

---

## 📝 Convenciones

### Código
- **TypeScript** para todo el código
- **Prisma** para acceso a datos
- **Zod** para validación de schemas
- **ESLint** para linting
- **Filtrado por tenantId** en TODAS las queries

### Base de Datos
- **Naming:** snake_case para tablas y columnas
- **IDs:** CUID (Collision-resistant Unique Identifier)
- **Timestamps:** `createdAt` y `updatedAt` en todos los modelos
- **Soft Delete:** Campo `isActive` en lugar de borrado físico
- **Decimals:** `Decimal(12, 2)` para montos, `Decimal(12, 3)` para cantidades

### API
- **REST** para endpoints principales
- **JSON** para request/response bodies
- **HTTP Status Codes** estándar (200, 201, 400, 401, 403, 404, 500)
- **Bearer Token** para autenticación
- **Error Handling** con ApiError customizado
- **Paginación:** `page` y `pageSize` en query params

---

## 🔐 Seguridad

### Autenticación
- JWT con expiración de 7 días (configurable)
- Refresh tokens para renovación automática
- Bcrypt para hash de passwords (10 rounds)
- PIN de 4 dígitos para acceso rápido en POS
- Doble sistema: Tenant users vs Agency users

### Autorización
- Permisos basados en roles
- Middleware `authorize()` para verificar permisos
- Filtrado automático por `tenantId`
- Separación de rutas por nivel de acceso

### Datos Sensibles
- Passwords encriptados con bcrypt
- Tokens de Cianbox cacheados en BD (encrypted)
- OAuth 2.0 para Mercado Pago
- Refresh tokens de MP guardados de forma segura
- Variables de entorno para secrets
- Headers de seguridad con Helmet

### Permisos Comunes
- `pos:sell` - Crear ventas
- `pos:view` - Ver ventas
- `pos:cancel` - Anular ventas
- `products:read` - Ver productos
- `products:write` - Editar productos
- `cash:open` - Abrir caja
- `cash:close` - Cerrar caja
- `settings:edit` - Configuración

---

## 🌐 URLs Públicas

| Servicio | URL | Puerto |
|----------|-----|--------|
| POS | https://cianbox-pos-point.ews-cdn.link | 443 |
| Agency Backoffice | https://cianbox-pos-agency.ews-cdn.link | 443 |
| Client Backoffice | https://cianbox-pos-backoffice.ews-cdn.link | 443 |
| Backend API | https://cianbox-pos-api.ews-cdn.link | 443 |

### URLs Internas (Red Local)

| Servicio | URL | Puerto |
|----------|-----|--------|
| POS | http://172.16.1.61 | 80 |
| Agency Backoffice | http://172.16.1.61:8083 | 8083 |
| Client Backoffice | http://172.16.1.61:8084 | 8084 |
| Backend API | http://172.16.1.61:3001 | 3001 |
| PostgreSQL | 172.16.1.62:5432 | 5432 |

---

## 📞 Soporte

Para consultas técnicas o reportar problemas:
- Revisar la documentación en `/docs`
- Consultar logs en PM2: `pm2 logs cianbox-pos-backend`
- Revisar estado de servicios: `pm2 status`
- Monitorear: `pm2 monit`

---

## 📄 Licencia

Este proyecto es propiedad de Cianbox. Todos los derechos reservados.

---

**Última actualización:** 19 de Diciembre de 2025
