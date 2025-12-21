# API - Productos

> **NOTA:** Esta documentación es una versión legacy. Para información actualizada y completa sobre la API de productos, consultar:
> - **[API-PRODUCTOS.md](./API-PRODUCTOS.md)** - Documentación actualizada con productos variables
> - **[PRODUCTOS-VARIABLES.md](./PRODUCTOS-VARIABLES.md)** - Sistema de curva de talles

Documentación de endpoints para gestión de productos, categorías, marcas y stock.

## Descripción General

El módulo de productos gestiona:
- CRUD de productos con filtros avanzados
- Búsqueda por código de barras y SKU
- Gestión de categorías jerárquicas
- Gestión de marcas
- Control de stock por sucursal
- Sincronización con Cianbox ERP

**Nota:** Todos los endpoints filtran automáticamente por `tenantId` del usuario autenticado.

## Índice

1. [Productos](#productos)
2. [Categorías](#categorías)
3. [Marcas](#marcas)
4. [Stock](#stock)
5. [Búsqueda](#búsqueda)
6. [Modelos de Datos](#modelos-de-datos)

---

## Productos

### GET /api/products

Lista productos con filtros y paginación.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:read`

**Query Params:**

| Parámetro | Tipo | Descripción | Default |
|-----------|------|-------------|---------|
| `search` | string | Buscar por nombre, SKU, código de barras | - |
| `categoryId` | string | Filtrar por categoría | - |
| `brandId` | string | Filtrar por marca | - |
| `isActive` | boolean | Filtrar por estado | - |
| `trackStock` | boolean | Solo productos con control de stock | - |
| `page` | number | Número de página | 1 |
| `pageSize` | number | Items por página | 50 |

**Ejemplo:**
```
GET /api/products?search=laptop&categoryId=cat_001&isActive=true&page=1&pageSize=20
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_001",
      "sku": "LAP-001",
      "barcode": "7798765432109",
      "name": "Laptop Dell Inspiron 15",
      "description": "Laptop con procesador Intel i5",
      "categoryId": "cat_001",
      "brandId": "brand_001",
      "imageUrl": "https://cdn.example.com/laptop.jpg",
      "cost": 80000.00,
      "price": 120000.00,
      "compareAtPrice": 130000.00,
      "taxRate": 21,
      "trackStock": true,
      "minStock": 5,
      "maxStock": 50,
      "isActive": true,
      "createdAt": "2025-12-19T10:00:00Z",
      "category": {
        "id": "cat_001",
        "name": "Computadoras",
        "code": "COMP"
      },
      "brand": {
        "id": "brand_001",
        "name": "Dell",
        "code": "DELL"
      },
      "stock": [
        {
          "branchId": "branch_001",
          "quantity": 15,
          "available": 15,
          "reserved": 0
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### GET /api/products/:id

Obtiene un producto por ID.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:read`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "prod_001",
    "sku": "LAP-001",
    "barcode": "7798765432109",
    "name": "Laptop Dell Inspiron 15",
    "description": "Laptop con procesador Intel i5, 8GB RAM, 256GB SSD",
    "categoryId": "cat_001",
    "brandId": "brand_001",
    "imageUrl": "https://cdn.example.com/laptop.jpg",
    "cost": 80000.00,
    "price": 120000.00,
    "compareAtPrice": 130000.00,
    "taxRate": 21,
    "trackStock": true,
    "minStock": 5,
    "maxStock": 50,
    "reorderPoint": 10,
    "isActive": true,
    "metadata": {
      "warranty": "1 año",
      "processor": "Intel i5-1135G7"
    },
    "cianboxProductId": "12345",
    "createdAt": "2025-12-19T10:00:00Z",
    "updatedAt": "2025-12-19T10:00:00Z",
    "category": {
      "id": "cat_001",
      "name": "Computadoras",
      "code": "COMP",
      "parentId": null
    },
    "brand": {
      "id": "brand_001",
      "name": "Dell",
      "code": "DELL"
    },
    "stock": [
      {
        "id": "stock_001",
        "branchId": "branch_001",
        "quantity": 15,
        "available": 13,
        "reserved": 2,
        "branch": {
          "id": "branch_001",
          "name": "Sucursal Centro",
          "code": "SUC001"
        }
      }
    ]
  }
}
```

---

### POST /api/products

Crea un nuevo producto.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:write`

**Body:**
```json
{
  "sku": "LAP-002",
  "barcode": "7798765432116",
  "name": "Laptop HP Pavilion 14",
  "description": "Laptop con procesador AMD Ryzen 5",
  "categoryId": "cat_001",
  "brandId": "brand_002",
  "imageUrl": "https://cdn.example.com/hp-pavilion.jpg",
  "cost": 75000.00,
  "price": 115000.00,
  "compareAtPrice": 125000.00,
  "taxRate": 21,
  "trackStock": true,
  "minStock": 5,
  "maxStock": 30,
  "reorderPoint": 8,
  "isActive": true,
  "metadata": {
    "warranty": "1 año",
    "processor": "AMD Ryzen 5 5500U"
  }
}
```

**Validaciones:**
- `name`: requerido, mínimo 1 carácter
- `sku`: opcional, debe ser único por tenant si se especifica
- `barcode`: opcional, debe ser único por tenant si se especifica
- `price`: requerido, >= 0
- `cost`: >= 0
- `taxRate`: default 21

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "prod_002",
    "sku": "LAP-002",
    "name": "Laptop HP Pavilion 14",
    "price": 115000.00,
    // ... resto de campos
  }
}
```

**Errores:**
```json
// SKU duplicado
{
  "success": false,
  "statusCode": 409,
  "error": "Ya existe un producto con ese SKU"
}

// Código de barras duplicado
{
  "success": false,
  "statusCode": 409,
  "error": "Ya existe un producto con ese código de barras"
}
```

---

### PUT /api/products/:id

Actualiza un producto existente.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:write`

**Body:** Igual que POST pero todos los campos son opcionales.

**Ejemplo:**
```json
{
  "price": 118000.00,
  "isActive": false
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "prod_002",
    "price": 118000.00,
    "isActive": false,
    // ... resto de campos actualizados
  }
}
```

---

### DELETE /api/products/:id

Elimina un producto (soft delete).

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:delete`

**Respuesta:**
```json
{
  "success": true,
  "message": "Producto eliminado correctamente"
}
```

**Nota:** Si el producto tiene ventas asociadas, se desactiva (`isActive: false`) en lugar de eliminarse.

---

### GET /api/products/barcode/:barcode

Busca un producto por código de barras.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:read`

**Respuesta:** Igual que GET /api/products/:id

**Error 404:**
```json
{
  "success": false,
  "statusCode": 404,
  "error": "Producto no encontrado"
}
```

**Uso típico:** Escaneo de código de barras en POS.

```javascript
const scanBarcode = async (barcode) => {
  try {
    const response = await axios.get(`/api/products/barcode/${barcode}`);
    // Agregar al carrito
    addToCart(response.data.data);
  } catch (error) {
    if (error.response?.status === 404) {
      alert('Producto no encontrado');
    }
  }
};
```

---

### GET /api/products/sku/:sku

Busca un producto por SKU.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:read`

**Respuesta:** Igual que GET /api/products/:id

---

## Categorías

### GET /api/categories

Lista todas las categorías del tenant.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_001",
      "code": "COMP",
      "name": "Computadoras",
      "description": "Laptops, desktops y accesorios",
      "parentId": null,
      "imageUrl": "https://cdn.example.com/category-comp.jpg",
      "isActive": true,
      "sortOrder": 1,
      "subcategories": [
        {
          "id": "cat_002",
          "code": "COMP-LAP",
          "name": "Laptops",
          "parentId": "cat_001",
          "isActive": true
        }
      ],
      "_count": {
        "products": 45
      }
    }
  ]
}
```

---

### POST /api/categories

Crea una nueva categoría.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:write`

**Body:**
```json
{
  "code": "COMP-ACC",
  "name": "Accesorios de Computación",
  "description": "Mouse, teclados, monitores",
  "parentId": "cat_001",
  "imageUrl": "https://cdn.example.com/accessories.jpg",
  "isActive": true,
  "sortOrder": 3
}
```

**Validaciones:**
- `name`: requerido
- `code`: opcional, debe ser único por tenant

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "cat_003",
    "code": "COMP-ACC",
    "name": "Accesorios de Computación",
    // ...
  }
}
```

---

### PUT /api/categories/:id

Actualiza una categoría.

### DELETE /api/categories/:id

Elimina una categoría.

**Nota:** No se puede eliminar si tiene productos asociados.

---

## Marcas

### GET /api/brands

Lista todas las marcas del tenant.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "brand_001",
      "code": "DELL",
      "name": "Dell",
      "description": "Fabricante de computadoras",
      "logoUrl": "https://cdn.example.com/dell-logo.png",
      "website": "https://www.dell.com",
      "isActive": true,
      "_count": {
        "products": 23
      }
    }
  ]
}
```

---

### POST /api/brands

Crea una nueva marca.

**Body:**
```json
{
  "code": "HP",
  "name": "HP",
  "description": "Hewlett-Packard",
  "logoUrl": "https://cdn.example.com/hp-logo.png",
  "website": "https://www.hp.com",
  "isActive": true
}
```

---

## Stock

### GET /api/products/:id/stock

Obtiene el stock de un producto en todas las sucursales.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "productId": "prod_001",
    "productName": "Laptop Dell Inspiron 15",
    "trackStock": true,
    "stock": [
      {
        "branchId": "branch_001",
        "branchName": "Sucursal Centro",
        "quantity": 15,
        "available": 13,
        "reserved": 2
      },
      {
        "branchId": "branch_002",
        "branchName": "Sucursal Norte",
        "quantity": 8,
        "available": 8,
        "reserved": 0
      }
    ],
    "totalQuantity": 23,
    "totalAvailable": 21,
    "totalReserved": 2
  }
}
```

---

### PUT /api/products/:id/stock/:branchId

Actualiza el stock de un producto en una sucursal.

**Headers:**
```
Authorization: Bearer {token}
```

**Permisos:** `products:write`

**Body:**
```json
{
  "quantity": 20,
  "reason": "PURCHASE",
  "notes": "Compra a proveedor XYZ"
}
```

**Tipos de movimiento:**
- `PURCHASE` - Compra
- `SALE` - Venta (generalmente automático)
- `ADJUSTMENT` - Ajuste manual
- `TRANSFER_IN` - Transferencia entrante
- `TRANSFER_OUT` - Transferencia saliente
- `DAMAGED` - Producto dañado
- `LOST` - Pérdida
- `RETURN` - Devolución

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "branchId": "branch_001",
    "productId": "prod_001",
    "quantity": 20,
    "available": 20,
    "reserved": 0
  }
}
```

