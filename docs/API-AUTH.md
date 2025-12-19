# API - Autenticación

Documentación de endpoints de autenticación para usuarios de tenant y agency.

## Descripción General

El sistema tiene **dos sistemas de autenticación separados**:

| Sistema | Usuario | Endpoint | Token Prefix | Uso |
|---------|---------|----------|--------------|-----|
| **Tenant Auth** | Usuarios de cliente | `/api/auth/*` | `Bearer {token}` | POS, Backoffice Cliente |
| **Agency Auth** | Super administradores | `/api/agency/login` | `Bearer {token}` | Agency Backoffice |

Ambos usan **JWT (JSON Web Tokens)** con las siguientes características:
- Tiempo de expiración: 7 días
- Algoritmo: HS256
- Payload: `{ userId, tenantId?, email, role, permissions }`

## Índice

1. [Autenticación de Tenant](#autenticación-de-tenant)
2. [Autenticación de Agency](#autenticación-de-agency)
3. [Gestión de Tokens](#gestión-de-tokens)
4. [Cambio de Contraseña](#cambio-de-contraseña)
5. [Login con PIN](#login-con-pin)
6. [Middleware de Autenticación](#middleware)

---

## Autenticación de Tenant

### POST /api/auth/login

Login para usuarios de un tenant específico (cajeros, administradores de cliente).

**Body:**
```json
{
  "slug": "demo",
  "email": "cajero@demo.com",
  "password": "Cajero123!"
}
```

**Validaciones:**
- `slug`: requerido, mínimo 2 caracteres
- `email`: formato email válido
- `password`: mínimo 6 caracteres

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "email": "cajero@demo.com",
      "name": "Juan Pérez",
      "role": "cashier",
      "tenantId": "tenant_abc",
      "branchId": "branch_001",
      "pointOfSaleId": "pos_001"
    },
    "tenant": {
      "id": "tenant_abc",
      "name": "Demo Store",
      "slug": "demo",
      "dbServer": "master",
      "isActive": true
    }
  }
}
```

**Errores:**
```json
// Tenant no encontrado
{
  "success": false,
  "statusCode": 404,
  "error": "Tenant no encontrado"
}

// Tenant inactivo
{
  "success": false,
  "statusCode": 403,
  "error": "Tenant inactivo"
}

// Credenciales inválidas
{
  "success": false,
  "statusCode": 401,
  "error": "Credenciales inválidas"
}

// Usuario inactivo
{
  "success": false,
  "statusCode": 403,
  "error": "Usuario inactivo"
}
```

**Ejemplo de uso:**
```javascript
const loginTenant = async (slug, email, password) => {
  try {
    const response = await axios.post('/api/auth/login', {
      slug,
      email,
      password
    });

    // Guardar token en localStorage
    localStorage.setItem('token', response.data.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.data.user));

    return response.data.data;
  } catch (error) {
    console.error('Error de login:', error.response?.data?.error);
    throw error;
  }
};
```

---

### POST /api/auth/logout

Cierra sesión del usuario actual (invalida el token).

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Sesión cerrada correctamente"
}
```

**Nota:** Actualmente no se invalidan tokens en el backend (JWT stateless). El logout es manejado por el cliente eliminando el token del almacenamiento local.

**Ejemplo:**
```javascript
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};
```

---

### GET /api/auth/me

Obtiene información del usuario autenticado actual.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "cajero@demo.com",
      "name": "Juan Pérez",
      "role": "cashier",
      "tenantId": "tenant_abc",
      "branchId": "branch_001",
      "pointOfSaleId": "pos_001",
      "permissions": ["pos:sell", "pos:view"]
    },
    "tenant": {
      "id": "tenant_abc",
      "name": "Demo Store",
      "slug": "demo"
    }
  }
}
```

**Uso típico:** Validar sesión al cargar la aplicación.

```javascript
const validateSession = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login';
    return;
  }

  try {
    const response = await axios.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  } catch (error) {
    // Token inválido o expirado
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
};
```

---

## Autenticación de Agency

### POST /api/agency/login

Login para super administradores (agency users).

**Body:**
```json
{
  "email": "admin@cianboxpos.com",
  "password": "Admin123!"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "agency_user_123",
      "email": "admin@cianboxpos.com",
      "name": "Super Admin",
      "role": "super_admin",
      "isActive": true
    }
  }
}
```

**Diferencia clave:** El token de agency **NO** incluye `tenantId` en el payload.

**Errores:**
```json
// Credenciales inválidas
{
  "success": false,
  "statusCode": 401,
  "error": "Credenciales inválidas"
}

