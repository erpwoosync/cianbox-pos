# Arquitectura Técnica - Cianbox POS

## 1. Resumen del Proyecto

Sistema POS (Point of Sale) multi-tenant con arquitectura de tres capas que integra múltiples clientes empresariales con sus respectivas instancias de Cianbox ERP. Permite gestión centralizada desde un backoffice de agencia mientras cada tenant opera de forma independiente y aislada.

**Características principales:**
- Multi-tenancy con aislamiento completo de datos
- Integración bidireccional con Cianbox ERP mediante API REST
- Arquitectura escalable preparada para sharding de base de datos
- Sistema de promociones inteligente (2x1, descuentos por volumen, flash sales)
- Comunicación en tiempo real mediante WebSockets
- CI/CD automatizado con GitHub Actions

## 2. Stack Tecnológico

### Backend

| Categoría | Tecnología | Versión | Propósito |
|-----------|------------|---------|-----------|
| Runtime | Node.js | 18+ | Entorno de ejecución JavaScript |
| Framework | Express | 4.21.1 | Servidor HTTP y API REST |
| ORM | Prisma | 5.22.0 | Mapeo objeto-relacional y migraciones |
| Base de Datos | PostgreSQL | 15+ | Base de datos relacional principal |
| Autenticación | JWT | 9.0.2 | Tokens de autenticación sin estado |
| Validación | Zod | 3.23.8 | Validación de esquemas TypeScript-first |
| WebSockets | Socket.io | 4.8.1 | Comunicación bidireccional en tiempo real |
| Seguridad | Helmet | 8.0.0 | Headers de seguridad HTTP |
| Hash | bcryptjs | 2.4.3 | Hash de contraseñas con salt |
| CORS | cors | 2.8.5 | Control de acceso cross-origin |

### Frontend (POS)

| Categoría | Tecnología | Versión | Propósito |
|-----------|------------|---------|-----------|
| Framework | React | 18.3.1 | Biblioteca UI declarativa |
| Build Tool | Vite | 5.4.11 | Empaquetador ultrarrápido |
| Routing | React Router | 6.28.0 | Navegación SPA |
| HTTP Client | Axios | 1.7.7 | Cliente HTTP con interceptores |
| State | Zustand | 5.0.1 | Gestión de estado ligera |
| Estilos | TailwindCSS | 3.4.15 | Framework CSS utility-first |
| Iconos | Lucide React | 0.460.0 | Biblioteca de iconos moderna |
| Utils | clsx + tailwind-merge | - | Utilidades de clases CSS |

### Frontend (Agency Backoffice)

| Categoría | Tecnología | Versión | Propósito |
|-----------|------------|---------|-----------|
| Framework | React | 18.3.1 | Biblioteca UI declarativa |
| Build Tool | Vite | 5.4.10 | Empaquetador ultrarrápido |
| Routing | React Router | 6.28.0 | Navegación SPA |
| HTTP Client | Axios | 1.7.7 | Cliente HTTP con interceptores |
| State | Zustand | 5.0.1 | Gestión de estado ligera |
| Estilos | TailwindCSS | 3.4.14 | Framework CSS utility-first |
| Iconos | Lucide React | 0.454.0 | Biblioteca de iconos moderna |

### DevOps e Infraestructura

| Categoría | Tecnología | Propósito |
|-----------|------------|-----------|
| CI/CD | GitHub Actions | Automatización de deploy |
| Runner | Self-hosted | Ejecución en servidor local |
| Gestor Procesos | PM2 | Gestión de procesos Node.js en producción |
| Proxy Reverso | Nginx | Servidor web y balanceador de carga |
| Control de Versiones | Git | Gestión de código fuente |
| Package Manager | npm | Gestor de dependencias |

## 3. Arquitectura del Sistema

### 3.1. Vista de Alto Nivel

```
┌──────────────────────────────────────────────────────────────────┐
│                        CAPA DE PRESENTACIÓN                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┐              ┌──────────────────────┐  │
│  │  Frontend POS      │              │  Agency Backoffice   │  │
│  │  (React + Vite)    │              │  (React + Vite)      │  │
│  │                    │              │                      │  │
│  │  • Ventas          │              │  • Gestión Tenants   │  │
│  │  • Productos       │              │  • DB Servers        │  │
│  │  • Promociones     │              │  • Usuarios Agency   │  │
│  │  • Sincronización  │              │  • Dashboard Global  │  │
│  └─────────┬──────────┘              └──────────┬───────────┘  │
│            │                                    │              │
└────────────┼────────────────────────────────────┼──────────────┘
             │                                    │
             │ HTTP/WS                            │ HTTP
             │ (puerto 80)                        │ (puerto 8083)
             │                                    │
┌────────────┼────────────────────────────────────┼──────────────┐
│            │         CAPA DE SERVIDOR           │              │
│            └────────────────┬───────────────────┘              │
│                             │                                  │
│                    ┌────────▼────────┐                         │
│                    │  Nginx Reverse  │                         │
│                    │  Proxy          │                         │
│                    └────────┬────────┘                         │
│                             │                                  │
│                    ┌────────▼────────┐                         │
│                    │  Backend API    │                         │
│                    │  Express + PM2  │                         │
│                    │  (puerto 3001)  │                         │
│                    │                 │                         │
│                    │  Routes:        │                         │
│                    │  • /api/auth    │ ◄─── Auth JWT separado │
│                    │  • /api/agency  │      (Tenant vs Agency)│
│                    │  • /api/products│                         │
│                    │  • /api/sales   │                         │
│                    │  • /api/cianbox │                         │
│                    │  • /api/promotions                        │
│                    └────────┬────────┘                         │
│                             │                                  │
└─────────────────────────────┼────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
┌────────────────▼──┐   ┌─────▼─────┐   ┌─▼─────────────────┐
│  PostgreSQL DB    │   │ Cianbox   │   │  Socket.io        │
│  (172.16.1.62)    │   │ API REST  │   │  Real-time Events │
│                   │   │ (Externa) │   │                   │
│  • Multi-tenant   │   └───────────┘   │  • Ventas nuevas  │
│  • Sharding ready │                   │  • Stock updates  │
│  • Master DB      │                   │  • Notificaciones │
└───────────────────┘                   └───────────────────┘
```

