# Sistema de Promociones - Flujo y Cálculo

Documentación completa del sistema de promociones y combos del POS.

## Descripción General

El sistema de promociones permite:
- Crear promociones de diferentes tipos (porcentuales, fijas, 2x1, etc.)
- Configurar vigencia por fechas, días de la semana y horarios
- Aplicar promociones a productos específicos, categorías o marcas
- Controlar usos máximos globales y por cliente
- Apilar promociones (stackable) o aplicar la mejor
- Crear combos de productos con precio especial

## Índice

1. [Tipos de Promociones](#tipos-de-promociones)
2. [Configuración de Promociones](#configuración)
3. [Flujo de Aplicación](#flujo-de-aplicación)
4. [Cálculo de Descuentos](#cálculo-de-descuentos)
5. [Prioridad y Apilamiento](#prioridad-y-apilamiento)
6. [Combos](#combos)
7. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## Tipos de Promociones

### PERCENTAGE - Descuento Porcentual

Aplica un porcentaje de descuento sobre el precio del producto.

**Configuración:**
```json
{
  "type": "PERCENTAGE",
  "discountType": "PERCENTAGE",
  "discountValue": 15,
  "name": "15% OFF en toda la tienda"
}
```

**Cálculo:**
```
descuento = precioUnitario × cantidad × (discountValue / 100)
descuento = 5000 × 2 × (15 / 100) = 1500
precioFinal = 10000 - 1500 = 8500
```

---

### FIXED_AMOUNT - Descuento Monto Fijo

Descuenta un monto fijo por unidad.

**Configuración:**
```json
{
  "type": "FIXED_AMOUNT",
  "discountType": "FIXED_AMOUNT",
  "discountValue": 500,
  "name": "$500 OFF por unidad"
}
```

**Cálculo:**
```
descuento = discountValue × cantidad
descuento = 500 × 2 = 1000
precioFinal = 10000 - 1000 = 9000
```

---

### BUY_X_GET_Y - Lleve X Pague Y

Compra X unidades y paga solo Y (ejemplo: 2x1, 3x2).

**Configuración:**
```json
{
  "type": "BUY_X_GET_Y",
  "buyQuantity": 2,
  "getQuantity": 1,
  "name": "2x1 en productos seleccionados"
}
```

**Cálculo:**
```
sets = floor(cantidadComprada / (buyQuantity + getQuantity))
unidadesGratis = sets × getQuantity
descuento = unidadesGratis × precioUnitario

Ejemplo: Compra 5 unidades a $1000 c/u
sets = floor(5 / (2 + 1)) = floor(5 / 3) = 1
unidadesGratis = 1 × 1 = 1
descuento = 1 × 1000 = 1000
precioFinal = 5000 - 1000 = 4000
```

**Variantes comunes:**
- 2x1: `buyQuantity: 1, getQuantity: 1`
- 3x2: `buyQuantity: 2, getQuantity: 1`
- 4x3: `buyQuantity: 3, getQuantity: 1`

---

### SECOND_UNIT_DISCOUNT - Segunda Unidad con Descuento

La segunda unidad (y subsecuentes pares) tienen descuento.

**Configuración:**
```json
{
  "type": "SECOND_UNIT_DISCOUNT",
  "discountType": "PERCENTAGE",
  "discountValue": 50,
  "name": "2da unidad al 50%"
}
```

**Cálculo:**
```
if (cantidad >= 2) {
  unidadesConDescuento = floor(cantidad / 2)
  descuento = unidadesConDescuento × precioUnitario × (discountValue / 100)
}

Ejemplo: Compra 3 unidades a $1000 c/u
unidadesConDescuento = floor(3 / 2) = 1
descuento = 1 × 1000 × (50 / 100) = 500
precioFinal = 3000 - 500 = 2500
```

---

### FLASH_SALE - Venta Relámpago

Similar a PERCENTAGE pero con énfasis en urgencia (BlackFriday, CyberMonday).

**Configuración:**
```json
{
  "type": "FLASH_SALE",
  "discountValue": 30,
  "name": "Black Friday - 30% OFF",
  "startDate": "2025-11-29T00:00:00Z",
  "endDate": "2025-11-30T23:59:59Z",
  "badgeColor": "#FF0000"
}
```

**Cálculo:** Igual que PERCENTAGE

---

### BUNDLE_PRICE - Precio por Paquete

Precio especial cuando se compran productos juntos (similar a Combo).

---

### COUPON - Cupón de Descuento

Descuento aplicable con código de cupón.

---

## Configuración

### Campos Comunes

```typescript
interface Promotion {
  code?: string;                    // Código único (opcional)
  name: string;                     // Nombre descriptivo
  description?: string;             // Descripción larga
  type: PromotionType;              // Tipo de promoción
  discountType: DiscountType;       // Tipo de descuento
  discountValue: number;            // Valor del descuento

  // Productos aplicables
  applyTo: 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'CATEGORIES' | 'BRANDS' | 'CART_TOTAL';
  productIds?: string[];            // IDs de productos específicos
  categoryIds?: string[];           // IDs de categorías
  brandIds?: string[];              // IDs de marcas

  // Vigencia temporal
  startDate?: Date;                 // Fecha de inicio
  endDate?: Date;                   // Fecha de fin
  daysOfWeek?: number[];            // Días de la semana (0=domingo, 6=sábado)
  startTime?: string;               // Hora de inicio (HH:MM)
  endTime?: string;                 // Hora de fin (HH:MM)

  // Restricciones
  minPurchase?: number;             // Compra mínima
  maxDiscount?: number;             // Descuento máximo
  maxUses?: number;                 // Usos totales máximos
  maxUsesPerCustomer?: number;      // Usos por cliente
  currentUses: number;              // Usos actuales

  // Control
  isActive: boolean;                // Estado activo/inactivo
  priority: number;                 // Prioridad (mayor = primero)
  stackable: boolean;               // Permite apilar con otras

  // Visualización
  badgeColor?: string;              // Color del badge (#RRGGBB)
  metadata?: any;                   // Datos adicionales
}
```

### Ejemplo Completo

```json
{
  "code": "CYBER2025",
  "name": "Cyber Monday 2025",
  "description": "40% de descuento en computadoras",
  "type": "FLASH_SALE",
  "discountType": "PERCENTAGE",
  "discountValue": 40,

  "applyTo": "CATEGORIES",
  "categoryIds": ["cat_computadoras"],

  "startDate": "2025-11-27T00:00:00Z",
  "endDate": "2025-11-27T23:59:59Z",
  "daysOfWeek": [1],
  "startTime": "00:00",
  "endTime": "23:59",

  "minPurchase": 50000,
  "maxDiscount": 30000,
  "maxUses": 1000,
  "maxUsesPerCustomer": 3,

  "isActive": true,
  "priority": 100,
  "stackable": false,

  "badgeColor": "#FF6B00"
}
```

---

## Flujo de Aplicación

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│  INICIO: Calcular promociones para carrito                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Obtener promociones activas del tenant                  │
│     WHERE isActive = true                                   │
│       AND (startDate IS NULL OR startDate <= now)           │
│       AND (endDate IS NULL OR endDate >= now)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Filtrar por contexto temporal                           │
│     • Día de la semana (daysOfWeek)                         │
│     • Horario (startTime, endTime)                          │
│     • Usos máximos no alcanzados                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Ordenar por prioridad DESC                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. PARA CADA ITEM del carrito                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  4.1 PARA CADA       │
          │  promoción aplicable │
          └──────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4.2 Verificar aplicabilidad                                │
│      ┌─────────────────────────────────────────┐            │
│      │ applyTo = ALL_PRODUCTS?     → SÍ aplica│            │
│      │ applyTo = SPECIFIC_PRODUCTS?            │            │
│      │   → productId en productIds? → SÍ/NO   │            │
│      │ applyTo = CATEGORIES?                   │            │
│      │   → product.categoryId en categoryIds?  │            │
│      │ applyTo = BRANDS?                       │            │
│      │   → product.brandId en brandIds?        │            │
│      └─────────────────────────────────────────┘            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4.3 Calcular descuento según tipo                          │
│      • PERCENTAGE: precio × qty × (value / 100)             │
│      • FIXED_AMOUNT: value × qty                            │
│      • BUY_X_GET_Y: sets × getQty × precio                  │
│      • SECOND_UNIT_DISCOUNT: floor(qty/2) × precio × %      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4.4 Aplicar maxDiscount si existe                          │
│      descuento = min(descuento, maxDiscount)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4.5 Gestionar apilamiento                                  │
│      ┌────────────────────────────────────────┐             │
│      │ if (stackable)                         │             │
│      │   → Agregar a lista de descuentos      │             │
│      │      acumulables                        │             │
│      │ else                                    │             │
│      │   → Comparar con mejor no-stackable    │             │
│      │      Guardar si es mayor               │             │
│      └────────────────────────────────────────┘             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4.6 Seleccionar descuento(s) a aplicar                     │
│      if (mejorNoStackable > sumaStackables)                 │
│        → Usar solo mejorNoStackable                         │
│      else                                                    │
│        → Usar todas las stackables                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Calcular totales del carrito                            │
│     totalDescuento = sum(item.discount para todos items)    │
│     subtotal = sum((precio × qty) - discount)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  FIN: Devolver items con descuentos aplicados               │
└─────────────────────────────────────────────────────────────┘
```

---

## Cálculo de Descuentos

### Endpoint de Cálculo

```
POST /api/promotions/calculate
```

**Request:**
```json
{
  "items": [
    {
      "productId": "prod_001",
      "quantity": 2,
      "unitPrice": 5000.00
    },
    {
      "productId": "prod_002",
      "quantity": 1,
      "unitPrice": 3000.00
    }
  ],
  "customerId": "customer_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "prod_001",
        "quantity": 2,
        "unitPrice": 5000.00,
        "discount": 1500.00,
        "promotions": [
          {
            "id": "promo_001",
            "name": "15% OFF",
            "type": "PERCENTAGE",
            "discount": 1500.00
          }
        ],
        "subtotal": 8500.00
      },
      {
        "productId": "prod_002",
        "quantity": 1,
        "unitPrice": 3000.00,
        "discount": 0,
        "promotions": [],
        "subtotal": 3000.00
      }
    ],
    "totalDiscount": 1500.00
  }
}
```

---

## Prioridad y Apilamiento

### Sistema de Prioridad

Las promociones se evalúan en orden de **prioridad descendente** (mayor prioridad primero).

```javascript
// Ordenamiento
promotions.sort((a, b) => b.priority - a.priority);
```

**Ejemplo:**
- Prioridad 100: Black Friday (40% OFF)
- Prioridad 50: Descuento por categoría (15% OFF)
- Prioridad 10: Cupón de cliente (10% OFF)

Si **NO son stackable**, solo se aplica la de mayor prioridad.

### Stackable (Apilamiento)

**Stackable = true:** Se suman los descuentos

```json
Promoción A: 10% OFF (stackable: true)
Promoción B: 5% OFF (stackable: true)

Producto: $10000
Descuento A: 10000 × 0.10 = 1000
Descuento B: 10000 × 0.05 = 500
Total descuento: 1500
Precio final: 8500
```

**Stackable = false:** Solo se aplica la mejor

```json
Promoción A: 15% OFF (stackable: false)
Promoción B: 10% OFF (stackable: false)

Producto: $10000
Se aplica solo A (mayor descuento): 1500
Precio final: 8500
```

### Estrategia Mixta

```
Stackables: [500, 300, 200] = 1000
Mejor no-stackable: 1200

Resultado: Se usa la no-stackable (1200 > 1000)
```

---

## Combos

Los combos son agrupaciones de productos con precio especial.

### Crear Combo

```
POST /api/promotions/combos
```

**Request:**
```json
{
  "code": "COMBO-GAMER",
  "name": "Combo Gamer Completo",
  "description": "PC + Monitor + Teclado + Mouse",
  "regularPrice": 150000.00,
  "comboPrice": 120000.00,
  "imageUrl": "https://cdn.example.com/combo-gamer.jpg",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "isActive": true,
  "items": [
    {
      "productId": "prod_pc",
      "quantity": 1
    },
    {
      "productId": "prod_monitor",
      "quantity": 1
    },
    {
      "productId": "prod_teclado",
      "quantity": 1
    },
    {
      "productId": "prod_mouse",
      "quantity": 1
    }
  ]
}
```

**Ahorro del combo:**
```
ahorro = regularPrice - comboPrice
ahorro = 150000 - 120000 = 30000 (20% OFF)
```

---

## Ejemplos Prácticos

### Ejemplo 1: Black Friday - 40% en Computadoras

```json
{
  "name": "Black Friday - Computadoras",
  "type": "FLASH_SALE",
  "discountValue": 40,
  "applyTo": "CATEGORIES",
  "categoryIds": ["cat_computadoras"],
  "startDate": "2025-11-29T00:00:00Z",
  "endDate": "2025-11-30T23:59:59Z",
  "maxUses": 500,
  "priority": 100,
  "stackable": false,
  "badgeColor": "#FF0000"
}
```

**Aplicación:**
- Producto: Laptop $100000
- Descuento: 100000 × 0.40 = 40000
- Precio final: 60000

---

### Ejemplo 2: 2x1 en Bebidas (Solo Sábados)

```json
{
  "name": "2x1 Bebidas - Sábados",
  "type": "BUY_X_GET_Y",
  "buyQuantity": 1,
  "getQuantity": 1,
  "applyTo": "CATEGORIES",
  "categoryIds": ["cat_bebidas"],
  "daysOfWeek": [6],
  "priority": 50,
  "stackable": false
}
```

**Aplicación:**
- Producto: Gaseosa $500
- Cantidad: 4 unidades
- Sets: floor(4 / 2) = 2
- Gratis: 2 × 1 = 2 unidades
- Descuento: 2 × 500 = 1000
- Precio final: 2000 - 1000 = 1000

---

### Ejemplo 3: Happy Hour (18-20hs)

```json
{
  "name": "Happy Hour",
  "type": "PERCENTAGE",
  "discountValue": 25,
  "applyTo": "CATEGORIES",
  "categoryIds": ["cat_bebidas", "cat_snacks"],
  "startTime": "18:00",
  "endTime": "20:00",
  "priority": 30,
  "stackable": true
}
```

**Aplicación (19:30hs):**
- Producto: Cerveza $1000
- Descuento: 1000 × 0.25 = 250
- Precio final: 750

**Fuera de horario (21:00hs):**
- No se aplica

---

### Ejemplo 4: Cupón + Descuento Categoría (Stackable)

```json
// Promoción 1 (stackable)
{
  "name": "10% Electrónica",
  "type": "PERCENTAGE",
  "discountValue": 10,
  "applyTo": "CATEGORIES",
  "categoryIds": ["cat_electronica"],
  "stackable": true,
  "priority": 20
}

// Promoción 2 (stackable)
{
  "name": "Cupón BIENVENIDO",
  "type": "COUPON",
  "code": "BIENVENIDO",
  "discountValue": 5,
  "applyTo": "ALL_PRODUCTS",
  "stackable": true,
  "priority": 10
}
```

**Aplicación:**
- Producto: Tablet $20000 (categoría electrónica)
- Descuento 1: 20000 × 0.10 = 2000
- Descuento 2: 20000 × 0.05 = 1000
- Total descuento: 3000
- Precio final: 17000

---

**Ver también:**
- [API - Ventas](./API-SALES.md)
- [API - Productos](./API-PRODUCTS.md)
