# Mapeo de Campos: POS - Cianbox ERP

Este documento define la homologacion de nombres de campos entre el sistema POS y Cianbox ERP para garantizar una integracion fluida cuando Cianbox cree la API para recibir ventas.

## Resumen de Sistemas

| Sistema | Base de Datos | ORM/Schema |
|---------|---------------|------------|
| POS Backend | PostgreSQL | Prisma |
| POS Desktop | SQLite | SQLAlchemy |
| Cianbox ERP | MySQL | - |

---

## 1. TABLA VENTAS (Sales Header)

### Mapeo Completo

| POS Backend (Prisma) | POS Desktop (SQLite) | Cianbox MySQL | Descripcion |
|---------------------|----------------------|---------------|-------------|
| `id` | `id` | `id` | ID unico (CUID en POS, INT en Cianbox) |
| `tenantId` | `tenant_id` | - | Multi-tenant (no aplica en Cianbox) |
| `branchId` | `branch_id` | - | Sucursal interna POS |
| - | - | `id_sucursal` | **NUEVO** Sucursal en Cianbox |
| `pointOfSaleId` | `point_of_sale_id` | `id_punto_venta` | Punto de venta |
| `userId` | `user_id` | `id_usuario` | Usuario/Cajero |
| `customerId` | `customer_id` | `id_cliente` | Cliente |
| `saleDate` | `sale_date` | `fecha` | Fecha de venta |
| `createdAt` | - | `fecha_carga` | Fecha de registro |
| `saleNumber` | `sale_number` | `numero_provisorio` | Numero NDP X (ej: "T-001-0001") |
| `fiscalNumber` | `fiscal_number` | `numero` | Numero fiscal (ej: 1 para factura) |
| - | - | `cae` | CAE de AFIP |
| - | - | `cae_vencimiento` | Vencimiento del CAE |
| `receiptType` | `receipt_type` | `tipo_comprobante` | Tipo: NDP_X, INVOICE_A, etc. |
| `subtotal` | `subtotal` | `gravado` | Neto gravado (sin IVA) |
| `tax` | `tax` | `iva` | Monto de IVA |
| `discount` | `discount` | `descuento` | Descuento total |
| `total` | `total` | `total` | Total con IVA |
| - | - | `id_moneda` | ID de moneda (1=ARS) |
| - | - | `cotizacion` | Tipo de cambio |
| `status` | `status` | `anulado`, `vigente` | Estado de la venta |
| - | - | `id_condicion` | Condicion de pago (1=Contado) |
| - | - | `ctacte` | Saldo cuenta corriente |
| `notes` | `notes` | `observaciones` | Notas |
| `originalSaleId` | - | `id_venta_original` | Para devoluciones |

### Campos Nuevos Requeridos en POS

Para homologar con Cianbox, agregar estos campos al POS:

```prisma
// En schema.prisma - modelo Sale
cae             String?    // CAE de AFIP
caeExpiration   DateTime?  // Vencimiento CAE
currencyId      Int        @default(1)  // ID moneda (1=ARS, 2=USD)
exchangeRate    Decimal    @default(1)  @db.Decimal(12, 6) // Cotizacion
paymentCondition Int       @default(1)  // 1=Contado, 2=CtaCte
```

---

## 2. TABLA DETALLE VENTAS (Sale Items)

### Mapeo Completo

| POS Backend (Prisma) | POS Desktop (SQLite) | Cianbox MySQL | Descripcion |
|---------------------|----------------------|---------------|-------------|
| `id` | `id` | `id` | ID unico |
| `saleId` | `sale_id` | `id_venta` | FK a venta |
| `productId` | `product_id` | `id_producto` | FK a producto |
| `productCode` | `product_code` | - | Codigo SKU |
| `productName` | `product_name` | `detalle` | Nombre/descripcion |
| `productBarcode` | `product_barcode` | - | Codigo de barras |
| `quantity` | `quantity` | `cantidad` | Cantidad |
| `unitPriceNet` | `unit_price_net` | `gravado` | Precio neto SIN IVA |
| `unitPrice` | `unit_price` | - | Precio CON IVA (POS) |
| `taxRate` | `tax_rate` | `alicuota` | Tasa IVA (21 vs 1.21) |
| `taxAmount` | `tax_amount` | `iva` | Monto IVA del item |
| `subtotal` | `subtotal` | `total` | Subtotal del item |
| `discount` | `discount` | `descuento` | Descuento aplicado |
| `priceListId` | - | `id_lista_precio` | Lista de precios |
| - | - | `saldo_stock` | Stock actualizado |
| `promotionId` | `promotion_id` | - | Promocion aplicada |
| `isReturn` | `is_return` | - | Flag devolucion |
| `originalItemId` | `original_item_id` | - | Item original (dev) |

### Diferencia Critica: Alicuota IVA

**Cianbox:** `alicuota = 1.21` (multiplicador)
**POS:** `taxRate = 21` (porcentaje)

