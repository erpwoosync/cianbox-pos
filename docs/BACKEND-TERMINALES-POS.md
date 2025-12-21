# Instrucciones Backend: Gestión de Terminales POS

## Resumen

Implementar sistema de registro y gestión de terminales POS (computadoras Windows donde se ejecuta el software de punto de venta).

---

## 1. Modelo de Datos (Prisma)

Agregar al `schema.prisma`:

```prisma
// ==============================================
// TERMINALES POS (PCs físicas con software POS)
// ==============================================

model PosTerminal {
  id              String            @id @default(cuid())
  tenantId        String

  // Identificación del hardware
  hostname        String            // Nombre de la PC (ej: "CAJA-01", "PC-VENTAS")
  macAddress      String            // MAC de la placa de red (ej: "00:1A:2B:3C:4D:5E")
  deviceId        String            @unique // UUID generado para identificar este terminal

  // Información adicional del dispositivo
  osVersion       String?           // "Windows 10 Pro", "Windows 11"
  appVersion      String?           // Versión del software POS instalado
  ipAddress       String?           // Última IP conocida

  // Nombre amigable (editable por admin)
  name            String?           // "Caja Principal", "Terminal Depósito"
  description     String?

  // Vinculación con Punto de Venta
  pointOfSaleId   String?           // Link al PointOfSale (sucursal + lista de precios)

  // Estado
  status          PosTerminalStatus @default(PENDING)

  // Tracking
  registeredAt    DateTime          @default(now()) // Primera vez que se registró
  lastSeenAt      DateTime          @default(now()) // Última conexión
  lastLoginUserId String?           // Último usuario que inició sesión

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  // Relaciones
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  pointOfSale PointOfSale? @relation(fields: [pointOfSaleId], references: [id])
  lastLoginUser User?      @relation("TerminalLastLogin", fields: [lastLoginUserId], references: [id])

  @@unique([tenantId, macAddress]) // Una MAC por tenant
  @@unique([tenantId, hostname])   // Un hostname por tenant
  @@index([tenantId, status])
  @@map("pos_terminals")
}

enum PosTerminalStatus {
  PENDING     // Registrado, pendiente de activación
  ACTIVE      // Activo, puede operar
  DISABLED    // Desactivado por admin
  BLOCKED     // Bloqueado (seguridad)
}
```

**Agregar relación en Tenant:**
```prisma
model Tenant {
  // ... campos existentes ...
  posTerminals      PosTerminal[]
}
```

**Agregar relación en PointOfSale:**
```prisma
model PointOfSale {
  // ... campos existentes ...
  terminals    PosTerminal[]
}
```

**Agregar relación en User:**
```prisma
model User {
  // ... campos existentes ...
  terminalLogins PosTerminal[] @relation("TerminalLastLogin")
}
```

---

## 2. Endpoints API

### 2.1 Registro de Terminal (usado por POS Desktop)

**POST `/api/pos/terminals/register`**

El POS desktop llama este endpoint al iniciar para registrarse o actualizarse.

**Headers:**
```
Authorization: Bearer {token}  // Token JWT del usuario
```

**Request Body:**
```json
{
  "hostname": "CAJA-01",
  "macAddress": "00:1A:2B:3C:4D:5E",
  "osVersion": "Windows 10 Pro 22H2",
  "appVersion": "1.0.0",
  "ipAddress": "192.168.1.100"
}
```

**Lógica:**
1. Buscar terminal existente por `tenantId + macAddress`
2. Si existe:
   - Actualizar `hostname`, `osVersion`, `appVersion`, `ipAddress`, `lastSeenAt`
   - Retornar terminal existente con su `deviceId`
3. Si no existe:
   - Crear nuevo terminal con `status: PENDING`
   - Generar `deviceId` único (UUID v4)
   - Retornar nuevo terminal

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "clxx...",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "hostname": "CAJA-01",
    "macAddress": "00:1A:2B:3C:4D:5E",
    "name": "Caja Principal",
    "status": "ACTIVE",
    "pointOfSale": {
      "id": "clxx...",
      "code": "CAJA-01",
      "name": "Caja Principal",
      "branch": {
        "id": "clxx...",
        "name": "Casa Central"
      },
      "priceList": {
        "id": "clxx...",
        "name": "Lista Minorista"
      }
    },
    "registeredAt": "2024-01-15T10:30:00Z",
    "lastSeenAt": "2024-12-21T15:45:00Z"
  },
  "isNewTerminal": false
}
```

**Response si terminal PENDING o DISABLED:**
```json
{
  "success": false,
  "error": {
    "code": "TERMINAL_NOT_ACTIVE",
    "message": "Terminal pendiente de activación. Contacte al administrador.",
    "status": "PENDING"
  }
}
```

---

### 2.2 Heartbeat (keep-alive)

**POST `/api/pos/terminals/heartbeat`**

El POS desktop llama periódicamente (cada 5 min) para indicar que está activo.

**Request Body:**
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "lastSeenAt": "2024-12-21T15:50:00Z"
}
```

