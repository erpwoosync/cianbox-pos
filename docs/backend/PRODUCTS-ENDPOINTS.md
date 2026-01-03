# Productos - Endpoints y Variantes

**Endpoints de productos y sistema de variantes (curva de talles)**

## Endpoints

### GET /api/products

Listar productos con filtros.

**Autenticación:** Bearer token requerido

**Query Parameters:**
- `search` - Buscar por nombre, SKU, código de barras
- `categoryId` - Filtrar por categoría
- `brandId` - Filtrar por marca
- `isActive` - Filtrar activos/inactivos
- `isParent` - Solo productos padre
- `parentProductId` - Solo variantes de un padre
- `includeVariants` - `'true'` | `'false'` - Incluir variantes en resultados (ver nota abajo)
- `page` - Número de página (default: 1)
- `pageSize` - Tamaño de página (default: 50)

**Comportamiento de `includeVariants`:**

| Valor | Comportamiento | Caso de uso |
|-------|----------------|-------------|
| `'false'` o no enviado | Solo retorna productos padre/simples (`parentProductId = null`) | POS Web, Backoffice |
| `'true'` | Retorna TODOS los productos incluyendo variantes con su `parentProductId` | POS Desktop (sincronización local) |

```typescript
// Ejemplo: POS Desktop sincronizando catálogo completo
GET /api/products?includeVariants=true&pageSize=200

// Ejemplo: POS Web mostrando listado (comportamiento por defecto)
GET /api/products?categoryId=cat123
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod123",
      "sku": "SKU-001",
      "barcode": "7798123456789",
      "name": "Remera Nike Deportiva",
      "shortName": "Remera Nike",
      "basePrice": "15999.00",
      "taxRate": "21.00",
      "category": { "id": "cat123", "name": "Remeras" },
      "brand": { "id": "brand123", "name": "Nike" },
      "isActive": true,
      "isParent": true,
      "stock": [{ "branchId": "branch123", "quantity": "50.000", "available": "45.000" }],
      "prices": [{ "priceListId": "plist123", "price": "15999.00" }],
      "variants": [{ "id": "var1", "name": "Remera Nike - Talle S", "size": "S" }]
    }
  ],
  "pagination": { "total": 150, "page": 1, "pageSize": 50, "totalPages": 3 }
}
```

### GET /api/products/:id

Obtener detalle de un producto.

**Autenticación:** Bearer token requerido

### POST /api/products/search

Búsqueda avanzada de productos (usado en POS).

**Request Body:**
```json
{
  "query": "nike",
  "branchId": "branch123",
  "priceListId": "plist123",
  "limit": 20
}
```

**Lógica de búsqueda:**
1. Busca por código de barras (match exacto)
2. Busca por SKU (match exacto)
3. Busca por nombre (contiene, insensible a mayúsculas)
4. Retorna productos activos
5. Incluye stock de la sucursal especificada
6. Incluye precio de la lista especificada

### GET /api/products/barcode/:barcode

Buscar producto por código de barras.

**Query Parameters:**
- `branchId` - Sucursal para obtener stock
- `priceListId` - Lista de precios

### POST /api/products

Crear producto.

**Autenticación:** Bearer token + permiso `inventory:edit`

**Request Body:**
```json
{
  "sku": "SKU-NEW",
  "barcode": "7798999999999",
  "name": "Producto Nuevo",
  "categoryId": "cat123",
  "brandId": "brand123",
  "basePrice": "9999.00",
  "taxRate": "21.00",
  "trackStock": true,
  "isActive": true
}
```

### PUT /api/products/:id

Actualizar producto.

### DELETE /api/products/:id

Eliminar producto.

**Validaciones:**
- No permite eliminar si tiene ventas asociadas
- No permite eliminar productos padre con variantes

### GET /api/categories

Listar categorías.