**Conversion:**
```typescript
// POS -> Cianbox
const alicuota = 1 + (taxRate / 100);  // 21 -> 1.21

// Cianbox -> POS
const taxRate = (alicuota - 1) * 100;  // 1.21 -> 21
```

---

## 3. TABLA PAGOS (Payments)

### Mapeo Completo

| POS Backend (Prisma) | Cianbox MySQL | Descripcion |
|---------------------|---------------|-------------|
| `id` | `id` | ID unico |
| `saleId` | `id_venta` | FK a venta |
| `method` | `id_forma_pago` | Metodo de pago |
| `amount` | `monto` | Monto pagado |
| `reference` | `referencia` | Nro operacion |
| `cardBrand` | `tarjeta_marca` | Marca tarjeta |
| `cardLastFour` | `tarjeta_ultimos4` | Ultimos 4 digitos |
| `installments` | `cuotas` | Cantidad de cuotas |
| `mpPaymentId` | `mp_payment_id` | ID pago MercadoPago |

### Mapeo de Metodos de Pago

| POS (enum) | Cianbox (id_forma_pago) | Descripcion |
|------------|-------------------------|-------------|
| `CASH` | 1 | Efectivo |
| `CREDIT_CARD` | 2 | Tarjeta credito |
| `DEBIT_CARD` | 3 | Tarjeta debito |
| `QR` | 4 | QR MercadoPago |
| `MP_POINT` | 5 | Terminal Point MP |
| `TRANSFER` | 6 | Transferencia |
| `CREDIT` | 7 | Cuenta corriente |

---

## 4. TIPOS DE COMPROBANTE

### Mapeo de ReceiptType

| POS (enum) | Cianbox (id_tipo_cbte) | Descripcion |
|------------|------------------------|-------------|
| `NDP_X` | 0 | Nota de Pedido X (provisorio) |
| `NDC_X` | 0 | Nota de Credito X (dev. provisoria) |
| `INVOICE_A` | 1 | Factura A |
| `INVOICE_B` | 6 | Factura B |
| `INVOICE_C` | 11 | Factura C |
| `CREDIT_NOTE_A` | 3 | Nota Credito A |
| `CREDIT_NOTE_B` | 8 | Nota Credito B |
| `CREDIT_NOTE_C` | 13 | Nota Credito C |

---

## 5. ESTRUCTURA JSON PROPUESTA PARA API CIANBOX

### POST /api/pos/ventas

```json
{
  "venta": {
    "id_pos": "cmj7...",
    "numero_provisorio": "T-001-000001",
    "fecha": "2026-01-04T15:30:00Z",
    "id_usuario": 1,
    "id_cliente": 123,
    "id_punto_venta": 1,
    "id_sucursal": 1,
    "id_tipo_comprobante": 0,
    "id_condicion": 1,
    "id_moneda": 1,
    "cotizacion": 1.00,
    "gravado": 8264.46,
    "iva": 1735.54,
    "descuento": 0.00,
    "total": 10000.00,
    "cae": null,
    "cae_vencimiento": null,
    "observaciones": "",
    "anulado": false
  },
  "items": [
    {
      "id_producto": 456,
      "cantidad": 2,
      "gravado": 4132.23,
      "alicuota": 1.21,
      "iva": 867.77,
      "total": 5000.00,
      "descuento": 0.00,
      "detalle": "REMERA ALGODÓN NEGRA",
      "id_lista_precio": 1
    }
  ],
  "pagos": [
    {
      "id_forma_pago": 1,
      "monto": 10000.00,
      "referencia": null,
      "cuotas": 1
    }
  ]
}
```

---

## 6. CAMBIOS REQUERIDOS EN EL POS

### 6.1 Backend (Prisma Schema)

```prisma
model Sale {
  // Campos existentes...

  // NUEVOS - Para homologacion con Cianbox
  cianboxSaleId   Int?       // ID asignado por Cianbox al sincronizar
  cae             String?    // CAE de AFIP (mover de AfipInvoice)
  caeExpiration   DateTime?  // Vencimiento CAE
  currencyId      Int        @default(1)  // 1=ARS
  exchangeRate    Decimal    @default(1)  @db.Decimal(12, 6)
  paymentCondition String    @default("CASH") // CASH, CREDIT
}

model SaleItem {
  // Campos existentes...

  // NUEVO - Para calcular gravado desde unitPrice
  unitPriceNet    Decimal?  @db.Decimal(12, 2) // Precio neto SIN IVA
}
```

### 6.2 Desktop (SQLAlchemy Models)

```python
class Sale(BaseModel):
    # Existentes...

    # NUEVOS
    cianbox_sale_id: Mapped[Optional[int]] = mapped_column(Integer)
    cae: Mapped[Optional[str]] = mapped_column(String(50))
    cae_expiration: Mapped[Optional[datetime]] = mapped_column(DateTime)
    currency_id: Mapped[int] = mapped_column(Integer, default=1)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), default=Decimal("1"))
    payment_condition: Mapped[str] = mapped_column(String(20), default="CASH")
```

---

## 7. FUNCION DE CONVERSION POS -> CIANBOX

### TypeScript (Backend)