---

### 2.3 Endpoints Backoffice

#### GET `/api/backoffice/terminals`

Lista todas las terminales del tenant.

**Query Parameters:**
- `status`: Filtrar por estado (PENDING, ACTIVE, DISABLED)
- `branchId`: Filtrar por sucursal (via pointOfSale)
- `search`: Buscar por hostname o nombre

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxx...",
      "deviceId": "550e8400-...",
      "hostname": "CAJA-01",
      "macAddress": "00:1A:2B:3C:4D:5E",
      "name": "Caja Principal",
      "status": "ACTIVE",
      "osVersion": "Windows 10 Pro",
      "appVersion": "1.0.0",
      "ipAddress": "192.168.1.100",
      "pointOfSale": {
        "id": "clxx...",
        "code": "CAJA-01",
        "name": "Caja Principal",
        "branch": { "id": "...", "name": "Casa Central" },
        "priceList": { "id": "...", "name": "Lista Minorista" }
      },
      "lastSeenAt": "2024-12-21T15:45:00Z",
      "isOnline": true  // lastSeenAt < 10 minutos
    }
  ],
  "stats": {
    "total": 5,
    "active": 3,
    "pending": 1,
    "disabled": 1,
    "online": 2
  }
}
```

---

#### GET `/api/backoffice/terminals/:id`

Detalle de una terminal.

---

#### PATCH `/api/backoffice/terminals/:id`

Actualizar terminal (activar, renombrar, vincular).

**Request Body:**
```json
{
  "name": "Caja Principal Planta Baja",
  "description": "Terminal de ventas principal",
  "status": "ACTIVE",
  "pointOfSaleId": "clxx..."
}
```

**Validaciones:**
- Solo admin puede cambiar `status`
- `pointOfSaleId` debe pertenecer al mismo tenant
- No se puede activar sin `pointOfSaleId` asignado

---

#### DELETE `/api/backoffice/terminals/:id`

Eliminar terminal (soft delete cambiando status a DISABLED, o hard delete).

---

## 3. Archivo de Rutas

Crear `src/routes/terminals.ts`:

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

// Rutas POS (usadas por el software desktop)
router.post('/register', authMiddleware, registerTerminal);
router.post('/heartbeat', authMiddleware, terminalHeartbeat);

// Rutas Backoffice
router.get('/', authMiddleware, requirePermission('admin:terminals'), listTerminals);
router.get('/:id', authMiddleware, requirePermission('admin:terminals'), getTerminal);
router.patch('/:id', authMiddleware, requirePermission('admin:terminals'), updateTerminal);
router.delete('/:id', authMiddleware, requirePermission('admin:terminals'), deleteTerminal);

export default router;
```

Registrar en `index.ts`:
```typescript
import terminalsRouter from './routes/terminals.js';
app.use('/api/pos/terminals', terminalsRouter);
app.use('/api/backoffice/terminals', terminalsRouter);
```

---

## 4. Permisos

Agregar permiso `admin:terminals` para gestión de terminales en backoffice.

---

## 5. Flujo de Activación

```
1. Usuario instala POS en PC nueva
2. Usuario inicia sesión con sus credenciales
3. POS detecta hostname + MAC y llama POST /register
4. Backend crea terminal con status=PENDING
5. POS muestra mensaje "Terminal pendiente de activación"
6. Admin entra a Backoffice > Terminales POS
7. Admin ve la nueva terminal (status PENDING)
8. Admin asigna un Punto de Venta y cambia status a ACTIVE
9. Usuario reinicia POS o espera próximo heartbeat
10. POS funciona normalmente
```

---

## 6. Consideraciones de Seguridad

1. **MAC Spoofing**: La MAC puede ser falsificada, pero es suficiente para identificación básica. Para mayor seguridad, considerar certificados de dispositivo.

2. **Rate Limiting**: Limitar intentos de registro por IP para evitar spam.

3. **Alertas**: Notificar al admin cuando se registra una terminal nueva.

4. **Auditoría**: Registrar en AuditLog cambios de estado de terminales.

---

## 7. Migración

```bash
npx prisma migrate dev --name add_pos_terminals
```
