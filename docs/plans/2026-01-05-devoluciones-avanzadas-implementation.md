# Sistema de Devoluciones Avanzado - Plan de Implementación

> **Para Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar vales/créditos para devoluciones, ítems negativos en carrito, y flujo de cambio por producto.

**Architecture:** Modelo StoreCredit en Prisma, endpoints REST, frontend con ítems negativos en carrito, impresión térmica de vales.

**Tech Stack:** Prisma 5.x, Express, React 18, TailwindCSS, impresión térmica

---

## Task 1: Modelo de Datos - StoreCredit

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Agregar enums para StoreCredit**

Agregar después del enum `GiftCardTxType` (línea ~1408):

```prisma
// === VALES / CRÉDITOS DE TIENDA ===

enum StoreCreditStatus {
  ACTIVE      // Vigente, tiene saldo
  USED        // Usado completamente
  EXPIRED     // Venció
  CANCELLED   // Anulado
}

enum StoreCreditTxType {
  ISSUED        // Emisión inicial
  REDEEMED      // Uso en venta
  EXPIRED       // Expiración
  CANCELLED     // Cancelación
  ADJUSTED      // Ajuste manual
}
```

**Step 2: Agregar modelo StoreCredit**

Agregar después de los enums:

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
  status          StoreCreditStatus @default(ACTIVE)

  // Origen
  originSaleId    String?                    // Venta de devolución que lo generó
  customerId      String?                    // Cliente (opcional)
  branchId        String?                    // Sucursal donde se emitió
  issuedByUserId  String                     // Cajero que lo emitió

  // Sincronización con Cianbox (Fase 2)
  cianboxSynced     Boolean         @default(false)
  cianboxDocId      Int?
  cianboxReceiptId  Int?

  // Relaciones
  tenant          Tenant            @relation(fields: [tenantId], references: [id])
  originSale      Sale?             @relation("SaleCreditsIssued", fields: [originSaleId], references: [id])
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

model StoreCreditTx {
  id              String            @id @default(cuid())
  storeCreditId   String

  type            StoreCreditTxType
  amount          Decimal           @db.Decimal(12, 2)
  balanceAfter    Decimal           @db.Decimal(12, 2)

  // Referencia
  saleId          String?
  description     String?

  // Relaciones
  storeCredit     StoreCredit       @relation(fields: [storeCreditId], references: [id])
  sale            Sale?             @relation(fields: [saleId], references: [id])

  createdAt       DateTime          @default(now())

  @@index([storeCreditId])
}
```

**Step 3: Agregar relaciones a modelos existentes**

En modelo `Sale` (después de `afipInvoices`):
```prisma
  creditsIssued    StoreCredit[]     @relation("SaleCreditsIssued")
  creditTransactions StoreCreditTx[]
```

En modelo `Payment` (después de `giftCardId`):
```prisma
  storeCreditId    String?
  storeCredit      StoreCredit?      @relation(fields: [storeCreditId], references: [id])
```

En modelo `User` (en la sección de relaciones):
```prisma
  storeCreditsIssued StoreCredit[]   @relation("StoreCreditIssuer")
```

En modelo `Tenant` (en la sección de relaciones):
```prisma
  storeCredits     StoreCredit[]
```

En modelo `Customer` (en la sección de relaciones):
```prisma
  storeCredits     StoreCredit[]
```

En modelo `Branch` (en la sección de relaciones):
```prisma
  storeCredits     StoreCredit[]
```

**Step 4: Agregar configuración a TenantSettings**

En modelo `TenantSettings` agregar:
```prisma
  // Configuración de Vales/Créditos
  storeCreditExpirationDays   Int      @default(90)   // 0 = sin vencimiento
  storeCreditPrefix           String   @default("VAL")
  storeCreditRequireCustomer  Boolean  @default(false)
```

**Step 5: Generar y aplicar migración**

```bash
cd apps/backend
npx prisma generate
npx prisma migrate dev --name add_store_credits
```

**Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(schema): Add StoreCredit model for advanced refunds"
```

---

## Task 2: API - Endpoints de Vales

