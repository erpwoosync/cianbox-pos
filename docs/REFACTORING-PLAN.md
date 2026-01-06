# Plan de Refactoring - Backend Cianbox POS

**Fecha de creación:** 2026-01-06
**Estado:** En progreso
**Última actualización:** 2026-01-06

---

## Resumen Ejecutivo

Este documento detalla el plan de refactoring para mejorar la arquitectura del backend, eliminando código duplicado y aplicando principios de programación orientada a objetos.

---

## Checklist de Tareas

### Fase 1: Fundamentos (Prioridad CRÍTICA)

- [x] **1.1 Crear Singleton PrismaClient** ✅ COMPLETADO (2026-01-06)
  - Crear `apps/backend/src/lib/prisma.ts`
  - Actualizar imports en todos los archivos de rutas
  - Actualizar imports en todos los servicios
  - Verificar que no haya instancias duplicadas
  - **Archivos modificados:**
    - [x] `src/routes/products.ts`
    - [x] `src/routes/customers.ts`
    - [x] `src/routes/sales.ts`
    - [x] `src/routes/promotions.ts`
    - [x] `src/routes/terminals.ts`
    - [x] `src/routes/cash.ts`
    - [x] `src/routes/backoffice.ts`
    - [x] `src/routes/cianbox.ts`
    - [x] `src/routes/mercadopago.ts`
    - [x] `src/routes/cash-config.ts`
    - [x] `src/routes/treasury.ts`
    - [x] `src/routes/webhooks.ts`
    - [x] `src/routes/afip.ts`
    - [x] `src/routes/auth.ts`
    - [x] `src/services/gift-card.service.ts`
    - [x] `src/services/store-credit.service.ts`
    - [x] `src/services/cianbox.service.ts`
    - [x] `src/services/afip.service.ts`
    - [x] `src/services/mercadopago.service.ts`

- [x] **1.2 Unificar Manejo de Errores** ✅ COMPLETADO (2026-01-06)
  - Revisar `src/utils/errors.ts` - asegurar que tiene todas las clases necesarias
  - Reemplazar respuestas JSON directas por throws de errores
  - **Archivos modificados:**
    - [x] `src/routes/customers.ts` (cambiado res.status().json() por throw NotFoundError/ApiError)

### Fase 2: Capa de Repositorios (Prioridad ALTA)

- [x] **2.1 Crear BaseRepository** ✅ COMPLETADO (2026-01-06)
  - Crear `apps/backend/src/repositories/base.repository.ts`
  - Implementar métodos genéricos:
    - [x] `findById()`
    - [x] `findByIdOrFail()`
    - [x] `findMany()` con paginación
    - [x] `findAll()` sin paginación
    - [x] `create()`
    - [x] `update()`
    - [x] `delete()`
    - [x] `count()`
    - [x] `exists()`

- [x] **2.2 Crear Repositorios Específicos** ✅ COMPLETADO
  - [x] `src/repositories/product.repository.ts` ✅
  - [x] `src/repositories/customer.repository.ts` ✅
  - [x] `src/repositories/promotion.repository.ts` ✅
  - [x] `src/repositories/combo.repository.ts` ✅
  - [x] `src/repositories/index.ts` (exportaciones) ✅
  - [ ] `src/repositories/sale.repository.ts` (opcional - sales.ts necesita SaleService)

- [x] **2.3 Refactorizar Rutas con Repositorios** ✅ COMPLETADO
  - [x] `src/routes/customers.ts` - Refactorizado (349→227 líneas)
  - [x] `src/routes/products.ts` - Refactorizado (730→660 líneas)
  - [x] `src/routes/promotions.ts` - Refactorizado (935→879 líneas)

### Fase 3: Capa de Servicios (Prioridad ALTA)

- [x] **3.1 Crear SaleService** ✅ COMPLETADO (2026-01-06)
  - Crear `apps/backend/src/services/sale.service.ts` ✅
  - Extraer lógica de `POST /sales` - Reducido de 1504 a 1328 líneas (-176 líneas)
  - Métodos implementados:
    - [x] `generateSaleNumber()` ✅
    - [x] `validateBranchAndPOS()` ✅
    - [x] `calculateTotals()` ✅
    - [x] `validatePayments()` ✅
    - [x] `calculatePaymentTotals()` ✅
    - [x] `updateStock()` ✅
    - [x] `updateCashSession()` ✅
    - [x] `findOpenCashSession()` ✅
    - [x] `preparePaymentData()` ✅
  - [ ] `processRefund()` - Pendiente (opcional, 390 líneas)

- [ ] **3.2 Crear CashService**
  - Crear `apps/backend/src/services/cash.service.ts`
  - Extraer funciones de `src/routes/cash.ts`
  - Métodos a implementar:
    - [ ] `generateSessionNumber()`
    - [ ] `calculateExpectedCash()`
    - [ ] `calculatePaymentTotals()`
    - [ ] `calculateDenominationTotals()`
    - [ ] `openSession()`
    - [ ] `closeSession()`
    - [ ] `transferSession()`

