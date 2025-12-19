# Modelo de Datos - Sistema de Caja

Documentación del sistema de turnos de caja, arqueos y movimientos de efectivo.

## Índice
- [Turnos de Caja](#turnos-de-caja)
- [Movimientos de Efectivo](#movimientos-de-efectivo)
- [Arqueos](#arqueos)
- [Modelo Legacy](#modelo-legacy)

---

## Turnos de Caja

### CashSession
Turno de un cajero en un punto de venta.

```prisma
model CashSession {
  id               String            @id @default(cuid())
  tenantId         String
  branchId         String
  pointOfSaleId    String
  userId           String            // Cajero del turno
  sessionNumber    String            // "T-CAJA-01-20241219-001"

  // === APERTURA ===
  openingAmount    Decimal           @db.Decimal(12, 2)
  openedAt         DateTime          @default(now())
  openedByUserId   String
  openingNotes     String?

  // === CIERRE ===
  closingAmount    Decimal?          @db.Decimal(12, 2)
  expectedAmount   Decimal?          @db.Decimal(12, 2)
  difference       Decimal?          @db.Decimal(12, 2)
  closedAt         DateTime?
  closedByUserId   String?
  closingNotes     String?

  // === TOTALES POR MÉTODO ===
  totalCash        Decimal           @default(0) @db.Decimal(12, 2)
  totalDebit       Decimal           @default(0) @db.Decimal(12, 2)
  totalCredit      Decimal           @default(0) @db.Decimal(12, 2)
  totalQr          Decimal           @default(0) @db.Decimal(12, 2)
  totalMpPoint     Decimal           @default(0) @db.Decimal(12, 2)
  totalTransfer    Decimal           @default(0) @db.Decimal(12, 2)
  totalOther       Decimal           @default(0) @db.Decimal(12, 2)

  // === CONTADORES ===
  salesCount       Int               @default(0)
  salesTotal       Decimal           @default(0) @db.Decimal(12, 2)
  refundsCount     Int               @default(0)
  refundsTotal     Decimal           @default(0) @db.Decimal(12, 2)
  cancelsCount     Int               @default(0)

  // === MOVIMIENTOS ===
  withdrawalsTotal Decimal           @default(0) @db.Decimal(12, 2)
  depositsTotal    Decimal           @default(0) @db.Decimal(12, 2)

  // === ESTADO ===
  status           CashSessionStatus @default(OPEN)

  // === RELEVO ===
  previousSessionId String?  @unique
  transferAmount    Decimal? @db.Decimal(12, 2)

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
}

enum CashSessionStatus {
  OPEN          // Operando normalmente
  SUSPENDED     // Suspendido temporalmente (ej: almuerzo)
  COUNTING      // En proceso de arqueo/cierre
  CLOSED        // Cerrado
  TRANSFERRED   // Cerrado por relevo a otro cajero
}
```

**Generar Número de Sesión:**

```typescript
async function generateSessionNumber(
  tenantId: string,
  pointOfSaleId: string
): Promise<string> {
  const pos = await prisma.pointOfSale.findUnique({
    where: { id: pointOfSaleId }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.cashSession.count({
    where: {
      tenantId,
      pointOfSaleId,
      createdAt: { gte: today }
    }
  });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = String(count + 1).padStart(3, '0');

  return `T-${pos.code}-${dateStr}-${sequence}`;
}
```

### Abrir Turno

```typescript
const session = await prisma.cashSession.create({
  data: {
    tenantId,
    branchId,
    pointOfSaleId,
    userId,
    sessionNumber: await generateSessionNumber(tenantId, pointOfSaleId),
    openingAmount: 1000, // Fondo inicial
    openedByUserId: userId,
    openingNotes: "Turno mañana",
    status: 'OPEN'
  }
});
```

### Cerrar Turno

```typescript
// Calcular totales por método de pago
const paymentTotals = await calculatePaymentTotals(sessionId);

// Calcular efectivo esperado
const expectedCash = await calculateExpectedCash(sessionId);

// Actualizar sesión
await prisma.cashSession.update({
  where: { id: sessionId },
  data: {
    status: 'CLOSED',
    closedAt: new Date(),
    closedByUserId: userId,
    closingAmount,
    expectedAmount: expectedCash,
    difference: closingAmount - expectedCash,
    ...paymentTotals
  }
});
```

### Relevo de Turno

```typescript
await prisma.$transaction(async (tx) => {
  // Cerrar sesión actual
  const closedSession = await tx.cashSession.update({
    where: { id: currentSessionId },
    data: {
      status: 'TRANSFERRED',
      closedAt: new Date(),
      closedByUserId: currentUserId,
      closingAmount: transferAmount,
      expectedAmount: await calculateExpectedCash(currentSessionId),
      difference: transferAmount - expectedAmount
    }
  });

  // Crear nueva sesión
  const newSession = await tx.cashSession.create({
    data: {
      tenantId,
      branchId,
      pointOfSaleId,
      userId: newUserId,
      sessionNumber: await generateSessionNumber(tenantId, pointOfSaleId),
      openingAmount: transferAmount,
      openedByUserId: currentUserId,
      openingNotes: `Relevo de ${currentUser.name}`,
      previousSessionId: currentSessionId,
      transferAmount,
      status: 'OPEN'
    }
  });

  // Registrar transferencias
  await tx.cashMovement.create({
    data: {
      cashSessionId: currentSessionId,
      type: 'TRANSFER_OUT',
      amount: transferAmount,
      reason: 'SHIFT_TRANSFER',
      description: `Transferido a ${newUser.name}`,
      createdByUserId: currentUserId
    }
  });

  await tx.cashMovement.create({
    data: {
      cashSessionId: newSession.id,
      type: 'TRANSFER_IN',
      amount: transferAmount,
      reason: 'SHIFT_TRANSFER',
      description: `Recibido de ${currentUser.name}`,
      createdByUserId: currentUserId
    }
  });
});
```

---

## Movimientos de Efectivo

### CashMovement
Movimientos de efectivo (retiros, depósitos, ajustes).

```prisma
model CashMovement {
  id               String              @id @default(cuid())
  cashSessionId    String
  type             CashMovementType
  amount           Decimal             @db.Decimal(12, 2)

  // Detalle
  reason           CashMovementReason
  description      String?
  reference        String?

  // Autorización
  authorizedByUserId String?
  requiresAuth     Boolean             @default(false)

  // Destino (para retiros)
  destinationType  String?             // "SAFE", "BANK", "OTHER"

  // Auditoría
  createdByUserId  String
  createdAt        DateTime            @default(now())

  cashSession      CashSession         @relation(fields: [cashSessionId], references: [id], onDelete: Cascade)
  authorizedBy     User?               @relation("MovementAuthorizedBy", fields: [authorizedByUserId], references: [id])
  createdBy        User                @relation("MovementCreatedBy", fields: [createdByUserId], references: [id])

  @@index([cashSessionId])
  @@index([createdAt])
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

  OTHER
}
```

### Registrar Retiro

```typescript
// Retiro a caja fuerte
await prisma.cashMovement.create({
  data: {
    cashSessionId,
    type: 'WITHDRAWAL',
    amount: 5000,
    reason: 'SAFE_DEPOSIT',
    description: 'Depósito a caja fuerte - exceso de efectivo',
    destinationType: 'SAFE',
    createdByUserId: userId
  }
});

// Actualizar total de retiros en sesión
await prisma.cashSession.update({
  where: { id: cashSessionId },
  data: {
    withdrawalsTotal: { increment: 5000 }
  }
});
```

### Registrar Ingreso

```typescript
// Fondo adicional para cambio
await prisma.cashMovement.create({
  data: {
    cashSessionId,
    type: 'DEPOSIT',
    amount: 2000,
    reason: 'CHANGE_FUND',
    description: 'Fondo adicional para billetes chicos',
    createdByUserId: userId
  }
});

// Actualizar total de ingresos
await prisma.cashSession.update({
  where: { id: cashSessionId },
  data: {
    depositsTotal: { increment: 2000 }
  }
});
```

### Calcular Efectivo Esperado

```typescript
async function calculateExpectedCash(sessionId: string): Promise<number> {
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      movements: true,
      sales: {
        where: { status: 'COMPLETED' },
        include: { payments: true }
      }
    }
  });

  let expected = Number(session.openingAmount);

  // Sumar ventas en efectivo (menos vuelto)
  for (const sale of session.sales) {
    for (const payment of sale.payments) {
      if (payment.method === 'CASH' && payment.status === 'COMPLETED') {
        expected += Number(payment.amount);
        if (payment.changeAmount) {
          expected -= Number(payment.changeAmount);
        }
      }
    }
  }

  // Sumar/restar movimientos
  for (const mov of session.movements) {
    const amount = Number(mov.amount);
    switch (mov.type) {
      case 'DEPOSIT':
      case 'ADJUSTMENT_IN':
      case 'TRANSFER_IN':
      case 'CHANGE_FUND':
        expected += amount;
        break;
      case 'WITHDRAWAL':
      case 'ADJUSTMENT_OUT':
      case 'TRANSFER_OUT':
        expected -= amount;
        break;
    }
  }

  return expected;
}
```

---

## Arqueos

### CashCount
Arqueo de caja (conteo de dinero).

```prisma
model CashCount {
  id              String          @id @default(cuid())
  cashSessionId   String
  type            CashCountType   @default(PARTIAL)

  // === CONTEO POR DENOMINACIÓN (Pesos Argentinos) ===
  // Billetes
  bills_10000     Int             @default(0)
  bills_5000      Int             @default(0)
  bills_2000      Int             @default(0)
  bills_1000      Int             @default(0)
  bills_500       Int             @default(0)
  bills_200       Int             @default(0)
  bills_100       Int             @default(0)
  bills_50        Int             @default(0)
  bills_20        Int             @default(0)
  bills_10        Int             @default(0)

  // Monedas
  coins_500       Int             @default(0)
  coins_200       Int             @default(0)
  coins_100       Int             @default(0)
  coins_50        Int             @default(0)
  coins_25        Int             @default(0)
  coins_10        Int             @default(0)
  coins_5         Int             @default(0)
  coins_2         Int             @default(0)
  coins_1         Int             @default(0)

  // === TOTALES CALCULADOS ===
  totalBills      Decimal         @db.Decimal(12, 2)
  totalCoins      Decimal         @db.Decimal(12, 2)
  totalCash       Decimal         @db.Decimal(12, 2)

  // === COMPARACIÓN ===
  expectedAmount  Decimal         @db.Decimal(12, 2)
  difference      Decimal         @db.Decimal(12, 2)
  differenceType  DifferenceType?

  // === OTROS VALORES ===
  vouchers        Decimal         @default(0) @db.Decimal(12, 2)
  checks          Decimal         @default(0) @db.Decimal(12, 2)
  otherValues     Decimal         @default(0) @db.Decimal(12, 2)
  otherValuesNote String?

  notes           String?

  // Auditoría
  countedByUserId String
  verifiedByUserId String?
  countedAt       DateTime        @default(now())

  cashSession     CashSession     @relation(fields: [cashSessionId], references: [id], onDelete: Cascade)
  countedBy       User            @relation("CashCountCountedBy", fields: [countedByUserId], references: [id])
  verifiedBy      User?           @relation("CashCountVerifiedBy", fields: [verifiedByUserId], references: [id])

  @@index([cashSessionId])
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

### Calcular Totales de Arqueo

```typescript
function calculateDenominationTotals(
  bills: Record<string, number>,
  coins: Record<string, number>
): {
  totalBills: number;
  totalCoins: number;
  totalCash: number;
} {
  const billDenominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
  const coinDenominations = [500, 200, 100, 50, 25, 10, 5, 2, 1];

  let totalBills = 0;
  let totalCoins = 0;

  for (const denom of billDenominations) {
    totalBills += (bills[denom.toString()] || 0) * denom;
  }

  for (const denom of coinDenominations) {
    totalCoins += (coins[denom.toString()] || 0) * denom;
  }

  return {
    totalBills,
    totalCoins,
    totalCash: totalBills + totalCoins
  };
}
```

### Registrar Arqueo

```typescript
const bills = {
  10000: 5,  // 5 billetes de $10.000 = $50.000
  5000: 10,  // 10 billetes de $5.000 = $50.000
  2000: 25,  // 25 billetes de $2.000 = $50.000
  1000: 50   // 50 billetes de $1.000 = $50.000
};

const coins = {
  500: 20,   // 20 monedas de $500 = $10.000
  100: 50    // 50 monedas de $100 = $5.000
};

const totals = calculateDenominationTotals(bills, coins);
const expectedAmount = await calculateExpectedCash(sessionId);
const difference = totals.totalCash - expectedAmount;

const count = await prisma.cashCount.create({
  data: {
    cashSessionId,
    type: 'CLOSING',
    bills_10000: bills[10000],
    bills_5000: bills[5000],
    bills_2000: bills[2000],
    bills_1000: bills[1000],
    coins_500: coins[500],
    coins_100: coins[100],
    totalBills: totals.totalBills,
    totalCoins: totals.totalCoins,
    totalCash: totals.totalCash,
    expectedAmount,
    difference,
    differenceType: difference > 0 ? 'SURPLUS' : difference < 0 ? 'SHORTAGE' : null,
    countedByUserId: userId
  }
});
```

### Resumen de Arqueo

```typescript
interface CashCountSummary {
  totalBills: number;
  totalCoins: number;
  totalCash: number;
  expectedAmount: number;
  difference: number;
  differenceType: 'SURPLUS' | 'SHORTAGE' | null;
  breakdown: {
    bills: Record<string, { quantity: number; total: number }>;
    coins: Record<string, { quantity: number; total: number }>;
  };
}

function getCashCountSummary(count: CashCount): CashCountSummary {
  const billDenominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
  const coinDenominations = [500, 200, 100, 50, 25, 10, 5, 2, 1];

  const breakdown = {
    bills: {},
    coins: {}
  };

  for (const denom of billDenominations) {
    const key = `bills_${denom}`;
    const quantity = count[key] || 0;
    if (quantity > 0) {
      breakdown.bills[denom] = {
        quantity,
        total: quantity * denom
      };
    }
  }

  for (const denom of coinDenominations) {
    const key = `coins_${denom}`;
    const quantity = count[key] || 0;
    if (quantity > 0) {
      breakdown.coins[denom] = {
        quantity,
        total: quantity * denom
      };
    }
  }

  return {
    totalBills: Number(count.totalBills),
    totalCoins: Number(count.totalCoins),
    totalCash: Number(count.totalCash),
    expectedAmount: Number(count.expectedAmount),
    difference: Number(count.difference),
    differenceType: count.differenceType,
    breakdown
  };
}
```

---

## Modelo Legacy

### CashRegister
Modelo de caja simplificado (mantener para compatibilidad).

```prisma
model CashRegister {
  id               String             @id @default(cuid())
  tenantId         String
  branchId         String
  pointOfSaleId    String
  userId           String

  openingAmount    Decimal            @db.Decimal(12, 2)
  closingAmount    Decimal?           @db.Decimal(12, 2)
  expectedAmount   Decimal?           @db.Decimal(12, 2)
  difference       Decimal?           @db.Decimal(12, 2)

  totalCash        Decimal            @default(0) @db.Decimal(12, 2)
  totalCard        Decimal            @default(0) @db.Decimal(12, 2)
  totalOther       Decimal            @default(0) @db.Decimal(12, 2)

  status           CashRegisterStatus @default(OPEN)

  openedAt         DateTime           @default(now())
  closedAt         DateTime?

  openingNotes     String?
  closingNotes     String?

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch      Branch      @relation(fields: [branchId], references: [id])
  pointOfSale PointOfSale @relation(fields: [pointOfSaleId], references: [id])
  user        User        @relation(fields: [userId], references: [id])

  @@index([tenantId, branchId, openedAt])
  @@index([pointOfSaleId, status])
}

enum CashRegisterStatus {
  OPEN
  CLOSED
  SUSPENDED
}
```

**Nota:** Este modelo está deprecado. Se recomienda usar `CashSession` para nuevas implementaciones, que ofrece:
- Seguimiento detallado de movimientos
- Arqueos múltiples por turno
- Sistema de relevo de turnos
- Auditoría completa

---

## Reportes

### Reporte Diario de Caja

```typescript
async function getDailyReport(tenantId: string, date: Date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const sessions = await prisma.cashSession.findMany({
    where: {
      tenantId,
      openedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      user: { select: { name: true } },
      pointOfSale: { select: { name: true } },
      branch: { select: { name: true } }
    }
  });

  const summary = {
    totalSessions: sessions.length,
    openSessions: sessions.filter(s => s.status === 'OPEN').length,
    closedSessions: sessions.filter(s => ['CLOSED', 'TRANSFERRED'].includes(s.status)).length,
    totalSales: 0,
    totalCash: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalQr: 0,
    totalMpPoint: 0,
    totalTransfer: 0,
    totalWithdrawals: 0,
    totalDeposits: 0
  };

  for (const session of sessions) {
    summary.totalSales += Number(session.salesTotal);
    summary.totalCash += Number(session.totalCash);
    summary.totalDebit += Number(session.totalDebit);
    summary.totalCredit += Number(session.totalCredit);
    summary.totalQr += Number(session.totalQr);
    summary.totalMpPoint += Number(session.totalMpPoint);
    summary.totalTransfer += Number(session.totalTransfer);
    summary.totalWithdrawals += Number(session.withdrawalsTotal);
    summary.totalDeposits += Number(session.depositsTotal);
  }

  return {
    date: date.toISOString().slice(0, 10),
    sessions,
    summary
  };
}
```

### Reporte de Sesión Individual

```typescript
async function getSessionReport(sessionId: string) {
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      pointOfSale: true,
      branch: true,
      user: { select: { name: true, email: true } },
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      movements: {
        orderBy: { createdAt: 'asc' },
        include: {
          createdBy: { select: { name: true } },
          authorizedBy: { select: { name: true } }
        }
      },
      counts: {
        orderBy: { countedAt: 'asc' },
        include: {
          countedBy: { select: { name: true } },
          verifiedBy: { select: { name: true } }
        }
      },
      sales: {
        where: { status: 'COMPLETED' },
        include: { payments: true }
      }
    }
  });

  return {
    session,
    expectedCash: await calculateExpectedCash(sessionId),
    summary: {
      openingAmount: Number(session.openingAmount),
      closingAmount: Number(session.closingAmount || 0),
      difference: Number(session.difference || 0),
      totalSales: Number(session.salesTotal),
      totalWithdrawals: Number(session.withdrawalsTotal),
      totalDeposits: Number(session.depositsTotal),
      paymentMethods: {
        cash: Number(session.totalCash),
        debit: Number(session.totalDebit),
        credit: Number(session.totalCredit),
        qr: Number(session.totalQr),
        mpPoint: Number(session.totalMpPoint),
        transfer: Number(session.totalTransfer),
        other: Number(session.totalOther)
      }
    }
  };
}
```

---

**Ver también:**
- [DATABASE-CORE.md](./DATABASE-CORE.md) - Modelos fundamentales
- [DATABASE-SALES.md](./DATABASE-SALES.md) - Ventas y pagos
- [API-CASH.md](./API-CASH.md) - Endpoints de caja
- [DISENO-SISTEMA-CAJA.md](./DISENO-SISTEMA-CAJA.md) - Diseño completo del sistema
