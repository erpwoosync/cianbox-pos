# Documentación de Base de Datos - Cianbox POS

**Sistema:** Cianbox POS - Point of Sale Multi-tenant
**Base de Datos:** PostgreSQL 15+
**ORM:** Prisma 5.x
**Última Actualización:** 2025-12-14

---

## Historial de Versiones

| Versión | Fecha | Descripción | Migración |
|---------|-------|-------------|-----------|
| 1.0.0 | 2025-12-14 | Schema inicial completo | `20251214_init` |
| 1.1.0 | 2025-12-14 | Soporte sharding multi-DB | `20251214_add_database_servers` |

---

## Arquitectura Multi-tenant con Sharding

El sistema implementa aislamiento de datos a nivel de fila (Row Level Security) mediante el campo `tenantId` presente en todas las tablas de negocio.

**Soporte para múltiples servidores de base de datos (sharding horizontal):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NIVEL AGENCIA (Master DB)                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  AgencyUser     │  │  AgencySettings  │  │     DatabaseServer          │ │
│  │  (Super Admins) │  │  (Config Global) │  │  (Servidores de DB)         │ │
│  └─────────────────┘  └──────────────────┘  │  - DB Principal (default)   │ │
│                                             │  - DB Región Sur            │ │
│                                             │  - DB Región Norte          │ │
│                                             └─────────────────────────────┘ │
│                                                            │                │
│  ┌─────────────────────────────────────────────────────────┴──────────────┐ │
│  │  Tenants (metadata) - Cada tenant apunta a un DatabaseServer           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   DB Principal        │ │   DB Región Sur       │ │   DB Región Norte     │
│   (default)           │ │                       │ │                       │
│ ┌───────────────────┐ │ │ ┌───────────────────┐ │ │ ┌───────────────────┐ │
│ │ Tenant A          │ │ │ │ Tenant C          │ │ │ │ Tenant E          │ │
│ │ Tenant B          │ │ │ │ Tenant D          │ │ │ │ Tenant F          │ │
│ └───────────────────┘ │ │ └───────────────────┘ │ │ └───────────────────┘ │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

**Flujo de conexión:**
1. Usuario hace login con `tenantSlug`
2. Sistema busca el tenant en Master DB
3. Sistema obtiene el `DatabaseServer` asignado al tenant
4. Sistema crea/reutiliza conexión al servidor correspondiente
5. Todas las queries del tenant van a su servidor asignado

---

