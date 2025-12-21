# API de Productos, Precios y Stock

Documentacion de los endpoints del backend para consulta y gestion de productos, precios y stock.

---

## Rutas Disponibles

| Archivo de rutas | Base URL | Descripcion |
|------------------|----------|-------------|
| `routes/products.ts` | `/api/products` | Endpoints para POS y operaciones generales |
| `routes/backoffice.ts` | `/api/backoffice` | Endpoints para administracion (backoffice) |

---

## Autenticacion

Todos los endpoints requieren autenticacion JWT via header:

```
Authorization: Bearer {token}
```

El token contiene:
- `userId`: ID del usuario
- `tenantId`: ID del tenant (multi-tenant)
- `branchId`: ID de la sucursal del usuario

---

# Endpoints de Productos (`/api/products`)

## GET /api/products

Lista productos con busqueda y filtros paginados.

**Query Parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `search` | string | Buscar por nombre, SKU o codigo de barras |
| `categoryId` | string | Filtrar por categoria |
| `brandId` | string | Filtrar por marca |
| `branchId` | string | Si se pasa, incluye stock de esa sucursal |
| `isActive` | "true" \| "false" | Filtrar por estado activo |
| `page` | number | Pagina (default: 1) |
| `pageSize` | number | Items por pagina (default: 50) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clxx...",
      "sku": "PROD-001",
      "barcode": "7791234567890",
      "name": "Producto Ejemplo",
      "shortName": "Prod Ej",
      "description": "Descripcion del producto",
      "basePrice": 1500.00,
      "baseCost": 1000.00,
      "taxRate": 21,
      "taxIncluded": true,
      "isActive": true,
      "isParent": false,
      "size": null,
      "color": null,
      "category": { "id": "...", "name": "Categoria" },
      "brand": { "id": "...", "name": "Marca" },
      "prices": [...],
      "currentStock": 50
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

---

## GET /api/products/search

Busqueda rapida para POS. Busca por codigo de barras exacto, SKU exacto, o nombre parcial.

**Query Parameters:**

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `q` | string | Si | Texto de busqueda |
| `priceListId` | string | No | Filtrar precios por lista |
| `branchId` | string | No | Filtrar stock por sucursal |

**Comportamiento especial para Productos Variables:**

Si el codigo/SKU corresponde a un **producto padre** (`isParent: true`), el endpoint retorna todas las variantes en lugar del padre:

```json
{
  "success": true,
  "data": [
    {
      "id": "var-1",
      "name": "JEAN RECTO - 38 Beige",
      "size": "38",
      "color": "Beige",
      "parentName": "JEAN RECTO",
      "parentPrice": 25000,
      "stock": [...]
    },
    {
      "id": "var-2",
      "name": "JEAN RECTO - 40 Beige",
      "size": "40",
      "color": "Beige",
      ...
    }
  ],
  "isParentSearch": true,
  "parent": {
    "id": "padre-id",
    "name": "JEAN RECTO",
    "barcode": "779000001",
    "price": 25000
  }
}
```

**Response normal (producto simple):**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "sku": "PROD-001",
      "barcode": "7791234567890",
      "name": "Producto Simple",
      "prices": [...],
      "stock": [...]
    }
  ]
}
```

---

## GET /api/products/:id

Obtiene un producto por ID con todos sus detalles.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "clxx...",
    "sku": "PROD-001",
    "barcode": "7791234567890",
    "name": "Producto Ejemplo",
    "description": "...",
    "basePrice": 1500.00,
    "baseCost": 1000.00,
    "taxRate": 21,
    "taxIncluded": true,
    "trackStock": true,
    "allowNegativeStock": false,
    "minStock": 5,
    "isActive": true,
    "isService": false,
    "isParent": false,
    "parentProductId": null,
    "size": null,
    "color": null,
    "category": { "id": "...", "name": "...", ... },
    "brand": { "id": "...", "name": "...", ... },
    "prices": [
      {
        "id": "...",
        "priceListId": "...",
        "price": 1500.00,
        "priceNet": 1239.67,
        "priceList": { "id": "...", "name": "General" }
      }
    ],
    "stock": [
      {
        "id": "...",
        "branchId": "...",
        "quantity": 100,
        "reserved": 5,
        "available": 95,
        "branch": { "id": "...", "code": "SUC-1", "name": "Casa Central" }
      }
    ]
  }
}
```

---

## GET /api/products/categories

Lista todas las categorias activas.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Pantalones",
      "parentId": null,
      "level": 0,
      "sortOrder": 1,
      "_count": { "products": 45 }
    }
  ]
}
```

---

## GET /api/products/categories/quick-access

Lista categorias marcadas como acceso rapido para el POS.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Pantalones",
      "isQuickAccess": true,
      "quickAccessOrder": 1,
      "quickAccessColor": "#3B82F6",
      "quickAccessIcon": "pants",
      "isDefaultQuickAccess": true,
      "_count": { "products": 45 }
    }
  ]
}
```

