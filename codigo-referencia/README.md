# Código de Referencia

Archivos fuente del proyecto **warehouse-picking** que pueden reutilizarse en el desarrollo del POS.

## Estructura

```
codigo-referencia/
├── services/
│   └── cianbox.service.ts    # Servicio completo de integración con Cianbox
├── middleware/
│   └── auth.ts               # Middleware de autenticación JWT multi-tenant
├── prisma/
│   └── schema.prisma         # Schema de base de datos (adaptar para POS)
├── config/
│   ├── package.json          # Dependencias base del backend
│   ├── tsconfig.json         # Configuración TypeScript
│   └── .env.example          # Variables de entorno de ejemplo
└── README.md                 # Este archivo
```

## Archivos y Uso

### `services/cianbox.service.ts`

Servicio completo para integración con Cianbox ERP. Incluye:

- **Autenticación**: `getAccessToken()` - Obtiene y cachea tokens
- **Productos**: `fetchCianboxProducts()`, `syncProductsFromCianbox()`
- **Categorías**: `fetchCianboxCategories()`, `syncCategoriesFromCianbox()`
- **Marcas**: `fetchCianboxBrands()`, `syncBrandsFromCianbox()`
- **Pedidos**: `fetchCianboxOrders()`, `updateOrderStatus()`
- **Test**: `testCianboxConnection()`

**Para usar:**
1. Copiar a `src/services/`
2. Adaptar imports según tu estructura
3. Agregar modelos necesarios en Prisma

### `middleware/auth.ts`

Middleware de autenticación JWT con soporte multi-tenant:

- `authenticate` - Valida token y carga usuario
- `requirePermission(permission)` - Requiere permiso específico
- `requireAgencyUser` - Requiere usuario de agencia (superadmin)

**Interfaz `AuthRequest`:**
```typescript
req.user = {
  id: string;
  tenantId: string;      // SIEMPRE usar para filtrar queries
  email: string;
  name: string;
  isSuperAdmin: boolean;
  isAgencyUser: boolean;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
}
```

### `prisma/schema.prisma`

Schema completo de warehouse-picking. **Adaptar para POS:**

- Mantener: `Tenant`, `User`, `Role`, `CianboxConnection`, `Category`, `Brand`, `Product`
- Eliminar: Modelos específicos de picking (`Order`, `PickingSession`, etc.)
- Agregar: Modelos de POS (`Sale`, `SaleItem`, `Payment`, `Promotion`)

### `config/package.json`

Dependencias base probadas y funcionando:

```bash
cd apps/backend
cp codigo-referencia/config/package.json .
npm install
```

### `config/tsconfig.json`

Configuración TypeScript optimizada para Node.js + ESM.

### `config/.env.example`

Template de variables de entorno. Copiar y adaptar:

```bash
cp codigo-referencia/config/.env.example apps/backend/.env
```

## Notas Importantes

1. **Multi-tenant**: SIEMPRE filtrar por `tenantId` en queries
2. **Cianbox**: Cada tenant tiene su propia conexión (apiUrl + apiKey)
3. **Tokens**: El servicio cachea tokens de Cianbox automáticamente
4. **Paginación**: Los métodos de sync manejan paginación automáticamente
5. **Errores**: Usar la clase `ApiError` para errores HTTP consistentes

## Documentación Adicional

- `docs/GUIA-TECNICA-POS-CIANBOX.md` - Guía completa con explicaciones
- `docs/cianbox_api_docs.md` - Documentación de la API de Cianbox
