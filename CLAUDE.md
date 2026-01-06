# CLAUDE.md - Cianbox POS

**Ruta del proyecto:** `C:\Users\gabri\Drive\Carpetas\Documentos\GitHub\cianbox-pos`

## Reglas

- Proceder sin pedir confirmacion
- Responder en espanol
- Ejecutar comandos y editar archivos directamente
- Seguir la guia tecnica en `docs/GUIA-TECNICA-POS-CIANBOX.md`
- **Build local antes de push:** SIEMPRE ejecutar build local antes de hacer push para no subir codigo con errores:
  ```bash
  cd apps/backend && npm run build
  cd apps/frontend && npm run build
  cd apps/backoffice && npm run build
  cd apps/agency && npm run build
  ```
- **Despliegue a produccion:** Los deploys se realizan mediante commit/push a GitHub. El self-hosted runner en el servidor ejecuta automaticamente los GitHub Actions. NO hacer deploy manual por SSH.
- **Migraciones Prisma:** Los cambios en `schema.prisma` se aplican automaticamente en el deploy via `prisma db push`. No requiere intervencion manual.

## Proyecto

Sistema POS (Point of Sale) multi-tenant con integracion a Cianbox ERP.

**Funcionalidades principales:**
- Registro de ventas con productos simples y variables (talles/colores)
- Cobros multiples: efectivo, tarjeta, QR, transferencia, gift cards, vales de credito
- Terminales Mercado Pago Point integradas (modo PDV)
- Pagos con tarjeta en cuotas con recargo financiero configurable
- Promociones: 2x1, 2da unidad al 50%, descuentos por fecha
- Promociones bancarias: cuotas sin interes por banco/tarjeta
- Promociones especiales: BlackFriday, CyberMonday (activables por fecha)
- Gift Cards: venta, activacion y redencion
- Vales de Credito (Store Credits): para devoluciones y cortesias
- Gestion de caja: apertura, cierre, arqueos detallados por denominacion
- Liquidacion de cupones de tarjeta con conciliacion bancaria
- Facturacion electronica AFIP (Facturas A, B, C)
- Sincronizacion con Cianbox (productos, categorias, marcas, precios)

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
│   ├── backend/          # API Node.js/Express
│   ├── frontend/         # POS React (punto de venta)
│   ├── backoffice/       # Backoffice para clientes
│   ├── agency/           # Backoffice para agencia
│   └── desktop/          # App Windows Python/PyQt6
├── landing/              # Landing page marketing
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── docs/                 # Documentacion
├── deploy/               # Scripts de deploy
└── .github/workflows/    # CI/CD
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
- `Payment` - Pagos (efectivo, tarjeta, QR, transferencia, gift card, store credit)
- `Promotion` - Promociones de producto
- `PromotionProduct` - Productos en promocion
- `CashSession` - Sesiones de caja (apertura/cierre)
- `CashMovement` - Movimientos de caja (ingresos/retiros)
- `GiftCard` - Tarjetas de regalo
- `StoreCredit` - Vales de credito
- `CardTerminal` - Terminales de tarjeta
- `CardBrand` - Marcas de tarjeta (Visa, Mastercard, etc)
- `Bank` - Bancos
- `BankPromotion` - Promociones bancarias (cuotas sin interes)
- `CardVoucher` - Cupones de tarjeta pendientes de liquidar
- `VoucherSettlement` - Liquidaciones de cupones

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

## Integracion Mercado Pago Point

Terminales integradas en modo PDV para cobro directo desde el POS.

### Configuracion
- Se configura en `Integraciones > MercadoPago`
- Requiere Access Token de produccion
- Los dispositivos Point se asignan a cada Punto de Venta

### Flujo de Cobro
1. Usuario selecciona pago con tarjeta
2. POS envia monto a la terminal asignada via API
3. Cliente pasa tarjeta en la terminal
4. Terminal devuelve resultado al POS
5. Se registra el pago con datos de la transaccion

## Pagos con Tarjeta y Cuotas

### Configuracion de Recargo Financiero
- Se configura por cantidad de cuotas (3, 6, 12, 18 cuotas)
- Cada plan tiene su tasa de recargo (ej: 3 cuotas = 7%)
- Configuracion a nivel de Tenant con override por POS

### Modos de Visualizacion de Recargo
| Modo | Descripcion |
|------|-------------|
| `SEPARATE_ITEM` | Muestra linea separada "Recargo financiero" |
| `DISTRIBUTED` | Suma el recargo al precio de cada producto |

## Promociones Bancarias

Cuotas sin interes y descuentos por banco/tarjeta.

### Configuracion
- Banco emisor (Galicia, Santander, Macro, etc)
- Marca de tarjeta (Visa, Mastercard, Amex)
- Cantidad de cuotas sin interes
- Dias de la semana activos
- Rango de fechas de vigencia

## Facturacion AFIP

Emision de comprobantes electronicos (Facturas A, B, C).

### Configuracion
- Certificado digital (.p12)
- CUIT del contribuyente
- Punto de venta fiscal
- Condicion frente al IVA

### Tipos de Comprobante
| Tipo | Uso |
|------|-----|
| Factura A | Responsable Inscripto a Responsable Inscripto |
| Factura B | Responsable Inscripto a Consumidor Final |
| Factura C | Monotributista |

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

| App | Puerto | Carpeta en Servidor | URL Produccion |
|-----|--------|---------------------|----------------|
| POS Frontend | 80 | `/var/www/cianbox-pos/frontend` | https://cianbox-pos-point.ews-cdn.link |
| Landing Page | 80 | `/var/www/cianbox-pos/landing` | https://cianbox-pos-point.ews-cdn.link/landing |
| Agency Backoffice | 8083 | `/var/www/cianbox-pos/apps/agency/dist` | https://cianbox-pos-agency.ews-cdn.link |
| Client Backoffice | 8084 | `/var/www/cianbox-pos/apps/backoffice/dist` | https://cianbox-pos-backoffice.ews-cdn.link |
| Backend API | 3001 | `/var/www/cianbox-pos/apps/backend/dist` | https://cianbox-pos-point.ews-cdn.link/api |

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
- **API de Productos:** `docs/API-PRODUCTOS.md`
- **Productos Variables:** `docs/PRODUCTOS-VARIABLES.md`
- **Credenciales de Testing:** `docs/TESTING-CREDENTIALS.md`
- **Landing Page:** `landing/README.md`
- **Codigo de referencia:** Proyecto warehouse-picking (mismo stack)