// Usuario inactivo
{
  "success": false,
  "statusCode": 403,
  "error": "Usuario inactivo"
}
```

---

## Gestión de Tokens

### POST /api/auth/refresh

Renueva el token de acceso antes de que expire.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

**Uso recomendado:** Renovar token automáticamente cuando esté por expirar.

```javascript
// Verificar cada 1 hora si el token está por expirar
setInterval(async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    // Decodificar token (sin verificar)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000; // Convertir a ms
    const now = Date.now();
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

    // Si expira en menos de 24 horas, renovar
    if (hoursUntilExpiry < 24) {
      const response = await axios.post('/api/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      localStorage.setItem('token', response.data.data.token);
    }
  } catch (error) {
    console.error('Error renovando token:', error);
  }
}, 60 * 60 * 1000); // Cada 1 hora
```

---

## Cambio de Contraseña

### POST /api/auth/change-password

Cambia la contraseña del usuario autenticado.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword456!"
}
```

**Validaciones:**
- `currentPassword`: requerida
- `newPassword`: mínimo 6 caracteres, debe ser diferente a la actual

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Contraseña actualizada correctamente"
}
```

**Errores:**
```json
// Contraseña actual incorrecta
{
  "success": false,
  "statusCode": 401,
  "error": "Contraseña actual incorrecta"
}

// Nueva contraseña igual a la anterior
{
  "success": false,
  "statusCode": 400,
  "error": "La nueva contraseña debe ser diferente a la actual"
}
```

---

## Login con PIN

### POST /api/auth/login-pin

Login rápido usando PIN numérico de 4 dígitos (para cajeros).

**Body:**
```json
{
  "slug": "demo",
  "pin": "1234"
}
```

**Validaciones:**
- `slug`: requerido
- `pin`: debe ser 4 dígitos numéricos

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "name": "Juan Pérez",
      "role": "cashier",
      "branchId": "branch_001",
      "pointOfSaleId": "pos_001"
    }
  }
}
```

**Errores:**
```json
// PIN inválido
{
  "success": false,
  "statusCode": 401,
  "error": "PIN inválido"
}

// Usuario no tiene PIN configurado
{
  "success": false,
  "statusCode": 400,
  "error": "Este usuario no tiene PIN configurado"
}
```

**Nota:** El PIN se configura en el backoffice al crear/editar usuarios.

---

## Middleware

### authenticate

Middleware que valida el token JWT y agrega `req.user` al request.

**Uso en rutas:**
```typescript
import { authenticate } from '../middleware/auth';

router.get('/protected-route', authenticate, (req, res) => {
  // req.user está disponible
  const { userId, tenantId } = req.user;
});
```

**Estructura de `req.user`:**
```typescript
interface AuthenticatedUser {
  userId: string;
  tenantId?: string;      // Solo para tenant users
  email: string;
  role: string;
  permissions?: string[]; // Solo para tenant users
}
```

**Errores del middleware:**
```json
// Sin token
{
  "success": false,
  "statusCode": 401,
  "error": "Token no proporcionado"
}

// Token inválido
{
  "success": false,
  "statusCode": 401,
  "error": "Token inválido"
}

// Token expirado
{
  "success": false,
  "statusCode": 401,
  "error": "Token expirado"
}
```

