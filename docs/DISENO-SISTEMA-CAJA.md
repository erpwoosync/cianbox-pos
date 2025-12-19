# Sistema de Manejo de Caja - Cianbox POS

## Resumen Ejecutivo

Sistema de gestión de turnos de caja inspirado en supermercados y kioscos, donde los cajeros trabajan en turnos de 4-8 horas y pueden haber cambios de turno durante el día.

---

## Conceptos Clave

### Caja Física vs Turno de Caja

| Concepto | Modelo | Descripcion |
|----------|--------|-------------|
| **Caja Física** | `PointOfSale` | El terminal/caja física (CAJA-01, CAJA-02) |
| **Turno de Caja** | `CashSession` | Período donde un cajero opera la caja |
| **Movimiento** | `CashMovement` | Retiros, depósitos, ajustes |
| **Arqueo** | `CashCount` | Conteo de dinero (parcial o final) |

### Flujo de Operación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CICLO DE VIDA DE CAJA                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  ABRIR   │───►│  OPERAR  │───►│  ARQUEO  │───►│  CERRAR  │              │
│  │  TURNO   │    │  (ventas)│    │  PARCIAL │    │  TURNO   │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │               │               │               │                     │
│       ▼               ▼               ▼               ▼                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Fondo    │    │ +Ventas  │    │ Verificar│    │ Arqueo   │              │
│  │ inicial  │    │ +Retiros │    │ saldos   │    │ final    │              │
│  │ $X       │    │ +Ingresos│    │          │    │ Cierre   │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                        CAMBIO DE TURNO (RELEVO)                            │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │ Cajero A │───►│  RELEVO  │───►│ Cajero B │                              │
│  │ cierra   │    │ Arqueo + │    │ abre     │                              │
│  │ su turno │    │ Transfer │    │ su turno │                              │
│  └──────────┘    └──────────┘    └──────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modelo de Datos Propuesto

### CashSession (Turno de Caja) - NUEVO

Reemplaza/mejora el actual `CashRegister`.

```prisma
// Turno de caja (sesión de un cajero en una caja)
model CashSession {
  id               String            @id @default(cuid())
  tenantId         String
  branchId         String
  pointOfSaleId    String
  userId           String            // Cajero del turno
  sessionNumber    String            // "T-001-20241219-001"

  // === APERTURA ===
  openingAmount    Decimal           @db.Decimal(12, 2)  // Fondo inicial
  openedAt         DateTime          @default(now())
  openedByUserId   String            // Quien autorizó apertura
  openingNotes     String?

  // === CIERRE ===
  closingAmount    Decimal?          @db.Decimal(12, 2)  // Efectivo contado
  expectedAmount   Decimal?          @db.Decimal(12, 2)  // Monto esperado (calculado)
  difference       Decimal?          @db.Decimal(12, 2)  // Diferencia
  closedAt         DateTime?
  closedByUserId   String?           // Quien autorizó cierre
  closingNotes     String?

  // === TOTALES POR MÉTODO (calculados al cierre) ===
  totalCash        Decimal           @default(0) @db.Decimal(12, 2)
  totalDebit       Decimal           @default(0) @db.Decimal(12, 2)
  totalCredit      Decimal           @default(0) @db.Decimal(12, 2)
  totalQr          Decimal           @default(0) @db.Decimal(12, 2)
  totalMpPoint     Decimal           @default(0) @db.Decimal(12, 2)
  totalTransfer    Decimal           @default(0) @db.Decimal(12, 2)
  totalOther       Decimal           @default(0) @db.Decimal(12, 2)

  // === CONTADORES ===
  salesCount       Int               @default(0)       // Cantidad de ventas
  salesTotal       Decimal           @default(0) @db.Decimal(12, 2)
  refundsCount     Int               @default(0)       // Cantidad de devoluciones
  refundsTotal     Decimal           @default(0) @db.Decimal(12, 2)
  cancelsCount     Int               @default(0)       // Cantidad de anulaciones

  // === MOVIMIENTOS RESUMEN ===
  withdrawalsTotal Decimal           @default(0) @db.Decimal(12, 2) // Total retiros
  depositsTotal    Decimal           @default(0) @db.Decimal(12, 2) // Total ingresos

  // === ESTADO ===
  status           CashSessionStatus @default(OPEN)

  // === RELEVO (cambio de turno) ===
  previousSessionId String?          // Sesión anterior (si es relevo)
  transferAmount    Decimal?         @db.Decimal(12, 2) // Monto transferido del turno anterior

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  // Relaciones
  tenant           Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch           Branch            @relation(fields: [branchId], references: [id])
  pointOfSale      PointOfSale       @relation(fields: [pointOfSaleId], references: [id])
  user             User              @relation("CashSessionUser", fields: [userId], references: [id])
  openedBy         User              @relation("CashSessionOpenedBy", fields: [openedByUserId], references: [id])
  closedBy         User?             @relation("CashSessionClosedBy", fields: [closedByUserId], references: [id])
  previousSession  CashSession?      @relation("CashSessionRelay", fields: [previousSessionId], references: [id])
  nextSession      CashSession?      @relation("CashSessionRelay")

  movements        CashMovement[]
  counts           CashCount[]
  sales            Sale[]

  @@unique([tenantId, sessionNumber])
  @@index([tenantId, branchId, openedAt])
  @@index([pointOfSaleId, status])
  @@index([userId, openedAt])
  @@map("cash_sessions")
}

enum CashSessionStatus {
  OPEN          // Turno abierto, operando
  SUSPENDED     // Suspendido temporalmente (ej: almuerzo)
  COUNTING      // En proceso de arqueo/cierre
  CLOSED        // Cerrado
  TRANSFERRED   // Cerrado por relevo a otro cajero
}
```