**Files:**
- Create: `apps/backend/src/routes/store-credits.ts`
- Modify: `apps/backend/src/routes/index.ts`

**Step 1: Crear archivo de rutas**

Crear `apps/backend/src/routes/store-credits.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();

// Generar código único para vale
async function generateStoreCreditCode(tenantId: string, branchCode: string): Promise<string> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  const prefix = settings?.storeCreditPrefix || 'VAL';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `${prefix}-${branchCode}-${year}-${random}`;
}

// GET /api/store-credits/:code - Consultar vale por código
router.get(
  '/:code',
  authenticate,
  async (req, res, next) => {
    try {
      const { code } = req.params;
      const tenantId = req.user!.tenantId;

      const credit = await prisma.storeCredit.findFirst({
        where: {
          code: code.toUpperCase(),
          tenantId,
        },
        include: {
          customer: { select: { id: true, name: true, docNumber: true } },
          branch: { select: { id: true, name: true, code: true } },
          originSale: { select: { id: true, saleNumber: true, saleDate: true } },
        },
      });

      if (!credit) {
        return res.status(404).json({
          success: false,
          error: 'Vale no encontrado',
        });
      }

      // Verificar si está vencido
      if (credit.expiresAt && new Date() > credit.expiresAt) {
        if (credit.status === 'ACTIVE') {
          await prisma.storeCredit.update({
            where: { id: credit.id },
            data: { status: 'EXPIRED' },
          });
          credit.status = 'EXPIRED';
        }
      }

      res.json({
        success: true,
        data: credit,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store-credits - Listar vales
router.get(
  '/',
  authenticate,
  authorize('store-credits:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const { status, customerId, branchId, page = '1', limit = '20' } = req.query;

      const where: Prisma.StoreCreditWhereInput = { tenantId };

      if (status) where.status = status as any;
      if (customerId) where.customerId = customerId as string;
      if (branchId) where.branchId = branchId as string;

      const [credits, total] = await Promise.all([
        prisma.storeCredit.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true, code: true } },
            issuedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page as string) - 1) * parseInt(limit as string),
          take: parseInt(limit as string),
        }),
        prisma.storeCredit.count({ where }),
      ]);

      res.json({
        success: true,
        data: credits,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/store-credits - Crear vale (interno, llamado desde refund)
router.post(
  '/',
  authenticate,
  authorize('store-credits:create'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.id;
      const { amount, customerId, branchId, originSaleId, branchCode } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Monto inválido',
        });
      }

      // Obtener configuración
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      });

      // Calcular fecha de vencimiento
      let expiresAt: Date | null = null;
      const expirationDays = settings?.storeCreditExpirationDays || 90;
      if (expirationDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
      }

      // Generar código único
      const code = await generateStoreCreditCode(tenantId, branchCode || '001');

      // Crear vale
      const credit = await prisma.$transaction(async (tx) => {
        const newCredit = await tx.storeCredit.create({
          data: {
            tenantId,
            code,
            barcode: code.replace(/-/g, ''),
            originalAmount: new Prisma.Decimal(amount),
            currentBalance: new Prisma.Decimal(amount),
            expiresAt,
            customerId: customerId || null,
            branchId: branchId || null,
            originSaleId: originSaleId || null,
            issuedByUserId: userId,
          },
          include: {
            customer: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        });

        // Registrar transacción de emisión
        await tx.storeCreditTx.create({
          data: {
            storeCreditId: newCredit.id,
            type: 'ISSUED',
            amount: new Prisma.Decimal(amount),
            balanceAfter: new Prisma.Decimal(amount),
            description: originSaleId ? `Devolución de venta` : 'Emisión manual',
          },
        });

        return newCredit;
      });

      res.status(201).json({
        success: true,
        data: credit,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/store-credits/:id/redeem - Usar vale
router.post(
  '/:id/redeem',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;
      const { amount, saleId } = req.body;

      const credit = await prisma.storeCredit.findFirst({
        where: { id, tenantId },
      });

      if (!credit) {
        return res.status(404).json({
          success: false,
          error: 'Vale no encontrado',
        });
      }

      if (credit.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: `Vale ${credit.status === 'EXPIRED' ? 'vencido' : credit.status === 'USED' ? 'ya utilizado' : 'cancelado'}`,
        });
      }

      if (credit.expiresAt && new Date() > credit.expiresAt) {
        await prisma.storeCredit.update({
          where: { id },
          data: { status: 'EXPIRED' },
        });
        return res.status(400).json({
          success: false,
          error: 'Vale vencido',
        });
      }

      const redeemAmount = Math.min(amount, Number(credit.currentBalance));
      const newBalance = Number(credit.currentBalance) - redeemAmount;

      const updatedCredit = await prisma.$transaction(async (tx) => {
        const updated = await tx.storeCredit.update({
          where: { id },
          data: {
            currentBalance: new Prisma.Decimal(newBalance),
            status: newBalance === 0 ? 'USED' : 'ACTIVE',
          },
        });

        await tx.storeCreditTx.create({
          data: {
            storeCreditId: id,
            type: 'REDEEMED',
            amount: new Prisma.Decimal(-redeemAmount),
            balanceAfter: new Prisma.Decimal(newBalance),
            saleId,
            description: `Uso en venta`,
          },
        });

        return updated;
      });

      res.json({
        success: true,
        data: {
          credit: updatedCredit,
          amountRedeemed: redeemAmount,
          remainingBalance: newBalance,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/store-credits/:id/cancel - Cancelar vale
router.post(
  '/:id/cancel',
  authenticate,
  authorize('store-credits:cancel'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;
      const { reason } = req.body;

      const credit = await prisma.storeCredit.findFirst({
        where: { id, tenantId },
      });

      if (!credit) {
        return res.status(404).json({
          success: false,
          error: 'Vale no encontrado',
        });
      }

      if (credit.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden cancelar vales activos',
        });
      }

      const updatedCredit = await prisma.$transaction(async (tx) => {
        const updated = await tx.storeCredit.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        await tx.storeCreditTx.create({
          data: {
            storeCreditId: id,
            type: 'CANCELLED',
            amount: new Prisma.Decimal(0),
            balanceAfter: new Prisma.Decimal(0),
            description: reason || 'Cancelación manual',
          },
        });

        return updated;
      });

      res.json({
        success: true,
        data: updatedCredit,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store-credits/:id/transactions - Historial
router.get(
  '/:id/transactions',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;

      const credit = await prisma.storeCredit.findFirst({
        where: { id, tenantId },
      });

      if (!credit) {
        return res.status(404).json({
          success: false,
          error: 'Vale no encontrado',
        });
      }

      const transactions = await prisma.storeCreditTx.findMany({
        where: { storeCreditId: id },
        include: {
          sale: { select: { id: true, saleNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

**Step 2: Registrar rutas en index**

En `apps/backend/src/routes/index.ts`, agregar:

```typescript
import storeCreditRoutes from './store-credits';

