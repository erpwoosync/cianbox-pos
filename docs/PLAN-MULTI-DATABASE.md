# Plan de Implementación: Multi-Database Sharding

## Resumen

Habilitar el sistema para soportar múltiples servidores de base de datos con **aislamiento a nivel de base de datos por tenant** (database-per-tenant).

## Modelos de Multi-Tenancy

### Opción A: Row-Level Isolation (Modelo Actual)
```
┌─────────────────────────────────────┐
│         cianbox_pos (DB)            │
├─────────────────────────────────────┤
│ products: tenant1, tenant2, tenant3 │
│ sales:    tenant1, tenant2, tenant3 │
│ users:    tenant1, tenant2, tenant3 │
└─────────────────────────────────────┘
- Todos comparten tablas
- Filtro por tenantId en cada query
- Riesgo: si olvidas filtrar, ves datos de otros
```

### Opción B: Database-Per-Tenant (RECOMENDADO) ✅
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ cianbox_pos  │  │   db_demo    │  │  db_tienda1  │
│   (master)   │  │  (tenant 1)  │  │  (tenant 2)  │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ tenants      │  │ products     │  │ products     │
│ db_servers   │  │ sales        │  │ sales        │
│ agency_users │  │ users        │  │ users        │
└──────────────┘  └──────────────┘  └──────────────┘
- Cada tenant tiene su propia DB
- Aislamiento completo
- Imposible ver datos de otro tenant
```

### Comparación

| Aspecto | Row-Level | Database-Per-Tenant |
|---------|-----------|---------------------|
| Aislamiento | Por `tenantId` | Completo (DB separada) |
| Seguridad | Depende de filtros | Garantizada |
| Backup por tenant | Complejo | `pg_dump db_tenant` |
| Eliminar tenant | DELETE masivo | `DROP DATABASE` |
| Migraciones | Una vez | Una por DB |
| Conexiones | Pocas | Una por tenant activo |
| Performance | Índices grandes | Índices pequeños |
| Compliance (GDPR, etc) | Difícil | Fácil |

**Decisión: Implementar Database-Per-Tenant**

---

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

#### 1.1 Modificar modelo Tenant para almacenar nombre de DB
```prisma
model Tenant {
  // ... campos existentes
  databaseName    String?   // Nombre de la DB específica: "db_demo", "db_tienda1"
  databaseStatus  String    @default("PENDING") // PENDING, CREATING, READY, ERROR
}
```

#### 1.2 Crear servicio de provisioning de DB

**Archivo:** `apps/backend/src/services/tenant-database.service.ts`
```typescript
import { Client } from 'pg';
import { execSync } from 'child_process';
import { prisma } from './database.service';