### CashMovement (Movimientos) - MEJORADO

```prisma
// Movimientos de caja (retiros, depósitos, ajustes)
model CashMovement {
  id               String              @id @default(cuid())
  cashSessionId    String
  type             CashMovementType
  amount           Decimal             @db.Decimal(12, 2)

  // Detalle
  reason           CashMovementReason  // Razón predefinida
  description      String?             // Descripción adicional
  reference        String?             // Referencia externa

  // Autorización (para retiros grandes)
  authorizedByUserId String?           // Supervisor que autorizó
  requiresAuth     Boolean             @default(false)

  // Para retiros a caja fuerte
  destinationType  String?             // "SAFE", "BANK", "OTHER"

  // Auditoría
  createdByUserId  String              // Quien registró el movimiento
  createdAt        DateTime            @default(now())

  // Relaciones
  cashSession      CashSession         @relation(fields: [cashSessionId], references: [id], onDelete: Cascade)
  authorizedBy     User?               @relation("MovementAuthorizedBy", fields: [authorizedByUserId], references: [id])
  createdBy        User                @relation("MovementCreatedBy", fields: [createdByUserId], references: [id])

  @@index([cashSessionId])
  @@index([createdAt])
  @@map("cash_movements")
}

enum CashMovementType {
  DEPOSIT         // Ingreso de efectivo
  WITHDRAWAL      // Retiro de efectivo
  ADJUSTMENT_IN   // Ajuste positivo
  ADJUSTMENT_OUT  // Ajuste negativo
  TRANSFER_IN     // Recibido de otro turno
  TRANSFER_OUT    // Transferido a otro turno
  CHANGE_FUND     // Fondo para cambio adicional
}

enum CashMovementReason {
  // Retiros
  SAFE_DEPOSIT    // Depósito a caja fuerte
  BANK_DEPOSIT    // Depósito bancario
  SUPPLIER_PAYMENT // Pago a proveedor
  EXPENSE         // Gasto menor

  // Ingresos
  CHANGE_FUND     // Fondo para cambio
  INITIAL_FUND    // Fondo inicial
  LOAN_RETURN     // Devolución de préstamo

  // Ajustes
  CORRECTION      // Corrección de error
  COUNT_DIFFERENCE // Diferencia de arqueo

  // Transferencias
  SHIFT_TRANSFER  // Transferencia de turno

  OTHER           // Otro
}
```

### CashCount (Arqueo) - NUEVO

