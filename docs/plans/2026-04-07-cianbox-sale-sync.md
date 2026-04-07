# Sync de Ventas POS → Cianbox — Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enviar automáticamente todas las ventas del POS a Cianbox vía `POST /api/v2/ventas/alta`, y hacer polling del PDF de factura.

**Architecture:** Nuevo servicio `CianboxSaleService` que convierte ventas del POS al payload de Cianbox. Se invoca de forma asincrónica (fire-and-forget) después de crear la venta localmente. Un endpoint de polling permite al frontend consultar el estado del PDF.

**Tech Stack:** Prisma (schema changes), Express (endpoints), fetch (HTTP a Cianbox API), CianboxService existente (autenticación)

---

## Task 1: Agregar campos al schema Prisma

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Agregar enum CianboxSyncStatus**

Después del enum `SaleStatus` (línea ~932), agregar:

```prisma
enum CianboxSyncStatus {
  PENDING
  SYNCED
  FAILED
}
```

**Step 2: Agregar campos a Sale**

En el modelo `Sale` (línea ~870, después de `cianboxSaleId`), agregar:

```prisma
  cianboxSyncStatus  CianboxSyncStatus?  // null = no enviada, PENDING = enviando, SYNCED = ok, FAILED = error
  cianboxInvoiceUrl  String?              // URL del PDF de factura
  cianboxError       String?              // Último error de sync
```

**Step 3: Agregar campos a CianboxConnection**

En el modelo `CianboxConnection` (línea ~296, antes de `createdAt`), agregar:

```prisma
  defaultCustomerId  Int?    // ID cliente "Consumidor Final" en Cianbox
  defaultChannelId   Int     @default(1)  // id_canal_venta en Cianbox
  defaultCurrencyId  Int     @default(1)  // id_moneda en Cianbox
```

**Step 4: Agregar campo a PointOfSale**

En el modelo `PointOfSale` (línea ~360, después de `settings`), agregar:

```prisma
  cianboxPointOfSaleId  Int?  // ID talonario fiscal en Cianbox
```

**Step 5: Agregar campo a CardBrand**

En el modelo `CardBrand` (línea ~2380, después de `isSystem`), agregar:

```prisma
  cianboxCardId  Int?  // ID de tarjeta en Cianbox
```

**Step 6: Agregar campo a Bank**

En el modelo `Bank` (línea ~2518, después de `isActive`), agregar:

```prisma
  cianboxEntityId  Int?  // ID de entidad en Cianbox
```

**Step 7: Generar cliente Prisma y push**

Run:
```bash
cd apps/backend && npx prisma generate
```

**Step 8: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(schema): add Cianbox sale sync fields to Sale, CianboxConnection, PointOfSale, CardBrand, Bank"
```

---

## Task 2: Crear CianboxSaleService — buildPayload

**Files:**
- Create: `apps/backend/src/services/cianbox-sale.service.ts`

**Step 1: Crear el archivo con la estructura base y buildPayload**

```typescript
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { CianboxService } from './cianbox.service';

// Tipos de respuesta de Cianbox
interface CianboxSaleResponse {
  status: string;
  body: {
    status: string;
    description: string;
    id: number;
    id_recibo?: number;
  };
}

interface CianboxSaleListResponse {
  status: string;
  body: Array<{
    id: number;
    pdf_url?: string;
    cae?: string;
    [key: string]: unknown;
  }>;
}

// Sale con relaciones incluidas (tal como viene del POST /api/sales)
type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true } };
    payments: { include: { cardTerminal: true; bank: true } };
    customer: true;
    branch: true;
    pointOfSale: true;
  };
}>;

export class CianboxSaleService {

  /**
   * Construye el payload para POST /api/v2/ventas/alta
   */
  static async buildPayload(
    sale: SaleWithRelations,
    connection: {
      defaultCustomerId: number | null;
      defaultChannelId: number;
      defaultCurrencyId: number;
    }
  ) {
    // Resolver id_cliente de Cianbox
    let cianboxCustomerId = connection.defaultCustomerId;
    if (sale.customer?.cianboxCustomerId) {
      cianboxCustomerId = sale.customer.cianboxCustomerId;
    }

    // Resolver id_punto_venta de Cianbox (talonario fiscal)
    const cianboxPointOfSaleId = (sale.pointOfSale as any).cianboxPointOfSaleId;
    if (!cianboxPointOfSaleId) {
      throw new Error(`PointOfSale ${sale.pointOfSaleId} no tiene cianboxPointOfSaleId configurado`);
    }

    // Construir productos
    const productos = sale.items
      .filter(item => !item.isSurcharge) // Excluir recargos financieros
      .map(item => ({
        id: item.product?.cianboxProductId ?? 0,
        cantidad: Number(item.quantity),
        neto_uni: Number(item.unitPriceNet ?? item.unitPrice),
        alicuota: Number(item.taxRate),
      }));

    // Construir forma de pago
    const paymentResult = CianboxSaleService.mapPayments(sale.payments);

    // Payload base
    const payload: Record<string, unknown> = {
      fecha: sale.saleDate.toISOString().split('T')[0],
      origen: { tipo: 'directa' },
      id_cliente: cianboxCustomerId,
      id_canal_venta: connection.defaultChannelId,
      forma_pago: paymentResult.formaPago,
      id_punto_venta: cianboxPointOfSaleId,
      id_moneda: connection.defaultCurrencyId,
      cotizacion: 1,
      observaciones: sale.notes || `Venta POS ${sale.saleNumber}`,
      productos,
      percepciones: [],
    };

    // Agregar bloque condicional según forma de pago
    if (paymentResult.tarjeta) {
      payload.tarjeta = paymentResult.tarjeta;
    }
    if (paymentResult.cobro) {
      payload.cobro = paymentResult.cobro;
    }

    return payload;
  }

