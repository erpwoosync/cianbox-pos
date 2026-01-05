# PENDIENTE: Entidad Recibo/Cobro

**Estado:** Pendiente de implementacion
**Prioridad:** Media
**Dependencia:** API Cianbox para sincronizar recibos

---

## Problema Actual

El modelo actual tiene `Payment` atado directamente a `Sale`:

```
Sale (Venta)
  └── Payment[] (pagos directos)
```

Esto limita:
1. **Cuenta corriente** - No hay cobros parciales a cuenta del cliente
2. **Recibos independientes** - No se puede generar recibo sin venta asociada
3. **Aplicacion de vales** - El vale deberia generar un recibo que cancela deuda
4. **Pagos a cuenta** - Cliente paga anticipado sin comprar
5. **Sincronizacion con Cianbox** - Cianbox maneja recibos como documentos separados

---

## Solucion Propuesta

### Nueva Entidad: Receipt (Recibo/Cobro)

```prisma
model Receipt {
  id              String        @id @default(cuid())
  tenantId        String

  // Identificacion
  receiptNumber   String        // REC-001-2026-0001
  receiptDate     DateTime      @default(now())

  // Cliente
  customerId      String?

  // Totales
  totalAmount     Decimal       @db.Decimal(12, 2)

  // Estado
  status          ReceiptStatus @default(CONFIRMED)

  // Origen
  branchId        String?
  userId          String        // Quien lo emitio
  cashSessionId   String?       // Sesion de caja

  // Sincronizacion Cianbox
  cianboxSynced   Boolean       @default(false)
  cianboxId       Int?          // ID del recibo en Cianbox

  // Relaciones
  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  customer        Customer?     @relation(fields: [customerId], references: [id])
  branch          Branch?       @relation(fields: [branchId], references: [id])
  user            User          @relation(fields: [userId], references: [id])
  cashSession     CashSession?  @relation(fields: [cashSessionId], references: [id])

  // Pagos del recibo
  payments        ReceiptPayment[]

  // Aplicaciones (a que se aplica este cobro)
  applications    ReceiptApplication[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([tenantId])
  @@index([customerId])
  @@index([receiptNumber])
  @@map("receipts")
}

enum ReceiptStatus {
  CONFIRMED
  CANCELLED
}

// Pagos dentro del recibo (efectivo, tarjeta, vale, etc)
model ReceiptPayment {
  id              String        @id @default(cuid())
  receiptId       String

  method          PaymentMethod
  amount          Decimal       @db.Decimal(12, 2)

  // Si es vale
  storeCreditId   String?

  // Detalles segun metodo (igual que Payment actual)
  reference       String?
  cardBrand       String?
  cardLastFour    String?
  transactionId   String?

  receipt         Receipt       @relation(fields: [receiptId], references: [id])
  storeCredit     StoreCredit?  @relation(fields: [storeCreditId], references: [id])

  @@map("receipt_payments")
}

// A que se aplica el recibo (ventas, cuenta corriente, etc)
model ReceiptApplication {
  id              String        @id @default(cuid())
  receiptId       String

  // Tipo de aplicacion
  type            ApplicationType
  amount          Decimal       @db.Decimal(12, 2)

  // Referencias segun tipo
  saleId          String?       // Si aplica a una venta
  accountId       String?       // Si aplica a cuenta corriente (futuro)

  receipt         Receipt       @relation(fields: [receiptId], references: [id])
  sale            Sale?         @relation(fields: [saleId], references: [id])

  @@map("receipt_applications")
}

enum ApplicationType {
  SALE            // Pago de venta
  ACCOUNT         // Pago a cuenta corriente
  ADVANCE         // Pago anticipado
}
```

---

## Flujos de Uso

### 1. Venta Normal (actual, sin cambios)
```
Cliente compra → Sale con Payment directo
```

### 2. Venta con Cuenta Corriente
```
Cliente compra a credito → Sale genera deuda
Despues viene a pagar → Receipt cancela deuda
```

### 3. Uso de Vale/Credito
```
Cliente tiene StoreCredit
Viene a comprar → Sale
Paga con vale → Receipt con ReceiptPayment(VOUCHER) + ReceiptApplication(SALE)
```

### 4. Pago Anticipado
```
Cliente paga sin comprar → Receipt con ApplicationType.ADVANCE
Despues compra → Se aplica el saldo a favor
```

---

## Integracion con Cianbox

Cianbox maneja:
- **Factura/Ticket** = Sale + AfipInvoice (ya implementado)
- **Nota de Credito** = Devolucion (parcialmente implementado)
- **Recibo** = Receipt (PENDIENTE)

Cuando se implemente la API de recibos en Cianbox:
1. Crear Receipt local
2. Sincronizar a Cianbox
3. Guardar `cianboxId` para referencia

---

## Tareas de Implementacion

- [ ] Crear modelos Prisma (Receipt, ReceiptPayment, ReceiptApplication)
- [ ] Migrar Payment actual para convivir con nuevo modelo
- [ ] API endpoints para recibos
- [ ] UI en backoffice para gestion de recibos
- [ ] Integrar con StoreCredits (uso de vales genera recibo)
- [ ] Reportes de cobranzas
- [ ] Sincronizacion con Cianbox (cuando API disponible)

---

## Notas

- El modelo actual de `Payment` directo en `Sale` puede seguir funcionando para ventas simples
- `Receipt` seria para casos mas complejos (cuenta corriente, vales, anticipos)
- Evaluar si migrar todo a `Receipt` o mantener ambos modelos
