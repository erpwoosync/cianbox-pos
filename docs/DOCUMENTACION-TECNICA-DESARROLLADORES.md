# Documentación Técnica - Cianbox POS

**Sistema Multi-tenant de Punto de Venta con Integración a Cianbox ERP**

Versión: 1.0.0
Fecha: Diciembre 2024

---

## 1. Resumen del Proyecto

Cianbox POS es un sistema integral de punto de venta (POS) multi-tenant desarrollado para comercios minoristas en Argentina. Provee funcionalidades completas de gestión de ventas, stock, facturación electrónica AFIP, y múltiples métodos de pago incluyendo integración nativa con Mercado Pago Point y QR.

**Características principales:**
- Arquitectura multi-tenant con aislamiento total por cliente
- Sincronización bidireccional con Cianbox ERP
- Facturación electrónica AFIP con generación automática de CAE
- Integración completa con Mercado Pago (Point y QR)
- Sistema de gestión de caja con arqueos y turnos
- Soporte para productos variables (curva de talles)
- Gestión multi-sucursal con control de stock por ubicación
- Sistema de promociones configurable
- Aplicación de escritorio Python (en desarrollo)

---

## 2. Stack Tecnológico

| Categoría | Tecnología | Versión | Propósito |
|-----------|------------|----------|-----------|
| **Backend** | Node.js | 18+ | Runtime JavaScript |
| | Express | 4.21.1 | Framework web |
| | Prisma | 5.22.0 | ORM y migraciones |
| | PostgreSQL | 15.14 | Base de datos |
| | Socket.io | 4.8.1 | Comunicación tiempo real |
| | Zod | 3.23.8 | Validación de schemas |
| | JWT | 9.0.2 | Autenticación |
| | bcryptjs | 2.4.3 | Hashing de contraseñas |
| | @afipsdk/afip.js | 1.2.2 | Integración AFIP |
| **Frontend POS** | React | 18.3.1 | Biblioteca UI |
| | Vite | 5.4.11 | Build tool |
| | TailwindCSS | 3.4.15 | Framework CSS |
| | React Router | 6.28.0 | Enrutamiento |
| | Zustand | 5.0.1 | State management |
| | Axios | 1.7.7 | HTTP client |
| **Backoffice** | React | 18.3.1 | Biblioteca UI |
| | Vite | 5.4.11 | Build tool |
| | TailwindCSS | 3.4.15 | Framework CSS |
| **Desktop (Dev)** | Python | 3.11+ | Runtime |
| | PyQt6 | - | Framework UI |
| **DevOps** | PM2 | - | Process manager |
| | Nginx | - | Reverse proxy |
| | GitHub Actions | - | CI/CD |

---

## 3. Arquitectura del Sistema

### 3.1. Patrón Arquitectónico

El sistema implementa una **arquitectura de tres capas** con enfoque **multi-tenant**:

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                      │
├─────────────────────────────────────────────────────────────┤
│  POS Frontend     │  Backoffice Client  │  Backoffice Agency│
│  (Cajeros)        │  (Admin Cliente)    │  (Super Admin)    │
│  Puerto 80        │  Puerto 8084        │  Puerto 8083      │
└─────────────────┬─────────────────┬─────────────────┬───────┘
                  │                 │                 │
                  └─────────────────┴─────────────────┘
                                    │
                  ┌─────────────────┴──────────────────┐
                  │      CAPA DE APLICACIÓN            │
                  │      Backend API (Express)         │
                  │      Puerto 3001                   │
                  └─────────────────┬──────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
┌─────────▼────────┐   ┌───────────▼────────┐   ┌───────────▼────────┐
│  CAPA DE DATOS   │   │  SERVICIOS EXTERNOS │   │  COMUNICACIÓN      │
│  PostgreSQL      │   │  - Cianbox ERP      │   │  - Socket.io       │
│  (172.16.1.62)   │   │  - Mercado Pago API │   │  - Webhooks        │
│                  │   │  - AFIP Web Services│   │                    │
└──────────────────┘   └─────────────────────┘   └────────────────────┘
```

### 3.2. Flujo de Comunicación

**Flujo de Venta Completo:**

```
1. Cajero escanea productos → Frontend POS
2. Frontend consulta precios → Backend API
3. Backend verifica stock → PostgreSQL
4. Cajero aplica promociones → Backend calcula descuentos
5. Cliente paga con MP Point → Backend crea orden MP
6. MP procesa pago → Webhook notifica al Backend
7. Backend registra venta → PostgreSQL
8. Backend actualiza stock → PostgreSQL
9. Backend emite factura → AFIP (si configurado)
10. AFIP retorna CAE → Backend
11. Backend sincroniza venta → Cianbox ERP
12. Cianbox confirma sync → Backend
13. Socket.io notifica → Todos los clientes conectados
```

### 3.3. Multi-tenancy

**Estrategia de Aislamiento:**

El sistema implementa multi-tenancy a nivel de **base de datos compartida con discriminador de tenant**:

- Cada tabla principal tiene un campo `tenantId`
- Todas las queries filtran automáticamente por `tenantId`
- JWT contiene el `tenantId` del usuario autenticado
- Middleware de autenticación inyecta `tenantId` en cada request
- **CRÍTICO:** Nunca ejecutar queries sin filtro de `tenantId`

**Ejemplo de Query Correcta:**

```typescript
// ✅ CORRECTO - Filtrado por tenantId
const products = await prisma.product.findMany({
  where: {
    tenantId: req.user.tenantId,
    isActive: true
  }
});

