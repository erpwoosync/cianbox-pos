# Backoffice - Usuarios, Roles y Catálogo

**Endpoints de administración para gestionar usuarios y catálogo del tenant**

## Visión General

Los endpoints de backoffice permiten a los administradores del tenant:
- Gestionar usuarios y roles
- Configurar puntos de venta
- Administrar terminales POS
- Administrar catálogo de productos

La mayoría de endpoints requiere permisos de administrador o específicos.

## Endpoints de Gestión de Usuarios

### GET /api/backoffice/users

Listar usuarios del tenant.

**Autenticación:** Bearer token + permiso `admin:users`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user123",
      "email": "maria@example.com",
      "name": "María González",
      "status": "ACTIVE",
      "role": { "id": "role123", "name": "Cajero" },
      "branch": { "id": "branch123", "name": "Casa Central" },
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/backoffice/users

Crear usuario.

**Request:**
```json
{
  "email": "nuevo@example.com",
  "password": "contraseña_segura",
  "name": "Nuevo Usuario",
  "roleId": "role123",
  "branchId": "branch123",
  "pin": "1234"
}
```

### PUT /api/backoffice/users/:id

Actualizar usuario.

### DELETE /api/backoffice/users/:id

Eliminar o desactivar usuario.

**Validación:** Si tiene ventas asociadas, se desactiva en lugar de eliminar

## Endpoints de Roles

### GET /api/backoffice/roles

Listar roles del tenant.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role123",
      "name": "Administrador",
      "description": "Acceso completo al sistema",
      "isSystem": true,
      "permissions": ["*"],
      "_count": { "users": 2 }
    },
    {
      "id": "role456",
      "name": "Cajero",
      "description": "Operaciones de POS",
      "isSystem": true,
      "permissions": ["pos:sell", "pos:discount", "inventory:view"],
      "_count": { "users": 5 }
    }
  ]
}
```

### POST /api/backoffice/roles

Crear rol personalizado.

**Request:**
```json
{
  "name": "Supervisor",
  "description": "Supervisa operaciones de caja",
  "permissions": [
    "pos:sell",
    "pos:discount",
    "pos:cancel",
    "cash:view_all",
    "cash:movements"
  ]
}
```

### PUT /api/backoffice/roles/:id

Actualizar rol.

**Validación:** No permite modificar roles del sistema (isSystem=true)

### DELETE /api/backoffice/roles/:id

Eliminar rol.

**Validación:**
- No permite eliminar roles del sistema
- No permite eliminar si tiene usuarios asignados

## Endpoints de Puntos de Venta

### GET /api/backoffice/points-of-sale

Ver documentación en [BRANCHES-SUCURSALES.md](./BRANCHES-SUCURSALES.md)

### POST /api/backoffice/points-of-sale

Crear punto de venta.

**Autenticación:** Bearer token + permiso `pos:write`

### PUT /api/backoffice/points-of-sale/:id

Actualizar punto de venta.

### DELETE /api/backoffice/points-of-sale/:id

Eliminar punto de venta.

## Endpoints de Terminales

### GET /api/backoffice/terminals

Ver documentación en [BRANCHES-TERMINALES.md](./BRANCHES-TERMINALES.md)

### PATCH /api/backoffice/terminals/:id

Actualizar terminal (activar, asignar POS).

**Autenticación:** Bearer token + permiso `admin:terminals`

## Endpoints de Productos

### GET /api/backoffice/products

Listar productos (vista administrativa).

Ver documentación en [PRODUCTS-ENDPOINTS.md](./PRODUCTS-ENDPOINTS.md)

**Diferencia con GET /api/products:**
- Incluye productos inactivos
- Incluye más detalles (costo, margen, etc.)
- Permite filtros avanzados

### POST /api/backoffice/products

Crear producto local (no sincronizado desde Cianbox).

**Autenticación:** Bearer token + permiso `inventory:edit`

### PUT /api/backoffice/products/:id

Actualizar producto.

**Nota:** Si el producto está sincronizado desde Cianbox (`cianboxProductId != null`), algunos campos no se pueden editar.

### DELETE /api/backoffice/products/:id

Eliminar producto.

## Endpoints de Categorías

### POST /api/backoffice/categories

Crear categoría local.

**Request:**
```json
{
  "name": "Nueva Categoría",
  "description": "Descripción",
  "parentId": "cat-parent",
  "isQuickAccess": true,
  "quickAccessOrder": 1,
  "quickAccessColor": "#FF5733",
  "quickAccessIcon": "shirt"
}
```

### PUT /api/backoffice/categories/:id

Actualizar categoría.

**Caso de uso común:** Configurar acceso rápido en POS

```json
{
  "isQuickAccess": true,
  "quickAccessOrder": 1,
  "quickAccessColor": "#FF5733",
  "quickAccessIcon": "shirt"
}
```

## Endpoints de Clientes

### GET /api/backoffice/customers

Listar clientes.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cust123",
      "name": "Juan Pérez",
      "taxId": "20-12345678-9",
      "email": "juan@example.com",
      "phone": "+54 11 1234-5678",
      "priceList": { "name": "Mayorista" },
      "_count": { "sales": 15 }
    }
  ]
}
```

### POST /api/backoffice/customers

Crear cliente local.

**Request:**
```json
{
  "name": "Juan Pérez",
  "taxId": "20-12345678-9",
  "email": "juan@example.com",
  "phone": "+54 11 1234-5678",
  "address": "Av. Libertador 1234",
  "city": "Buenos Aires",
  "priceListId": "plist-mayorista"
}
```

## Estructura de Permisos

### Permisos de Administración

| Permiso | Descripción |
|---------|-------------|
| `admin:users` | Gestionar usuarios |
| `admin:roles` | Gestionar roles |
| `admin:settings` | Configuración general |
| `admin:terminals` | Gestionar terminales POS |
| `settings:edit` | Editar configuración del tenant |

### Permisos de Catálogo

| Permiso | Descripción |
|---------|-------------|
| `inventory:view` | Ver inventario |
| `inventory:edit` | Editar productos |
| `pos:write` | Gestionar puntos de venta |
| `pos:delete` | Eliminar puntos de venta |

### Permiso Global

| Permiso | Descripción |
|---------|-------------|
| `*` | Acceso total (superadmin) |

## Documentación Relacionada

- [BACKOFFICE-REPORTES.md](./BACKOFFICE-REPORTES.md) - Reportes y configuración
