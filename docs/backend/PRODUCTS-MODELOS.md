# Productos - Modelos de Datos

**Sistema de gestión de productos con soporte para variantes y sincronización con Cianbox ERP**

## Product

Productos simples y productos con variantes (padre-hijo).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| cianboxProductId | Int? | ID en Cianbox (null si producto local) |
| **Códigos** | | |
| sku | String? | Código SKU interno |
| barcode | String? | Código de barras (EAN/UPC) |
| internalCode | String? | Código adicional |
| **Información** | | |
| name | String | Nombre completo |
| shortName | String? | Nombre corto para tickets |
| description | String? | Descripción detallada |
| **Clasificación** | | |
| categoryId | String? | Categoría |
| brandId | String? | Marca |
| **Precios** | | |
| basePrice | Decimal? | Precio base |
| baseCost | Decimal? | Costo base |
| taxRate | Decimal | IVA (default: 21%) |
| taxIncluded | Boolean | Si el precio incluye IVA |
| **Stock** | | |
| trackStock | Boolean | Si controla stock |
| allowNegativeStock | Boolean | Permite stock negativo |
| minStock | Int? | Stock mínimo (alerta) |
| **Venta** | | |
| sellFractions | Boolean | Permite vender fracciones (0.5 kg) |
| unitOfMeasure | String | UN, KG, LT, MT |
| **Variantes** | | |
| isParent | Boolean | true = producto padre con variantes |
| isVirtualParent | Boolean | true = padre virtual (creado automáticamente) |
| parentProductId | String? | ID del producto padre |
| size | String? | Talle: "38", "40", "L", "XL" |
| color | String? | Color: "Negro", "Azul" |
| **Estado** | | |
| isActive | Boolean | Activo/Inactivo |
| isService | Boolean | Es servicio (no tiene stock) |
| imageUrl | String? | URL de imagen |
| location | String? | Ubicación física (R1-F2-C3) |
| lastSyncedAt | DateTime? | Última sincronización |

**Relaciones:**
- Pertenece a `Category`
- Pertenece a `Brand`
- Pertenece a `Product` padre (si es variante)
- Tiene muchas `Product` variantes (si es padre)
- Tiene muchos `ProductPrice` (precios por lista)
- Tiene muchos `ProductStock` (stock por sucursal)

## Category

Categorías con jerarquía multinivel.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| cianboxCategoryId | Int? | ID en Cianbox |
| code | String? | Código interno |
| name | String | Nombre |
| description | String? | Descripción |
| parentId | String? | Categoría padre |
| level | Int | Nivel en jerarquía (0 = raíz) |
| sortOrder | Int | Orden de visualización |
| imageUrl | String? | Imagen de la categoría |
| **Acceso Rápido POS** | | |
| isQuickAccess | Boolean | Mostrar en acceso rápido POS |
| quickAccessOrder | Int | Orden en barra de acceso rápido |
| quickAccessColor | String? | Color del botón (hex) |
| quickAccessIcon | String? | Icono lucide-react |
| isDefaultQuickAccess | Boolean | Categoría seleccionada por defecto |
| isActive | Boolean | Activo/Inactivo |

**Relaciones:**
- Pertenece a `Category` padre
- Tiene muchas `Category` hijas (jerarquía)
- Tiene muchos `Product`

## Brand

Marcas de productos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| cianboxBrandId | Int? | ID en Cianbox |
| name | String | Nombre |
| description | String? | Descripción |
| logoUrl | String? | Logo de la marca |
| isActive | Boolean | Activo/Inactivo |

## PriceList

Listas de precios (Minorista, Mayorista, etc.).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| cianboxPriceListId | Int? | ID en Cianbox |
| name | String | "Lista Minorista", "Mayorista" |
| description | String? | Descripción |
| currency | String | Moneda (ARS, USD) |
| isDefault | Boolean | Lista por defecto |
| isActive | Boolean | Activo/Inactivo |

## ProductPrice

Precios de productos por lista.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| productId | String | Producto |
| priceListId | String | Lista de precios |
| price | Decimal | Precio final CON IVA |
| priceNet | Decimal? | Precio neto SIN IVA |
| cost | Decimal? | Costo |
| margin | Decimal? | Margen en % |
| validFrom | DateTime | Fecha desde |
| validUntil | DateTime? | Fecha hasta |

**Índice único:** `[productId, priceListId]`

## ProductStock

Stock por sucursal.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| productId | String | Producto |
| branchId | String | Sucursal |
| quantity | Decimal | Cantidad total |
| reserved | Decimal | Cantidad reservada |
| available | Decimal | Disponible (quantity - reserved) |
| minStock | Int? | Stock mínimo para esta sucursal |
| maxStock | Int? | Stock máximo |
| location | String? | Ubicación en sucursal |
| lastCountAt | DateTime? | Último inventario |

**Índice único:** `[productId, branchId]`

## Reglas de Negocio

### Precios

1. **Precio Final:** Siempre se usa el precio de `ProductPrice` según la lista de precios
2. **Precio Base:** El `basePrice` del producto es solo referencia
3. **IVA:** Si `taxIncluded=true`, el precio en `ProductPrice` ya incluye IVA
4. **Cálculo de IVA:**
   - Precio CON IVA: `price`
   - Precio SIN IVA: `price / (1 + taxRate/100)`
   - IVA: `price - priceNet`

### Stock

1. **Reserva de Stock:** Al crear una venta, el stock se reserva (`reserved`)
2. **Descuento de Stock:** Al completar la venta, se descuenta de `quantity`
3. **Stock Disponible:** `available = quantity - reserved`
4. **Stock Negativo:** Solo si `allowNegativeStock=true`

### Códigos de Barras

1. **Múltiples Productos con Mismo Barcode:**
   - El sistema alerta si se intenta crear duplicado
   - Se debe usar el mismo producto con variantes

2. **Búsqueda por Barcode:**
   - Busca primero match exacto
   - Si hay variantes, muestra selector

## Documentación Relacionada

- [PRODUCTS-ENDPOINTS.md](./PRODUCTS-ENDPOINTS.md) - Endpoints y variantes