export class TenantDatabaseService {
  /**
   * Crea una nueva base de datos para un tenant
   */
  static async createDatabase(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { databaseServer: true }
    });

    if (!tenant || !tenant.databaseServer) {
      throw new Error('Tenant o servidor no encontrado');
    }

    // Nombre de la DB basado en slug
    const dbName = `cianbox_${tenant.slug.replace(/-/g, '_')}`;

    // Conectar al servidor PostgreSQL (a la DB postgres para crear DBs)
    const adminClient = new Client({
      host: tenant.databaseServer.host,
      port: tenant.databaseServer.port,
      user: tenant.databaseServer.username,
      password: decrypt(tenant.databaseServer.password),
      database: 'postgres', // Conectar a postgres para poder crear DBs
    });

    try {
      await adminClient.connect();

      // Verificar si la DB ya existe
      const checkResult = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName]
      );

      if (checkResult.rows.length === 0) {
        // Crear la base de datos
        await adminClient.query(`CREATE DATABASE "${dbName}"`);

        // Aplicar schema de Prisma
        await this.applySchema(tenant.databaseServer, dbName);
      }

      // Actualizar tenant con el nombre de la DB
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          databaseName: dbName,
          databaseStatus: 'READY'
        }
      });

      return dbName;
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Aplica el schema de Prisma a una base de datos
   */
  static async applySchema(server: DatabaseServer, dbName: string): Promise<void> {
    const dbUrl = `postgresql://${server.username}:${decrypt(server.password)}@${server.host}:${server.port}/${dbName}`;

    // Ejecutar prisma db push con la URL de la nueva DB
    execSync(`DATABASE_URL="${dbUrl}" npx prisma db push --skip-generate`, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: dbUrl }
    });
  }

  /**
   * Elimina la base de datos de un tenant
   */
  static async dropDatabase(tenantId: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { databaseServer: true }
    });

    if (!tenant?.databaseName || !tenant.databaseServer) {
      return;
    }

    const adminClient = new Client({
      host: tenant.databaseServer.host,
      port: tenant.databaseServer.port,
      user: tenant.databaseServer.username,
      password: decrypt(tenant.databaseServer.password),
      database: 'postgres',
    });

    try {
      await adminClient.connect();

      // Terminar conexiones activas
      await adminClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
      `, [tenant.databaseName]);

      // Eliminar la DB
      await adminClient.query(`DROP DATABASE IF EXISTS "${tenant.databaseName}"`);

      // Limpiar tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          databaseName: null,
          databaseStatus: 'PENDING'
        }
      });
    } finally {
      await adminClient.end();
    }
  }
}
```

#### 1.3 Modificar DatabaseService para usar DB específica del tenant
```typescript
// En database.service.ts

static async forTenant(tenantId: string): Promise<PrismaClient> {
  const tenant = await masterPrisma.tenant.findUnique({
    where: { id: tenantId },
    include: { databaseServer: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} no encontrado`);
  }

  // Si el tenant tiene DB propia, usar esa
  if (tenant.databaseName && tenant.databaseServer) {
    const cacheKey = `${tenant.databaseServer.id}:${tenant.databaseName}`;

    if (connectionPool.has(cacheKey)) {
      return connectionPool.get(cacheKey)!;
    }

    const decryptedPassword = decrypt(tenant.databaseServer.password);
    const connectionUrl = `postgresql://${tenant.databaseServer.username}:${encodeURIComponent(decryptedPassword)}@${tenant.databaseServer.host}:${tenant.databaseServer.port}/${tenant.databaseName}`;

    const prisma = new PrismaClient({
      datasources: { db: { url: connectionUrl } },
    });

    connectionPool.set(cacheKey, prisma);
    return prisma;
  }

  // Fallback: usar master (para compatibilidad)
  return masterPrisma;
}
```

#### 1.4 Integrar creación de DB en flujo de creación de Tenant
```typescript
// En agency.ts - POST /api/agency/tenants

// Después de crear el tenant...
const tenant = await tx.tenant.create({ ... });