```prisma
// Arqueo de caja (conteo de dinero)
model CashCount {
  id              String          @id @default(cuid())
  cashSessionId   String
  type            CashCountType   @default(PARTIAL)

  // === CONTEO POR DENOMINACIÓN (Pesos Argentinos) ===
  // Billetes
  bills_10000     Int             @default(0)   // Billetes de $10,000
  bills_5000      Int             @default(0)   // Billetes de $5,000 (nuevo)
  bills_2000      Int             @default(0)   // Billetes de $2,000
  bills_1000      Int             @default(0)   // Billetes de $1,000
  bills_500       Int             @default(0)   // Billetes de $500
  bills_200       Int             @default(0)   // Billetes de $200
  bills_100       Int             @default(0)   // Billetes de $100
  bills_50        Int             @default(0)   // Billetes de $50
  bills_20        Int             @default(0)   // Billetes de $20
  bills_10        Int             @default(0)   // Billetes de $10

  // Monedas
  coins_500       Int             @default(0)   // Monedas de $500 (nuevo)
  coins_200       Int             @default(0)   // Monedas de $200 (nuevo)
  coins_100       Int             @default(0)   // Monedas de $100 (nuevo)
  coins_50        Int             @default(0)   // Monedas de $50
  coins_25        Int             @default(0)   // Monedas de $25
  coins_10        Int             @default(0)   // Monedas de $10
  coins_5         Int             @default(0)   // Monedas de $5
  coins_2         Int             @default(0)   // Monedas de $2
  coins_1         Int             @default(0)   // Monedas de $1

  // === TOTALES CALCULADOS ===
  totalBills      Decimal         @db.Decimal(12, 2)  // Total en billetes
  totalCoins      Decimal         @db.Decimal(12, 2)  // Total en monedas
  totalCash       Decimal         @db.Decimal(12, 2)  // Total efectivo contado

  // === COMPARACIÓN ===
  expectedAmount  Decimal         @db.Decimal(12, 2)  // Monto esperado (sistema)
  difference      Decimal         @db.Decimal(12, 2)  // Diferencia
  differenceType  DifferenceType? // SURPLUS (sobrante) o SHORTAGE (faltante)

  // === OTROS VALORES EN CAJA ===
  vouchers        Decimal         @default(0) @db.Decimal(12, 2) // Vales
  checks          Decimal         @default(0) @db.Decimal(12, 2) // Cheques
  otherValues     Decimal         @default(0) @db.Decimal(12, 2) // Otros valores
  otherValuesNote String?         // Descripción de otros valores

  // Observaciones
  notes           String?

  // Auditoría
  countedByUserId String          // Quien hizo el conteo
  verifiedByUserId String?        // Supervisor que verificó
  countedAt       DateTime        @default(now())

  // Relaciones
  cashSession     CashSession     @relation(fields: [cashSessionId], references: [id], onDelete: Cascade)
  countedBy       User            @relation("CashCountCountedBy", fields: [countedByUserId], references: [id])
  verifiedBy      User?           @relation("CashCountVerifiedBy", fields: [verifiedByUserId], references: [id])

  @@index([cashSessionId])
  @@map("cash_counts")
}

enum CashCountType {
  OPENING         // Arqueo de apertura
  PARTIAL         // Arqueo parcial (verificación)
  CLOSING         // Arqueo de cierre
  AUDIT           // Arqueo de auditoría
  TRANSFER        // Arqueo para relevo
}

enum DifferenceType {
  SURPLUS         // Sobrante
  SHORTAGE        // Faltante
}
```

### Actualización de Sale

```prisma
model Sale {
  // ... campos existentes ...

  // NUEVO: Asociar venta al turno de caja
  cashSessionId   String?         // Turno de caja activo

  // Relaciones
  cashSession     CashSession?    @relation(fields: [cashSessionId], references: [id])
}
```

---

## Permisos del Sistema

```typescript
const CASH_PERMISSIONS = {
  // Operaciones básicas
  'cash:open': 'Abrir turno de caja',
  'cash:close': 'Cerrar turno de caja',
  'cash:close_other': 'Cerrar turno de otro cajero',

  // Movimientos
  'cash:deposit': 'Registrar ingreso de efectivo',
  'cash:withdraw': 'Registrar retiro de efectivo',
  'cash:withdraw_large': 'Retiros grandes (>$50,000)',
  'cash:adjust': 'Realizar ajustes de caja',

  // Arqueos
  'cash:count': 'Realizar arqueo',
  'cash:count_verify': 'Verificar arqueos de otros',

  // Supervisión
  'cash:view_all': 'Ver todas las cajas',
  'cash:suspend': 'Suspender turno de caja',
  'cash:override': 'Autorizar operaciones especiales',

  // Reportes
  'cash:report_own': 'Ver reporte de su turno',
  'cash:report_all': 'Ver reportes de todos los turnos',
  'cash:export': 'Exportar reportes de caja',
};
```

---

## API Endpoints

### Gestión de Turnos

```
POST   /api/cash/open                    # Abrir turno
POST   /api/cash/close                   # Cerrar turno actual
POST   /api/cash/close/:sessionId        # Cerrar turno específico (supervisor)
POST   /api/cash/suspend                 # Suspender turno
POST   /api/cash/resume                  # Reanudar turno suspendido
POST   /api/cash/transfer                # Relevo de turno
GET    /api/cash/current                 # Obtener turno actual del usuario
GET    /api/cash/status/:posId           # Estado de caja por punto de venta
```