## Diagrama Entidad-Relación (Simplificado)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           GESTIÓN DE IDENTIDAD                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────────┐              │
│  │   Tenant    │──────│    User     │──────│      Role       │              │
│  │             │      │             │      │                 │              │
│  │ - name      │      │ - email     │      │ - name          │              │
│  │ - slug      │      │ - password  │      │ - permissions[] │              │
│  │ - plan      │      │ - pin       │      └─────────────────┘              │
│  └─────────────┘      └─────────────┘                                       │
│         │                    │                                              │
│         │                    └──────────────┐                               │
│         ▼                                   ▼                               │
│  ┌─────────────────┐              ┌─────────────────┐                       │
│  │CianboxConnection│              │   UserSession   │                       │
│  │                 │              │                 │                       │
│  │ - cuenta        │              │ - loginAt       │                       │
│  │ - accessToken   │              │ - logoutAt      │                       │
│  └─────────────────┘              └─────────────────┘                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           ESTRUCTURA OPERATIVA                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐          │
│  │   Branch    │──────│   PointOfSale   │──────│   PrintPoint    │          │
│  │  (Sucursal) │      │     (Caja)      │      │   (Impresión)   │          │
│  │             │      │                 │      │                 │          │
│  │ - code      │      │ - code          │      │ - name          │          │
│  │ - name      │      │ - priceListId   │      └────────┬────────┘          │
│  │ - address   │      └─────────────────┘               │                   │
│  └─────────────┘                                        │                   │
│         │                                               ▼                   │
│         │                                      ┌─────────────────┐          │
│         │                                      │    Printer      │          │
│         │                                      │                 │          │
│         │                                      │ - type          │          │
│         ▼                                      │ - connection    │          │
│  ┌─────────────────┐                           └─────────────────┘          │
│  │  ProductStock   │                                                        │
│  │ (Stock x Suc.)  │                                                        │
│  └─────────────────┘                                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              CATÁLOGO                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────────┐              │
│  │  Category   │      │    Brand    │      │   PriceList     │              │
│  │             │──┐   │             │      │                 │              │
│  │ - name      │  │   │ - name      │      │ - name          │              │
│  │ - parentId  │  │   │ - logoUrl   │      │ - currency      │              │
│  └─────────────┘  │   └─────────────┘      └────────┬────────┘              │
│         │         │         │                       │                       │
│         │         │         │                       │                       │
│         │         └────┐    │                       │                       │
│         │              │    │                       │                       │
│         ▼              ▼    ▼                       ▼                       │
│  ┌─────────────────────────────────┐      ┌─────────────────┐              │
│  │           Product               │──────│  ProductPrice   │              │
│  │                                 │      │ (Precio x Lista)│              │
│  │ - sku, barcode                  │      │                 │              │
│  │ - name                          │      │ - price         │              │
│  │ - basePrice, baseCost           │      │ - cost          │              │
│  │ - taxRate                       │      └─────────────────┘              │
│  │ - trackStock                    │                                       │
│  └─────────────────────────────────┘                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                            PROMOCIONES                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────┐      ┌─────────────────────────────┐   │
│  │          Promotion              │      │          Combo              │   │
│  │                                 │      │                             │   │
│  │ - type (PERCENTAGE, BUY_X...)   │      │ - name                      │   │
│  │ - discountValue                 │      │ - regularPrice              │   │
│  │ - buyQuantity, getQuantity      │      │ - comboPrice                │   │
│  │ - startDate, endDate            │      └──────────────┬──────────────┘   │
│  │ - daysOfWeek[]                  │                     │                  │
│  └──────────────┬──────────────────┘                     │                  │
│                 │                                        │                  │
│                 ▼                                        ▼                  │
│  ┌──────────────────────────┐              ┌──────────────────────────┐     │
│  │    PromotionProduct      │              │       ComboItem          │     │
│  │  (Productos aplicables)  │              │  (Productos del combo)   │     │
│  └──────────────────────────┘              └──────────────────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              VENTAS                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐      ┌─────────────────────────────────────┐               │
│  │  Customer   │──────│              Sale                   │               │
│  │             │      │                                     │               │
│  │ - name      │      │ - saleNumber                        │               │
│  │ - taxId     │      │ - subtotal, discount, tax, total    │               │
│  │ - priceList │      │ - status (COMPLETED, CANCELLED...)  │               │
│  └─────────────┘      └──────────────┬──────────────────────┘               │
│                                      │                                       │
│                       ┌──────────────┼──────────────┐                       │
│                       │              │              │                       │
│                       ▼              ▼              ▼                       │
│              ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│              │  SaleItem   │  │   Payment   │  │CashRegister │              │
│              │             │  │             │  │   (Arqueo)  │              │
│              │ - quantity  │  │ - method    │  │             │              │
│              │ - unitPrice │  │ - amount    │  │ - openAmt   │              │
│              │ - discount  │  │ - reference │  │ - closeAmt  │              │
│              │ - promotion │  │ - cardBrand │  └─────────────┘              │
│              └─────────────┘  └─────────────┘                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Descripción de Entidades

### Nivel Agencia (Super Admins)