// ❌ INCORRECTO - Sin filtro de tenantId (expone datos de todos los tenants)
const products = await prisma.product.findMany({
  where: { isActive: true }
});
```

---

## 4. Estructura del Proyecto

```
cianbox-pos/
├── apps/
│   ├── backend/                    # API REST Node.js
│   │   ├── src/
│   │   │   ├── index.ts           # Punto de entrada, configuración Express
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # JWT authentication, authorization
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        # Login, registro, refresh token
│   │   │   │   ├── sales.ts       # Ventas, devoluciones, reportes
│   │   │   │   ├── products.ts    # Catálogo, stock, precios
│   │   │   │   ├── mercadopago.ts # MP Point, QR, webhooks
│   │   │   │   ├── afip.ts        # Facturación electrónica
│   │   │   │   ├── cash.ts        # Turnos de caja, arqueos
│   │   │   │   ├── cianbox.ts     # Sincronización ERP
│   │   │   │   ├── customers.ts   # Gestión de clientes
│   │   │   │   ├── terminals.ts   # Gestión de terminales POS
│   │   │   │   ├── agency.ts      # Admin super usuarios
│   │   │   │   └── backoffice.ts  # Admin cliente
│   │   │   ├── services/
│   │   │   │   ├── cianbox.service.ts      # Cliente API Cianbox
│   │   │   │   ├── mercadopago.service.ts  # Cliente API MP
│   │   │   │   ├── afip.service.ts         # Cliente WSFE AFIP
│   │   │   │   └── database.service.ts     # Operaciones DB complejas
│   │   │   └── utils/
│   │   │       ├── errors.ts               # Clases de error custom
│   │   │       ├── argentina-locations.ts  # Provincias, ciudades
│   │   │       └── mp-location.ts          # Mapeo geo MP
│   │   └── prisma/
│   │       └── schema.prisma      # Schema de base de datos
│   │
│   ├── frontend/                   # POS - Aplicación de cajero
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx      # Autenticación de usuario
│   │   │   │   ├── POS.tsx        # Pantalla principal de venta
│   │   │   │   ├── Sales.tsx      # Historial de ventas
│   │   │   │   └── ProductLookup.tsx  # Consulta de precios
│   │   │   ├── components/
│   │   │   │   ├── CashPanel.tsx         # Panel de gestión de caja
│   │   │   │   ├── MPPointPaymentModal.tsx  # Modal pago MP Point
│   │   │   │   ├── MPQRPaymentModal.tsx     # Modal pago MP QR
│   │   │   │   ├── InvoiceModal.tsx      # Modal facturación AFIP
│   │   │   │   ├── SizeCurveModal.tsx    # Selector curva de talles
│   │   │   │   └── CustomerSelectorModal.tsx  # Selector de cliente
│   │   │   └── services/
│   │   │       └── api.ts         # Cliente API con Axios
│   │   └── vite.config.ts
│   │
│   ├── backoffice/                 # Backoffice Cliente - Admin por tenant
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx         # Panel principal
│   │   │   │   ├── Products.tsx          # Gestión de productos
│   │   │   │   ├── Stock.tsx             # Control de stock
│   │   │   │   ├── Prices.tsx            # Gestión de precios
│   │   │   │   ├── Sales.tsx             # Ventas realizadas
│   │   │   │   ├── CashSessions.tsx      # Turnos de caja
│   │   │   │   ├── Customers.tsx         # Gestión de clientes
│   │   │   │   ├── Branches.tsx          # Sucursales
│   │   │   │   ├── Terminals.tsx         # Terminales POS
│   │   │   │   ├── Users.tsx             # Usuarios del tenant
│   │   │   │   ├── Integrations.tsx      # MP, Cianbox, AFIP
│   │   │   │   ├── AfipConfig.tsx        # Configuración AFIP
│   │   │   │   └── OrphanPayments.tsx    # Pagos sin venta
│   │   │   └── components/
│   │   │       └── Layout.tsx
│   │   └── vite.config.ts
│   │
│   ├── agency/                     # Backoffice Agencia - Super admin
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Tenants.tsx           # Gestión de clientes
│   │   │   │   ├── AgencyUsers.tsx       # Usuarios agencia
│   │   │   │   └── DatabaseServers.tsx   # Servidores DB (sharding)
│   │   │   └── components/
│   │   │       └── Layout.tsx
│   │   └── vite.config.ts
│   │
│   └── desktop/                    # Aplicación Python (en desarrollo)
│       ├── main.py
│       ├── ui/
│       └── services/
│
├── docs/                           # Documentación del proyecto
│   ├── ARQUITECTURA.md
│   ├── API-*.md                    # Documentación de APIs
│   ├── DATABASE-*.md               # Schemas de DB
│   └── GUIA-TECNICA-POS-CIANBOX.md
│
├── deploy/                         # Scripts de deployment
└── .github/workflows/              # CI/CD GitHub Actions
    └── deploy.yml
```

---

## 5. Configuración e Instalación

### 5.1. Prerrequisitos

**Software Requerido:**

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 15.0
- Git
- PM2 (para producción)
- Nginx (para producción)

**Cuentas de Servicios Externos:**

- Cuenta de Cianbox ERP con API habilitada
- Cuenta de Mercado Pago con aplicaciones OAuth configuradas
- AFIP: CUIT, certificado digital (.crt), clave privada (.key)

### 5.2. Instalación - Backend

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-org/cianbox-pos.git
cd cianbox-pos/apps/backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
nano .env
```

**Archivo `.env` del Backend:**

```env
# Base de datos
DATABASE_URL="postgresql://cianbox_pos:password@172.16.1.62:5432/cianbox_pos"

# JWT
JWT_SECRET="tu-secret-key-muy-seguro-cambiar-en-produccion"
JWT_EXPIRES_IN="7d"

# Servidor
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGINS="http://localhost:5173,http://localhost:5174,http://localhost:5175,https://pos.tudominio.com,https://backoffice.tudominio.com,https://agency.tudominio.com"

# Mercado Pago OAuth
MP_CLIENT_ID_POINT="tu-client-id-point"
MP_CLIENT_SECRET_POINT="tu-client-secret-point"
MP_CLIENT_ID_QR="tu-client-id-qr"
MP_CLIENT_SECRET_QR="tu-client-secret-qr"
MP_REDIRECT_URI="https://api.tudominio.com/api/mercadopago/oauth/callback"
MP_WEBHOOK_SECRET="tu-webhook-secret-mp"

# URLs de frontends (para OAuth callbacks)
BACKOFFICE_URL="https://backoffice.tudominio.com"
AGENCY_URL="https://agency.tudominio.com"
```

```bash
# 4. Generar cliente de Prisma
npx prisma generate

# 5. Ejecutar migraciones
npx prisma migrate deploy

# 6. (Opcional) Seed de datos de prueba
npm run db:seed

# 7. Compilar TypeScript
npm run build

# 8. Iniciar servidor (desarrollo)
npm run dev

# 9. Iniciar servidor (producción)
npm start
# O con PM2:
pm2 start dist/index.js --name cianbox-pos-api
```

### 5.3. Instalación - Frontend POS

```bash
cd apps/frontend

# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
nano .env
```

**Archivo `.env` del Frontend:**

```env
VITE_API_URL=http://localhost:3001/api
# Producción: https://api.tudominio.com/api
```

```bash
# 3. Desarrollo
npm run dev
# Accesible en http://localhost:5173

# 4. Build para producción
npm run build
# Archivos en dist/
```

### 5.4. Instalación - Backoffice

```bash
cd apps/backoffice
npm install
cp .env.example .env
# Editar .env con VITE_API_URL
npm run build
# Servir dist/ con Nginx
```

### 5.5. Instalación - Aplicación de Escritorio (Python)

**NOTA:** La aplicación de escritorio está en fase de desarrollo activo.

```bash
cd apps/desktop

# 1. Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# O en Windows:
venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Ejecutar aplicación
python main.py
```

---

## 6. Variables de Entorno

### Backend

| Variable | Descripción | Ejemplo | Requerido |
|----------|-------------|---------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db` | ✅ |
| `JWT_SECRET` | Secreto para firmar JWT | `my-ultra-secret-key-2024` | ✅ |
| `JWT_EXPIRES_IN` | Expiración de tokens | `7d` | ❌ |
| `PORT` | Puerto del servidor | `3001` | ❌ |
| `NODE_ENV` | Entorno de ejecución | `production` | ❌ |
| `CORS_ORIGINS` | Orígenes permitidos (CSV) | `http://localhost:5173,https://pos.com` | ❌ |
| `MP_CLIENT_ID_POINT` | Client ID MP Point | `123456789` | ⚠️ Solo si usa MP Point |
| `MP_CLIENT_SECRET_POINT` | Secret MP Point | `abc123def456` | ⚠️ Solo si usa MP Point |
| `MP_CLIENT_ID_QR` | Client ID MP QR | `987654321` | ⚠️ Solo si usa MP QR |
| `MP_CLIENT_SECRET_QR` | Secret MP QR | `xyz789abc123` | ⚠️ Solo si usa MP QR |
| `MP_REDIRECT_URI` | URL callback OAuth MP | `https://api.com/api/mercadopago/oauth/callback` | ⚠️ Solo si usa MP |
| `MP_WEBHOOK_SECRET` | Secret para webhooks MP | `webhook-secret-123` | ⚠️ Solo si usa MP |
| `BACKOFFICE_URL` | URL del backoffice | `https://backoffice.com` | ⚠️ Solo para OAuth |
| `AGENCY_URL` | URL del panel agencia | `https://agency.com` | ⚠️ Solo para OAuth |

