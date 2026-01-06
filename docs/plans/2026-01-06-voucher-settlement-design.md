# Liquidación de Cupones de Tarjeta

## Resumen

Sistema para gestionar y liquidar cupones de pagos con tarjeta, tanto de terminales no integrados (Posnet, Lapos, Clover, etc.) como de Mercado Pago Point.

## Modelo de Datos

### CardBrand (Marcas de Tarjeta)
```prisma
model CardBrand {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String   // "Visa", "Mastercard", "Naranja"
  code      String   // "VISA", "MC", "NARANJA"
  isActive  Boolean  @default(true)
  isSystem  Boolean  @default(false)
  vouchers  CardVoucher[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
  @@map("card_brands")
}
```

### BankAccount (Cuentas Bancarias)
```prisma
model BankAccount {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name          String   // "Santander Cta Cte"
  bankName      String   // "Santander"
  accountNumber String?  // "123-456789/0"
  cbu           String?  // "0720123456789012345678"
  alias         String?  // "MI.CUENTA.SANTANDER"
  isActive      Boolean  @default(true)
  settlements   VoucherSettlement[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([tenantId])
  @@map("bank_accounts")
}
```

### CardVoucher (Cupón de Tarjeta)
```prisma
model CardVoucher {
  id                String    @id @default(cuid())
  tenantId          String
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  paymentId         String    @unique
  payment           Payment   @relation(fields: [paymentId], references: [id])

  // Origen del cupón
  source            VoucherSource  // CARD_TERMINAL | MERCADO_PAGO
  cardTerminalId    String?
  cardTerminal      CardTerminal?  @relation(fields: [cardTerminalId], references: [id])

  // Datos de la tarjeta
  cardBrandId       String?
  cardBrand         CardBrand?     @relation(fields: [cardBrandId], references: [id])
  cardLastFour      String?

  // Datos del cupón
  voucherNumber     String?
  batchNumber       String?
  authorizationCode String?
  installments      Int       @default(1)

  // Datos de MP (si source = MERCADO_PAGO)
  mpPaymentId       String?

  // Montos y fechas
  saleDate          DateTime
  amount            Decimal   @db.Decimal(12, 2)

  // Estado de liquidación
  status            VoucherStatus  @default(PENDING)  // PENDING | SETTLED
  settlementId      String?
  settlement        VoucherSettlement? @relation(fields: [settlementId], references: [id])

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([cardTerminalId])
  @@index([cardBrandId])
  @@index([saleDate])
  @@map("card_vouchers")
}

enum VoucherSource {
  CARD_TERMINAL
  MERCADO_PAGO
}

enum VoucherStatus {
  PENDING
  SETTLED
}
```

### VoucherSettlement (Liquidación)
```prisma
model VoucherSettlement {
  id                String    @id @default(cuid())
  tenantId          String
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  settlementDate    DateTime
  bankAccountId     String
  bankAccount       BankAccount @relation(fields: [bankAccountId], references: [id])

  // Montos
  grossAmount       Decimal   @db.Decimal(12, 2)  // Monto bruto
  commissionAmount  Decimal   @db.Decimal(12, 2)  // Comisión
  withholdingAmount Decimal   @db.Decimal(12, 2)  // Retenciones
  netAmount         Decimal   @db.Decimal(12, 2)  // Monto neto recibido

  notes             String?
  vouchers          CardVoucher[]

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([tenantId])
  @@index([settlementDate])
  @@map("voucher_settlements")
}
```

## Flujos

### Creación Automática de Cupones

**Al crear Payment con tarjeta:**

1. Si `cardTerminalId` presente → crear CardVoucher con `source: CARD_TERMINAL`
2. Si `mpPaymentId` presente → crear CardVoucher con `source: MERCADO_PAGO`

```typescript
// En sale.service.ts, después de crear Payment
if (payment.cardTerminalId || payment.mpPaymentId) {
  await prisma.cardVoucher.create({
    data: {
      tenantId,
      paymentId: payment.id,
      source: payment.cardTerminalId ? 'CARD_TERMINAL' : 'MERCADO_PAGO',
      cardTerminalId: payment.cardTerminalId,
      cardBrandId: await resolveCardBrandId(payment.cardBrand),
      cardLastFour: payment.cardLastFour,
      voucherNumber: payment.voucherNumber,
      batchNumber: payment.batchNumber,
      authorizationCode: payment.authorizationCode,
      installments: payment.installments,
      mpPaymentId: payment.mpPaymentId,
      saleDate: sale.saleDate,
      amount: payment.amount,
      status: 'PENDING',
    }
  });
}
```

### Flujo de Liquidación

1. Usuario accede a "Liquidación de Cupones"
2. Filtra por: Terminal, Marca, Estado, Rango de fechas
3. Selecciona cupones a liquidar (checkbox)
4. Click "Liquidar seleccionados"
5. Modal: Ingresa fecha depósito, cuenta bancaria, comisión, retenciones
6. Sistema calcula neto y crea VoucherSettlement
7. Actualiza CardVoucher.status = SETTLED para todos los seleccionados

## Páginas Backoffice

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/card-brands` | CardBrands.tsx | CRUD de marcas de tarjeta |
| `/bank-accounts` | BankAccounts.tsx | CRUD de cuentas bancarias |
| `/voucher-settlements` | VoucherSettlements.tsx | Liquidación de cupones |

## Seeds

### CardBrands del Sistema
- Visa (VISA)
- Mastercard (MC)
- American Express (AMEX)
- Naranja (NARANJA)
- Cabal (CABAL)
- Maestro (MAESTRO)
- Tarjeta Shopping (SHOPPING)
- Tarjeta Nevada (NEVADA)

## Migración

Script para crear CardVoucher para Payments existentes:
1. Buscar Payments con cardTerminalId o mpPaymentId
2. Crear CardVoucher correspondiente con status PENDING
3. Matchear cardBrand (texto) con CardBrand (entidad)

## Tareas de Implementación

1. Agregar modelos al schema.prisma
2. Crear migración y seeds
3. Crear rutas CRUD: card-brands, bank-accounts
4. Crear ruta voucher-settlements con endpoints de liquidación
5. Modificar sale.service.ts para crear CardVoucher automáticamente
6. Crear páginas backoffice: CardBrands, BankAccounts, VoucherSettlements
7. Agregar entradas al menú
8. Script de migración de pagos existentes
9. Build y test
