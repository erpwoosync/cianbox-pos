# Sincronización Cianbox - Modelo y Servicio

**Integración con Cianbox ERP mediante API REST**

## Visión General

El sistema se sincroniza con Cianbox ERP para obtener:
- Productos (con precios y stock)
- Categorías
- Marcas
- Listas de Precios
- Sucursales
- Clientes

La sincronización es **unidireccional** desde Cianbox hacia POS (Cianbox es la fuente de verdad).

## Modelo de Datos

### CianboxConnection

Configuración de conexión por tenant.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant (unique) |
| cuenta | String | Nombre de cuenta en Cianbox (URL) |
| appName | String | Nombre de la aplicación |
| appCode | String | Código de aplicación |
| user | String | Usuario de Cianbox |
| password | String | Contraseña (encriptada) |
| accessToken | String? | Token actual (cacheado) |
| refreshToken | String? | Token de refresco |
| tokenExpiresAt | DateTime? | Expiración del token |
| syncPageSize | Int | Productos por página (default: 50, max: 200) |
| isActive | Boolean | Conexión activa |
| lastSync | DateTime? | Última sincronización |
| syncStatus | String? | SUCCESS, FAILED, PENDING |
| webhookUrl | String? | URL para recibir webhooks |

## Servicio: CianboxService

### Métodos Principales

```typescript
class CianboxService {
  // Autenticación
  static async forTenant(tenantId: string): Promise<CianboxService>
  async authenticate(): Promise<string>
  async refreshAccessToken(): Promise<string>

  // Sincronización completa
  async syncAll(tenantId: string): Promise<SyncResult>

  // Sincronización individual
  async syncCategories(tenantId: string): Promise<number>
  async syncBrands(tenantId: string): Promise<number>
  async syncProducts(tenantId: string): Promise<number>
  async syncPriceLists(tenantId: string): Promise<number>
  async syncBranches(tenantId: string): Promise<number>
  async syncCustomers(tenantId: string): Promise<number>

  // Webhooks
  async registerWebhook(events: string[], url: string): Promise<any>
  async listWebhooks(): Promise<any[]>
  async deleteWebhook(events: string[]): Promise<any>

  // Actualización por IDs (usado por webhooks)
  async upsertProductsByIds(tenantId: string, ids: number[]): Promise<number>
  async upsertCategoriesByIds(tenantId: string, ids: number[]): Promise<number>
  async upsertBrandsByIds(tenantId: string, ids: number[]): Promise<number>
}
```

## Sincronización de Productos

### Flujo de Sincronización

```
1. Obtener categorías y marcas primero
   ↓
2. Obtener listas de precios
   ↓
3. Obtener productos paginados
   For each page (50 productos):
   ↓
4. Procesar productos con variantes:
   - Detectar productos con padre_id
   - Crear padres virtuales si no existen
   - Asociar variantes a padres
   ↓
5. Upsert productos en DB
   ↓
6. Sincronizar precios por lista
   ↓
7. Sincronizar stock por sucursal
   ↓
8. Marcar lastSyncedAt
```

### Productos con Variantes (Curva de Talles)

**Escenario 1: Productos con padre explícito en Cianbox**

```json
// Cianbox retorna:
{ "id": 100, "nombre": "Remera Nike", "es_padre": true }
{ "id": 101, "nombre": "Remera Nike - S", "padre_id": 100, "talle": "S" }
{ "id": 102, "nombre": "Remera Nike - M", "padre_id": 100, "talle": "M" }
```

**Proceso:**
1. Crear/actualizar producto padre (id=100, isParent=true, isVirtualParent=false)
2. Crear/actualizar variantes (id=101, 102, parentProductId=padre.id)

**Escenario 2: Productos sin padre explícito**

```json
// Cianbox retorna:
{ "id": 201, "nombre": "Buzo Adidas - S", "padre_id": 999, "talle": "S" }
{ "id": 202, "nombre": "Buzo Adidas - M", "padre_id": 999, "talle": "M" }
// Pero el producto con id=999 NO existe en Cianbox
```

**Proceso:**
1. Detectar que padre_id=999 no existe
2. Crear producto padre virtual:
   - cianboxProductId: 999
   - name: "Buzo Adidas" (inferido)
   - isParent: true
   - isVirtualParent: true
3. Crear variantes asociadas al padre virtual

### Sincronización de Precios

```typescript
for (const priceList of priceLists) {
  await prisma.productPrice.upsert({
    where: {
      productId_priceListId: {
        productId: product.id,
        priceListId: priceList.id
      }
    },
    create: {
      productId: product.id,
      priceListId: priceList.id,
      price: cianboxPrice,
      priceNet: cianboxPriceNet
    },
    update: {
      price: cianboxPrice,
      priceNet: cianboxPriceNet
    }
  });
}
```

### Sincronización de Stock

```typescript
for (const branch of branches) {
  const stockData = cianboxProduct.stock.find(s =>
    s.sucursal_id === branch.cianboxBranchId
  );

  await prisma.productStock.upsert({
    where: {
      productId_branchId: {
        productId: product.id,
        branchId: branch.id
      }
    },
    create: {
      productId: product.id,
      branchId: branch.id,
      quantity: stockData?.cantidad || 0,
      available: stockData?.cantidad || 0
    },
    update: {
      quantity: stockData?.cantidad || 0
    }
  });
}
```

## Autenticación con Cianbox

### Obtener Access Token

```
POST https://{cuenta}.cianbox.org/api/auth/credentials
Content-Type: application/json

{
  "app_name": "POS",
  "app_code": "pos-001",
  "user": "api_user",
  "password": "contraseña"
}

Response:
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "expires_in": 3600
}
```

### Usar Access Token

Todas las requests a Cianbox incluyen:

```
Authorization: Bearer {access_token}
```

### Renovar Token

Cuando el access_token expira (detectado por error 401):

```
POST https://{cuenta}.cianbox.org/api/auth/refresh
Authorization: Bearer {refresh_token}
```

## Configuración de Tenant

### Paso 1: Crear Conexión

```typescript
await prisma.cianboxConnection.create({
  data: {
    tenantId,
    cuenta: 'mi-tienda',
    appName: 'POS',
    appCode: 'pos-001',
    user: 'api_user',
    password: 'contraseña',
    syncPageSize: 50,
    isActive: true
  }
});
```

### Paso 2: Primera Sincronización

```typescript
const service = await CianboxService.forTenant(tenantId);
const result = await service.syncAll(tenantId);

console.log(`Sincronizados:
  - ${result.categories} categorías
  - ${result.brands} marcas
  - ${result.products} productos
`);
```

## Documentación Relacionada

- [CIANBOX-ENDPOINTS.md](./CIANBOX-ENDPOINTS.md) - Endpoints y webhooks