### Frontend POS / Backoffice / Agency

| Variable | Descripción | Ejemplo | Requerido |
|----------|-------------|---------|-----------|
| `VITE_API_URL` | URL del backend API | `https://api.tudominio.com/api` | ✅ |

---

## 7. Componentes Principales

### 7.1. Backend

| Componente | Función | Dependencias Principales |
|------------|---------|--------------------------|
| **Express Server** | API REST HTTP | express, cors, helmet |
| **Prisma Client** | ORM para acceso a datos | @prisma/client |
| **JWT Middleware** | Autenticación y autorización | jsonwebtoken, bcryptjs |
| **Cianbox Service** | Sincronización con ERP | axios (HTTP client) |
| **Mercado Pago Service** | Procesamiento de pagos | axios (HTTP client) |
| **AFIP Service** | Facturación electrónica | @afipsdk/afip.js |
| **Socket.IO Server** | Comunicación en tiempo real | socket.io |
| **Cron Jobs** | Tareas programadas (refresh tokens) | node-cron |

### 7.2. Frontend POS

| Componente | Función | Dependencias Principales |
|------------|---------|--------------------------|
| **POS.tsx** | Pantalla principal de venta | react, zustand |
| **CashPanel** | Gestión de turno de caja | react |
| **MP Payment Modals** | Procesamiento pagos MP | axios, socket.io-client |
| **Invoice Modal** | Emisión de facturas AFIP | react |
| **Size Curve Modal** | Selector de productos variables | react |
| **Customer Selector** | Búsqueda y selección de clientes | react |
| **Product Search** | Búsqueda avanzada de productos | react |

### 7.3. Backoffice

| Componente | Función | Dependencias Principales |
|------------|---------|--------------------------|
| **Dashboard** | Panel de métricas y KPIs | react, recharts |
| **Products** | CRUD de productos | react-router, axios |
| **Stock** | Control de inventario | react |
| **Integrations** | Configuración MP/Cianbox/AFIP | react |
| **CashSessions** | Historial de turnos de caja | react |
| **Sales** | Listado y detalle de ventas | react |

---

## 8. API Endpoints

### 8.1. Autenticación (`/api/auth`)

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| POST | `/login` | Login de usuario | No | `{ email, password, slug }` |
| POST | `/refresh` | Renovar token JWT | No | `{ refreshToken }` |
| POST | `/logout` | Cerrar sesión | Sí | - |
| GET | `/me` | Datos del usuario actual | Sí | - |
| POST | `/register` | Registrar nuevo tenant | No | `{ name, email, password, ... }` |

**Ejemplo de Login:**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mitienda.com",
    "password": "password123",
    "slug": "mitienda"
  }'
```

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "cm123abc",
      "email": "admin@mitienda.com",
      "name": "Administrador",
      "tenantId": "cm456def",
      "role": {
        "id": "cm789ghi",
        "name": "Administrador",
        "permissions": ["pos:sell", "pos:cancel", "inventory:manage"]
      }
    }
  }
}
```

### 8.2. Productos (`/api/products`)

| Método | Ruta | Descripción | Auth | Params |
|--------|------|-------------|------|--------|
| GET | `/` | Listar productos | Sí | `?page=1&pageSize=50&category=...&search=...` |
| GET | `/:id` | Detalle de producto | Sí | - |
| GET | `/barcode/:barcode` | Buscar por código de barras | Sí | - |
| POST | `/` | Crear producto | Sí | Datos del producto |
| PUT | `/:id` | Actualizar producto | Sí | Datos del producto |
| DELETE | `/:id` | Eliminar producto | Sí | - |
| GET | `/stock/:productId` | Stock por sucursal | Sí | - |
| PUT | `/stock/:productId` | Actualizar stock | Sí | `{ branchId, quantity }` |

### 8.3. Ventas (`/api/sales`)

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| POST | `/` | Crear venta | Sí | `{ branchId, pointOfSaleId, items[], payments[], customerId? }` |
| GET | `/` | Listar ventas | Sí | `?page=1&dateFrom=...&dateTo=...` |
| GET | `/:id` | Detalle de venta | Sí | - |
| POST | `/:id/cancel` | Anular venta | Sí | `{ reason }` |
| POST | `/:id/refund` | Procesar devolución | Sí | `{ items[], reason, emitCreditNote }` |
| GET | `/:id/refunds` | Devoluciones de una venta | Sí | - |
| GET | `/reports/daily-summary` | Resumen del día | Sí | `?branchId=...&pointOfSaleId=...` |

**Ejemplo de Venta:**

```json
POST /api/sales
{
  "branchId": "cm123abc",
  "pointOfSaleId": "cm456def",
  "customerId": "cm789ghi",
  "items": [
    {
      "productId": "cm111aaa",
      "productName": "Remera Negra",
      "quantity": 2,
      "unitPrice": 15000,
      "discount": 0,
      "taxRate": 21
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 30000,
      "amountTendered": 30000
    }
  ]
}
```

### 8.4. Mercado Pago (`/api/mercadopago`)

| Método | Ruta | Descripción | Auth | Body/Params |
|--------|------|-------------|------|-------------|
| GET | `/oauth/authorize` | URL de autorización OAuth | Sí | `?appType=POINT\|QR` |
| GET | `/oauth/callback` | Callback OAuth (llamado por MP) | No | - |
| DELETE | `/oauth/disconnect` | Desvincular cuenta MP | Sí | `?appType=POINT\|QR` |
| POST | `/orders` | Crear orden Point | Sí | `{ pointOfSaleId, amount, externalReference }` |
| GET | `/orders/:orderId` | Estado de orden | Sí | - |
| POST | `/orders/:orderId/cancel` | Cancelar orden | Sí | - |
| POST | `/qr/orders` | Crear orden QR | Sí | `{ pointOfSaleId, amount, externalReference, items[] }` |
| DELETE | `/qr/orders/:pointOfSaleId` | Cancelar orden QR | Sí | - |
| GET | `/qr/status/:externalReference` | Estado orden QR | Sí | - |
| GET | `/devices` | Listar dispositivos Point | Sí | - |
| GET | `/qr/stores` | Listar locales QR | Sí | - |
| GET | `/qr/cashiers` | Listar cajas QR | Sí | `?storeId=...` |
| POST | `/qr/sync-data` | Sincronizar stores/cashiers desde MP | Sí | - |
| GET | `/orphan-payments` | Pagos sin venta asociada | Sí | `?pointOfSaleId=...` |

