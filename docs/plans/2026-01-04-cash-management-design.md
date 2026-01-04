# Diseño: Sistema de Caja Completo para POS

**Fecha:** 2026-01-04
**Estado:** Aprobado
**Target:** Retail, supermercados, mini markets, tiendas de ropa/moda

## 1. Arquitectura General

### Modelo de Operación de Caja

El sistema soporta tres modos configurables por punto de venta:

| Modo | Comportamiento |
|------|----------------|
| `REQUIRED` | Obligatorio abrir caja antes de vender |
| `OPTIONAL` | Permite vender sin caja abierta |
| `AUTO` | Abre caja automáticamente en primera venta del día |

### Componentes del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFIGURACIÓN                            │
│  CashRegisterConfig (por POS)                               │
│  - cashMode: REQUIRED | OPTIONAL | AUTO                     │
│  - handoverMode: CLOSE_OPEN | TRANSFER                      │
│  - currencies: ["ARS", "USD", "EUR", "BRL"]                 │
│  - requireCountOnClose: boolean                             │
│  - allowPartialWithdrawal: boolean                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SESIÓN DE CAJA                           │
│  CashSession                                                │
│  - openingAmounts: JSON { ARS: 5000, USD: 100 }            │
│  - closingAmounts: JSON { ARS: 25000, USD: 150 }           │
│  - expectedAmounts: JSON (calculado)                        │
│  - differences: JSON { ARS: +500, USD: -10 }               │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Ventas  │   │Movimientos│   │ Arqueos  │
        │  (Sale)  │   │  (Cash)   │   │ (Count)  │
        └──────────┘   └──────────┘   └──────────┘
```

## 2. Modelo de Datos

### 2.1 Nueva Tabla: CashRegisterConfig

```prisma
model CashRegisterConfig {
  id                     String   @id @default(cuid())
  pointOfSaleId          String   @unique
  pointOfSale            PointOfSale @relation(fields: [pointOfSaleId], references: [id])

  // Modo de operación
  cashMode               CashMode @default(REQUIRED)
  handoverMode           HandoverMode @default(CLOSE_OPEN)

  // Monedas habilitadas
  currencies             Json     @default("[\"ARS\"]") // ["ARS", "USD", "EUR", "BRL"]
  defaultCurrency        String   @default("ARS")

  // Configuración de arqueo
  requireCountOnClose    Boolean  @default(true)
  requireCountOnOpen     Boolean  @default(false)
  maxDifferenceAllowed   Decimal  @default(0) // 0 = cualquier diferencia requiere justificación

  // Configuración de retiros
  allowPartialWithdrawal Boolean  @default(true)
  requireWithdrawalAuth  Boolean  @default(false)

  // Denominaciones por moneda (JSON)
  denominations          Json     @default("{}")
  // Ejemplo: {
  //   "ARS": { "bills": [10000,5000,2000,1000,500,200,100], "coins": [500,200,100,50,25,10,5,2,1] },
  //   "USD": { "bills": [100,50,20,10,5,2,1], "coins": [100,50,25,10,5,1] }
  // }

  tenantId               String
  tenant                 Tenant   @relation(fields: [tenantId], references: [id])

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([tenantId])
}

enum CashMode {
  REQUIRED    // Obligatorio abrir caja
  OPTIONAL    // Puede vender sin caja
  AUTO        // Abre automáticamente
}

