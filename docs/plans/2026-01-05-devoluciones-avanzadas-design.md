# Sistema de Devoluciones Avanzado - Diseño

> **Para Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar sistema de devoluciones para retail de moda con opciones de vale/crédito, cambio por producto y devolución en efectivo.

**Architecture:** Devoluciones como ítems negativos en el carrito del POS, vales locales con sincronización futura a Cianbox.

**Tech Stack:** React, Prisma, PostgreSQL, impresión térmica

---

## Resumen de Requerimientos

| Funcionalidad | Descripción |
|---------------|-------------|
| Cambio inmediato | Cliente elige otro producto, devolución aparece negativa en carrito |
| Vale/Crédito | Impreso + registrado en sistema, vencimiento configurable |
| Diferencia de precio | Nuevo más caro → paga diferencia; más barato → vale por diferencia |
| Devolución efectivo | Solo con autorización de supervisor |
| Vencimiento vales | Configurable por tenant (ej: 30, 60, 90 días) |

---

## Flujo de Usuario

### Flujo 1: Devolución con Vale
1. Cajero abre "Devoluciones" desde POS
2. Busca producto/ticket original
3. Selecciona productos a devolver → se agregan al carrito como **ítems negativos**
4. Total negativo → botón "Cobrar" muestra "Generar Vale"
5. Se imprime vale y queda registrado en sistema

### Flujo 2: Cambio por Otro Producto
1. Devolución agrega ítems negativos al carrito
2. Cajero agrega productos nuevos (positivos)
3. Según total:
   - **Total > 0**: Cliente paga diferencia (efectivo, tarjeta, etc.)
   - **Total = 0**: Cambio exacto, confirma sin pago
   - **Total < 0**: Genera vale por la diferencia

### Flujo 3: Devolución en Efectivo (excepcional)
1. Cajero intenta devolución en efectivo
2. Sistema pide PIN de supervisor
3. Si autoriza → crea egreso en caja + imprime comprobante

---

## Modelo de Datos

### Nueva Entidad: StoreCredit (Vale/Crédito)

```prisma
model StoreCredit {
  id              String            @id @default(cuid())
  tenantId        String

  // Identificación
  code            String            @unique  // VAL-001-2026-A1B2
  barcode         String?                    // Para escaneo rápido

  // Montos
  originalAmount  Decimal           @db.Decimal(12, 2)
  currentBalance  Decimal           @db.Decimal(12, 2)

  // Vigencia
  issuedAt        DateTime          @default(now())
  expiresAt       DateTime?                  // Null = sin vencimiento

  // Estado
  status          StoreCreditStatus

  // Origen
  originSaleId    String?                    // Venta de devolución que lo generó
  customerId      String?                    // Cliente (opcional)
  branchId        String?                    // Sucursal donde se emitió
  issuedByUserId  String                     // Cajero que lo emitió

  // Sincronización con Cianbox (Fase 2)
  cianboxSynced     Boolean         @default(false)
  cianboxDocId      Int?                     // ID del documento en Cianbox (NDC)
  cianboxReceiptId  Int?                     // ID del recibo cuando se usa

  // Relaciones
  tenant          Tenant            @relation(fields: [tenantId], references: [id])
  originSale      Sale?             @relation("SaleCreditIssued", fields: [originSaleId], references: [id])
  customer        Customer?         @relation(fields: [customerId], references: [id])
  branch          Branch?           @relation(fields: [branchId], references: [id])
  issuedBy        User              @relation("StoreCreditIssuer", fields: [issuedByUserId], references: [id])
  transactions    StoreCreditTx[]
  payments        Payment[]

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([tenantId])
  @@index([code])
  @@index([customerId])
  @@index([status])
}

enum StoreCreditStatus {
  ACTIVE      // Vigente, tiene saldo
  USED        // Usado completamente
  EXPIRED     // Venció
  CANCELLED   // Anulado
}

model StoreCreditTx {
  id              String            @id @default(cuid())
  storeCreditId   String

  type            StoreCreditTxType
  amount          Decimal           @db.Decimal(12, 2)
  balanceAfter    Decimal           @db.Decimal(12, 2)

  // Referencia
  saleId          String?                    // Venta donde se usó
  description     String?

  // Relaciones
  storeCredit     StoreCredit       @relation(fields: [storeCreditId], references: [id])
  sale            Sale?             @relation(fields: [saleId], references: [id])

  createdAt       DateTime          @default(now())

  @@index([storeCreditId])
}

enum StoreCreditTxType {
  ISSUED        // Emisión inicial
  REDEEMED      // Uso en venta
  EXPIRED       // Expiración
  CANCELLED     // Cancelación
  ADJUSTED      // Ajuste manual
}
```

### Modificaciones a Entidades Existentes

#### Payment - Agregar relación a StoreCredit
```prisma
model Payment {
  // ... campos existentes ...

  storeCreditId   String?
  storeCredit     StoreCredit?     @relation(fields: [storeCreditId], references: [id])
}
```