### 8.5. AFIP (`/api/afip`)

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| GET | `/config` | Configuración AFIP del tenant | Sí | - |
| POST | `/config` | Guardar configuración AFIP | Sí | `{ cuit, businessName, taxCategory, ... }` |
| GET | `/sales-points` | Puntos de venta AFIP | Sí | - |
| POST | `/sales-points` | Crear punto de venta | Sí | `{ number, name?, pointOfSaleId? }` |
| POST | `/invoices` | Emitir comprobante | Sí | Datos completos del comprobante |
| POST | `/invoices/factura-b` | Emitir Factura B simplificada | Sí | `{ salesPointId, totalAmount, receiverDocNum?, ... }` |
| POST | `/invoices/from-sale` | Facturar una venta existente | Sí | `{ saleId, voucherType, receiverDocNum?, ... }` |
| POST | `/invoices/nota-credito-b` | Emitir Nota de Crédito B | Sí | `{ salesPointId, originalInvoiceId, amount? }` |
| GET | `/invoices` | Listar comprobantes | Sí | `?page=1&salesPointId=...&from=...&to=...` |
| GET | `/invoices/:id` | Detalle de comprobante | Sí | - |
| GET | `/invoices/:id/qr` | QR de un comprobante | Sí | - |
| GET | `/status` | Estado del servidor AFIP | Sí | - |
| POST | `/generate-certificate` | Generar certificado digital | Sí | `{ username, password, alias, isProduction }` |

### 8.6. Caja (`/api/cash`)

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| POST | `/sessions/open` | Abrir turno de caja | Sí | `{ pointOfSaleId, openingAmount }` |
| POST | `/sessions/:id/close` | Cerrar turno de caja | Sí | `{ closingAmount, notes? }` |
| GET | `/sessions/active` | Turno activo del usuario | Sí | - |
| GET | `/sessions/:id` | Detalle de turno | Sí | - |
| GET | `/sessions` | Historial de turnos | Sí | `?branchId=...&userId=...` |
| POST | `/movements` | Registrar movimiento (retiro/depósito) | Sí | `{ cashSessionId, type, amount, reason, description? }` |
| GET | `/movements/:sessionId` | Movimientos de un turno | Sí | - |
| POST | `/counts` | Registrar arqueo | Sí | `{ cashSessionId, bills_*, coins_*, ... }` |
| GET | `/counts/:sessionId` | Arqueos de un turno | Sí | - |

### 8.7. Cianbox (`/api/cianbox`)

| Método | Ruta | Descripción | Auth | Body/Params |
|--------|------|-------------|------|-------------|
| POST | `/test-connection` | Probar conexión a Cianbox | Sí | - |
| POST | `/sync/products` | Sincronizar productos | Sí | - |
| POST | `/sync/categories` | Sincronizar categorías | Sí | - |
| POST | `/sync/brands` | Sincronizar marcas | Sí | - |
| POST | `/sync/customers` | Sincronizar clientes | Sí | - |
| POST | `/sync/price-lists` | Sincronizar listas de precios | Sí | - |
| POST | `/sync/branches` | Sincronizar sucursales | Sí | - |
| GET | `/sync/status` | Estado de sincronización | Sí | - |

---

## 9. Modelos de Datos (Base de Datos)

### 9.1. Entidades Core (Multi-tenant)

**Tenant** - Cliente/Empresa

```prisma
model Tenant {
  id               String       @id @default(cuid())
  name             String       // "Mi Tienda S.A."
  slug             String       @unique // "mi-tienda"
  taxId            String?      // CUIT
  logo             String?
  plan             Plan         @default(FREE)
  status           TenantStatus @default(TRIAL)

  // Relaciones
  users            User[]
  branches         Branch[]
  pointsOfSale     PointOfSale[]
  products         Product[]
  sales            Sale[]
  // ... más relaciones
}
```

**User** - Usuario del Sistema

```prisma
model User {
  id           String     @id @default(cuid())
  tenantId     String
  email        String
  passwordHash String
  name         String
  pin          String?    // PIN para POS
  status       UserStatus @default(ACTIVE)
  roleId       String
  branchId     String?    // Sucursal asignada

  // Relaciones
  tenant       Tenant     @relation(...)
  role         Role       @relation(...)
  branch       Branch?    @relation(...)
  sales        Sale[]

  @@unique([tenantId, email])
}
```

**Role** - Rol de Usuario

```prisma
model Role {
  id          String   @id @default(cuid())
  tenantId    String
  name        String   // "Administrador", "Cajero"
  permissions String[] // ["pos:sell", "pos:cancel", "inventory:manage"]

  @@unique([tenantId, name])
}
```

### 9.2. Catálogo de Productos

**Product** - Producto

```prisma
model Product {
  id               String   @id @default(cuid())
  tenantId         String
  cianboxProductId Int?     // ID en Cianbox

  // Códigos
  sku              String?
  barcode          String?

  // Info básica
  name             String
  description      String?
  categoryId       String?
  brandId          String?

  // Precios
  basePrice        Decimal? @db.Decimal(12, 2)
  baseCost         Decimal? @db.Decimal(12, 2)
  taxRate          Decimal  @default(21) @db.Decimal(5, 2)
  taxIncluded      Boolean  @default(true)

  // Stock
  trackStock       Boolean  @default(true)
  minStock         Int?

  // Productos Variables (Curva de Talles)
  isParent         Boolean  @default(false)
  parentProductId  String?
  size             String?  // "38", "40", "L"
  color            String?

  // Estado
  isActive         Boolean  @default(true)

  // Relaciones
  tenant           Tenant           @relation(...)
  category         Category?        @relation(...)
  brand            Brand?           @relation(...)
  parentProduct    Product?         @relation("ProductVariants", ...)
  variants         Product[]        @relation("ProductVariants")
  prices           ProductPrice[]
  stock            ProductStock[]

  @@index([tenantId, barcode])
  @@index([tenantId, isParent])
}
```

**ProductPrice** - Precio por Lista

```prisma
model ProductPrice {
  id          String   @id @default(cuid())
  productId   String
  priceListId String
  price       Decimal  @db.Decimal(12, 2) // CON IVA
  priceNet    Decimal? @db.Decimal(12, 2) // SIN IVA

  @@unique([productId, priceListId])
}
```

**ProductStock** - Stock por Sucursal

```prisma
model ProductStock {
  id           String   @id @default(cuid())
  productId    String
  branchId     String
  quantity     Decimal  @db.Decimal(12, 3)
  reserved     Decimal  @default(0) @db.Decimal(12, 3)
  available    Decimal  @db.Decimal(12, 3) // quantity - reserved

  @@unique([productId, branchId])
}
```

### 9.3. Ventas

**Sale** - Venta

