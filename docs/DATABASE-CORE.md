# Modelo de Datos - Módulo Core

Documentación de los modelos de datos fundamentales del sistema Cianbox POS.

## Índice
- [Nivel Agencia](#nivel-agencia)
- [Nivel Tenant](#nivel-tenant)
- [Usuarios y Roles](#usuarios-y-roles)
- [Conexión Cianbox](#conexión-cianbox)

---

## Nivel Agencia

### DatabaseServer
Servidores de Base de Datos para sharding multi-tenant.

```prisma
model DatabaseServer {
  id            String               @id @default(cuid())
  name          String               @unique
  host          String
  port          Int                  @default(5432)
  database      String
  username      String
  password      String               // Encriptado
  sslEnabled    Boolean              @default(true)
  maxConnections Int                @default(100)
  isDefault     Boolean              @default(false)
  isActive      Boolean              @default(true)
  region        String?
  description   String?

  // Métricas
  lastHealthCheck DateTime?
  healthStatus    DatabaseHealthStatus @default(UNKNOWN)
  tenantCount     Int                  @default(0)

  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  tenants       Tenant[]
}

enum DatabaseHealthStatus {
  HEALTHY
  DEGRADED
  UNHEALTHY
  UNKNOWN
}
```

**Propósito:** Permite distribuir tenants en diferentes servidores de base de datos para escalabilidad y aislamiento de datos.

### AgencyUser
Usuarios del nivel de agencia (Super Admins).

```prisma
model AgencyUser {
  id           String           @id @default(cuid())
  email        String           @unique
  passwordHash String
  name         String
  avatar       String?
  status       AgencyUserStatus @default(ACTIVE)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
}

enum AgencyUserStatus {
  ACTIVE
  DISABLED
}
```

**Acceso:** Panel de Agency Backoffice en puerto 8083.

### AgencySettings
Configuración global del sistema.

```prisma
model AgencySettings {
  id        String   @id @default("default")
  appName   String   @default("Cianbox POS")
  logo      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Nivel Tenant

### Tenant
Cliente/Empresa en el sistema multi-tenant.

```prisma
model Tenant {
  id               String       @id @default(cuid())
  name             String       // "Mi Tienda S.A."
  slug             String       @unique // "mi-tienda" (usado en login)
  taxId            String?      // CUIT/RUT/NIF
  logo             String?
  plan             Plan         @default(FREE)
  status           TenantStatus @default(TRIAL)
  settings         Json         @default("{}")

  // Sharding
  databaseServerId String?
  databaseServer   DatabaseServer? @relation(fields: [databaseServerId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relaciones principales
  users             User[]
  roles             Role[]
  cianboxConnection CianboxConnection?
  branches          Branch[]
  pointsOfSale      PointOfSale[]
  categories        Category[]
  brands            Brand[]
  priceLists        PriceList[]
  products          Product[]
  customers         Customer[]
  promotions        Promotion[]
  sales             Sale[]
  cashSessions      CashSession[]
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

enum TenantStatus {
  TRIAL    // Período de prueba
  ACTIVE   // Activo y pagando
  SUSPENDED // Suspendido temporalmente
  CANCELLED // Cancelado definitivamente
}
```

**Regla Crítica:** Todas las queries deben filtrar por `tenantId` para garantizar aislamiento de datos.

```typescript
// ✅ CORRECTO
const products = await prisma.product.findMany({
  where: { tenantId: req.user!.tenantId }
});

// ❌ INCORRECTO - NUNCA hacer esto
const products = await prisma.product.findMany();
```

---

## Usuarios y Roles

### User
Usuarios del sistema por tenant.

```prisma
model User {
  id           String     @id @default(cuid())
  tenantId     String
  email        String
  passwordHash String
  name         String
  avatar       String?
  pin          String?    // PIN para operaciones rápidas en POS
  status       UserStatus @default(ACTIVE)
  roleId       String
  branchId     String?    // Sucursal asignada por defecto
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // Relaciones
  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role          Role           @relation(fields: [roleId], references: [id])
  branch        Branch?        @relation(fields: [branchId], references: [id])
  sales         Sale[]
  cashRegisters CashRegister[]
  sessions      UserSession[]

  // Relaciones de Turnos de Caja
  cashSessions         CashSession[]   @relation("CashSessionUser")
  cashSessionsOpened   CashSession[]   @relation("CashSessionOpenedBy")
  cashSessionsClosed   CashSession[]   @relation("CashSessionClosedBy")

  @@unique([tenantId, email])
  @@index([tenantId, branchId])
}

enum UserStatus {
  ACTIVE   // Usuario activo
  INVITED  // Invitación pendiente
  DISABLED // Deshabilitado
}
```

**Campos Importantes:**
- `pin`: PIN de 4 dígitos para acceso rápido en POS
- `branchId`: Sucursal asignada al usuario
- `roleId`: Rol con permisos asociados

### Role
Roles y permisos por tenant.

```prisma
model Role {
  id          String   @id @default(cuid())
  tenantId    String
  name        String   // "Administrador", "Cajero", "Supervisor"
  description String?
  isSystem    Boolean  @default(false)
  permissions String[] // Array de permisos
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users  User[]

  @@unique([tenantId, name])
}
```

**Permisos Disponibles:**

| Categoría | Permisos |
|-----------|----------|
| POS | `pos:sell`, `pos:discount`, `pos:cancel`, `pos:view_all` |
| Caja | `cash:open`, `cash:close`, `cash:count`, `cash:deposit`, `cash:withdraw`, `cash:view_all`, `cash:report_all` |
| Productos | `inventory:view`, `inventory:edit`, `inventory:create`, `inventory:delete` |
| Clientes | `customers:view`, `customers:edit`, `customers:create`, `customers:delete` |
| Reportes | `reports:sales`, `reports:inventory`, `reports:cash` |
| Configuración | `settings:view`, `settings:edit` |

### UserSession
Tracking de sesiones de usuario (login/logout).

```prisma
model UserSession {
  id              String        @id @default(cuid())
  userId          String
  pointOfSaleId   String?
  deviceInfo      String?
  ipAddress       String?
  status          SessionStatus @default(ACTIVE)
  loginAt         DateTime      @default(now())
  logoutAt        DateTime?
  lastActivityAt  DateTime      @default(now())
  durationMinutes Int?

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  pointOfSale PointOfSale? @relation(fields: [pointOfSaleId], references: [id])

  @@index([userId, status])
}

enum SessionStatus {
  ACTIVE       // Sesión activa
  CLOSED       // Cerrada normalmente
  EXPIRED      // Expirada por timeout
  FORCED_CLOSE // Cerrada forzosamente por admin
}
```

---

## Conexión Cianbox

### CianboxConnection
Configuración de integración con Cianbox ERP.

```prisma
model CianboxConnection {
  id             String    @id @default(cuid())
  tenantId       String    @unique
  cuenta         String    // Nombre de cuenta en Cianbox
  appName        String
  appCode        String
  user           String
  password       String    // Encriptado
  accessToken    String?   // Token actual (cacheado)
  refreshToken   String?
  tokenExpiresAt DateTime?
  syncPageSize   Int       @default(50) // Max 200
  isActive       Boolean   @default(true)
  lastSync       DateTime?
  syncStatus     String?
  webhookUrl     String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

**Flujo de Sincronización:**

1. **Autenticación:** POST `/auth/credentials` con user/password
2. **Obtener Token:** Cachear token en `accessToken`
3. **Sincronizar Datos:**
   - Categorías: GET `/productos/categorias`
   - Marcas: GET `/productos/marcas`
   - Productos: GET `/productos/lista?page=1&pageSize=50`

**Ejemplo de Uso:**

```typescript
// Obtener token de Cianbox
async function getCianboxToken(tenantId: string): Promise<string> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId }
  });

  if (!connection || !connection.isActive) {
    throw new Error('Conexión Cianbox no configurada');
  }

  // Si el token está vigente, usarlo
  if (connection.tokenExpiresAt && connection.tokenExpiresAt > new Date()) {
    return connection.accessToken!;
  }

  // Renovar token
  const response = await fetch(`${connection.cuenta}/auth/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: connection.user,
      password: connection.password
    })
  });

  const { token } = await response.json();

  // Actualizar token en BD
  await prisma.cianboxConnection.update({
    where: { tenantId },
    data: {
      accessToken: token,
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    }
  });

  return token;
}
```

---

## Sucursales y Puntos de Venta

### Branch
Sucursales (sincronizadas desde Cianbox).

```prisma
model Branch {
  id               String    @id @default(cuid())
  tenantId         String
  cianboxBranchId  Int?      // ID en Cianbox (null si es local)
  code             String    // "SUC-001"
  name             String    // "Casa Central"
  address          String?
  city             String?
  state            String?
  zipCode          String?
  phone            String?
  email            String?
  isDefault        Boolean   @default(false)
  isActive         Boolean   @default(true)
  lastSyncedAt     DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  pointsOfSale PointOfSale[]
  productStock ProductStock[]
  users        User[]
  sales        Sale[]

  @@unique([tenantId, code])
  @@unique([tenantId, cianboxBranchId])
}
```

### PointOfSale
Puntos de Venta / Cajas.

```prisma
model PointOfSale {
  id            String   @id @default(cuid())
  tenantId      String
  branchId      String
  code          String   // "CAJA-01"
  name          String   // "Caja Principal"
  description   String?
  priceListId   String?  // Lista de precios por defecto
  printPointId  String?  // Punto de impresión por defecto
  isActive      Boolean  @default(true)
  settings      Json     @default("{}")

  // Mercado Pago Point
  mpDeviceId    String?  // device_id del terminal MP Point
  mpDeviceName  String?  // Nombre del dispositivo

  // Mercado Pago QR
  mpQrPosId     Int?     // ID de la caja en MP
  mpQrExternalId String? // external_id de la caja

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch        Branch        @relation(fields: [branchId], references: [id])
  priceList     PriceList?    @relation(fields: [priceListId], references: [id])
  sales         Sale[]
  cashSessions  CashSession[]

  @@unique([tenantId, branchId, code])
}
```

**Campos Mercado Pago:**
- `mpDeviceId`: ID del terminal físico Point (ej: "PAX_A910__SMARTPOS1234567890")
- `mpQrPosId`: ID numérico de la caja QR en MP
- `mpQrExternalId`: Identificador externo de la caja QR

---

## Auditoría

### AuditLog
Registro de cambios en el sistema.

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String
  userId     String?
  action     String   // "CREATE", "UPDATE", "DELETE"
  entity     String   // "Product", "Sale", etc.
  entityId   String
  oldData    Json?    // Datos anteriores
  newData    Json?    // Datos nuevos
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([tenantId, entity, entityId])
  @@index([tenantId, userId, createdAt])
}
```

**Uso:**

```typescript
// Registrar cambio en producto
await prisma.auditLog.create({
  data: {
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'UPDATE',
    entity: 'Product',
    entityId: product.id,
    oldData: oldProduct,
    newData: updatedProduct,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  }
});
```

---

## Configuración del Sistema

### SystemConfig
Configuración flexible por tenant.

```prisma
model SystemConfig {
  id        String   @id @default(cuid())
  tenantId  String
  key       String   // "pos.ticket.header", "pos.receipt.footer"
  value     String   @db.Text
  type      String   @default("string") // string, number, boolean, json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, key])
}
```

**Configuraciones Comunes:**

| Key | Tipo | Descripción | Ejemplo |
|-----|------|-------------|---------|
| `pos.ticket.header` | string | Encabezado del ticket | "MI TIENDA\nCUIL 20-12345678-9" |
| `pos.ticket.footer` | string | Pie del ticket | "¡Gracias por su compra!" |
| `pos.allow_negative_stock` | boolean | Permitir stock negativo | false |
| `pos.default_receipt_type` | string | Tipo de comprobante por defecto | "TICKET" |
| `pos.max_discount_percent` | number | Descuento máximo sin autorización | 10 |

---

## Índices y Performance

### Índices Principales

**Tenant:**
- `@unique([slug])`: Búsqueda rápida por slug en login
- `@index([status])`: Filtrar tenants activos

**User:**
- `@@unique([tenantId, email])`: Login único por tenant
- `@@index([tenantId, branchId])`: Usuarios por sucursal

**AuditLog:**
- `@@index([tenantId, entity, entityId])`: Auditoría por entidad
- `@@index([tenantId, userId, createdAt])`: Actividad por usuario

### Recomendaciones de Performance

1. **Siempre usar `tenantId` en WHERE**: Aprovecha el índice compuesto
2. **Usar `select` para campos específicos**: Evita cargar datos innecesarios
3. **Incluir solo relaciones necesarias**: No abusar de `include`
4. **Paginación obligatoria**: Usar `skip` y `take` en listados

```typescript
// ✅ Query optimizada
const users = await prisma.user.findMany({
  where: { tenantId, status: 'ACTIVE' },
  select: { id: true, name: true, email: true },
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { name: 'asc' }
});

// ❌ Query ineficiente
const users = await prisma.user.findMany({
  include: {
    role: { include: { tenant: true } },
    sales: { include: { items: true, payments: true } },
    cashSessions: true
  }
});
```

---

**Ver también:**
- [DATABASE-CATALOG.md](./DATABASE-CATALOG.md) - Catálogo de productos
- [DATABASE-SALES.md](./DATABASE-SALES.md) - Ventas y pagos
- [DATABASE-CASH.md](./DATABASE-CASH.md) - Sistema de caja