---

## GET /api/products/brands

Lista todas las marcas activas.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Nike",
      "isActive": true
    }
  ]
}
```

---

# Endpoints de Backoffice (`/api/backoffice`)

## GET /api/backoffice/products

Lista productos con filtros avanzados para administracion.

**Query Parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `categoryId` | string | Filtrar por categoria |
| `brandId` | string | Filtrar por marca |
| `search` | string | Buscar por nombre, SKU o codigo |
| `parentsOnly` | "true" | Solo productos padre (con variantes) |
| `hideVariants` | "true" | Ocultar variantes, mostrar padres y simples |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "sku": "JEAN-RC",
      "name": "JEAN RECTO CELESTE",
      "isParent": true,
      "isVirtualParent": false,
      "category": { "id": "...", "name": "Jeans" },
      "brand": { "id": "...", "name": "Levis" },
      "prices": [...],
      "stock": [...],
      "_count": { "variants": 12 }
    }
  ]
}
```

---

## GET /api/backoffice/products/:id

Obtiene producto por ID con relaciones completas.

---

## GET /api/backoffice/products/:id/prices

Obtiene precios de un producto por todas las listas de precios.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "priceListId": "...",
      "price": 25000.00,
      "priceNet": 20661.16,
      "cost": 15000.00,
      "priceList": { "id": "...", "name": "General" }
    },
    {
      "id": "...",
      "priceListId": "...",
      "price": 22500.00,
      "priceList": { "id": "...", "name": "Mayorista" }
    }
  ]
}
```

---

## GET /api/backoffice/products/:id/stock

Obtiene stock de un producto por sucursal.

**Comportamiento especial para Productos Padre:**

Si el producto es padre (`isParent: true`), retorna el **stock agregado de todas las variantes** por sucursal:

```json
{
  "success": true,
  "data": [
    {
      "id": "agg-branch-1",
      "branchId": "...",
      "branch": { "id": "...", "name": "Casa Central" },
      "quantity": 150,
      "reserved": 10,
      "available": 140,
      "variantCount": 12
    }
  ],
  "isAggregated": true,
  "variantCount": 12,
  "message": "Stock agregado de 12 variantes"
}
```

**Response normal (producto simple):**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "branchId": "...",
      "branch": { "id": "...", "name": "Casa Central" },
      "quantity": 50,
      "reserved": 2,
      "available": 48
    }
  ],
  "isAggregated": false
}
```

---

## GET /api/backoffice/products/:id/size-curve

Obtiene la curva de talles de un producto padre.

**Query Parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `branchId` | string | Filtrar stock por sucursal (opcional) |

**Response:**

```json
{
  "success": true,
  "data": {
    "parent": {
      "id": "...",
      "name": "JEAN RECTO CELESTE",
      "sku": "JEAN-RC",
      "imageUrl": null
    },
    "sizes": ["38", "40", "42", "44"],
    "colors": ["Beige", "Blanco", "Cemento"],
    "variants": [
      {
        "id": "...",
        "size": "38",
        "color": "Beige",
        "sku": "JEAN-RC-38-BE",
        "barcode": "7791234567890",
        "isActive": true,
        "stock": 10
      }
    ],
    "matrix": {
      "38-Beige": {
        "variantId": "...",
        "sku": "JEAN-RC-38-BE",
        "barcode": "7791234567890",
        "isActive": true,
        "stock": 15,
        "reserved": 2,
        "available": 13
      },
      "38-Blanco": { ... },
      "40-Beige": { ... }
    },
    "totals": {
      "bySize": { "38": 23, "40": 16, "42": 11, "44": 6 },
      "byColor": { "Beige": 23, "Blanco": 11, "Cemento": 22 },
      "total": 56
    }
  }
}
```

---

# Modelo de Datos

## Product

```typescript
interface Product {
  id: string;
  tenantId: string;
  cianboxProductId?: number;        // ID en Cianbox (si viene de sync)

  // Identificacion
  sku?: string;
  barcode?: string;
  name: string;
  shortName?: string;
  description?: string;

  // Clasificacion
  categoryId?: string;
  brandId?: string;

  // Precios base
  basePrice: number;                // Precio con IVA
  baseCost: number;                 // Costo
  taxRate: number;                  // Alicuota IVA (21, 10.5, etc)
  taxIncluded: boolean;             // Si basePrice incluye IVA

  // Control de stock
  trackStock: boolean;
  allowNegativeStock: boolean;
  minStock?: number;

  // Caracteristicas
  sellFractions: boolean;
  unitOfMeasure: string;            // UN, KG, LT, etc
  imageUrl?: string;
  location?: string;                // Ubicacion en deposito

  // Estado
  isActive: boolean;
  isService: boolean;               // true = no afecta stock

  // Productos Variables (Curva de Talles)
  isParent: boolean;                // true = producto padre con variantes
  isVirtualParent: boolean;         // true = padre creado por sync (no existe en Cianbox)
  parentProductId?: string;         // ID del padre (si es variante)
  size?: string;                    // Talle: "38", "40", "L", "XL"
  color?: string;                   // Color: "Negro", "Blanco"

  // Metadata
  lastSyncedAt?: Date;
  cianboxData?: object;             // Datos originales de Cianbox
}
```

