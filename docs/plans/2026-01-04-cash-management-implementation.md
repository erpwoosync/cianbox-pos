# Cash Management System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete cash management system with multi-currency support, treasury integration, and gift cards.

**Architecture:** Backend-first approach. Add Prisma models, then routes/services, finally Desktop Python UI. Web UI already has basic cash management - extend for multi-currency.

**Tech Stack:** Prisma 5.x, Express, TypeScript, Python/PyQt6

**Worktree:** `.worktrees/cash-management` (branch: `feature/cash-management`)

---

## Phase 1: Database Models

### Task 1.1: Add CashMode and HandoverMode enums

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Add enums after existing enums**

```prisma
enum CashMode {
  REQUIRED
  OPTIONAL
  AUTO
}

enum HandoverMode {
  CLOSE_OPEN
  TRANSFER
}
```

**Step 2: Validate schema**

Run: `cd apps/backend && npx prisma validate`
Expected: "The schema is valid!"

**Step 3: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(cash): Add CashMode and HandoverMode enums"
```

---

### Task 1.2: Add CashRegisterConfig model

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Add CashRegisterConfig model**

```prisma
model CashRegisterConfig {
  id                     String       @id @default(cuid())
  pointOfSaleId          String       @unique
  pointOfSale            PointOfSale  @relation(fields: [pointOfSaleId], references: [id])

  cashMode               CashMode     @default(REQUIRED)
  handoverMode           HandoverMode @default(CLOSE_OPEN)

  currencies             Json         @default("[\"ARS\"]")
  defaultCurrency        String       @default("ARS")

  requireCountOnClose    Boolean      @default(true)
  requireCountOnOpen     Boolean      @default(false)
  maxDifferenceAllowed   Decimal      @default(0) @db.Decimal(10, 2)

  allowPartialWithdrawal Boolean      @default(true)
  requireWithdrawalAuth  Boolean      @default(false)

  denominations          Json         @default("{}")

  tenantId               String
  tenant                 Tenant       @relation(fields: [tenantId], references: [id])

  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  @@index([tenantId])
}
```

**Step 2: Add relation to PointOfSale model**

Find PointOfSale model and add:
```prisma
  cashConfig             CashRegisterConfig?
```

**Step 3: Add relation to Tenant model**

Find Tenant model and add:
```prisma
  cashConfigs            CashRegisterConfig[]
```

**Step 4: Validate schema**

Run: `cd apps/backend && npx prisma validate`
Expected: "The schema is valid!"

**Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(cash): Add CashRegisterConfig model"
```

---

### Task 1.3: Extend CashSession for multi-currency

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Find CashSession model and add multi-currency fields**

Add after existing fields:
```prisma
  // Multi-currency support
  openingAmounts         Json?
  closingAmounts         Json?
  expectedAmounts        Json?
  differences            Json?

  // Transfer support
  transferredFromId      String?
  transferredFrom        CashSession? @relation("SessionTransfer", fields: [transferredFromId], references: [id])
  transferredTo          CashSession? @relation("SessionTransfer")
```

**Step 2: Validate schema**

Run: `cd apps/backend && npx prisma validate`
Expected: "The schema is valid!"

**Step 3: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(cash): Extend CashSession for multi-currency"
```

---

### Task 1.4: Extend CashCount for currency

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Find CashCount model and add currency field**

Add:
```prisma
  currency               String   @default("ARS")
  denominationCounts     Json?
```

**Step 2: Validate schema**

Run: `cd apps/backend && npx prisma validate`
Expected: "The schema is valid!"

**Step 3: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(cash): Add currency support to CashCount"
```

---

### Task 1.5: Add GiftCard models

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Add GiftCardStatus and GiftCardTxType enums**

```prisma
enum GiftCardStatus {
  INACTIVE
  ACTIVE
  DEPLETED
  EXPIRED
  CANCELLED
}

enum GiftCardTxType {
  ACTIVATION
  REDEMPTION
  REFUND
  ADJUSTMENT
  CANCELLATION
}
```

