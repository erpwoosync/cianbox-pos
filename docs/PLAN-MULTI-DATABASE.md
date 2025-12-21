# Plan de Implementación: Multi-Database Sharding

## Resumen

Habilitar el sistema para soportar múltiples servidores de base de datos, permitiendo que cada tenant pueda estar en un servidor diferente para escalabilidad horizontal.

## Estado Actual

### Lo que YA existe:
- `DatabaseService.forTenant(tenantId)` - Retorna conexión según servidor asignado
- Pool de conexiones con cache por servidor
- Modelo `DatabaseServer` con credenciales encriptadas
- UI en Agency Backoffice para gestionar servidores
- Asignación de `databaseServerId` en tenants

### El problema:
Todas las rutas usan `prisma` (conexión master) directamente:
```typescript
// Actualmente - TODO va a la misma DB:
const products = await prisma.product.findMany({ where: { tenantId } });
```

---

## Plan de Implementación

### Fase 1: Preparar Infraestructura

#### 1.1 Crear script de inicialización de DB
Crear script que inicialice un nuevo servidor de DB con el schema de Prisma.

**Archivo:** `apps/backend/scripts/init-database-server.ts`
```typescript
/**
 * Script para inicializar un nuevo servidor de base de datos
 * Uso: npx ts-node scripts/init-database-server.ts <serverId>
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function initServer(serverId: string) {
  // 1. Obtener credenciales del servidor
  // 2. Construir DATABASE_URL temporal
  // 3. Ejecutar prisma db push contra ese servidor
  // 4. Marcar servidor como inicializado
}
```

#### 1.2 Agregar campo `isInitialized` a DatabaseServer
```prisma
model DatabaseServer {
  // ... campos existentes
  isInitialized Boolean @default(false)
  initializedAt DateTime?
}
```

---

### Fase 2: Crear Middleware de Conexión

#### 2.1 Crear middleware que inyecta la conexión correcta

**Archivo:** `apps/backend/src/middleware/tenantDb.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import DatabaseService from '../services/database.service';
import { PrismaClient } from '@prisma/client';

// Extender Request para incluir db del tenant
declare global {
  namespace Express {
    interface Request {
      tenantDb?: PrismaClient;
    }
  }
}

/**
 * Middleware que obtiene la conexión de DB correcta para el tenant
 * Debe ejecutarse DESPUÉS del middleware de auth
 */
export async function tenantDbMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return next(); // Rutas públicas no necesitan tenant DB
    }

    req.tenantDb = await DatabaseService.forTenant(tenantId);
    next();
  } catch (error) {
    next(error);
  }
}
```

#### 2.2 Aplicar middleware en index.ts
```typescript
import { tenantDbMiddleware } from './middleware/tenantDb';

// Después de authMiddleware
app.use(tenantDbMiddleware);
```

---

### Fase 3: Migrar Rutas (Orden de Prioridad)

#### 3.1 Rutas de LECTURA (bajo riesgo)

| Archivo | Prioridad | Complejidad |
|---------|-----------|-------------|
| `routes/products.ts` | Alta | Baja |
| `routes/categories.ts` | Alta | Baja |
| `routes/brands.ts` | Alta | Baja |
| `routes/customers.ts` | Media | Baja |
| `routes/price-lists.ts` | Media | Baja |

**Cambio típico:**
```typescript
// ANTES
router.get('/', auth, async (req, res) => {
  const products = await prisma.product.findMany({
    where: { tenantId: req.user!.tenantId }
  });
});

// DESPUÉS
router.get('/', auth, async (req, res) => {
  const db = req.tenantDb!;
  const products = await db.product.findMany({
    where: { tenantId: req.user!.tenantId }
  });
});
```

#### 3.2 Rutas de ESCRITURA (riesgo medio)

| Archivo | Prioridad | Complejidad |
|---------|-----------|-------------|
| `routes/sales.ts` | Alta | Media |
| `routes/inventory.ts` | Media | Media |
| `routes/promotions.ts` | Baja | Baja |

#### 3.3 Rutas de AUTH (riesgo alto)

| Archivo | Prioridad | Complejidad |
|---------|-----------|-------------|
| `routes/auth.ts` | Crítica | Alta |
| `routes/backoffice.ts` | Alta | Alta |

**Consideración especial para AUTH:**
- El login debe buscar primero en master (para obtener tenantId)
- Luego validar credenciales en la DB del tenant

```typescript
// Login flow para multi-DB
async function login(email, password, tenantSlug) {
  // 1. Buscar tenant en master DB
  const tenant = await masterPrisma.tenant.findUnique({
    where: { slug: tenantSlug }
  });

  // 2. Obtener conexión del tenant
  const tenantDb = await DatabaseService.forTenant(tenant.id);

  // 3. Buscar usuario en DB del tenant
  const user = await tenantDb.user.findUnique({
    where: { email, tenantId: tenant.id }
  });

  // 4. Validar password y generar token
}
```

#### 3.4 Rutas de AGENCY (sin cambios)
Las rutas de `/api/agency/*` siempre usan la DB master, no requieren cambios.