### 3.2. Arquitectura Multi-Tenant

El sistema implementa multi-tenancy mediante **aislamiento por fila** (row-level isolation) con preparación para **sharding horizontal** futuro:

```
┌─────────────────────────────────────────────────────────────────┐
│                     BASE DE DATOS MASTER                        │
│                     (172.16.1.62)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  TABLAS NIVEL AGENCIA (sin tenantId)                    │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  • AgencyUser         (Super admins)                    │  │
│  │  • AgencySettings     (Configuración global)            │  │
│  │  • DatabaseServer     (Servidores BD para sharding)     │  │
│  │  • Tenant             (Metadata de clientes)            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  TABLAS NIVEL TENANT (con tenantId obligatorio)         │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  • User, Role, CianboxConnection                        │  │
│  │  • Branch, PointOfSale                                  │  │
│  │  • Category, Brand, Product, PriceList                  │  │
│  │  • Customer, Sale, SaleItem, Payment                    │  │
│  │  • Promotion, Combo, CashRegister                       │  │
│  │  • Printer, PrintPoint, AuditLog                        │  │
│  │                                                          │  │
│  │  REGLA CRÍTICA: Todas las queries DEBEN filtrar por     │  │
│  │  tenantId para garantizar aislamiento de datos          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

SHARDING FUTURO (DatabaseServer apunta a distintos servidores):

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  DB Server 1 │     │  DB Server 2 │     │  DB Server 3 │
│              │     │              │     │              │
│  Tenants:    │     │  Tenants:    │     │  Tenants:    │
│  • tenant-a  │     │  • tenant-d  │     │  • tenant-g  │
│  • tenant-b  │     │  • tenant-e  │     │  • tenant-h  │
│  • tenant-c  │     │  • tenant-f  │     │  • tenant-i  │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Mecanismo de Aislamiento:**

1. **Filtrado por tenantId**: Todas las queries incluyen `WHERE tenantId = ?`
2. **Middleware de Autenticación**: Extrae `tenantId` del JWT y lo inyecta en `req.user`
3. **Validación en ORM**: Prisma garantiza que no se acceda a datos de otros tenants
4. **Índices Compuestos**: Todos los índices comienzan con `tenantId` para optimización

**Ejemplo de Query Segura:**
```typescript
// ✅ CORRECTO
const products = await prisma.product.findMany({
  where: { tenantId: req.user!.tenantId }
});

// ❌ INCORRECTO - Fuga de datos cross-tenant
const products = await prisma.product.findMany();
```

### 3.3. Integración con Cianbox ERP

```
┌────────────────────────────────────────────────────────────────┐
│                    FLUJO DE SINCRONIZACIÓN                     │
└────────────────────────────────────────────────────────────────┘

    Cianbox POS Backend              Cianbox ERP API
    ┌──────────────┐                 ┌──────────────┐
    │              │                 │              │
    │  1. Request  │───────────────▶ │  /auth/      │
    │  Token       │                 │  credentials │
    │              │                 │              │
    │              │◀─────────────── │  Access      │
    │  2. Store    │    JWT Token    │  Token       │
    │  Token       │    (8h TTL)     │              │
    │              │                 │              │
    │              │                 │              │
    │  3. Sync     │───────────────▶ │  /productos/ │
    │  Products    │  Bearer Token   │  lista       │
    │              │                 │  ?page=1     │
    │              │◀─────────────── │              │
    │  4. Paginate │    200 items    │              │
    │  (page 1-N)  │                 │              │
    │              │                 │              │
    │  5. Upsert   │                 │              │
    │  to Local DB │                 │              │
    │              │                 │              │
    │  6. Repeat   │───────────────▶ │  /productos/ │
    │  for:        │                 │  categorias  │
    │  • Categories│                 │  /marcas     │
    │  • Brands    │                 │  /sucursales │
    │  • Branches  │                 │  /clientes   │
    │  • Customers │                 │              │
    │              │                 │              │
    └──────────────┘                 └──────────────┘

ENDPOINTS CIANBOX DISPONIBLES:

