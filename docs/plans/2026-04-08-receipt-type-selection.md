# Seleccion de Comprobante Fiscal en POS — Plan de Implementacion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir al cajero seleccionar el tipo de comprobante (NDP o Factura) al momento de la venta, con reglas de negocio que fuerzan Factura para pagos no efectivo.

**Architecture:** El POS muestra un selector de comprobante entre los medios de pago y el boton Confirmar. La logica de negocio determina automaticamente si el cajero puede elegir o si es Factura obligatoria. El backend recibe un `cianboxTalonarioId` opcional y calcula `neto_uni` diferente segun el tipo de comprobante (NDP vs Factura).

**Tech Stack:** React (frontend POS), Express/Prisma (backend), Cianbox API v2

---

## Task 1: Backend — Endpoint de talonarios por cliente

**Files:**
- Modify: `apps/backend/src/routes/cianbox.ts`
- Modify: `apps/backend/src/services/cianbox.service.ts`

**Step 1: Agregar metodo fetchTalonariosByClient a CianboxService**

En `apps/backend/src/services/cianbox.service.ts`, agregar al final de la clase:

```typescript
  /**
   * Obtiene talonarios de venta disponibles segun cliente (GET /ventas/puntos_venta)
   * Cianbox filtra automaticamente por condicion IVA del cliente
   */
  async fetchTalonariosByClient(clientId?: number): Promise<Array<{
    id: number;
    comprobante: string;
    tipo: string;
    talonario: string;
    punto_venta: string;
    fiscal: boolean;
    factura_electronica: boolean;
    descripcion: string;
    vigente: boolean;
    [key: string]: unknown;
  }>> {
    const params = clientId ? `&id_cliente=${clientId}` : '';
    const response = await this.request<{ status: string; body: Array<Record<string, unknown>> }>(
      `/ventas/puntos_venta?limit=50${params}`
    );
    return (response.body || []) as any;
  }
```

**Step 2: Agregar endpoint GET /talonarios en cianbox routes**

En `apps/backend/src/routes/cianbox.ts`, antes de la seccion "SYNC DE VENTAS":

```typescript
// Talonarios de venta disponibles segun cliente
router.get(
  '/talonarios',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { customerId } = req.query;

      const service = await CianboxService.forTenant(tenantId);

      // Si viene customerId del POS, buscar su cianboxCustomerId
      let cianboxClientId: number | undefined;
      if (customerId && typeof customerId === 'string') {
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, tenantId },
          select: { cianboxCustomerId: true },
        });
        cianboxClientId = customer?.cianboxCustomerId ?? undefined;
      }

      const talonarios = await service.fetchTalonariosByClient(cianboxClientId);

      res.json({ success: true, data: talonarios });
    } catch (error) {
      next(error);
    }
  }
);
```

**Step 3: Commit**

---

## Task 2: Backend — Recibir cianboxTalonarioId en la venta

**Files:**
- Modify: `apps/backend/src/routes/sales.ts` (schema de validacion y saleData)
- Modify: `apps/backend/prisma/schema.prisma` (campo en Sale)
- Modify: `apps/backend/src/services/cianbox-sale.service.ts` (usar talonarioId en payload)

**Step 1: Agregar campo cianboxTalonarioId al schema Prisma**

En el modelo `Sale`, despues de `cianboxSaleId`:

```prisma
  cianboxTalonarioId Int?        // ID del talonario Cianbox usado (override del default)
```

Correr `npx prisma generate`.

**Step 2: Agregar cianboxTalonarioId al schema Zod de sales**

En `apps/backend/src/routes/sales.ts`, buscar el schema de validacion `saleCreateSchema` y agregar:

```typescript
  cianboxTalonarioId: z.number().int().positive().optional(),
```

Y en la construccion del `prisma.sale.create`, agregar el campo.

**Step 3: Usar cianboxTalonarioId en CianboxSaleService**

En `apps/backend/src/services/cianbox-sale.service.ts`, modificar `buildPayload`:

- Si `sale.cianboxTalonarioId` existe, usarlo como `id_punto_venta` en vez del default
- Si el talonario es fiscal (comprobante FAC), calcular neto_uni sin IVA: `(subtotal / qty) / (1 + alicuota/100)`
- Si es NDP, mantener precio final como hoy

Para determinar si es fiscal, necesitamos guardar tambien si es fiscal. Agregar campo `cianboxTalonarioFiscal` (Boolean?) al Sale.

Modificar buildPayload:

```typescript
    const isFiscal = sale.cianboxTalonarioFiscal === true;
    const idPuntoVenta = sale.cianboxTalonarioId ?? (sale.pointOfSale?.cianboxPointOfSaleId ?? 0);

    const productos = productItems.map((item) => {
      const qty = Number(item.quantity);
      const subtotal = Number(item.subtotal);
      const alicuota = Number(item.taxRate);

      let netoUni: number;
      if (isFiscal) {
        // Factura: neto sin IVA para que Cianbox discrimine
        const unitarioConIva = qty !== 0 ? subtotal / qty : 0;
        netoUni = unitarioConIva / (1 + alicuota / 100);
      } else {
        // NDP: precio final con IVA incluido
        netoUni = qty !== 0 ? subtotal / qty : 0;
      }

      return {
        id: item.product?.cianboxProductId ?? 0,
        cantidad: qty,
        neto_uni: Math.round(netoUni * 100) / 100,
        alicuota,
      };
    });
```

