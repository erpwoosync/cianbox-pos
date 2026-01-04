# Database Schema - Cianbox POS

Documentacion de la estructura de base de datos del sistema POS multi-tenant.

## Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NIVEL AGENCIA                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  DatabaseServer          AgencyUser              AgencySettings              │
│  (Servidores DB)         (Super Admins)          (Config global)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TENANT                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Tenant (Empresa/Cliente)                                             │    │
│  │   ├── CianboxConnection (1:1) - Conexion API Cianbox                │    │
│  │   ├── Users[] - Usuarios del tenant                                  │    │
│  │   ├── Roles[] - Roles y permisos                                     │    │
│  │   ├── Branches[] - Sucursales                                        │    │
│  │   ├── PointsOfSale[] - Cajas/Puntos de venta                        │    │
│  │   ├── Categories[] - Categorias de productos                         │    │
│  │   ├── Brands[] - Marcas                                              │    │
│  │   ├── PriceLists[] - Listas de precios                              │    │
│  │   ├── Products[] - Productos                                         │    │
│  │   ├── Customers[] - Clientes                                         │    │
│  │   ├── Promotions[] - Promociones                                     │    │
│  │   ├── Combos[] - Combos/Packs                                        │    │
│  │   ├── Sales[] - Ventas                                               │    │
│  │   ├── CashSessions[] - Turnos de caja                               │    │
│  │   ├── Printers[] - Impresoras                                        │    │
│  │   ├── PrintPoints[] - Puntos de impresion                           │    │
│  │   ├── MercadoPagoConfigs[] - Config MP Point/QR                     │    │
│  │   └── PosTerminals[] - Terminales POS (PCs)                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modelos por Categoria

### 1. Nivel Agencia (Super Admin)

#### DatabaseServer
Servidores de base de datos para sharding multi-tenant.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico (cuid) |
| name | String | Nombre unico del servidor |
| host | String | Host del servidor |
| port | Int | Puerto (default 5432) |
| database | String | Nombre de la base de datos |
| username | String | Usuario DB |
| password | String | Password (encriptado) |
| sslEnabled | Boolean | SSL habilitado |
| maxConnections | Int | Conexiones maximas |
| isDefault | Boolean | Servidor por defecto |
| isActive | Boolean | Estado activo |
| region | String? | Region geografica |
| healthStatus | Enum | HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN |
| tenantCount | Int | Cantidad de tenants |

#### AgencyUser
Usuarios super admin de la agencia.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| email | String | Email unico |
| passwordHash | String | Hash de password |
| name | String | Nombre |
| avatar | String? | URL avatar |
| status | Enum | ACTIVE, DISABLED |

#### AgencySettings
Configuracion global de la agencia.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | "default" |
| appName | String | Nombre de la app |
| logo | String? | URL del logo |

---

### 2. Tenant (Multi-tenant)

#### Tenant
Empresa/cliente del sistema.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico (cuid) |
| name | String | Nombre de la empresa |
| slug | String | Slug unico (usado en login) |
| taxId | String? | CUIT/RUT/NIF |
| logo | String? | URL logo |
| plan | Enum | FREE, PRO, ENTERPRISE |
| status | Enum | TRIAL, ACTIVE, SUSPENDED, CANCELLED |
| settings | Json | Configuracion flexible |
| databaseServerId | String? | Servidor DB asignado |

**Relaciones:**
- `users[]` - Usuarios
- `roles[]` - Roles
- `cianboxConnection` - Conexion Cianbox (1:1)
- `branches[]` - Sucursales
- `pointsOfSale[]` - Puntos de venta
- `categories[]` - Categorias
- `brands[]` - Marcas
- `priceLists[]` - Listas de precios
- `products[]` - Productos
- `customers[]` - Clientes
- `promotions[]` - Promociones
- `combos[]` - Combos
- `sales[]` - Ventas
- `cashSessions[]` - Turnos de caja
- `printers[]` - Impresoras
- `printPoints[]` - Puntos de impresion
- `mercadoPagoConfigs[]` - Config Mercado Pago
- `posTerminals[]` - Terminales POS

---

### 3. Usuarios, Roles y Permisos