```prisma
model Sale {
  id              String      @id @default(cuid())
  tenantId        String
  branchId        String
  pointOfSaleId   String
  userId          String      // Cajero
  customerId      String?
  cashSessionId   String?     // Turno de caja

  // Numeración
  saleNumber      String      // "SUC-1-CAJA-01-20241225-0001"
  receiptType     ReceiptType @default(TICKET)

  // Montos
  subtotal        Decimal     @db.Decimal(12, 2)
  discount        Decimal     @default(0) @db.Decimal(12, 2)
  tax             Decimal     @default(0) @db.Decimal(12, 2)
  total           Decimal     @db.Decimal(12, 2)

  // Estado
  status          SaleStatus  @default(COMPLETED)

  // Relaciones
  items           SaleItem[]
  payments        Payment[]
  afipInvoices    AfipInvoice[]

  @@unique([tenantId, saleNumber])
}
```

**SaleItem** - Item de Venta

```prisma
model SaleItem {
  id            String   @id @default(cuid())
  saleId        String
  productId     String?

  productName   String
  quantity      Decimal  @db.Decimal(12, 3)
  unitPrice     Decimal  @db.Decimal(12, 2) // CON IVA
  unitPriceNet  Decimal? @db.Decimal(12, 2) // SIN IVA
  discount      Decimal  @default(0) @db.Decimal(12, 2)
  subtotal      Decimal  @db.Decimal(12, 2)
  taxRate       Decimal  @default(21) @db.Decimal(5, 2)

  promotionId   String?
  promotionName String?
}
```

**Payment** - Pago

```prisma
model Payment {
  id            String        @id @default(cuid())
  saleId        String
  method        PaymentMethod
  amount        Decimal       @db.Decimal(12, 2)

  // Efectivo
  amountTendered Decimal?     @db.Decimal(12, 2)
  changeAmount   Decimal?     @db.Decimal(12, 2)

  // Tarjeta / MP
  reference     String?
  cardBrand     String?
  cardLastFour  String?
  installments  Int           @default(1)

  // Mercado Pago
  mpPaymentId       String?
  mpOrderId         String?
  mpOperationType   String?
  mpFeeAmount       Decimal?  @db.Decimal(12, 2)
  netReceivedAmount Decimal?  @db.Decimal(12, 2)

  status        PaymentStatus @default(COMPLETED)
}

enum PaymentMethod {
  CASH
  CREDIT_CARD
  DEBIT_CARD
  QR
  MP_POINT
  TRANSFER
  CREDIT
  OTHER
}
```

### 9.4. Facturación AFIP

**AfipConfig** - Configuración AFIP del Tenant

```prisma
model AfipConfig {
  id              String          @id @default(cuid())
  tenantId        String          @unique

  cuit            String
  businessName    String
  tradeName       String?
  taxCategory     AfipTaxCategory

  afipAccessToken String?         // Token AfipSDK
  afipCert        String?         @db.Text
  afipKey         String?         @db.Text

  isProduction    Boolean         @default(false)
  isActive        Boolean         @default(true)
}
```

**AfipSalesPoint** - Punto de Venta AFIP

```prisma
model AfipSalesPoint {
  id              String  @id @default(cuid())
  tenantId        String
  afipConfigId    String

  number          Int     // 1-99999
  name            String?

  // Secuencias
  lastInvoiceB    Int     @default(0)
  lastCreditNoteB Int     @default(0)

  pointOfSaleId   String? // Vinculación con POS del sistema

  @@unique([tenantId, number])
}
```

**AfipInvoice** - Comprobante Electrónico

```prisma
model AfipInvoice {
  id              String          @id @default(cuid())
  tenantId        String
  salesPointId    String

  voucherType     AfipVoucherType // FACTURA_B, NOTA_CREDITO_B
  number          Int

  cae             String          // CAE recibido de AFIP
  caeExpiration   DateTime

  issueDate       DateTime

  // Receptor
  receiverDocType String          // 80=CUIT, 96=DNI, 99=CF
  receiverDocNum  String
  receiverName    String?

  // Montos
  netAmount       Decimal         @db.Decimal(12, 2)
  taxAmount       Decimal         @db.Decimal(12, 2)
  totalAmount     Decimal         @db.Decimal(12, 2)

  // Vínculo con venta
  saleId          String?

  status          AfipInvoiceStatus @default(ISSUED)

  @@unique([salesPointId, voucherType, number])
}
```

### 9.5. Gestión de Caja

**CashSession** - Turno de Caja

```prisma
model CashSession {
  id               String            @id @default(cuid())
  tenantId         String
  branchId         String
  pointOfSaleId    String
  userId           String            // Cajero
  sessionNumber    String            // "T-001-20241225-001"

  // Apertura
  openingAmount    Decimal           @db.Decimal(12, 2)
  openedAt         DateTime          @default(now())
  openedByUserId   String

  // Cierre
  closingAmount    Decimal?          @db.Decimal(12, 2)
  closedAt         DateTime?
  closedByUserId   String?

  // Totales por método
  totalCash        Decimal           @default(0) @db.Decimal(12, 2)
  totalDebit       Decimal           @default(0) @db.Decimal(12, 2)
  totalCredit      Decimal           @default(0) @db.Decimal(12, 2)
  totalQr          Decimal           @default(0) @db.Decimal(12, 2)
  totalMpPoint     Decimal           @default(0) @db.Decimal(12, 2)

  // Contadores
  salesCount       Int               @default(0)
  salesTotal       Decimal           @default(0) @db.Decimal(12, 2)

  status           CashSessionStatus @default(OPEN)

  // Relaciones
  sales            Sale[]
  movements        CashMovement[]
  counts           CashCount[]
}
```

**CashMovement** - Movimiento de Caja

```prisma
model CashMovement {
  id               String              @id @default(cuid())
  cashSessionId    String
  type             CashMovementType    // DEPOSIT, WITHDRAWAL
  amount           Decimal             @db.Decimal(12, 2)
  reason           CashMovementReason  // SAFE_DEPOSIT, EXPENSE
  description      String?

  createdByUserId  String
  createdAt        DateTime            @default(now())
}
```

**CashCount** - Arqueo de Caja

```prisma
model CashCount {
  id              String          @id @default(cuid())
  cashSessionId   String
  type            CashCountType   @default(PARTIAL)

  // Conteo por denominación (billetes y monedas)
  bills_10000     Int             @default(0)
  bills_5000      Int             @default(0)
  // ... más denominaciones
  coins_500       Int             @default(0)
  // ... más monedas

  totalBills      Decimal         @db.Decimal(12, 2)
  totalCoins      Decimal         @db.Decimal(12, 2)
  totalCash       Decimal         @db.Decimal(12, 2)

  expectedAmount  Decimal         @db.Decimal(12, 2)
  difference      Decimal         @db.Decimal(12, 2)

  countedByUserId String
  countedAt       DateTime        @default(now())
}
```

### 9.6. Mercado Pago

**MercadoPagoConfig** - Configuración OAuth

```prisma
model MercadoPagoConfig {
  id              String              @id @default(cuid())
  tenantId        String

  appType         MercadoPagoAppType  @default(POINT) // POINT o QR

  accessToken     String
  refreshToken    String?
  tokenExpiresAt  DateTime?

  mpUserId        String?
  publicKey       String?

  isActive        Boolean             @default(true)

  @@unique([tenantId, appType])
}
```

**MercadoPagoOrder** - Orden de Pago

