# Multi-tenancy - Modelo de Datos

**Sistema multi-tenant con aislamiento completo de datos por cliente**

## Visión General

Cianbox POS implementa un sistema **multi-tenant** donde cada cliente (tenant) tiene sus propios datos completamente aislados. Todos los datos transaccionales (productos, ventas, usuarios, etc.) están segregados por `tenantId`.

## Tenant

Representa a un cliente/empresa que usa el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | ID único del tenant |
| name | String | Nombre de la empresa |
| slug | String | Identificador único URL-friendly (ej: "mi-tienda") |
| logo | String? | URL del logo |
| taxId | String? | CUIT/RUT/NIT |
| plan | TenantPlan | FREE, PRO, ENTERPRISE |
| status | TenantStatus | TRIAL, ACTIVE, SUSPENDED, CANCELLED |
| settings | Json? | Configuración personalizada |
| databaseServerId | String? | Servidor de DB asignado (multi-DB future) |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones (tiene muchos):**
- `users` - Usuarios del tenant
- `roles` - Roles personalizados
- `branches` - Sucursales
- `pointsOfSale` - Puntos de venta
- `products` - Productos
- `categories` - Categorías
- `brands` - Marcas
- `sales` - Ventas
- `customers` - Clientes
- `promotions` - Promociones
- `cianboxConnection` - Conexión a Cianbox ERP (one-to-one)

**Índices únicos:**
- `slug` - Cada tenant tiene un slug único

## TenantPlan

Planes de suscripción disponibles.

| Plan | Descripción | Límites |
|------|-------------|---------|
| FREE | Plan gratuito | 100 productos, 1 sucursal, 2 usuarios |
| PRO | Plan profesional | 10,000 productos, 5 sucursales, 20 usuarios |
| ENTERPRISE | Plan empresarial | Ilimitado |

## TenantStatus

Estados del tenant.

| Estado | Descripción |
|--------|-------------|
| TRIAL | Período de prueba (14 días) |
| ACTIVE | Activo y operativo |
| SUSPENDED | Suspendido (falta de pago o violación TOS) |
| CANCELLED | Cancelado (datos se mantienen 30 días) |

## TenantSettings (JSON)

El campo `settings` de tipo `Json` permite configuración personalizada:

```typescript
{
  // Configuración regional
  "locale": "es-AR",
  "timezone": "America/Argentina/Buenos_Aires",
  "currency": "ARS",

  // Configuración de negocio
  "taxRate": 21,
  "taxIncluded": true,
  "requireCustomerForInvoice": true,

  // Límites y restricciones
  "maxDiscountPercent": 15,
  "allowNegativeStock": false,
  "requireBatchSerial": false,

  // Configuración de facturación
  "invoicePrefix": "A",
  "invoiceSequence": 1,
  "fiscalPrinter": {
    "enabled": false,
    "model": "HASAR",
    "port": "COM1"
  },

  // Notificaciones
  "notifications": {
    "lowStockThreshold": 5,
    "emailOnSale": false,
    "smsOnShipment": false
  }
}
```

### Acceder a configuración

```typescript
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId }
});

const settings = tenant.settings as TenantSettings;
const taxRate = settings.taxRate || 21; // Default 21%
```

## Tablas Multi-tenant vs Globales

### Tablas Multi-tenant (con tenantId)

Todas estas tablas tienen `tenantId` y están segregadas por cliente:

- User
- Role
- Branch
- PointOfSale
- Product
- Category
- Brand
- PriceList
- ProductPrice
- Stock
- Sale
- SaleItem
- Payment
- Customer
- Promotion
- CashSession
- CashMovement
- PosTerminal
- CianboxConnection

### Tablas Globales (sin tenantId)

Estas tablas son compartidas entre todos los tenants:

- Tenant
- DatabaseServer
- AgencyUser
- Webhook logs (opcional)

## Límites por Plan

Implementar validaciones antes de crear registros:

```typescript
async function canCreateProduct(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { products: true } } }
  });

  const limits = {
    FREE: 100,
    PRO: 10000,
    ENTERPRISE: Infinity
  };

  const currentCount = tenant._count.products;
  const limit = limits[tenant.plan];

  return currentCount < limit;
}

// Uso
if (!await canCreateProduct(tenantId)) {
  throw new ApiError(403, 'LIMIT_EXCEEDED',
    'Ha alcanzado el límite de productos de su plan');
}
```

## Monitoreo

### Métricas por Tenant

```typescript
const stats = await prisma.tenant.findUnique({
  where: { id: tenantId },
  include: {
    _count: {
      select: {
        users: true,
        products: true,
        sales: true,
        customers: true
      }
    }
  }
});
```

### Identificar tenants grandes

```typescript
const largeTenants = await prisma.tenant.findMany({
  include: {
    _count: { select: { products: true } }
  }
});

const sorted = largeTenants
  .sort((a, b) => b._count.products - a._count.products)
  .slice(0, 10);
```

## Documentación Relacionada

- [TENANTS-SEGURIDAD.md](./TENANTS-SEGURIDAD.md) - Seguridad y endpoints