- [ ] **3.3 Unificar GiftCard y StoreCredit**
  - Crear clase base `CreditInstrumentService`
  - Refactorizar `gift-card.service.ts` para usar clase
  - Refactorizar `store-credit.service.ts` para heredar de base
  - Métodos comunes a abstraer:
    - [ ] `checkBalance()`
    - [ ] `redeem()`
    - [ ] `cancel()`
    - [ ] `list()`
    - [ ] `getTransactions()`

### Fase 4: Simplificación de Rutas (Prioridad MEDIA)

- [ ] **4.1 Refactorizar sales.ts**
  - Reducir de 1505 líneas usando SaleService
  - Mantener solo validación de request y respuesta

- [ ] **4.2 Refactorizar cash.ts**
  - Reducir usando CashService
  - Mantener solo validación de request y respuesta

- [ ] **4.3 Crear BaseRouter (Opcional)**
  - Crear clase base con CRUD genérico
  - Aplicar a rutas simples (products, customers, promotions)

### Fase 5: Testing y Documentación (Prioridad BAJA)

- [ ] **5.1 Agregar tests unitarios para servicios nuevos**
- [ ] **5.2 Actualizar documentación de API**
- [ ] **5.3 Actualizar CLAUDE.md con nueva arquitectura**

---

## Detalle de Implementación

### 1.1 Singleton PrismaClient

**Archivo a crear:** `apps/backend/src/lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

**Patrón de reemplazo en archivos:**

```typescript
// ANTES
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// DESPUÉS
import prisma from '../lib/prisma.js';
```

---

### 2.1 BaseRepository

**Archivo a crear:** `apps/backend/src/repositories/base.repository.ts`

```typescript
import prisma from '../lib/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export abstract class BaseRepository<T, TCreateInput, TUpdateInput> {
  protected prisma = prisma;
  protected abstract modelName: string;
  protected abstract delegate: any;

  async findById(id: string, tenantId: string, include?: object): Promise<T | null> {
    return this.delegate.findFirst({
      where: { id, tenantId },
      include,
    });
  }

  async findByIdOrFail(id: string, tenantId: string, include?: object): Promise<T> {
    const result = await this.findById(id, tenantId, include);
    if (!result) {
      throw new NotFoundError(this.modelName);
    }
    return result;
  }

  async findMany(
    tenantId: string,
    filters: object = {},
    pagination: PaginationParams = {},
    include?: object,
    orderBy: object = { createdAt: 'desc' }
  ): Promise<PaginatedResult<T>> {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 50;
    const skip = (page - 1) * pageSize;
    const where = { ...filters, tenantId };

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.delegate.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async create(tenantId: string, data: TCreateInput, include?: object): Promise<T> {
    return this.delegate.create({
      data: { ...data, tenantId },
      include,
    });
  }

  async update(id: string, tenantId: string, data: TUpdateInput, include?: object): Promise<T> {
    await this.findByIdOrFail(id, tenantId);
    return this.delegate.update({
      where: { id },
      data,
      include,
    });
  }

  async delete(id: string, tenantId: string): Promise<T> {
    await this.findByIdOrFail(id, tenantId);
    return this.delegate.delete({
      where: { id },
    });
  }
}
```

---

## Progreso

| Fase | Estado | Progreso | Notas |
|------|--------|----------|-------|
| Fase 1 | ✅ Completado | 100% | Singleton PrismaClient + Errores unificados |
| Fase 2 | ✅ Completado | 100% | 4 Repositorios + 3 rutas refactorizadas (-192 líneas total) |
| Fase 3 | 🔄 En progreso | 50% | SaleService creado (-176 líneas) |
| Fase 4 | Pendiente | 0% | Depende de Fase 2 y 3 |
| Fase 5 | Pendiente | 0% | Depende de Fase 4 |

---

## Notas de Implementación

- Hacer commits pequeños y frecuentes
- Ejecutar build después de cada cambio
- No romper funcionalidad existente
- Mantener compatibilidad con frontend actual

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-01-06 | Creación del documento | Claude |
| 2026-01-06 | Fase 1 completada: Singleton PrismaClient (20 archivos) + Errores unificados (customers.ts) | Claude |
| 2026-01-06 | Fase 2 parcial: BaseRepository + ProductRepository + CustomerRepository + customers.ts refactorizado | Claude |
| 2026-01-06 | Fase 2 continúa: ProductRepository extendido + products.ts refactorizado (730→660 líneas) | Claude |
| 2026-01-06 | Fase 2 completada: PromotionRepository + ComboRepository + promotions.ts refactorizado | Claude |
| 2026-01-06 | Fase 3 parcial: SaleService creado, POST /sales refactorizado (1504→1328 líneas) | Claude |
