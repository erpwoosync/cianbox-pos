# Terminales POS

**Gestión de terminales POS (PCs con software instalado)**

## Modelo de Datos

### PosTerminal

Terminales POS (PCs con software instalado).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| deviceId | String | UUID del dispositivo |
| pointOfSaleId | String? | POS asignado |
| hostname | String | Nombre del PC |
| macAddress | String | Dirección MAC |
| osVersion | String? | Versión del SO |
| appVersion | String? | Versión del software POS |
| ipAddress | String? | IP actual |
| name | String? | Nombre personalizado |
| description | String? | Descripción |
| status | PosTerminalStatus | Estado |
| registeredAt | DateTime | Fecha de registro |
| lastSeenAt | DateTime | Última vez visto |
| lastLoginUserId | String? | Último usuario que inició sesión |

**PosTerminalStatus:** `PENDING`, `ACTIVE`, `DISABLED`, `BLOCKED`

**Relaciones:**
- Pertenece a `PointOfSale` (opcional)
- Pertenece a `User` (último login)

**Índice único:**
- `[tenantId, macAddress]` - MAC única por tenant

## Endpoints

### POST /api/terminals/register

Registrar o actualizar terminal POS (usado por software desktop).

**Autenticación:** Bearer token requerido

**Request:**
```json
{
  "hostname": "PC-CAJA-01",
  "macAddress": "00:1B:44:11:3A:B7",
  "osVersion": "Windows 11",
  "appVersion": "1.0.0",
  "ipAddress": "192.168.1.100"
}
```

**Response (terminal nueva - PENDING):**
```json
{
  "success": false,
  "error": {
    "code": "TERMINAL_NOT_ACTIVE",
    "message": "Terminal pendiente de activación. Contacte al administrador.",
    "status": "PENDING"
  },
  "data": {
    "id": "term123",
    "deviceId": "abc-123-def",
    "hostname": "PC-CAJA-01",
    "status": "PENDING"
  },
  "isNewTerminal": true
}
```

**Response (terminal activa):**
```json
{
  "success": true,
  "data": {
    "id": "term123",
    "deviceId": "abc-123-def",
    "hostname": "PC-CAJA-01",
    "status": "ACTIVE",
    "pointOfSale": {
      "id": "pos123",
      "code": "CAJA-01",
      "name": "Caja Principal",
      "branch": { "id": "branch123", "name": "Casa Central" },
      "priceList": { "id": "plist123", "name": "Minorista" }
    }
  },
  "isNewTerminal": false
}
```

**Proceso:**
1. Buscar terminal existente por MAC
2. Si existe: actualizar hostname, OS, IP, lastSeenAt
3. Si no existe: crear nueva con status=PENDING
4. Si status != ACTIVE: retornar error
5. Si status == ACTIVE: retornar datos completos del POS asignado

### POST /api/terminals/heartbeat

Actualizar lastSeenAt de la terminal (ping cada X minutos).

**Autenticación:** Bearer token requerido

**Request:**
```json
{
  "deviceId": "abc-123-def"
}
```

**Response:**
```json
{
  "success": true,
  "lastSeenAt": "2025-12-21T10:35:00Z"
}
```

### GET /api/terminals

Listar terminales (admin).

**Autenticación:** Bearer token + permiso `admin:terminals` o `*`

**Query Parameters:**
- `status` - Filtrar por estado
- `branchId` - Filtrar por sucursal
- `search` - Buscar por hostname o nombre

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "term123",
      "deviceId": "abc-123-def",
      "hostname": "PC-CAJA-01",
      "macAddress": "00:1B:44:11:3A:B7",
      "name": "Terminal Caja Principal",
      "status": "ACTIVE",
      "pointOfSale": {
        "id": "pos123",
        "code": "CAJA-01",
        "name": "Caja Principal",
        "branch": { "name": "Casa Central" }
      },
      "lastLoginUser": { "name": "María González" },
      "lastSeenAt": "2025-12-21T10:35:00Z",
      "isOnline": true
    }
  ],
  "stats": {
    "total": 5,
    "active": 3,
    "pending": 1,
    "disabled": 1,
    "blocked": 0,
    "online": 2
  }
}
```

**isOnline:** true si lastSeenAt < 10 minutos

### GET /api/terminals/:id

Obtener detalle de terminal.

### PATCH /api/terminals/:id

Actualizar terminal (activar, asignar POS, renombrar).

**Autenticación:** Bearer token + permiso `admin:terminals`

**Request:**
```json
{
  "name": "Terminal Caja Principal",
  "description": "PC Dell OptiPlex 3080",
  "status": "ACTIVE",
  "pointOfSaleId": "pos123"
}
```

**Validación:**
- Para activar (status=ACTIVE), debe tener pointOfSaleId asignado

### DELETE /api/terminals/:id

Eliminar terminal.

## Flujo de Registro de Terminal

```
1. Software POS se ejecuta en PC nueva
   ↓
2. Detecta MAC address y hostname
   ↓
3. POST /terminals/register
   {hostname, macAddress, osVersion}
   ↓
4. Backend:
   - Busca por MAC en tenant
   - No existe → Crear con status=PENDING
   - Retorna error TERMINAL_NOT_ACTIVE
   ↓
5. Software muestra: "Pendiente de activación"
   Usuario contacta al admin
   ↓
6. Admin en backoffice:
   - Ve terminal PENDING en lista
   - Asigna nombre, POS, sucursal
   - Cambia status a ACTIVE
   ↓
7. Software POS reintenta POST /terminals/register
   ↓
8. Backend:
   - Encuentra terminal por MAC
   - status=ACTIVE
   - Retorna datos del POS asignado
   ↓
9. Software POS inicia normalmente
   Muestra: "Caja Principal - Casa Central"
```

## Ejemplo: Activar Terminal

```typescript
// Activar terminal desde backoffice
await prisma.posTerminal.update({
  where: { id: terminalId },
  data: {
    name: 'Terminal Caja Principal',
    pointOfSaleId: pos.id,
    status: 'ACTIVE'
  }
});
```

## Documentación Relacionada

- [BRANCHES-SUCURSALES.md](./BRANCHES-SUCURSALES.md) - Sucursales y puntos de venta
