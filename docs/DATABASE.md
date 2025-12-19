# ⚠️ ESTE ARCHIVO ESTÁ DEPRECADO

**Última actualización:** 19 de Diciembre de 2024

## Esta documentación ha sido dividida en módulos más pequeños

Para facilitar la lectura y el mantenimiento, la documentación de base de datos se ha reorganizado en archivos modulares de máximo 400 líneas cada uno.

### 📂 Nueva Estructura

| Módulo | Descripción | Ver |
|--------|-------------|-----|
| **DATABASE-CORE.md** | Modelos fundamentales (Tenant, User, Role, Branch, Cianbox) | [Ver](./DATABASE-CORE.md) |
| **DATABASE-CATALOG.md** | Catálogo (Products, Categories, Brands, Stock, Customers) | [Ver](./DATABASE-CATALOG.md) |
| **DATABASE-SALES.md** | Ventas (Sale, Payment, Promotion, Combo, MercadoPago) | [Ver](./DATABASE-SALES.md) |
| **DATABASE-CASH.md** | Sistema de caja (CashSession, Movements, Counts) | [Ver](./DATABASE-CASH.md) |

---

## Por Qué el Cambio

**Problemas del archivo original:**
- ❌ 872 líneas (difícil de navegar)
- ❌ Mezcla de conceptos no relacionados
- ❌ Difícil de mantener actualizado
- ❌ Imposible de leer de una sola vez

**Ventajas de la nueva estructura:**
- ✅ Archivos cortos y enfocados (<400 líneas)
- ✅ Organización por dominio funcional
- ✅ Fácil de buscar y referenciar
- ✅ Mejor mantenibilidad

---

## Mapeo de Contenido

Si estabas buscando información sobre:

| Tema | Nuevo Archivo |
|------|---------------|
| Tenants, Usuarios, Roles, Sucursales | [DATABASE-CORE.md](./DATABASE-CORE.md#nivel-tenant) |
| Productos, Categorías, Marcas | [DATABASE-CATALOG.md](./DATABASE-CATALOG.md#productos) |
| Stock y control de inventario | [DATABASE-CATALOG.md](./DATABASE-CATALOG.md#stock) |
| Clientes | [DATABASE-CATALOG.md](./DATABASE-CATALOG.md#clientes) |
| Ventas e Items | [DATABASE-SALES.md](./DATABASE-SALES.md#ventas) |
| Pagos y métodos | [DATABASE-SALES.md](./DATABASE-SALES.md#pagos) |
| Promociones | [DATABASE-SALES.md](./DATABASE-SALES.md#promociones) |
| Combos | [DATABASE-SALES.md](./DATABASE-SALES.md#combos) |
| Mercado Pago | [DATABASE-SALES.md](./DATABASE-SALES.md#mercado-pago) |
| Turnos de caja | [DATABASE-CASH.md](./DATABASE-CASH.md#turnos-de-caja) |
| Movimientos de efectivo | [DATABASE-CASH.md](./DATABASE-CASH.md#movimientos-de-efectivo) |
| Arqueos | [DATABASE-CASH.md](./DATABASE-CASH.md#arqueos) |
| Integración Cianbox | [DATABASE-CORE.md](./DATABASE-CORE.md#conexión-cianbox) |

---

## Archivo Original

El contenido original de este archivo ha sido respaldado en:
- `docs/archive/DATABASE.md.bak`

---

## Índice General de Documentación

Para ver el índice completo de documentación del proyecto, consulta:
- [docs/README.md](./README.md)

---

**Nota para desarrolladores:** Por favor, actualiza tus bookmarks y referencias para usar los nuevos archivos modulares. Este archivo será eliminado en futuras versiones.