#### `database_servers` (Sharding)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| name | String | Nombre único ("DB Principal") |
| host | String | Host del servidor |
| port | Int | Puerto (default: 5432) |
| database | String | Nombre de la base de datos |
| username | String | Usuario de conexión |
| password | String | Contraseña (encriptada) |
| sslEnabled | Boolean | SSL habilitado |
| maxConnections | Int | Máximo de conexiones |
| isDefault | Boolean | Servidor por defecto para nuevos tenants |
| isActive | Boolean | Activo |
| region | String? | Región geográfica |
| description | String? | Descripción |
| lastHealthCheck | DateTime? | Último health check |
| healthStatus | Enum | HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN |
| tenantCount | Int | Cantidad de tenants asignados |

**API de gestión:** `POST /api/agency/database-servers`

#### `agency_users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| email | String | Email único |
| passwordHash | String | Contraseña hasheada |
| name | String | Nombre completo |
| avatar | String? | URL del avatar |
| status | Enum | ACTIVE, DISABLED |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Última actualización |

#### `agency_settings`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | Siempre "default" |
| appName | String | Nombre de la aplicación |
| logo | String? | Logo de la agencia |

---

### Nivel Tenant (Multi-tenant)

#### `tenants`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| name | String | Razón social |
| slug | String | Slug único (login) |
| taxId | String? | CUIT/RUT/NIF |
| logo | String? | Logo del tenant |
| plan | Enum | FREE, PRO, ENTERPRISE |
| status | Enum | TRIAL, ACTIVE, SUSPENDED, CANCELLED |
| settings | Json | Configuración flexible |

---

### Usuarios y Permisos

#### `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| email | String | Email (único por tenant) |
| passwordHash | String | Contraseña hasheada |
| name | String | Nombre completo |
| pin | String? | PIN para operaciones rápidas |
| status | Enum | ACTIVE, INVITED, DISABLED |
| roleId | String | FK a rol |
| branchId | String? | Sucursal asignada |

**Índices:** `@@unique([tenantId, email])`

#### `roles`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| name | String | Nombre del rol |
| description | String? | Descripción |
| isSystem | Boolean | Si es rol de sistema |
| permissions | String[] | Array de permisos |

**Permisos disponibles:**
- `pos:sell` - Vender
- `pos:discount` - Aplicar descuentos
- `pos:cancel` - Anular ventas
- `inventory:view` - Ver inventario
- `inventory:edit` - Editar stock
- `reports:view` - Ver reportes
- `settings:edit` - Editar configuración
- `users:manage` - Gestionar usuarios

#### `user_sessions`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| userId | String | FK a usuario |
| pointOfSaleId | String? | FK a punto de venta |
| deviceInfo | String? | Info del dispositivo |
| ipAddress | String? | IP de conexión |
| status | Enum | ACTIVE, CLOSED, EXPIRED, FORCED_CLOSE |
| loginAt | DateTime | Fecha/hora de login |
| logoutAt | DateTime? | Fecha/hora de logout |

---

### Conexión Cianbox

#### `cianbox_connections`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant (único) |
| cuenta | String | Nombre de cuenta Cianbox |
| appName | String | Nombre de aplicación |
| appCode | String | Código de aplicación |
| user | String | Usuario Cianbox |
| password | String | Contraseña (encriptada) |
| accessToken | String? | Token actual |
| refreshToken | String? | Token de refresco |
| tokenExpiresAt | DateTime? | Expiración del token |
| syncPageSize | Int | Productos por página (max 200) |
| lastSync | DateTime? | Última sincronización |
| webhookUrl | String? | URL para webhooks |

---

### Estructura Operativa

#### `branches` (Sucursales)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| cianboxBranchId | Int? | ID en Cianbox |
| code | String | Código único |
| name | String | Nombre |
| address | String? | Dirección |
| city | String? | Ciudad |
| state | String? | Provincia/Estado |
| isDefault | Boolean | Sucursal por defecto |
| isActive | Boolean | Activa |
| lastSyncedAt | DateTime? | Última sincronización |

**Índices:** `@@unique([tenantId, code])`, `@@unique([tenantId, cianboxBranchId])`