### Movimientos

```
POST   /api/cash/deposit                 # Registrar ingreso
POST   /api/cash/withdraw                # Registrar retiro
POST   /api/cash/adjust                  # Registrar ajuste
GET    /api/cash/movements               # Listar movimientos del turno
GET    /api/cash/movements/:sessionId    # Movimientos de un turno específico
```

### Arqueos

```
POST   /api/cash/count                   # Registrar arqueo
GET    /api/cash/counts/:sessionId       # Ver arqueos de un turno
POST   /api/cash/count/:countId/verify   # Verificar arqueo (supervisor)
```

### Reportes

```
GET    /api/cash/report/session/:id      # Reporte de un turno
GET    /api/cash/report/daily            # Reporte diario
GET    /api/cash/report/pos/:posId       # Reporte por punto de venta
GET    /api/cash/report/user/:userId     # Reporte por cajero
```

---

## Flujos de Operación

### 1. Apertura de Turno

```typescript
// POST /api/cash/open
{
  "pointOfSaleId": "pos_123",
  "openingAmount": 10000.00,    // Fondo inicial
  "notes": "Turno mañana"
}

// Validaciones:
// - No hay otro turno abierto en esa caja
// - Usuario tiene permiso 'cash:open'
// - Si hay turno anterior cerrado, puede tomar el saldo como fondo
```

### 2. Retiro de Efectivo

```typescript
// POST /api/cash/withdraw
{
  "amount": 50000.00,
  "reason": "SAFE_DEPOSIT",
  "description": "Depósito a caja fuerte"
}

// Validaciones:
// - Turno activo
// - Hay suficiente efectivo
// - Si amount > $50,000, requiere autorización (permission: 'cash:withdraw_large')
```

### 3. Arqueo Parcial

```typescript
// POST /api/cash/count
{
  "type": "PARTIAL",
  "bills": {
    "10000": 5,
    "5000": 3,
    "2000": 10,
    // ...
  },
  "coins": {
    "500": 2,
    "100": 15,
    // ...
  },
  "vouchers": 0,
  "checks": 0,
  "notes": "Verificación de mediodía"
}

// El sistema calcula:
// - totalBills, totalCoins, totalCash
// - expectedAmount (basado en ventas + fondo - retiros + ingresos)
// - difference
```

### 4. Cierre de Turno

```typescript
// POST /api/cash/close
{
  "count": {
    "bills": { ... },
    "coins": { ... },
    "vouchers": 0,
    "checks": 0
  },
  "notes": "Cierre sin novedad"
}

// El sistema:
// 1. Realiza arqueo final (CashCount type: CLOSING)
// 2. Calcula totales por método de pago
// 3. Calcula diferencia
// 4. Cierra el turno
// 5. Genera reporte
```

### 5. Relevo de Turno

```typescript
// POST /api/cash/transfer
{
  "toUserId": "user_456",         // Nuevo cajero
  "transferAmount": 15000.00,     // Efectivo que se transfiere
  "count": {
    "bills": { ... },
    "coins": { ... }
  },
  "notes": "Relevo turno tarde"
}

// El sistema:
// 1. Cierra turno actual con estado TRANSFERRED
// 2. Abre nuevo turno para el cajero entrante
// 3. El fondo del nuevo turno = transferAmount
// 4. Registra movimientos TRANSFER_OUT y TRANSFER_IN
```

---

## Reglas de Negocio

### Apertura

1. Solo puede haber **un turno abierto por caja** a la vez
2. Un cajero solo puede tener **un turno abierto** a la vez
3. El fondo inicial debe ser **> 0** (configurable)
4. Si hay diferencia del cierre anterior, **notificar al abrir**

### Durante el Turno

1. Todas las ventas se asocian al **turno activo**
2. No se pueden hacer ventas si **no hay turno abierto**
3. Los retiros no pueden superar el **efectivo disponible**
4. Retiros > umbral requieren **autorización de supervisor**

### Cierre

1. Debe hacerse un **arqueo obligatorio**
2. Las diferencias se registran pero **no bloquean el cierre**
3. Diferencias > umbral pueden requerir **autorización**
4. Se genera **reporte automático**

### Relevo

1. Se hace arqueo del turno saliente
2. El cajero entrante **verifica el monto recibido**
3. Ambos cajeros deben **confirmar** el relevo
4. Se mantiene **trazabilidad completa**