**Step 2: Add GiftCard model**

```prisma
model GiftCard {
  id              String          @id @default(cuid())
  code            String          @unique

  initialAmount   Decimal         @db.Decimal(10, 2)
  currentBalance  Decimal         @db.Decimal(10, 2)
  currency        String          @default("ARS")

  status          GiftCardStatus  @default(INACTIVE)

  expiresAt       DateTime?
  activatedAt     DateTime?

  tenantId        String
  tenant          Tenant          @relation(fields: [tenantId], references: [id])

  generatedById   String?
  generatedBy     User?           @relation("GiftCardGenerator", fields: [generatedById], references: [id])
  activatedById   String?
  activatedBy     User?           @relation("GiftCardActivator", fields: [activatedById], references: [id])

  transactions    GiftCardTransaction[]

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([tenantId])
  @@index([code])
  @@index([status])
}

model GiftCardTransaction {
  id            String         @id @default(cuid())
  giftCardId    String
  giftCard      GiftCard       @relation(fields: [giftCardId], references: [id])

  type          GiftCardTxType
  amount        Decimal        @db.Decimal(10, 2)
  balanceAfter  Decimal        @db.Decimal(10, 2)

  saleId        String?
  sale          Sale?          @relation(fields: [saleId], references: [id])
  userId        String
  user          User           @relation(fields: [userId], references: [id])

  notes         String?
  createdAt     DateTime       @default(now())

  @@index([giftCardId])
  @@index([saleId])
}
```

**Step 3: Add relations to Tenant, User, Sale models**

In Tenant:
```prisma
  giftCards              GiftCard[]
```

In User:
```prisma
  generatedGiftCards     GiftCard[] @relation("GiftCardGenerator")
  activatedGiftCards     GiftCard[] @relation("GiftCardActivator")
  giftCardTransactions   GiftCardTransaction[]
```

In Sale:
```prisma
  giftCardTransactions   GiftCardTransaction[]
```

**Step 4: Validate schema**

Run: `cd apps/backend && npx prisma validate`
Expected: "The schema is valid!"

**Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(cash): Add GiftCard and GiftCardTransaction models"
```

---

### Task 1.6: Add TreasuryPending model

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Add TreasuryStatus enum**

```prisma
enum TreasuryStatus {
  PENDING
  CONFIRMED
  PARTIAL
  REJECTED
}
```

**Step 2: Add TreasuryPending model**

```prisma
model TreasuryPending {
  id                String          @id @default(cuid())

  cashMovementId    String
  cashMovement      CashMovement    @relation(fields: [cashMovementId], references: [id])
  cashSessionId     String
  cashSession       CashSession     @relation(fields: [cashSessionId], references: [id])

  amount            Decimal         @db.Decimal(10, 2)
  currency          String          @default("ARS")

  status            TreasuryStatus  @default(PENDING)

  confirmedAt       DateTime?
  confirmedById     String?
  confirmedBy       User?           @relation(fields: [confirmedById], references: [id])
  confirmedAmount   Decimal?        @db.Decimal(10, 2)
  differenceNotes   String?

  receiptNumber     String?

  tenantId          String
  tenant            Tenant          @relation(fields: [tenantId], references: [id])

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([tenantId])
  @@index([status])
}
```

**Step 3: Add relations**

In CashMovement:
```prisma
  treasuryPending        TreasuryPending?
```

In CashSession:
```prisma
  treasuryPendings       TreasuryPending[]
```

In User:
```prisma
  confirmedTreasury      TreasuryPending[]
```

In Tenant:
```prisma
  treasuryPendings       TreasuryPending[]
```

**Step 4: Validate schema**

Run: `cd apps/backend && npx prisma validate`
Expected: "The schema is valid!"

**Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(cash): Add TreasuryPending model"
```

---

### Task 1.7: Generate Prisma client and verify

**Files:**
- None (verification only)

**Step 1: Generate Prisma client**

Run: `cd apps/backend && npx prisma generate`
Expected: "Generated Prisma Client"