#### `points_of_sale` (Cajas)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| branchId | String | FK a sucursal |
| code | String | Código (ej: "CAJA-01") |
| name | String | Nombre |
| priceListId | String? | Lista de precios por defecto |
| printPointId | String? | Punto de impresión |
| isActive | Boolean | Activo |
| settings | Json | Configuración específica |

**Índices:** `@@unique([tenantId, branchId, code])`

---

### Catálogo

#### `categories`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| cianboxCategoryId | Int? | ID en Cianbox |
| code | String? | Código interno |
| name | String | Nombre |
| parentId | String? | FK a categoría padre |
| level | Int | Nivel en jerarquía |
| sortOrder | Int | Orden de visualización |
| imageUrl | String? | Imagen |

**Índices:** `@@unique([tenantId, cianboxCategoryId])`, `@@index([tenantId, parentId])`

#### `brands`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| cianboxBrandId | Int? | ID en Cianbox |
| name | String | Nombre |
| logoUrl | String? | Logo |

#### `price_lists`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| cianboxPriceListId | Int? | ID en Cianbox |
| name | String | Nombre |
| currency | String | Moneda (ARS, USD) |
| isDefault | Boolean | Lista por defecto |

---

### Productos

#### `products`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| cianboxProductId | Int? | ID en Cianbox |
| sku | String? | Código SKU |
| barcode | String? | Código de barras |
| internalCode | String? | Código adicional |
| name | String | Nombre |
| shortName | String? | Nombre corto (ticket) |
| description | String? | Descripción |
| categoryId | String? | FK a categoría |
| brandId | String? | FK a marca |
| basePrice | Decimal? | Precio base |
| baseCost | Decimal? | Costo base |
| taxRate | Decimal | Tasa IVA (21%) |
| taxIncluded | Boolean | Precio incluye impuestos |
| trackStock | Boolean | Controla stock |
| allowNegativeStock | Boolean | Permite stock negativo |
| minStock | Int? | Stock mínimo |
| sellFractions | Boolean | Vende fracciones |
| unitOfMeasure | String | Unidad (UN, KG, LT) |
| imageUrl | String? | Imagen |
| isActive | Boolean | Activo |
| isService | Boolean | Es servicio |
| location | String? | Ubicación física |
| cianboxData | Json? | Datos raw de Cianbox |

**Índices:**
- `@@unique([tenantId, sku])`
- `@@unique([tenantId, cianboxProductId])`
- `@@index([tenantId, barcode])`
- `@@index([tenantId, categoryId])`
- `@@index([tenantId, brandId])`
- `@@index([tenantId, name])`

#### `product_prices` (Precios por Lista)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| productId | String | FK a producto |
| priceListId | String | FK a lista de precios |
| price | Decimal | Precio |
| cost | Decimal? | Costo |
| margin | Decimal? | Margen % |
| validFrom | DateTime | Válido desde |
| validUntil | DateTime? | Válido hasta |

**Índices:** `@@unique([productId, priceListId])`

#### `product_stock` (Stock por Sucursal)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| productId | String | FK a producto |
| branchId | String | FK a sucursal |
| quantity | Decimal | Cantidad |
| reserved | Decimal | Stock reservado |
| available | Decimal | Stock disponible |
| minStock | Int? | Mínimo (override) |
| maxStock | Int? | Máximo |
| location | String? | Ubicación específica |
| lastCountAt | DateTime? | Último inventario |

**Índices:** `@@unique([productId, branchId])`

---

### Clientes