```prisma
model MercadoPagoOrder {
  id                String   @id @default(cuid())
  tenantId          String
  saleId            String?  @unique
  orderId           String   @unique // ID de orden en MP
  externalReference String
  deviceId          String   // Para Point
  amount            Decimal  @db.Decimal(12, 2)
  status            String   // PENDING, PROCESSED, CANCELED
  paymentId         String?
  cardBrand         String?
  cardLastFour      String?
}
```

---

## 10. Servicios e Integraciones

### 10.1. Cianbox ERP

**Descripción:**
Integración bidireccional con Cianbox ERP para sincronización automática de catálogo, clientes, y ventas.

**Autenticación:**
OAuth 2.0 con refresh token automático.

**Endpoints utilizados:**

| Cianbox Endpoint | Método | Uso |
|------------------|--------|-----|
| `/auth/credentials` | POST | Obtener access token |
| `/productos/lista` | GET | Sincronizar productos |
| `/productos/categorias` | GET | Sincronizar categorías |
| `/productos/marcas` | GET | Sincronizar marcas |
| `/clientes/lista` | GET | Sincronizar clientes |
| `/sucursales/lista` | GET | Sincronizar sucursales |
| `/listas-precio/lista` | GET | Sincronizar listas de precios |
| `/pedidos/crear` | POST | Enviar ventas a Cianbox |

**Configuración:**

Cada tenant tiene una `CianboxConnection` con:
- `cuenta`: Nombre de la cuenta en Cianbox (ej: "miempresa")
- `appName`: Nombre de la app registrada
- `appCode`: Código de la app
- `user` y `password`: Credenciales
- `accessToken` y `refreshToken`: Tokens cacheados
- `syncPageSize`: Tamaño de página para sincronización (default: 50, max: 200)

**Sincronización:**

Los tokens se refrescan automáticamente cada hora mediante un cron job:

```typescript
cron.schedule('0 * * * *', async () => {
  await CianboxService.refreshAllTokens();
});
```

### 10.2. Mercado Pago

**Descripción:**
Integración completa con Mercado Pago para cobros con Point (terminal física) y QR (billetera virtual).

**Tipos de Aplicación:**

El sistema soporta **dos aplicaciones OAuth separadas**:

1. **POINT**: Para terminales físicas Mercado Pago Point
2. **QR**: Para códigos QR dinámicos (billetera virtual)

**Autenticación:**
OAuth 2.0 con redirect URL configurable.

**Flujo OAuth:**

```
1. Frontend solicita URL de autorización → GET /api/mercadopago/oauth/authorize?appType=POINT
2. Backend genera URL con state codificado → https://auth.mercadopago.com.ar/authorization?...
3. Usuario autoriza en MP → MP redirige a callback
4. Backend intercambia code por tokens → POST https://api.mercadopago.com/oauth/token
5. Backend guarda tokens → MercadoPagoConfig
6. Frontend recibe confirmación → Redirigido a /integrations
```

**Webhooks:**

MP envía notificaciones de eventos a `/api/webhooks/mercadopago`:

```typescript
// Validación de firma HMAC-SHA256
function validateWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string
): boolean {
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const calculatedHash = crypto.createHmac('sha256', MP_WEBHOOK_SECRET)
    .update(manifest).digest('hex');
  return calculatedHash === v1;
}
```

**Point - Crear Orden:**

```bash
POST /api/mercadopago/orders
{
  "pointOfSaleId": "cm123abc",
  "amount": 15000,
  "externalReference": "POS-001-20241225-0001",
  "description": "Venta POS"
}
```

**QR - Crear Orden:**

```bash
POST /api/mercadopago/qr/orders
{
  "pointOfSaleId": "cm123abc",
  "amount": 15000,
  "externalReference": "POS-001-20241225-0001",
  "items": [
    {
      "title": "Remera Negra",
      "quantity": 2,
      "unit_price": 7500
    }
  ]
}
```

### 10.3. AFIP (Facturación Electrónica)

**Descripción:**
Integración con Web Services de AFIP para emisión de comprobantes electrónicos mediante AfipSDK.

**Web Services utilizados:**

- **WSFE** (Web Service de Facturación Electrónica): Emisión de facturas A, B, C y notas de crédito
- **WSAA** (Web Service de Autenticación y Autorización): Obtención de tickets de acceso

**Configuración:**

Cada tenant requiere:
- **CUIT** del facturante
- **Certificado digital** (.crt)
- **Clave privada** (.key)
- **Access Token** de AfipSDK (opcional, para generación automática de certificados)

**Generación Automática de Certificados:**

El sistema puede generar certificados digitales automáticamente usando AfipSDK:

```bash
POST /api/afip/generate-certificate
{
  "username": "20123456789",  // CUIT
  "password": "contraseña_afip",
  "alias": "CIANBOX-POS-PROD",
  "isProduction": true
}
```

**Proceso:**
1. AfipSDK automatiza el login en AFIP
2. Genera certificado CSR
3. Lo firma con AFIP
4. Descarga .crt y .key
5. Guarda en `AfipConfig`

**Emisión de Factura B:**

```bash
POST /api/afip/invoices/factura-b
{
  "salesPointId": "cm123abc",
  "totalAmount": 30000,
  "receiverDocType": 99,  // 99=Consumidor Final
  "receiverDocNum": "0",
  "saleId": "cm456def"
}
```

**Respuesta:**

```json
{
  "success": true,
  "cae": "74123456789012",
  "caeExpiration": "2025-01-04T00:00:00.000Z",
  "voucherNumber": "00000042",
  "invoiceId": "cm789ghi"
}
```

**QR de Factura:**

AFIP requiere un QR en cada comprobante. El sistema genera la URL:

```
https://www.afip.gob.ar/fe/qr/?p=<base64_datos>
```

Donde `<base64_datos>` contiene:
```json
{
  "ver": 1,
  "fecha": "2024-12-25",
  "cuit": 20123456789,
  "ptoVta": 1,
  "tipoCmp": 6,
  "nroCmp": 42,
  "importe": 30000,
  "moneda": "PES",
  "ctz": 1,
  "tipoDocRec": 99,
  "nroDocRec": 0,
  "tipoCodAut": "E",
  "codAut": 74123456789012
}
```

---

## 11. Convenciones de Código

### 11.1. Nomenclatura

**TypeScript/JavaScript:**

- **Variables y funciones**: `camelCase`
  ```typescript
  const userName = 'Juan';
  function calculateTotal(items: SaleItem[]) { ... }
  ```

- **Clases**: `PascalCase`
  ```typescript
  class CianboxService { ... }
  class MercadoPagoConfig { ... }
  ```

- **Constantes**: `UPPER_SNAKE_CASE`
  ```typescript
  const MAX_PAGE_SIZE = 200;
  const JWT_EXPIRES_IN = '7d';
  ```

- **Interfaces/Types**: `PascalCase` con prefijo `I` opcional
  ```typescript
  interface CianboxProduct { ... }
  type PaymentMethod = 'CASH' | 'CREDIT_CARD';
  ```

- **Archivos**: `kebab-case.ts`
  ```
  cianbox.service.ts
  mercadopago.service.ts
  argentina-locations.ts
  ```

**Prisma Schema:**

- **Modelos**: `PascalCase` singular
  ```prisma
  model Product { ... }
  model Sale { ... }
  ```

