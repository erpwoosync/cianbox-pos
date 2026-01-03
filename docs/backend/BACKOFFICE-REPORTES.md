# Backoffice - Reportes y Configuración

**Endpoints de reportes, configuración y flujo de configuración inicial**

## Endpoints de Reportes

### GET /api/backoffice/reports/sales

Reporte de ventas.

**Autenticación:** Bearer token + permiso `reports:sales`

**Query Parameters:**
- `dateFrom` - Fecha desde (ISO 8601)
- `dateTo` - Fecha hasta
- `branchId` - Filtrar por sucursal
- `pointOfSaleId` - Filtrar por POS
- `userId` - Filtrar por usuario
- `groupBy` - Agrupar por: `day`, `week`, `month`, `user`, `branch`, `product`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSales": 150,
      "totalAmount": "2500000.00",
      "totalItems": 450,
      "averageTicket": "16666.67"
    },
    "salesByDay": [
      { "date": "2025-12-20", "count": 25, "amount": "420000.00" },
      { "date": "2025-12-21", "count": 30, "amount": "510000.00" }
    ],
    "salesByPaymentMethod": [
      { "method": "CASH", "count": 80, "amount": "1200000.00" },
      { "method": "DEBIT_CARD", "count": 50, "amount": "900000.00" },
      { "method": "CREDIT_CARD", "count": 20, "amount": "400000.00" }
    ],
    "topProducts": [
      {
        "productId": "prod123",
        "name": "Remera Nike",
        "quantity": "50.000",
        "amount": "799950.00"
      }
    ]
  }
}
```

### GET /api/backoffice/reports/inventory

Reporte de inventario.

**Autenticación:** Bearer token + permiso `reports:inventory`

**Query Parameters:**
- `branchId` - Filtrar por sucursal
- `categoryId` - Filtrar por categoría
- `lowStock` - Solo productos con stock bajo

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalProducts": 1523,
      "totalValue": "25000000.00",
      "lowStockProducts": 45,
      "outOfStockProducts": 12
    },
    "products": [
      {
        "id": "prod123",
        "name": "Remera Nike",
        "sku": "SKU-001",
        "category": "Remeras",
        "stock": [
          {
            "branch": "Casa Central",
            "quantity": "50.000",
            "value": "799950.00",
            "status": "OK"
          }
        ],
        "totalStock": "50.000",
        "totalValue": "799950.00"
      }
    ]
  }
}
```

### GET /api/backoffice/reports/cash

Reporte de caja.

**Autenticación:** Bearer token + permiso `reports:financial`

## Permisos de Reportes

| Permiso | Descripción |
|---------|-------------|
| `reports:sales` | Ver reportes de ventas |
| `reports:inventory` | Ver reportes de inventario |
| `reports:financial` | Ver reportes financieros |
| `cash:report_all` | Ver reportes de todas las cajas |

## Endpoints de Configuración

### GET /api/backoffice/settings

Obtener configuración del tenant.

**Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant123",
      "name": "Mi Tienda S.A.",
      "taxId": "20-12345678-9",
      "logo": "https://cdn.example.com/logo.png"
    },
    "settings": {
      "locale": "es-AR",
      "timezone": "America/Argentina/Buenos_Aires",
      "currency": "ARS",
      "taxRate": 21,
      "taxIncluded": true
    }
  }
}
```

### PUT /api/backoffice/settings

Actualizar configuración del tenant.

**Autenticación:** Bearer token + permiso `settings:edit`

**Request:**
```json
{
  "name": "Mi Tienda S.A.",
  "logo": "https://cdn.example.com/new-logo.png",
  "settings": {
    "taxRate": 21,
    "taxIncluded": true,
    "maxDiscountPercent": 15
  }
}
```

## Endpoints de Conexión Cianbox

### GET /api/backoffice/cianbox/connection

Ver configuración de conexión a Cianbox.

Ver documentación en [CIANBOX-ENDPOINTS.md](./CIANBOX-ENDPOINTS.md)

### POST /api/backoffice/cianbox/connection

Configurar conexión a Cianbox.

### POST /api/backoffice/cianbox/sync/all

Sincronizar todos los datos desde Cianbox.

## Flujo Típico de Configuración Inicial

```
1. Crear Tenant (desde Agency)
   ↓
2. Login como admin del tenant
   ↓
3. Configurar conexión a Cianbox
   POST /backoffice/cianbox/connection
   ↓
4. Sincronizar datos desde Cianbox
   POST /backoffice/cianbox/sync/all
   ↓
5. Crear Punto de Venta
   POST /backoffice/points-of-sale
   ↓
6. Registrar Terminal POS
   (Desde software desktop)
   POST /terminals/register
   ↓
7. Activar Terminal
   PATCH /backoffice/terminals/:id
   {status: "ACTIVE", pointOfSaleId: "..."}
   ↓
8. Crear Usuarios
   POST /backoffice/users
   ↓
9. Sistema listo para operar
```

## Ejemplo: Configuración Completa

```typescript
// 1. Configurar Cianbox
await fetch('/api/backoffice/cianbox/connection', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    cuenta: 'mi-tienda',
    appName: 'POS',
    appCode: 'pos-001',
    user: 'api_user',
    password: 'contraseña',
    syncPageSize: 50
  })
});

// 2. Sincronizar
await fetch('/api/backoffice/cianbox/sync/all', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Crear POS
const pos = await fetch('/api/backoffice/points-of-sale', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    branchId: 'branch123',
    code: 'CAJA-01',
    name: 'Caja Principal',
    priceListId: 'plist-minorista',
    isActive: true
  })
});

// 4. Crear usuario cajero
await fetch('/api/backoffice/users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'cajero@example.com',
    password: 'contraseña',
    name: 'María González',
    roleId: 'role-cajero',
    pin: '1234'
  })
});
```

## Documentación Relacionada

- [BACKOFFICE-USUARIOS.md](./BACKOFFICE-USUARIOS.md) - Usuarios, roles y catálogo