#### `customers`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| cianboxCustomerId | Int? | ID en Cianbox |
| customerType | Enum | CONSUMER, INDIVIDUAL, BUSINESS, GOVERNMENT, RESELLER |
| taxId | String? | CUIT/CUIL/DNI |
| taxIdType | String? | Tipo documento |
| taxCategory | String? | Categoría fiscal |
| name | String | Razón social/Nombre |
| tradeName | String? | Nombre fantasía |
| firstName | String? | Nombre |
| lastName | String? | Apellido |
| email | String? | Email |
| phone | String? | Teléfono |
| mobile | String? | Celular |
| address | String? | Dirección |
| city | String? | Ciudad |
| state | String? | Provincia |
| zipCode | String? | Código postal |
| country | String | País (AR por defecto) |
| priceListId | String? | Lista de precios |
| creditLimit | Decimal? | Límite de crédito |
| creditBalance | Decimal | Saldo actual |
| paymentTermDays | Int | Días de crédito |
| globalDiscount | Decimal | Descuento general % |

**Índices:**
- `@@unique([tenantId, cianboxCustomerId])`
- `@@unique([tenantId, taxId])`
- `@@index([tenantId, name])`
- `@@index([tenantId, email])`

---

### Promociones

#### `promotions`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| code | String? | Código (cupones) |
| name | String | Nombre |
| type | Enum | PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, SECOND_UNIT_DISCOUNT, BUNDLE_PRICE, FREE_SHIPPING, COUPON, FLASH_SALE, LOYALTY |
| discountType | Enum | PERCENTAGE, FIXED_AMOUNT, FIXED_PRICE |
| discountValue | Decimal | Valor del descuento |
| buyQuantity | Int? | Comprar X unidades |
| getQuantity | Int? | Llevar Y unidades |
| minPurchase | Decimal? | Compra mínima |
| maxDiscount | Decimal? | Descuento máximo |
| applyTo | Enum | ALL_PRODUCTS, SPECIFIC_PRODUCTS, CATEGORIES, BRANDS, CART_TOTAL |
| categoryIds | String[] | Categorías aplicables |
| brandIds | String[] | Marcas aplicables |
| startDate | DateTime? | Fecha inicio |
| endDate | DateTime? | Fecha fin |
| daysOfWeek | Int[] | Días (0=Dom, 1=Lun...) |
| startTime | String? | Hora inicio |
| endTime | String? | Hora fin |
| maxUses | Int? | Usos máximos |
| maxUsesPerCustomer | Int? | Usos por cliente |
| currentUses | Int | Usos actuales |
| isActive | Boolean | Activa |
| priority | Int | Prioridad |
| stackable | Boolean | Acumulable |
| metadata | Json | Metadatos (BlackFriday, etc) |

#### `combos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| code | String | Código único |
| name | String | Nombre |
| regularPrice | Decimal | Suma precios individuales |
| comboPrice | Decimal | Precio del combo |
| startDate | DateTime? | Fecha inicio |
| endDate | DateTime? | Fecha fin |
| isActive | Boolean | Activo |

---

### Ventas

#### `sales`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| branchId | String | FK a sucursal |
| pointOfSaleId | String | FK a caja |
| userId | String | FK a cajero |
| customerId | String? | FK a cliente |
| saleNumber | String | Número (A-0001-00000001) |
| receiptType | Enum | TICKET, INVOICE_A, INVOICE_B, INVOICE_C, CREDIT_NOTE_A, CREDIT_NOTE_B, CREDIT_NOTE_C, RECEIPT |
| fiscalNumber | String? | Número fiscal (CAE) |
| subtotal | Decimal | Subtotal |
| discount | Decimal | Descuento |
| tax | Decimal | Impuestos |
| total | Decimal | Total |
| status | Enum | PENDING, COMPLETED, CANCELLED, REFUNDED, PARTIAL_REFUND |
| cianboxSaleId | Int? | ID en Cianbox |
| saleDate | DateTime | Fecha de venta |
| cancelledAt | DateTime? | Fecha anulación |
| cancelledBy | String? | Usuario que anuló |
| cancelReason | String? | Motivo anulación |

**Índices:**
- `@@unique([tenantId, saleNumber])`
- `@@index([tenantId, saleDate])`
- `@@index([tenantId, branchId, saleDate])`
- `@@index([tenantId, customerId])`
- `@@index([tenantId, status])`