enum HandoverMode {
  CLOSE_OPEN  // Cierra y abre nueva sesión
  TRANSFER    // Transfiere directamente
}
```

### 2.2 Extensión: CashSession (multi-moneda)

```prisma
model CashSession {
  // ... campos existentes ...

  // Multi-moneda (nuevo)
  openingAmounts         Json?    // { "ARS": 5000, "USD": 100 }
  closingAmounts         Json?    // { "ARS": 25000, "USD": 150 }
  expectedAmounts        Json?    // { "ARS": 24500, "USD": 160 } (calculado)
  differences            Json?    // { "ARS": 500, "USD": -10 }

  // Relevo (nuevo)
  transferredFromId      String?
  transferredFrom        CashSession? @relation("SessionTransfer", fields: [transferredFromId], references: [id])
  transferredTo          CashSession? @relation("SessionTransfer")
}
```

### 2.3 Extensión: CashCount (por moneda)

```prisma
model CashCount {
  // ... campos existentes ...

  // Multi-moneda (nuevo)
  currency               String   @default("ARS")
  denominationCounts     Json     // { "10000": 2, "5000": 5, "1000": 10, ... }
}
```

### 2.4 Nueva Tabla: GiftCard

```prisma
model GiftCard {
  id              String   @id @default(cuid())
  code            String   @unique // Código único de 16 caracteres

  // Valores
  initialAmount   Decimal  @db.Decimal(10, 2)
  currentBalance  Decimal  @db.Decimal(10, 2)
  currency        String   @default("ARS")

  // Estado
  status          GiftCardStatus @default(INACTIVE)

  // Vigencia
  expiresAt       DateTime?
  activatedAt     DateTime?

  // Relaciones
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  // Trazabilidad
  generatedById   String?
  generatedBy     User?    @relation("GiftCardGenerator", fields: [generatedById], references: [id])
  activatedById   String?
  activatedBy     User?    @relation("GiftCardActivator", fields: [activatedById], references: [id])

  transactions    GiftCardTransaction[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([code])
  @@index([status])
}

enum GiftCardStatus {
  INACTIVE      // Generada pero no activada
  ACTIVE        // Lista para usar
  DEPLETED      // Saldo agotado
  EXPIRED       // Vencida
  CANCELLED     // Cancelada
}

model GiftCardTransaction {
  id            String   @id @default(cuid())
  giftCardId    String
  giftCard      GiftCard @relation(fields: [giftCardId], references: [id])

  type          GiftCardTxType
  amount        Decimal  @db.Decimal(10, 2)
  balanceAfter  Decimal  @db.Decimal(10, 2)

  // Referencias
  saleId        String?
  sale          Sale?    @relation(fields: [saleId], references: [id])
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  notes         String?
  createdAt     DateTime @default(now())

  @@index([giftCardId])
  @@index([saleId])
}

enum GiftCardTxType {
  ACTIVATION    // Activación inicial
  REDEMPTION    // Uso en venta
  REFUND        // Devolución de saldo
  ADJUSTMENT    // Ajuste manual
  CANCELLATION  // Cancelación
}
```

### 2.5 Nueva Tabla: TreasuryPending

```prisma
model TreasuryPending {
  id                String   @id @default(cuid())

  // Origen
  cashMovementId    String
  cashMovement      CashMovement @relation(fields: [cashMovementId], references: [id])
  cashSessionId     String
  cashSession       CashSession @relation(fields: [cashSessionId], references: [id])

  // Montos
  amount            Decimal  @db.Decimal(10, 2)
  currency          String   @default("ARS")

  // Estado
  status            TreasuryStatus @default(PENDING)

  // Confirmación
  confirmedAt       DateTime?
  confirmedById     String?
  confirmedBy       User?    @relation(fields: [confirmedById], references: [id])
  confirmedAmount   Decimal? @db.Decimal(10, 2) // Puede diferir del declarado
  differenceNotes   String?  // Si confirmedAmount != amount

  // Comprobante
  receiptNumber     String?  // Número de comprobante impreso

  tenantId          String
  tenant            Tenant   @relation(fields: [tenantId], references: [id])

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId])
  @@index([status])
}

enum TreasuryStatus {
  PENDING     // Esperando confirmación
  CONFIRMED   // Recibido y confirmado
  PARTIAL     // Confirmado con diferencia
  REJECTED    // Rechazado
}
```

## 3. Flujos de Usuario

### 3.1 Apertura de Caja

```
┌─────────────────────────────────────────────────────────────┐
│                   APERTURA DE CAJA                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ ¿Modo REQUIRED/AUTO?  │
              └───────────────────────┘
                    │           │
              REQUIRED        AUTO
                    │           │
                    ▼           ▼
         ┌──────────────┐  ┌──────────────────┐
         │ Pedir montos │  │ Crear sesión con │
         │ por moneda   │  │ monto 0 automát. │
         └──────────────┘  └──────────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Mostrar por cada moneda: │
         │ - Campo monto inicial    │
         │ - Botón "Arqueo rápido"  │
         └──────────────────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │  Crear CashSession con   │
         │  openingAmounts: JSON    │
         └──────────────────────────┘
