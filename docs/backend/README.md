# Documentación Backend - Cianbox POS

**Sistema Multi-tenant con integración a Cianbox ERP**

## Visión General

El backend del sistema Cianbox POS es una API RESTful desarrollada con Node.js, Express y Prisma ORM que proporciona funcionalidades completas para un sistema de punto de venta multi-tenant con integración a Cianbox ERP.

### Stack Tecnológico

| Categoría | Tecnología | Versión |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express | 4.x |
| ORM | Prisma | 5.x |
| Base de Datos | PostgreSQL | 15+ |
| Autenticación | JWT | jsonwebtoken |
| Validación | Zod | - |
| Tiempo Real | Socket.io | - |
| Encriptación | bcryptjs | - |

### Características Principales

- **Multi-tenancy:** Aislamiento completo de datos por tenant
- **Integración Cianbox:** Sincronización bidireccional con Cianbox ERP
- **Autenticación JWT:** Sistema seguro de tokens con refresh
- **Roles y Permisos:** Control granular de acceso
- **Productos Variables:** Soporte completo para curva de talles (productos padre-hijo)
- **Sistema de Caja:** Gestión completa de turnos, movimientos y arqueos
- **Promociones:** Engine de descuentos y promociones
- **Mercado Pago:** Integración con Point y QR
- **Terminales POS:** Registro y gestión de PCs con software POS

## Arquitectura

### Estructura de Carpetas

```
apps/backend/
├── src/
│   ├── index.ts              # Punto de entrada
│   ├── middleware/
│   │   └── auth.ts           # Autenticación JWT
│   ├── routes/
│   │   ├── auth.ts           # Login, logout, refresh
│   │   ├── products.ts       # Productos, categorías, marcas
│   │   ├── sales.ts          # Ventas y pagos
│   │   ├── promotions.ts     # Promociones y combos
│   │   ├── cianbox.ts        # Sincronización Cianbox
│   │   ├── cash.ts           # Gestión de caja
│   │   ├── backoffice.ts     # Admin de tenant
│   │   ├── agency.ts         # Admin de agencia
│   │   ├── terminals.ts      # Terminales POS
│   │   ├── mercadopago.ts    # Integración MP
│   │   └── webhooks.ts       # Webhooks Cianbox
│   ├── services/
│   │   ├── cianbox.service.ts    # Cliente API Cianbox
│   │   ├── database.service.ts   # Gestión multi-DB
│   │   └── mercadopago.service.ts # Cliente MP
│   └── utils/
│       └── errors.ts         # Manejo de errores
├── prisma/
│   └── schema.prisma         # Schema de base de datos
├── package.json
└── tsconfig.json
```

### Patrón de Capas

```
┌─────────────────────────────────────┐
│         Cliente HTTP                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Middleware (auth, validation)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Routes (Express routers)           │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Services (business logic)          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Prisma ORM                         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  PostgreSQL Database                │
└─────────────────────────────────────┘
```

## Reglas Críticas

### 1. Multi-tenancy OBLIGATORIO

**Filtrar SIEMPRE por `tenantId` en todas las queries:**

```typescript
// ✅ CORRECTO
const products = await prisma.product.findMany({
  where: { tenantId: req.user!.tenantId }
});

// ❌ INCORRECTO - NUNCA hacer esto
const products = await prisma.product.findMany();
```

### 2. Autenticación

Todas las rutas protegidas deben usar el middleware `authenticate`:

```typescript
router.get('/protected', authenticate, async (req: AuthenticatedRequest, res) => {
  // req.user está disponible aquí
});
```

### 3. Autorización por Permisos

Usar `authorize()` para verificar permisos específicos:

```typescript
router.post('/create', authenticate, authorize('inventory:edit'), async (req, res) => {
  // Solo usuarios con permiso inventory:edit pueden acceder
});
```

## Documentación por Módulos

### Autenticación y Usuarios
- [AUTH-MODELOS.md](./AUTH-MODELOS.md) - Modelos de datos, roles y permisos
- [AUTH-ENDPOINTS.md](./AUTH-ENDPOINTS.md) - Endpoints y middleware de autenticación

### Multi-tenancy
- [TENANTS-MODELO.md](./TENANTS-MODELO.md) - Modelo de datos y configuración
- [TENANTS-SEGURIDAD.md](./TENANTS-SEGURIDAD.md) - Seguridad y endpoints de administración

### Catálogo de Productos
- [PRODUCTS-MODELOS.md](./PRODUCTS-MODELOS.md) - Modelos de datos del catálogo
- [PRODUCTS-ENDPOINTS.md](./PRODUCTS-ENDPOINTS.md) - Endpoints y sistema de variantes

### Ventas
- [SALES.md](./SALES.md) - Ventas, items, pagos, facturación

### Promociones
- [PROMOTIONS.md](./PROMOTIONS.md) - Descuentos, combos, ofertas

### Integración Cianbox
- [CIANBOX-MODELO.md](./CIANBOX-MODELO.md) - Modelo y servicio de sincronización
- [CIANBOX-ENDPOINTS.md](./CIANBOX-ENDPOINTS.md) - Endpoints y webhooks

