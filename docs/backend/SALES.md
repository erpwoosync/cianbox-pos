# Ventas y Pagos - Cianbox POS

**Sistema completo de ventas con múltiples métodos de pago y gestión de estados**

## Modelos de Datos

### Sale

Cabecera de venta.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único de la venta |
| tenantId | String | ID del tenant |
| saleNumber | String | Número de venta (secuencial por POS) |
| branchId | String | Sucursal donde se realizó |
| pointOfSaleId | String | Punto de venta |
| cashSessionId | String? | Turno de caja asociado |
| userId | String | Usuario que realizó la venta |
| customerId | String? | Cliente (opcional) |
| priceListId | String? | Lista de precios utilizada |
| saleDate | DateTime | Fecha/hora de venta |
| status | SaleStatus | Estado actual |
| subtotal | Decimal | Subtotal sin descuentos |
| discountPercent | Decimal | % de descuento global |
| discountAmount | Decimal | Monto de descuento |
| taxAmount | Decimal | Monto de IVA |
| total | Decimal | Total final |
| notes | String? | Notas de la venta |
| invoiceType | InvoiceType? | A, B, C, null |
| invoiceNumber | String? | Número de factura |
| refundReason | String? | Razón de devolución |

**SaleStatus:** `PENDING`, `COMPLETED`, `CANCELLED`, `REFUNDED`, `PARTIAL_REFUND`

**Relaciones:**
- Pertenece a `Tenant`, `Branch`, `PointOfSale`, `User`, `Customer`
- Tiene muchos `SaleItem` (items de venta)
- Tiene muchos `Payment` (pagos)

### SaleItem

Items individuales de la venta.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| saleId | String | Venta asociada |
| productId | String | Producto vendido |
| name | String | Nombre del producto (snapshot) |
| sku | String? | SKU (snapshot) |
| quantity | Decimal | Cantidad vendida |
| unitPrice | Decimal | Precio unitario CON IVA |
| subtotal | Decimal | quantity * unitPrice |
| discountPercent | Decimal | % de descuento aplicado |
| discountAmount | Decimal | Monto de descuento |
| taxRate | Decimal | % de IVA |
| taxAmount | Decimal | Monto de IVA |
| total | Decimal | Total del item |

### Payment

Pagos de la venta (puede haber múltiples).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| saleId | String | Venta asociada |
| method | PaymentMethod | Método de pago |
| amount | Decimal | Monto del pago |
| receivedAmount | Decimal? | Monto recibido (efectivo) |
| changeAmount | Decimal? | Vuelto |
| status | PaymentStatus | Estado del pago |
| reference | String? | Referencia/Comprobante |
| mpOrderId | String? | ID de orden Mercado Pago |

**PaymentMethod:** `CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `QR`, `MP_POINT`, `TRANSFER`, `OTHER`

**PaymentStatus:** `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`

## Endpoints

### POST /api/sales

Crear nueva venta.

**Autenticación:** Bearer token + permiso `pos:sell`

**Request:**
```json
{
  "pointOfSaleId": "pos123",
  "customerId": "cust456",
  "items": [
    {
      "productId": "prod789",
      "quantity": 2,
      "unitPrice": 15999.00
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 31998.00,
      "receivedAmount": 35000.00
    }
  ]
}
```

**Response:** Sale completa con items y payments

### GET /api/sales

Listar ventas con filtros.

**Query Parameters:**
- `branchId`, `pointOfSaleId`, `userId`, `customerId`
- `status` - Filtrar por estado
- `dateFrom`, `dateTo` - Rango de fechas
- `page`, `pageSize` - Paginación

### GET /api/sales/:id

Obtener detalle de una venta.

### POST /api/sales/:id/cancel

Cancelar una venta.

**Autenticación:** Bearer token + permiso `pos:cancel`

**Request:**
```json
{
  "reason": "Error en el precio"
}
```

### POST /api/sales/:id/refund

Crear devolución de una venta.

**Autenticación:** Bearer token + permiso `pos:refund`

**Request:**
```json
{
  "reason": "Cliente no satisfecho",
  "items": [
    { "saleItemId": "item1", "quantity": 1 }
  ]
}
```

## Flujo de Venta

```
1. Agregar productos al carrito (POS)
   ↓
2. Aplicar descuentos y promociones
   ↓
3. Seleccionar método(s) de pago
   ↓
4. POST /sales - crear venta
   ↓
5. Backend:
   - Validar productos y stock
   - Calcular totales
   - Crear Sale, SaleItems, Payments
   - Reservar/descontar stock
   - Asociar a CashSession
   ↓
6. Retornar venta completada
   ↓
7. Frontend: Imprimir ticket
```

## Reglas de Negocio

### Cálculo de Totales

```typescript
// Por item
item.subtotal = item.quantity * item.unitPrice;
item.discountAmount = item.subtotal * (item.discountPercent / 100);
item.taxAmount = (item.subtotal - item.discountAmount) * (item.taxRate / 100);
item.total = item.subtotal - item.discountAmount;

// Sale
sale.subtotal = sum(items.subtotal);
sale.discountAmount = sale.subtotal * (sale.discountPercent / 100);
sale.total = sale.subtotal - sale.discountAmount;
```

### Pagos Múltiples

Una venta puede tener múltiples pagos:

```json
{
  "payments": [
    { "method": "CASH", "amount": 20000 },
    { "method": "DEBIT_CARD", "amount": 11998 }
  ]
}
```

**Validación:** `sum(payments.amount) >= sale.total`

### Gestión de Stock

**Al crear venta:**
- Si hay turno activo: `reserved += quantity`
- Si no hay turno: `quantity -= quantity` inmediatamente

**Al cancelar venta:**
- Devolver stock: `quantity += quantity`

## Ejemplo Completo

```typescript
const sale = await prisma.sale.create({
  data: {
    tenantId,
    branchId,
    pointOfSaleId,
    userId,
    saleNumber: await generateSaleNumber(tenantId, pointOfSaleId),
    saleDate: new Date(),
    status: 'COMPLETED',
    total: new Prisma.Decimal(15999),
    items: {
      create: [{
        productId: 'prod123',
        name: 'Remera Nike',
        quantity: 1,
        unitPrice: 15999,
        total: 15999
      }]
    },
    payments: {
      create: [{
        method: 'CASH',
        amount: 15999,
        receivedAmount: 20000,
        changeAmount: 4001,
        status: 'COMPLETED'
      }]
    }
  },
  include: { items: true, payments: true }
});
```
