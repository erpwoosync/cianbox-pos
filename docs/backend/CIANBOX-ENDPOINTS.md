# Sincronización Cianbox - Endpoints y Webhooks

**Endpoints de sincronización y sistema de webhooks**

## Endpoints

### GET /api/cianbox/connection

Obtener configuración de conexión.

**Autenticación:** Bearer token + permiso `settings:edit`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conn123",
    "cuenta": "mi-tienda",
    "appName": "POS",
    "appCode": "pos-001",
    "user": "api_user",
    "syncPageSize": 50,
    "isActive": true,
    "lastSync": "2025-12-21T10:30:00Z",
    "syncStatus": "SUCCESS",
    "webhookUrl": "https://pos.example.com/api/cianboxwebhooks/tenant123"
  }
}
```

### POST /api/cianbox/connection

Configurar conexión a Cianbox.

**Request:**
```json
{
  "cuenta": "mi-tienda",
  "appName": "POS",
  "appCode": "pos-001",
  "user": "api_user",
  "password": "contraseña_segura",
  "syncPageSize": 50
}
```

**Proceso:**
1. Validar credenciales
2. Intentar autenticar con Cianbox
3. Si OK: guardar conexión
4. Si FAIL: retornar error y no guardar

### PUT /api/cianbox/connection

Actualizar conexión.

**Nota:** Si se cambian credenciales, se limpian los tokens.

### DELETE /api/cianbox/connection

Eliminar conexión.

### POST /api/cianbox/connection/test

Probar conexión.

**Response:**
```json
{
  "success": true,
  "message": "Conexión exitosa. Se encontraron 125 categorías."
}
```

### POST /api/cianbox/sync/all

Sincronizar todos los datos.

**Autenticación:** Bearer token + permiso `settings:edit`

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": 45,
    "brands": 78,
    "products": 1523,
    "priceLists": 3,
    "branches": 5,
    "customers": 450
  },
  "message": "Sincronización completada: 1523 productos, 45 categorías..."
}
```

**Orden de sincronización:**
1. Categorías (primero)
2. Marcas
3. Listas de Precios
4. Sucursales
5. Productos (último, depende de categorías/marcas)
6. Clientes (opcional)

### POST /api/cianbox/sync/products

Sincronizar solo productos.

**Response:**
```json
{
  "success": true,
  "data": { "synced": 1523 },
  "message": "1523 productos sincronizados"
}
```

### POST /api/cianbox/sync/categories

Sincronizar solo categorías.

### POST /api/cianbox/sync/brands

Sincronizar solo marcas.

### POST /api/cianbox/sync/price-lists

Sincronizar listas de precios.

### POST /api/cianbox/sync/branches

Sincronizar sucursales.

### POST /api/cianbox/sync/customers

Sincronizar clientes.

### GET /api/cianbox/sync/status

Estado de última sincronización.

**Response:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "isActive": true,
    "lastSync": "2025-12-21T10:30:00Z",
    "syncStatus": "SUCCESS",
    "counts": {
      "products": 1523,
      "categories": 45,
      "brands": 78,
      "branches": 5,
      "priceLists": 3,
      "customers": 450
    }
  }
}
```

## Webhooks de Cianbox

Cianbox puede notificar cambios en tiempo real mediante webhooks.

### Eventos Soportados

- `productos` - Producto creado/modificado
- `categorias` - Categoría creada/modificada
- `marcas` - Marca creada/modificada
- `listas_precio` - Lista de precios modificada

### POST /api/cianboxwebhooks/:tenantId

Recibir webhook de Cianbox.

**No requiere autenticación** (valida IP/origen de Cianbox)

**Request (ejemplo - producto modificado):**
```json
{
  "evento": "productos",
  "accion": "modificar",
  "id": 123,
  "datos": {
    "id": 123,
    "nombre": "Producto Actualizado",
    "precio": 15999
  }
}
```

**Proceso:**
1. Validar tenantId
2. Identificar evento (productos, categorias, marcas)
3. Extraer IDs modificados
4. Llamar a `upsertProductsByIds([123])` para actualizar solo ese producto
5. Responder 200 OK

### Registrar Webhooks

```typescript
const service = await CianboxService.forTenant(tenantId);
await service.registerWebhook(
  ['productos', 'categorias'],
  'https://pos.example.com/api/cianboxwebhooks/tenant123'
);
```

### Listar Webhooks Registrados

```typescript
const webhooks = await service.listWebhooks();
// [{
//   evento: 'productos',
//   url: 'https://pos.example.com/api/cianboxwebhooks/tenant123'
// }]
```

### Eliminar Webhooks

```typescript
await service.deleteWebhook(['productos', 'categorias']);
```

### Configurar Webhooks (Opcional)

```typescript
const webhookUrl = `https://pos.example.com/api/cianboxwebhooks/${tenantId}`;
await service.registerWebhook(
  ['productos', 'categorias', 'marcas'],
  webhookUrl
);
```

## Troubleshooting

### Error: Credenciales inválidas

**Causa:** Usuario/contraseña incorrectos

**Solución:** Verificar credenciales en Cianbox

### Error: Token expirado

**Causa:** Access token venció

**Solución:** El servicio renueva automáticamente usando refresh token

### Productos no se sincronizan

**Causa:** Categorías/marcas no sincronizadas primero

**Solución:** Ejecutar `syncAll()` o sincronizar categorías antes que productos

### Stock no se actualiza

**Causa:** Sucursales no sincronizadas

**Solución:** Ejecutar `syncBranches()` antes de `syncProducts()`

## Documentación Relacionada

- [CIANBOX-MODELO.md](./CIANBOX-MODELO.md) - Modelo y servicio
