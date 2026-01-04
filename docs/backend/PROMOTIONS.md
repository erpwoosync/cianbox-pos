# Promociones - Cianbox POS

**Sistema de promociones y descuentos con múltiples tipos y reglas de aplicación**

## Modelos de Datos

### Promotion

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| name | String | Nombre de la promoción |
| description | String? | Descripción |
| type | PromotionType | Tipo de promoción |
| value | Decimal | Valor (%, monto, cantidad gratis) |
| startDate | DateTime | Fecha de inicio |
| endDate | DateTime | Fecha de fin |
| isActive | Boolean | Activa/Inactiva |
| priority | Int | Prioridad de aplicación (menor = primero) |
| conditions | Json? | Condiciones adicionales |

**PromotionType:**
- `BUY_X_GET_Y` - Lleva X paga Y (2x1, 3x2)
- `SECOND_UNIT_DISCOUNT` - 2da unidad al X%
- `PERCENTAGE` - Descuento porcentual
- `FIXED_AMOUNT` - Descuento monto fijo
- `FLASH_SALE` - Venta relámpago (BlackFriday, CyberMonday)

**Relaciones:**
- Tiene muchos `PromotionProduct` (productos en promoción)
- Tiene muchos `Combo`

### PromotionProduct

Productos incluidos en la promoción.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| promotionId | String | Promoción |
| productId | String | Producto |

**Índice único:** `[promotionId, productId]`

### Combo

Combos de productos con precio especial.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| tenantId | String | ID del tenant |
| name | String | Nombre del combo |
| description | String? | Descripción |
| price | Decimal | Precio del combo |
| imageUrl | String? | Imagen |
| isActive | Boolean | Activo/Inactivo |
| validFrom | DateTime | Fecha desde |
| validUntil | DateTime? | Fecha hasta |

**Relaciones:**
- Tiene muchos `ComboItem` (productos del combo)

### ComboItem

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| comboId | String | Combo |
| productId | String | Producto |
| quantity | Decimal | Cantidad incluida |

## Endpoints

### GET /api/promotions

Listar promociones.

**Autenticación:** Bearer token requerido

**Query Parameters:**
- `isActive` - Solo activas
- `type` - Filtrar por tipo

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "promo123",
      "name": "2x1 en Remeras",
      "type": "BUY_X_GET_Y",
      "value": "1.00",
      "startDate": "2025-12-01T00:00:00Z",
      "endDate": "2025-12-31T23:59:59Z",
      "isActive": true,
      "products": [
        { "id": "prod123", "name": "Remera Nike" }
      ]
    }
  ]
}
```

### POST /api/promotions

Crear promoción.

**Autenticación:** Bearer token + permiso `settings:edit`

**Request:**
```json
{
  "name": "2x1 en Remeras",
  "type": "BUY_X_GET_Y",
  "value": 1,
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "isActive": true,
  "productIds": ["prod123", "prod456"]
}
```

### PUT /api/promotions/:id

Actualizar promoción.

### DELETE /api/promotions/:id

Eliminar promoción.

## Tipos de Promociones

### 1. BUY_X_GET_Y (2x1, 3x2)

**value:** Cantidad gratis (1 para 2x1, 1 para 3x2)

**Ejemplo:** 2x1 en remeras
```json
{
  "type": "BUY_X_GET_Y",
  "value": 1
}
```

**Aplicación:**
- Compra 2 remeras, paga 1
- Compra 4 remeras, paga 2

### 2. SECOND_UNIT_DISCOUNT

**value:** Porcentaje de descuento (50 para 50%)

**Ejemplo:** 2da unidad al 50%
```json
{
  "type": "SECOND_UNIT_DISCOUNT",
  "value": 50
}
```

**Aplicación:**
- 1ra unidad: precio completo
- 2da unidad: 50% descuento
- 3ra unidad: precio completo
- 4ta unidad: 50% descuento

### 3. PERCENTAGE

**value:** Porcentaje de descuento

**Ejemplo:** 20% off
```json
{
  "type": "PERCENTAGE",
  "value": 20
}
```

### 4. FIXED_AMOUNT

**value:** Monto fijo de descuento

**Ejemplo:** $5000 off
```json
{
  "type": "FIXED_AMOUNT",
  "value": 5000
}
```

### 5. FLASH_SALE

**value:** Porcentaje de descuento

**Ejemplo:** BlackFriday 40% off
```json
{
  "type": "FLASH_SALE",
  "value": 40,
  "name": "BlackFriday 2025",
  "startDate": "2025-11-25T00:00:00Z",
  "endDate": "2025-11-25T23:59:59Z"
}
```

## Aplicación de Promociones

### Motor de Promociones

```typescript
function applyPromotions(
  items: CartItem[],
  promotions: Promotion[]
): CartItem[] {
  // 1. Ordenar promociones por prioridad
  const sortedPromotions = promotions.sort((a, b) => a.priority - b.priority);

  // 2. Filtrar promociones activas y vigentes
  const activePromotions = sortedPromotions.filter(p =>
    p.isActive &&
    p.startDate <= now &&
    p.endDate >= now
  );

  // 3. Aplicar cada promoción
  for (const promotion of activePromotions) {
    items = applyPromotion(items, promotion);
  }

  return items;
}
```

### Prioridad de Aplicación

1. Promociones con menor `priority` se aplican primero
2. Las promociones no son acumulables por defecto
3. Una vez aplicada una promoción a un producto, no se aplican otras

## Combos

### Crear Combo

```typescript
const combo = await prisma.combo.create({
  data: {
    tenantId,
    name: 'Combo Verano',
    description: 'Remera + Short',
    price: 29999,
    isActive: true,
    items: {
      create: [
        { productId: 'prod-remera', quantity: 1 },
        { productId: 'prod-short', quantity: 1 }
      ]
    }
  }
});
```

### Vender Combo

Al vender un combo:
1. Se crea un item de venta por cada producto del combo
2. Se aplica descuento proporcional para que el total sea el precio del combo
3. Se descuenta stock de cada producto

## Ejemplo Completo

```typescript
// Promoción 2x1
const promo = await prisma.promotion.create({
  data: {
    tenantId,
    name: '2x1 en Remeras',
    type: 'BUY_X_GET_Y',
    value: 1,
    startDate: new Date('2025-12-01'),
    endDate: new Date('2025-12-31'),
    isActive: true,
    priority: 1,
    products: {
      create: [
        { productId: 'prod-remera-1' },
        { productId: 'prod-remera-2' }
      ]
    }
  }
});

// Aplicar en venta
// Si cliente compra 2 remeras a $15999 c/u:
// - Subtotal: $31998
// - Descuento 2x1: -$15999
// - Total: $15999
```
