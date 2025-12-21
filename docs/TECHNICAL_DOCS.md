# Documentación Técnica - Cianbox POS

## 1. Resumen del Proyecto

Cianbox POS es un sistema de punto de venta (Point of Sale) multi-tenant construido con arquitectura cliente-servidor. Permite gestionar ventas, inventario, promociones y sincronización con el ERP Cianbox. Soporta múltiples sucursales, puntos de venta, listas de precios y control de stock por ubicación.

## 2. Stack Tecnológico

| Categoría | Tecnología | Versión |
|-----------|------------|----------|
| **Backend** | Node.js | 18+ |
| Backend | Express | 4.21.1 |
| Backend | TypeScript | 5.6.3 |
| Backend | Prisma ORM | 5.22.0 |
| Base de Datos | PostgreSQL | 15+ |
| Autenticación | JWT (jsonwebtoken) | 9.0.2 |
| Validación | Zod | 3.23.8 |
| Hashing | bcryptjs | 2.4.3 |
| Tiempo Real | Socket.io | 4.8.1 |
| Tareas | node-cron | 4.2.1 |
| **Frontend** | React | 18.3.1 |
| Frontend | TypeScript | 5.6.3 |
| Build Tool | Vite | 5.4.11 |
| Routing | React Router | 6.28.0 |
| Estado | Zustand | 5.0.1 |
| Estilos | TailwindCSS | 3.4.15 |
| Iconos | Lucide React | 0.460.0 |
| HTTP Client | Axios | 1.7.7 |

## 3. Arquitectura

### 3.1 Patrón Arquitectónico

**Arquitectura Multi-tenant con aislamiento a nivel de fila (Row-Level Security)**

- Cada tenant (empresa) comparte la misma instancia de base de datos
- Aislamiento de datos mediante campo `tenantId` en todas las entidades
- Middleware de autenticación que inyecta `tenantId` en todas las queries
- Soporte para sharding mediante modelo `DatabaseServer` (futuro)

### 3.2 Diagrama de Comunicación

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Cliente   │────────>│   Backend   │────────>│ PostgreSQL  │
│  (React)    │  HTTP   │  (Express)  │  Prisma │             │
└─────────────┘  JWT    └─────────────┘         └─────────────┘
       │                       │
       │                       │
       │                       v
       │              ┌─────────────┐
       │              │   Cianbox   │
       └──────────────│   ERP API   │
          Socket.io   └─────────────┘
          (Sync)
```

### 3.3 Flujo de Autenticación

1. Usuario envía credenciales (email, password, tenantSlug)
2. Backend valida tenant activo
3. Backend verifica usuario y password
4. Backend genera tokens JWT (access + refresh)
5. Frontend almacena tokens en Zustand
6. Cada request incluye token en header `Authorization: Bearer <token>`
7. Middleware `authenticate` valida token y extrae `tenantId`

### 3.4 Flujo de Venta POS

1. Cajero busca productos (por barcode, SKU o nombre)
2. Agrega productos al carrito con cantidades
3. Sistema calcula promociones automáticamente
4. Cajero selecciona métodos de pago
5. Sistema crea venta con items y pagos
6. Sistema actualiza stock en sucursal
7. Sistema genera número de venta secuencial
8. (Opcional) Imprime ticket/factura

## 4. Estructura del Proyecto

```
cianbox-pos/
├── apps/
│   ├── backend/                # Servidor API
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point, configuración Express
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts     # JWT authentication & authorization
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts     # Login, logout, /me, refresh token
│   │   │   │   ├── products.ts # CRUD productos, búsqueda POS
│   │   │   │   ├── sales.ts    # Ventas, anulación, reportes
│   │   │   │   ├── cianbox.ts  # Sincronización con Cianbox
│   │   │   │   └── promotions.ts # Gestión de promociones
│   │   │   ├── services/
│   │   │   │   ├── cianbox.service.ts # Cliente API Cianbox
│   │   │   │   └── database.service.ts # Servicios de BD
│   │   │   └── utils/
│   │   │       └── errors.ts   # Manejo centralizado de errores
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Modelo de datos (116 tablas)
│   │   │   └── seed.ts         # Datos de prueba
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/               # Cliente React
│       ├── src/
│       │   ├── pages/          # Páginas (Login, POS, etc)
│       │   │   └── Login.tsx
│       │   ├── components/     # Componentes reutilizables
│       │   ├── services/
│       │   │   └── api.ts      # Cliente HTTP (Axios)
│       │   ├── context/
│       │   │   └── authStore.ts # Estado global auth (Zustand)
│       │   ├── hooks/          # Custom hooks
│       │   └── main.tsx        # Entry point
│       ├── package.json
│       └── vite.config.ts
├── docs/                       # Documentación
│   ├── GUIA-TECNICA-POS-CIANBOX.md # Guía completa
│   ├── DATABASE.md
│   └── SSE-SINCRONIZACION-STREAMS.md
├── codigo-referencia/          # Código de referencia de otros proyectos
└── CLAUDE.md                   # Instrucciones para Claude
```

## 5. Configuración e Instalación

### 5.1 Prerrequisitos

- Node.js 18+
- PostgreSQL 15+
- npm o yarn
- Git

### 5.2 Pasos de Instalación

#### Backend

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd cianbox-pos/apps/backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu configuración

# 4. Configurar base de datos
npx prisma generate
npx prisma migrate dev

# 5. Seed datos de prueba (opcional)
npm run db:seed

# 6. Iniciar servidor
npm run dev  # Desarrollo (puerto 3000)
```