- **Campos**: `camelCase`
  ```prisma
  model User {
    passwordHash String
    tenantId String
  }
  ```

- **Enums**: `PascalCase`
  ```prisma
  enum PaymentMethod {
    CASH
    CREDIT_CARD
  }
  ```

### 11.2. Filtrado por Tenant

**REGLA CRÍTICA:** Todas las queries a la base de datos **DEBEN** filtrar por `tenantId`.

**✅ Ejemplo Correcto:**

```typescript
router.get('/products', authenticate, async (req: AuthenticatedRequest, res) => {
  const tenantId = req.user!.tenantId;

  const products = await prisma.product.findMany({
    where: {
      tenantId,        // ✅ SIEMPRE incluir
      isActive: true
    }
  });

  res.json({ success: true, data: products });
});
```

**❌ Ejemplo Incorrecto:**

```typescript
// ❌ PELIGRO: Expone productos de todos los tenants
const products = await prisma.product.findMany({
  where: { isActive: true }  // ❌ Falta tenantId
});
```

### 11.3. Validación de Input

**Usar Zod para validación de esquemas:**

```typescript
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().positive('El precio debe ser mayor a 0'),
  categoryId: z.string(),
  isActive: z.boolean().default(true),
});

router.post('/products', authenticate, async (req, res, next) => {
  try {
    const validation = productSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.errors);
    }

    const data = validation.data;
    // ... crear producto
  } catch (error) {
    next(error);
  }
});
```

### 11.4. Manejo de Errores

**Usar clases de error personalizadas:**

```typescript
// utils/errors.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
  }

  static badRequest(message: string) {
    return new ApiError(400, message, 'BAD_REQUEST');
  }

  static notFound(entity: string) {
    return new ApiError(404, `${entity} no encontrado`, 'NOT_FOUND');
  }

  static unauthorized(message: string = 'No autorizado') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }
}

// Uso en rutas
if (!product) {
  throw ApiError.notFound('Producto');
}

if (sale.total !== totalPaid) {
  throw ApiError.badRequest('El total de pagos no coincide');
}
```

### 11.5. Async/Await

**Siempre usar try-catch con async/await:**

```typescript
router.get('/sales/:id', authenticate, async (req, res, next) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user!.tenantId
      },
      include: {
        items: true,
        payments: true,
        customer: true
      }
    });

    if (!sale) {
      throw ApiError.notFound('Venta');
    }

    res.json({ success: true, data: sale });
  } catch (error) {
    next(error);  // Middleware de errores lo procesa
  }
});
```

### 11.6. Transacciones de Base de Datos

**Usar transacciones para operaciones que modifican múltiples tablas:**

```typescript
const sale = await prisma.$transaction(async (tx) => {
  // 1. Crear venta
  const newSale = await tx.sale.create({
    data: { /* ... */ }
  });

  // 2. Actualizar stock
  for (const item of items) {
    await tx.productStock.updateMany({
      where: { productId: item.productId, branchId },
      data: { quantity: { decrement: item.quantity } }
    });
  }

  // 3. Actualizar sesión de caja
  await tx.cashSession.update({
    where: { id: cashSessionId },
    data: { salesCount: { increment: 1 } }
  });

  return newSale;
});
```

### 11.7. Logging

**Usar console.log con prefijos descriptivos:**

```typescript
console.log(`[Cianbox] Sincronizando productos del tenant ${tenantId}...`);
console.log(`[MP Webhook] Recibido: ${JSON.stringify(req.body)}`);
console.error(`[AFIP] Error al emitir factura:`, error);
```

### 11.8. Comentarios

**Comentar funcionalidad compleja, no código obvio:**

```typescript
// ✅ Bueno: Explica el "por qué"
// Validar firma HMAC-SHA256 según spec de Mercado Pago
// para prevenir webhooks maliciosos
function validateWebhookSignature(...) { ... }

// ❌ Malo: Explica el "qué" (obvio del código)
// Incrementar el contador de ventas en 1
salesCount += 1;
```

**JSDoc para funciones públicas:**

```typescript
/**
 * Genera un número de venta secuencial por día y punto de venta
 * @param tenantId - ID del tenant
 * @param branchId - ID de la sucursal
 * @param pointOfSaleId - ID del punto de venta
 * @returns Número de venta formato "SUC-1-CAJA-01-20241225-0001"
 */
async function generateSaleNumber(
  tenantId: string,
  branchId: string,
  pointOfSaleId: string
): Promise<string> {
  // ...
}
```

---

## 12. Testing

### 12.1. Estrategia de Testing

El proyecto incluye tests unitarios y de integración usando **Jest**.

**Estructura:**

```
apps/backend/src/
├── __tests__/
│   ├── mp-cashier-codes.test.ts
│   ├── mp-store-data.test.ts
│   ├── mp-location.test.ts
│   └── argentina-locations.test.ts
└── services/
    └── mercadopago.service.ts
```

**Ejecutar tests:**

```bash
cd apps/backend

# Todos los tests
npm test

# En modo watch
npm run test:watch

# Con coverage
npm run test:coverage
```

### 12.2. Ejemplo de Test

```typescript
// __tests__/argentina-locations.test.ts
import { getProvinceCode, getCityFromMPLocation } from '../utils/argentina-locations';

describe('Argentina Locations', () => {
  describe('getProvinceCode', () => {
    it('debe retornar el código de provincia correcto', () => {
      expect(getProvinceCode('Buenos Aires')).toBe('B');
      expect(getProvinceCode('Córdoba')).toBe('X');
      expect(getProvinceCode('Ciudad Autónoma de Buenos Aires')).toBe('C');
    });

    it('debe retornar null para provincia inexistente', () => {
      expect(getProvinceCode('Provincia Inventada')).toBeNull();
    });
  });
});
```

### 12.3. Testing Manual con Credenciales de Prueba

Ver archivo `docs/TESTING-CREDENTIALS.md` para credenciales de tenants de prueba.

---

## 13. Deployment

### 13.1. Infraestructura de Producción

**Servidores:**

| Servidor | IP | Hostname | Rol |
|----------|-----|----------|-----|
| APP Server | 172.16.1.61 | cianbox-pos-app | Backend + Frontends + GitHub Runner |
| DB Server | 172.16.1.62 | cianbox-pos-db1 | PostgreSQL 15.14 |

**Servicios en APP Server:**

- **PM2**: Gestiona el proceso del backend (puerto 3001)
- **Nginx**: Reverse proxy para frontends y API
- **GitHub Actions Runner**: CI/CD self-hosted

**Servicios en DB Server:**

- **PostgreSQL 15.14**: Base de datos principal

### 13.2. Proceso de Deployment

**Deployment Automático con GitHub Actions:**

1. Developer hace commit y push a `main`:
   ```bash
   git add .
   git commit -m "feat: nueva funcionalidad"
   git push origin main
   ```

2. GitHub Actions se activa automáticamente (`.github/workflows/deploy.yml`)

3. Self-hosted runner en servidor ejecuta:
   ```bash
   - git pull
   - cd apps/backend && npm install && npm run build
   - cd apps/frontend && npm install && npm run build
   - cd apps/backoffice && npm install && npm run build
   - cd apps/agency && npm install && npm run build
   - npx prisma migrate deploy
   - pm2 restart cianbox-pos-api
   - cp dist/* to nginx directories
   ```