---

### authorize

Middleware que verifica permisos específicos.

**Uso:**
```typescript
import { authenticate, authorize } from '../middleware/auth';

// Requiere permiso 'pos:sell'
router.post('/sales', authenticate, authorize('pos:sell'), handler);

// Requiere múltiples permisos (OR)
router.delete('/products/:id',
  authenticate,
  authorize(['products:delete', 'admin:all']),
  handler
);
```

**Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "error": "No tienes permisos para realizar esta acción"
}
```

**Permisos comunes:**

| Permiso | Descripción |
|---------|-------------|
| `pos:sell` | Crear ventas |
| `pos:view` | Ver ventas |
| `pos:cancel` | Anular ventas |
| `products:read` | Ver productos |
| `products:write` | Crear/editar productos |
| `products:delete` | Eliminar productos |
| `cash:open` | Abrir turno de caja |
| `cash:close` | Cerrar turno de caja |
| `cash:deposit` | Registrar ingresos de efectivo |
| `cash:withdraw` | Registrar retiros de efectivo |
| `cash:count` | Hacer arqueos |
| `cash:view_all` | Ver turnos de otros usuarios |
| `settings:view` | Ver configuración |
| `settings:edit` | Editar configuración |
| `admin:all` | Acceso total |

---

## Flujos de Autenticación

### Flujo Tenant (POS/Backoffice)

```
1. Usuario ingresa en /login
   └─> Introduce: slug, email, password

2. Frontend
   └─> POST /api/auth/login
       {
         slug: "demo",
         email: "cajero@demo.com",
         password: "Cajero123!"
       }

3. Backend
   ├─> Busca tenant por slug
   ├─> Verifica que esté activo
   ├─> Busca usuario por email y tenantId
   ├─> Verifica contraseña con bcrypt
   ├─> Genera JWT con payload:
   │   {
   │     userId: "user_123",
   │     tenantId: "tenant_abc",
   │     email: "cajero@demo.com",
   │     role: "cashier",
   │     permissions: ["pos:sell", "pos:view"]
   │   }
   └─> Devuelve token + datos de usuario

4. Frontend
   ├─> Guarda token en localStorage
   ├─> Configura axios con interceptor:
   │   axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
   └─> Redirige a /pos o /dashboard
```

### Flujo Agency

```
1. Usuario ingresa en /agency/login
   └─> Introduce: email, password

2. Frontend
   └─> POST /api/agency/login
       {
         email: "admin@cianboxpos.com",
         password: "Admin123!"
       }

3. Backend
   ├─> Busca agency user por email
   ├─> Verifica contraseña
   ├─> Genera JWT sin tenantId:
   │   {
   │     userId: "agency_user_123",
   │     email: "admin@cianboxpos.com",
   │     role: "super_admin"
   │   }
   └─> Devuelve token

4. Frontend
   ├─> Guarda token en localStorage
   └─> Redirige a /agency/dashboard
```

### Flujo de Validación en Cada Request

```
1. Request con token
   └─> GET /api/products
       Headers: { Authorization: "Bearer eyJhbG..." }

2. Middleware authenticate
   ├─> Extrae token del header
   ├─> Verifica firma con JWT_SECRET
   ├─> Verifica expiración
   ├─> Decodifica payload
   └─> Agrega req.user = { userId, tenantId, email, role }

3. Middleware authorize (si se usa)
   ├─> Verifica permisos en req.user.permissions
   └─> Si no tiene permiso → 403 Forbidden

4. Controller
   ├─> Usa req.user.tenantId para filtrar datos
   └─> Procesa request
```

---

**Ver también:**
- [API - Ventas](./API-SALES.md)
- [API - Productos](./API-PRODUCTS.md)
- [USUARIOS_FRONTENDS.md](./USUARIOS_FRONTENDS.md)