#### Frontend

```bash
# 1. Navegar a frontend
cd ../frontend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar VITE_API_URL

# 4. Iniciar aplicación
npm run dev  # Desarrollo (puerto 5173)
```

### 5.3 Variables de Entorno

#### Backend (.env)

| Variable | Descripción | Ejemplo |
|----------|-------------|----------|
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgresql://user:pass@localhost:5432/cianbox_pos` |
| `JWT_SECRET` | Secret para firmar tokens JWT | `tu-secret-muy-seguro-aqui-2024` |
| `JWT_EXPIRES_IN` | Duración del access token | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | Duración del refresh token | `30d` |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` / `production` |
| `CORS_ORIGIN` | Origen permitido CORS | `http://localhost:5173` |

#### Frontend (.env)

| Variable | Descripción | Ejemplo |
|----------|-------------|----------|
| `VITE_API_URL` | URL del backend | `http://localhost:3000/api` |

## 6. Componentes Principales

| Componente | Función | Dependencias Clave |
|------------|---------|-------------------|
| `auth.ts` (middleware) | Valida JWT, extrae tenantId y permisos | jsonwebtoken |
| `auth.ts` (routes) | Login, logout, refresh token, cambio password | bcryptjs, Prisma |
| `products.ts` | CRUD productos, búsqueda rápida POS | Prisma |
| `sales.ts` | Crear ventas, anular, reportes diarios | Prisma (transacciones) |
| `cianbox.service.ts` | Cliente API Cianbox, sincronización | fetch, cache |
| `authStore.ts` | Estado global de autenticación | Zustand |
| `Login.tsx` | Página de inicio de sesión | React, axios |

## 7. API/Endpoints

### 7.1 Autenticación

| Método | Ruta | Descripción | Auth | Body |
|--------|------|-------------|------|------|
| POST | `/api/auth/login` | Iniciar sesión | No | `{email, password, tenantSlug}` |
| POST | `/api/auth/login/pin` | Login con PIN (POS) | No | `{pin, tenantSlug}` |
| POST | `/api/auth/refresh` | Renovar token | No | `{refreshToken}` |
| POST | `/api/auth/logout` | Cerrar sesión | Sí | `{sessionId?}` |
| GET | `/api/auth/me` | Usuario actual | Sí | - |
| PUT | `/api/auth/password` | Cambiar contraseña | Sí | `{currentPassword, newPassword}` |

### 7.2 Productos

| Método | Ruta | Descripción | Auth | Permisos |
|--------|------|-------------|------|----------|
| GET | `/api/products` | Listar productos | Sí | - |
| GET | `/api/products/search?q=` | Búsqueda rápida POS (soporta productos padre) | Sí | - |
| GET | `/api/products/:id` | Detalle producto | Sí | - |
| POST | `/api/products` | Crear producto | Sí | `inventory:edit` |
| PUT | `/api/products/:id` | Actualizar producto | Sí | `inventory:edit` |
| DELETE | `/api/products/:id` | Desactivar producto | Sí | `inventory:edit` |
| GET | `/api/products/categories` | Listar categorías | Sí | - |
| GET | `/api/products/categories/quick-access` | Categorías de acceso rápido | Sí | - |
| GET | `/api/products/brands` | Listar marcas | Sí | - |
| GET | `/api/backoffice/products/:id/size-curve` | Curva de talles (productos variables) | Sí | - |