**Step 2: Build to verify no TypeScript errors**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 3: Commit any generated changes**

```bash
git add -A
git commit -m "chore: Regenerate Prisma client with cash models" --allow-empty
```

---

## Phase 2: Backend API - Cash Config

### Task 2.1: Create cash config validation schemas

**Files:**
- Create: `apps/backend/src/schemas/cash-config.schema.ts`

**Step 1: Create schema file**

```typescript
import { z } from 'zod';

export const cashModeSchema = z.enum(['REQUIRED', 'OPTIONAL', 'AUTO']);
export const handoverModeSchema = z.enum(['CLOSE_OPEN', 'TRANSFER']);

export const createCashConfigSchema = z.object({
  pointOfSaleId: z.string().cuid(),
  cashMode: cashModeSchema.optional().default('REQUIRED'),
  handoverMode: handoverModeSchema.optional().default('CLOSE_OPEN'),
  currencies: z.array(z.string()).optional().default(['ARS']),
  defaultCurrency: z.string().optional().default('ARS'),
  requireCountOnClose: z.boolean().optional().default(true),
  requireCountOnOpen: z.boolean().optional().default(false),
  maxDifferenceAllowed: z.number().optional().default(0),
  allowPartialWithdrawal: z.boolean().optional().default(true),
  requireWithdrawalAuth: z.boolean().optional().default(false),
  denominations: z.record(z.object({
    bills: z.array(z.number()),
    coins: z.array(z.number()),
  })).optional().default({}),
});

export const updateCashConfigSchema = createCashConfigSchema.partial().omit({ pointOfSaleId: true });

export type CreateCashConfigInput = z.infer<typeof createCashConfigSchema>;
export type UpdateCashConfigInput = z.infer<typeof updateCashConfigSchema>;
```

**Step 2: Commit**

```bash
git add apps/backend/src/schemas/cash-config.schema.ts
git commit -m "feat(cash): Add cash config validation schemas"
```

---

### Task 2.2: Create cash config routes

**Files:**
- Create: `apps/backend/src/routes/cash-config.ts`

**Step 1: Create routes file**

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { ApiError } from '../utils/errors';
import { createCashConfigSchema, updateCashConfigSchema } from '../schemas/cash-config.schema';

const router = Router();

