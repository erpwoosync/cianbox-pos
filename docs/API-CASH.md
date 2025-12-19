# API - Gestión de Caja

Documentación de endpoints para gestión de turnos de caja, arqueos, movimientos y reportes.

## Descripción General

El sistema de caja permite:
- Abrir/cerrar turnos de cajeros
- Registrar movimientos de efectivo (ingresos/egresos)
- Realizar arqueos de efectivo con conteo detallado
- Transferir turnos entre cajeros (relevos)
- Suspender y reanudar turnos
- Generar reportes de caja

**Flujo típico:**
1. Cajero abre turno con monto inicial
2. Realiza ventas (se registran automáticamente)
3. Puede hacer movimientos (retiros a caja fuerte, gastos)
4. Puede hacer arqueos parciales
5. Al finalizar, cierra turno con arqueo final
6. Sistema calcula diferencias

## Índice

1. [Gestión de Turnos](#gestión-de-turnos)
2. [Movimientos de Efectivo](#movimientos-de-efectivo)
3. [Arqueos](#arqueos)
4. [Reportes](#reportes)
5. [Modelos de Datos](#modelos-de-datos)
6. [Flujos Completos](#flujos-completos)

---

## Gestión de Turnos

### GET /api/cash/current

Obtiene el turno actual del usuario autenticado.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta (con turno abierto):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session_123",
      "sessionNumber": "T-POS001-20251219-001",
      "status": "OPEN",
      "openingAmount": 10000.00,
      "openedAt": "2025-12-19T08:00:00Z",
      "openingNotes": "Turno mañana",
      "pointOfSale": {
        "id": "pos_001",
        "code": "POS001",
        "name": "Caja 1"
      },
      "branch": {
        "id": "branch_001",
        "name": "Sucursal Centro"
      },
      "user": {
        "id": "user_123",
        "name": "María González",
        "email": "maria@demo.com"
      },
      "movements": [
        {
          "id": "mov_001",
          "type": "WITHDRAWAL",
          "amount": 5000.00,
          "reason": "SAFE_DEPOSIT",
          "description": "Retiro a caja fuerte",
          "createdAt": "2025-12-19T12:00:00Z"
        }
      ],
      "counts": [],
      "_count": {
        "sales": 15,
        "movements": 2
      },
      "expectedCash": 45230.50
    },
    "hasOpenSession": true,
    "expectedCash": 45230.50
  }
}
```

**Respuesta (sin turno):**
```json
{
  "success": true,
  "data": {
    "session": null,
    "hasOpenSession": false,
    "expectedCash": 0
  }
}
```

---

### GET /api/cash/status/:posId

Obtiene el estado de caja de un punto de venta específico.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "pointOfSale": {
      "id": "pos_001",
      "code": "POS001",
      "name": "Caja 1"
    },
    "currentSession": {
      "id": "session_123",
      "sessionNumber": "T-POS001-20251219-001",
      "status": "OPEN",
      "user": {
        "id": "user_123",
        "name": "María González"
      }
    },
    "isOpen": true,
    "isSuspended": false,
    "isCounting": false
  }
}
```

---

### POST /api/cash/open

Abre un nuevo turno de caja.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:open`

**Body:**
```json
{
  "pointOfSaleId": "pos_001",
  "openingAmount": 10000.00,
  "notes": "Turno mañana - Fondo inicial"
}
```

**Validaciones:**
- No debe haber otro turno abierto en el mismo POS
- El usuario no debe tener otro turno abierto en otro POS
- `openingAmount` debe ser >= 0

**Respuesta:**
```json
{
  "success": true,
  "message": "Turno de caja abierto correctamente",
  "data": {
    "session": {
      "id": "session_123",
      "sessionNumber": "T-POS001-20251219-001",
      "status": "OPEN",
      "openingAmount": 10000.00,
      "openedAt": "2025-12-19T08:00:00Z",
      "openingNotes": "Turno mañana - Fondo inicial",
      "pointOfSale": { /* ... */ },
      "branch": { /* ... */ },
      "user": { /* ... */ }
    }
  }
}
```

**Formato del número de turno:**
```
T-{posCode}-{YYYYMMDD}-{NNN}

Ejemplo: T-POS001-20251219-001
```

**Errores:**
```json
// Ya hay un turno abierto en el POS
{
  "success": false,
  "statusCode": 400,
  "error": "Ya hay un turno abierto en este punto de venta"
}

// Usuario ya tiene un turno abierto
{
  "success": false,
  "statusCode": 400,
  "error": "Ya tienes un turno abierto en otro punto de venta"
}
```

---

### POST /api/cash/close

Cierra el turno actual del usuario.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:close`

**Body:**
```json
{
  "count": {
    "bills": {
      "10000": 5,
      "5000": 10,
      "2000": 20,
      "1000": 15,
      "500": 10,
      "200": 5,
      "100": 10
    },
    "coins": {
      "500": 0,
      "200": 2,
      "100": 5,
      "50": 10,
      "25": 4,
      "10": 20,
      "5": 10,
      "2": 5,
      "1": 10
    },
    "vouchers": 0,
    "checks": 0,
    "otherValues": 0,
    "otherValuesNote": null
  },
  "notes": "Cierre turno mañana - Todo OK"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Turno de caja cerrado correctamente",
  "data": {
    "session": {
      "id": "session_123",
      "status": "CLOSED",
      "closedAt": "2025-12-19T16:00:00Z",
      "closingAmount": 128650.00,
      "expectedAmount": 128230.50,
      "difference": 419.50,
      /* ... */
    },
    "summary": {
      "openingAmount": 10000.00,
      "closingAmount": 128650.00,
      "expectedAmount": 128230.50,
      "difference": 419.50,
      "differenceType": "SURPLUS",
      "totalCash": 85000.00,
      "totalDebit": 25000.00,
      "totalCredit": 18230.50,
      "salesCount": 45,
      "salesTotal": 128230.50,
      "withdrawalsTotal": 15000.00,
      "depositsTotal": 5000.00
    },
    "count": {
      "id": "count_123",
      "type": "CLOSING",
      "totalBills": 125000.00,
      "totalCoins": 3650.00,
      "totalCash": 128650.00,
      "expectedAmount": 128230.50,
      "difference": 419.50,
      "differenceType": "SURPLUS"
    }
  }
}
```

**Tipos de diferencia:**
- `SURPLUS` - Sobrante (diferencia > 0)
- `SHORTAGE` - Faltante (diferencia < 0)
- `null` - Sin diferencia (diferencia = 0)

**Cálculo del monto esperado:**
```
expectedCash = openingAmount
             + sumaVentasEfectivo
             - vueltos
             + depositsTotal
             - withdrawalsTotal
```

---

### POST /api/cash/suspend

Suspende temporalmente el turno actual.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:open`

**Respuesta:**
```json
{
  "success": true,
  "message": "Turno suspendido",
  "data": {
    "session": {
      "id": "session_123",
      "status": "SUSPENDED"
    }
  }
}
```

---

### POST /api/cash/resume

Reanuda un turno suspendido.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:open`

**Respuesta:**
```json
{
  "success": true,
  "message": "Turno reanudado",
  "data": {
    "session": {
      "id": "session_123",
      "status": "OPEN"
    }
  }
}
```

---

### POST /api/cash/transfer

Relevo de turno a otro cajero.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:close`

**Body:**
```json
{
  "toUserId": "user_456",
  "transferAmount": 50000.00,
  "count": {
    "bills": { /* ... */ },
    "coins": { /* ... */ }
  },
  "notes": "Relevo turno tarde"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Relevo de turno completado",
  "data": {
    "closedSession": {
      "id": "session_123",
      "status": "TRANSFERRED",
      "transferAmount": 50000.00
    },
    "newSession": {
      "id": "session_456",
      "sessionNumber": "T-POS001-20251219-002",
      "status": "OPEN",
      "openingAmount": 50000.00,
      "previousSessionId": "session_123",
      "openingNotes": "Relevo de María González"
    }
  }
}
```

**Proceso:**
1. Cierra turno actual con status `TRANSFERRED`
2. Crea movimiento `TRANSFER_OUT` en turno saliente
3. Crea nuevo turno para cajero entrante
4. Crea movimiento `TRANSFER_IN` en turno entrante

---

## Movimientos de Efectivo

### POST /api/cash/deposit

Registra un ingreso de efectivo.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:deposit`

**Body:**
```json
{
  "amount": 5000.00,
  "reason": "SAFE_DEPOSIT",
  "description": "Retorno de caja fuerte",
  "reference": "CF-001"
}
```

**Tipos de movimiento (ingreso):**
- `DEPOSIT` - Ingreso genérico
- `ADJUSTMENT_IN` - Ajuste positivo
- `CHANGE_FUND` - Fondo de cambio
- `TRANSFER_IN` - Transferencia entrante

**Razones:**
- `SAFE_DEPOSIT` - Depósito desde/hacia caja fuerte
- `BANK_DEPOSIT` - Depósito bancario
- `INITIAL_FUND` - Fondo inicial
- `LOAN_RETURN` - Devolución de préstamo
- `CORRECTION` - Corrección
- `OTHER` - Otro

**Respuesta:**
```json
{
  "success": true,
  "message": "Ingreso registrado",
  "data": {
    "movement": {
      "id": "mov_123",
      "type": "DEPOSIT",
      "amount": 5000.00,
      "reason": "SAFE_DEPOSIT",
      "description": "Retorno de caja fuerte",
      "reference": "CF-001",
      "createdAt": "2025-12-19T14:00:00Z"
    }
  }
}
```

---

### POST /api/cash/withdraw

Registra un retiro de efectivo.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:withdraw`

**Body:**
```json
{
  "amount": 10000.00,
  "reason": "SAFE_DEPOSIT",
  "description": "Retiro a caja fuerte",
  "reference": "CF-002",
  "destinationType": "SAFE"
}
```

**Tipos de movimiento (egreso):**
- `WITHDRAWAL` - Retiro genérico
- `ADJUSTMENT_OUT` - Ajuste negativo
- `TRANSFER_OUT` - Transferencia saliente

**Razones:**
- `SAFE_DEPOSIT` - A caja fuerte
- `BANK_DEPOSIT` - Depósito en banco
- `SUPPLIER_PAYMENT` - Pago a proveedor
- `EXPENSE` - Gasto
- `CHANGE_FUND` - Fondo de cambio
- `CORRECTION` - Corrección
- `OTHER` - Otro

**Validación:** El monto a retirar no puede ser mayor al efectivo disponible.

**Respuesta:**
```json
{
  "success": true,
  "message": "Retiro registrado",
  "movement": {
    "id": "mov_124",
    "type": "WITHDRAWAL",
    "amount": 10000.00,
    "reason": "SAFE_DEPOSIT",
    "destinationType": "SAFE"
  }
}
```

**Error:**
```json
{
  "success": false,
  "statusCode": 400,
  "error": "No hay suficiente efectivo. Disponible: $8230.50"
}
```

---

### GET /api/cash/movements

Lista movimientos del turno actual.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "movements": [
      {
        "id": "mov_123",
        "type": "DEPOSIT",
        "amount": 5000.00,
        "reason": "SAFE_DEPOSIT",
        "description": "Retorno de caja fuerte",
        "createdAt": "2025-12-19T14:00:00Z",
        "createdBy": {
          "id": "user_123",
          "name": "María González"
        }
      }
    ],
    "sessionId": "session_123"
  }
}
```

---

### GET /api/cash/movements/:sessionId

Lista movimientos de un turno específico.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:view_all`

---

## Arqueos

### POST /api/cash/count

Registra un arqueo de efectivo.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:count`

**Body:**
```json
{
  "type": "PARTIAL",
  "bills": {
    "10000": 3,
    "5000": 8,
    "2000": 10,
    "1000": 12,
    "500": 5,
    "200": 10,
    "100": 15
  },
  "coins": {
    "500": 0,
    "200": 5,
    "100": 10,
    "50": 8,
    "25": 6,
    "10": 15,
    "5": 12,
    "2": 8,
    "1": 10
  },
  "vouchers": 0,
  "checks": 0,
  "otherValues": 0,
  "notes": "Arqueo de mediodía"
}
```

**Tipos de arqueo:**
- `OPENING` - Apertura
- `PARTIAL` - Parcial
- `CLOSING` - Cierre
- `AUDIT` - Auditoría
- `TRANSFER` - Transferencia

**Respuesta:**
```json
{
  "success": true,
  "message": "Arqueo registrado",
  "count": {
    "id": "count_123",
    "type": "PARTIAL",
    "totalBills": 85000.00,
    "totalCoins": 3567.00,
    "totalCash": 88567.00,
    "expectedAmount": 88230.50,
    "difference": 336.50,
    "differenceType": "SURPLUS",
    "countedAt": "2025-12-19T13:00:00Z"
  },
  "summary": {
    "totalBills": 85000.00,
    "totalCoins": 3567.00,
    "totalCash": 88567.00,
    "vouchers": 0,
    "checks": 0,
    "otherValues": 0,
    "totalWithOthers": 88567.00,
    "expectedAmount": 88230.50,
    "difference": 336.50,
    "differenceType": "SURPLUS"
  }
}
```

**Cálculo de totales:**
```
totalBills = sum(cantidad * denominación) para cada billete
totalCoins = sum(cantidad * denominación) para cada moneda
totalCash = totalBills + totalCoins
totalWithOthers = totalCash + vouchers + checks + otherValues
difference = totalWithOthers - expectedAmount
```

---

### GET /api/cash/counts/:sessionId

Ver arqueos de un turno.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "counts": [
      {
        "id": "count_123",
        "type": "PARTIAL",
        "totalCash": 88567.00,
        "expectedAmount": 88230.50,
        "difference": 336.50,
        "differenceType": "SURPLUS",
        "countedAt": "2025-12-19T13:00:00Z",
        "countedBy": {
          "id": "user_123",
          "name": "María González"
        }
      }
    ],
    "session": { /* ... */ }
  }
}
```

---

## Reportes

### GET /api/cash/report/session/:id

Reporte completo de un turno.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session_123",
      "sessionNumber": "T-POS001-20251219-001",
      "status": "CLOSED",
      "openedAt": "2025-12-19T08:00:00Z",
      "closedAt": "2025-12-19T16:00:00Z",
      "openingAmount": 10000.00,
      "closingAmount": 128650.00,
      "expectedAmount": 128230.50,
      "difference": 419.50,
      "totalCash": 85000.00,
      "totalDebit": 25000.00,
      "totalCredit": 18230.50,
      "salesCount": 45,
      "salesTotal": 128230.50,
      "movements": [
        {
          "id": "mov_001",
          "type": "WITHDRAWAL",
          "amount": 15000.00,
          "reason": "SAFE_DEPOSIT",
          "createdAt": "2025-12-19T12:00:00Z",
          "createdBy": { /* ... */ }
        }
      ],
      "counts": [
        {
          "id": "count_123",
          "type": "CLOSING",
          "totalCash": 128650.00,
          "difference": 419.50,
          "countedAt": "2025-12-19T16:00:00Z"
        }
      ],
      "sales": [
        {
          "id": "sale_001",
          "saleNumber": "SUC001-POS001-20251219-0001",
          "total": 2850.00,
          "status": "COMPLETED",
          "payments": [ /* ... */ ]
        }
      ]
    }
  }
}
```

---

### GET /api/cash/report/daily

Reporte diario de todas las cajas.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:report_all`

**Query Params:**
- `date` - Fecha (default: hoy)
- `branchId` - Filtrar por sucursal (opcional)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "date": "2025-12-19",
    "sessions": [
      {
        "id": "session_123",
        "sessionNumber": "T-POS001-20251219-001",
        "status": "CLOSED",
        "pointOfSale": { /* ... */ },
        "branch": { /* ... */ },
        "user": { /* ... */ },
        "_count": {
          "sales": 45,
          "movements": 5
        }
      }
    ],
    "summary": {
      "totalSessions": 3,
      "openSessions": 1,
      "closedSessions": 2,
      "totalSales": 128,
      "totalCash": 255000.00,
      "totalDebit": 75000.00,
      "totalCredit": 54690.00,
      "totalWithdrawals": 45000.00,
      "totalDeposits": 15000.00
    }
  }
}
```

---

### GET /api/cash/sessions

Lista sesiones con filtros y paginación.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `cash:view_all`

**Query Params:**
- `branchId`
- `pointOfSaleId`
- `userId`
- `status`
- `dateFrom`
- `dateTo`
- `page` (default: 1)
- `pageSize` (default: 20)

---

## Modelos de Datos

### CashSession

```typescript
interface CashSession {
  id: string;
  tenantId: string;
  branchId: string;
  pointOfSaleId: string;
  userId: string;
  sessionNumber: string;
  status: 'OPEN' | 'SUSPENDED' | 'COUNTING' | 'CLOSED' | 'TRANSFERRED';
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: Date;
  closedAt?: Date;
  openedByUserId: string;
  closedByUserId?: string;
  openingNotes?: string;
  closingNotes?: string;

  // Totales por método de pago
  totalCash: number;
  totalDebit: number;
  totalCredit: number;
  totalQr: number;
  totalMpPoint: number;
  totalTransfer: number;
  totalOther: number;

  // Resumen de ventas
  salesCount: number;
  salesTotal: number;
  refundsCount: number;
  refundsTotal: number;
  cancelsCount: number;

  // Movimientos
  withdrawalsTotal: number;
  depositsTotal: number;

  // Transferencia
  previousSessionId?: string;
  transferAmount?: number;
}
```

### CashMovement

```typescript
interface CashMovement {
  id: string;
  cashSessionId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'CHANGE_FUND';
  amount: number;
  reason: 'SAFE_DEPOSIT' | 'BANK_DEPOSIT' | 'SUPPLIER_PAYMENT' | 'EXPENSE' | 'CHANGE_FUND' | 'INITIAL_FUND' | 'LOAN_RETURN' | 'CORRECTION' | 'COUNT_DIFFERENCE' | 'SHIFT_TRANSFER' | 'OTHER';
  description?: string;
  reference?: string;
  destinationType?: string;
  createdByUserId: string;
  authorizedByUserId?: string;
  createdAt: Date;
}
```

### CashCount

```typescript
interface CashCount {
  id: string;
  cashSessionId: string;
  type: 'OPENING' | 'PARTIAL' | 'CLOSING' | 'AUDIT' | 'TRANSFER';

  // Billetes (cantidad)
  bills_10000: number;
  bills_5000: number;
  bills_2000: number;
  // ... resto de denominaciones

  // Monedas (cantidad)
  coins_500: number;
  coins_200: number;
  // ... resto de denominaciones

  // Totales
  totalBills: number;
  totalCoins: number;
  totalCash: number;

  // Otros valores
  vouchers: number;
  checks: number;
  otherValues: number;
  otherValuesNote?: string;

  // Diferencia
  expectedAmount: number;
  difference: number;
  differenceType?: 'SURPLUS' | 'SHORTAGE';

  notes?: string;
  countedAt: Date;
  countedByUserId: string;
  verifiedByUserId?: string;
}
```

---

## Flujos Completos

### Flujo Normal de Turno

```
1. Cajero llega
   └─> POST /api/cash/open
       {
         pointOfSaleId: "pos_001",
         openingAmount: 10000.00
       }

2. Durante el turno
   ├─> Realiza ventas (automático vía POST /api/sales)
   ├─> Retira efectivo a caja fuerte:
   │   POST /api/cash/withdraw { amount: 15000, reason: "SAFE_DEPOSIT" }
   └─> Hace arqueo parcial:
       POST /api/cash/count { type: "PARTIAL", bills: {...}, coins: {...} }

3. Fin del turno
   └─> POST /api/cash/close
       {
         count: { bills: {...}, coins: {...} },
         notes: "Cierre turno mañana"
       }
       └─> Backend:
           ├─> Calcula expectedAmount
           ├─> Calcula diferencia con arqueo
           ├─> Cierra sesión
           └─> Devuelve resumen completo
```

### Flujo de Relevo

```
1. Cajero saliente
   └─> POST /api/cash/transfer
       {
         toUserId: "user_456",
         transferAmount: 50000.00,
         count: { bills: {...}, coins: {...} }
       }

2. Backend
   ├─> Cierra turno actual (TRANSFERRED)
   ├─> Crea movimiento TRANSFER_OUT
   ├─> Crea nuevo turno para cajero entrante
   ├─> Crea movimiento TRANSFER_IN
   └─> Devuelve ambas sesiones

3. Cajero entrante
   └─> Puede continuar usando GET /api/cash/current
```

---

**Ver también:**
- [API - Ventas](./API-SALES.md)
- [API - Autenticación](./API-AUTH.md)