---

## Búsqueda

### POST /api/products/search

Búsqueda avanzada de productos.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "query": "laptop dell",
  "filters": {
    "categoryIds": ["cat_001"],
    "brandIds": ["brand_001"],
    "priceMin": 50000,
    "priceMax": 150000,
    "inStock": true,
    "isActive": true
  },
  "sort": {
    "field": "price",
    "order": "asc"
  },
  "page": 1,
  "pageSize": 20
}
```

**Campos de ordenamiento:**
- `name` - Nombre
- `price` - Precio
- `createdAt` - Fecha de creación
- `updatedAt` - Última actualización
- `sku` - SKU

**Respuesta:** Igual que GET /api/products

---

## Modelos de Datos

### Product

```typescript
interface Product {
  id: string;
  tenantId: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  imageUrl?: string;
  cost: number;
  price: number;
  compareAtPrice?: number;
  taxRate: number;
  trackStock: boolean;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  isActive: boolean;
  metadata?: any;
  cianboxProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Category

```typescript
interface Category {
  id: string;
  tenantId: string;
  code?: string;
  name: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Brand

```typescript
interface Brand {
  id: string;
  tenantId: string;
  code?: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### ProductStock

```typescript
interface ProductStock {
  id: string;
  productId: string;
  branchId: string;
  quantity: number;
  available: number;
  reserved: number;
  lastStockTake?: Date;
  updatedAt: Date;
}
```

**Diferencia entre campos de stock:**
- `quantity`: Stock total físico
- `available`: Stock disponible para venta (quantity - reserved)
- `reserved`: Stock reservado en pedidos pendientes

---

**Ver también:**
- [API - Ventas](./API-SALES.md)
- [Sistema de Promociones](./PROMOCIONES-FLUJO.md)