  /**
   * Mapea los pagos del POS al formato de Cianbox
   */
  static mapPayments(payments: SaleWithRelations['payments']) {
    // Si no hay pagos, cuenta corriente
    if (!payments || payments.length === 0) {
      return { formaPago: 'cuenta_corriente' };
    }

    // Un solo pago -> forma directa
    if (payments.length === 1) {
      return CianboxSaleService.mapSinglePayment(payments[0]);
    }

    // Múltiples pagos -> contado_mixto
    return CianboxSaleService.mapMixedPayments(payments);
  }

  /**
   * Mapea un pago individual
   */
  private static mapSinglePayment(payment: SaleWithRelations['payments'][0]) {
    const method = payment.method;

    switch (method) {
      case 'CASH':
        return { formaPago: 'efectivo' };

      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
      case 'MP_POINT': {
        const formaPago = (method === 'DEBIT_CARD' || (method === 'MP_POINT' && payment.cardType === 'debit'))
          ? 'tarjeta_debito'
          : 'tarjeta_credito';

        return {
          formaPago,
          tarjeta: CianboxSaleService.buildTarjetaBlock(payment),
        };
      }

      case 'TRANSFER': {
        return {
          formaPago: 'contado_mixto',
          cobro: {
            id_punto_venta: 0,
            fecha: payment.createdAt.toISOString().split('T')[0],
            efectivo: 0,
            tarjetas: [],
            depositos: [{
              id_cuenta: 1,
              fecha: payment.createdAt.toISOString().split('T')[0],
              numero: payment.transactionId || payment.reference || '',
              monto: Number(payment.amount),
            }],
            retenciones: [],
            valores: [],
          },
        };
      }

      // QR, VOUCHER, GIFTCARD, etc. -> efectivo en Cianbox
      default:
        return { formaPago: 'efectivo' };
    }
  }

  /**
   * Mapea pagos múltiples a contado_mixto
   */
  private static mapMixedPayments(payments: SaleWithRelations['payments']) {
    let efectivo = 0;
    const tarjetas: Array<Record<string, unknown>> = [];
    const depositos: Array<Record<string, unknown>> = [];
    const fecha = payments[0].createdAt.toISOString().split('T')[0];

    for (const p of payments) {
      switch (p.method) {
        case 'CASH':
        case 'QR':
        case 'VOUCHER':
        case 'GIFTCARD':
        case 'POINTS':
        case 'OTHER':
          efectivo += Number(p.amount);
          break;

        case 'CREDIT_CARD':
        case 'DEBIT_CARD':
        case 'MP_POINT': {
          const tipo = (p.method === 'DEBIT_CARD' || (p.method === 'MP_POINT' && p.cardType === 'debit'))
            ? 'debito'
            : 'credito';

          tarjetas.push({
            tipo,
            ...CianboxSaleService.buildTarjetaBlock(p),
            monto: Number(p.amount),
          });
          break;
        }

        case 'TRANSFER':
          depositos.push({
            id_cuenta: 1,
            fecha,
            numero: p.transactionId || p.reference || '',
            monto: Number(p.amount),
          });
          break;

        case 'CHECK':
          // Los cheques podrían ir a valores[], pero por ahora van como efectivo
          efectivo += Number(p.amount);
          break;

        case 'CREDIT':
          // Fiado -> no genera cobro, se suma a efectivo para balancear
          efectivo += Number(p.amount);
          break;
      }
    }

    return {
      formaPago: 'contado_mixto',
      cobro: {
        id_punto_venta: 0,
        fecha,
        efectivo,
        tarjetas,
        depositos,
        retenciones: [],
        valores: [],
      },
    };
  }