#### User
Usuarios del tenant.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| email | String | Email (unico por tenant) |
| passwordHash | String | Hash password |
| name | String | Nombre |
| avatar | String? | URL avatar |
| pin | String? | PIN para POS |
| status | Enum | ACTIVE, INVITED, DISABLED |
| roleId | String | FK Role |
| branchId | String? | Sucursal asignada |

**Indices:** `@@unique([tenantId, email])`

#### Role
Roles y permisos.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| name | String | Nombre del rol |
| description | String? | Descripcion |
| isSystem | Boolean | Si es rol de sistema |
| permissions | String[] | Array de permisos |

**Indices:** `@@unique([tenantId, name])`

#### UserSession
Tracking de sesiones de usuario.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| userId | String | FK User |
| pointOfSaleId | String? | Punto de venta |
| deviceInfo | String? | Info del dispositivo |
| ipAddress | String? | IP |
| status | Enum | ACTIVE, CLOSED, EXPIRED, FORCED_CLOSE |
| loginAt | DateTime | Fecha login |
| logoutAt | DateTime? | Fecha logout |

---

### 4. Conexion Cianbox

#### CianboxConnection
Configuracion de conexion a API Cianbox por tenant.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant (unique) |
| cuenta | String | Nombre cuenta Cianbox |
| appName | String | Nombre app |
| appCode | String | Codigo app |
| user | String | Usuario |
| password | String | Password (encriptado) |
| accessToken | String? | Token actual |
| refreshToken | String? | Refresh token |
| tokenExpiresAt | DateTime? | Expiracion token |
| syncPageSize | Int | Paginas por sync (default 50) |
| isActive | Boolean | Estado activo |
| lastSync | DateTime? | Ultima sincronizacion |
| webhookUrl | String? | URL webhook |

---

### 5. Sucursales y Puntos de Venta

#### Branch
Sucursales (sincronizadas desde Cianbox).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| cianboxBranchId | Int? | ID en Cianbox |
| code | String | Codigo ("SUC-001") |
| name | String | Nombre |
| address | String? | Direccion |
| city | String? | Ciudad |
| state | String? | Provincia |
| zipCode | String? | Codigo postal |
| phone | String? | Telefono |
| email | String? | Email |
| isDefault | Boolean | Sucursal por defecto |
| isActive | Boolean | Estado activo |

**Indices:** `@@unique([tenantId, code])`, `@@unique([tenantId, cianboxBranchId])`

#### PointOfSale
Puntos de venta / Cajas.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| branchId | String | FK Branch |
| code | String | Codigo ("CAJA-01") |
| name | String | Nombre |
| description | String? | Descripcion |
| priceListId | String? | Lista de precios default |
| printPointId | String? | Punto impresion default |
| isActive | Boolean | Estado activo |
| settings | Json | Config especifica |
| mpDeviceId | String? | Device ID MP Point |
| mpDeviceName | String? | Nombre device MP |
| mpQrPosId | Int? | ID POS MP QR |
| mpQrExternalId | String? | External ID MP QR |

**Indices:** `@@unique([tenantId, branchId, code])`

---

### 6. Catalogo

#### Category
Categorias de productos (jerarquicas).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| cianboxCategoryId | Int? | ID en Cianbox |
| code | String? | Codigo interno |
| name | String | Nombre |
| description | String? | Descripcion |
| parentId | String? | Categoria padre |
| level | Int | Nivel jerarquia |
| sortOrder | Int | Orden |
| imageUrl | String? | URL imagen |
| isActive | Boolean | Estado activo |
| isQuickAccess | Boolean | Acceso rapido POS |
| quickAccessOrder | Int | Orden acceso rapido |
| quickAccessColor | String? | Color boton |
| quickAccessIcon | String? | Icono |
| isDefaultQuickAccess | Boolean | Default en POS |

**Relaciones:** Self-relation para jerarquia (`parent`, `children`)

#### Brand
Marcas de productos.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| cianboxBrandId | Int? | ID en Cianbox |
| name | String | Nombre |
| description | String? | Descripcion |
| logoUrl | String? | URL logo |
| isActive | Boolean | Estado activo |