**Query Parameters:**
- `parentId` - Filtrar por categoría padre
- `level` - Filtrar por nivel de jerarquía
- `isActive` - Filtrar activas/inactivas
- `isQuickAccess` - Solo categorías de acceso rápido

### GET /api/brands

Listar marcas.

### GET /api/price-lists

Listar listas de precios.

## Productos Variables (Curva de Talles)

### Concepto

Un **producto padre** agrupa múltiples **variantes** (hijo). Ejemplo:

- Producto Padre: "Remera Nike Deportiva" (isParent=true)
  - Variante 1: "Remera Nike - Talle S" (size="S")
  - Variante 2: "Remera Nike - Talle M" (size="M")
  - Variante 3: "Remera Nike - Talle L" (size="L")

### Tipos de Padres

**1. Padre Real (isParent=true, isVirtualParent=false)**
- Existe en Cianbox como producto padre explícito
- Tiene campo `padre_id` en Cianbox

**2. Padre Virtual (isParent=true, isVirtualParent=true)**
- Creado automáticamente por el sistema de sincronización
- No existe en Cianbox, se crea al detectar productos con mismo padre
- Nombre generado a partir de las variantes

### Flujo de Sincronización con Variantes

```
1. Productos llegan de Cianbox con "padre_id" y "talle"
   → Producto A: padre_id=100, talle="S"
   → Producto B: padre_id=100, talle="M"

2. Sistema verifica si existe padre con cianboxProductId=100
   → NO existe

3. Se crea producto padre virtual:
   → isParent: true
   → isVirtualParent: true
   → isActive: true

4. Se crean/actualizan variantes:
   → Producto A: parentProductId = padre_virtual.id
   → Producto B: parentProductId = padre_virtual.id
```

### Venta de Variantes en POS

1. POS muestra producto padre en listado
2. Al seleccionar, muestra modal con variantes disponibles
3. Usuario selecciona variante específica (talle)
4. Se agrega la variante al carrito (NO el padre)
5. El item de venta registra `productId` de la variante

### Consulta de Stock de Producto Padre

```typescript
// Stock total del producto padre = suma de stock de todas sus variantes
const parent = await prisma.product.findUnique({
  where: { id: parentProductId },
  include: {
    variants: {
      include: {
        stock: { where: { branchId } }
      }
    }
  }
});

const totalStock = parent.variants.reduce((sum, variant) => {
  const branchStock = variant.stock[0]?.available || 0;
  return sum + Number(branchStock);
}, 0);
```

## Ejemplos de Uso

### Crear Producto con Variantes

```typescript
// 1. Crear producto padre
const parent = await prisma.product.create({
  data: {
    tenantId,
    name: 'Remera Nike Deportiva',
    sku: 'NIKE-REM-001',
    basePrice: 15999,
    categoryId: 'cat123',
    isParent: true,
    isActive: true
  }
});

// 2. Crear variantes
const sizes = ['S', 'M', 'L', 'XL'];
for (const size of sizes) {
  await prisma.product.create({
    data: {
      tenantId,
      name: `${parent.name} - Talle ${size}`,
      sku: `${parent.sku}-${size}`,
      parentProductId: parent.id,
      size,
      basePrice: parent.basePrice,
      isActive: true
    }
  });
}
```

### Buscar Producto con Stock y Precio

```typescript
const product = await prisma.product.findFirst({
  where: {
    tenantId,
    barcode: '7798123456789',
    isActive: true
  },
  include: {
    category: true,
    brand: true,
    stock: { where: { branchId } },
    prices: {
      where: { priceListId },
      include: { priceList: true }
    },
    variants: {
      include: {
        stock: { where: { branchId } }
      }
    }
  }
});

const price = product.prices[0]?.price || product.basePrice;
const stock = product.stock[0]?.available || 0;
```

## Documentación Relacionada

- [PRODUCTS-MODELOS.md](./PRODUCTS-MODELOS.md) - Modelos de datos