  /**
   * Construye el bloque tarjeta para Cianbox
   */
  private static buildTarjetaBlock(payment: SaleWithRelations['payments'][0]) {
    return {
      id_tarjeta: (payment as any).cardBrand?.cianboxCardId ?? 0,
      id_entidad: (payment.bank as any)?.cianboxEntityId ?? 0,
      cuotas: payment.installments || 1,
      cupon: payment.voucherNumber || payment.reference || '',
      numero_lote: payment.batchNumber || '',
    };
  }
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/services/cianbox-sale.service.ts
git commit -m "feat(cianbox): add CianboxSaleService with payload builder and payment mapping"
```

---

## Task 3: Agregar métodos de envío y polling

**Files:**
- Modify: `apps/backend/src/services/cianbox-sale.service.ts`

**Step 1: Agregar método sendSaleToCianbox**

Agregar al final de la clase `CianboxSaleService`, antes del cierre `}`:

```typescript
  /**
   * Envía una venta del POS a Cianbox.
   * Actualiza cianboxSaleId y cianboxSyncStatus en la DB.
   */
  static async sendSaleToCianbox(sale: SaleWithRelations): Promise<void> {
    const tenantId = sale.tenantId;

    // Obtener conexión Cianbox del tenant
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || !connection.isActive) {
      // Sin conexión activa, no sincronizar
      return;
    }

    // Marcar como PENDING
    await prisma.sale.update({
      where: { id: sale.id },
      data: { cianboxSyncStatus: 'PENDING' },
    });

    try {
      const payload = await CianboxSaleService.buildPayload(sale, {
        defaultCustomerId: connection.defaultCustomerId,
        defaultChannelId: connection.defaultChannelId,
        defaultCurrencyId: connection.defaultCurrencyId,
      });

      // Obtener instancia del servicio Cianbox para hacer la request
      const cianboxService = new CianboxService(connection);
      const response = await (cianboxService as any).request<CianboxSaleResponse>(
        '/ventas/alta',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 'ok' && response.body?.id) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            cianboxSaleId: response.body.id,
            cianboxSyncStatus: 'SYNCED',
            cianboxError: null,
          },
        });
        console.log(`[CianboxSale] Venta ${sale.saleNumber} enviada a Cianbox (id: ${response.body.id})`);
      } else {
        throw new Error(response.body?.description || 'Respuesta inesperada de Cianbox');
      }
    } catch (error: any) {
      console.error(`[CianboxSale] Error enviando venta ${sale.saleNumber}:`, error.message);
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          cianboxSyncStatus: 'FAILED',
          cianboxError: error.message?.substring(0, 500),
        },
      });
    }
  }

  /**
   * Consulta el estado de la factura en Cianbox (polling).
   * Retorna la URL del PDF si está disponible.
   */
  static async pollInvoice(tenantId: string, saleId: string): Promise<{
    ready: boolean;
    invoiceUrl?: string;
    cae?: string;
  }> {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId },
    });

    if (!sale?.cianboxSaleId) {
      return { ready: false };
    }

    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || !connection.isActive) {
      return { ready: false };
    }

    try {
      const cianboxService = new CianboxService(connection);
      const response = await (cianboxService as any).request<CianboxSaleListResponse>(
        `/ventas/lista?id=${sale.cianboxSaleId}`
      );

      if (response.status === 'ok' && response.body?.length > 0) {
        const venta = response.body[0];
        if (venta.pdf_url) {
          // Guardar URL del PDF
          await prisma.sale.update({
            where: { id: saleId },
            data: { cianboxInvoiceUrl: venta.pdf_url },
          });
          return {
            ready: true,
            invoiceUrl: venta.pdf_url,
            cae: venta.cae?.toString(),
          };
        }
      }
      return { ready: false };
    } catch (error: any) {
      console.error(`[CianboxSale] Error polling factura:`, error.message);
      return { ready: false };
    }
  }

  /**
   * Reintenta enviar ventas fallidas de un tenant.
   */
  static async retryFailedSales(tenantId: string): Promise<{ retried: number; succeeded: number }> {
    const failedSales = await prisma.sale.findMany({
      where: {
        tenantId,
        cianboxSyncStatus: 'FAILED',
      },
      include: {
        items: { include: { product: true } },
        payments: { include: { cardTerminal: true, bank: true } },
        customer: true,
        branch: true,
        pointOfSale: true,
      },
      take: 50, // Máximo 50 por batch
      orderBy: { createdAt: 'asc' },
    });

    let succeeded = 0;
    for (const sale of failedSales) {
      try {
        await CianboxSaleService.sendSaleToCianbox(sale);
        const updated = await prisma.sale.findUnique({ where: { id: sale.id } });
        if (updated?.cianboxSyncStatus === 'SYNCED') succeeded++;
      } catch {
        // Ya se manejó en sendSaleToCianbox
      }
    }

    return { retried: failedSales.length, succeeded };
  }