#### PriceList
Listas de precios.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| cianboxPriceListId | Int? | ID en Cianbox |
| name | String | Nombre |
| description | String? | Descripcion |
| currency | String | Moneda (ARS, USD) |
| isDefault | Boolean | Lista por defecto |
| isActive | Boolean | Estado activo |

---

### 7. Productos

#### Product
Productos del catalogo.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| cianboxProductId | Int? | ID en Cianbox |
| sku | String? | SKU |
| barcode | String? | Codigo de barras |
| internalCode | String? | Codigo interno |
| name | String | Nombre |
| shortName | String? | Nombre corto ticket |
| description | String? | Descripcion |
| categoryId | String? | FK Category |
| brandId | String? | FK Brand |
| basePrice | Decimal? | Precio base |
| baseCost | Decimal? | Costo base |
| taxRate | Decimal | Tasa IVA (default 21) |
| taxIncluded | Boolean | Precio incluye IVA |
| trackStock | Boolean | Controla stock |
| allowNegativeStock | Boolean | Permite stock negativo |
| minStock | Int? | Stock minimo |
| sellFractions | Boolean | Vende fracciones |
| unitOfMeasure | String | Unidad (UN, KG, LT) |
| imageUrl | String? | URL imagen |
| thumbnailUrl | String? | URL thumbnail |
| isActive | Boolean | Estado activo |
| isService | Boolean | Es servicio |
| location | String? | Ubicacion picking |
| **isParent** | Boolean | Es producto padre (variantes) |
| **isVirtualParent** | Boolean | Padre virtual (sync) |
| **parentProductId** | String? | FK Producto padre |
| **size** | String? | Talle |
| **color** | String? | Color |

**Relaciones:** Self-relation para variantes (`parentProduct`, `variants`)

#### ProductPrice
Precios por lista de precios.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| productId | String | FK Product |
| priceListId | String | FK PriceList |
| price | Decimal | Precio CON IVA |
| priceNet | Decimal? | Precio SIN IVA |
| cost | Decimal? | Costo |
| margin | Decimal? | Margen % |
| validFrom | DateTime | Valido desde |
| validUntil | DateTime? | Valido hasta |

**Indices:** `@@unique([productId, priceListId])`

#### ProductStock
Stock por sucursal.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| productId | String | FK Product |
| branchId | String | FK Branch |
| quantity | Decimal | Cantidad |
| reserved | Decimal | Reservado |
| available | Decimal | Disponible |
| minStock | Int? | Minimo por sucursal |
| maxStock | Int? | Maximo |
| location | String? | Ubicacion |

**Indices:** `@@unique([productId, branchId])`

---

### 8. Clientes

#### Customer
Clientes del tenant.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| cianboxCustomerId | Int? | ID en Cianbox |
| customerType | Enum | CONSUMER, INDIVIDUAL, BUSINESS, GOVERNMENT, RESELLER |
| taxId | String? | CUIT/CUIL/DNI |
| taxIdType | String? | Tipo documento |
| taxCategory | String? | Categoria fiscal |
| name | String | Nombre/Razon social |
| tradeName | String? | Nombre fantasia |
| firstName | String? | Nombre |
| lastName | String? | Apellido |
| email | String? | Email |
| phone | String? | Telefono |
| mobile | String? | Celular |
| address | String? | Direccion |
| city | String? | Ciudad |
| state | String? | Provincia |
| zipCode | String? | Codigo postal |
| country | String | Pais (default AR) |
| priceListId | String? | Lista precios asignada |
| creditLimit | Decimal? | Limite credito |
| creditBalance | Decimal | Saldo credito |
| paymentTermDays | Int | Dias de credito |
| globalDiscount | Decimal | Descuento global % |
| isActive | Boolean | Estado activo |

---

### 9. Promociones y Combos

