# Credenciales de Testing - Tenant Demo

Documento con las credenciales de acceso para testing en el tenant **demo**.

## Tenant de Prueba

| Campo | Valor |
|-------|-------|
| Nombre | Demo Store S.A. |
| Slug | `demo` |
| CUIT | 30-12345678-9 |
| Plan | PRO |
| Estado | ACTIVE |

---

## Credenciales por Rol

### Administrador

Usuario con acceso total al sistema (permiso `*`).

| Campo | Valor |
|-------|-------|
| Email | `admin@demo.com` |
| Password | `admin@demo.com` |
| PIN | `1234` |
| Nombre | Administrador Demo |
| Sucursal | Casa Central (SUC-001) |

**Permisos:** Acceso total al sistema

**Uso:** Login en POS, Backoffice Cliente

---

### Supervisor

Usuario con permisos de supervision de operaciones.

| Campo | Valor |
|-------|-------|
| Email | `supervidor@demo.com` |
| Password | `supervidor@demo.com` |
| PIN | `5678` |
| Nombre | Supervisor |
| Sucursal | Casa Central (SUC-001) |

**Permisos:**
- `pos:sell` - Crear ventas
- `pos:discount` - Aplicar descuentos
- `pos:cancel` - Anular ventas
- `pos:refund` - Devoluciones
- `pos:view_reports` - Ver reportes
- `inventory:view` - Ver inventario
- `customers:view` - Ver clientes
- `customers:edit` - Editar clientes
- `cash:open` - Abrir turno de caja
- `cash:close` - Cerrar turno de caja
- `cash:movements` - Movimientos de caja (ingresos/retiros)

**Uso:** Autorizar operaciones sensibles (retiros, anulaciones), supervisar cajeros

---

### Cajero

Usuario con permisos basicos de operacion de caja.

| Campo | Valor |
|-------|-------|
| Email | `cajero1@demo.com` |
| Password | `cajero1@demo.com` |
| PIN | `0001` |
| Nombre | Cajero1 |
| Sucursal | Casa Central (SUC-001) |

**Permisos:**
- `pos:sell` - Crear ventas
- `pos:discount:limited` - Descuento limitado (hasta 10%)
- `cash:open` - Abrir turno de caja
- `cash:close` - Cerrar turno de caja
- `customers:view` - Ver clientes

**Uso:** Operaciones diarias de venta en el POS

---

## Credenciales Agency (Super Admin)

Acceso al panel de administracion de agencia (gestion de tenants).

| Campo | Valor |
|-------|-------|
| Email | `admin@cianboxpos.com` |
| Password | `Admin2024!` |
| Panel | Agency Backoffice (puerto 8084) |

**Uso:** Crear/gestionar tenants, ver metricas globales

---

## Endpoints de Login

### POS / Backoffice Cliente

```bash
POST /api/auth/login
Content-Type: application/json

{
  "slug": "demo",
  "email": "admin@demo.com",
  "password": "admin@demo.com"
}
```

### Login con PIN (acceso rapido)

```bash
POST /api/auth/login-pin
Content-Type: application/json

{
  "slug": "demo",
  "pin": "1234"
}
```

### Agency Backoffice

```bash
POST /api/agency/login
Content-Type: application/json

{
  "email": "admin@cianboxpos.com",
  "password": "Admin2024!"
}
```

---

## Verificacion de Supervisor

Para operaciones que requieren autorizacion de supervisor (ej: retiros de caja):

```bash
POST /api/auth/verify-supervisor
Authorization: Bearer {token}
Content-Type: application/json

{
  "pin": "5678",
  "requiredPermission": "cash:movements"
}
```

---

## URLs de Acceso (Produccion)

| Aplicacion | URL |
|------------|-----|
| POS Frontend | https://cianbox-pos.ews-cdn.link/demo |
| Backoffice Cliente | https://cianbox-pos-backoffice.ews-cdn.link |
| Agency Backoffice | https://cianbox-pos-agency.ews-cdn.link |

## URLs de Acceso (Desarrollo Local)

| Aplicacion | URL |
|------------|-----|
| POS Frontend | http://localhost:5173/demo |
| Backoffice Cliente | http://localhost:5174 |
| Agency Backoffice | http://localhost:5175 |
| Backend API | http://localhost:3001/api |

---

## Notas Importantes

1. **Tokens JWT:** Expiran en 7 dias
2. **PIN:** Solo usuarios con PIN configurado pueden usar login rapido
3. **Tenant inactivo:** Si el tenant esta suspendido, ninguno de los usuarios podra ingresar
4. **Contraseñas:** Minimo 6 caracteres, hasheadas con bcrypt (12 rounds)

---

## Seed de Datos

Para recrear estos usuarios, ejecutar:

```bash
cd apps/backend
npx prisma db seed
```

El seed crea:
- 1 Agency User (super admin)
- 1 Tenant (demo)
- 3 Roles (Administrador, Supervisor, Cajero)
- 1 Usuario admin
- 1 Sucursal (Casa Central)
- 1 Punto de Venta (CAJA-01)
- Categorias y productos de ejemplo
- 1 Promocion de ejemplo (2x1 en Bebidas)

---

**Ultima actualizacion:** Diciembre 2024