---

### Fase 4: Migrar Servicios

#### 4.1 CianboxService
```typescript
// ANTES
async syncProducts(tenantId: string) {
  await prisma.product.upsert({ ... });
}

// DESPUÉS
async syncProducts(tenantId: string) {
  const db = await DatabaseService.forTenant(tenantId);
  await db.product.upsert({ ... });
}
```

**Archivos a modificar:**
- `services/cianbox.service.ts` - Todas las operaciones de sync

---

### Fase 5: Testing

#### 5.1 Tests unitarios
- [ ] Test de conexión a servidor secundario
- [ ] Test de aislamiento de datos entre tenants en diferentes DBs
- [ ] Test de fallback a master si servidor no disponible

#### 5.2 Tests de integración
- [ ] Crear tenant en servidor secundario
- [ ] Login de usuario en servidor secundario
- [ ] CRUD completo en servidor secundario
- [ ] Sync de Cianbox en servidor secundario

#### 5.3 Tests de carga
- [ ] Múltiples tenants en diferentes servidores simultáneamente
- [ ] Failover cuando un servidor cae

---

### Fase 6: Deployment

#### 6.1 Pre-requisitos en nuevo servidor DB
```bash
# En el nuevo servidor PostgreSQL:
sudo -u postgres createdb cianbox_pos_shard1
sudo -u postgres psql -c "CREATE USER cianbox_pos WITH PASSWORD 'xxx';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE cianbox_pos_shard1 TO cianbox_pos;"
```

#### 6.2 Inicializar schema
```bash
# Desde el servidor de aplicación:
DATABASE_URL="postgresql://..." npx prisma db push
```

#### 6.3 Registrar servidor en Agency
1. Ir a Agency Backoffice > DB Servers
2. Agregar nuevo servidor con credenciales
3. Probar conexión
4. Crear tenant asignando el nuevo servidor

---

## Archivos a Modificar (Resumen)

### Backend
```
apps/backend/
├── prisma/
│   └── schema.prisma          # Agregar isInitialized a DatabaseServer
├── scripts/
│   └── init-database-server.ts # NUEVO: Script de inicialización
├── src/
│   ├── middleware/
│   │   └── tenantDb.ts        # NUEVO: Middleware de conexión
│   ├── routes/
│   │   ├── auth.ts            # Modificar login flow
│   │   ├── backoffice.ts      # Usar req.tenantDb
│   │   ├── products.ts        # Usar req.tenantDb
│   │   ├── sales.ts           # Usar req.tenantDb
│   │   ├── categories.ts      # Usar req.tenantDb
│   │   ├── brands.ts          # Usar req.tenantDb
│   │   ├── customers.ts       # Usar req.tenantDb
│   │   └── promotions.ts      # Usar req.tenantDb
│   ├── services/
│   │   └── cianbox.service.ts # Usar DatabaseService.forTenant
│   └── index.ts               # Registrar middleware
```

### Estimación de Cambios
- **Nuevos archivos:** 2
- **Archivos a modificar:** ~15
- **Líneas de código:** ~200-300 cambios

---

## Rollback Plan

Si algo falla:
1. Revertir middleware en `index.ts`
2. Las rutas seguirán funcionando con `prisma` directo
3. Mover tenants afectados de vuelta al servidor principal

---

## Checklist de Ejecución

- [ ] Fase 1: Preparar infraestructura
  - [ ] Crear script init-database-server.ts
  - [ ] Agregar campo isInitialized a schema
  - [ ] Migrar schema en producción

- [ ] Fase 2: Crear middleware
  - [ ] Crear tenantDb.ts
  - [ ] Registrar en index.ts
  - [ ] Probar localmente

- [ ] Fase 3: Migrar rutas (una por una)
  - [ ] products.ts
  - [ ] categories.ts
  - [ ] brands.ts
  - [ ] customers.ts
  - [ ] sales.ts
  - [ ] auth.ts
  - [ ] backoffice.ts

- [ ] Fase 4: Migrar servicios
  - [ ] cianbox.service.ts

- [ ] Fase 5: Testing
  - [ ] Tests unitarios
  - [ ] Tests integración
  - [ ] Tests en staging

- [ ] Fase 6: Deployment
  - [ ] Preparar servidor secundario
  - [ ] Deploy a producción
  - [ ] Crear primer tenant en servidor secundario
  - [ ] Verificar funcionamiento

---

## Notas Adicionales

### Consideraciones de Performance
- Las conexiones se cachean en `connectionPool`
- Considerar connection pooling externo (PgBouncer) para muchos tenants

### Consideraciones de Seguridad
- Las credenciales de DB se encriptan con AES-256
- Definir `ENCRYPTION_KEY` en producción (no usar default)

### Monitoreo
- Implementar health checks periódicos
- Alertas cuando un servidor está UNHEALTHY
- Dashboard de estado de servidores en Agency

---

*Documento creado: 2024-12-21*
*Última actualización: 2024-12-21*