**Ver documentación completa:** [API-PRODUCTOS.md](./API-PRODUCTOS.md)

### 7.3 Ventas

| Método | Ruta | Descripción | Auth | Permisos |
|--------|------|-------------|------|----------|
| POST | `/api/sales` | Crear venta | Sí | `pos:sell` |
| GET | `/api/sales` | Listar ventas | Sí | - |
| GET | `/api/sales/:id` | Detalle venta | Sí | - |
| POST | `/api/sales/:id/cancel` | Anular venta | Sí | `pos:cancel` |
| GET | `/api/sales/reports/daily-summary` | Resumen del día | Sí | - |

### 7.4 Cianbox (Sincronización)

| Método | Ruta | Descripción | Auth | Permisos |
|--------|------|-------------|------|----------|
| POST | `/api/cianbox/sync/products` | Sincronizar productos | Sí | `admin` |
| POST | `/api/cianbox/sync/categories` | Sincronizar categorías | Sí | `admin` |
| POST | `/api/cianbox/sync/brands` | Sincronizar marcas | Sí | `admin` |
| GET | `/api/cianbox/connection/test` | Probar conexión | Sí | `admin` |

## 8. Modelos de Datos

### 8.1 Entidades Core

**Tenant** - Empresas/clientes
- `id`, `name`, `slug` (único), `status`, `plan`
- Relaciones: users, products, sales, branches

**User** - Usuarios por tenant
- `id`, `tenantId`, `email`, `passwordHash`, `name`, `roleId`, `branchId`, `pin`
- Relaciones: tenant, role, branch, sales

**Role** - Roles y permisos
- `id`, `tenantId`, `name`, `permissions[]` (array de strings)

**AgencyUser** - Super admins globales (gestión de agencia)

### 8.2 Estructura Organizacional

**Branch** - Sucursales
- `id`, `tenantId`, `code`, `name`, `address`, `cianboxBranchId`
- Relaciones: pointsOfSale, productStock

**PointOfSale** - Cajas/Puntos de venta
- `id`, `tenantId`, `branchId`, `code`, `name`, `priceListId`
- Relaciones: sales, cashRegisters

**CashRegister** - Arqueos de caja
- `id`, `pointOfSaleId`, `userId`, `openingAmount`, `closingAmount`, `status`

### 8.3 Catálogo

**Category** - Categorías (jerarquía con parent/children)
- `id`, `tenantId`, `cianboxCategoryId`, `name`, `parentId`

**Brand** - Marcas
- `id`, `tenantId`, `cianboxBrandId`, `name`

**PriceList** - Listas de precios
- `id`, `tenantId`, `cianboxPriceListId`, `name`, `currency`

**Product** - Productos (incluye productos variables con curva de talles)
- `id`, `tenantId`, `cianboxProductId`, `sku`, `barcode`, `name`
- `categoryId`, `brandId`, `basePrice`, `taxRate`, `trackStock`
- **Productos Variables:** `isParent`, `parentProductId`, `size`, `color`
- Relaciones: prices (por lista), stock (por branch), variants (si es padre)

**Productos Variables:**
- Soporta productos padre con múltiples variantes (curva de talles)
- Variantes definidas por combinaciones de talle y color
- Búsqueda inteligente: escanear código padre → selector de talles
- Stock agregado automático por variante en backoffice
- Ver [PRODUCTOS-VARIABLES.md](./PRODUCTOS-VARIABLES.md) para más detalles

**ProductPrice** - Precios por lista
- `id`, `productId`, `priceListId`, `price`, `cost`, `margin`

**ProductStock** - Stock por sucursal
- `id`, `productId`, `branchId`, `quantity`, `reserved`, `available`

### 8.4 Ventas

**Sale** - Ventas
- `id`, `tenantId`, `branchId`, `pointOfSaleId`, `userId`, `customerId`
- `saleNumber`, `receiptType`, `subtotal`, `discount`, `tax`, `total`
- `status` (PENDING, COMPLETED, CANCELLED, REFUNDED)
- Relaciones: items, payments

**SaleItem** - Detalle de venta
- `id`, `saleId`, `productId`, `quantity`, `unitPrice`, `discount`, `subtotal`
- `promotionId`, `taxRate`, `taxAmount`

**Payment** - Cobros/Pagos
- `id`, `saleId`, `method` (CASH, CARD, QR, etc), `amount`
- `reference`, `cardBrand`, `installments`, `status`