POST   /auth/credentials              → Autenticación
GET    /productos/lista               → Productos (paginado)
GET    /productos/{id}                → Detalle de producto
GET    /productos/categorias          → Categorías
GET    /productos/marcas              → Marcas
GET    /productos/listas              → Listas de precios
GET    /sucursales                    → Sucursales
GET    /clientes                      → Clientes
GET    /pedidos/lista                 → Pedidos
POST   /pedidos/editar-estado         → Actualizar estado pedido
```

**Gestión de Token:**
- Token se cachea en tabla `CianboxConnection`
- Se renueva automáticamente 5 minutos antes de expirar
- Si API retorna 401, se re-autentica automáticamente

**Sincronización:**
- Modo manual: Botón "Sincronizar" en frontend
- Modo automático: Webhooks de Cianbox (futuro)
- Paginación: 50-200 registros por página (configurable)

## 4. Estructura del Proyecto

```
cianbox-pos/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD con GitHub Actions
│
├── apps/
│   ├── backend/                    # API REST (Express + Prisma)
│   │   ├── src/
│   │   │   ├── index.ts            # Entry point, Express server, Socket.io
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts         # JWT auth middleware (tenant + agency)
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts         # POST /login (tenant users)
│   │   │   │   ├── agency.ts       # Gestión tenants, DB servers, agency users
│   │   │   │   ├── products.ts     # CRUD productos
│   │   │   │   ├── sales.ts        # CRUD ventas
│   │   │   │   ├── promotions.ts   # CRUD promociones
│   │   │   │   └── cianbox.ts      # Sincronización Cianbox
│   │   │   ├── services/
│   │   │   │   ├── cianbox.service.ts    # Cliente API Cianbox
│   │   │   │   └── database.service.ts   # Sharding y multi-DB
│   │   │   └── utils/
│   │   │       └── errors.ts       # ApiError, ValidationError, etc.
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Modelo de datos (1116 líneas)
│   │   │   └── seed.ts             # Datos iniciales
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                   # POS para cajeros/operadores
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx       # Login por slug + email
│   │   │   │   ├── Dashboard.tsx   # Resumen de ventas
│   │   │   │   ├── POS.tsx         # Pantalla de venta principal
│   │   │   │   ├── Products.tsx    # Catálogo de productos
│   │   │   │   ├── Categories.tsx  # Gestión de categorías
│   │   │   │   ├── Users.tsx       # Gestión de usuarios
│   │   │   │   ├── Sales.tsx       # Historial de ventas
│   │   │   │   ├── Sync.tsx        # Sincronización Cianbox
│   │   │   │   └── Settings.tsx    # Configuración
│   │   │   ├── components/
│   │   │   │   └── Layout.tsx      # Layout con sidebar
│   │   │   ├── services/           # API clients
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   └── context/
│   │   │       └── authStore.ts    # Zustand auth store
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── agency/                     # Backoffice para super admins
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Login.tsx       # Login de agency user
│       │   │   ├── Dashboard.tsx   # Stats globales
│       │   │   ├── Tenants.tsx     # Lista de tenants
│       │   │   ├── TenantDetail.tsx # Detalle + Cianbox config
│       │   │   ├── DatabaseServers.tsx # Gestión servidores BD
│       │   │   └── AgencyUsers.tsx # Usuarios del backoffice
│       │   ├── components/
│       │   │   └── Layout.tsx      # Layout con sidebar
│       │   └── stores/
│       │       └── authStore.ts    # Zustand auth store (agency)
│       ├── package.json
│       └── vite.config.ts
│
├── deploy/
│   └── nginx-agency.conf           # Configuración Nginx para Agency
│
├── docs/
│   ├── ARQUITECTURA.md             # Este documento
│   ├── GUIA-TECNICA-POS-CIANBOX.md # Guía técnica de integración
│   └── README.md                   # Documentación general
│
├── CLAUDE.md                       # Instrucciones para Claude
└── package.json                    # Workspace root
```

## 5. Configuración e Instalación

### 5.1. Prerrequisitos

- **Node.js**: v18.0.0 o superior
- **PostgreSQL**: v15 o superior
- **npm**: v9 o superior
- **Git**: Para control de versiones
- **PM2**: Para producción (opcional)
- **Nginx**: Para proxy reverso en producción (opcional)

### 5.2. Instalación Desarrollo

#### Backend

```bash
# 1. Navegar a directorio backend
cd apps/backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con credenciales reales

# 4. Generar cliente Prisma
npm run prisma:generate

# 5. Ejecutar migraciones
npm run prisma:migrate

# 6. Seed inicial (opcional)
npm run db:seed

# 7. Iniciar servidor de desarrollo
npm run dev
# ➜ Backend corriendo en http://localhost:3001
```

#### Frontend POS

```bash
# 1. Navegar a directorio frontend
cd apps/frontend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
nano .env  # Ajustar VITE_API_URL

# 4. Iniciar servidor de desarrollo
npm run dev
# ➜ Frontend corriendo en http://localhost:5173
```

#### Agency Backoffice

```bash
# 1. Navegar a directorio agency
cd apps/agency

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (usa misma API que POS)
echo "VITE_API_URL=http://localhost:3001/api" > .env

# 4. Iniciar servidor de desarrollo
npm run dev
# ➜ Agency corriendo en http://localhost:5174
```

### 5.3. Instalación Producción

**Servidor de Aplicación: 172.16.1.61**
**Servidor de Base de Datos: 172.16.1.62**

#### Configurar PM2 para Backend

```bash
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Crear archivo de configuración
cat > /var/www/cianbox-pos/apps/backend/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cianbox-pos-api',
    cwd: '/var/www/cianbox-pos/apps/backend',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/cianbox-pos-error.log',
    out_file: '/var/log/pm2/cianbox-pos-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# 3. Iniciar aplicación
cd /var/www/cianbox-pos/apps/backend
npm run build
pm2 start ecosystem.config.cjs

# 4. Configurar inicio automático
pm2 startup
pm2 save
```

#### Configurar Nginx

```nginx
# /etc/nginx/sites-available/cianbox-pos