// Crear la base de datos del tenant (async, no bloquear)
TenantDatabaseService.createDatabase(tenant.id)
  .then(() => console.log(`DB creada para tenant ${tenant.slug}`))
  .catch((err) => console.error(`Error creando DB para ${tenant.slug}:`, err));
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
│   └── schema.prisma                    # Agregar databaseName, databaseStatus a Tenant
├── src/
│   ├── middleware/
│   │   └── tenantDb.ts                  # NUEVO: Middleware de conexión
│   ├── services/
│   │   ├── database.service.ts          # Modificar forTenant() para DB específica
│   │   ├── tenant-database.service.ts   # NUEVO: Crear/eliminar DBs por tenant
│   │   └── cianbox.service.ts           # Usar DatabaseService.forTenant
│   ├── routes/
│   │   ├── auth.ts                      # Modificar login flow
│   │   ├── backoffice.ts                # Usar req.tenantDb
│   │   ├── products.ts                  # Usar req.tenantDb
│   │   ├── sales.ts                     # Usar req.tenantDb
│   │   ├── categories.ts                # Usar req.tenantDb
│   │   ├── brands.ts                    # Usar req.tenantDb
│   │   ├── customers.ts                 # Usar req.tenantDb
│   │   ├── promotions.ts                # Usar req.tenantDb
│   │   └── agency.ts                    # Integrar creación de DB al crear tenant
│   └── index.ts                         # Registrar middleware
```

### Dependencias Nuevas
```bash
npm install pg  # Cliente PostgreSQL nativo para crear DBs
```

### Estimación de Cambios
- **Nuevos archivos:** 2
- **Archivos a modificar:** ~15
- **Líneas de código:** ~400-500 cambios

---

## Rollback Plan

Si algo falla:
1. Revertir middleware en `index.ts`
2. Las rutas seguirán funcionando con `prisma` directo
3. Mover tenants afectados de vuelta al servidor principal

---

## Checklist de Ejecución

### Fase 1: Preparar infraestructura
- [ ] 1.1 Modificar schema.prisma
  - [ ] Agregar `databaseName` a Tenant
  - [ ] Agregar `databaseStatus` a Tenant
  - [ ] Ejecutar `prisma migrate dev`
- [ ] 1.2 Crear tenant-database.service.ts
  - [ ] Función `createDatabase(tenantId)`
  - [ ] Función `applySchema(server, dbName)`
  - [ ] Función `dropDatabase(tenantId)`
- [ ] 1.3 Instalar dependencia `pg`
- [ ] 1.4 Modificar database.service.ts
  - [ ] Actualizar `forTenant()` para usar DB específica
- [ ] 1.5 Integrar en agency.ts
  - [ ] Llamar `createDatabase()` al crear tenant

### Fase 2: Crear middleware
- [ ] 2.1 Crear tenantDb.ts middleware
- [ ] 2.2 Registrar en index.ts
- [ ] 2.3 Probar localmente con tenant existente

### Fase 3: Migrar rutas (una por una)
- [ ] 3.1 Rutas de lectura (bajo riesgo)
  - [ ] products.ts
  - [ ] categories.ts
  - [ ] brands.ts
  - [ ] customers.ts
  - [ ] price-lists.ts
- [ ] 3.2 Rutas de escritura (riesgo medio)
  - [ ] sales.ts
  - [ ] inventory.ts
  - [ ] promotions.ts
- [ ] 3.3 Rutas de auth (riesgo alto)
  - [ ] auth.ts (login flow especial)
  - [ ] backoffice.ts

### Fase 4: Migrar servicios
- [ ] 4.1 cianbox.service.ts
  - [ ] syncCategories
  - [ ] syncBrands
  - [ ] syncProducts
  - [ ] syncCustomers
  - [ ] syncBranches

### Fase 5: Testing
- [ ] 5.1 Tests unitarios
  - [ ] Crear DB para nuevo tenant
  - [ ] Conexión a DB específica
  - [ ] Aislamiento de datos
- [ ] 5.2 Tests de integración
  - [ ] Crear tenant completo (DB + usuarios + roles)
  - [ ] Login en tenant con DB propia
  - [ ] CRUD completo
  - [ ] Sync Cianbox
- [ ] 5.3 Tests en staging

### Fase 6: Deployment
- [ ] 6.1 Deploy cambios de schema a master DB
- [ ] 6.2 Deploy nuevo código
- [ ] 6.3 Crear primer tenant con DB propia
- [ ] 6.4 Verificar:
  - [ ] DB creada automáticamente
  - [ ] Schema aplicado
  - [ ] Login funciona
  - [ ] Sync Cianbox funciona
  - [ ] Datos aislados de otros tenants

### Fase 7: Migrar tenants existentes (opcional)
- [ ] 7.1 Script para migrar datos de tenant a nueva DB
- [ ] 7.2 Migrar tenant demo
- [ ] 7.3 Actualizar `databaseName` en tenant
- [ ] 7.4 Verificar funcionamiento

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
