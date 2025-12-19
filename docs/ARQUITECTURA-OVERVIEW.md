# Arquitectura - Resumen General y Stack Tecnológico

## 1. Resumen del Proyecto

Sistema POS (Point of Sale) multi-tenant con arquitectura de tres capas que integra múltiples clientes empresariales con sus respectivas instancias de Cianbox ERP. Permite gestión centralizada desde un backoffice de agencia mientras cada tenant opera de forma independiente y aislada.

**Características principales:**
- Multi-tenancy con aislamiento completo de datos
- Integración bidireccional con Cianbox ERP mediante API REST
- Arquitectura escalable preparada para sharding de base de datos
- Sistema de promociones inteligente (2x1, descuentos por volumen, flash sales)
- Comunicación en tiempo real mediante WebSockets
- CI/CD automatizado con GitHub Actions
- Integración con Mercado Pago (Point y QR)
- Sistema de caja con arqueos y relevos de turno

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
│  │  • Caja            │              │  • Dashboard Global  │  │
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
│                    │  • /api/cash    │                         │
│                    │  • /api/cianbox │                         │
│                    │  • /api/promotions                        │
│                    │  • /api/mercadopago                       │
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
│   │   │   │   ├── cash.ts         # Gestión de caja (turnos, arqueos)
│   │   │   │   ├── promotions.ts   # CRUD promociones
│   │   │   │   ├── mercadopago.ts  # Integración Mercado Pago
│   │   │   │   └── cianbox.ts      # Sincronización Cianbox
│   │   │   ├── services/
│   │   │   │   ├── cianbox.service.ts       # Cliente API Cianbox
│   │   │   │   ├── mercadopago.service.ts   # Cliente API Mercado Pago
│   │   │   │   └── database.service.ts      # Sharding y multi-DB
│   │   │   └── utils/
│   │   │       └── errors.ts       # ApiError, ValidationError, etc.
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Modelo de datos
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
│   │   │   │   └── ...
│   │   │   ├── components/
│   │   │   │   ├── MPPointPaymentModal.tsx   # Pago con Point
│   │   │   │   ├── MPQRPaymentModal.tsx      # Pago con QR
│   │   │   │   └── Layout.tsx                # Layout con sidebar
│   │   │   ├── services/           # API clients
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   └── context/
│   │   │       └── authStore.ts    # Zustand auth store
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── agency/                     # Backoffice para super admins
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx       # Login de agency user
│   │   │   │   ├── Dashboard.tsx   # Stats globales
│   │   │   │   ├── Tenants.tsx     # Lista de tenants
│   │   │   │   └── ...
│   │   │   └── stores/
│   │   │       └── authStore.ts    # Zustand auth store (agency)
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── backoffice/                 # Backoffice para administradores de tenant
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Products.tsx    # Gestión de catálogo
│       │   │   ├── Categories.tsx  # Gestión de categorías
│       │   │   └── ...
│       │   └── stores/
│       │       └── authStore.ts    # Zustand auth store (tenant)
│       ├── package.json
│       └── vite.config.ts
│
├── deploy/
│   └── nginx-agency.conf           # Configuración Nginx
│
├── docs/
│   ├── ARQUITECTURA-OVERVIEW.md         # Este documento
│   ├── ARQUITECTURA-MULTITENANCY.md     # Sistema multi-tenant
│   ├── ARQUITECTURA-INTEGRACIONES.md    # Cianbox, Socket.io, PM2
│   ├── ARQUITECTURA-SEGURIDAD.md        # Auth, JWT, CORS
│   ├── ARQUITECTURA-CICD.md             # GitHub Actions, deploy
│   ├── API-AUTH.md                      # Endpoints de autenticación
│   ├── API-PRODUCTS.md                  # Endpoints de productos
│   ├── API-SALES.md                     # Endpoints de ventas
│   ├── API-CASH.md                      # Endpoints de caja
│   ├── API-MERCADOPAGO.md               # Endpoints de Mercado Pago
│   ├── PROMOCIONES-FLUJO.md             # Sistema de promociones
│   ├── USUARIOS_FRONTENDS.md            # Credenciales de acceso
│   └── README.md                        # Índice de documentación
│
├── CLAUDE.md                       # Instrucciones para Claude
└── package.json                    # Workspace root
```

## 5. URLs Públicas

| Servicio | URL | Descripción |
|----------|-----|-------------|
| POS | https://cianbox-pos-point.ews-cdn.link | Punto de venta para cajeros |
| Agency Backoffice | https://cianbox-pos-agency.ews-cdn.link | Administración multi-tenant |
| Client Backoffice | https://cianbox-pos-backoffice.ews-cdn.link | Administración de catálogo |
| Backend API | https://cianbox-pos-api.ews-cdn.link | API REST |

## 6. URLs Internas (Red Local)

| Servicio | URL | Puerto |
|----------|-----|--------|
| POS | http://172.16.1.61 | 80 |
| Agency Backoffice | http://172.16.1.61:8083 | 8083 |
| Client Backoffice | http://172.16.1.61:8084 | 8084 |
| Backend API | http://172.16.1.61:3001 | 3001 |
| PostgreSQL | 172.16.1.62:5432 | 5432 |

## 7. Componentes Principales

### Backend

| Componente | Responsabilidad | Dependencias |
|------------|-----------------|--------------|
| **index.ts** | Entry point, Express server, Socket.io setup | express, socket.io, dotenv |
| **auth.ts** (middleware) | Validación JWT, inyección de `req.user`, doble autenticación | jsonwebtoken, prisma |
| **auth.ts** (routes) | Login de usuarios tenant | bcryptjs, jwt, zod |
| **agency.ts** | CRUD de tenants, DB servers, agency users | prisma, bcryptjs, jwt |
| **products.ts** | CRUD de productos con filtro por tenantId | prisma, zod |
| **sales.ts** | Creación de ventas, aplicación de promociones | prisma, socket.io |
| **cash.ts** | Gestión de turnos de caja, arqueos, movimientos | prisma, zod |
| **promotions.ts** | CRUD de promociones y combos | prisma, zod |
| **mercadopago.ts** | Integración con Point y QR | mercadoPagoService |
| **cianbox.ts** | Endpoints de sincronización manual | CianboxService |
| **cianbox.service.ts** | Cliente API Cianbox, gestión de tokens | fetch, prisma |
| **mercadopago.service.ts** | Cliente API MP, OAuth, órdenes | fetch, prisma |
| **errors.ts** | Clases de error personalizadas | - |

### Frontend POS

| Componente | Responsabilidad | Estado/Hooks |
|------------|-----------------|--------------|
| **Login.tsx** | Autenticación por slug + email/password | useAuthStore, axios |
| **POS.tsx** | Interfaz principal de venta, carrito, cobro | useState, useEffect, socket.io |
| **MPPointPaymentModal.tsx** | Modal de pago con terminal Point | useState, polling |
| **MPQRPaymentModal.tsx** | Modal de pago con código QR | useState, polling |
| **Products.tsx** | Catálogo de productos | useState, axios |
| **Sales.tsx** | Historial de ventas con filtros | useState, axios |
| **authStore.ts** | Estado global de autenticación | Zustand |

## 8. Glosario Técnico

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
| **OAuth 2.0** | Protocolo de autorización para acceso delegado (usado por Mercado Pago) |
| **Polling** | Técnica de consulta periódica para verificar el estado de una operación asíncrona |

---

**Ver también:**
- [Multi-tenancy y Sharding](./ARQUITECTURA-MULTITENANCY.md)
- [Integraciones](./ARQUITECTURA-INTEGRACIONES.md)
- [Seguridad](./ARQUITECTURA-SEGURIDAD.md)
- [CI/CD](./ARQUITECTURA-CICD.md)
- [API Endpoints](./README.md#api-documentation)