#### `sale_items`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| saleId | String | FK a venta |
| productId | String? | FK a producto |
| comboId | String? | FK a combo |
| productCode | String? | Código (desnormalizado) |
| productName | String | Nombre (desnormalizado) |
| productBarcode | String? | Barcode (desnormalizado) |
| quantity | Decimal | Cantidad |
| unitPrice | Decimal | Precio unitario |
| discount | Decimal | Descuento |
| subtotal | Decimal | Subtotal |
| taxRate | Decimal | Tasa IVA |
| taxAmount | Decimal | Monto IVA |
| promotionId | String? | FK a promoción |
| promotionName | String? | Nombre promoción |
| isReturn | Boolean | Es devolución |

---

### Pagos

#### `payments`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| saleId | String | FK a venta |
| method | Enum | CASH, CREDIT_CARD, DEBIT_CARD, QR, TRANSFER, CHECK, CREDIT, VOUCHER, GIFTCARD, POINTS, OTHER |
| amount | Decimal | Monto |
| reference | String? | Nro. operación |
| cardBrand | String? | VISA, MASTERCARD |
| cardLastFour | String? | Últimos 4 dígitos |
| installments | Int | Cuotas |
| amountTendered | Decimal? | Monto recibido |
| changeAmount | Decimal? | Vuelto |
| transactionId | String? | ID transacción externa |
| providerData | Json? | Datos proveedor |
| status | Enum | PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED |

---

### Caja / Arqueo

#### `cash_registers`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| branchId | String | FK a sucursal |
| pointOfSaleId | String | FK a caja |
| userId | String | FK a usuario |
| openingAmount | Decimal | Fondo inicial |
| closingAmount | Decimal? | Monto cierre |
| expectedAmount | Decimal? | Monto esperado |
| difference | Decimal? | Diferencia |
| totalCash | Decimal | Total efectivo |
| totalCard | Decimal | Total tarjetas |
| totalOther | Decimal | Total otros |
| status | Enum | OPEN, CLOSED, SUSPENDED |
| openedAt | DateTime | Fecha apertura |
| closedAt | DateTime? | Fecha cierre |

#### `cash_movements`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| cashRegisterId | String | FK a arqueo |
| type | Enum | INCOME, EXPENSE, ADJUSTMENT |
| amount | Decimal | Monto |
| reason | String | Motivo |
| reference | String? | Referencia |

---

### Impresoras

#### `printers`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| name | String | Nombre único |
| type | Enum | THERMAL, LASER, INKJET, LABEL, FISCAL |
| connectionType | Enum | USB, NETWORK, BLUETOOTH, SERIAL, CLOUD |
| ipAddress | String? | IP (red) |
| port | Int? | Puerto |
| usbPath | String? | Path USB |
| bluetoothAddress | String? | MAC Bluetooth |
| paperWidth | Int | Ancho papel (58, 80mm) |
| characterSet | String | Set caracteres |
| isActive | Boolean | Activa |
| isDefault | Boolean | Por defecto |

#### `print_points`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| name | String | Nombre único |
| description | String? | Descripción |
| isActive | Boolean | Activo |

#### `print_point_printers` (Relación N:M)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| printPointId | String | FK a punto impresión |
| printerId | String | FK a impresora |
| printType | Enum | TICKET, INVOICE, KITCHEN, BAR, LABEL, REPORT |
| copies | Int | Cantidad de copias |

---

### Auditoría y Configuración

#### `audit_logs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| userId | String? | FK a usuario |
| action | String | CREATE, UPDATE, DELETE |
| entity | String | Nombre entidad |
| entityId | String | ID entidad |
| oldData | Json? | Datos anteriores |
| newData | Json? | Datos nuevos |
| ipAddress | String? | IP |
| userAgent | String? | User agent |

