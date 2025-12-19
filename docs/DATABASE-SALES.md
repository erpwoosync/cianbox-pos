# Modelo de Datos - Ventas y Pagos

Documentación de los modelos relacionados con ventas, cobros y promociones.

## Índice
- [Ventas](#ventas)
- [Items de Venta](#items-de-venta)
- [Pagos](#pagos)
- [Promociones](#promociones)
- [Combos](#combos)
- [Mercado Pago](#mercado-pago)

---

## Ventas

### Sale
Venta completada en el sistema.

```prisma
model Sale {
  id              String      @id @default(cuid())
  tenantId        String
  branchId        String
  pointOfSaleId   String
  userId          String      // Cajero
  customerId      String?     // Cliente (opcional)
  cashSessionId   String?     // Turno de caja activo

  // Numeración
  saleNumber      String      // "SUC-001-CAJA-01-20241219-0001"
  receiptType     ReceiptType @default(TICKET)
  fiscalNumber    String?     // CAE, etc

  // Montos
  subtotal        Decimal     @db.Decimal(12, 2)
  discount        Decimal     @default(0) @db.Decimal(12, 2)
  tax             Decimal     @default(0) @db.Decimal(12, 2)
  total           Decimal     @db.Decimal(12, 2)

  // Estado
  status          SaleStatus  @default(COMPLETED)

  // Referencia
  cianboxSaleId   Int?
  notes           String?
  metadata        Json        @default("{}")

  // Timestamps
  saleDate        DateTime    @default(now())
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  cancelledAt     DateTime?
  cancelledBy     String?
  cancelReason    String?

  // Relaciones
  tenant           Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch           Branch            @relation(fields: [branchId], references: [id])
  pointOfSale      PointOfSale       @relation(fields: [pointOfSaleId], references: [id])
  user             User              @relation(fields: [userId], references: [id])
  customer         Customer?         @relation(fields: [customerId], references: [id])
  cashSession      CashSession?      @relation(fields: [cashSessionId], references: [id])
  items            SaleItem[]
  payments         Payment[]
  mercadoPagoOrder MercadoPagoOrder?

  @@unique([tenantId, saleNumber])
  @@index([tenantId, saleDate])
  @@index([tenantId, branchId, saleDate])
  @@index([tenantId, customerId])
  @@index([cashSessionId])
}

enum ReceiptType {
  TICKET          // Ticket simple
  INVOICE_A       // Factura A
  INVOICE_B       // Factura B
  INVOICE_C       // Factura C
  CREDIT_NOTE_A   // Nota de crédito A
  CREDIT_NOTE_B
  CREDIT_NOTE_C
  RECEIPT         // Recibo
}

enum SaleStatus {
  PENDING         // Pendiente (carrito)
  COMPLETED       // Completada
  CANCELLED       // Anulada
  REFUNDED        // Devuelta (total)
  PARTIAL_REFUND  // Devolución parcial
}
```

**Generación de Número de Venta:**

```typescript
async function generateSaleNumber(
  tenantId: string,
  branchId: string,
  pointOfSaleId: string
): Promise<string> {
  const pos = await prisma.pointOfSale.findUnique({
    where: { id: pointOfSaleId },
    include: { branch: true }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.sale.count({
    where: {
      tenantId,
      pointOfSaleId,
      createdAt: { gte: today }
    }
  });

  // Formato: SUCURSAL-POS-YYYYMMDD-NNNN
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = String(count + 1).padStart(4, '0');

  return `${pos.branch.code}-${pos.code}-${dateStr}-${sequence}`;
}
```

**Crear Venta:**

```typescript
const sale = await prisma.sale.create({
  data: {
    tenantId,
    branchId,
    pointOfSaleId,
    userId,
    customerId,
    cashSessionId,
    saleNumber: await generateSaleNumber(tenantId, branchId, pointOfSaleId),
    receiptType: 'TICKET',
    subtotal: 100,
    discount: 10,
    tax: 18.9,
    total: 108.9,
    status: 'COMPLETED',
    items: {
      create: [
        {
          productId: 'prod-001',
          productName: 'Coca Cola 500ml',
          quantity: 1,
          unitPrice: 100,
          subtotal: 100,
          taxRate: 21,
          taxAmount: 17.36
        }
      ]
    },
    payments: {
      create: [
        {
          method: 'CASH',
          amount: 108.9,
          status: 'COMPLETED'
        }
      ]
    }
  },
  include: {
    items: true,
    payments: true
  }
});
```

**Anular Venta:**

```typescript
await prisma.$transaction(async (tx) => {
  // Marcar venta como cancelada
  await tx.sale.update({
    where: { id: saleId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancelReason: reason
    }
  });

  // Restaurar stock
  const items = await tx.saleItem.findMany({
    where: { saleId }
  });

  for (const item of items) {
    if (item.productId) {
      await tx.productStock.updateMany({
        where: {
          productId: item.productId,
          branchId: sale.branchId
        },
        data: {
          quantity: { increment: item.quantity },
          available: { increment: item.quantity }
        }
      });
    }
  }

  // Cancelar pagos
  await tx.payment.updateMany({
    where: { saleId },
    data: { status: 'CANCELLED' }
  });
});
```

---

## Items de Venta

### SaleItem
Detalle de productos en una venta.

```prisma
model SaleItem {
  id            String   @id @default(cuid())
  saleId        String
  productId     String?
  comboId       String?

  // Datos desnormalizados (al momento de venta)
  productCode   String?
  productName   String
  productBarcode String?

  // Cantidades y precios
  quantity      Decimal  @db.Decimal(12, 3)
  unitPrice     Decimal  @db.Decimal(12, 2) // CON IVA
  unitPriceNet  Decimal? @db.Decimal(12, 2) // SIN IVA
  discount      Decimal  @default(0) @db.Decimal(12, 2)
  subtotal      Decimal  @db.Decimal(12, 2)
  taxRate       Decimal  @default(21) @db.Decimal(5, 2)
  taxAmount     Decimal  @default(0) @db.Decimal(12, 2)

  // IDs para sincronización
  priceListId   String?
  branchId      String?

  // Promoción aplicada
  promotionId   String?
  promotionName String?

  isReturn      Boolean  @default(false)
  createdAt     DateTime @default(now())

  sale      Sale       @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product   Product?   @relation(fields: [productId], references: [id])
  combo     Combo?     @relation(fields: [comboId], references: [id])
  promotion Promotion? @relation(fields: [promotionId], references: [id])
  priceList PriceList? @relation(fields: [priceListId], references: [id])
  branch    Branch?    @relation(fields: [branchId], references: [id])

  @@index([saleId])
  @@index([productId])
}
```

**Cálculo de Montos:**

```typescript
// Calcular subtotal e impuestos
function calculateSaleItem(
  unitPrice: number,
  quantity: number,
  discount: number,
  taxRate: number
) {
  const subtotal = (unitPrice * quantity) - discount;
  const taxAmount = subtotal * (taxRate / 121); // IVA incluido
  const unitPriceNet = unitPrice / (1 + taxRate / 100);

  return {
    subtotal,
    taxAmount,
    unitPriceNet
  };
}

// Ejemplo
const item = calculateSaleItem(121, 2, 10, 21);
// subtotal: 232
// taxAmount: 40.13
// unitPriceNet: 100
```

---

## Pagos

### Payment
Pagos de una venta.

```prisma
model Payment {
  id            String        @id @default(cuid())
  saleId        String
  method        PaymentMethod
  amount        Decimal       @db.Decimal(12, 2)

  // Detalles según método
  reference     String?
  cardBrand     String?
  cardLastFour  String?
  installments  Int           @default(1)

  // Efectivo
  amountTendered Decimal?     @db.Decimal(12, 2)
  changeAmount   Decimal?     @db.Decimal(12, 2)

  // QR / Transferencia
  transactionId String?
  providerData  Json?

  // === MERCADO PAGO ===
  mpPaymentId       String?
  mpOrderId         String?
  mpOperationType   String?
  mpPointType       String?   // POINT, INSTORE

  // Tarjeta
  cardFirstSix      String?
  cardExpirationMonth Int?
  cardExpirationYear  Int?
  cardholderName    String?
  cardType          String?   // credit, debit

  // Pagador
  payerEmail        String?
  payerIdType       String?
  payerIdNumber     String?

  // Autorización
  authorizationCode String?

  // Montos
  mpFeeAmount       Decimal?  @db.Decimal(12, 2)
  mpFeeRate         Decimal?  @db.Decimal(5, 2)
  netReceivedAmount Decimal?  @db.Decimal(12, 2)

  // Transferencia bancaria (QR)
  bankOriginId      String?
  bankOriginName    String?
  bankTransferId    String?

  // Dispositivo
  mpDeviceId        String?
  mpPosId           String?
  mpStoreId         String?

  status        PaymentStatus @default(COMPLETED)
  createdAt     DateTime      @default(now())

  sale Sale @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([saleId])
  @@index([mpPaymentId])
}

enum PaymentMethod {
  CASH          // Efectivo
  CREDIT_CARD   // Tarjeta de crédito
  DEBIT_CARD    // Tarjeta de débito
  QR            // QR (MercadoPago, etc)
  MP_POINT      // Mercado Pago Point (terminal)
  TRANSFER      // Transferencia bancaria
  CHECK         // Cheque
  CREDIT        // Cuenta corriente (fiado)
  VOUCHER       // Vale/Voucher
  GIFTCARD      // Tarjeta de regalo
  POINTS        // Puntos de fidelidad
  OTHER
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}
```

**Pago en Efectivo:**

```typescript
{
  method: 'CASH',
  amount: 100,
  amountTendered: 150,  // Cliente entregó $150
  changeAmount: 50,     // Vuelto: $50
  status: 'COMPLETED'
}
```

**Pago con Tarjeta (MP Point):**

```typescript
{
  method: 'CREDIT_CARD',
  amount: 100,
  reference: '12345678',
  cardBrand: 'visa',
  cardLastFour: '4242',
  installments: 3,
  mpPaymentId: '138523920736',
  mpOrderId: 'ORD12345',
  mpOperationType: 'pos_payment',
  mpPointType: 'POINT',
  cardFirstSix: '424242',
  cardExpirationMonth: 12,
  cardExpirationYear: 2025,
  cardholderName: 'JUAN PEREZ',
  cardType: 'credit',
  authorizationCode: '123456',
  mpFeeAmount: 5.5,
  mpFeeRate: 5.5,
  netReceivedAmount: 94.5,
  mpDeviceId: 'PAX_A910__SMARTPOS1234567890',
  status: 'COMPLETED'
}
```

**Pago QR con Transferencia:**

```typescript
{
  method: 'QR',
  amount: 100,
  transactionId: '138523920736',
  mpPaymentId: '138523920736',
  mpOrderId: 'in-store-order-123',
  mpOperationType: 'regular_payment',
  mpPointType: 'INSTORE',
  payerEmail: 'cliente@email.com',
  payerIdType: 'DNI',
  payerIdNumber: '12345678',
  bankOriginId: '011',
  bankOriginName: 'Banco de la Nación Argentina',
  bankTransferId: '987654321',
  mpFeeAmount: 3.5,
  netReceivedAmount: 96.5,
  status: 'COMPLETED'
}
```

---

## Promociones

### Promotion
Promociones y descuentos.

```prisma
model Promotion {
  id             String          @id @default(cuid())
  tenantId       String
  code           String?
  name           String
  description    String?
  type           PromotionType

  // Configuración
  discountType   DiscountType    @default(PERCENTAGE)
  discountValue  Decimal         @db.Decimal(12, 2)
  buyQuantity    Int?            // Para 2x1: buyQuantity=2
  getQuantity    Int?            // Para 2x1: getQuantity=1
  minPurchase    Decimal?        @db.Decimal(12, 2)
  maxDiscount    Decimal?        @db.Decimal(12, 2)

  // Aplicación
  applyTo        PromotionApplyTo @default(SPECIFIC_PRODUCTS)
  categoryIds    String[]
  brandIds       String[]

  // Vigencia
  startDate      DateTime?
  endDate        DateTime?
  daysOfWeek     Int[]           // 0=Dom, 1=Lun...
  startTime      String?         // "09:00"
  endTime        String?         // "18:00"

  // Límites
  maxUses        Int?
  maxUsesPerCustomer Int?
  currentUses    Int             @default(0)

  // Estado
  isActive       Boolean         @default(true)
  priority       Int             @default(0)
  stackable      Boolean         @default(false)

  // Apariencia
  badgeColor     String?         // "#FF0000"

  // Metadatos
  metadata       Json            @default("{}")

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  applicableProducts PromotionProduct[]
  saleItems          SaleItem[]

  @@unique([tenantId, code])
  @@index([tenantId, isActive, startDate, endDate])
}

enum PromotionType {
  PERCENTAGE           // % de descuento
  FIXED_AMOUNT         // Monto fijo de descuento
  BUY_X_GET_Y          // Compra X lleva Y (2x1)
  SECOND_UNIT_DISCOUNT // 2da unidad al X%
  BUNDLE_PRICE         // Precio especial por combo
  FREE_SHIPPING        // Envío gratis
  COUPON               // Cupón de descuento
  FLASH_SALE           // Venta flash (BlackFriday)
  LOYALTY              // Programa de fidelidad
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
  FIXED_PRICE
}

enum PromotionApplyTo {
  ALL_PRODUCTS
  SPECIFIC_PRODUCTS
  CATEGORIES
  BRANDS
  CART_TOTAL
}
```

**Ejemplos de Promociones:**

```typescript
// 2x1 en Bebidas
{
  name: "2x1 en Bebidas",
  type: "BUY_X_GET_Y",
  buyQuantity: 2,
  getQuantity: 1,
  applyTo: "CATEGORIES",
  categoryIds: ["cat-bebidas"],
  startDate: "2024-12-01",
  endDate: "2024-12-31",
  isActive: true
}

// 2da unidad al 50%
{
  name: "2da unidad al 50%",
  type: "SECOND_UNIT_DISCOUNT",
  discountType: "PERCENTAGE",
  discountValue: 50,
  applyTo: "SPECIFIC_PRODUCTS",
  isActive: true
}

// BlackFriday: 20% en todo
{
  name: "BlackFriday 20% OFF",
  type: "FLASH_SALE",
  discountType: "PERCENTAGE",
  discountValue: 20,
  applyTo: "ALL_PRODUCTS",
  startDate: "2024-11-29T00:00:00Z",
  endDate: "2024-11-29T23:59:59Z",
  badgeColor: "#000000",
  isActive: true
}

// Happy Hour: 15% de 18 a 20hs
{
  name: "Happy Hour 15%",
  type: "PERCENTAGE",
  discountType: "PERCENTAGE",
  discountValue: 15,
  applyTo: "CATEGORIES",
  categoryIds: ["cat-bebidas"],
  daysOfWeek: [5, 6], // Viernes y Sábado
  startTime: "18:00",
  endTime: "20:00",
  isActive: true
}
```

**Validar si Promoción es Aplicable:**

```typescript
function isPromotionApplicable(
  promotion: Promotion,
  product: Product,
  now: Date = new Date()
): boolean {
  // Verificar si está activa
  if (!promotion.isActive) return false;

  // Verificar fecha
  if (promotion.startDate && now < promotion.startDate) return false;
  if (promotion.endDate && now > promotion.endDate) return false;

  // Verificar día de la semana
  if (promotion.daysOfWeek.length > 0) {
    const dayOfWeek = now.getDay();
    if (!promotion.daysOfWeek.includes(dayOfWeek)) return false;
  }

  // Verificar hora
  if (promotion.startTime || promotion.endTime) {
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
    if (promotion.startTime && currentTime < promotion.startTime) return false;
    if (promotion.endTime && currentTime > promotion.endTime) return false;
  }

  // Verificar límite de usos
  if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
    return false;
  }

  // Verificar aplicabilidad
  switch (promotion.applyTo) {
    case 'ALL_PRODUCTS':
      return true;
    case 'SPECIFIC_PRODUCTS':
      return promotion.applicableProducts.some(p => p.productId === product.id);
    case 'CATEGORIES':
      return product.categoryId && promotion.categoryIds.includes(product.categoryId);
    case 'BRANDS':
      return product.brandId && promotion.brandIds.includes(product.brandId);
    default:
      return false;
  }
}
```

### PromotionProduct
Productos en promoción (relación many-to-many).

```prisma
model PromotionProduct {
  id          String @id @default(cuid())
  promotionId String
  productId   String

  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([promotionId, productId])
}
```

---

## Combos

### Combo
Packs de productos.

```prisma
model Combo {
  id             String   @id @default(cuid())
  tenantId       String
  code           String
  name           String
  description    String?
  imageUrl       String?

  regularPrice   Decimal  @db.Decimal(12, 2) // Suma de precios individuales
  comboPrice     Decimal  @db.Decimal(12, 2) // Precio del combo

  startDate      DateTime?
  endDate        DateTime?

  isActive       Boolean  @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  tenant    Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  items     ComboItem[]
  saleItems SaleItem[]

  @@unique([tenantId, code])
}

model ComboItem {
  id        String @id @default(cuid())
  comboId   String
  productId String
  quantity  Int    @default(1)

  combo   Combo   @relation(fields: [comboId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([comboId, productId])
}
```

**Ejemplo de Combo:**

```typescript
// Combo Familiar: 2 Pizzas + 2 Gaseosas
{
  code: "COMBO-001",
  name: "Combo Familiar",
  regularPrice: 5000,  // Suma individual: $5000
  comboPrice: 4000,    // Precio combo: $4000 (20% off)
  items: [
    { productId: "pizza-muzza", quantity: 2 },
    { productId: "coca-2lt", quantity: 2 }
  ],
  isActive: true
}
```

---

## Mercado Pago

### MercadoPagoConfig
Configuración OAuth de Mercado Pago.

```prisma
model MercadoPagoConfig {
  id              String              @id @default(cuid())
  tenantId        String

  // Tipo de aplicación
  appType         MercadoPagoAppType  @default(POINT)
  appId           String?

  // OAuth Tokens
  accessToken     String
  refreshToken    String?
  tokenExpiresAt  DateTime?

  // Datos del usuario
  mpUserId        String?
  publicKey       String?
  scope           String?

  // Configuración
  webhookSecret   String?
  isActive        Boolean             @default(true)
  environment     String              @default("production")

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, appType])
  @@index([tenantId])
}

enum MercadoPagoAppType {
  POINT  // Terminales Point (cobro con tarjeta)
  QR     // Código QR (billetera virtual)
}
```

### MercadoPagoOrder
Órdenes de pago en Mercado Pago.

```prisma
model MercadoPagoOrder {
  id                String   @id @default(cuid())
  tenantId          String
  saleId            String?  @unique
  orderId           String   @unique // ID de MP
  externalReference String
  deviceId          String   // device_id del terminal
  amount            Decimal  @db.Decimal(12, 2)
  status            String   // PENDING, PROCESSED, CANCELED, FAILED
  paymentId         String?
  paymentMethod     String?
  cardBrand         String?
  cardLastFour      String?
  installments      Int?
  responseData      Json?
  errorMessage      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  processedAt       DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sale   Sale?  @relation(fields: [saleId], references: [id])

  @@index([tenantId, status])
  @@index([tenantId, createdAt])
}
```

**Flujo de Pago con MP Point:**

```typescript
// 1. Crear orden
const order = await mercadoPagoService.createPointOrder({
  tenantId,
  deviceId: pos.mpDeviceId,
  amount: saleTotal,
  externalReference: `POS-001-20241219-0001`,
  description: 'Venta POS'
});

// 2. Polling del estado
const interval = setInterval(async () => {
  const status = await mercadoPagoService.getOrderStatus(tenantId, order.orderId);

  if (status.status === 'PROCESSED') {
    clearInterval(interval);
    // Completar venta
    await createSale({
      ...saleData,
      payments: [{
        method: 'MP_POINT',
        amount: saleTotal,
        mpPaymentId: status.paymentId,
        mpOrderId: order.orderId,
        cardBrand: status.cardBrand,
        cardLastFour: status.cardLastFour,
        installments: status.installments
      }]
    });
  }
}, 2000);
```

---

**Ver también:**
- [DATABASE-CORE.md](./DATABASE-CORE.md) - Modelos fundamentales
- [DATABASE-CASH.md](./DATABASE-CASH.md) - Sistema de caja
- [API-SALES.md](./API-SALES.md) - Endpoints de ventas
- [API-MERCADOPAGO.md](./API-MERCADOPAGO.md) - Integración Mercado Pago
