# Product Requirements Document (PRD)
# Cianbox POS - Sistema de Punto de Venta

## 1. Overview

### 1.1 Product Name
Cianbox POS

### 1.2 Product Description
Sistema de Punto de Venta (POS) multi-tenant con integracion al ERP Cianbox. Permite a multiples clientes (tenants) gestionar ventas, cobros, inventario y sincronizacion de productos desde una plataforma web centralizada.

### 1.3 Target Users
- **Cajeros**: Operadores de caja que registran ventas diarias
- **Supervisores**: Autorizan operaciones sensibles (anulaciones, retiros)
- **Administradores**: Gestionan configuracion del tenant
- **Agencia**: Super admins que gestionan multiples tenants

---

## 2. Core Features

### 2.1 Authentication & Authorization
- Login con email/password por tenant (slug)
- Login rapido con PIN (4 digitos)
- JWT tokens con expiracion de 7 dias
- Refresh tokens (30 dias)
- Sistema de permisos granular por rol
- Verificacion de supervisor para operaciones sensibles

**API Endpoints:**
- `POST /api/auth/login` - Login con credenciales
- `POST /api/auth/login-pin` - Login con PIN
- `POST /api/auth/verify-supervisor` - Verificar autorizacion de supervisor
- `POST /api/auth/refresh` - Renovar token

### 2.2 Product Management
- Sincronizacion de productos desde Cianbox ERP
- Productos simples y variables (con variantes: talle, color)
- Categorias y marcas
- Precios por lista de precios
- Control de stock por sucursal

**API Endpoints:**
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Detalle de producto
- `GET /api/products/search` - Buscar productos
- `POST /api/cianbox/sync/products` - Sincronizar productos

### 2.3 Sales Management
- Registro de ventas con multiples items
- Aplicacion de descuentos (porcentaje o monto fijo)
- Multiples metodos de pago por venta
- Anulacion de ventas (requiere autorizacion)
- Devoluciones parciales o totales

**API Endpoints:**
- `POST /api/sales` - Crear venta
- `GET /api/sales` - Listar ventas
- `GET /api/sales/:id` - Detalle de venta
- `POST /api/sales/:id/cancel` - Anular venta
- `POST /api/sales/:id/refund` - Devolucion

### 2.4 Payment Processing
- Efectivo
- Tarjeta de credito/debito (via Mercado Pago Point)
- QR de Mercado Pago
- Transferencia bancaria
- Pagos mixtos (combinacion de metodos)

**API Endpoints:**
- `POST /api/payments` - Registrar pago
- `GET /api/mercadopago/devices` - Listar terminales Point
- `POST /api/mercadopago/payment-intents` - Crear intento de pago

### 2.5 Promotions
- Tipos de promocion:
  - `BUY_X_GET_Y`: 2x1, 3x2, etc.
  - `SECOND_UNIT_DISCOUNT`: 2da unidad al X%
  - `PERCENTAGE`: Descuento porcentual
  - `FIXED_AMOUNT`: Descuento monto fijo
  - `FLASH_SALE`: BlackFriday, CyberMonday
- Activacion por rango de fechas
- Aplicacion a productos o categorias especificas

**API Endpoints:**
- `GET /api/promotions` - Listar promociones activas
- `GET /api/promotions/applicable` - Promociones aplicables a productos

### 2.6 Cash Management
- Apertura y cierre de turnos de caja
- Movimientos de caja (ingresos/retiros)
- Arqueode caja
- Historial de operaciones

**API Endpoints:**
- `POST /api/cash/open` - Abrir turno
- `POST /api/cash/close` - Cerrar turno
- `POST /api/cash/movements` - Registrar movimiento
- `GET /api/cash/current` - Estado actual de caja

### 2.7 Multi-tenant Architecture
- Cada cliente (tenant) tiene datos aislados
- Configuracion independiente por tenant
- Conexion Cianbox ERP por tenant
- Sucursales y puntos de venta por tenant

---

## 3. Technical Requirements

### 3.1 Backend
- Node.js 18+
- Express 4.x
- TypeScript
- Prisma ORM 5.x
- PostgreSQL 15+
- JWT Authentication
- Zod validation
- Socket.io (real-time)

### 3.2 Frontend
- React 18
- Vite 5.x
- TailwindCSS 3.x
- React Router 6.x

### 3.3 Security
- Todas las queries filtradas por tenantId
- Passwords hasheados con bcrypt (12 rounds)
- Tokens JWT firmados con secret seguro
- CORS configurado por origen
- Rate limiting en endpoints sensibles

---

## 4. API Authentication

Todas las rutas protegidas requieren header:
```
Authorization: Bearer <jwt_token>
```

El token contiene:
- userId
- tenantId
- email
- roleId
- permissions[]
- branchId

---

## 5. User Roles & Permissions

### Administrador
- Permiso: `*` (acceso total)
- Puede: Todo

### Supervisor
- Permisos: `pos:sell`, `pos:discount`, `pos:cancel`, `pos:refund`, `pos:view_reports`, `inventory:view`, `customers:view`, `customers:edit`, `cash:open`, `cash:close`, `cash:movements`
- Puede: Autorizar operaciones sensibles

### Cajero
- Permisos: `pos:sell`, `pos:discount:limited`, `cash:open`, `cash:close`, `customers:view`
- Puede: Operaciones basicas de venta

---

## 6. Integrations

### 6.1 Cianbox ERP
- Sincronizacion de productos, categorias, marcas
- API REST con autenticacion por token
- Cache de tokens con renovacion automatica

### 6.2 Mercado Pago
- OAuth 2.0 para autorizacion
- Point API para terminales de pago
- QR API para pagos con codigo QR
- Webhooks para notificaciones de pago

---

## 7. Deployment

### Servers
- APP Server: 172.16.1.61 (Backend + Frontends)
- DB Server: 172.16.1.62 (PostgreSQL)

### URLs
- POS Frontend: https://cianbox-pos.ews-cdn.link
- Backoffice: https://cianbox-pos-backoffice.ews-cdn.link
- Agency: https://cianbox-pos-agency.ews-cdn.link
- API: https://cianbox-pos-point.ews-cdn.link/api

---

## 8. Test Credentials

| Role | Email | Password | PIN |
|------|-------|----------|-----|
| Admin | admin@demo.com | admin@demo.com | 1234 |
| Supervisor | supervidor@demo.com | supervidor@demo.com | 5678 |
| Cajero | cajero1@demo.com | cajero1@demo.com | 0001 |

Tenant slug: `demo`