Y en el payload:
```typescript
    id_punto_venta: idPuntoVenta,
```

**Step 4: Commit**

---

## Task 3: Frontend POS — Selector de comprobante

**Files:**
- Modify: `apps/frontend/src/pages/POS.tsx`
- Modify: `apps/frontend/src/services/api.ts`

**Step 1: Agregar servicio de talonarios en api.ts**

```typescript
export const cianboxService = {
  getTalonarios: async (customerId?: string) => {
    const params = customerId ? `?customerId=${customerId}` : '';
    const response = await api.get(`/cianbox/talonarios${params}`);
    return response.data.data;
  },
};
```

**Step 2: Agregar estado y logica de comprobante en POS.tsx**

Nuevos estados:
```typescript
const [receiptMode, setReceiptMode] = useState<'NDP' | 'FACTURA'>('NDP');
const [cianboxTalonarios, setCianboxTalonarios] = useState<Array<{
  id: number;
  comprobante: string;
  tipo: string;
  talonario: string;
  fiscal: boolean;
  descripcion: string;
}>>([]);
const [selectedTalonarioId, setSelectedTalonarioId] = useState<number | null>(null);
```

**Step 3: Logica de reglas de negocio**

Efecto que reacciona al cambio de metodo de pago:
```typescript
useEffect(() => {
  if (!selectedPaymentMethod) return;

  const isOnlyCash = selectedPaymentMethod === 'CASH'
    && appliedGiftCards.length === 0
    && appliedStoreCredits.length === 0;

  if (isOnlyCash) {
    // Efectivo puro: puede elegir NDP o Factura, default NDP
    // No forzar, dejar que el cajero elija
  } else {
    // Tarjeta, QR, transferencia, mixto: Factura obligatoria
    setReceiptMode('FACTURA');
  }
}, [selectedPaymentMethod, appliedGiftCards, appliedStoreCredits]);
```

Cargar talonarios cuando cambia a FACTURA:
```typescript
useEffect(() => {
  if (receiptMode === 'FACTURA') {
    const loadTalonarios = async () => {
      try {
        const talonarios = await cianboxService.getTalonarios(
          selectedCustomer?.id !== CONSUMIDOR_FINAL.id ? selectedCustomer?.id : undefined
        );
        const fiscales = talonarios.filter((t: any) => t.fiscal);
        setCianboxTalonarios(fiscales);
        if (fiscales.length === 1) {
          setSelectedTalonarioId(fiscales[0].id);
        }
      } catch {
        setCianboxTalonarios([]);
      }
    };
    loadTalonarios();
  } else {
    setSelectedTalonarioId(null);
  }
}, [receiptMode, selectedCustomer]);
```

**Step 4: UI del selector de comprobante**

Agregar entre la seccion de medios de pago y el boton Confirmar:

```tsx
{/* Selector de comprobante */}
{selectedPaymentMethod && (
  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
    <label className="block text-xs font-medium text-gray-600 mb-2">Comprobante</label>
    <div className="flex gap-2">
      <button
        onClick={() => setReceiptMode('NDP')}
        disabled={selectedPaymentMethod !== 'CASH'}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
          receiptMode === 'NDP'
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-gray-300 text-gray-700'
        } ${selectedPaymentMethod !== 'CASH' ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Nota de Pedido
      </button>
      <button
        onClick={() => setReceiptMode('FACTURA')}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
          receiptMode === 'FACTURA'
            ? 'bg-green-600 text-white'
            : 'bg-white border border-gray-300 text-gray-700'
        }`}
      >
        Factura
      </button>
    </div>
    {receiptMode === 'FACTURA' && cianboxTalonarios.length > 1 && (
      <select
        value={selectedTalonarioId ?? ''}
        onChange={(e) => setSelectedTalonarioId(Number(e.target.value))}
        className="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
      >
        {cianboxTalonarios.map((t) => (
          <option key={t.id} value={t.id}>{t.descripcion}</option>
        ))}
      </select>
    )}
    {receiptMode === 'FACTURA' && cianboxTalonarios.length === 1 && (
      <p className="mt-2 text-xs text-green-600">{cianboxTalonarios[0].descripcion}</p>
    )}
  </div>
)}
```

**Step 5: Incluir talonarioId en saleData**

En la construccion de saleData dentro de processSale:

```typescript
const saleData = {
  ...existingFields,
  cianboxTalonarioId: receiptMode === 'FACTURA' ? selectedTalonarioId : undefined,
  cianboxTalonarioFiscal: receiptMode === 'FACTURA' ? true : undefined,
};
```

**Step 6: Commit**

---

## Task 4: Build y verificacion

**Step 1:** `cd apps/backend && npx prisma generate && npm run build`
**Step 2:** `cd apps/frontend && npm run build`
**Step 3:** Fix errores si los hay
**Step 4:** Commit y push

---

## Resumen de flujo final

```
Cajero selecciona medio de pago
        |
        v
  Es solo efectivo?
   /          \
  SI           NO
  |             |
  v             v
Puede elegir   Factura obligatoria
NDP o Factura  (boton NDP deshabilitado)
(default NDP)
        |
        v
  Eligio Factura?
   /          \
  NO           SI
  |             |
  v             v
Envia con      Consulta talonarios
talonario      segun cliente
NDP del POS    (A o B automatico)
        |             |
        v             v
buildPayload:   buildPayload:
neto_uni =      neto_uni =
precio final    neto sin IVA
```