#### Promotion
Promociones y descuentos.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| code | String? | Codigo promocion |
| name | String | Nombre |
| description | String? | Descripcion |
| type | Enum | PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, SECOND_UNIT_DISCOUNT, BUNDLE_PRICE, FREE_SHIPPING, COUPON, FLASH_SALE, LOYALTY |
| discountType | Enum | PERCENTAGE, FIXED_AMOUNT, FIXED_PRICE |
| discountValue | Decimal | Valor descuento |
| buyQuantity | Int? | Comprar X |
| getQuantity | Int? | Llevar Y |
| minPurchase | Decimal? | Compra minima |
| maxDiscount | Decimal? | Descuento maximo |
| applyTo | Enum | ALL_PRODUCTS, SPECIFIC_PRODUCTS, CATEGORIES, BRANDS, CART_TOTAL |
| categoryIds | String[] | Categorias aplicables |
| brandIds | String[] | Marcas aplicables |
| startDate | DateTime? | Fecha inicio |
| endDate | DateTime? | Fecha fin |
| daysOfWeek | Int[] | Dias de semana |
| startTime | String? | Hora inicio |
| endTime | String? | Hora fin |
| maxUses | Int? | Usos maximos |
| maxUsesPerCustomer | Int? | Usos por cliente |
| currentUses | Int | Usos actuales |
| isActive | Boolean | Estado activo |
| priority | Int | Prioridad |
| stackable | Boolean | Acumulable |
| badgeColor | String? | Color badge POS |
| metadata | Json | Metadatos extra |

#### PromotionProduct
Productos en promocion (M:N).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| promotionId | String | FK Promotion |
| productId | String | FK Product |

#### Combo
Combos / Packs.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| code | String | Codigo |
| name | String | Nombre |
| description | String? | Descripcion |
| imageUrl | String? | URL imagen |
| regularPrice | Decimal | Precio regular |
| comboPrice | Decimal | Precio combo |
| startDate | DateTime? | Fecha inicio |
| endDate | DateTime? | Fecha fin |
| isActive | Boolean | Estado activo |

#### ComboItem
Items del combo (M:N).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| comboId | String | FK Combo |
| productId | String | FK Product |
| quantity | Int | Cantidad |

---

### 10. Ventas

#### Sale
Ventas realizadas.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| branchId | String | FK Branch |
| pointOfSaleId | String | FK PointOfSale |
| userId | String | FK User (cajero) |
| customerId | String? | FK Customer |
| cashSessionId | String? | FK CashSession |
| saleNumber | String | Numero venta |
| receiptType | Enum | TICKET, INVOICE_A, INVOICE_B, INVOICE_C, CREDIT_NOTE_A, CREDIT_NOTE_B, CREDIT_NOTE_C, RECEIPT |
| fiscalNumber | String? | Numero fiscal (CAE) |
| subtotal | Decimal | Subtotal |
| discount | Decimal | Descuento |
| tax | Decimal | Impuesto |
| total | Decimal | Total |
| status | Enum | PENDING, COMPLETED, CANCELLED, REFUNDED, PARTIAL_REFUND |
| cianboxSaleId | Int? | ID en Cianbox |
| notes | String? | Notas |
| metadata | Json | Metadatos |
| saleDate | DateTime | Fecha venta |
| cancelledAt | DateTime? | Fecha anulacion |
| cancelledBy | String? | Usuario anulo |
| cancelReason | String? | Motivo anulacion |

**Indices:** `@@unique([tenantId, saleNumber])`

#### SaleItem
Detalle de venta.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| saleId | String | FK Sale |
| productId | String? | FK Product |
| comboId | String? | FK Combo |
| productCode | String? | Codigo producto |
| productName | String | Nombre producto |
| productBarcode | String? | Codigo barras |
| quantity | Decimal | Cantidad |
| unitPrice | Decimal | Precio unit CON IVA |
| unitPriceNet | Decimal? | Precio unit SIN IVA |
| discount | Decimal | Descuento |
| subtotal | Decimal | Subtotal |
| taxRate | Decimal | Tasa IVA |
| taxAmount | Decimal | Monto IVA |
| priceListId | String? | FK PriceList usada |
| branchId | String? | FK Branch |
| promotionId | String? | FK Promotion aplicada |
| promotionName | String? | Nombre promocion |
| isReturn | Boolean | Es devolucion |

---

### 11. Pagos