// Get config for a POS
router.get('/pos/:posId', authMiddleware, async (req, res, next) => {
  try {
    const { posId } = req.params;
    const tenantId = req.user!.tenantId;

    const config = await prisma.cashRegisterConfig.findFirst({
      where: {
        pointOfSaleId: posId,
        tenantId,
      },
    });

    if (!config) {
      // Return default config if none exists
      return res.json({
        cashMode: 'REQUIRED',
        handoverMode: 'CLOSE_OPEN',
        currencies: ['ARS'],
        defaultCurrency: 'ARS',
        requireCountOnClose: true,
        requireCountOnOpen: false,
        maxDifferenceAllowed: 0,
        allowPartialWithdrawal: true,
        requireWithdrawalAuth: false,
        denominations: {
          ARS: {
            bills: [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10],
            coins: [500, 200, 100, 50, 25, 10, 5, 2, 1],
          },
        },
      });
    }

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Create or update config
router.put('/pos/:posId', authMiddleware, validateBody(updateCashConfigSchema), async (req, res, next) => {
  try {
    const { posId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify POS belongs to tenant
    const pos = await prisma.pointOfSale.findFirst({
      where: { id: posId, tenantId },
    });

    if (!pos) {
      throw new ApiError(404, 'POS not found');
    }

    const config = await prisma.cashRegisterConfig.upsert({
      where: { pointOfSaleId: posId },
      create: {
        pointOfSaleId: posId,
        tenantId,
        ...req.body,
      },
      update: req.body,
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
});

export default router;
```

**Step 2: Register routes in app**

In `apps/backend/src/app.ts`, add:
```typescript
import cashConfigRoutes from './routes/cash-config';
// ...
app.use('/api/cash-config', cashConfigRoutes);
```

**Step 3: Build to verify**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/backend/src/routes/cash-config.ts apps/backend/src/app.ts
git commit -m "feat(cash): Add cash config API routes"
```

---

## Phase 3: Backend API - Gift Cards

### Task 3.1: Create gift card validation schemas

**Files:**
- Create: `apps/backend/src/schemas/gift-card.schema.ts`

**Step 1: Create schema file**

```typescript
import { z } from 'zod';

export const generateGiftCardsSchema = z.object({
  quantity: z.number().int().min(1).max(100),
  amount: z.number().positive(),
  currency: z.string().default('ARS'),
  expiresAt: z.string().datetime().optional(),
});

export const activateGiftCardSchema = z.object({
  code: z.string().length(16),
});

export const redeemGiftCardSchema = z.object({
  code: z.string().length(16),
  amount: z.number().positive(),
  saleId: z.string().cuid().optional(),
});

export const checkBalanceSchema = z.object({
  code: z.string().length(16),
});

export type GenerateGiftCardsInput = z.infer<typeof generateGiftCardsSchema>;
export type ActivateGiftCardInput = z.infer<typeof activateGiftCardSchema>;
export type RedeemGiftCardInput = z.infer<typeof redeemGiftCardSchema>;
```

**Step 2: Commit**

```bash
git add apps/backend/src/schemas/gift-card.schema.ts
git commit -m "feat(gift-cards): Add gift card validation schemas"
```

---

### Task 3.2: Create gift card service

**Files:**
- Create: `apps/backend/src/services/gift-card.service.ts`

**Step 1: Create service file**

```typescript
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import crypto from 'crypto';

function generateCode(): string {
  // Generate 16 character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

export async function generateGiftCards(
  tenantId: string,
  userId: string,
  quantity: number,
  amount: number,
  currency: string,
  expiresAt?: Date
) {
  const giftCards = [];

  for (let i = 0; i < quantity; i++) {
    let code: string;
    let exists = true;

    // Ensure unique code
    while (exists) {
      code = generateCode();
      const existing = await prisma.giftCard.findUnique({ where: { code } });
      exists = !!existing;
    }

    const giftCard = await prisma.giftCard.create({
      data: {
        code: code!,
        initialAmount: amount,
        currentBalance: amount,
        currency,
        status: 'INACTIVE',
        expiresAt,
        tenantId,
        generatedById: userId,
      },
    });

    giftCards.push(giftCard);
  }

  return giftCards;
}

export async function activateGiftCard(code: string, userId: string, tenantId: string) {
  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
  });

  if (!giftCard) {
    throw new ApiError(404, 'Gift card not found');
  }

  if (giftCard.status !== 'INACTIVE') {
    throw new ApiError(400, `Gift card is ${giftCard.status.toLowerCase()}`);
  }

  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'EXPIRED' },
    });
    throw new ApiError(400, 'Gift card has expired');
  }

  const [updated, transaction] = await prisma.$transaction([
    prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedById: userId,
      },
    }),
    prisma.giftCardTransaction.create({
      data: {
        giftCardId: giftCard.id,
        type: 'ACTIVATION',
        amount: giftCard.initialAmount,
        balanceAfter: giftCard.currentBalance,
        userId,
      },
    }),
  ]);

  return updated;
}

export async function redeemGiftCard(
  code: string,
  amount: number,
  userId: string,
  tenantId: string,
  saleId?: string
) {
  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
  });

  if (!giftCard) {
    throw new ApiError(404, 'Gift card not found');
  }

  if (giftCard.status !== 'ACTIVE') {
    throw new ApiError(400, `Gift card is ${giftCard.status.toLowerCase()}`);
  }

  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'EXPIRED' },
    });
    throw new ApiError(400, 'Gift card has expired');
  }

  if (Number(giftCard.currentBalance) < amount) {
    throw new ApiError(400, `Insufficient balance. Available: ${giftCard.currentBalance}`);
  }

  const newBalance = Number(giftCard.currentBalance) - amount;
  const newStatus = newBalance <= 0 ? 'DEPLETED' : 'ACTIVE';

  const [updated, transaction] = await prisma.$transaction([
    prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        currentBalance: newBalance,
        status: newStatus,
      },
    }),
    prisma.giftCardTransaction.create({
      data: {
        giftCardId: giftCard.id,
        type: 'REDEMPTION',
        amount: -amount,
        balanceAfter: newBalance,
        userId,
        saleId,
      },
    }),
  ]);

  return { giftCard: updated, transaction };
}

export async function getGiftCardBalance(code: string, tenantId: string) {
  const giftCard = await prisma.giftCard.findFirst({
    where: { code, tenantId },
    select: {
      code: true,
      currentBalance: true,
      currency: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!giftCard) {
    throw new ApiError(404, 'Gift card not found');
  }

  return giftCard;
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/services/gift-card.service.ts
git commit -m "feat(gift-cards): Add gift card service"
```

---

### Task 3.3: Create gift card routes

**Files:**
- Create: `apps/backend/src/routes/gift-cards.ts`

**Step 1: Create routes file**

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  generateGiftCardsSchema,
  activateGiftCardSchema,
  redeemGiftCardSchema,
  checkBalanceSchema,
} from '../schemas/gift-card.schema';
import * as giftCardService from '../services/gift-card.service';

const router = Router();

// Generate gift cards (admin only)
router.post('/generate', authMiddleware, validateBody(generateGiftCardsSchema), async (req, res, next) => {
  try {
    const { quantity, amount, currency, expiresAt } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const giftCards = await giftCardService.generateGiftCards(
      tenantId,
      userId,
      quantity,
      amount,
      currency,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.status(201).json({ count: giftCards.length, giftCards });
  } catch (error) {
    next(error);
  }
});

// Activate gift card
router.post('/activate', authMiddleware, validateBody(activateGiftCardSchema), async (req, res, next) => {
  try {
    const { code } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const giftCard = await giftCardService.activateGiftCard(code, userId, tenantId);

    res.json(giftCard);
  } catch (error) {
    next(error);
  }
});

// Redeem gift card
router.post('/redeem', authMiddleware, validateBody(redeemGiftCardSchema), async (req, res, next) => {
  try {
    const { code, amount, saleId } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const result = await giftCardService.redeemGiftCard(code, amount, userId, tenantId, saleId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Check balance
router.post('/balance', authMiddleware, validateBody(checkBalanceSchema), async (req, res, next) => {
  try {
    const { code } = req.body;
    const tenantId = req.user!.tenantId;

    const balance = await giftCardService.getGiftCardBalance(code, tenantId);

    res.json(balance);
  } catch (error) {
    next(error);
  }
});

export default router;
```

**Step 2: Register routes in app**

In `apps/backend/src/app.ts`, add:
```typescript
import giftCardRoutes from './routes/gift-cards';
// ...
app.use('/api/gift-cards', giftCardRoutes);
```

**Step 3: Build to verify**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/backend/src/routes/gift-cards.ts apps/backend/src/app.ts
git commit -m "feat(gift-cards): Add gift card API routes"
```

---

## Phase 4: Backend API - Treasury

### Task 4.1: Create treasury validation schemas

**Files:**
- Create: `apps/backend/src/schemas/treasury.schema.ts`

**Step 1: Create schema file**

```typescript
import { z } from 'zod';

export const createWithdrawalSchema = z.object({
  cashSessionId: z.string().cuid(),
  amount: z.number().positive(),
  currency: z.string().default('ARS'),
  notes: z.string().optional(),
});

export const confirmWithdrawalSchema = z.object({
  confirmedAmount: z.number().positive(),
  differenceNotes: z.string().optional(),
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().min(1),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
export type ConfirmWithdrawalInput = z.infer<typeof confirmWithdrawalSchema>;
```

**Step 2: Commit**

```bash
git add apps/backend/src/schemas/treasury.schema.ts
git commit -m "feat(treasury): Add treasury validation schemas"
```

---

### Task 4.2: Create treasury routes

**Files:**
- Create: `apps/backend/src/routes/treasury.ts`

**Step 1: Create routes file**

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { ApiError } from '../utils/errors';
import {
  createWithdrawalSchema,
  confirmWithdrawalSchema,
  rejectWithdrawalSchema,
} from '../schemas/treasury.schema';

const router = Router();

// Generate receipt number
function generateReceiptNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RET-${dateStr}-${random}`;
}

// Create withdrawal to treasury
router.post('/withdraw', authMiddleware, validateBody(createWithdrawalSchema), async (req, res, next) => {
  try {
    const { cashSessionId, amount, currency, notes } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    // Verify session belongs to tenant and is open
    const session = await prisma.cashSession.findFirst({
      where: {
        id: cashSessionId,
        tenantId,
        status: 'OPEN',
      },
    });

    if (!session) {
      throw new ApiError(404, 'Cash session not found or not open');
    }

    // Create movement and treasury pending in transaction
    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          cashSessionId,
          type: 'WITHDRAWAL',
          amount: -amount,
          reason: 'TREASURY',
          notes,
          userId,
          tenantId,
        },
      });

      const pending = await tx.treasuryPending.create({
        data: {
          cashMovementId: movement.id,
          cashSessionId,
          amount,
          currency,
          status: 'PENDING',
          receiptNumber: generateReceiptNumber(),
          tenantId,
        },
      });

      return { movement, pending };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// List pending withdrawals
router.get('/pending', authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;

    const pending = await prisma.treasuryPending.findMany({
      where: {
        tenantId,
        status: 'PENDING',
      },
      include: {
        cashSession: {
          include: {
            user: { select: { name: true } },
            pointOfSale: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pending);
  } catch (error) {
    next(error);
  }
});

// Confirm withdrawal
router.post('/:id/confirm', authMiddleware, validateBody(confirmWithdrawalSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirmedAmount, differenceNotes } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const pending = await prisma.treasuryPending.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!pending) {
      throw new ApiError(404, 'Pending withdrawal not found');
    }

    const status = confirmedAmount === Number(pending.amount) ? 'CONFIRMED' : 'PARTIAL';

    const updated = await prisma.treasuryPending.update({
      where: { id },
      data: {
        status,
        confirmedAmount,
        confirmedAt: new Date(),
        confirmedById: userId,
        differenceNotes,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Reject withdrawal
router.post('/:id/reject', authMiddleware, validateBody(rejectWithdrawalSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const pending = await prisma.treasuryPending.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!pending) {
      throw new ApiError(404, 'Pending withdrawal not found');
    }

    const updated = await prisma.treasuryPending.update({
      where: { id },
      data: {
        status: 'REJECTED',
        confirmedAt: new Date(),
        confirmedById: userId,
        differenceNotes: reason,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
```

**Step 2: Register routes in app**

In `apps/backend/src/app.ts`, add:
```typescript
import treasuryRoutes from './routes/treasury';
// ...
app.use('/api/treasury', treasuryRoutes);
```

**Step 3: Build to verify**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/backend/src/routes/treasury.ts apps/backend/src/app.ts
git commit -m "feat(treasury): Add treasury API routes"
```

---

## Phase 5: Extend Cash Routes for Multi-Currency

### Task 5.1: Update cash open/close for multi-currency

**Files:**
- Modify: `apps/backend/src/routes/cash.ts`

**Step 1: Update openSession schema**

Find the `openSessionSchema` and update to support multi-currency:
```typescript
const openSessionSchema = z.object({
  pointOfSaleId: z.string().cuid(),
  openingAmount: z.number().min(0).optional(), // Legacy single currency
  openingAmounts: z.record(z.number().min(0)).optional(), // Multi-currency
  notes: z.string().optional(),
});
```

**Step 2: Update the open session handler**

In the POST `/open` handler, update to handle both:
```typescript
// After validation, before creating session:
const openingAmounts = body.openingAmounts || (body.openingAmount !== undefined ? { ARS: body.openingAmount } : { ARS: 0 });

// When creating session:
const session = await prisma.cashSession.create({
  data: {
    pointOfSaleId: body.pointOfSaleId,
    userId: req.user!.id,
    tenantId,
    status: 'OPEN',
    openedAt: new Date(),
    openingAmount: body.openingAmount || Object.values(openingAmounts)[0] || 0,
    openingAmounts,
  },
  // ...
});
```

**Step 3: Update closeSession schema**

```typescript
const closeSessionSchema = z.object({
  closingAmount: z.number().min(0).optional(),
  closingAmounts: z.record(z.number().min(0)).optional(),
  notes: z.string().optional(),
});
```

**Step 4: Update the close session handler**

Calculate expected amounts and differences:
```typescript
// In POST `/close` handler:
const closingAmounts = body.closingAmounts || (body.closingAmount !== undefined ? { ARS: body.closingAmount } : undefined);

// Calculate expected amounts per currency
const expectedAmounts = await calculateExpectedAmounts(session.id);
const differences: Record<string, number> = {};

if (closingAmounts) {
  for (const [currency, closing] of Object.entries(closingAmounts)) {
    const expected = expectedAmounts[currency] || 0;
    differences[currency] = closing - expected;
  }
}

// Update session with multi-currency data
await prisma.cashSession.update({
  where: { id: session.id },
  data: {
    status: 'CLOSED',
    closedAt: new Date(),
    closingAmount: body.closingAmount || Object.values(closingAmounts || {})[0] || 0,
    closingAmounts,
    expectedAmounts,
    differences,
    // ...
  },
});
```

**Step 5: Build to verify**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 6: Commit**

```bash
git add apps/backend/src/routes/cash.ts
git commit -m "feat(cash): Support multi-currency in open/close"
```

---

### Task 5.2: Update cash count for currency

**Files:**
- Modify: `apps/backend/src/routes/cash.ts`

**Step 1: Update count schema**

```typescript
const countSchema = z.object({
  currency: z.string().default('ARS'),
  denominationCounts: z.record(z.number().int().min(0)).optional(),
  total: z.number().min(0),
  notes: z.string().optional(),
});
```

**Step 2: Update the count handler**

```typescript
// In POST `/count` handler:
const count = await prisma.cashCount.create({
  data: {
    cashSessionId: session.id,
    countedAmount: body.total,
    currency: body.currency,
    denominationCounts: body.denominationCounts,
    notes: body.notes,
    userId: req.user!.id,
    tenantId,
  },
});
```

**Step 3: Build to verify**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/backend/src/routes/cash.ts
git commit -m "feat(cash): Support currency in cash count"
```

---

## Phase 6: Final Build and Push

### Task 6.1: Full build verification

**Step 1: Build backend**

Run: `cd apps/backend && npm run build`
Expected: No errors

**Step 2: Build frontend (if TypeScript changes affect it)**

Run: `cd apps/frontend && npm install && npm run build`
Expected: No errors

**Step 3: Build backoffice (if needed)**

Run: `cd apps/backoffice && npm install && npm run build`
Expected: No errors

**Step 4: Commit any final changes**

```bash
git add -A
git commit -m "chore: Final build verification" --allow-empty
```

---

### Task 6.2: Push branch

**Step 1: Push to remote**

Run: `git push -u origin feature/cash-management`
Expected: Branch pushed successfully

---

## Summary

**Models added:**
- CashRegisterConfig
- GiftCard
- GiftCardTransaction
- TreasuryPending

**Enums added:**
- CashMode, HandoverMode
- GiftCardStatus, GiftCardTxType
- TreasuryStatus

**Routes added:**
- `/api/cash-config` - POS configuration
- `/api/gift-cards` - Gift card lifecycle
- `/api/treasury` - Treasury withdrawals

**Extended:**
- CashSession - multi-currency support
- CashCount - currency field
- `/api/cash` - multi-currency open/close/count

---

**Next steps after backend:**
1. Desktop Python UI for cash management
2. Web UI extensions for multi-currency
3. Backoffice UI for treasury confirmation
4. Gift card management in backoffice