---

## Configuraciones por Tenant

```typescript
interface CashSettings {
  // Montos
  defaultOpeningAmount: number;      // Fondo sugerido
  minOpeningAmount: number;          // Fondo mínimo
  withdrawalAuthThreshold: number;   // Umbral para requerir autorización

  // Arqueos
  requireOpeningCount: boolean;      // Arqueo obligatorio al abrir
  requireClosingCount: boolean;      // Arqueo obligatorio al cerrar
  partialCountReminder: number;      // Recordar arqueo cada X horas

  // Diferencias
  acceptableDifferenceAmount: number; // Diferencia aceptable sin alerta
  maxDifferenceWithoutAuth: number;   // Diferencia máxima sin autorización

  // Turnos
  maxSessionDuration: number;        // Duración máxima de turno (horas)
  allowMultipleSessions: boolean;    // Permitir múltiples turnos por día
  requireSupervisorClose: boolean;   // Requiere supervisor para cerrar

  // Denominaciones activas (para países diferentes)
  activeBills: number[];             // [10000, 5000, 2000, 1000, ...]
  activeCoins: number[];             // [500, 200, 100, 50, ...]
}
```

---

## Interfaz de Usuario

### Panel de Caja (Cajero)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🟢 CAJA ABIERTA                                     CAJA-01        │
│  Cajero: Juan Pérez                     Inicio: 19/12/2024 08:00   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │   EFECTIVO    │  │    VENTAS     │  │   TARJETAS    │           │
│  │   $125,430    │  │     47        │  │   $89,200     │           │
│  │   esperado    │  │   realizadas  │  │   crédito     │           │
│  └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ACCIONES RÁPIDAS                         │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  [💰 Retiro]  [📥 Ingreso]  [📊 Arqueo]  [🔒 Cerrar Turno] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Últimos movimientos:                                              │
│  ─────────────────────────────────────────────────────────────     │
│  10:30  Retiro        -$20,000   Depósito caja fuerte              │
│  09:15  Venta #47     +$3,450    Efectivo                          │
│  09:10  Venta #46     +$8,900    Tarjeta débito                    │
│  08:00  Apertura      +$10,000   Fondo inicial                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Modal de Arqueo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARQUEO DE CAJA                               │
├─────────────────────────────────────────────────────────────────────┤
│  BILLETES                              MONEDAS                      │
│  ─────────────                         ───────────                  │
│  $10,000  [  5  ] = $50,000            $500   [  2 ] = $1,000      │
│  $5,000   [  3  ] = $15,000            $200   [  5 ] = $1,000      │
│  $2,000   [ 10  ] = $20,000            $100   [ 15 ] = $1,500      │
│  $1,000   [  8  ] = $8,000             $50    [ 10 ] = $500        │
│  $500     [  4  ] = $2,000             $10    [ 20 ] = $200        │
│  $200     [  5  ] = $1,000             $5     [ 10 ] = $50         │
│  $100     [ 10  ] = $1,000             $1     [ 30 ] = $30         │
│  ─────────────────────────             ─────────────────────       │
│  Total billetes: $97,000               Total monedas: $4,280       │
│                                                                     │
│  ══════════════════════════════════════════════════════════════    │
│                                                                     │
│  RESUMEN                                                           │
│  ────────────────────────────────────────────────────────────      │
│  Total contado:    $101,280                                        │
│  Esperado:         $101,430                                        │
│  ─────────────────────────                                         │
│  Diferencia:          -$150  ⚠️ FALTANTE                           │
│                                                                     │
│  Observaciones: [________________________________]                  │
│                                                                     │
│  [Cancelar]                              [✓ Confirmar Arqueo]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Próximos Pasos

1. **Migración de DB**: Crear nuevos modelos y migrar datos existentes
2. **Backend**: Implementar endpoints y lógica de negocio
3. **Frontend POS**: Integrar apertura/cierre de caja antes de vender
4. **Backoffice**: Panel de supervisión de cajas
5. **Reportes**: Reportes de caja por turno, día, cajero

---

## Preguntas para Definir

1. ¿Qué denominaciones de billetes/monedas usar? (Argentina actual)
2. ¿Umbral para requerir autorización de retiros? ($50,000 sugerido)
3. ¿Diferencia aceptable sin alerta? ($500 sugerido)
4. ¿El cajero puede cerrar su propio turno o requiere supervisor?
5. ¿Permitir múltiples arqueos parciales por turno?
6. ¿Duración máxima de turno sin cierre? (12 horas sugerido)