### 8.5 Promociones

**Promotion** - Promociones
- `id`, `tenantId`, `code`, `name`, `type`, `discountValue`
- `startDate`, `endDate`, `isActive`, `priority`
- Tipos: PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, SECOND_UNIT_DISCOUNT, FLASH_SALE

**PromotionProduct** - Productos en promoción (N:M)

**Combo** - Combos/Packs
- `id`, `tenantId`, `code`, `name`, `regularPrice`, `comboPrice`
- Relaciones: items (productos del combo)

### 8.6 Integración Cianbox

**CianboxConnection** - Configuración de conexión
- `id`, `tenantId`, `cuenta`, `appName`, `appCode`, `user`, `password`
- `accessToken`, `tokenExpiresAt`, `syncPageSize`, `lastSync`

### 8.7 Clientes

**Customer** - Clientes
- `id`, `tenantId`, `cianboxCustomerId`, `name`, `taxId`
- `customerType` (CONSUMER, INDIVIDUAL, BUSINESS)
- `priceListId`, `creditLimit`, `globalDiscount`

### 8.8 Impresión

**Printer** - Impresoras
- `id`, `tenantId`, `name`, `type` (THERMAL, FISCAL, etc)
- `connectionType` (USB, NETWORK, BLUETOOTH), `ipAddress`

**PrintPoint** - Puntos de impresión (agrupan impresoras)
- `id`, `tenantId`, `name`

## 9. Servicios e Integraciones

### 9.1 Cianbox ERP API

**URL Base:** `https://cianbox.org/{cuenta}/api/v2`

**Endpoints Utilizados:**
- `POST /auth/credentials` - Obtener access_token
- `GET /productos/lista` - Listar productos (paginado)
- `GET /productos/categorias` - Listar categorías
- `GET /productos/marcas` - Listar marcas
- `GET /pedidos/lista` - Listar pedidos
- `GET /pedidos/estados` - Estados de pedidos
- `PUT /pedidos/editar-estado` - Cambiar estado

**Autenticación:**
- POST credentials → Recibe `access_token` y `expires_in`
- Token se cachea en memoria por tenant
- Renovación automática antes de expiración

**Sincronización:**
- Manual desde panel admin
- Sincronización incremental por páginas (configurable)
- Progreso reportado vía SSE (Server-Sent Events)
- Mapeo de IDs Cianbox → IDs locales

### 9.2 Socket.io (Tiempo Real)

**Eventos:**
- `sync:progress` - Progreso de sincronización
- `sale:created` - Notificar nueva venta
- `stock:updated` - Actualización de stock

## 10. Convenciones de Código

### 10.1 Backend

**Reglas CRÍTICAS:**
1. **SIEMPRE filtrar por `tenantId`** en todas las queries Prisma
2. Usar middleware `authenticate` en rutas protegidas
3. Validar inputs con Zod antes de procesar
4. Usar transacciones Prisma para operaciones multi-tabla
5. Lanzar errores con clases `ApiError`, `ValidationError`, etc.
6. No exponer stack traces en producción

**Ejemplo de Query Correcta:**
```typescript
// ✅ CORRECTO
const products = await prisma.product.findMany({
  where: { tenantId: req.user!.tenantId, isActive: true }
});

// ❌ INCORRECTO - NUNCA hacer esto
const products = await prisma.product.findMany({
  where: { isActive: true }  // Falta tenantId - PELIGRO CROSS-TENANT
});
```

**Permisos:**
- Formato: `resource:action` (ej: `pos:sell`, `inventory:edit`)
- `*` = super admin (todos los permisos)
- Verificar con middleware `authorize('permiso1', 'permiso2')` (OR)

### 10.2 Frontend

**Reglas:**
1. Usar Zustand para estado global (auth, cart)
2. Centralizar llamadas HTTP en `services/api.ts`
3. Incluir token JWT en header `Authorization: Bearer`
4. Manejar errores 401 (relogin) y 403 (sin permisos)
5. TailwindCSS para estilos (utility-first)

### 10.3 Base de Datos

**Migraciones:**
```bash
# Crear migración
npx prisma migrate dev --name nombre_descriptivo

# Aplicar en producción
npx prisma migrate deploy

# Ver estado
npx prisma migrate status
```

**Seeds:**
```bash
npm run db:seed
```

### 10.4 Archivos a NO Commitear