#### Sale - Agregar relación a créditos emitidos
```prisma
model Sale {
  // ... campos existentes ...

  creditsIssued   StoreCredit[]    @relation("SaleCreditIssued")
}
```

#### Configuración del Tenant
```prisma
// Agregar campos a TenantSettings o crear StoreCreditConfig
storeCreditExpirationDays   Int      @default(90)   // 0 = sin vencimiento
storeCreditPrefix           String   @default("VAL")
storeCreditRequireCustomer  Boolean  @default(false) // Si requiere cliente registrado
```

---

## UI del POS

### Ítems Negativos en el Carrito

```typescript
interface CartItem {
  // ... campos existentes ...
  isReturn: boolean              // true = devolución
  originalSaleId?: string        // Venta original
  originalSaleItemId?: string    // Item original
  returnReason?: string          // Motivo de devolución
}
```

**Visual:**
- Fondo rojo suave para ítems de devolución
- Cantidad y precio en negativo
- Icono ↩ para identificar devoluciones
- No editable (cantidad fija de venta original)
- Se puede quitar del carrito

**Restricción:** No mezclar devoluciones de diferentes ventas originales en un ticket.

### Comportamiento del Botón "Cobrar"

| Total | Acción |
|-------|--------|
| > 0 | Flujo normal de cobro |
| = 0 | "Cambio exacto - Confirmar" |
| < 0 | Opciones: "Generar Vale" (principal) / "Devolver Efectivo" (supervisor) |

### Modal de Cobro - Método Vale/Crédito

1. Seleccionar "Vale/Crédito" como método de pago
2. Escanear código de barras o ingresar manual
3. Validar: existe, activo, no vencido, tiene saldo
4. Mostrar: código, saldo disponible, vencimiento
5. Aplicar monto (parcial o total)
6. Registrar en Payment con `method=VOUCHER` y `storeCreditId`

---

## Impresión del Vale

```
═══════════════════════════════════════
          VALE DE CRÉDITO
═══════════════════════════════════════
Código: VAL-001-2026-A1B2

          [CÓDIGO DE BARRAS]

Monto: $4.540,00

Emitido: 05/01/2026
Vence:   05/04/2026

Cliente: María García
         (o "Al portador")

Origen: Devolución ticket #SUC-001-2026-0123
───────────────────────────────────────
Presentar este vale para su uso.
Válido únicamente en nuestras sucursales.
═══════════════════════════════════════
```

**Formato código:** `{PREFIX}-{SUCURSAL}-{AÑO}-{RANDOM4}`
**Código de barras:** Code128

---

## Endpoints API

### Vales/Créditos

```
POST   /api/store-credits              # Crear vale (desde devolución)
GET    /api/store-credits/:code        # Consultar vale por código
GET    /api/store-credits              # Listar vales (filtros: status, customer, branch)
POST   /api/store-credits/:id/redeem   # Usar vale (parcial o total)
POST   /api/store-credits/:id/cancel   # Cancelar vale
GET    /api/store-credits/:id/transactions  # Historial de movimientos
```

### Devoluciones (modificar existente)

```
POST   /api/sales/:id/refund
Body: {
  items: [...],
  reason: string,
  refundType: 'STORE_CREDIT' | 'CASH' | 'EXCHANGE',
  supervisorPin?: string,        // Requerido si CASH
  emitCreditNote: boolean
}
Response: {
  refundSale: Sale,
  storeCredit?: StoreCredit,     // Si generó vale
  creditNote?: AfipInvoice       // Si emitió NDC
}
```

---

## Fases de Implementación

### Fase 1: Vales Locales (MVP)
1. Modelo de datos StoreCredit
2. UI ítems negativos en carrito
3. Generación de vale al cobrar con total negativo
4. Impresión de vale
5. Uso de vale como método de pago
6. Consulta y gestión de vales en backoffice

### Fase 2: Sincronización Cianbox (futuro)
1. API Cianbox para enviar NDC
2. API Cianbox para enviar recibos
3. Sincronización de vales emitidos como NDC
4. Sincronización de vales usados en recibos
5. Consulta de cuenta corriente desde Cianbox

---

## Validaciones y Reglas de Negocio

1. **Devolución en efectivo:** Requiere PIN de supervisor
2. **Vale vencido:** No se puede usar, mostrar fecha de vencimiento
3. **Vale de otro tenant:** Rechazar
4. **Vale parcialmente usado:** Mantener saldo restante
5. **Mezcla de devoluciones:** No permitir de diferentes ventas originales
6. **Monto máximo devolución:** No puede superar el monto original de la venta
7. **Producto ya devuelto:** Validar cantidad disponible para devolver

---

## Configuración por Tenant

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| storeCreditExpirationDays | 90 | Días de vigencia (0 = sin vencimiento) |
| storeCreditPrefix | "VAL" | Prefijo del código |
| storeCreditRequireCustomer | false | Si requiere cliente para emitir |
| allowCashRefund | true | Si permite devolución en efectivo |
| cashRefundRequiresSupervisor | true | Si efectivo requiere supervisor |
