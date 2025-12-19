# CLAUDE.md - Cianbox POS

**Ruta del proyecto:** `C:\Users\gabri\Drive\Carpetas\Documentos\GitHub\cianbox-pos`

## Reglas

- Proceder sin pedir confirmacion
- Responder en espanol
- Ejecutar comandos y editar archivos directamente
- Seguir la guia tecnica en `docs/GUIA-TECNICA-POS-CIANBOX.md`
- **Despliegue a produccion:** Los deploys se realizan mediante commit/push a GitHub. El self-hosted runner en el servidor ejecuta automaticamente los GitHub Actions. NO hacer deploy manual por SSH.
- **Migraciones Prisma:** Los cambios en `schema.prisma` se aplican automaticamente en el deploy via `prisma db push`. No requiere intervencion manual.

## Proyecto

Sistema POS (Point of Sale) multi-tenant con integracion a Cianbox ERP.

**Funcionalidades principales:**
- Registro de ventas
- Cobros y pagos
- Consulta de precios
- Promociones: 2x1, 2da unidad al 50%, descuentos por fecha
- Promociones especiales: BlackFriday, CyberMonday (activables por fecha)
- Sincronizacion con Cianbox (productos, categorias, marcas)

## Stack Tecnologico

### Backend
- Node.js 18+
- Express 4.x
- Prisma 5.x (ORM)
- PostgreSQL 15+
- JWT (autenticacion)
- Zod (validacion)
- Socket.io (tiempo real)

### Frontend
- React 18
- Vite 5.x
- TailwindCSS 3.x
- React Router 6.x

## Estructura del Proyecto

```
cianbox-pos/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── cianbox.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── sales.ts
│   │   │   │   └── promotions.ts
│   │   │   ├── services/
│   │   │   │   └── cianbox.service.ts
│   │   │   └── utils/
│   │   │       └── errors.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── services/
│       │   ├── hooks/
│       │   └── context/
│       ├── package.json
│       └── vite.config.ts
├── docs/
│   └── GUIA-TECNICA-POS-CIANBOX.md
├── deploy/
└── .github/workflows/
```

## Integracion Cianbox

**Referencia:** Ver codigo completo en `docs/GUIA-TECNICA-POS-CIANBOX.md`

### Endpoints Cianbox Disponibles

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/auth/credentials` | POST | Obtener token de acceso |
| `/productos/lista` | GET | Listar productos (paginado) |
| `/productos/categorias` | GET | Listar categorias |
| `/productos/marcas` | GET | Listar marcas |
| `/pedidos/lista` | GET | Listar pedidos |
| `/pedidos/editar-estado` | POST | Cambiar estado pedido |

### Configuracion por Tenant

Cada tenant tiene su propia conexion a Cianbox:
- `apiUrl`: URL base de la API Cianbox del cliente
- `apiKey`: API Key proporcionada por Cianbox
- Token se cachea y renueva automaticamente

## Arquitectura Multi-tenant

**REGLA CRITICA:** Filtrar SIEMPRE por `tenantId` en todas las queries.

```typescript
// CORRECTO
const products = await prisma.product.findMany({
  where: { tenantId: req.user!.tenantId }
});

// INCORRECTO - NUNCA hacer esto
const products = await prisma.product.findMany();
```

## Modelo de Datos Base

### Entidades Core
- `Tenant` - Clientes/empresas
- `User` - Usuarios por tenant
- `Role` - Roles y permisos
- `CianboxConnection` - Configuracion API Cianbox

### Entidades de Catalogo (sync con Cianbox)
- `Category` - Categorias de productos
- `Brand` - Marcas
- `Product` - Productos

### Entidades POS
- `Sale` - Ventas
- `SaleItem` - Items de venta
- `Payment` - Pagos
- `Promotion` - Promociones
- `PromotionProduct` - Productos en promocion

## Promociones

### Tipos Soportados
| Tipo | Descripcion |
|------|-------------|
| `BUY_X_GET_Y` | 2x1, 3x2, etc |
| `SECOND_UNIT_DISCOUNT` | 2da unidad al X% |
| `PERCENTAGE` | Descuento porcentual |
| `FIXED_AMOUNT` | Descuento monto fijo |
| `FLASH_SALE` | BlackFriday, CyberMonday |

### Activacion por Fecha
```typescript
// Promocion activa si:
// 1. isActive = true
// 2. startDate <= now <= endDate
// 3. Aplica al producto
```

## Comandos de Desarrollo

```bash
# Backend
cd apps/backend
npm install
npm run dev          # Desarrollo
npm run build        # Compilar
npx prisma generate  # Generar cliente
npx prisma migrate dev  # Migraciones

# Frontend
cd apps/frontend
npm install
npm run dev          # Desarrollo
npm run build        # Compilar
```

## Variables de Entorno

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@host:5432/cianbox_pos
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3000
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

## Reglas de Codigo

1. **Siempre filtrar por tenantId** en queries
2. **Validar inputs** con Zod antes de procesar
3. **Usar middleware auth** en rutas protegidas
4. **Manejar errores** con ApiError
5. **No commitear:** .env, node_modules, dist

## Infraestructura de Produccion

### Servidores

| Servidor | IP | Hostname | Rol |
|----------|-----|----------|-----|
| APP Server | 172.16.1.61 | cianbox-pos-app | Backend + Frontends + GitHub Runner |
| DB Server | 172.16.1.62 | cianbox-pos-db1 | PostgreSQL 15.14 |

### Conexion SSH

```bash
# Llave SSH: ssh key/root_servers_ssh_key

# Servidor APP
ssh -i "ssh key/root_servers_ssh_key" root@172.16.1.61

# Servidor DB
ssh -i "ssh key/root_servers_ssh_key" root@172.16.1.62
```

### Despliegue de Aplicaciones

| App | Puerto | Carpeta en Servidor |
|-----|--------|---------------------|
| POS Frontend | 80 | `/var/www/cianbox-pos/frontend` |
| Agency Backoffice | 8083 | `/var/www/cianbox-pos/apps/agency/dist` |
| Client Backoffice | 8084 | `/var/www/cianbox-pos/apps/backoffice/dist` |
| Backend API | 3001 | `/var/www/cianbox-pos/apps/backend/dist` |

### Servicios en Servidor APP

- **PM2:** `cianbox-pos-api` (Node.js backend en puerto 3001)
- **Nginx:** Reverse proxy para las 3 apps frontend
- **GitHub Runner:** `/opt/actions-runner` (CI/CD automatico)

### Comandos Utiles

```bash
# PM2 - Backend
pm2 status
pm2 logs cianbox-pos-api
pm2 restart cianbox-pos-api

# Nginx
nginx -t && systemctl reload nginx

# GitHub Runner
systemctl status actions.runner.erpwoosync-cianbox-pos.cianbox-pos-runner

# PostgreSQL (en servidor DB)
sudo -u postgres psql -d cianbox_pos
```

### Base de Datos

- **Host:** 172.16.1.62
- **Puerto:** 5432
- **Database:** cianbox_pos
- **Usuario:** cianbox_pos

### Documentacion Completa

Ver `docs/INFRAESTRUCTURA.md` para configuraciones detalladas de Nginx, troubleshooting y procedimientos de despliegue.

## Documentacion de Referencia

- **Guia Tecnica Completa:** `docs/GUIA-TECNICA-POS-CIANBOX.md`
- **Infraestructura:** `docs/INFRAESTRUCTURA.md`
- **Codigo de referencia:** Proyecto warehouse-picking (mismo stack)
