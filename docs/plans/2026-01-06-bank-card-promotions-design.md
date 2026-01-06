# Diseño: Sistema de Promociones Bancarias para Tarjetas de Crédito

**Fecha:** 2026-01-06
**Estado:** Aprobado

## Resumen

Sistema para gestionar promociones bancarias de cuotas con tarjeta de crédito, incluyendo:
- Cuotas sin interés por combinación banco + tarjeta
- Coeficientes de recargo por cantidad de cuotas
- Vigencias por fecha y día de semana
- Reintegros bancarios (informativo)
- Ítem de recargo financiero en carrito

## Modelos de Datos

### Bank (Nuevo)

```prisma
model Bank {
  id        String   @id @default(cuid())
  tenantId  String
  name      String   // "Banco Macro"
  code      String   // "MACRO"
  isActive  Boolean  @default(true)

  tenant     Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  promotions BankCardPromotion[]
  payments   Payment[]

  @@unique([tenantId, code])
  @@map("banks")
}
```

### CardBrand (Modificar)

Agregar campos para configuración de cuotas:

```prisma
model CardBrand {
  // ... campos existentes ...

  maxInstallments   Int     @default(12)  // 12, 18, o 24
  installmentRates  Json    @default("[]") // [{installment: 1, rate: 0}, {installment: 2, rate: 5}, ...]

  promotions BankCardPromotion[]
}
```

**Estructura de installmentRates:**
```json
[
  {"installment": 1, "rate": 0},
  {"installment": 2, "rate": 5},
  {"installment": 3, "rate": 8},
  {"installment": 6, "rate": 15},
  {"installment": 12, "rate": 30},
  {"installment": 18, "rate": 48},
  {"installment": 24, "rate": 65}
]
```

### BankCardPromotion (Nuevo)

```prisma
model BankCardPromotion {
  id          String   @id @default(cuid())
  tenantId    String
  name        String   // "Visa Macro - 6 cuotas sin interés"
  description String?

  // Relaciones
  bankId      String
  cardBrandId String

  // Configuración de cuotas sin interés
  interestFreeInstallments Int[]  // [1, 2, 3, 4, 5, 6]

  // Reintegro bancario (informativo)
  cashbackPercent     Decimal?  @db.Decimal(5, 2)  // 15.00 = 15%
  cashbackDescription String?   // "Reintegro en próximo resumen"

  // Vigencia
  startDate   DateTime?  // null = sin fecha inicio
  endDate     DateTime?  // null = sin fecha fin
  daysOfWeek  Int[]      // [1, 3, 5] = Lun, Mié, Vie. Vacío = todos

  // Estado
  isActive    Boolean  @default(true)
  priority    Int      @default(0)  // Mayor = mayor prioridad

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relaciones
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  bank      Bank      @relation(fields: [bankId], references: [id], onDelete: Cascade)
  cardBrand CardBrand @relation(fields: [cardBrandId], references: [id], onDelete: Cascade)
  payments  Payment[]

  @@index([tenantId, isActive])
  @@map("bank_card_promotions")
}
```

### SaleItem (Modificar)

Agregar campo para identificar recargos:

```prisma
model SaleItem {
  // ... campos existentes ...

  isSurcharge Boolean @default(false)  // true = recargo financiero
}
```

### Payment (Modificar)

Agregar campos para promoción bancaria:

```prisma
model Payment {
  // ... campos existentes ...

  bankId            String?
  bankPromotionId   String?
  surchargeRate     Decimal?  @db.Decimal(5, 2)   // 30.00 = 30%
  surchargeAmount   Decimal?  @db.Decimal(12, 2)  // Monto del recargo

  bank          Bank?              @relation(fields: [bankId], references: [id])
  bankPromotion BankCardPromotion? @relation(fields: [bankPromotionId], references: [id])
}
```

## Lógica de Negocio

### Cálculo de Recargo en POS

```typescript
function calculateInstallmentPrice(
  amount: number,
  installments: number,
  cardBrand: CardBrand,
  activePromotion: BankCardPromotion | null
): { installmentPrice: number; surchargeRate: number; surchargeAmount: number } {

  // Si hay promo activa y las cuotas están en sin interés
  if (activePromotion?.interestFreeInstallments.includes(installments)) {
    return {
      installmentPrice: amount / installments,
      surchargeRate: 0,
      surchargeAmount: 0
    };
  }

  // Buscar tasa de recargo en la configuración de la tarjeta
  const rateConfig = cardBrand.installmentRates.find(r => r.installment === installments);
  const rate = rateConfig?.rate || 0;

  const surchargeAmount = amount * (rate / 100);
  const totalWithSurcharge = amount + surchargeAmount;

  return {
    installmentPrice: totalWithSurcharge / installments,
    surchargeRate: rate,
    surchargeAmount
  };
}
```