#### Payment
Pagos de ventas.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| saleId | String | FK Sale |
| method | Enum | CASH, CREDIT_CARD, DEBIT_CARD, QR, MP_POINT, TRANSFER, CHECK, CREDIT, VOUCHER, GIFTCARD, POINTS, OTHER |
| amount | Decimal | Monto |
| reference | String? | Referencia |
| cardBrand | String? | Marca tarjeta |
| cardLastFour | String? | Ultimos 4 digitos |
| installments | Int | Cuotas |
| amountTendered | Decimal? | Monto recibido (efectivo) |
| changeAmount | Decimal? | Vuelto |
| transactionId | String? | ID transaccion |
| providerData | Json? | Datos proveedor |
| **mpPaymentId** | String? | ID pago MP |
| **mpOrderId** | String? | ID orden MP |
| **mpOperationType** | String? | Tipo operacion MP |
| **mpPointType** | String? | POINT o INSTORE |
| cardFirstSix | String? | BIN tarjeta |
| cardExpirationMonth | Int? | Mes vencimiento |
| cardExpirationYear | Int? | Ano vencimiento |
| cardholderName | String? | Titular |
| cardType | String? | credit/debit |
| payerEmail | String? | Email pagador |
| payerIdType | String? | Tipo doc pagador |
| payerIdNumber | String? | Nro doc pagador |
| authorizationCode | String? | Codigo autorizacion |
| mpFeeAmount | Decimal? | Comision MP |
| mpFeeRate | Decimal? | Tasa comision % |
| netReceivedAmount | Decimal? | Neto recibido |
| bankOriginId | String? | ID banco origen |
| bankOriginName | String? | Nombre banco |
| bankTransferId | String? | ID transferencia |
| mpDeviceId | String? | Device MP |
| mpPosId | String? | POS MP |
| mpStoreId | String? | Store MP |
| status | Enum | PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED |

---

### 12. Turnos de Caja

#### CashSession
Turnos de caja.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| branchId | String | FK Branch |
| pointOfSaleId | String | FK PointOfSale |
| userId | String | FK User (cajero) |
| sessionNumber | String | Numero turno |
| openingAmount | Decimal | Fondo inicial |
| openedAt | DateTime | Fecha apertura |
| openedByUserId | String | Quien abrio |
| openingNotes | String? | Notas apertura |
| closingAmount | Decimal? | Efectivo contado |
| expectedAmount | Decimal? | Monto esperado |
| difference | Decimal? | Diferencia |
| closedAt | DateTime? | Fecha cierre |
| closedByUserId | String? | Quien cerro |
| closingNotes | String? | Notas cierre |
| totalCash | Decimal | Total efectivo |
| totalDebit | Decimal | Total debito |
| totalCredit | Decimal | Total credito |
| totalQr | Decimal | Total QR |
| totalMpPoint | Decimal | Total MP Point |
| totalTransfer | Decimal | Total transferencia |
| totalOther | Decimal | Total otros |
| salesCount | Int | Cantidad ventas |
| salesTotal | Decimal | Total ventas |
| refundsCount | Int | Cantidad devoluciones |
| refundsTotal | Decimal | Total devoluciones |
| cancelsCount | Int | Cantidad anulaciones |
| withdrawalsTotal | Decimal | Total retiros |
| depositsTotal | Decimal | Total depositos |
| status | Enum | OPEN, SUSPENDED, COUNTING, CLOSED, TRANSFERRED |
| previousSessionId | String? | Turno anterior (relevo) |
| transferAmount | Decimal? | Monto transferido |

#### CashMovement
Movimientos de caja.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| cashSessionId | String | FK CashSession |
| type | Enum | DEPOSIT, WITHDRAWAL, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT, CHANGE_FUND |
| amount | Decimal | Monto |
| reason | Enum | SAFE_DEPOSIT, BANK_DEPOSIT, SUPPLIER_PAYMENT, EXPENSE, CHANGE_FUND, INITIAL_FUND, LOAN_RETURN, CORRECTION, COUNT_DIFFERENCE, SHIFT_TRANSFER, OTHER |
| description | String? | Descripcion |
| reference | String? | Referencia |
| authorizedByUserId | String? | Supervisor |
| requiresAuth | Boolean | Requiere autorizacion |
| destinationType | String? | SAFE, BANK, OTHER |
| createdByUserId | String | Quien registro |

