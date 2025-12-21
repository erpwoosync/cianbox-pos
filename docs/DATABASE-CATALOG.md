# Modelo de Datos - Catálogo de Productos

Documentación de los modelos relacionados con el catálogo de productos, categorías, marcas y precios.

## Índice
- [Categorías](#categorías)
- [Marcas](#marcas)
- [Listas de Precios](#listas-de-precios)
- [Productos](#productos)
- [Stock](#stock)
- [Clientes](#clientes)

---

## Categorías

### Category
Categorías de productos con jerarquía (árbol) y accesos rápidos para POS.

```prisma
model Category {
  id                 String    @id @default(cuid())
  tenantId           String
  cianboxCategoryId  Int?      // ID en Cianbox
  code               String?
  name               String
  description        String?
  parentId           String?   // Categoría padre (jerarquía)
  level              Int       @default(0)
  sortOrder          Int       @default(0)
  imageUrl           String?
  isActive           Boolean   @default(true)

  // Acceso Rápido en POS
  isQuickAccess          Boolean   @default(false)
  quickAccessOrder       Int       @default(0)
  quickAccessColor       String?   // Color hex (#FF5733)
  quickAccessIcon        String?   // Nombre de lucide-react
  isDefaultQuickAccess   Boolean   @default(false)

  lastSyncedAt       DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  tenant   Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")
  products Product[]

  @@unique([tenantId, cianboxCategoryId])
  @@index([tenantId, parentId])
  @@index([tenantId, isQuickAccess, quickAccessOrder])
}
```

**Campos Especiales:**

| Campo | Propósito | Ejemplo |
|-------|-----------|---------|
| `isQuickAccess` | Mostrar en barra superior del POS | true |
| `quickAccessOrder` | Orden de izquierda a derecha | 1, 2, 3... |
| `quickAccessColor` | Color del botón | "#3B82F6" (azul) |
| `quickAccessIcon` | Icono de lucide-react | "Coffee", "Pizza", "Beer" |
| `isDefaultQuickAccess` | Categoría seleccionada al abrir POS | true |

**Jerarquía:**

```typescript
// Categoría raíz
{
  id: "cat-001",
  name: "Bebidas",
  parentId: null,
  level: 0
}

// Subcategoría
{
  id: "cat-002",
  name: "Gaseosas",
  parentId: "cat-001",
  level: 1
}

// Sub-subcategoría
{
  id: "cat-003",
  name: "Coca Cola",
  parentId: "cat-002",
  level: 2
}
```

**Query de Categorías con Hijos:**

```typescript
const categories = await prisma.category.findMany({
  where: { tenantId, parentId: null },
  include: {
    children: {
      include: {
        children: true // Hasta 3 niveles
      }
    }
  },
  orderBy: { sortOrder: 'asc' }
});
```

**Accesos Rápidos para POS:**

```typescript
const quickAccess = await prisma.category.findMany({
  where: {
    tenantId,
    isQuickAccess: true,
    isActive: true
  },
  orderBy: { quickAccessOrder: 'asc' },
  select: {
    id: true,
    name: true,
    quickAccessColor: true,
    quickAccessIcon: true,
    isDefaultQuickAccess: true
  }
});
```

---

## Marcas

### Brand
Marcas de productos (sincronizadas desde Cianbox).

```prisma
model Brand {
  id             String    @id @default(cuid())
  tenantId       String
  cianboxBrandId Int?      // ID en Cianbox
  name           String
  description    String?
  logoUrl        String?
  isActive       Boolean   @default(true)
  lastSyncedAt   DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products Product[]

  @@unique([tenantId, cianboxBrandId])
}
```

---

## Listas de Precios

### PriceList
Listas de precios (Minorista, Mayorista, etc.).

```prisma
model PriceList {
  id                 String    @id @default(cuid())
  tenantId           String
  cianboxPriceListId Int?      // ID en Cianbox
  name               String    // "Lista Minorista", "Lista Mayorista"
  description        String?
  currency           String    @default("ARS")
  isDefault          Boolean   @default(false)
  isActive           Boolean   @default(true)
  lastSyncedAt       DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  tenant       Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  prices       ProductPrice[]
  pointsOfSale PointOfSale[]
  customers    Customer[]
  saleItems    SaleItem[]

  @@unique([tenantId, cianboxPriceListId])
}
```

**Uso:**
- Cada `PointOfSale` puede tener una `PriceList` por defecto
- Cada `Customer` puede tener una `PriceList` asignada
- Si un cliente tiene lista asignada, se usa esa; sino, se usa la del POS

---

## Productos

### Product
Productos del catálogo (incluye soporte para productos variables con curva de talles).

```prisma
model Product {
  id               String    @id @default(cuid())
  tenantId         String
  cianboxProductId Int?      // ID en Cianbox (null si producto local)

  // Códigos
  sku              String?   // Código interno / SKU
  barcode          String?   // Código de barras (EAN/UPC)
  internalCode     String?

  // Información básica
  name             String
  shortName        String?   // Nombre corto para ticket
  description      String?

  // Clasificación
  categoryId       String?
  brandId          String?

  // Precios (precio base)
  basePrice        Decimal?  @db.Decimal(12, 2)
  baseCost         Decimal?  @db.Decimal(12, 2)

  // Impuestos
  taxRate          Decimal   @default(21) @db.Decimal(5, 2) // IVA 21%
  taxIncluded      Boolean   @default(true)

  // Control de Stock
  trackStock       Boolean   @default(true)
  allowNegativeStock Boolean @default(false)
  minStock         Int?

  // Configuración de venta
  sellFractions    Boolean   @default(false)
  unitOfMeasure    String    @default("UN") // UN, KG, LT, MT

  // Imágenes
  imageUrl         String?
  thumbnailUrl     String?

  // Estado
  isActive         Boolean   @default(true)
  isService        Boolean   @default(false)

  // Ubicación (para picking)
  location         String?   // "R1-F2-C3"

  // === PRODUCTOS VARIABLES (Curva de Talles) ===
  isParent         Boolean   @default(false)  // true = producto padre con variantes
  isVirtualParent  Boolean   @default(false)  // true = padre virtual (creado por sync)
  parentProductId  String?                    // ID del producto padre (null si es padre o simple)
  size             String?                    // Talle: "38", "40", "L", "XL"
  color            String?                    // Color: "Negro", "Blanco", "Beige"

  // Sincronización
  lastSyncedAt     DateTime?
  cianboxData      Json?

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  tenant           Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category         Category?        @relation(fields: [categoryId], references: [id])
  brand            Brand?           @relation(fields: [brandId], references: [id])
  parentProduct    Product?         @relation("ProductVariants", fields: [parentProductId], references: [id])
  variants         Product[]        @relation("ProductVariants")
  prices           ProductPrice[]
  stock            ProductStock[]
  saleItems        SaleItem[]
  promotionProducts PromotionProduct[]

  @@unique([tenantId, cianboxProductId])
  @@index([tenantId, barcode])
  @@index([tenantId, categoryId])
  @@index([tenantId, brandId])
  @@index([tenantId, name])
  @@index([tenantId, parentProductId])
  @@index([tenantId, isParent])
}
```

**Campos de Productos Variables:**

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `isParent` | Si es producto padre con variantes | true |
| `isVirtualParent` | Si es padre virtual creado por sync | false |
| `parentProductId` | ID del producto padre | "clxx..." |
| `size` | Talle de la variante | "38", "40", "L" |
| `color` | Color de la variante | "Negro", "Beige" |

**Ver también:** [PRODUCTOS-VARIABLES.md](./PRODUCTOS-VARIABLES.md) para documentación completa del sistema de curva de talles.

**Campos Importantes:**

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `sku` | Código interno del producto | "PROD-001" |
| `barcode` | Código de barras EAN/UPC | "7790001234567" |
| `shortName` | Nombre corto para ticket | "Coca 500ml" |
| `taxRate` | Porcentaje de IVA | 21 (21%) |
| `taxIncluded` | Si el precio incluye IVA | true |
| `sellFractions` | Permite vender fracciones (ej: 0.5 KG) | false |
| `unitOfMeasure` | Unidad de medida | "UN", "KG", "LT" |
| `trackStock` | Si controla stock | true |
| `allowNegativeStock` | Permitir stock negativo | false |

**Búsqueda de Productos:**

```typescript
// Buscar por código de barras
const product = await prisma.product.findFirst({
  where: {
    tenantId,
    barcode,
    isActive: true
  },
  include: {
    category: true,
    brand: true,
    prices: {
      where: { priceListId },
      take: 1
    }
  }
});

// Buscar por nombre o SKU
const products = await prisma.product.findMany({
  where: {
    tenantId,
    isActive: true,
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } }
    ]
  },
  take: 20
});
```

### ProductPrice
Precios por Lista de Precios.

```prisma
model ProductPrice {
  id          String   @id @default(cuid())
  productId   String
  priceListId String
  price       Decimal  @db.Decimal(12, 2) // Precio CON IVA
  priceNet    Decimal? @db.Decimal(12, 2) // Precio SIN IVA
  cost        Decimal? @db.Decimal(12, 2)
  margin      Decimal? @db.Decimal(5, 2)  // Margen en %
  validFrom   DateTime @default(now())
  validUntil  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  priceList PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)

  @@unique([productId, priceListId])
  @@index([priceListId])
}
```

**Cálculo de Precio Neto:**

```typescript
// Precio CON IVA a precio SIN IVA
function calculatePriceNet(priceWithTax: number, taxRate: number): number {
  return priceWithTax / (1 + taxRate / 100);
}

// Ejemplo: Precio $121 con IVA 21%
const priceNet = calculatePriceNet(121, 21); // = 100
```

**Obtener Precio para Venta:**

```typescript
async function getProductPrice(
  productId: string,
  priceListId: string
): Promise<number> {
  const productPrice = await prisma.productPrice.findUnique({
    where: {
      productId_priceListId: { productId, priceListId }
    }
  });

  if (productPrice) {
    return Number(productPrice.price);
  }

  // Fallback: precio base del producto
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { basePrice: true }
  });

  return Number(product?.basePrice || 0);
}
```

---

## Stock

### ProductStock
Stock por Sucursal.

```prisma
model ProductStock {
  id           String   @id @default(cuid())
  productId    String
  branchId     String
  quantity     Decimal  @db.Decimal(12, 3) // Permite decimales
  reserved     Decimal  @default(0) @db.Decimal(12, 3)
  available    Decimal  @db.Decimal(12, 3) // quantity - reserved
  minStock     Int?     // Override del mínimo
  maxStock     Int?
  location     String?  // Ubicación en sucursal
  lastCountAt  DateTime?
  updatedAt    DateTime @updatedAt

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  branch  Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([productId, branchId])
  @@index([branchId])
}
```

**Operaciones de Stock:**

```typescript
// Descontar stock al vender
await prisma.productStock.updateMany({
  where: {
    productId,
    branchId
  },
  data: {
    quantity: { decrement: soldQuantity },
    available: { decrement: soldQuantity }
  }
});

// Restaurar stock al anular venta
await prisma.productStock.updateMany({
  where: {
    productId,
    branchId
  },
  data: {
    quantity: { increment: cancelledQuantity },
    available: { increment: cancelledQuantity }
  }
});

// Verificar stock disponible
const stock = await prisma.productStock.findUnique({
  where: {
    productId_branchId: { productId, branchId }
  },
  select: { available: true }
});

if (Number(stock?.available || 0) < requestedQuantity) {
  throw new Error('Stock insuficiente');
}
```

**Productos con Stock Bajo:**

```typescript
const lowStock = await prisma.productStock.findMany({
  where: {
    product: {
      tenantId,
      trackStock: true,
      isActive: true
    },
    branchId,
    available: {
      lte: prisma.raw('minStock')
    }
  },
  include: {
    product: {
      select: {
        id: true,
        name: true,
        sku: true
      }
    }
  }
});
```

---

## Clientes

### Customer
Clientes del sistema.

```prisma
model Customer {
  id                 String       @id @default(cuid())
  tenantId           String
  cianboxCustomerId  Int?

  // Tipo
  customerType       CustomerType @default(CONSUMER)

  // Datos fiscales
  taxId              String?   // CUIT/CUIL/DNI
  taxIdType          String?
  taxCategory        String?   // Responsable Inscripto, Monotributista

  // Datos personales/empresa
  name               String
  tradeName          String?   // Nombre de fantasía
  firstName          String?
  lastName           String?

  // Contacto
  email              String?
  phone              String?
  mobile             String?

  // Dirección
  address            String?
  city               String?
  state              String?
  zipCode            String?
  country            String    @default("AR")

  // Comercial
  priceListId        String?
  creditLimit        Decimal?  @db.Decimal(12, 2)
  creditBalance      Decimal   @default(0) @db.Decimal(12, 2)
  paymentTermDays    Int       @default(0)
  globalDiscount     Decimal   @default(0) @db.Decimal(5, 2)

  // Estado
  isActive           Boolean   @default(true)
  notes              String?

  // Sincronización
  lastSyncedAt       DateTime?
  cianboxData        Json?

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  tenant    Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  priceList PriceList? @relation(fields: [priceListId], references: [id])
  sales     Sale[]

  @@unique([tenantId, cianboxCustomerId])
  @@index([tenantId, taxId])
  @@index([tenantId, name])
  @@index([tenantId, email])
}

enum CustomerType {
  CONSUMER      // Consumidor final
  INDIVIDUAL    // Persona física
  BUSINESS      // Empresa
  GOVERNMENT    // Gobierno
  RESELLER      // Revendedor
}
```

**Búsqueda de Clientes:**

```typescript
// Por CUIT/DNI
const customer = await prisma.customer.findFirst({
  where: {
    tenantId,
    taxId,
    isActive: true
  }
});

// Por nombre
const customers = await prisma.customer.findMany({
  where: {
    tenantId,
    isActive: true,
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { tradeName: { contains: search, mode: 'insensitive' } }
    ]
  },
  take: 20
});
```

**Cliente con Cuenta Corriente:**

```typescript
// Verificar límite de crédito
const customer = await prisma.customer.findUnique({
  where: { id: customerId },
  select: {
    creditLimit: true,
    creditBalance: true
  }
});

const availableCredit = Number(customer.creditLimit || 0) - Number(customer.creditBalance);

if (saleTotal > availableCredit) {
  throw new Error('Límite de crédito excedido');
}

// Aumentar saldo al vender a crédito
await prisma.customer.update({
  where: { id: customerId },
  data: {
    creditBalance: {
      increment: saleTotal
    }
  }
});
```

---

## Sincronización con Cianbox

### Flujo de Sincronización

**1. Sincronizar Categorías:**

```typescript
async function syncCategories(tenantId: string) {
  const token = await getCianboxToken(tenantId);
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId }
  });

  const response = await fetch(`${connection.cuenta}/productos/categorias`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const categories = await response.json();

  for (const cat of categories) {
    await prisma.category.upsert({
      where: {
        tenantId_cianboxCategoryId: {
          tenantId,
          cianboxCategoryId: cat.id
        }
      },
      update: {
        name: cat.nombre,
        description: cat.descripcion,
        lastSyncedAt: new Date()
      },
      create: {
        tenantId,
        cianboxCategoryId: cat.id,
        name: cat.nombre,
        description: cat.descripcion,
        lastSyncedAt: new Date()
      }
    });
  }
}
```

**2. Sincronizar Productos:**

```typescript
async function syncProducts(tenantId: string) {
  const token = await getCianboxToken(tenantId);
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId }
  });

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${connection.cuenta}/productos/lista?page=${page}&pageSize=${connection.syncPageSize}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    const { productos, totalPaginas } = await response.json();

    for (const prod of productos) {
      await prisma.product.upsert({
        where: {
          tenantId_cianboxProductId: {
            tenantId,
            cianboxProductId: prod.id
          }
        },
        update: {
          name: prod.nombre,
          sku: prod.codigo,
          barcode: prod.codigoBarras,
          basePrice: prod.precio,
          baseCost: prod.costo,
          taxRate: prod.iva || 21,
          lastSyncedAt: new Date(),
          cianboxData: prod
        },
        create: {
          tenantId,
          cianboxProductId: prod.id,
          name: prod.nombre,
          sku: prod.codigo,
          barcode: prod.codigoBarras,
          basePrice: prod.precio,
          baseCost: prod.costo,
          taxRate: prod.iva || 21,
          lastSyncedAt: new Date(),
          cianboxData: prod
        }
      });
    }

    hasMore = page < totalPaginas;
    page++;
  }
}
```

---

**Ver también:**
- [DATABASE-CORE.md](./DATABASE-CORE.md) - Modelos fundamentales
- [DATABASE-SALES.md](./DATABASE-SALES.md) - Ventas y pagos
- [API-PRODUCTS.md](./API-PRODUCTS.md) - Endpoints de productos