```

**Step 2: Hacer el método `request` accesible**

En `apps/backend/src/services/cianbox.service.ts`, cambiar la visibilidad del método `request` de `private` a `public`:

Buscar (línea ~540):
```typescript
  private async request<T>(
```
Reemplazar por:
```typescript
  public async request<T>(
```

**Step 3: Commit**

```bash
git add apps/backend/src/services/cianbox-sale.service.ts apps/backend/src/services/cianbox.service.ts
git commit -m "feat(cianbox): add sendSaleToCianbox, pollInvoice, and retryFailedSales methods"
```

---

## Task 4: Integrar en el flujo de ventas

**Files:**
- Modify: `apps/backend/src/routes/sales.ts`

**Step 1: Agregar import al inicio del archivo**

Agregar después de los imports existentes:

```typescript
import { CianboxSaleService } from '../services/cianbox-sale.service';
```

**Step 2: Agregar llamada después de la transacción**

En el POST `/api/sales`, después del bloque de store credits y antes del `res.status(201)` (línea ~486), agregar:

```typescript
    // Enviar venta a Cianbox (fire-and-forget, no bloquea al cajero)
    CianboxSaleService.sendSaleToCianbox(sale).catch(err => {
      console.error(`[CianboxSale] Error async enviando venta ${sale.saleNumber}:`, err.message);
    });
```

**Step 3: Commit**

```bash
git add apps/backend/src/routes/sales.ts
git commit -m "feat(sales): trigger Cianbox sale sync after local sale creation"
```

---

## Task 5: Crear endpoints de polling y retry

**Files:**
- Modify: `apps/backend/src/routes/cianbox.ts`

**Step 1: Agregar import**

Agregar al inicio del archivo:

```typescript
import { CianboxSaleService } from '../services/cianbox-sale.service';
```

**Step 2: Agregar endpoints**

Al final del archivo, antes del `export default router`:

```typescript
// Polling: consultar estado de factura Cianbox
router.get('/sales/:saleId/invoice', authenticate, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { saleId } = req.params;

    const result = await CianboxSaleService.pollInvoice(tenantId, saleId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reintentar envío de una venta específica
router.post('/sales/:saleId/retry', authenticate, authorize('settings:edit'), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { saleId } = req.params;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId, cianboxSyncStatus: 'FAILED' },
      include: {
        items: { include: { product: true } },
        payments: { include: { cardTerminal: true, bank: true } },
        customer: true,
        branch: true,
        pointOfSale: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ success: false, error: 'Venta no encontrada o no está en estado FAILED' });
    }

    await CianboxSaleService.sendSaleToCianbox(sale);

    const updated = await prisma.sale.findUnique({ where: { id: saleId } });
    res.json({ success: true, data: { syncStatus: updated?.cianboxSyncStatus } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reintentar todas las ventas fallidas del tenant
router.post('/sales/retry-all', authenticate, authorize('settings:edit'), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await CianboxSaleService.retryFailedSales(tenantId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Step 3: Commit**

```bash
git add apps/backend/src/routes/cianbox.ts
git commit -m "feat(cianbox): add invoice polling and sale retry endpoints"
```

---

## Task 6: Build y verificación

**Step 1: Compilar backend**

```bash
cd apps/backend && npm run build
```

Verificar que no hay errores de TypeScript.

**Step 2: Si hay errores, corregir**

Los errores más probables son:
- Tipos de Prisma no generados (correr `npx prisma generate`)
- Imports faltantes
- Propiedades no existentes en tipos (ajustar casts)

**Step 3: Commit final**

```bash
git add -A
git commit -m "fix(cianbox): resolve build issues for sale sync feature"
```

---

## Resumen de endpoints nuevos

| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `GET /api/cianbox/sales/:saleId/invoice` | GET | authenticated | Polling de PDF de factura |
| `POST /api/cianbox/sales/:saleId/retry` | POST | settings:edit | Reintentar venta específica |
| `POST /api/cianbox/sales/retry-all` | POST | settings:edit | Reintentar todas las fallidas |

## Resumen de campos nuevos

| Modelo | Campo | Tipo |
|---|---|---|
| `Sale` | `cianboxSyncStatus` | `CianboxSyncStatus?` |
| `Sale` | `cianboxInvoiceUrl` | `String?` |
| `Sale` | `cianboxError` | `String?` |
| `CianboxConnection` | `defaultCustomerId` | `Int?` |
| `CianboxConnection` | `defaultChannelId` | `Int (default 1)` |
| `CianboxConnection` | `defaultCurrencyId` | `Int (default 1)` |
| `PointOfSale` | `cianboxPointOfSaleId` | `Int?` |
| `CardBrand` | `cianboxCardId` | `Int?` |
| `Bank` | `cianboxEntityId` | `Int?` |