### Sucursales y Terminales
- [BRANCHES-SUCURSALES.md](./BRANCHES-SUCURSALES.md) - Sucursales y puntos de venta
- [BRANCHES-TERMINALES.md](./BRANCHES-TERMINALES.md) - Terminales POS

### Backoffice
- [BACKOFFICE-USUARIOS.md](./BACKOFFICE-USUARIOS.md) - Usuarios, roles y catálogo
- [BACKOFFICE-REPORTES.md](./BACKOFFICE-REPORTES.md) - Reportes y configuración

## Variables de Entorno

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/cianbox_pos

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Server
PORT=3000
NODE_ENV=production

# Webhooks
WEBHOOK_BASE_URL=https://your-domain.com/api
```

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Prisma
npx prisma generate     # Generar cliente Prisma
npx prisma migrate dev  # Crear migración
npx prisma db push      # Aplicar cambios sin migración
npx prisma studio       # UI de base de datos

# Testing
npm test
```

## Convenciones de Código

### Nomenclatura

- **Rutas:** kebab-case (`/points-of-sale`)
- **Variables:** camelCase (`tenantId`, `priceListId`)
- **Tipos:** PascalCase (`AuthenticatedRequest`, `JWTPayload`)
- **Constantes:** UPPER_SNAKE_CASE (`JWT_SECRET`)

### Estructura de Respuestas

Todas las respuestas siguen el formato:

```typescript
// Éxito
{
  success: true,
  data: { ... },
  pagination?: { ... }  // Si aplica
}

// Error
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Mensaje descriptivo'
  }
}
```

### Manejo de Errores

Usar las clases de error personalizadas:

```typescript
import { ApiError, NotFoundError, ValidationError } from '../utils/errors.js';

// No encontrado
throw new NotFoundError('Producto');

// Validación
throw new ValidationError('Datos inválidos', zodErrors);

// Genérico
throw ApiError.badRequest('Mensaje');
```

## Migraciones

Las migraciones se aplican automáticamente en el deploy via `prisma db push`.

Para desarrollo local:

```bash
# Crear migración
npx prisma migrate dev --name nombre_descriptivo

# Aplicar migraciones
npx prisma migrate deploy

# Reset (SOLO en desarrollo)
npx prisma migrate reset
```

## Seguridad

### Contraseñas

- Hash con bcryptjs (10 rounds)
- Nunca retornar `passwordHash` en respuestas

### Tokens JWT

- Expiración: 7 días (access) / 30 días (refresh)
- Verificación en cada request
- Renovación automática con refresh token

### SQL Injection

- Prisma previene SQL injection automáticamente
- Validar inputs con Zod

### CORS

Configurado para permitir requests desde dominios autorizados.

## Performance

### Índices de Base de Datos

Ver `schema.prisma` para índices definidos. Los más críticos:

- `tenantId` en todas las tablas multi-tenant
- `cianboxProductId`, `cianboxCategoryId`, etc. para sincronización
- Composite indexes en claves compuestas

### Paginación

Implementar paginación en listados grandes:

```typescript
const { page = '1', pageSize = '50' } = req.query;
const skip = (parseInt(page) - 1) * parseInt(pageSize);
const take = parseInt(pageSize);

const [items, total] = await Promise.all([
  prisma.product.findMany({ skip, take }),
  prisma.product.count()
]);
```

### Consultas Paralelas

Usar `Promise.all()` para queries independientes:

```typescript
const [products, categories, brands] = await Promise.all([
  prisma.product.findMany({ ... }),
  prisma.category.findMany({ ... }),
  prisma.brand.findMany({ ... }),
]);
```

## Troubleshooting

### Error: Token expirado

El frontend debe capturar errores 401 y usar el refresh token.

### Error: Tenant no encontrado

Verificar que el `tenantId` en el JWT coincida con un tenant activo.

### Error: Conexión a BD

Verificar `DATABASE_URL` y conectividad al servidor PostgreSQL.

### Productos no aparecen

Verificar:
1. `isActive = true` en el producto
2. `tenantId` correcto
3. Producto sincronizado desde Cianbox

## Logging

Los servicios usan `console.log` con prefijos:

```typescript
console.log(`[Cianbox] Sincronizando productos...`);
console.error(`[Error] Failed to process:`, error);
```

En producción, considerar usar una librería de logging estructurado (Winston, Pino).

## Testing

```bash
npm test
```

Tests ubicados en `__tests__/` o junto a archivos con extensión `.test.ts`.

## Contribución

1. Seguir convenciones de código
2. Validar inputs con Zod
3. Filtrar por `tenantId` SIEMPRE
4. Escribir tests para nuevas funcionalidades
5. Documentar endpoints nuevos

## Recursos

- [Documentación Prisma](https://www.prisma.io/docs)
- [Express.js](https://expressjs.com/)
- [Zod Validation](https://zod.dev/)
- [JWT.io](https://jwt.io/)
- [API Cianbox](https://cianbox.org/documentacion)
