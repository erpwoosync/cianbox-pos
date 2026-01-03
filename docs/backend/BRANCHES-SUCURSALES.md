# Sucursales y Puntos de Venta

**Gestión de la infraestructura física del sistema POS**

## Modelos de Datos

### Branch

Sucursales de la empresa (sincronizadas desde Cianbox).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| cianboxBranchId | Int? | ID en Cianbox (null si es local) |
| code | String | Código (ej: "SUC-001") |
| name | String | Nombre (ej: "Casa Central") |
| address | String? | Dirección |
| city | String? | Ciudad |
| state | String? | Provincia/Estado |
| zipCode | String? | Código postal |
| phone | String? | Teléfono |
| email | String? | Email |
| isDefault | Boolean | Sucursal por defecto |
| isActive | Boolean | Activo/Inactivo |
| lastSyncedAt | DateTime? | Última sincronización |

**Relaciones:**
- Tiene muchos `PointOfSale` (cajas)
- Tiene muchos `ProductStock` (stock por sucursal)
- Tiene muchos `User` (usuarios asignados)
- Tiene muchos `Sale` (ventas)
- Tiene muchos `CashSession` (turnos de caja)

**Índices únicos:**
- `[tenantId, code]` - Código único por tenant
- `[tenantId, cianboxBranchId]` - ID de Cianbox único por tenant

### PointOfSale

Puntos de venta (cajas registradoras).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| branchId | String | Sucursal |
| code | String | Código (ej: "CAJA-01") |
| name | String | Nombre (ej: "Caja Principal") |
| description | String? | Descripción |
| priceListId | String? | Lista de precios por defecto |
| isActive | Boolean | Activo/Inactivo |
| settings | Json | Configuración específica |
| **Mercado Pago Point** | | |
| mpDeviceId | String? | device_id del terminal MP Point |
| mpDeviceName | String? | Nombre del dispositivo |
| **Mercado Pago QR** | | |
| mpQrPosId | Int? | ID de caja en MP |
| mpQrExternalId | String? | external_id de la caja |

**Relaciones:**
- Pertenece a `Branch`
- Tiene muchos `Sale` (ventas)
- Tiene muchos `CashSession` (turnos)
- Tiene muchos `PosTerminal` (PCs registrados)
- Pertenece a `PriceList` (opcional)

**Índice único:**
- `[tenantId, branchId, code]` - Código único por sucursal

## Endpoints - Sucursales

### GET /api/branches

Listar sucursales (desde backoffice).

**Autenticación:** Bearer token requerido

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "branch123",
      "code": "SUC-001",
      "name": "Casa Central",
      "address": "Av. Libertador 1234",
      "city": "Buenos Aires",
      "state": "CABA",
      "isDefault": true,
      "isActive": true,
      "_count": {
        "pointsOfSale": 3,
        "products": 1523
      }
    }
  ]
}
```

### POST /api/branches

Crear sucursal (local, no sincronizada desde Cianbox).

**Autenticación:** Bearer token + permiso `settings:edit`

**Request:**
```json
{
  "code": "SUC-002",
  "name": "Sucursal Norte",
  "address": "Av. Corrientes 5678",
  "city": "Rosario",
  "state": "Santa Fe",
  "isActive": true
}
```

## Endpoints - Puntos de Venta

### GET /api/points-of-sale

Listar puntos de venta.

**Query Parameters:**
- `branchId` - Filtrar por sucursal

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pos123",
      "code": "CAJA-01",
      "name": "Caja Principal",
      "branch": { "id": "branch123", "name": "Casa Central" },
      "priceList": { "id": "plist123", "name": "Minorista" },
      "isActive": true
    }
  ]
}
```

### POST /api/points-of-sale

Crear punto de venta.

**Autenticación:** Bearer token + permiso `pos:write`

**Request:**
```json
{
  "branchId": "branch123",
  "code": "CAJA-02",
  "name": "Caja Secundaria",
  "priceListId": "plist123",
  "isActive": true
}
```

### PUT /api/points-of-sale/:id

Actualizar punto de venta.

### DELETE /api/points-of-sale/:id

Eliminar punto de venta.

**Validación:** No permite eliminar si tiene ventas asociadas

## Configuración de POS

### settings (JSON)

```json
{
  "printer": {
    "name": "EPSON TM-T20III",
    "width": 80
  },
  "display": {
    "showStock": true,
    "showCost": false
  },
  "defaults": {
    "printOnSale": true,
    "openDrawer": true
  }
}
```

## Ejemplo: Crear Estructura Completa

```typescript
// 1. Crear sucursal
const branch = await prisma.branch.create({
  data: {
    tenantId,
    code: 'SUC-001',
    name: 'Casa Central',
    isDefault: true,
    isActive: true
  }
});

// 2. Crear POS
const pos = await prisma.pointOfSale.create({
  data: {
    tenantId,
    branchId: branch.id,
    code: 'CAJA-01',
    name: 'Caja Principal',
    priceListId: 'plist-minorista',
    isActive: true
  }
});
```

## Documentación Relacionada

- [BRANCHES-TERMINALES.md](./BRANCHES-TERMINALES.md) - Terminales POS