```

### 3.2 Retiro a Tesorería

```
┌─────────────────────────────────────────────────────────────┐
│                  RETIRO A TESORERÍA                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Cajero ingresa monto  │
              │ y selecciona moneda   │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Crear CashMovement    │
              │ tipo: WITHDRAWAL      │
              │ reason: TREASURY      │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Crear TreasuryPending │
              │ status: PENDING       │
              │ Generar receiptNumber │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ IMPRIMIR COMPROBANTE  │
              │ - Número de recibo    │
              │ - Monto y moneda      │
              │ - Cajero              │
              │ - Fecha/hora          │
              │ - Firma: _________    │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Cajero entrega dinero │
              │ + comprobante a       │
              │ supervisor            │
              └───────────────────────┘
```

### 3.3 Confirmación en Tesorería

```
┌─────────────────────────────────────────────────────────────┐
│               CONFIRMACIÓN EN TESORERÍA                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Tesorero ve lista de  │
              │ retiros pendientes    │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Selecciona retiro     │
              │ Ingresa monto recibido│
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────────────┐
              │ ¿Monto coincide?              │
              │                               │
              │ SÍ → status: CONFIRMED        │
              │ NO → status: PARTIAL          │
              │      + differenceNotes        │
              └───────────────────────────────┘
```

### 3.4 Gift Card - Generación y Activación

```
┌─────────────────────────────────────────────────────────────┐
│              GENERACIÓN DE GIFT CARDS                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Admin genera lote:    │
              │ - Cantidad            │
              │ - Monto unitario      │
              │ - Fecha vencimiento   │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Sistema genera códigos│
              │ únicos de 16 chars    │
              │ status: INACTIVE      │
              └───────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ACTIVACIÓN EN CAJA                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Cliente compra/recibe │
              │ gift card física      │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Cajero escanea código │
              │ o ingresa manual      │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Sistema activa:       │
              │ status: ACTIVE        │
              │ activatedAt: now()    │
              │ Crea GiftCardTx       │
              │ type: ACTIVATION      │
              └───────────────────────┘
```

### 3.5 Gift Card - Uso en Venta

```
┌─────────────────────────────────────────────────────────────┐
│                  USO DE GIFT CARD                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ En pantalla de pago,  │
              │ cajero selecciona     │
              │ "Pagar con Gift Card" │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Ingresa/escanea código│
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Sistema muestra:      │
              │ - Saldo disponible    │
              │ - Monto a aplicar     │
              └───────────────────────┘
                          │
                          ▼
              ┌─────────────────────────────────┐
              │ Al confirmar venta:             │
              │ - Descuenta de currentBalance   │
              │ - Crea GiftCardTx REDEMPTION    │
              │ - Crea Payment tipo GIFT_CARD   │
              │ - Si balance=0 → DEPLETED       │
              └─────────────────────────────────┘
```

### 3.6 Arqueo Multi-moneda

```
┌─────────────────────────────────────────────────────────────┐
│                  ARQUEO MULTI-MONEDA                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Cajero inicia arqueo  │
              │ (parcial o de cierre) │
              └───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │ Para CADA moneda habilitada:       │
         │                                    │
         │  ┌──────────────────────────────┐  │
         │  │ Tab: ARS                     │  │
         │  │ ┌────────────────────────┐   │  │
         │  │ │ BILLETES               │   │  │
         │  │ │ $10.000 x [___] = $    │   │  │
         │  │ │ $5.000  x [___] = $    │   │  │
         │  │ │ $2.000  x [___] = $    │   │  │
         │  │ │ ...                    │   │  │
         │  │ └────────────────────────┘   │  │
         │  │ ┌────────────────────────┐   │  │
         │  │ │ MONEDAS                │   │  │
         │  │ │ $500 x [___] = $       │   │  │
         │  │ │ $200 x [___] = $       │   │  │
         │  │ │ ...                    │   │  │
         │  │ └────────────────────────┘   │  │
         │  │                              │  │
         │  │ Total contado: $25.500       │  │
         │  │ Esperado:      $25.000       │  │
         │  │ Diferencia:    +$500 ▲       │  │
         │  └──────────────────────────────┘  │
         │                                    │
         │  [Tab: USD] [Tab: EUR] [Tab: BRL]  │
         └────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Guarda CashCount por  │
              │ cada moneda contada   │
              └───────────────────────┘
