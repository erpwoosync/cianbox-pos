# Autenticación - Modelos de Datos

**Sistema de autenticación con JWT y control granular de permisos por roles**

## User

Usuarios del sistema por tenant.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | ID único del usuario |
| tenantId | String | ID del tenant al que pertenece |
| email | String | Email (único por tenant) |
| passwordHash | String | Hash bcrypt de la contraseña |
| name | String | Nombre completo del usuario |
| avatar | String? | URL del avatar |
| pin | String? | PIN de 4 dígitos para operaciones rápidas en POS |
| status | UserStatus | ACTIVE, INVITED, DISABLED |
| roleId | String | Rol asignado al usuario |
| branchId | String? | Sucursal asignada por defecto |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- Pertenece a un `Tenant`
- Pertenece a un `Role`
- Pertenece a una `Branch` (opcional)
- Tiene muchas `Sale` (ventas realizadas)
- Tiene muchas `UserSession` (sesiones de login)
- Tiene muchas `CashSession` (turnos de caja)

**Índices únicos:**
- `[tenantId, email]` - Email único por tenant

## Role

Roles con permisos configurables por tenant.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | ID único del rol |
| tenantId | String | ID del tenant |
| name | String | Nombre del rol (ej: "Administrador", "Cajero") |
| description | String? | Descripción del rol |
| isSystem | Boolean | Si es rol del sistema (no editable) |
| permissions | String[] | Array de permisos asignados |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- Pertenece a un `Tenant`
- Tiene muchos `User`

**Índices únicos:**
- `[tenantId, name]` - Nombre único por tenant

## Permisos Disponibles

| Código | Descripción | Categoría |
|--------|-------------|-----------|
| `*` | Acceso total (superadmin) | Sistema |
| `pos:sell` | Vender productos | POS |
| `pos:discount` | Aplicar descuentos | POS |
| `pos:cancel` | Anular ventas | POS |
| `inventory:view` | Ver inventario | Inventario |
| `inventory:edit` | Editar productos | Inventario |
| `cash:open` | Abrir turnos de caja | Caja |
| `cash:close` | Cerrar turnos de caja | Caja |
| `cash:movements` | Registrar movimientos de efectivo | Caja |
| `cash:view_all` | Ver todas las cajas | Caja |
| `cash:report_all` | Ver reportes de todas las cajas | Caja |
| `settings:edit` | Configuración general | Administración |
| `admin:users` | Gestionar usuarios | Administración |
| `admin:terminals` | Gestionar terminales POS | Administración |

## UserSession

Sesiones de login de usuarios (tracking).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | ID único de la sesión |
| userId | String | ID del usuario |
| pointOfSaleId | String? | Punto de venta donde inició sesión |
| deviceInfo | String? | Información del dispositivo |
| ipAddress | String? | Dirección IP |
| status | SessionStatus | ACTIVE, CLOSED, EXPIRED, FORCED_CLOSE |
| loginAt | DateTime | Fecha/hora de login |
| logoutAt | DateTime? | Fecha/hora de logout |
| lastActivityAt | DateTime | Última actividad |
| durationMinutes | Int? | Duración en minutos |

**Relaciones:**
- Pertenece a un `User`
- Pertenece a un `PointOfSale` (opcional)

## Roles Predefinidos

Al crear un nuevo tenant, se crean automáticamente dos roles:

### Administrador
- **Permisos:** `["*"]` (acceso total)
- **Descripción:** Acceso completo al sistema
- **isSystem:** true (no editable)

### Cajero
- **Permisos:** `["pos:sell", "pos:discount", "inventory:view"]`
- **Descripción:** Operaciones de punto de venta
- **isSystem:** true (no editable)

## Seguridad

### Contraseñas

- **Hashing:** bcrypt con 10 rounds
- **Nunca retornar:** El campo `passwordHash` NUNCA se incluye en respuestas
- **Validación:** Mínimo 8 caracteres para contraseñas nuevas

### Tokens JWT

- **Secret:** Variable de entorno `JWT_SECRET` (obligatoria)
- **Algoritmo:** HS256
- **Access Token:** Expira en 7 días (configurable)
- **Refresh Token:** Expira en 30 días (configurable)
- **Payload incluye:** userId, tenantId, email, roleId, permissions, branchId (opcional)

### Sesiones

- **Tracking:** Cada login crea un registro en `UserSession`
- **Información guardada:** IP, device info, timestamps
- **Cierre:** Manual (logout) o automático (expiración)
- **Estados:** ACTIVE, CLOSED, EXPIRED, FORCED_CLOSE

## Variables de Entorno

```env
# JWT Secret (OBLIGATORIO)
JWT_SECRET=tu-clave-secreta-super-segura

# Expiración de tokens
JWT_EXPIRES_IN=7d          # Access token (default: 7 días)
JWT_REFRESH_EXPIRES_IN=30d # Refresh token (default: 30 días)
```

## Documentación Relacionada

- [AUTH-ENDPOINTS.md](./AUTH-ENDPOINTS.md) - Endpoints y middleware de autenticación