#### `system_configs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | cuid | Identificador único |
| tenantId | String | FK a tenant |
| key | String | Clave (único por tenant) |
| value | Text | Valor |
| type | String | Tipo (string, number, boolean, json) |

---

## Migraciones

### Convención de Nombres

```
YYYYMMDD_nombre_descriptivo
```

Ejemplos:
- `20251214_init` - Migración inicial
- `20251220_add_customer_loyalty` - Agregar campos de fidelización
- `20260115_change_product_price_precision` - Cambiar precisión de precios

### Comandos

```bash
# Crear migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones (desarrollo)
npx prisma migrate dev

# Aplicar migraciones (producción)
npx prisma migrate deploy

# Reset base de datos (desarrollo)
npx prisma migrate reset

# Ver estado de migraciones
npx prisma migrate status

# Generar cliente Prisma
npx prisma generate
```

### Flujo de Trabajo

1. **Desarrollo:**
   ```bash
   # Hacer cambios en schema.prisma
   npx prisma migrate dev --name descripcion_cambio
   # Esto crea la migración, la aplica y genera el cliente
   ```

2. **Producción:**
   ```bash
   # Aplicar migraciones pendientes
   npx prisma migrate deploy
   ```

---

## Consideraciones de Rendimiento

### Índices Recomendados

Ya incluidos en el schema:
- Todas las tablas con `tenantId` tienen índices compuestos
- Búsquedas frecuentes (barcode, email, name) están indexadas
- Fechas de venta optimizadas para reportes

### Particionamiento (Futuro)

Para alto volumen, considerar particionamiento por fecha en:
- `sales` - Por mes/año
- `audit_logs` - Por mes/año

### Caching

Usar Redis para:
- Tokens de Cianbox
- Productos frecuentes
- Listas de precios
- Sesiones de usuario

---

## Backup y Recuperación

### Backup Automático

```bash
# Backup diario
pg_dump -Fc cianbox_pos > backup_$(date +%Y%m%d).dump

# Restaurar
pg_restore -d cianbox_pos backup_20251214.dump
```

### Retención

- Backups diarios: 7 días
- Backups semanales: 4 semanas
- Backups mensuales: 12 meses

---

## Changelog de Migraciones

### v1.0.0 (2025-12-14) - `20251214_init`

**Tablas creadas:**
- `agency_users` - Usuarios de agencia (super admins)
- `agency_settings` - Configuración global
- `tenants` - Tenants/clientes
- `users` - Usuarios por tenant
- `roles` - Roles y permisos
- `user_sessions` - Sesiones de usuario
- `cianbox_connections` - Conexiones a Cianbox
- `branches` - Sucursales
- `points_of_sale` - Puntos de venta/cajas
- `categories` - Categorías de productos
- `brands` - Marcas
- `price_lists` - Listas de precios
- `products` - Productos
- `product_prices` - Precios por lista
- `product_stock` - Stock por sucursal
- `customers` - Clientes
- `promotions` - Promociones
- `promotion_products` - Productos en promoción
- `combos` - Combos/packs
- `combo_items` - Items de combos
- `sales` - Ventas
- `sale_items` - Detalle de ventas
- `payments` - Pagos
- `cash_registers` - Arqueos de caja
- `cash_movements` - Movimientos de caja
- `printers` - Impresoras
- `print_points` - Puntos de impresión
- `print_point_printers` - Relación impresoras-puntos
- `audit_logs` - Logs de auditoría
- `system_configs` - Configuración del sistema

**Enums creados:**
- `AgencyUserStatus`, `Plan`, `TenantStatus`
- `UserStatus`, `SessionStatus`
- `CustomerType`
- `PromotionType`, `DiscountType`, `PromotionApplyTo`
- `ReceiptType`, `SaleStatus`
- `PaymentMethod`, `PaymentStatus`
- `CashRegisterStatus`, `CashMovementType`
- `PrinterType`, `PrinterConnection`, `PrintType`
