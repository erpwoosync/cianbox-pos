# Autenticación - Endpoints y Middleware

**Endpoints de autenticación y middleware de autorización**

## Endpoints

### POST /api/auth/login

Autenticar usuario con email y contraseña.

**Autenticación:** No requiere

**Request Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "tenantSlug": "mi-tienda"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clxyz123",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez",
      "avatar": null,
      "role": {
        "id": "role123",
        "name": "Cajero",
        "permissions": ["pos:sell", "inventory:view"]
      },
      "branch": {
        "id": "branch123",
        "code": "SUC-001",
        "name": "Casa Central"
      }
    },
    "tenant": {
      "id": "tenant123",
      "name": "Mi Tienda S.A.",
      "slug": "mi-tienda",
      "logo": null
    },
    "sessionId": "session123"
  }
}
```

**Errores:**
- `401 Unauthorized` - Credenciales inválidas
- `401 Unauthorized` - Tenant no encontrado o no activo
- `401 Unauthorized` - Usuario no activo

### POST /api/auth/login/pin

Login rápido con PIN de 4 dígitos (para cambios de turno en POS).

**Autenticación:** No requiere

**Request Body:**
```json
{
  "pin": "1234",
  "tenantSlug": "mi-tienda"
}
```

**Response:** Igual que `/login`

### POST /api/auth/verify-supervisor

Verificar PIN de supervisor para autorizar operaciones sensibles.

**Autenticación:** Bearer token requerido

**Request Body:**
```json
{
  "pin": "9876",
  "requiredPermission": "cash:movements"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "supervisor": {
      "id": "user456",
      "name": "María González",
      "email": "maria@ejemplo.com",
      "role": "Supervisor"
    }
  }
}
```

**Errores:**
- `401 Unauthorized` - PIN inválido
- `403 Forbidden` - El usuario no tiene el permiso requerido

### POST /api/auth/refresh

Renovar access token usando refresh token.

**Autenticación:** No requiere

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /api/auth/logout

Cerrar sesión actual o todas las sesiones del usuario.

**Autenticación:** Bearer token requerido

**Request Body:**
```json
{
  "sessionId": "session123"
}
```

### GET /api/auth/me

Obtener datos del usuario autenticado.

**Autenticación:** Bearer token requerido

### PUT /api/auth/password

Cambiar contraseña del usuario autenticado.

**Autenticación:** Bearer token requerido

**Request Body:**
```json
{
  "currentPassword": "contraseña_actual",
  "newPassword": "nueva_contraseña_segura"
}
```

## Middleware de Autenticación

### authenticate

Middleware que verifica el token JWT y agrega `req.user` con los datos del usuario.

**Uso:**
```typescript
router.get('/protected', authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const tenantId = req.user!.tenantId;
  const permissions = req.user!.permissions;
});
```

**JWTPayload:**
```typescript
{
  userId: string;
  tenantId: string;
  email: string;
  roleId: string;
  permissions: string[];
  branchId?: string;
  iat?: number;
  exp?: number;
}
```

**Errores lanzados:**
- `AuthenticationError` - Token no proporcionado
- `AuthenticationError` - Formato de token inválido
- `AuthenticationError` - Token expirado
- `AuthenticationError` - Token inválido

### authorize(...requiredPermissions)

Middleware que verifica que el usuario tenga AL MENOS UNO de los permisos requeridos.

**Uso:**
```typescript
// Requiere permiso 'inventory:edit'
router.post('/products', authenticate, authorize('inventory:edit'), handler);

// Requiere 'admin:terminals' o permiso global '*'
router.get('/terminals', authenticate, authorize('admin:terminals', '*'), handler);
```

**Lógica:**
- Verifica que `req.user` exista (debe ejecutarse después de `authenticate`)
- Permite acceso si el usuario tiene permiso `*` (superadmin)
- Permite acceso si el usuario tiene al menos uno de los permisos especificados
- Lanza `AuthorizationError` si no tiene ninguno

### optionalAuth

Middleware que intenta autenticar pero NO lanza error si no hay token.

**Uso:**
```typescript
router.get('/public-data', optionalAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user) {
    // Usuario autenticado
  } else {
    // Usuario anónimo
  }
});
```

## Generación de Tokens

### generateToken(payload)

Genera un JWT de acceso con expiración de 7 días.

### generateRefreshToken(payload)

Genera un JWT de refresco con expiración de 30 días.

### verifyToken(token)

Verifica un token sin lanzar errores. Retorna el payload si es válido, `null` si no.

## Flujo de Autenticación

```
1. POST /auth/login {email, pass}
        │
        ▼
2. Verificar credenciales
   - Buscar tenant por slug
   - Buscar usuario por email
   - Comparar password hash
        │
        ▼
3. Crear sesión en UserSession
        │
        ▼
4. Generar tokens JWT
   - Access token (7d)
   - Refresh token (30d)
        │
        ▼
5. Retornar respuesta
   {token, refreshToken, user, tenant}
```

## Casos de Uso

### Login de Cajero con PIN

1. El cajero ingresa su PIN de 4 dígitos en el POS
2. POST `/auth/login/pin` con `{pin, tenantSlug}`
3. Sistema busca usuario activo con ese PIN en el tenant
4. Genera tokens y retorna datos del usuario
5. Frontend guarda tokens en localStorage/memoria

### Autorización de Retiro de Efectivo

1. Cajero intenta registrar un retiro de $10,000
2. Frontend solicita PIN de supervisor
3. POST `/auth/verify-supervisor` con `{pin, requiredPermission: "cash:movements"}`
4. Sistema verifica que el PIN corresponda a usuario con permiso
5. Si es válido, permite la operación

## Troubleshooting

### Error: JWT_SECRET no está configurado

**Solución:** Agregar en `.env`:
```
JWT_SECRET=clave-secreta-aleatoria-muy-larga
```

### Error: Token expirado (401)

**Solución:** El frontend debe usar el refresh token para obtener un nuevo access token llamando a `/auth/refresh`.

## Documentación Relacionada

- [AUTH-MODELOS.md](./AUTH-MODELOS.md) - Modelos de datos y permisos
