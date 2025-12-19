# API - Ventas

Documentación de endpoints para gestión de ventas (creación, consulta, anulación, reportes).

## Descripción General

El módulo de ventas gestiona:
- Creación de ventas con múltiples items y pagos
- Aplicación automática de promociones
- Actualización de stock
- Generación de números de venta secuenciales
- Integración con Socket.io para notificaciones en tiempo real
- Anulación de ventas con reversión de stock

## Índice

1. [Crear Venta](#crear-venta)
2. [Listar Ventas](#listar-ventas)
3. [Detalle de Venta](#detalle-de-venta)
4. [Anular Venta](#anular-venta)
5. [Reporte Diario](#reporte-diario)
6. [Modelos de Datos](#modelos-de-datos)
7. [Flujo Completo](#flujo-completo)

---

## Crear Venta

### POST /api/sales

Crea una nueva venta con items y pagos.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos requeridos:** `pos:sell`

**Body:**
```json
{
  "branchId": "branch_001",
  "pointOfSaleId": "pos_001",
  "customerId": "customer_123",
  "receiptType": "TICKET",
  "items": [
    {
      "productId": "prod_001",
      "productCode": "SKU-001",
      "productName": "Producto 1",
      "productBarcode": "7798765432109",
      "quantity": 2,
      "unitPrice": 5000.00,
      "unitPriceNet": 4132.23,
      "discount": 0,
      "taxRate": 21,
      "promotionId": "promo_123",
      "promotionName": "2x1",
      "priceListId": "pricelist_001",
      "branchId": "branch_001"
    },
    {
      "productId": "prod_002",
      "productName": "Producto 2",
      "quantity": 1,
      "unitPrice": 3000.00,
      "discount": 300.00,
      "taxRate": 21
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 10000.00,
      "amountTendered": 10000.00
    },
    {
      "method": "MP_POINT",
      "amount": 3000.00,
      "transactionId": "123456789",
      "mpPaymentId": "123456789",
      "mpOrderId": "ORD-12345678",
      "cardBrand": "visa",
      "cardLastFour": "4242",
      "installments": 1,
      "mpFeeAmount": 89.70,
      "netReceivedAmount": 2910.30
    }
  ],
  "notes": "Cliente solicitó factura para siguiente compra"
}
```

**Campos de Item:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `productId` | string | No* | ID del producto (opcional si es venta manual) |
| `comboId` | string | No | ID del combo (alternativo a productId) |
| `productCode` | string | No | SKU del producto |
| `productName` | string | Sí | Nombre del producto |
| `productBarcode` | string | No | Código de barras |
| `quantity` | number | Sí | Cantidad vendida (> 0) |
| `unitPrice` | number | Sí | Precio unitario CON IVA |
| `unitPriceNet` | number | No | Precio unitario SIN IVA (se calcula si no viene) |
| `discount` | number | No | Descuento total del item (default: 0) |
| `taxRate` | number | No | Tasa de IVA en % (default: 21) |
| `promotionId` | string | No | ID de promoción aplicada |
| `promotionName` | string | No | Nombre de promoción |
| `priceListId` | string | No | ID de lista de precios usada |
| `branchId` | string | No | Sucursal del item (heredado de venta si no viene) |

**Campos de Payment:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `method` | enum | Sí | Método de pago (ver tabla) |
| `amount` | number | Sí | Monto del pago (> 0) |
| `reference` | string | No | Referencia/número de operación |
| `cardBrand` | string | No | Marca de tarjeta (visa, mastercard, etc.) |
| `cardLastFour` | string | No | Últimos 4 dígitos |
| `installments` | number | No | Cuotas (default: 1) |
| `amountTendered` | number | No | Monto entregado (solo CASH) |
| `transactionId` | string | No | ID de transacción externa |
| `mpPaymentId` | string | No | Payment ID de Mercado Pago |
| `mpOrderId` | string | No | Order ID de Mercado Pago |
| `mpFeeAmount` | number | No | Comisión de MP |
| `netReceivedAmount` | number | No | Monto neto recibido |

**Métodos de Pago:**
- `CASH` - Efectivo
- `CREDIT_CARD` - Tarjeta de crédito
- `DEBIT_CARD` - Tarjeta de débito
- `QR` - QR de Mercado Pago
- `MP_POINT` - Mercado Pago Point
- `TRANSFER` - Transferencia bancaria
- `CHECK` - Cheque
- `CREDIT` - Cuenta corriente
- `VOUCHER` - Vale/cupón
- `GIFTCARD` - Tarjeta de regalo
- `POINTS` - Puntos de fidelidad
- `OTHER` - Otro

**Tipos de Comprobante:**
- `TICKET` - Ticket de venta (default)
- `INVOICE_A` - Factura A
- `INVOICE_B` - Factura B
- `INVOICE_C` - Factura C
- `CREDIT_NOTE_A` - Nota de crédito A
- `CREDIT_NOTE_B` - Nota de crédito B
- `CREDIT_NOTE_C` - Nota de crédito C
- `RECEIPT` - Recibo

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "id": "sale_abc123",
    "tenantId": "tenant_001",
    "branchId": "branch_001",
    "pointOfSaleId": "pos_001",
    "userId": "user_123",
    "customerId": "customer_123",
    "saleNumber": "SUC001-POS001-20251219-0001",
    "receiptType": "TICKET",
    "saleDate": "2025-12-19T10:30:00Z",
    "subtotal": 13000.00,
    "discount": 300.00,
    "tax": 2223.14,
    "total": 12700.00,
    "status": "COMPLETED",
    "notes": "Cliente solicitó factura para siguiente compra",
    "createdAt": "2025-12-19T10:30:00Z",
    "items": [
      {
        "id": "item_001",
        "productId": "prod_001",
        "productName": "Producto 1",
        "quantity": 2,
        "unitPrice": 5000.00,
        "subtotal": 10000.00,
        "taxAmount": 1735.54
      }
    ],
    "payments": [
      {
        "id": "payment_001",
        "method": "CASH",
        "amount": 10000.00,
        "changeAmount": 0,
        "status": "COMPLETED"
      }
    ],
    "customer": {
      "id": "customer_123",
      "name": "Juan Pérez",
      "email": "juan@email.com"
    },
    "branch": {
      "id": "branch_001",
      "code": "SUC001",
      "name": "Sucursal Centro"
    },
    "pointOfSale": {
      "id": "pos_001",
      "code": "POS001",
      "name": "Caja 1"
    },
    "user": {
      "id": "user_123",
      "name": "María González"
    }
  }
}
```

**Validaciones:**
- El total de pagos debe ser >= al total de la venta
- Debe incluir al menos 1 item
- Debe incluir al menos 1 pago
- El punto de venta debe pertenecer al tenant
- La sucursal debe pertenecer al tenant
- Si se especifica `productId`, el producto debe existir

**Efectos secundarios:**
1. Se genera un número de venta secuencial: `{branchCode}-{posCode}-{YYYYMMDD}-{NNNN}`
2. Se actualiza el stock si el producto tiene `trackStock: true`
3. Se emite evento Socket.io: `new-sale` a usuarios del tenant
4. Si el pago es CASH, se calcula el vuelto automáticamente

**Errores:**
```json
// Total de pagos insuficiente
{
  "success": false,
  "statusCode": 400,
  "error": "El total de pagos ($10000) es menor al total de la venta ($12700)"
}

// Punto de venta no encontrado
{
  "success": false,
  "statusCode": 404,
  "error": "Punto de venta no encontrado"
}
```

---

## Listar Ventas

### GET /api/sales

Lista ventas con filtros y paginación.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Params:**

| Parámetro | Tipo | Descripción | Default |
|-----------|------|-------------|---------|
| `branchId` | string | Filtrar por sucursal | - |
| `pointOfSaleId` | string | Filtrar por punto de venta | - |
| `userId` | string | Filtrar por usuario | - |
| `customerId` | string | Filtrar por cliente | - |
| `status` | string | Filtrar por estado | - |
| `dateFrom` | string | Fecha desde (ISO 8601) | - |
| `dateTo` | string | Fecha hasta (ISO 8601) | - |
| `page` | string | Número de página | 1 |
| `pageSize` | string | Items por página | 50 |

**Ejemplo:**
```
GET /api/sales?branchId=branch_001&dateFrom=2025-12-19T00:00:00Z&dateTo=2025-12-19T23:59:59Z&page=1&pageSize=20
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sale_abc123",
      "saleNumber": "SUC001-POS001-20251219-0001",
      "saleDate": "2025-12-19T10:30:00Z",
      "total": 12700.00,
      "status": "COMPLETED",
      "customer": {
        "id": "customer_123",
        "name": "Juan Pérez"
      },
      "branch": {
        "id": "branch_001",
        "code": "SUC001",
        "name": "Sucursal Centro"
      },
      "pointOfSale": {
        "id": "pos_001",
        "code": "POS001",
        "name": "Caja 1"
      },
      "user": {
        "id": "user_123",
        "name": "María González"
      },
      "_count": {
        "items": 2,
        "payments": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Estados de venta:**
- `COMPLETED` - Venta completada
- `PENDING` - Venta pendiente (raro, normalmente se crean COMPLETED)
- `CANCELLED` - Venta anulada
- `REFUNDED` - Venta devuelta completamente
- `PARTIAL_REFUND` - Venta con devolución parcial

---

## Detalle de Venta

### GET /api/sales/:id

Obtiene el detalle completo de una venta.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "sale_abc123",
    "saleNumber": "SUC001-POS001-20251219-0001",
    "saleDate": "2025-12-19T10:30:00Z",
    "subtotal": 13000.00,
    "discount": 300.00,
    "tax": 2223.14,
    "total": 12700.00,
    "status": "COMPLETED",
    "items": [
      {
        "id": "item_001",
        "productId": "prod_001",
        "productName": "Producto 1",
        "quantity": 2,
        "unitPrice": 5000.00,
        "discount": 0,
        "subtotal": 10000.00,
        "taxRate": 21,
        "taxAmount": 1735.54,
        "product": {
          "id": "prod_001",
          "name": "Producto 1",
          "sku": "SKU-001"
        },
        "promotion": {
          "id": "promo_123",
          "name": "2x1",
          "code": "2X1-001"
        }
      }
    ],
    "payments": [
      {
        "id": "payment_001",
        "method": "CASH",
        "amount": 10000.00,
        "amountTendered": 10000.00,
        "changeAmount": 0,
        "status": "COMPLETED",
        "createdAt": "2025-12-19T10:30:00Z"
      },
      {
        "id": "payment_002",
        "method": "MP_POINT",
        "amount": 2700.00,
        "transactionId": "123456789",
        "mpPaymentId": "123456789",
        "cardBrand": "visa",
        "cardLastFour": "4242",
        "mpFeeAmount": 80.73,
        "netReceivedAmount": 2619.27,
        "status": "COMPLETED"
      }
    ],
    "customer": {
      "id": "customer_123",
      "name": "Juan Pérez",
      "email": "juan@email.com",
      "phone": "+5491123456789"
    },
    "branch": {
      "id": "branch_001",
      "code": "SUC001",
      "name": "Sucursal Centro"
    },
    "pointOfSale": {
      "id": "pos_001",
      "code": "POS001",
      "name": "Caja 1"
    },
    "user": {
      "id": "user_123",
      "name": "María González",
      "email": "maria@demo.com"
    }
  }
}
```

---

## Anular Venta

### POST /api/sales/:id/cancel

Anula una venta y restaura el stock.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos requeridos:** `pos:cancel`

**Body:**
```json
{
  "reason": "Cliente solicitó devolución por producto defectuoso"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Venta anulada correctamente"
}
```

**Efectos:**
1. Cambia el estado de la venta a `CANCELLED`
2. Registra fecha, usuario y motivo de anulación
3. Restaura el stock de los productos
4. Marca todos los pagos como `CANCELLED`
5. Emite evento Socket.io: `sale-cancelled`

**Validaciones:**
- La venta no debe estar ya anulada
- Se debe proporcionar un motivo
- Solo usuarios con permiso `pos:cancel` pueden anular

**Errores:**
```json
// Venta ya anulada
{
  "success": false,
  "statusCode": 400,
  "error": "La venta ya está anulada"
}

// Sin motivo
{
  "success": false,
  "statusCode": 400,
  "error": "Debe indicar el motivo de la anulación"
}
```

---

## Reporte Diario

### GET /api/sales/reports/daily-summary

Resumen de ventas del día.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `branchId` | string | Filtrar por sucursal (opcional) |
| `pointOfSaleId` | string | Filtrar por POS (opcional) |

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "date": "2025-12-19",
    "salesCount": 45,
    "totalSales": 567800.50,
    "totalDiscount": 12500.00,
    "totalTax": 97172.81,
    "paymentsByMethod": [
      {
        "method": "CASH",
        "total": 250000.00,
        "count": 25
      },
      {
        "method": "CREDIT_CARD",
        "total": 180000.00,
        "count": 12
      },
      {
        "method": "MP_POINT",
        "total": 100000.00,
        "count": 6
      },
      {
        "method": "DEBIT_CARD",
        "total": 37800.50,
        "count": 2
      }
    ],
    "topProducts": [
      {
        "productId": "prod_001",
        "productName": "Producto Estrella",
        "quantity": 120,
        "total": 180000.00
      },
      {
        "productId": "prod_002",
        "productName": "Producto Popular",
        "quantity": 85,
        "total": 127500.00
      }
    ]
  }
}
```

---

## Modelos de Datos

### Sale (Venta)

```typescript
interface Sale {
  id: string;
  tenantId: string;
  branchId: string;
  pointOfSaleId: string;
  userId: string;
  customerId?: string;
  saleNumber: string;              // SUC001-POS001-20251219-0001
  receiptType: ReceiptType;
  saleDate: Date;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: SaleStatus;
  notes?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### SaleItem

```typescript
interface SaleItem {
  id: string;
  saleId: string;
  productId?: string;
  comboId?: string;
  productCode?: string;
  productName: string;
  productBarcode?: string;
  quantity: number;
  unitPrice: number;              // CON IVA
  unitPriceNet: number;           // SIN IVA
  discount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  promotionId?: string;
  promotionName?: string;
  priceListId?: string;
  branchId?: string;
}
```

### Payment

```typescript
interface Payment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  cardBrand?: string;
  cardLastFour?: string;
  installments: number;
  amountTendered?: number;        // Solo CASH
  changeAmount?: number;          // Solo CASH
  transactionId?: string;
  status: PaymentStatus;

  // Campos Mercado Pago
  mpPaymentId?: string;
  mpOrderId?: string;
  mpFeeAmount?: number;
  netReceivedAmount?: number;

  createdAt: Date;
}
```

---

## Flujo Completo

### Crear Venta desde POS

```
1. Frontend POS
   ├─> Usuario escanea/selecciona productos
   ├─> Aplica promociones (POST /api/promotions/calculate)
   ├─> Selecciona método(s) de pago
   └─> Si es MP Point/QR:
       ├─> Crea orden MP (POST /api/mercadopago/orders o /qr/orders)
       ├─> Polling hasta APPROVED
       └─> Obtiene detalles (GET /api/mercadopago/payments/{id}/details)

2. Frontend construye payload
   {
     items: [...],        // Con promociones aplicadas
     payments: [...]      // Con datos de MP si aplica
   }

3. POST /api/sales
   └─> Backend:
       ├─> Valida datos (Zod)
       ├─> Verifica que total de pagos >= total venta
       ├─> Genera saleNumber secuencial
       ├─> Inicia transacción de BD:
       │   ├─> Crea Sale
       │   ├─> Crea SaleItems
       │   ├─> Crea Payments
       │   └─> Actualiza stock de productos
       ├─> Emite evento Socket.io: 'new-sale'
       └─> Devuelve venta creada

4. Frontend POS
   ├─> Muestra comprobante de venta
   ├─> Opción de imprimir ticket
   └─> Limpia carrito
```

---

**Ver también:**
- [API - Productos](./API-PRODUCTS.md)
- [API - Mercado Pago](./API-MERCADOPAGO.md)
- [API - Caja](./API-CASH.md)
- [Sistema de Promociones](./PROMOCIONES-FLUJO.md)