// Después de las otras rutas
router.use('/store-credits', storeCreditRoutes);
```

**Step 3: Build y verificar**

```bash
cd apps/backend
npm run build
```

**Step 4: Commit**

```bash
git add apps/backend/src/routes/store-credits.ts apps/backend/src/routes/index.ts
git commit -m "feat(api): Add store credits endpoints"
```

---

## Task 3: Modificar Refund para generar Vale

**Files:**
- Modify: `apps/backend/src/routes/sales.ts`

**Step 1: Agregar refundType al endpoint de refund**

En el endpoint `POST /:id/refund`, modificar para aceptar `refundType`:

Buscar la validación del body y agregar:
```typescript
const { items, reason, emitCreditNote, salesPointId, supervisorPin, refundType = 'STORE_CREDIT' } = req.body;

// Validar refundType
if (!['STORE_CREDIT', 'CASH', 'EXCHANGE'].includes(refundType)) {
  return res.status(400).json({
    success: false,
    error: 'Tipo de reembolso inválido',
  });
}

// Si es CASH, requiere supervisor
if (refundType === 'CASH' && !supervisorPin) {
  return res.status(403).json({
    success: false,
    error: { code: 'AUTHORIZATION_ERROR', message: 'Devolución en efectivo requiere autorización de supervisor' },
  });
}
```

**Step 2: Después de crear la venta de devolución, generar vale si corresponde**

Después de `const refundSale = await tx.sale.create(...)` y antes del return, agregar:

```typescript
// === GENERAR VALE SI ES STORE_CREDIT ===
let storeCredit = null;
if (refundType === 'STORE_CREDIT') {
  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId },
  });

  // Calcular fecha de vencimiento
  let expiresAt: Date | null = null;
  const expirationDays = settings?.storeCreditExpirationDays || 90;
  if (expirationDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
  }

  // Obtener código de sucursal
  const branch = await tx.branch.findUnique({
    where: { id: originalSale.branchId },
    select: { code: true },
  });

  // Generar código único
  const prefix = settings?.storeCreditPrefix || 'VAL';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `${prefix}-${branch?.code || '001'}-${year}-${random}`;

  storeCredit = await tx.storeCredit.create({
    data: {
      tenantId,
      code,
      barcode: code.replace(/-/g, ''),
      originalAmount: refundTotal,
      currentBalance: refundTotal,
      expiresAt,
      customerId: originalSale.customerId,
      branchId: originalSale.branchId,
      originSaleId: refundSale.id,
      issuedByUserId: userId,
    },
  });

  // Registrar transacción de emisión
  await tx.storeCreditTx.create({
    data: {
      storeCreditId: storeCredit.id,
      type: 'ISSUED',
      amount: refundTotal,
      balanceAfter: refundTotal,
      saleId: refundSale.id,
      description: `Devolución venta ${originalSale.saleNumber}`,
    },
  });
}
```

**Step 3: Incluir storeCredit en la respuesta**

Modificar el return para incluir:
```typescript
return {
  refundSale,
  creditNote,
  isFullRefund,
  refundAmount: refundTotal.toNumber(),
  storeCredit,  // Agregar esto
};
```

**Step 4: Build y verificar**

```bash
cd apps/backend
npm run build
```

**Step 5: Commit**

```bash
git add apps/backend/src/routes/sales.ts
git commit -m "feat(refund): Generate store credit on refund"
```

---

## Task 4: Frontend - Ítems Negativos en Carrito

**Files:**
- Modify: `apps/frontend/src/pages/POS.tsx`
- Modify: `apps/frontend/src/components/Cart.tsx` (o componente de carrito)

**Step 1: Agregar campos de devolución a CartItem**

En el archivo donde se define la interfaz CartItem, agregar:

```typescript
interface CartItem {
  // ... campos existentes ...
  isReturn?: boolean;           // true = devolución
  originalSaleId?: string;      // Venta original
  originalSaleItemId?: string;  // Item original
  returnReason?: string;        // Motivo de devolución
}
```

**Step 2: Modificar ProductRefundModal para agregar al carrito**

En lugar de procesar la devolución directamente, modificar para agregar al carrito:

```typescript
// Nueva función para agregar devolución al carrito
const handleAddReturnToCart = () => {
  if (!selectedSale || !selectedItem) return;

  const returnItem: CartItem = {
    id: `return-${selectedItem.id}`,
    productId: selectedItem.productId,
    productName: selectedItem.productName,
    quantity: -quantity,  // Negativo
    unitPrice: selectedItem.unitPrice / Math.abs(selectedItem.quantity) * quantity,
    isReturn: true,
    originalSaleId: selectedSale.id,
    originalSaleItemId: selectedItem.id,
    returnReason: reason,
  };

  onAddReturnItem(returnItem);
  onClose();
};
```

**Step 3: Modificar visualización del carrito**

En el componente de carrito, agregar estilo para ítems de devolución:

```tsx
{cartItems.map((item) => (
  <div
    key={item.id}
    className={`p-3 flex items-center gap-3 ${
      item.isReturn ? 'bg-red-50 border-l-4 border-red-500' : ''
    }`}
  >
    {item.isReturn && (
      <RotateCcw className="w-4 h-4 text-red-500" />
    )}
    <div className="flex-1">
      <p className={item.isReturn ? 'text-red-700' : ''}>
        {item.productName}
      </p>
      <p className={`text-sm ${item.isReturn ? 'text-red-500' : 'text-gray-500'}`}>
        {item.quantity} x ${item.unitPrice.toFixed(2)}
      </p>
    </div>
    <p className={`font-semibold ${item.isReturn ? 'text-red-600' : ''}`}>
      ${(item.quantity * item.unitPrice).toFixed(2)}
    </p>
  </div>
))}
```

**Step 4: Modificar botón Cobrar según total**

```tsx
const total = cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