# POS Frontend (puerto 80)
server {
    listen 80;
    server_name 172.16.1.61;
    root /var/www/cianbox-pos/apps/frontend/dist;
    index index.html;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket para Socket.io
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Agency Backoffice (puerto 8083)
server {
    listen 8083;
    server_name 172.16.1.61;
    root /var/www/cianbox-pos/apps/agency/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar configuración
sudo ln -s /etc/nginx/sites-available/cianbox-pos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5.4. Variables de Entorno

#### Backend (.env)

```bash
# Base de Datos
DATABASE_URL="postgresql://usuario:password@172.16.1.62:5432/cianbox_pos?schema=public"

# JWT
JWT_SECRET="tu-secreto-super-seguro-cambiar-en-produccion"
JWT_EXPIRES_IN="7d"

# Servidor
NODE_ENV="production"
PORT=3001

# CORS (permitir frontend y agency)
CORS_ORIGINS="http://172.16.1.61,http://172.16.1.61:8083"

# Encriptación (para passwords de DatabaseServer)
ENCRYPTION_KEY="clave-encriptacion-32-caracteres-min"
```

#### Frontend POS (.env)

```bash
VITE_API_URL=/api
```

#### Agency (.env)

```bash
VITE_API_URL=/api
```

## 6. Componentes Principales

### 6.1. Backend

| Componente | Responsabilidad | Dependencias |
|------------|-----------------|--------------|
| **index.ts** | Entry point, Express server, Socket.io setup | express, socket.io, dotenv |
| **auth.ts** (middleware) | Validación JWT, inyección de `req.user`, doble autenticación (tenant vs agency) | jsonwebtoken, prisma |
| **auth.ts** (routes) | Login de usuarios tenant | bcryptjs, jwt, zod |
| **agency.ts** (routes) | CRUD de tenants, DB servers, agency users, dashboard | prisma, bcryptjs, jwt |
| **products.ts** | CRUD de productos con filtro por tenantId | prisma, zod |
| **sales.ts** | Creación de ventas, aplicación de promociones | prisma, socket.io |
| **promotions.ts** | CRUD de promociones y combos | prisma, zod |
| **cianbox.ts** | Endpoints de sincronización manual | CianboxService |
| **cianbox.service.ts** | Cliente API Cianbox, gestión de tokens, paginación | fetch, prisma |
| **database.service.ts** | Sharding multi-DB, encriptación de credenciales | prisma, crypto |
| **errors.ts** | Clases de error personalizadas (ApiError, ValidationError) | - |

### 6.2. Frontend POS

| Componente | Responsabilidad | Estado/Hooks |
|------------|-----------------|--------------|
| **Login.tsx** | Autenticación por slug + email/password | useAuthStore, axios |
| **Dashboard.tsx** | Resumen de ventas del día, gráficos | useEffect, axios |
| **POS.tsx** | Interfaz principal de venta, carrito, cobro | useState, useEffect, socket.io |
| **Products.tsx** | Catálogo de productos, búsqueda, filtros | useState, axios |
| **Categories.tsx** | Gestión de categorías con jerarquía | useState, axios |
| **Users.tsx** | CRUD de usuarios del tenant | useState, axios |
| **Sales.tsx** | Historial de ventas con filtros | useState, axios |
| **Sync.tsx** | Sincronización con Cianbox, logs de sync | useState, axios |
| **Settings.tsx** | Configuración del sistema | useState, axios |
| **Layout.tsx** | Sidebar con navegación, header | useLocation, useAuthStore |
| **authStore.ts** | Estado global de autenticación | Zustand |

### 6.3. Agency Backoffice

| Componente | Responsabilidad | Estado/Hooks |
|------------|-----------------|--------------|
| **Login.tsx** | Autenticación de agency users | useAuthStore, axios |
| **Dashboard.tsx** | Estadísticas globales (tenants activos, servidores, planes) | useEffect, axios |
| **Tenants.tsx** | Lista de tenants con filtros, crear nuevo tenant | useState, axios |
| **TenantDetail.tsx** | Detalle de tenant, configuración Cianbox, sincronización | useParams, axios |
| **DatabaseServers.tsx** | CRUD de servidores de BD, health checks | useState, axios |
| **AgencyUsers.tsx** | CRUD de usuarios del backoffice | useState, axios |
| **Layout.tsx** | Sidebar con navegación específica de agency | useLocation, useAuthStore |
| **authStore.ts** | Estado global de autenticación (agency) | Zustand |

## 7. API/Endpoints

### 7.1. Autenticación

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| POST | `/api/auth/login` | Login de usuario tenant | No | `{ slug, email, password }` |
| POST | `/api/agency/login` | Login de usuario agency | No | `{ email, password }` |
| GET | `/api/auth/me` | Obtener usuario actual | Tenant | - |
| POST | `/api/auth/refresh` | Renovar token | Tenant | - |

### 7.2. Productos

| Método | Ruta | Descripción | Auth | Query/Body |
|--------|------|-------------|------|------------|
| GET | `/api/products` | Listar productos | Tenant | `?search, ?categoryId, ?page, ?limit` |
| GET | `/api/products/:id` | Obtener producto | Tenant | - |
| POST | `/api/products` | Crear producto | Tenant | `{ name, sku, barcode, basePrice, ... }` |
| PUT | `/api/products/:id` | Actualizar producto | Tenant | `{ name?, basePrice?, ... }` |
| DELETE | `/api/products/:id` | Eliminar producto | Tenant | - |
| GET | `/api/products/:id/stock` | Obtener stock por sucursal | Tenant | - |

### 7.3. Ventas

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| GET | `/api/sales` | Listar ventas | Tenant | `?startDate, ?endDate, ?branchId` |
| GET | `/api/sales/:id` | Obtener venta | Tenant | - |
| POST | `/api/sales` | Crear venta | Tenant | `{ items[], customerId?, payments[] }` |
| PUT | `/api/sales/:id/cancel` | Anular venta | Tenant | `{ reason }` |
| GET | `/api/sales/stats` | Estadísticas de ventas | Tenant | `?period` |

### 7.4. Promociones

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| GET | `/api/promotions` | Listar promociones | Tenant | `?isActive, ?type` |
| GET | `/api/promotions/:id` | Obtener promoción | Tenant | - |
| POST | `/api/promotions` | Crear promoción | Tenant | `{ name, type, discountValue, ... }` |
| PUT | `/api/promotions/:id` | Actualizar promoción | Tenant | - |
| DELETE | `/api/promotions/:id` | Eliminar promoción | Tenant | - |
| GET | `/api/promotions/active` | Promociones activas | Tenant | - |

### 7.5. Cianbox Sync

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| POST | `/api/cianbox/sync/products` | Sincronizar productos | Tenant | - |
| POST | `/api/cianbox/sync/categories` | Sincronizar categorías | Tenant | - |
| POST | `/api/cianbox/sync/brands` | Sincronizar marcas | Tenant | - |
| POST | `/api/cianbox/sync/all` | Sincronización completa | Tenant | - |
| GET | `/api/cianbox/status` | Estado de sincronización | Tenant | - |

### 7.6. Agency

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| GET | `/api/agency/dashboard` | Dashboard global | Agency | - |
| GET | `/api/agency/tenants` | Listar tenants | Agency | - |
| POST | `/api/agency/tenants` | Crear tenant | Agency | `{ name, slug, adminEmail, adminPassword, ... }` |
| GET | `/api/agency/tenants/:id` | Detalle de tenant | Agency | - |
| PUT | `/api/agency/tenants/:id` | Actualizar tenant | Agency | - |
| DELETE | `/api/agency/tenants/:id` | Eliminar tenant | Agency | - |
| PUT | `/api/agency/tenants/:id/status` | Cambiar estado tenant | Agency | `{ status }` |
| GET | `/api/agency/database-servers` | Listar servidores BD | Agency | - |
| POST | `/api/agency/database-servers` | Crear servidor BD | Agency | `{ name, host, port, ... }` |
| POST | `/api/agency/database-servers/:id/test` | Probar conexión | Agency | - |
| POST | `/api/agency/tenants/:id/migrate` | Migrar tenant a otro servidor | Agency | `{ targetServerId }` |

## 8. Modelos de Datos

### 8.1. Entidades Nivel Agencia (sin tenantId)

```
AgencyUser
├── id (cuid)
├── email (unique)
├── passwordHash
├── name
├── status (ACTIVE | DISABLED)
└── timestamps

DatabaseServer (para sharding)
├── id (cuid)
├── name
├── host
├── port
├── database
├── username
├── password (encrypted)
├── sslEnabled
├── maxConnections
├── isDefault
├── isActive
├── region
├── healthStatus (HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN)
├── tenantCount
├── lastHealthCheck
└── timestamps

Tenant
├── id (cuid)
├── name
├── slug (unique)
├── taxId
├── plan (FREE | PRO | ENTERPRISE)
├── status (TRIAL | ACTIVE | SUSPENDED | CANCELLED)
├── databaseServerId (FK a DatabaseServer)
└── timestamps
```

### 8.2. Entidades Nivel Tenant (con tenantId obligatorio)

```
User
├── id (cuid)
├── tenantId (FK + filtro obligatorio)
├── email
├── passwordHash
├── name
├── pin (para acceso rápido POS)
├── status (ACTIVE | INVITED | DISABLED)
├── roleId (FK)
├── branchId (FK opcional)
└── timestamps

Role
├── id (cuid)
├── tenantId
├── name ("Administrador", "Cajero")
├── permissions[] (array de strings)
├── isSystem (rol del sistema, no borrable)
└── timestamps

CianboxConnection (uno por tenant)
├── id (cuid)
├── tenantId (unique)
├── cuenta (nombre de cuenta Cianbox)
├── appName, appCode, user, password (encrypted)
├── accessToken (cacheado)
├── tokenExpiresAt
├── syncPageSize
├── lastSync
├── syncStatus
└── timestamps

Product
├── id (cuid)
├── tenantId
├── cianboxProductId (nullable, para productos locales)
├── sku, barcode
├── name, shortName, description
├── categoryId (FK), brandId (FK)
├── basePrice, baseCost, taxRate
├── trackStock, allowNegativeStock
├── isActive, isService
├── lastSyncedAt
└── timestamps

Category (jerarquía)
├── id (cuid)
├── tenantId
├── cianboxCategoryId
├── name, code
├── parentId (FK self-reference)
├── level (0 = raíz)
└── timestamps

Sale
├── id (cuid)
├── tenantId
├── branchId, pointOfSaleId, userId
├── customerId (opcional)
├── saleNumber (único por tenant)
├── receiptType (TICKET | INVOICE_A | INVOICE_B | ...)
├── subtotal, discount, tax, total
├── status (PENDING | COMPLETED | CANCELLED | REFUNDED)
├── saleDate
└── timestamps

SaleItem
├── id (cuid)
├── saleId
├── productId (nullable si es combo)
├── comboId (nullable)
├── quantity, unitPrice, discount, subtotal
├── promotionId (FK opcional)
├── taxRate, taxAmount
└── createdAt

Promotion
├── id (cuid)
├── tenantId
├── code (para cupones)
├── name, description
├── type (PERCENTAGE | BUY_X_GET_Y | SECOND_UNIT_DISCOUNT | FLASH_SALE | ...)
├── discountType, discountValue
├── buyQuantity, getQuantity
├── startDate, endDate, daysOfWeek, startTime, endTime
├── maxUses, currentUses
├── isActive, priority, stackable
└── timestamps
```

### 8.3. Relaciones Principales

```
Tenant 1───N User
Tenant 1───N Role
Tenant 1───1 CianboxConnection
Tenant 1───N Product
Tenant 1───N Sale
Tenant 1───N Promotion
Tenant N───1 DatabaseServer (opcional)

User N───1 Role
User 1───N Sale
User 1───N CashRegister

Product N───1 Category
Product N───1 Brand
Product 1───N ProductPrice (por PriceList)
Product 1───N ProductStock (por Branch)
Product 1───N SaleItem

Sale 1───N SaleItem
Sale 1───N Payment
Sale N───1 Customer (opcional)

Promotion N───N Product (via PromotionProduct)
SaleItem N───1 Promotion (opcional)
```

## 9. Servicios e Integraciones

### 9.1. Cianbox API REST

**Base URL:** `https://{cuenta}.cianbox.org/api/v2`

**Autenticación:**
- Método: POST `/auth/credentials`
- Credenciales: `appName`, `appCode`, `user`, `password`
- Retorna: JWT token con expiración (8h típicamente)
- Renovación: Automática 5 minutos antes de expirar

**Endpoints Integrados:**

| Endpoint | Método | Propósito | Paginación |
|----------|--------|-----------|------------|
| `/auth/credentials` | POST | Obtener token de acceso | - |
| `/productos/lista` | GET | Listar productos | Sí (50-200/página) |
| `/productos/{id}` | GET | Detalle de producto | - |
| `/productos/categorias` | GET | Listar categorías | Sí |
| `/productos/marcas` | GET | Listar marcas | Sí |
| `/productos/listas` | GET | Listas de precios | Sí |
| `/sucursales` | GET | Sucursales | Sí |
| `/clientes` | GET | Clientes | Sí |

**Estrategia de Sincronización:**
1. Se autentica con Cianbox
2. Descarga datos paginados (50 registros por página por defecto)
3. Upsert en base de datos local usando `cianboxProductId` como clave
4. Marca `lastSyncedAt` para tracking
5. Guarda JSON raw en `cianboxData` para referencia

### 9.2. Socket.io (Tiempo Real)

**Eventos Cliente → Servidor:**

| Evento | Payload | Propósito |
|--------|---------|-----------|
| `join:tenant` | `{ tenantId }` | Unirse a sala del tenant |
| `join:pos` | `{ posId }` | Unirse a sala del punto de venta |
| `sale:created` | `{ tenantId, sale }` | Notificar nueva venta |
| `stock:updated` | `{ tenantId, product }` | Notificar cambio de stock |

**Eventos Servidor → Cliente:**

| Evento | Payload | Propósito |
|--------|---------|-----------|
| `sale:new` | `{ sale }` | Nueva venta creada |
| `stock:change` | `{ product }` | Stock actualizado |
| `promotion:activated` | `{ promotion }` | Promoción activada |
| `sync:completed` | `{ stats }` | Sincronización completada |

**Uso en Frontend:**

```typescript
// Conectar al servidor
const socket = io('http://172.16.1.61:3001');

// Unirse a sala del tenant
socket.emit('join:tenant', currentTenant.id);

// Escuchar nueva venta
socket.on('sale:new', (sale) => {
  console.log('Nueva venta:', sale);
  refreshDashboard();
});
```

### 9.3. PM2 (Gestor de Procesos)

**Configuración:**
```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'cianbox-pos-api',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

**Comandos útiles:**
```bash
pm2 start ecosystem.config.cjs  # Iniciar
pm2 restart cianbox-pos-api     # Reiniciar
pm2 logs cianbox-pos-api        # Ver logs
pm2 monit                       # Monitor en tiempo real
pm2 status                      # Estado de procesos
```

## 10. Sistema de Promociones

### 10.1. Tipos de Promociones Soportadas

| Tipo | Descripción | Configuración | Ejemplo |
|------|-------------|---------------|---------|
| **PERCENTAGE** | Descuento porcentual | `discountValue: 15` | 15% off en todo |
| **FIXED_AMOUNT** | Descuento monto fijo | `discountValue: 500` | $500 de descuento |
| **BUY_X_GET_Y** | Compra X lleva Y | `buyQuantity: 2, getQuantity: 3` | 2x1, 3x2 |
| **SECOND_UNIT_DISCOUNT** | 2da unidad con descuento | `discountValue: 50` | 2da unidad al 50% |
| **BUNDLE_PRICE** | Precio especial combo | `discountType: FIXED_PRICE, discountValue: 1000` | Combo a $1000 |
| **FLASH_SALE** | Venta flash (fecha límite) | `startDate, endDate, maxUses` | BlackFriday |
| **COUPON** | Cupón con código | `code: "CYBER2024"` | Cupón descuento |

### 10.2. Reglas de Aplicación

```
Prioridad de Aplicación:
1. priority (mayor valor se aplica primero)
2. Si stackable=false, solo se aplica la mejor promoción
3. Si stackable=true, se aplican todas las promociones compatibles

Validaciones:
✓ Promoción activa (isActive = true)
✓ Fecha vigente (startDate <= now <= endDate)
✓ Día de semana válido (si daysOfWeek configurado)
✓ Horario válido (si startTime/endTime configurado)
✓ No excede maxUses
✓ Producto aplica (por SPECIFIC_PRODUCTS, CATEGORIES o BRANDS)
✓ Cumple minPurchase (si configurado)

Cálculo de Descuento:
1. Subtotal = unitPrice × quantity
2. Descuento según tipo de promoción
3. Si discountType=PERCENTAGE: descuento = subtotal × (discountValue / 100)
4. Si discountType=FIXED_AMOUNT: descuento = discountValue
5. Si tiene maxDiscount: descuento = min(descuento, maxDiscount)
6. Precio final = subtotal - descuento
```

### 10.3. Ejemplo: BlackFriday Flash Sale

```json
{
  "name": "BlackFriday 2024",
  "type": "FLASH_SALE",
  "discountType": "PERCENTAGE",
  "discountValue": 30,
  "startDate": "2024-11-29T00:00:00Z",
  "endDate": "2024-11-29T23:59:59Z",
  "maxUses": 100,
  "applyTo": "CATEGORIES",
  "categoryIds": ["cat-electronics"],
  "isActive": true,
  "priority": 100,
  "stackable": false,
  "metadata": {
    "event": "BlackFriday",
    "banner": "https://..."
  }
}
```

## 11. CI/CD Pipeline

### 11.1. GitHub Actions Workflow

**Archivo:** `.github/workflows/deploy.yml`

**Trigger:**
- Push a rama `main`
- Workflow manual (`workflow_dispatch`)

**Jobs:**

```
┌──────────────────────────────────────────────────────┐
│  Job 1: deploy-backend                              │
├──────────────────────────────────────────────────────┤
│  1. Checkout code                                    │
│  2. Setup Node.js v20                                │
│  3. Install dependencies (npm ci)                    │
│  4. Generate Prisma Client                           │
│  5. Build TypeScript (npm run build)                 │
│  6. Rsync to /var/www/cianbox-pos/apps/backend       │
│  7. Install production dependencies                  │
│  8. Run migrations (prisma db push)                  │
│  9. Restart PM2 (cianbox-pos-api)                    │
│  10. Health check (curl /health)                     │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  Job 2: deploy-frontend                             │
├──────────────────────────────────────────────────────┤
│  needs: deploy-backend                               │
│  1. Checkout code                                    │
│  2. Setup Node.js v20                                │
│  3. Install dependencies (npm ci)                    │
│  4. Build (VITE_API_URL=/api)                        │
│  5. Rsync dist/ to /var/www/.../frontend/dist       │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  Job 3: deploy-agency                               │
├──────────────────────────────────────────────────────┤
│  needs: deploy-backend                               │
│  1. Checkout code                                    │
│  2. Setup Node.js v20                                │
│  3. Install dependencies (npm ci)                    │
│  4. Build (VITE_API_URL=/api)                        │
│  5. Rsync dist/ to /var/www/.../agency/dist         │
│  6. Configure nginx (if not exists)                  │
│  7. Reload nginx                                     │
└──────────────────────────────────────────────────────┘
```

**Self-hosted Runner:**
- Configurado en servidor 172.16.1.61
- Ejecuta con permisos sudo para rsync y PM2
- Logs en `/var/log/github-runner/`

**Rollback Manual:**
```bash
# Ver commits recientes
git log --oneline

# Hacer rollback a commit anterior
git checkout <commit-hash>
cd apps/backend && npm run build
pm2 restart cianbox-pos-api
```

## 12. Seguridad

### 12.1. Autenticación

**JWT Tokens:**
- Algoritmo: HS256 (HMAC-SHA256)
- Expiración: 7 días (configurable)
- Payload: `{ userId, tenantId, email, roleId }`
- Secret: Variable de entorno `JWT_SECRET`

**Doble Autenticación:**
```typescript
// Usuario Tenant
{
  userId: "user-123",
  tenantId: "tenant-abc",
  email: "cajero@cliente.com",
  roleId: "role-xyz"
}

// Usuario Agency
{
  agencyUserId: "agency-456",
  email: "admin@agency.com",
  isAgencyUser: true
}
```

### 12.2. Hashing de Contraseñas

- Algoritmo: bcrypt con 10 rounds de salt
- Validación: Comparación con bcrypt.compare()
- No se almacenan contraseñas en texto plano

### 12.3. Protección CORS

```typescript
// Configuración CORS
cors({
  origin: ['http://172.16.1.61', 'http://172.16.1.61:8083'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
})
```

### 12.4. Headers de Seguridad (Helmet)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)

### 12.5. Encriptación de Credenciales

**DatabaseServer passwords:**
- Algoritmo: AES-256-CBC
- Key derivation: scrypt
- IV: 16 bytes aleatorios
- Formato almacenado: `{iv}:{encrypted}`

**Cianbox passwords:**
- Se almacenan en texto plano en `CianboxConnection.password`
- TODO: Implementar encriptación similar a DatabaseServer

### 12.6. Aislamiento Multi-Tenant

**Reglas obligatorias:**
1. Todas las queries incluyen `WHERE tenantId = ?`
2. Middleware auth inyecta `tenantId` en `req.user`
3. Índices compuestos comienzan con `tenantId`
4. Validación en capa de servicio

**Ejemplo de Query Segura:**
```typescript
// Middleware auth extrae tenantId del JWT
const tenantId = req.user!.tenantId;

// Query con filtro obligatorio
const products = await prisma.product.findMany({
  where: { tenantId }  // ✅ OBLIGATORIO
});
```

## 13. Monitoreo y Logs

### 13.1. Logs de Backend

**PM2 Logs:**
```bash
# Ver logs en tiempo real
pm2 logs cianbox-pos-api

# Logs almacenados en:
/var/log/pm2/cianbox-pos-out.log   # stdout
/var/log/pm2/cianbox-pos-error.log # stderr
```

**Formato de Logs:**
```
[2024-01-15 10:30:45] GET /api/products?tenantId=abc
[2024-01-15 10:30:46] POST /api/sales - 201 Created
[2024-01-15 10:30:47] ERROR: Sale creation failed - Stock insufficient
```

### 13.2. Health Checks

**Endpoint:** `GET /health`
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "version": "1.0.0"
}
```

**Database Servers Health Check:**
```bash
# Ejecutar health check de todos los servidores
curl -X POST http://172.16.1.61:3001/api/agency/database-servers/health-check \
  -H "Authorization: Bearer <agency-token>"
```

### 13.3. Auditoría

**Tabla AuditLog:**
- Registra todas las operaciones CRUD
- Almacena estado anterior y nuevo (JSON)
- Incluye IP, User-Agent, timestamp
- Filtrable por tenant, usuario, entidad

**Ejemplo de log de auditoría:**
```json
{
  "tenantId": "tenant-abc",
  "userId": "user-123",
  "action": "UPDATE",
  "entity": "Product",
  "entityId": "prod-456",
  "oldData": { "basePrice": 100 },
  "newData": { "basePrice": 120 },
  "ipAddress": "192.168.1.50",
  "createdAt": "2024-01-15T10:30:45Z"
}
```

## 14. Optimizaciones y Performance

### 14.1. Índices de Base de Datos

**Índices críticos en Product:**
```sql
CREATE INDEX idx_product_tenant_sku ON products(tenantId, sku);
CREATE INDEX idx_product_tenant_barcode ON products(tenantId, barcode);
CREATE INDEX idx_product_tenant_category ON products(tenantId, categoryId);
CREATE INDEX idx_product_tenant_name ON products(tenantId, name);
```

**Índices en Sale:**
```sql
CREATE INDEX idx_sale_tenant_date ON sales(tenantId, saleDate);
CREATE INDEX idx_sale_tenant_branch_date ON sales(tenantId, branchId, saleDate);
CREATE INDEX idx_sale_tenant_customer ON sales(tenantId, customerId);
```

### 14.2. Caché de Tokens

**Cianbox Token Caching:**
- Token se almacena en `CianboxConnection.accessToken`
- Se renueva automáticamente 5 minutos antes de expirar
- Evita re-autenticación en cada request

### 14.3. Paginación

**Backend:**
```typescript
// Query con paginación
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 50;
const skip = (page - 1) * limit;

const products = await prisma.product.findMany({
  where: { tenantId },
  skip,
  take: limit,
  orderBy: { name: 'asc' }
});
```

**Frontend:**
```typescript
// Infinite scroll o paginación por botones
const [page, setPage] = useState(1);
const loadMore = () => setPage(prev => prev + 1);
```

### 14.4. Connection Pooling

**Prisma Connection Pool:**
- Default: 10 conexiones por tenant
- Configurable en `DATABASE_URL`: `?connection_limit=20`

**DatabaseServer maxConnections:**
- Default: 100 conexiones máximas
- Configurable por servidor

## 15. Roadmap y Mejoras Futuras

### 15.1. Corto Plazo (1-3 meses)

- [ ] Implementar webhooks de Cianbox para sincronización automática
- [ ] Encriptar contraseñas de CianboxConnection
- [ ] Dashboard de métricas en tiempo real (Socket.io)
- [ ] Reportes de ventas exportables (PDF/Excel)
- [ ] Sistema de notificaciones push

### 15.2. Mediano Plazo (3-6 meses)

- [ ] Sharding real de base de datos (activar DatabaseServer)
- [ ] Impresión de tickets (integración con impresoras térmicas)
- [ ] App móvil para cajeros (React Native)
- [ ] Sistema de fidelidad de clientes
- [ ] Integración con Mercado Pago / Stripe

### 15.3. Largo Plazo (6-12 meses)

- [ ] BI y analytics avanzados
- [ ] Machine learning para predicción de ventas
- [ ] Soporte multi-idioma (i18n)
- [ ] Sistema de backup automático
- [ ] Modo offline con sincronización diferida

## 16. Glosario Técnico

| Término | Definición |
|---------|------------|
| **Tenant** | Cliente o empresa que usa el sistema. Cada tenant tiene sus propios datos aislados |
| **Multi-tenancy** | Arquitectura donde múltiples clientes comparten la misma infraestructura pero con datos separados |
| **Sharding** | Técnica de particionar una base de datos en múltiples servidores para escalar horizontalmente |
| **JWT** | JSON Web Token, estándar para tokens de autenticación sin estado |
| **ORM** | Object-Relational Mapping, mapea objetos de código a tablas de base de datos |
| **Socket.io** | Biblioteca para comunicación bidireccional en tiempo real vía WebSockets |
| **PM2** | Gestor de procesos Node.js para producción con clustering y monitoring |
| **Nginx** | Servidor web y proxy reverso de alto rendimiento |
| **CI/CD** | Continuous Integration/Continuous Deployment, automatización de testing y deploy |
| **Prisma** | ORM moderno para Node.js con generación de tipos TypeScript |
| **Zustand** | Biblioteca de gestión de estado ligera para React |
| **Zod** | Biblioteca de validación de esquemas TypeScript-first |

## 17. Contacto y Soporte

**Accesos de Prueba:**

- **Agency Backoffice:**
  - URL: `http://172.16.1.61:8083`
  - Usuario: `admin@cianboxpos.com`
  - Contraseña: `Admin123!`

- **Tenant Demo:**
  - URL: `http://172.16.1.61`
  - Slug: `demo`
  - Usuario: `admin@demo.com`
  - Contraseña: `Demo2024!`

**Servidores:**
- Aplicación: `172.16.1.61`
- Base de Datos: `172.16.1.62`

**Documentación adicional:**
- Guía Técnica de Integración: `docs/GUIA-TECNICA-POS-CIANBOX.md`
- Repositorio: GitHub (privado)
- Wiki: Por implementar

---

**Versión:** 1.0.0
**Última actualización:** 2024-01-15
**Autor:** Equipo de Desarrollo Cianbox POS
