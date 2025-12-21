# Productos Variables (Curva de Talles)

## Descripcion General

El sistema ahora soporta **productos variables**, tambien conocidos como "curva de talles". Esto permite manejar productos padre con multiples variantes definidas por combinaciones de **talle** y **color**, ideal para tiendas de ropa y calzado.

### Estructura de datos

```
Producto Padre (isParent: true)
├── Variante 1 (size: "38", color: "Negro")
├── Variante 2 (size: "38", color: "Blanco")
├── Variante 3 (size: "40", color: "Negro")
├── Variante 4 (size: "40", color: "Blanco")
└── ...
```

---

## Modelo de Datos

### Campos agregados a Product (Prisma)

```prisma
model Product {
  // ... campos existentes ...

  // === PRODUCTOS VARIABLES (Curva de Talles) ===
  isParent         Boolean   @default(false)  // true = producto padre con variantes
  parentProductId  String?                    // ID del producto padre (null si es padre o simple)
  size             String?                    // Talle: "38", "40", "L", "XL"
  color            String?                    // Color: "Negro", "Blanco", "Beige"

  // Relaciones
  parentProduct    Product?         @relation("ProductVariants", fields: [parentProductId], references: [id])
  variants         Product[]        @relation("ProductVariants")

  @@index([tenantId, parentProductId])
  @@index([tenantId, isParent])
}
```

### Mapeo desde Cianbox

Los datos vienen de la API de Cianbox con los siguientes campos:

| Campo Cianbox       | Campo Local       | Descripcion                           |
|---------------------|-------------------|---------------------------------------|
| `es_padre`          | `isParent`        | true si es producto padre             |
| `id_producto_padre` | `parentProductId` | ID del padre (0 si es padre o simple) |
| `talle`             | `size`            | Talle del producto                    |
| `color`             | `color`           | Color del producto                    |

---

## API Backend

### GET /api/backoffice/products/:id/size-curve

Obtiene la curva de talles de un producto padre.

**Parametros Query:**
- `branchId` (opcional): Filtrar stock por sucursal

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "parent": {
      "id": "clxx...",
      "name": "JEAN RECTO CELESTE",
      "sku": "JEAN-RC",
      "imageUrl": null
    },
    "sizes": ["38", "40", "42", "44"],
    "colors": ["Beige", "Blanco", "Cemento"],
    "variants": [
      {
        "id": "clxx...",
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
        "variantId": "clxx...",
        "sku": "JEAN-RC-38-BE",
        "barcode": "7791234567890",
        "isActive": true,
        "stock": 15,
        "reserved": 2,
        "available": 13
      }
    },
    "totals": {
      "bySize": { "38": 23, "40": 16, "42": 11, "44": 6 },
      "byColor": { "Beige": 23, "Blanco": 11, "Cemento": 22 },
      "total": 56
    }
  }
}
```

### GET /api/backoffice/products

Parametros adicionales para filtrar:
- `parentsOnly=true`: Solo productos padre (con variantes)
- `hideVariants=true`: Ocultar variantes (mostrar solo padres y simples)

La respuesta incluye `_count.variants` para productos padre.

### GET /api/products/search

La busqueda ahora incluye los campos `isParent`, `size`, `color` en los resultados.

---

## Frontend Web (React)

### Backoffice

**Archivo:** `apps/backoffice/src/pages/ProductDetail.tsx`

- Tab "Curva de Talles" visible solo si `product.isParent === true`
- Matriz interactiva de talle x color
- Colores segun nivel de stock: verde (>=5), amarillo (1-4), rojo (0)
- Tooltip con SKU y codigo de barras

**Archivo:** `apps/backoffice/src/pages/Products.tsx`

- Checkbox "Ocultar variantes" (activo por defecto)
- Checkbox "Solo productos padre"
- Columna "Variantes" con badge contador
- Icono diferenciado para productos padre

### POS Web

**Archivo:** `apps/frontend/src/pages/POS.tsx`

- Al hacer clic en producto padre, se abre modal de curva de talles
- Badge "Talles" en productos padre
- Busqueda muestra indicador visual de productos padre

**Archivo:** `apps/frontend/src/components/SizeCurveModal.tsx`

- Modal que muestra matriz de talles/colores
- Click en celda con stock agrega variante al carrito
- Celdas deshabilitadas si no hay stock

---

## Integracion POS Windows (Desktop)

### Conceptos clave

1. **Producto Simple**: `isParent: false`, `parentProductId: null`
   - Se agrega directo al carrito

2. **Producto Padre**: `isParent: true`, `parentProductId: null`
   - NO se agrega directo al carrito
   - Se debe mostrar selector de variantes

3. **Variante**: `isParent: false`, `parentProductId: "id_del_padre"`
   - Se agrega al carrito como producto individual
   - Tiene `size` y `color` definidos

### Flujo de usuario

```
1. Usuario escanea o busca producto
2. Sistema detecta si es producto padre (isParent === true)
3. Si es padre:
   a. Llamar a GET /api/backoffice/products/:id/size-curve
   b. Mostrar matriz de seleccion
   c. Usuario selecciona celda (talle + color)
   d. Agregar variante seleccionada al carrito