{total > 0 && (
  <button onClick={handleCheckout} className="bg-green-600 ...">
    Cobrar ${total.toFixed(2)}
  </button>
)}

{total === 0 && hasReturnItems && (
  <button onClick={handleExactExchange} className="bg-blue-600 ...">
    Confirmar Cambio Exacto
  </button>
)}

{total < 0 && (
  <button onClick={handleNegativeTotal} className="bg-orange-600 ...">
    Generar Vale ${Math.abs(total).toFixed(2)}
  </button>
)}
```

**Step 5: Build y verificar**

```bash
cd apps/frontend
npm run build
```

**Step 6: Commit**

```bash
git add apps/frontend/src/
git commit -m "feat(pos): Add return items to cart as negative items"
```

---

## Task 5: Frontend - Modal de Generación de Vale

**Files:**
- Create: `apps/frontend/src/components/StoreCreditModal.tsx`

**Step 1: Crear modal para total negativo**

```tsx
import { useState } from 'react';
import { X, Loader2, Ticket, CheckCircle, Printer } from 'lucide-react';
import api from '../services/api';

interface StoreCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  returnItems: CartItem[];
  customerId?: string;
  onSuccess: (credit: any) => void;
}

export default function StoreCreditModal({
  isOpen,
  onClose,
  amount,
  returnItems,
  customerId,
  onSuccess,
}: StoreCreditModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credit, setCredit] = useState<any>(null);

  // Modal de supervisor para efectivo
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [refundType, setRefundType] = useState<'STORE_CREDIT' | 'CASH'>('STORE_CREDIT');

  const handleGenerateCredit = async (supervisorPin?: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Obtener la venta original del primer item
      const originalSaleId = returnItems[0]?.originalSaleId;

      const response = await api.post(`/sales/${originalSaleId}/refund`, {
        items: returnItems.map(item => ({
          saleItemId: item.originalSaleItemId,
          quantity: Math.abs(item.quantity),
        })),
        reason: returnItems[0]?.returnReason || 'Devolución',
        refundType,
        emitCreditNote: false,
        supervisorPin,
      });

      if (response.data.success) {
        setCredit(response.data.data.storeCredit);
        onSuccess(response.data.data);
      }
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const errorMessage = typeof errorData === 'object'
        ? errorData?.message
        : errorData || err.message;

      if (errorMessage?.toLowerCase().includes('supervisor')) {
        setShowSupervisorPin(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    if (credit) {
      printStoreCredit(credit);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-3">
            <Ticket className="w-6 h-6 text-orange-600" />
            <h3 className="font-semibold text-lg">Generar Vale de Crédito</h3>
            <button onClick={onClose} className="ml-auto p-1 hover:bg-white/50 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {credit ? (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-xl font-semibold mb-2">Vale Generado</h4>
              <p className="text-3xl font-bold text-orange-600 mb-4">
                ${Number(credit.originalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-lg font-mono bg-gray-100 py-2 px-4 rounded mb-4">
                {credit.code}
              </p>
              {credit.expiresAt && (
                <p className="text-sm text-gray-500 mb-4">
                  Válido hasta: {new Date(credit.expiresAt).toLocaleDateString('es-AR')}
                </p>
              )}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Vale
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-gray-600 mb-2">Monto del vale:</p>
                <p className="text-4xl font-bold text-orange-600">
                  ${Math.abs(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-orange-50">
                  <input
                    type="radio"
                    checked={refundType === 'STORE_CREDIT'}
                    onChange={() => setRefundType('STORE_CREDIT')}
                    className="w-4 h-4 text-orange-600"
                  />
                  <div>
                    <p className="font-medium">Vale de Crédito</p>
                    <p className="text-sm text-gray-500">Se imprime comprobante para el cliente</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-red-50">
                  <input
                    type="radio"
                    checked={refundType === 'CASH'}
                    onChange={() => setRefundType('CASH')}
                    className="w-4 h-4 text-red-600"
                  />
                  <div>
                    <p className="font-medium">Devolución en Efectivo</p>
                    <p className="text-sm text-gray-500">Requiere autorización de supervisor</p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={() => handleGenerateCredit()}
                disabled={isProcessing}
                className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Ticket className="w-5 h-5" />
                    {refundType === 'STORE_CREDIT' ? 'Generar Vale' : 'Devolver Efectivo'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Build y verificar**

```bash
cd apps/frontend
npm run build
```

**Step 3: Commit**

```bash
git add apps/frontend/src/components/StoreCreditModal.tsx
git commit -m "feat(pos): Add store credit generation modal"
```

---

## Task 6: Frontend - Usar Vale como Método de Pago

**Files:**
- Modify: `apps/frontend/src/components/PaymentModal.tsx`

**Step 1: Agregar opción Vale/Crédito en métodos de pago**

En el array de métodos de pago, agregar:

```typescript
{
  id: 'VOUCHER',
  name: 'Vale/Crédito',
  icon: Ticket,
  color: 'orange',
}
```

**Step 2: Crear sección para buscar vale**

```tsx
{selectedMethod === 'VOUCHER' && (
  <div className="space-y-4">
    <div className="flex gap-2">
      <input
        type="text"
        value={voucherCode}
        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleSearchVoucher()}
        placeholder="Escanear o ingresar código del vale..."
        className="flex-1 px-4 py-3 border rounded-lg font-mono"
        autoFocus
      />
      <button
        onClick={handleSearchVoucher}
        disabled={isSearchingVoucher}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg"
      >
        {isSearchingVoucher ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
      </button>
    </div>

    {voucherInfo && (
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-lg">{voucherInfo.code}</span>
          <span className={`px-2 py-1 rounded text-xs ${
            voucherInfo.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {voucherInfo.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <p className="text-2xl font-bold text-orange-600 mb-1">
          Saldo: ${Number(voucherInfo.currentBalance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </p>
        {voucherInfo.expiresAt && (
          <p className="text-sm text-gray-500">
            Vence: {new Date(voucherInfo.expiresAt).toLocaleDateString('es-AR')}
          </p>
        )}
        {voucherInfo.customer && (
          <p className="text-sm text-gray-500">
            Cliente: {voucherInfo.customer.name}
          </p>
        )}
      </div>
    )}

    {voucherError && (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {voucherError}
      </div>
    )}
  </div>
)}
```

**Step 3: Agregar función para buscar vale**

```typescript
const [voucherCode, setVoucherCode] = useState('');
const [voucherInfo, setVoucherInfo] = useState<any>(null);
const [voucherError, setVoucherError] = useState<string | null>(null);
const [isSearchingVoucher, setIsSearchingVoucher] = useState(false);

const handleSearchVoucher = async () => {
  if (!voucherCode.trim()) return;

  setIsSearchingVoucher(true);
  setVoucherError(null);
  setVoucherInfo(null);

  try {
    const response = await api.get(`/store-credits/${voucherCode.trim()}`);

    if (response.data.success) {
      const credit = response.data.data;

      if (credit.status !== 'ACTIVE') {
        setVoucherError(`Vale ${credit.status === 'EXPIRED' ? 'vencido' : credit.status === 'USED' ? 'ya utilizado' : 'cancelado'}`);
        return;
      }

      if (Number(credit.currentBalance) <= 0) {
        setVoucherError('El vale no tiene saldo disponible');
        return;
      }

      setVoucherInfo(credit);
    }
  } catch (err: any) {
    setVoucherError(err.response?.data?.error || 'Vale no encontrado');
  } finally {
    setIsSearchingVoucher(false);
  }
};
```

**Step 4: Incluir vale en el pago**

Al agregar el pago, incluir storeCreditId:

```typescript
const payment = {
  method: 'VOUCHER',
  amount: Math.min(Number(voucherInfo.currentBalance), remainingAmount),
  storeCreditId: voucherInfo.id,
};
```

**Step 5: Build y verificar**

```bash
cd apps/frontend
npm run build
```

**Step 6: Commit**

```bash
git add apps/frontend/src/components/PaymentModal.tsx
git commit -m "feat(pos): Add store credit as payment method"
```

---

## Task 7: Impresión de Vale

**Files:**
- Create: `apps/frontend/src/utils/printStoreCredit.ts`

**Step 1: Crear función de impresión**

```typescript
export function printStoreCredit(credit: {
  code: string;
  originalAmount: number | string;
  currentBalance: number | string;
  expiresAt?: string | null;
  customer?: { name: string } | null;
  originSale?: { saleNumber: string } | null;
  branch?: { name: string } | null;
  issuedAt: string;
}) {
  const amount = Number(credit.originalAmount);
  const expiresDate = credit.expiresAt
    ? new Date(credit.expiresAt).toLocaleDateString('es-AR')
    : 'Sin vencimiento';
  const issuedDate = new Date(credit.issuedAt).toLocaleDateString('es-AR');

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vale de Crédito</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          padding: 5mm;
          font-size: 12px;
        }
        .header {
          text-align: center;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 10px 0;
          margin-bottom: 10px;
        }
        .title { font-size: 16px; font-weight: bold; }
        .code {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          padding: 15px 0;
          letter-spacing: 2px;
        }
        .amount {
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          padding: 10px 0;
        }
        .info { margin: 10px 0; }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          font-size: 10px;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px solid #000;
        }
        .barcode {
          text-align: center;
          padding: 10px 0;
          font-family: 'Libre Barcode 128', monospace;
          font-size: 40px;
        }
        @media print {
          body { width: 80mm; }
        }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="header">
        <div class="title">VALE DE CRÉDITO</div>
        ${credit.branch ? `<div>${credit.branch.name}</div>` : ''}
      </div>

      <div class="code">${credit.code}</div>

      <div class="barcode">${credit.code.replace(/-/g, '')}</div>

      <div class="amount">$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>

      <div class="divider"></div>

      <div class="info">
        <div class="info-row">
          <span>Emitido:</span>
          <span>${issuedDate}</span>
        </div>
        <div class="info-row">
          <span>Vence:</span>
          <span>${expiresDate}</span>
        </div>
        ${credit.customer ? `
        <div class="info-row">
          <span>Cliente:</span>
          <span>${credit.customer.name}</span>
        </div>
        ` : `
        <div class="info-row">
          <span>Cliente:</span>
          <span>Al portador</span>
        </div>
        `}
        ${credit.originSale ? `
        <div class="info-row">
          <span>Origen:</span>
          <span>${credit.originSale.saleNumber}</span>
        </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>Presentar este vale para su uso.</p>
        <p>Válido únicamente en nuestras sucursales.</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
```

**Step 2: Build y verificar**

```bash
cd apps/frontend
npm run build
```

**Step 3: Commit**

```bash
git add apps/frontend/src/utils/printStoreCredit.ts
git commit -m "feat(pos): Add store credit printing"
```

---

## Task 8: Backoffice - Gestión de Vales

**Files:**
- Create: `apps/backoffice/src/pages/StoreCredits.tsx`
- Modify: `apps/backoffice/src/App.tsx` (agregar ruta)

**Step 1: Crear página de listado de vales**

```tsx
import { useState, useEffect } from 'react';
import { Ticket, Search, Eye, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface StoreCredit {
  id: string;
  code: string;
  originalAmount: string;
  currentBalance: string;
  status: string;
  expiresAt: string | null;
  issuedAt: string;
  customer?: { id: string; name: string };
  branch?: { id: string; name: string; code: string };
  issuedBy?: { id: string; name: string };
}

export default function StoreCredits() {
  const [credits, setCredits] = useState<StoreCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    fetchCredits();
  }, [pagination.page, statusFilter]);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (statusFilter) params.append('status', statusFilter);

      const response = await api.get(`/store-credits?${params}`);
      if (response.data.success) {
        setCredits(response.data.data);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Está seguro de cancelar este vale?')) return;

    try {
      await api.post(`/store-credits/${id}/cancel`, { reason: 'Cancelación manual' });
      fetchCredits();
    } catch (error) {
      console.error('Error cancelling credit:', error);
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    USED: 'bg-gray-100 text-gray-700',
    EXPIRED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-yellow-100 text-yellow-700',
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Activo',
    USED: 'Usado',
    EXPIRED: 'Vencido',
    CANCELLED: 'Cancelado',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Ticket className="w-8 h-8 text-orange-600" />
          <h1 className="text-2xl font-bold">Vales de Crédito</h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="USED">Usados</option>
          <option value="EXPIRED">Vencidos</option>
          <option value="CANCELLED">Cancelados</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Monto Original</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Saldo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Vencimiento</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : credits.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hay vales registrados
                </td>
              </tr>
            ) : (
              credits.map((credit) => (
                <tr key={credit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{credit.code}</td>
                  <td className="px-4 py-3">
                    ${Number(credit.originalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    ${Number(credit.currentBalance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[credit.status]}`}>
                      {statusLabels[credit.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {credit.expiresAt
                      ? new Date(credit.expiresAt).toLocaleDateString('es-AR')
                      : 'Sin vencimiento'
                    }
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {credit.customer?.name || 'Al portador'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {credit.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleCancel(credit.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Cancelar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Mostrando {credits.length} de {pagination.total} vales
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="p-2 border rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.pages}
              className="p-2 border rounded disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Agregar ruta en App.tsx**

```typescript
import StoreCredits from './pages/StoreCredits';

// En las rutas
<Route path="/store-credits" element={<StoreCredits />} />
```

**Step 3: Agregar link en navegación**

En el menú de navegación, agregar:
```tsx
<NavLink to="/store-credits" icon={Ticket}>
  Vales de Crédito
</NavLink>
```

**Step 4: Build y verificar**

```bash
cd apps/backoffice
npm run build
```

**Step 5: Commit**

```bash
git add apps/backoffice/src/
git commit -m "feat(backoffice): Add store credits management page"
```

---

## Task 9: Agregar Permisos

**Files:**
- Modify: `apps/backend/prisma/seed.ts`

**Step 1: Agregar permisos de store credits**

En el seed, agregar los siguientes permisos:

```typescript
// Permisos de Vales/Créditos
{ code: 'store-credits:read', name: 'Ver vales', description: 'Ver listado de vales' },
{ code: 'store-credits:create', name: 'Crear vales', description: 'Emitir vales de crédito' },
{ code: 'store-credits:cancel', name: 'Cancelar vales', description: 'Cancelar vales de crédito' },
```

**Step 2: Asignar a roles**

- **Supervisor**: Todos los permisos
- **Cajero**: `store-credits:read`, `store-credits:create`
- **Admin**: Todos los permisos

**Step 3: Commit**

```bash
git add apps/backend/prisma/seed.ts
git commit -m "feat(seed): Add store credits permissions"
```

---

## Task 10: Deploy y Testing

**Step 1: Build completo**

```bash
cd apps/backend && npm run build
cd ../frontend && npm run build
cd ../backoffice && npm run build
```

**Step 2: Push y deploy**

```bash
git push
```

**Step 3: Verificar migración en producción**

Verificar que la migración se aplicó correctamente.

**Step 4: Testing manual**

1. Crear una venta
2. Hacer devolución del producto
3. Verificar que se genera vale
4. Usar vale como método de pago en nueva venta
5. Verificar que el saldo se descuenta correctamente

---

## Resumen de Commits

1. `feat(schema): Add StoreCredit model for advanced refunds`
2. `feat(api): Add store credits endpoints`
3. `feat(refund): Generate store credit on refund`
4. `feat(pos): Add return items to cart as negative items`
5. `feat(pos): Add store credit generation modal`
6. `feat(pos): Add store credit as payment method`
7. `feat(pos): Add store credit printing`
8. `feat(backoffice): Add store credits management page`
9. `feat(seed): Add store credits permissions`