- `.env` (variables de entorno)
- `node_modules/`
- `dist/` (build output)
- `.DS_Store`
- `prisma/migrations/*.sql` (se versiona estructura, no datos)

## 11. Comandos Útiles

### Backend
```bash
npm run dev              # Desarrollo con hot-reload
npm run build            # Compilar TypeScript
npm start                # Producción
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Crear/aplicar migración
npm run prisma:studio    # Visualizador BD web
npm run db:seed          # Poblar BD con datos prueba
npm run typecheck        # Verificar errores TypeScript
```

### Frontend
```bash
npm run dev              # Desarrollo (puerto 5173)
npm run build            # Build producción
npm run preview          # Preview build
```

## 12. Testing

### Datos de Prueba (seed)

Después de ejecutar `npm run db:seed` en backend:

**AgencyUser:**
- Email: `admin@agency.com`
- Password: `Admin123!`

**Tenant de prueba:**
- Slug: `demo`
- Nombre: "Tienda Demo"

**Usuario de tenant:**
- Email: `admin@demo.com`
- Password: `Demo123!`
- Rol: Administrador (todos los permisos)

**Login:**
```
Empresa: demo
Email: admin@demo.com
Password: Demo123!
```

## 13. Seguridad

### 13.1 Autenticación
- Passwords hasheados con bcrypt (10 rounds)
- JWT con expiración configurable
- Refresh tokens para renovación
- Sessions tracking (login/logout)

### 13.2 Autorización
- Middleware `authenticate` valida JWT
- Middleware `authorize` verifica permisos
- Aislamiento multi-tenant estricto (tenantId)
- Rate limiting (recomendado en producción)

### 13.3 Best Practices
- HTTPS en producción
- Helmet.js para headers de seguridad
- CORS configurado
- Validación de inputs (Zod)
- SQL injection prevention (Prisma ORM)

## 14. Deployment

### 14.1 Backend

**Requisitos:**
- Node.js 18+
- PostgreSQL 15+
- Variables de entorno configuradas

**Pasos:**
```bash
npm run build
npx prisma migrate deploy
npm start
```

**Servicios Recomendados:**
- Render.com
- Railway.app
- DigitalOcean App Platform
- AWS ECS / Lambda

### 14.2 Frontend

**Build:**
```bash
npm run build  # Genera dist/
```

**Deploy:**
- Vercel (recomendado)
- Netlify
- AWS S3 + CloudFront
- Nginx (VPS)

### 14.3 Base de Datos

**Servicios Gestionados:**
- Supabase (PostgreSQL)
- Neon.tech
- Railway
- AWS RDS
- DigitalOcean Managed Databases

## 15. Features Implementadas Recientemente

- [x] **Productos Variables (Curva de Talles)** - Productos padre con variantes por talle/color
- [x] Integración con Mercado Pago (Point y QR)
- [x] Sistema de caja con arqueos y relevos de turno
- [x] Categorías de acceso rápido en POS
- [x] Sincronización completa con Cianbox

## 16. Roadmap / Features Pendientes

- [ ] Impresión de tickets/facturas
- [ ] Facturación electrónica (AFIP/SAT)
- [ ] Reportes avanzados (ventas, stock, rentabilidad)
- [ ] App móvil (React Native)
- [ ] Sincronización bidireccional con Cianbox (pedidos → Cianbox)
- [ ] Backup automático
- [ ] Multi-moneda
- [ ] Internacionalización (i18n)

## 17. Troubleshooting

### Backend no inicia
```bash
# Verificar variables de entorno
cat .env

# Verificar BD
npx prisma migrate status

# Regenerar cliente Prisma
npx prisma generate
```

### Error de conexión a BD
```bash
# Verificar que PostgreSQL esté corriendo
psql -U usuario -d cianbox_pos

# Verificar DATABASE_URL
echo $DATABASE_URL
```

### JWT inválido
- Verificar que `JWT_SECRET` sea el mismo que generó el token
- Token puede haber expirado (verificar `JWT_EXPIRES_IN`)

### Cross-tenant data leak
- Revisar TODAS las queries Prisma
- Buscar: `prisma.product.findMany` sin `where: { tenantId }`
- Herramienta de auditoría: `grep -r "findMany" src/`

## 18. Contacto y Soporte

**Repositorio:** [GitHub](https://github.com/...)
**Documentación completa:** `docs/GUIA-TECNICA-POS-CIANBOX.md`
**Índice de documentación:** `docs/README.md`
**Generado:** 2025-12-21
**Versión:** 1.1.0