#### CashCount
Arqueos de caja.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| cashSessionId | String | FK CashSession |
| type | Enum | OPENING, PARTIAL, CLOSING, AUDIT, TRANSFER |
| bills_10000..bills_10 | Int | Conteo billetes |
| coins_500..coins_1 | Int | Conteo monedas |
| totalBills | Decimal | Total billetes |
| totalCoins | Decimal | Total monedas |
| totalCash | Decimal | Total efectivo |
| expectedAmount | Decimal | Esperado |
| difference | Decimal | Diferencia |
| differenceType | Enum? | SURPLUS, SHORTAGE |
| vouchers | Decimal | Vales |
| checks | Decimal | Cheques |
| otherValues | Decimal | Otros valores |
| notes | String? | Notas |
| countedByUserId | String | Quien conto |
| verifiedByUserId | String? | Quien verifico |

---

### 13. Impresoras

#### Printer
Impresoras configuradas.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| name | String | Nombre |
| type | Enum | THERMAL, LASER, INKJET, LABEL, FISCAL |
| connectionType | Enum | USB, NETWORK, BLUETOOTH, SERIAL, CLOUD |
| ipAddress | String? | IP |
| port | Int? | Puerto |
| usbPath | String? | Path USB |
| bluetoothAddress | String? | MAC Bluetooth |
| paperWidth | Int | Ancho papel (mm) |
| characterSet | String | Charset |
| isActive | Boolean | Estado activo |
| isDefault | Boolean | Por defecto |

#### PrintPoint
Puntos de impresion.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| name | String | Nombre |
| description | String? | Descripcion |
| isActive | Boolean | Estado activo |

#### PrintPointPrinter
Relacion PrintPoint-Printer (M:N).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| printPointId | String | FK PrintPoint |
| printerId | String | FK Printer |
| printType | Enum | TICKET, INVOICE, KITCHEN, BAR, LABEL, REPORT |
| copies | Int | Copias |

---

### 14. Mercado Pago

#### MercadoPagoConfig
Configuracion MP por tenant.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| appType | Enum | POINT, QR |
| appId | String? | ID app MP |
| accessToken | String | Token OAuth |
| refreshToken | String? | Refresh token |
| tokenExpiresAt | DateTime? | Expiracion |
| mpUserId | String? | User ID MP |
| publicKey | String? | Clave publica |
| scope | String? | Permisos |
| webhookSecret | String? | Secret webhook |
| isActive | Boolean | Estado activo |
| environment | String | sandbox/production |

**Indices:** `@@unique([tenantId, appType])`

#### MercadoPagoOrder
Ordenes de pago MP Point.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| saleId | String? | FK Sale |
| orderId | String | ID orden MP (unique) |
| externalReference | String | Referencia externa |
| deviceId | String | Device ID terminal |
| amount | Decimal | Monto |
| status | String | PENDING, PROCESSED, CANCELED, FAILED, EXPIRED |
| paymentId | String? | Payment ID MP |
| paymentMethod | String? | Metodo pago |
| cardBrand | String? | Marca tarjeta |
| cardLastFour | String? | Ultimos 4 |
| installments | Int? | Cuotas |
| responseData | Json? | Respuesta MP |
| errorMessage | String? | Error |
| processedAt | DateTime? | Fecha proceso |

---

### 15. Terminales POS

#### PosTerminal
Terminales/PCs fisicas del POS.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| hostname | String | Nombre PC |
| macAddress | String | MAC address |
| deviceId | String | UUID terminal (unique) |
| osVersion | String? | Version SO |
| appVersion | String? | Version app POS |
| ipAddress | String? | Ultima IP |
| name | String? | Nombre amigable |
| description | String? | Descripcion |
| pointOfSaleId | String? | FK PointOfSale |
| status | Enum | PENDING, ACTIVE, DISABLED, BLOCKED |
| registeredAt | DateTime | Fecha registro |
| lastSeenAt | DateTime | Ultima conexion |
| lastLoginUserId | String? | Ultimo usuario |

**Indices:** `@@unique([tenantId, macAddress])`, `@@unique([tenantId, hostname])`

---

### 16. Auditoria

#### AuditLog
Log de auditoria.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| userId | String? | FK User |
| action | String | CREATE, UPDATE, DELETE |
| entity | String | Nombre entidad |
| entityId | String | ID entidad |
| oldData | Json? | Datos anteriores |
| newData | Json? | Datos nuevos |
| ipAddress | String? | IP |
| userAgent | String? | User agent |

