# Usuarios de Frontends - Cianbox POS

Este documento contiene las credenciales de acceso a los diferentes frontends del sistema.

## URLs de Acceso

### URLs Publicas (via Nginx Proxy Manager)

| Frontend | URL |
|----------|-----|
| POS | https://cianbox-pos-point.ews-cdn.link |
| Agency Backoffice | https://cianbox-pos-agency.ews-cdn.link |
| Client Backoffice | https://cianbox-pos-backoffice.ews-cdn.link |
| Backend API | https://cianbox-pos-api.ews-cdn.link |

### URLs Internas (Red Local)

| Frontend | URL | Puerto |
|----------|-----|--------|
| POS | http://172.16.1.61 | 80 |
| Agency Backoffice | http://172.16.1.61:8083 | 8083 |
| Client Backoffice | http://172.16.1.61:8084 | 8084 |
| Backend API | http://172.16.1.61:3001 | 3001 |

---

## Agency Backoffice (Super Admin)

Panel de administracion multi-tenant para gestionar clientes/empresas.

| Campo | Valor |
|-------|-------|
| URL Publica | https://cianbox-pos-agency.ews-cdn.link |
| URL Interna | http://172.16.1.61:8083 |
| Email | admin@cianboxpos.com |
| Password | Admin123! |

**Permisos:** Acceso completo a gestion de tenants, sincronizacion, servidores de BD.

---

## Client Backoffice (Tenant: Demo)

Panel de administracion del catalogo para cada tenant.

| Campo | Valor |
|-------|-------|
| URL Publica | https://cianbox-pos-backoffice.ews-cdn.link |
| URL Interna | http://172.16.1.61:8084 |
| Empresa | demo |
| Email | admin@demo.com |
| Password | Admin123! |

**Permisos:** Gestion del catalogo de productos, categorias, marcas, precios.

---

## POS (Tenant: Demo)

Punto de venta para operaciones de caja.

| Campo | Valor |
|-------|-------|
| URL Publica | https://cianbox-pos-point.ews-cdn.link |
| URL Interna | http://172.16.1.61 |
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

## Arquitectura de Red

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│     Nginx Proxy Manager (NPM)       │
│         ews-cdn.link                │
└─────────────────────────────────────┘
    │
    ├── cianbox-pos-point.ews-cdn.link ──────► 172.16.1.61:80 (POS)
    ├── cianbox-pos-agency.ews-cdn.link ─────► 172.16.1.61:8083 (Agency)
    ├── cianbox-pos-backoffice.ews-cdn.link ─► 172.16.1.61:8084 (Backoffice)
    └── cianbox-pos-api.ews-cdn.link ────────► 172.16.1.61:3001 (Backend API)
```

---

## Notas

- Las contrasenas por defecto son `Admin123!` para todos los usuarios
- El PIN del POS es opcional para operaciones rapidas
- El campo "Empresa" en el Backoffice corresponde al slug del tenant
- Los tokens JWT expiran en 7 dias (configurable en .env)
- SSL/HTTPS es manejado por Nginx Proxy Manager

---

*Ultima actualizacion: 19 de Diciembre 2025*