```typescript
interface CianboxSalePayload {
  venta: {
    id_pos: string;
    numero_provisorio: string;
    fecha: string;
    id_usuario: number;
    id_cliente: number | null;
    id_punto_venta: number;
    id_sucursal: number;
    id_tipo_comprobante: number;
    id_condicion: number;
    id_moneda: number;
    cotizacion: number;
    gravado: number;
    iva: number;
    descuento: number;
    total: number;
    cae: string | null;
    cae_vencimiento: string | null;
    observaciones: string;
    anulado: boolean;
  };
  items: Array<{
    id_producto: number;
    cantidad: number;
    gravado: number;
    alicuota: number;
    iva: number;
    total: number;
    descuento: number;
    detalle: string;
    id_lista_precio: number;
  }>;
  pagos: Array<{
    id_forma_pago: number;
    monto: number;
    referencia: string | null;
    cuotas: number;
  }>;
}

function convertSaleToCianbox(sale: Sale, items: SaleItem[], payments: Payment[]): CianboxSalePayload {
  // Mapeo de tipo de comprobante
  const receiptTypeMap: Record<string, number> = {
    'NDP_X': 0,
    'NDC_X': 0,
    'INVOICE_A': 1,
    'INVOICE_B': 6,
    'INVOICE_C': 11,
    'CREDIT_NOTE_A': 3,
    'CREDIT_NOTE_B': 8,
    'CREDIT_NOTE_C': 13,
  };

  // Mapeo de metodos de pago
  const paymentMethodMap: Record<string, number> = {
    'CASH': 1,
    'CREDIT_CARD': 2,
    'DEBIT_CARD': 3,
    'QR': 4,
    'MP_POINT': 5,
    'TRANSFER': 6,
    'CREDIT': 7,
  };

  // Calcular gravado (neto sin IVA)
  const totalTaxRate = 1.21; // Asumiendo IVA 21%
  const gravado = Number(sale.total) / totalTaxRate;
  const iva = Number(sale.total) - gravado;

  return {
    venta: {
      id_pos: sale.id,
      numero_provisorio: sale.saleNumber,
      fecha: sale.saleDate.toISOString(),
      id_usuario: sale.cianboxUserId || 0,
      id_cliente: sale.customer?.cianboxCustomerId || null,
      id_punto_venta: sale.pointOfSale?.cianboxPosId || 1,
      id_sucursal: sale.branch?.cianboxBranchId || 1,
      id_tipo_comprobante: receiptTypeMap[sale.receiptType] || 0,
      id_condicion: 1, // Contado
      id_moneda: sale.currencyId || 1,
      cotizacion: Number(sale.exchangeRate) || 1,
      gravado: Number(gravado.toFixed(2)),
      iva: Number(iva.toFixed(2)),
      descuento: Number(sale.discount),
      total: Number(sale.total),
      cae: sale.cae || null,
      cae_vencimiento: sale.caeExpiration?.toISOString().split('T')[0] || null,
      observaciones: sale.notes || '',
      anulado: sale.status === 'CANCELLED',
    },
    items: items.map(item => {
      const itemTaxRate = Number(item.taxRate) / 100;
      const alicuota = 1 + itemTaxRate;
      const itemGravado = Number(item.subtotal) / alicuota;
      const itemIva = Number(item.subtotal) - itemGravado;

      return {
        id_producto: item.product?.cianboxProductId || 0,
        cantidad: Number(item.quantity),
        gravado: Number(itemGravado.toFixed(2)),
        alicuota: alicuota,
        iva: Number(itemIva.toFixed(2)),
        total: Number(item.subtotal),
        descuento: Number(item.discount),
        detalle: item.productName,
        id_lista_precio: item.priceList?.cianboxPriceListId || 1,
      };
    }),
    pagos: payments.map(payment => ({
      id_forma_pago: paymentMethodMap[payment.method] || 1,
      monto: Number(payment.amount),
      referencia: payment.reference || null,
      cuotas: payment.installments || 1,
    })),
  };
}
```

---

## 8. VALIDACIONES IMPORTANTES

### Antes de enviar a Cianbox:

1. **Productos deben existir en Cianbox:** Verificar que `cianboxProductId` no sea null
2. **Cliente debe existir:** Si hay cliente, verificar `cianboxCustomerId`
3. **Montos deben cuadrar:** `gravado + iva = total`
4. **Alicuota valida:** Solo valores permitidos por AFIP (1.21, 1.105, 1.27, etc.)
5. **Suma de pagos:** `SUM(pagos.monto) = venta.total`

---

## 9. PROXIMOS PASOS

1. [ ] Agregar campos nuevos al schema Prisma
2. [ ] Crear migracion de base de datos
3. [ ] Agregar campos al modelo SQLite desktop
4. [ ] Crear servicio de sincronizacion a Cianbox
5. [ ] Implementar cola de reintentos para ventas fallidas
6. [ ] Tests de integracion con API Cianbox (cuando este disponible)

---

*Documento creado: 2026-01-04*
*Ultima actualizacion: 2026-01-04*