#### SystemConfig
Configuracion del sistema por tenant.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String | ID unico |
| tenantId | String | FK Tenant |
| key | String | Clave config |
| value | String | Valor |
| type | String | Tipo (string, number, boolean, json) |

**Indices:** `@@unique([tenantId, key])`

---

## Enums Disponibles

### Nivel Agencia
- `DatabaseHealthStatus`: HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN
- `AgencyUserStatus`: ACTIVE, DISABLED

### Tenant
- `Plan`: FREE, PRO, ENTERPRISE
- `TenantStatus`: TRIAL, ACTIVE, SUSPENDED, CANCELLED

### Usuarios
- `UserStatus`: ACTIVE, INVITED, DISABLED
- `SessionStatus`: ACTIVE, CLOSED, EXPIRED, FORCED_CLOSE

### Clientes
- `CustomerType`: CONSUMER, INDIVIDUAL, BUSINESS, GOVERNMENT, RESELLER

### Promociones
- `PromotionType`: PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, SECOND_UNIT_DISCOUNT, BUNDLE_PRICE, FREE_SHIPPING, COUPON, FLASH_SALE, LOYALTY
- `DiscountType`: PERCENTAGE, FIXED_AMOUNT, FIXED_PRICE
- `PromotionApplyTo`: ALL_PRODUCTS, SPECIFIC_PRODUCTS, CATEGORIES, BRANDS, CART_TOTAL

### Ventas
- `ReceiptType`: TICKET, INVOICE_A, INVOICE_B, INVOICE_C, CREDIT_NOTE_A, CREDIT_NOTE_B, CREDIT_NOTE_C, RECEIPT
- `SaleStatus`: PENDING, COMPLETED, CANCELLED, REFUNDED, PARTIAL_REFUND

### Pagos
- `PaymentMethod`: CASH, CREDIT_CARD, DEBIT_CARD, QR, MP_POINT, TRANSFER, CHECK, CREDIT, VOUCHER, GIFTCARD, POINTS, OTHER
- `PaymentStatus`: PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED

### Caja
- `CashRegisterStatus`: OPEN, CLOSED, SUSPENDED
- `CashSessionStatus`: OPEN, SUSPENDED, COUNTING, CLOSED, TRANSFERRED
- `CashMovementType`: DEPOSIT, WITHDRAWAL, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT, CHANGE_FUND
- `CashMovementReason`: SAFE_DEPOSIT, BANK_DEPOSIT, SUPPLIER_PAYMENT, EXPENSE, CHANGE_FUND, INITIAL_FUND, LOAN_RETURN, CORRECTION, COUNT_DIFFERENCE, SHIFT_TRANSFER, OTHER
- `CashCountType`: OPENING, PARTIAL, CLOSING, AUDIT, TRANSFER
- `DifferenceType`: SURPLUS, SHORTAGE

### Impresoras
- `PrinterType`: THERMAL, LASER, INKJET, LABEL, FISCAL
- `PrinterConnection`: USB, NETWORK, BLUETOOTH, SERIAL, CLOUD
- `PrintType`: TICKET, INVOICE, KITCHEN, BAR, LABEL, REPORT

### Mercado Pago
- `MercadoPagoAppType`: POINT, QR

### Terminales
- `PosTerminalStatus`: PENDING, ACTIVE, DISABLED, BLOCKED

---

## Indices y Constraints

### Indices Unicos por Tenant
La mayoria de las entidades tienen constraints `@@unique([tenantId, ...])` para garantizar unicidad dentro de cada tenant.

### Regla Critica Multi-tenant
**SIEMPRE filtrar por `tenantId` en todas las queries:**

```typescript
// CORRECTO
const products = await prisma.product.findMany({
  where: { tenantId: req.user!.tenantId }
});

// INCORRECTO - NUNCA hacer esto
const products = await prisma.product.findMany();
```

---

## Migraciones

Las migraciones se ejecutan automaticamente en deploy via `prisma db push`.

```bash
# Desarrollo local
npx prisma migrate dev

# Generar cliente
npx prisma generate
```