### Obtener Promociones Vigentes

```typescript
function getActivePromotions(tenantId: string): BankCardPromotion[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Dom, 1=Lun...

  return prisma.bankCardPromotion.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } }
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } }
          ]
        }
      ]
    },
    include: {
      bank: true,
      cardBrand: true
    },
    orderBy: { priority: 'desc' }
  }).then(promos =>
    promos.filter(p =>
      p.daysOfWeek.length === 0 || p.daysOfWeek.includes(dayOfWeek)
    )
  );
}
```

### Crear Ítem de Recargo

Cuando hay recargo > 0, se agrega al carrito:

```typescript
const surchargeItem: SaleItem = {
  productId: null,
  cianboxProductId: "0",
  sku: "RECARGO-FINANCIERO",
  name: `Recargo financiero ${installments} cuotas (${surchargeRate}%)`,
  quantity: 1,
  unitPrice: surchargeAmount,
  subtotal: surchargeAmount,
  isSurcharge: true
};
```

## Interfaz de Usuario

### POS - CardPaymentModal Modificado

```
┌─────────────────────────────────────────┐
│ 💳 Pago con Tarjeta Crédito             │
├─────────────────────────────────────────┤
│ Banco:    [Banco Macro ▼]               │
│ Tarjeta:  [Visa ▼]                      │
│                                         │
│ 🎉 Promo activa: Hasta 6 cuotas s/int   │
│    💰 15% reintegro en resumen          │
│                                         │
│ Cuotas:                                 │
│  ○ 1 pago     - $10,000.00              │
│  ○ 3 cuotas   - $3,333.33 ✨ SIN INTERÉS│
│  ○ 6 cuotas   - $1,666.67 ✨ SIN INTERÉS│
│  ○ 12 cuotas  - $1,083.33 (+30%)        │
│                                         │
│ Total: $10,000.00                       │
│ (o $13,000.00 con 12 cuotas)            │
├─────────────────────────────────────────┤
│ [Cancelar]           [Confirmar Pago]   │
└─────────────────────────────────────────┘
```

### Backoffice - Nuevas Páginas

1. **`/banks`** - CRUD de bancos
   - Lista de bancos con activar/desactivar
   - Crear/editar banco (nombre, código)

2. **`/bank-promotions`** - CRUD de promociones bancarias
   - Filtros por banco, tarjeta, estado
   - Crear/editar promoción:
     - Seleccionar banco + tarjeta
     - Definir cuotas sin interés (checkboxes 1-24)
     - Reintegro opcional
     - Vigencia (fechas + días de semana)

3. **`/card-brands`** (modificar existente)
   - Agregar sección "Configuración de Cuotas"
   - Editar máximo de cuotas (12/18/24)
   - Tabla de coeficientes por cuota

## Rutas API

### Banks
- `GET /api/banks` - Listar bancos
- `POST /api/banks` - Crear banco
- `PUT /api/banks/:id` - Actualizar banco
- `DELETE /api/banks/:id` - Eliminar banco

### Bank Promotions
- `GET /api/bank-promotions` - Listar promociones (con filtros)
- `GET /api/bank-promotions/active` - Promociones vigentes (para POS)
- `POST /api/bank-promotions` - Crear promoción
- `PUT /api/bank-promotions/:id` - Actualizar promoción
- `DELETE /api/bank-promotions/:id` - Eliminar promoción

### Card Brands (actualizar)
- `PUT /api/card-brands/:id/installments` - Actualizar config de cuotas

## Sincronización con Cianbox

El ítem de recargo se envía a Cianbox con:
- `cianboxProductId: "0"`
- `name: "Recargo financiero X cuotas"`
- `quantity: 1`
- `price: surchargeAmount`

## Plan de Implementación

1. **Schema y migraciones** - Agregar modelos Bank, BankCardPromotion, modificar CardBrand, SaleItem, Payment
2. **Backend Banks** - CRUD de bancos
3. **Backend Promotions** - CRUD de promociones + endpoint activas
4. **Backend CardBrands** - Endpoint para config de cuotas
5. **Backoffice Banks** - Página de bancos
6. **Backoffice Promotions** - Página de promociones
7. **Backoffice CardBrands** - Editar config de cuotas
8. **POS CardPaymentModal** - Integrar selector banco/tarjeta y cálculo de promos
9. **POS Cart** - Agregar ítem recargo cuando aplique
10. **Backend Sales** - Guardar datos de promo y recargo