```

### 3.7 Relevo de Caja (Shift Handover)

```
┌─────────────────────────────────────────────────────────────┐
│              RELEVO - MODO CLOSE_OPEN                       │
└─────────────────────────────────────────────────────────────┘

  Cajero A                           Cajero B
     │                                  │
     ▼                                  │
┌──────────┐                            │
│ Arqueo   │                            │
│ completo │                            │
└──────────┘                            │
     │                                  │
     ▼                                  │
┌──────────┐                            │
│ Cierre   │                            │
│ sesión A │                            │
└──────────┘                            │
     │                                  │
     │         Entrega física           │
     │──────────────────────────────────▶
                                        │
                                        ▼
                                  ┌──────────┐
                                  │ Apertura │
                                  │ sesión B │
                                  │ (arquea) │
                                  └──────────┘

┌─────────────────────────────────────────────────────────────┐
│              RELEVO - MODO TRANSFER                         │
└─────────────────────────────────────────────────────────────┘

  Cajero A                           Cajero B
     │                                  │
     ▼                                  │
┌──────────────┐                        │
│ Inicia       │                        │
│ transferencia│                        │
└──────────────┘                        │
     │                                  │
     │    Sistema muestra montos        │
     │    actuales y pendientes         │
     │──────────────────────────────────▶
                                        │
                                        ▼
                                  ┌──────────┐
                                  │ Acepta   │
                                  │ montos   │
                                  └──────────┘
                                        │
                                        ▼
                                  ┌──────────────────────┐
                                  │ CashSession nueva    │
                                  │ transferredFromId =  │
                                  │   sesión A           │
                                  │ openingAmounts =     │
                                  │   closingAmounts A   │
                                  └──────────────────────┘
```

## 4. Integraciones

### 4.1 MercadoPago

Los totales de tarjetas se obtienen automáticamente de la API de MercadoPago:
- No requiere conteo manual de cupones
- Se consulta al momento del cierre
- Se muestra como referencia en el arqueo

### 4.2 Transferencias Bancarias

- Registro manual en el momento del cobro
- Se incluyen en el arqueo como "medios electrónicos"
- Post-verificación opcional en tesorería (conciliación bancaria)

## 5. Fases de Implementación

### Fase 1: Base
- [ ] Modelo CashRegisterConfig
- [ ] Extensión multi-moneda de CashSession
- [ ] UI de configuración por POS
- [ ] Apertura/cierre con multi-moneda

### Fase 2: Arqueo
- [ ] Extensión CashCount por moneda
- [ ] UI de arqueo con denominaciones configurables
- [ ] Cálculo de diferencias por moneda

### Fase 3: Tesorería
- [ ] Modelo TreasuryPending
- [ ] Flujo de retiro con comprobante
- [ ] UI de confirmación en tesorería

### Fase 4: Gift Cards
- [ ] Modelos GiftCard y GiftCardTransaction
- [ ] Generación de lotes
- [ ] Activación en caja
- [ ] Uso como método de pago

### Fase 5: Relevo
- [ ] Modo TRANSFER de handover
- [ ] UI de transferencia entre cajeros

## 6. Consideraciones Técnicas

### Performance
- Índices en `currency` para CashCount
- Índice compuesto en GiftCard(tenantId, code)
- Cache de denominaciones por moneda

### Seguridad
- Validar permisos para confirmar en tesorería
- Auditoría de todas las transacciones de gift cards
- Validar montos antes de confirmar retiros

### UX
- Tabs por moneda en arqueo
- Totales en tiempo real
- Diferencias destacadas visualmente (verde/rojo)
- Comprobante de retiro imprimible

---

**Aprobado por:** Usuario
**Fecha de aprobación:** 2026-01-04