4. Si no es padre:
   a. Agregar producto directo al carrito
```

### Ejemplo de llamada API

```javascript
// Obtener curva de talles
const response = await fetch(
  `/api/backoffice/products/${productId}/size-curve?branchId=${branchId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { data } = await response.json();

// data.sizes = ["38", "40", "42", "44"]
// data.colors = ["Beige", "Blanco", "Cemento"]
// data.matrix["38-Beige"] = { variantId, stock, available, ... }
```

### Agregar variante al carrito

Cuando el usuario selecciona una celda:

```javascript
const key = `${selectedSize}-${selectedColor}`;
const cell = sizeCurve.matrix[key];

if (cell && cell.available > 0) {
  const variant = sizeCurve.variants.find(v => v.id === cell.variantId);

  // Agregar al carrito usando el ID de la variante
  addToCart({
    id: variant.id,
    name: `${parentProduct.name} - ${selectedSize} ${selectedColor}`,
    sku: variant.sku || parentProduct.sku,
    barcode: variant.barcode,
    price: parentProduct.price, // El precio es del padre
    // ... otros campos
  });
}
```

### Consideraciones UI

1. **Visual distintivo**: Productos padre deben tener indicador visual (badge, icono, color)
2. **Stock en matriz**: Usar colores para indicar nivel de stock
   - Verde: stock >= 5
   - Amarillo: stock 1-4
   - Rojo: stock = 0
3. **Celdas deshabilitadas**: No permitir seleccionar celdas sin stock
4. **Tooltip**: Mostrar SKU y codigo de barras al hover

---

## Sincronizacion

La sincronizacion con Cianbox se realiza en dos pasadas:

1. **Primera pasada**: Crear/actualizar todos los productos con campos basicos
2. **Segunda pasada**: Resolver relaciones padre-hijo (`parentProductId`)

Esto es necesario porque el producto padre debe existir antes de poder asignar la relacion.

**Archivo:** `apps/backend/src/services/cianbox.service.ts`

```typescript
// Primera pasada: mapear campos
const productData = {
  // ... campos existentes ...
  isParent: product.es_padre ?? false,
  size: product.talle || null,
  color: product.color || null,
};

// Segunda pasada: resolver relaciones
if (product.id_producto_padre && product.id_producto_padre > 0) {
  const parentProduct = await prisma.product.findFirst({
    where: { tenantId, cianboxProductId: product.id_producto_padre },
  });

  if (parentProduct) {
    await prisma.product.updateMany({
      where: { tenantId, cianboxProductId: product.id },
      data: { parentProductId: parentProduct.id },
    });
  }
}
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/backend/prisma/schema.prisma` | Campos de productos variables |
| `apps/backend/src/services/cianbox.service.ts` | Mapeo y sincronizacion |
| `apps/backend/src/routes/backoffice.ts` | Endpoint curva de talles |
| `apps/backoffice/src/services/api.ts` | Tipos y funcion getSizeCurve |
| `apps/backoffice/src/pages/ProductDetail.tsx` | Tab curva de talles |
| `apps/backoffice/src/pages/Products.tsx` | Filtros de variantes |
| `apps/frontend/src/services/api.ts` | Tipos y funcion getSizeCurve |
| `apps/frontend/src/pages/POS.tsx` | Integracion productos padre |
| `apps/frontend/src/components/SizeCurveModal.tsx` | Modal de seleccion |

---

## Testing

### Casos de prueba

1. **Producto simple**: Verificar que se agrega directo al carrito
2. **Producto padre**: Verificar que abre modal de curva de talles
3. **Seleccion de variante**: Verificar que agrega la variante correcta
4. **Stock cero**: Verificar que celda esta deshabilitada
5. **Busqueda**: Verificar que muestra indicador de producto padre
6. **Filtros backoffice**: Verificar que oculta/muestra variantes