## ProductPrice

```typescript
interface ProductPrice {
  id: string;
  productId: string;
  priceListId: string;
  price: number;                    // Precio final con IVA
  priceNet?: number;                // Precio neto sin IVA
  cost?: number;                    // Costo
  createdAt: Date;
  updatedAt: Date;
}
```

## ProductStock

```typescript
interface ProductStock {
  id: string;
  productId: string;
  branchId: string;
  quantity: number;                 // Stock total
  reserved: number;                 // Reservado (pedidos pendientes)
  available: number;                // Disponible (quantity - reserved)
  createdAt: Date;
  updatedAt: Date;
}
```

---

# Flujos de Uso

## Busqueda en POS

```
1. Usuario escanea codigo de barras
2. GET /api/products/search?q={barcode}&branchId={branch}&priceListId={list}
3. Si isParentSearch=true:
   - Mostrar selector de talles con las variantes
   - Usuario selecciona talle/color
   - Agregar variante seleccionada al carrito
4. Si isParentSearch=false:
   - Agregar producto directo al carrito
```

## Visualizacion de Stock en Backoffice

```
1. Usuario entra a detalle de producto
2. GET /api/backoffice/products/{id}/stock
3. Si isAggregated=true (producto padre):
   - Mostrar mensaje "Stock agregado de N variantes"
   - Mostrar tabla con totales por sucursal
   - Link a tab "Curva de Talles" para detalle
4. Si isAggregated=false (producto simple):
   - Mostrar tabla de stock por sucursal normal
```

## Curva de Talles

```
1. Usuario entra a producto padre
2. GET /api/backoffice/products/{id}/size-curve?branchId={optional}
3. Renderizar matriz talle x color
4. Colores segun stock: verde (>=5), amarillo (1-4), rojo (0)
5. Tooltip con SKU y codigo de barras
```

---

# Codigos de Error

| Codigo HTTP | Codigo Error | Descripcion |
|-------------|--------------|-------------|
| 400 | BAD_REQUEST | Parametros invalidos |
| 401 | UNAUTHORIZED | Token no valido o expirado |
| 403 | FORBIDDEN | Sin permisos para la operacion |
| 404 | NOT_FOUND | Producto no encontrado |
| 409 | CONFLICT | SKU duplicado |
| 422 | VALIDATION_ERROR | Error de validacion de datos |

---

# Permisos Requeridos

| Operacion | Permiso |
|-----------|---------|
| Listar productos | (autenticado) |
| Buscar productos | (autenticado) |
| Ver detalle | (autenticado) |
| Crear producto | `inventory:edit` |
| Editar producto | `inventory:edit` |
| Eliminar producto | `inventory:edit` |
| Ajustar stock | `stock:adjust` o `stock:write` |
| Config acceso rapido | `admin:settings` |

---

# Sincronizacion con Cianbox

Los productos sincronizados desde Cianbox tienen:
- `cianboxProductId`: ID del producto en Cianbox
- `cianboxData`: Datos originales de la API de Cianbox
- `lastSyncedAt`: Fecha de ultima sincronizacion

**Restriccion:** Los productos con `cianboxProductId` no pueden ser modificados via API. Solo se actualizan via sincronizacion.

## Campos de Cianbox mapeados

| Campo Cianbox | Campo Local | Descripcion |
|---------------|-------------|-------------|
| `id` | `cianboxProductId` | ID en Cianbox |
| `producto` | `name` | Nombre |
| `codigo_interno` | `sku` | SKU |
| `codigo_barras` | `barcode` | Codigo de barras |
| `precio_neto` | (calculado) | Base para basePrice |
| `alicuota_iva` | `taxRate` | Alicuota IVA |
| `es_padre` | `isParent` | Si es producto padre |
| `id_producto_padre` | `parentProductId` | ID del padre (resuelto) |
| `talle` | `size` | Talle |
| `color` | `color` | Color |
| `stock_sucursal` | `ProductStock` | Stock por sucursal |
| `precios` | `ProductPrice` | Precios por lista |
