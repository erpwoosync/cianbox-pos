# Multi-tenancy - Seguridad y Endpoints

**Seguridad multi-tenant y endpoints de administración**

## Reglas Críticas de Multi-tenancy

### 1. Filtrar SIEMPRE por tenantId

**TODA** query a tablas multi-tenant DEBE incluir filtro por `tenantId`:

```typescript
// CORRECTO
const products = await prisma.product.findMany({
  where: {
    tenantId: req.user!.tenantId,
    isActive: true
  }
});

// INCORRECTO - NUNCA hacer esto
const products = await prisma.product.findMany({
  where: { isActive: true }
});
```

### 2. tenantId en el JWT

El `tenantId` se incluye en el token JWT en el login:

```typescript
const token = jwt.sign({
  userId: user.id,
  tenantId: user.tenantId, // CRÍTICO
  email: user.email,
  roleId: user.roleId,
  permissions: user.role.permissions
}, JWT_SECRET);
```

### 3. Middleware authenticate agrega tenantId

El middleware `authenticate` agrega `req.user.tenantId` automáticamente:

```typescript
router.get('/products', authenticate, async (req: AuthenticatedRequest, res) => {
  const tenantId = req.user!.tenantId; // Disponible en todas las rutas protegidas

  const products = await prisma.product.findMany({
    where: { tenantId }
  });
});
```

### 4. Índices Compuestos

Todas las tablas multi-tenant tienen índice en `tenantId`:

```prisma
model Product {
  id       String  @id @default(cuid())
  tenantId String

  @@index([tenantId])
  @@index([tenantId, isActive])
  @@index([tenantId, categoryId])
}
```

### 5. Claves Únicas por Tenant

Cuando un campo debe ser único DENTRO de un tenant:

```prisma
model Product {
  tenantId String
  sku      String

  @@unique([tenantId, sku]) // SKU único por tenant
}

model User {
  tenantId String
  email    String

  @@unique([tenantId, email]) // Email único por tenant
}
```

## Seguridad

### Prevención de Cross-tenant Data Leakage

**Escenario de ataque:**
Un usuario malicioso intenta modificar el `tenantId` en el JWT para acceder a datos de otro tenant.

**Protecciones implementadas:**

1. **Firma JWT:** El token está firmado con `JWT_SECRET`, cualquier modificación lo invalida
2. **Verificación en middleware:** `authenticate` verifica la firma antes de confiar en el payload
3. **Filtrado en queries:** Aún si el token fuera válido, todas las queries filtran por `tenantId`
4. **Índices únicos compuestos:** Evitan colisiones de IDs entre tenants

### Validación de tenantId

```typescript
// Siempre usar tenantId del token JWT
const tenantId = req.user!.tenantId;

const product = await prisma.product.findFirst({
  where: {
    id: productId,
    tenantId // OBLIGATORIO
  }
});

if (!product) {
  throw new NotFoundError('Producto no encontrado');
}
```

### Nunca confiar en parámetros del cliente

```typescript
// MAL: Confiar en tenantId del body
const { tenantId, productId } = req.body; // PELIGRO

// BIEN: Usar tenantId del token
const tenantId = req.user!.tenantId;
const { productId } = req.body;
```

## Endpoints (Administración de Agencia)

Estos endpoints están en `/api/agency/*` y requieren autenticación de `AgencyUser` (super admin).

### GET /api/agency/tenants

Listar todos los tenants del sistema.

**Autenticación:** Agency token requerido

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tenant123",
      "name": "Mi Tienda S.A.",
      "slug": "mi-tienda",
      "plan": "PRO",
      "status": "ACTIVE",
      "_count": {
        "users": 5,
        "products": 1523,
        "sales": 8947
      }
    }
  ]
}
```

### POST /api/agency/tenants

Crear nuevo tenant con usuario admin inicial.

**Request Body:**
```json
{
  "name": "Nueva Tienda",
  "slug": "nueva-tienda",
  "taxId": "20-98765432-1",
  "plan": "FREE",
  "adminEmail": "admin@nueva-tienda.com",
  "adminPassword": "password123",
  "adminName": "Admin Principal"
}
```

**Proceso interno:**
1. Validar slug único
2. Crear tenant
3. Crear rol "Administrador" con permisos `["*"]`
4. Crear rol "Cajero" con permisos básicos POS
5. Hashear contraseña del admin
6. Crear usuario admin con rol "Administrador"

### PUT /api/agency/tenants/:id

Actualizar datos de un tenant (todos los campos son opcionales).

### DELETE /api/agency/tenants/:id

Eliminar un tenant (y todos sus datos en cascada).

**ADVERTENCIA:** Esta operación elimina PERMANENTEMENTE todos los datos.

### PUT /api/agency/tenants/:id/status

Cambiar estado de un tenant.

**Request Body:**
```json
{
  "status": "SUSPENDED"
}
```

**Valores válidos:** `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`

## Flujo de Creación de Tenant

```
1. POST /agency/tenants
        │
        ▼
2. Validar slug único
        │
        ▼
3. Crear Tenant
   - Status: ACTIVE
   - Plan: FREE (default)
        │
        ▼
4. Crear roles del sistema
   - Rol "Administrador" (*)
   - Rol "Cajero" (pos:sell...)
        │
        ▼
5. Crear usuario admin
   - Hash de contraseña
   - Asignar rol Administrador
        │
        ▼
6. Retornar tenant y admin
```

## Testing Multi-tenancy

### Crear tenant de prueba

```typescript
const testTenant = await prisma.tenant.create({
  data: {
    name: 'Test Tenant',
    slug: `test-${Date.now()}`,
    plan: 'FREE',
    status: 'ACTIVE'
  }
});

const adminRole = await prisma.role.create({
  data: {
    tenantId: testTenant.id,
    name: 'Admin',
    permissions: ['*'],
    isSystem: true
  }
});

const testUser = await prisma.user.create({
  data: {
    tenantId: testTenant.id,
    email: 'test@example.com',
    passwordHash: await bcrypt.hash('test123', 10),
    name: 'Test User',
    roleId: adminRole.id,
    status: 'ACTIVE'
  }
});
```

### Limpiar tenant de prueba

```typescript
await prisma.tenant.delete({
  where: { id: testTenant.id }
});
// Cascading delete eliminará automáticamente todos los datos
```

## Migraciones Multi-tenant

Los cambios se aplican a TODOS los tenants simultáneamente:

```bash
# Crear migración
npx prisma migrate dev --name add_tenant_settings

# Aplicar en producción
npx prisma migrate deploy
```

## Documentación Relacionada

- [TENANTS-MODELO.md](./TENANTS-MODELO.md) - Modelo de datos