4. Nginx sirve los nuevos archivos estáticos

**⚠️ IMPORTANTE:** Siempre ejecutar build local antes de push para verificar que compila sin errores:

```bash
cd apps/backend && npm run build
cd apps/frontend && npm run build
cd apps/backoffice && npm run build
cd apps/agency && npm run build
```

### 13.3. Migraciones de Base de Datos

**Las migraciones se ejecutan automáticamente en el deploy:**

```bash
# En el runner de GitHub Actions
npx prisma migrate deploy
```

**No se requiere intervención manual**. Prisma aplica migraciones pendientes automáticamente con `prisma db push` o `prisma migrate deploy`.

**Para desarrollo local:**

```bash
# Crear nueva migración
npx prisma migrate dev --name add_new_field

# Aplicar migraciones
npx prisma migrate deploy

# Ver estado
npx prisma migrate status
```

### 13.4. Logs y Monitoreo

**PM2:**

```bash
# Ver logs del backend
pm2 logs cianbox-pos-api

# Ver estado
pm2 status

# Reiniciar
pm2 restart cianbox-pos-api
```

**Nginx:**

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

**PostgreSQL:**

```bash
# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### 13.5. Rollback

**En caso de deployment fallido:**

```bash
# 1. SSH al servidor
ssh -i "ssh key/root_servers_ssh_key" root@172.16.1.61

# 2. Ir al directorio del proyecto
cd /var/www/cianbox-pos

# 3. Hacer rollback de Git
git reset --hard HEAD~1

# 4. Reconstruir
cd apps/backend && npm run build
cd apps/frontend && npm run build

# 5. Reiniciar PM2
pm2 restart cianbox-pos-api
```

---

## 14. Seguridad

### 14.1. Autenticación JWT

**Generación de Token:**

```typescript
import jwt from 'jsonwebtoken';

const accessToken = jwt.sign(
  {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roleId: user.roleId
  },
  process.env.JWT_SECRET!,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

**Verificación:**

```typescript
// middleware/auth.ts
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('Token no proporcionado');

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'No autorizado' });
  }
};
```

### 14.2. Autorización por Permisos

```typescript
export const authorize = (...requiredPermissions: string[]) => {
  return async (req: AuthenticatedRequest, res, next) => {
    const user = req.user!;

    const role = await prisma.role.findUnique({
      where: { id: user.roleId }
    });

    const hasPermission = requiredPermissions.every(perm =>
      role.permissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
};

// Uso en rutas
router.post('/sales', authenticate, authorize('pos:sell'), async (req, res) => {
  // ...
});
```

### 14.3. Encriptación de Contraseñas

```typescript
import bcrypt from 'bcryptjs';

// Al crear usuario
const passwordHash = await bcrypt.hash(password, 10);

// Al verificar login
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### 14.4. Sanitización de Input

**Zod automáticamente sanitiza y valida:**

```typescript
const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8)
});

// Si el input no cumple, lanza error antes de llegar a DB
```

### 14.5. Headers de Seguridad (Helmet)

```typescript
import helmet from 'helmet';

app.use(helmet());
// Configura automáticamente:
// - Content-Security-Policy
// - X-Frame-Options
// - X-Content-Type-Options
// - Strict-Transport-Security
```

### 14.6. CORS

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 15. Troubleshooting

### 15.1. Problemas Comunes

**Error: "Conexión a base de datos rechazada"**

```
Error: Can't reach database server at 172.16.1.62:5432
```

**Solución:**
```bash
# Verificar que PostgreSQL está corriendo
ssh root@172.16.1.62
systemctl status postgresql

# Verificar firewall
sudo ufw status
sudo ufw allow 5432/tcp

# Verificar pg_hba.conf permite la IP del app server
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Debe tener:
# host    cianbox_pos    cianbox_pos    172.16.1.61/32    md5
```

**Error: "Token expirado"**

```
JsonWebTokenError: jwt expired
```

**Solución:**
```typescript
// Frontend debe refrescar el token
const refreshToken = localStorage.getItem('refreshToken');
const response = await axios.post('/api/auth/refresh', { refreshToken });
localStorage.setItem('accessToken', response.data.accessToken);
```

**Error: "TenantId filtro faltante"**

```
Error: Query returned data from multiple tenants
```

**Solución:**
```typescript
// ❌ Query sin tenantId
const sales = await prisma.sale.findMany();

// ✅ Agregar filtro
const sales = await prisma.sale.findMany({
  where: { tenantId: req.user!.tenantId }
});
```

**Error: "Mercado Pago token expirado"**

```
Error: MP API returned 401 Unauthorized
```

**Solución:**
```bash
# El sistema debería refrescar automáticamente, pero se puede forzar:
POST /api/mercadopago/refresh-token?appType=POINT
```

**Error: "AFIP Web Service no disponible"**

```
Error: AFIP WSFE returned SOAP fault
```

**Solución:**
```bash
# Verificar estado de AFIP
GET /api/afip/status

# Si AFIP está en mantenimiento, esperar
# Si el certificado expiró, renovar:
POST /api/afip/generate-certificate
```

### 15.2. Logs de Debug

**Habilitar logs de debug en desarrollo:**

```bash
# .env
NODE_ENV=development
DEBUG=prisma:query,prisma:info
```

**Ver queries de Prisma:**

```typescript
// En código
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### 15.3. Comandos Útiles

**Backend:**

```bash
# Ver estado de migraciones
npx prisma migrate status

# Resetear base de datos (¡CUIDADO! Solo en desarrollo)
npx prisma migrate reset

# Abrir Prisma Studio (GUI para ver datos)
npx prisma studio

# Generar cliente de Prisma después de cambios en schema
npx prisma generate

# Ver logs de PM2
pm2 logs cianbox-pos-api --lines 100
```

**Base de Datos:**

```bash
# Conectarse a PostgreSQL
sudo -u postgres psql -d cianbox_pos

# Ver tablas
\dt

# Ver registros de un tenant
SELECT * FROM "Product" WHERE "tenantId" = 'cm123abc' LIMIT 10;

# Backup
pg_dump -U cianbox_pos cianbox_pos > backup_$(date +%Y%m%d).sql

# Restore
psql -U cianbox_pos cianbox_pos < backup_20241225.sql
```

---

## 16. Contacto y Soporte

**Documentación Adicional:**

- Guía técnica completa: `docs/GUIA-TECNICA-POS-CIANBOX.md`
- Arquitectura: `docs/ARQUITECTURA.md`
- API de Productos: `docs/API-PRODUCTOS.md`
- API de Ventas: `docs/API-SALES.md`
- API de Mercado Pago: `docs/API-MERCADOPAGO.md`
- Infraestructura: `docs/INFRAESTRUCTURA.md`
- Credenciales de testing: `docs/TESTING-CREDENTIALS.md`

**Repositorio:**
https://github.com/tu-org/cianbox-pos

**Issues:**
https://github.com/tu-org/cianbox-pos/issues

---

**Documento generado automáticamente - Versión 1.0.0**
