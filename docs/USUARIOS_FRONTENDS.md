# Usuarios de Frontends - Cianbox POS

Este documento contiene las credenciales de acceso a los diferentes frontends del sistema.

## URLs de Acceso

| Frontend | URL | Puerto |
|----------|-----|--------|
| Agency Backoffice | http://172.16.1.61:8082 | 8082 |
| Client Backoffice | http://172.16.1.61:8084 | 8084 |
| POS | http://172.16.1.61:8080 | 8080 |
| Backend API | http://172.16.1.61:3001 | 3001 |

---

## Agency Backoffice (Super Admin)

Panel de administracion multi-tenant para gestionar clientes/empresas.

| Campo | Valor |
|-------|-------|
| URL | http://172.16.1.61:8082 |
| Email | admin@cianboxpos.com |
| Password | Admin123! |

**Permisos:** Acceso completo a gestion de tenants, sincronizacion, servidores de BD.

---

## Client Backoffice (Tenant: Demo)

Panel de administracion del catalogo para cada tenant.

| Campo | Valor |
|-------|-------|
| URL | http://172.16.1.61:8084 |
| Empresa | demo |
| Email | admin@demo.com |
| Password | Admin123! |

**Permisos:** Gestion del catalogo de productos, categorias, marcas, precios.

---

## POS (Tenant: Demo)

Punto de venta para operaciones de caja.

| Campo | Valor |
|-------|-------|
| URL | http://172.16.1.61:8080 |
| Email | admin@demo.com |
| Password | Admin123! |
| PIN (opcional) | 1234 |

**Permisos:** Ventas, cobros, consultas de precio, descuentos.

---

## Datos de Conexion Cianbox (Tenant Demo)

Configuracion de sincronizacion con Cianbox ERP.

| Campo | Valor |
|-------|-------|
| Cuenta | plataformamayoristaprueba |
| App Name | erp-pos-sync |
| Usuario | demo@plataformamayorista.com |

---

## Notas

- Las contrasenas por defecto son `Admin123!` para todos los usuarios
- El PIN del POS es opcional para operaciones rapidas
- El campo "Empresa" en el Backoffice corresponde al slug del tenant
- Los tokens JWT expiran en 7 dias (configurable en .env)

---

*Ultima actualizacion: 15 de Diciembre 2024*
