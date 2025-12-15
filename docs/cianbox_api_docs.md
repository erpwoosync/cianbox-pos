# Documentación API Cianbox

Esta documentación ha sido generada a partir del repositorio [cianbox/api-docs](https://github.com/cianbox/api-docs).

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Webhooks](#webhooks)
3. [General](#general)
4. [Productos](#productos)
5. [Clientes](#clientes)
6. [Pedidos/Órdenes](#pedidosórdenes)
7. [Ventas](#ventas)
8. [Mercado Libre](#mercado-libre)

---

## Autenticación

### Obtener credenciales

**Descripción:**
Obtiene las credenciales de acceso (token de acceso y refresco) usando usuario y contraseña válidos de Cianbox.

**URL:**
`https://cianbox.org/{cuenta}/api/v2/auth/credentials`

**Método:** `POST`

**Parámetros:**

| Parámetro | Requerido | Descripción | Ejemplo |
|---|---|---|---|
| app_name | SI | Nombre de la aplicación | Mi App re Copada |
| app_code | SI | Código de la aplicación | mi-app-re-copada |
| user | SI | Nombre de usuario de Cianbox | |
| password | SI | Contraseña de Cianbox | |

**Ejemplos:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{"app_name":"Mi App","app_code":"mi-app","user":"usuario","password":"secreto1234"}' \
'https://cianbox.org/micuenta/api/v2/auth/credentials'

curl -X POST -H "Content-Type: application/x-www-form-urlencoded" \
-d "app_name=Mi App&app_code=mi-app&user=usuario&password=secreto1234" \
'https://cianbox.org/micuenta/api/v2/auth/credentials'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "auth",
    "method": "POST",
    "body": {
        "access_token": "CBX_AT-R8xyfKa0Wi9qeIG5-130033-q2cxQIojoHVQnsXxmiXQinXmJlUEWt1p-570984383",
        "refresh_token": "CBX_RT-8hY8A80WGMiHVKCKFOrXjtMP-734794790-SkAeRIGtEJeQRmhG-446258",
        "expires_in": 85497
    }
}
```

**Valor Descripción:**
* `access_token`: Token de acceso temporal, vence cada 24 horas (tiempo restante determinado por expires_in)
* `refresh_token`: Token de refresco, sirve para solicitar un nuevo token de acceso. Vence cada 600 días, y una vez vencido hay que repetir el proceso de obtención de credenciales vía usuario y contraseña
* `expires_in`: Tiempo restante del token de acceso expresado en segundos

### Renovar credenciales

**Descripción:**
Obtiene un nuevo token de acceso usando un token de refresco válido.

**URL:**
`https://cianbox.org/{cuenta}/api/v2/auth/refresh`

**Método:** `POST`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| refresh_token | SI | Token de refresco válido |

**Ejemplos:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{"refresh_token":"CBX_RT-czntKqNbP87PLT6ai2c0mDle-289145332-3ONbLx2q4o9AtkZu-559849"}' \
'https://cianbox.org/micuenta/api/v2/auth/refresh'

curl -X POST -H "Content-Type: application/x-www-form-urlencoded" \
-d "refresh_token=CBX_RT-czntKqNbP87PLT6ai2c0mDle-289145332-3ONbLx2q4o9AtkZu-559849" \
'https://cianbox.org/micuenta/api/v2/auth/refresh'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "auth",
    "method": "POST",
    "body": {
        "access_token": "CBX_AT-c2pGCQqkR8QefYGw-947800-R6Rq8NwqvrCHuk9zmoddW49bDbhrMGqD-311038496",
        "expires_in": 86107
    }
}
```

**Valor Descripción:**
* `access_token`: Token de acceso temporal, vence cada 24 horas (tiempo restante determinado por expires_in)
* `expires_in`: Tiempo restante del token de acceso expresado en segundos

---

## Webhooks

### Recibe notificaciones

Para que tu aplicación pueda conocer los eventos que se producen del lado de Cianbox® y actuar en consecuencia, podés suscribir una o varias URLs (webhooks) a nuestro sistema de notificaciones.

Disponemos de una variedad de eventos que disparan notificaciones en tiempo real cuando se realizan diferentes acciones dentro de Cianbox®. Por ej. cuando el usuario cambia el precio de un producto, se modifican los datos de un cliente o se da de baja un pedido.

Con los siguientes recursos podés manejar tus suscripciones:

* Listar eventos y webhooks
* Asignar un webhook a eventos
* Dar de baja un webhook

Una vez suscripto vas a recibir el siguiente JSON en tu/s URL/s:

```json
{
    "event":"productos",
    "created":"2019-05-24 10:58:44",
    "id":[
        "10564", "10725", "587", "964"
    ],
    "endpoint":"productos"
}
```

Cada evento puede notificar hasta 200 ids por cada petición. Así mismo los recursos GET tambien permiten hasta 200 ids por cada petición, facilitando así la sincronización de los datos.

Por ejempo con los datos de arriba podemos hacer la siguiente petición:

```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/productos?id=10564,10725,587,964&access_token=CBX_AT-TcIHdWOvdpIMx...'
```

**Consideraciones:**
* Para que la entrega de la notificación se considere exitosa, tu aplicación deberá devolver un estado HTTP 200.
* Tu aplicación debe responder antes de los 30 segundos, de lo contrario se considerará la notificación como fallida.

**Eventos:**

Los eventos a los cuales podés suscribir tus URLs son:

| Evento | Recurso |
|---|---|
| clientes | `https://cianbox.org/micuenta/api/v2/clientes` |
| pedidos | `https://cianbox.org/micuenta/api/v2/pedidos` |
| productos | `https://cianbox.org/micuenta/api/v2/productos` |
| categorias | `https://cianbox.org/micuenta/api/v2/productos/categorias` |
| marcas | `https://cianbox.org/micuenta/api/v2/productos/marcas` |
| listas_precio | `https://cianbox.org/micuenta/api/v2/productos/listas` |
| sucursales | `https://cianbox.org/micuenta/api/v2/productos/sucursales` |
| cotizaciones | `https://cianbox.org/micuenta/api/v2/general/cotizaciones` |
| estados | `https://cianbox.org/micuenta/api/v2/pedidos/estados` |

**Código de ejemplo (PHP):**
```php
<?php
header("Access-Control-Allow-Orgin: *");
header("Access-Control-Allow-Methods: *");
header('Content-Type: application/json; charset=UTF-8');
header("HTTP/1.1 200 OK");

$data = json_decode(file_get_contents("php://input"), TRUE);

$evento = $data['event'];
$ids    = $data['id'];
/*
 * Acá va el código de tu aplicación para realizar la petición a la API
 */
?>
```

### Listar eventos y webhooks

**Descripción:**
Obtiene un listado de los webhooks configurados para cada evento

**URL:**
`https://cianbox.org/{cuenta}/api/v2/general/notificaciones`
o
`https://cianbox.org/{cuenta}/api/v2/general/notificaciones/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id de los eventos ej. 2 o 1,3,4 |
| evento | NO | nombres de los eventos ej. producto o clientes,marca,categoria |

Se puede filtrar por id o por evento, pero no por los dos a la vez.
Los eventos disponibles son: clientes, pedidos, productos, categorias, marcas, listas_precio, sucursales, cotizaciones

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/general/notificaciones?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "gr_config",
    "method": "GET",
    "body": [
        {
            "id": 1,
            "evento": "clientes",
            "creado": "2019-05-21 22:39:27",
            "updated": "2019-05-23 22:26:08",
            "url": "http://urldeejemplo.com.ar/ntf.php"
        },
        ...
    ]
}
```

### Asignar un webhook a eventos

**Descripción:**
Asigna un webhook a un evento

**URL:**
`https://cianbox.org/{cuenta}/api/v2/general/notificaciones/alta`

**Método:** `POST`

**Parámetros:**
```json
{
    "evento": ["clientes", "pedidos"],
    "url": "http://urldeejemplo.com.ar/ntf.php"
}
```
La variable evento puede ser un array con los nombres de los eventos o un string "all" para asignar a todos los eventos.
Los eventos disponibles son: clientes, pedidos, productos, categorias, marcas, listas_precio, sucursales, cotizaciones y estados.

**Ejemplo:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{ \
        "evento": ["productos", "marcas", "categorias"], \
        "url": "http://urldeejemplo.com.ar/ntf.php" \
    }' \
'https://cianbox.org/micuenta/api/v2/general/notificaciones/alta?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "gr_config",
    "method": "POST",
    "body": {
        "status": "ok",
        "descripcion": "La url se informó con éxito"
    }
}
```

### Dar de baja un webhook

**Descripción:**
Da de baja un webhook relacionado a uno o más eventos

**URL:**
`https://cianbox.org/{cuenta}/api/v2/general/notificaciones`
o
`https://cianbox.org/{cuenta}/api/v2/general/notificaciones/eliminar`

**Método:** `DELETE`

**Parámetros:**
```json
{
    "evento": ["clientes", "pedidos"]
}
```
La variable evento puede ser un array con los nombres de los eventos o un string "all" para asignar a todos los eventos.

**Ejemplo:**
```bash
curl -X DELETE -H "Content-Type: application/json" \
-d '{ \
        "evento": ["productos", "marcas", "categorias"] \
    }' \
'https://cianbox.org/micuenta/api/v2/general/notificaciones?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "gr_config",
    "method": "DELETE",
    "body": {
        "status": "ok",
        "descripcion": "La url se eliminó con éxito"
    }
}
```

---

## General

### Obtener Cotizaciones

**Descripción:**
Obtiene una cotización o lista de cotizaciones

**URL:**
`https://cianbox.org/{cuenta}/api/v2/general/cotizaciones`
o
`https://cianbox.org/{cuenta}/api/v2/general/cotizaciones/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id de la cotización ej. 1 o 1,3,4 |
| moneda | NO | id de la moneda ej. 1 o 1,2 |
| fecha | NO | fecha de la cotización ej. 2019-01-01 |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/general/cotizaciones?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "gr_config",
    "method": "GET",
    "body": [
        {
            "id": 1,
            "moneda": "Dolar",
            "compra": "44.00",
            "venta": "46.00",
            "fecha": "2019-05-21 10:00:00"
        }
    ]
}
```

---

## Productos

### Obtener Productos

**Descripción:**
Obtiene un producto o lista de productos

**URL:**
`https://cianbox.org/{cuenta}/api/v2/productos`
o
`https://cianbox.org/{cuenta}/api/v2/productos/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id del producto ej. 100 o 100,101,102 |
| codigo | NO | código del producto ej. PROD-01 |
| id_marca | NO | id de la marca |
| id_categoria | NO | id de la categoría |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/productos?limit=5&access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "scheme": "https",
    "host": "cianbox.org",
    "account": "micuenta",
    "module": "pv_productos",
    "method": "GET",
    "body": [
        {
            "id": 100,
            "codigo": "PROD-100",
            "producto": "Producto de Ejemplo",
            "stock": 50,
            "precio": 1500.00,
            ...
        }
    ]
}
```

### Obtener Marcas

**Descripción:**
Obtiene una marca o lista de marcas

**URL:**
`https://cianbox.org/{cuenta}/api/v2/productos/marcas`
o
`https://cianbox.org/{cuenta}/api/v2/productos/marcas/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id de la marca ej. 5 o 5,6,7 |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/productos/marcas?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 5,
            "marca": "Marca Ejemplo"
        }
    ]
}
```

### Obtener Categorías

**Descripción:**
Obtiene una categoría o lista de categorías

**URL:**
`https://cianbox.org/{cuenta}/api/v2/productos/categorias`
o
`https://cianbox.org/{cuenta}/api/v2/productos/categorias/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id de la categoría ej. 10 o 10,11 |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/productos/categorias?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 10,
            "categoria": "Categoría Ejemplo",
            "padre": 0
        }
    ]
}
```

### Obtener Listas de Precio

**Descripción:**
Obtiene una lista de precios o todas

**URL:**
`https://cianbox.org/{cuenta}/api/v2/productos/listas`
o
`https://cianbox.org/{cuenta}/api/v2/productos/listas/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id de la lista ej. 1 o 1,2 |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/productos/listas?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 1,
            "lista": "Lista Minorista",
            "moneda": "Pesos"
        }
    ]
}
```

### Cargar un Ajuste de Stock

**Descripción:**
Realiza un ajuste de stock en una sucursal, sobre varios productos

**URL:**
`https://cianbox.org/{cuenta}/api/v2/productos/ajuste_stock/alta`

**Método:** `POST`

**Parámetros:**
```json
{
    "id_sucursal": 5,
    "id_usuario": 3,
    "ajustes": [
        {"id_producto": 265, "stock": 10.00},
        {"id_producto": 761, "stock": 2.00},
        {"id_producto": 17, "stock": 0.00}
    ]
}
```

**Ejemplo:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{ \
    "id_sucursal": 5,\
    "id_usuario": 3,\
    "ajustes": [\
        {"id_producto": 265, "stock": 10.00},\
        {"id_producto": 761, "stock": 2.00},\
        {"id_producto": 17, "stock": 0.00}\
    ]\
    }'\
'https://cianbox.org/micuenta/api/v2/productos/ajuste_stock/alta?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": {
        "status": "ok",
        "description": "El ajuste de stock se cargó correctamente"
    }
}
```

---

## Clientes

### Obtener Clientes

**Descripción:**
Obtiene un cliente o lista de clientes

**URL:**
`https://cianbox.org/{cuenta}/api/v2/clientes`
o
`https://cianbox.org/{cuenta}/api/v2/clientes/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id del cliente ej. 100 o 100,101 |
| documento | NO | documento del cliente |
| email | NO | email del cliente |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/clientes?limit=5&access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 100,
            "razon": "Juan Perez",
            "documento": "20123456789",
            "email": "juan@example.com",
            ...
        }
    ]
}
```

### Cargar un Cliente

**Descripción:**
Da de alta un nuevo cliente

**URL:**
`https://cianbox.org/{cuenta}/api/v2/clientes/alta`

**Método:** `POST`

**Parámetros:**
(Ver documentación completa para lista de campos)

**Ejemplo:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{"razon":"Nuevo Cliente", "documento":"20112233445"}' \
'https://cianbox.org/micuenta/api/v2/clientes/alta?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": {
        "id": 105,
        "status": "ok",
        "description": "El cliente se cargó correctamente"
    }
}
```

### Editar un Cliente

**Descripción:**
Edita un cliente existente

**URL:**
`https://cianbox.org/{cuenta}/api/v2/clientes/editar`

**Método:** `PUT`

**Parámetros:**
Requiere `id` del cliente y campos a modificar.

**Ejemplo:**
```bash
curl -X PUT -H "Content-Type: application/json" \
-d '{"id": 105, "razon":"Cliente Modificado"}' \
'https://cianbox.org/micuenta/api/v2/clientes/editar?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": {
        "status": "ok",
        "description": "El cliente se modificó correctamente"
    }
}
```

---

## Pedidos/Órdenes

### Obtener Pedidos

**Descripción:**
Obtiene un pedido o lista de pedidos

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos`
o
`https://cianbox.org/{cuenta}/api/v2/pedidos/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id del pedido ej. 1000 |
| id_cliente | NO | id del cliente |
| fecha_desde | NO | fecha desde (creación) |
| fecha_hasta | NO | fecha hasta (creación) |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/pedidos?limit=5&access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 1000,
            "fecha": "2019-05-20",
            "cliente": "Juan Perez",
            "total": 5000.00,
            ...
        }
    ]
}
```

### Crear un Pedido

**Descripción:**
Crea un nuevo pedido

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/alta`

**Método:** `POST`

**Parámetros:**
(Ver documentación completa para estructura JSON)

**Ejemplo:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{ "id_cliente": 100, "items": [...] }' \
'https://cianbox.org/micuenta/api/v2/pedidos/alta?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": {
        "id": 1001,
        "status": "ok",
        "description": "El pedido se cargó correctamente"
    }
}
```

### Obtener Estados de Pedidos

**Descripción:**
Obtiene los estados de pedidos disponibles

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/estados`

**Método:** `GET`

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/pedidos/estados?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 1,
            "estado": "Pendiente",
            "color": "#ff0000"
        }
    ]
}
```

### Cargar un Estado de Pedidos

**Descripción:**
Crea un nuevo estado de pedido

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/estados/alta`

**Método:** `POST`

**Ejemplo:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{"estado":"En Preparacion", "color":"#00ff00"}' \
'https://cianbox.org/micuenta/api/v2/pedidos/estados/alta?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

### Editar un Estado de Pedidos

**Descripción:**
Edita un estado de pedido

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/estados/editar`

**Método:** `PUT`

### Dar de baja un Estado de Pedidos

**Descripción:**
Elimina un estado de pedido

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/estados/eliminar`

**Método:** `DELETE`

### Dar de baja un Pedido

**Descripción:**
Elimina (anula) un pedido

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/eliminar`

**Método:** `DELETE`

**Parámetros:**
`id`: ID del pedido a eliminar.

**Ejemplo:**
```bash
curl -X DELETE -H "Content-Type: application/json" \
-d '{"id": 1001}' \
'https://cianbox.org/micuenta/api/v2/pedidos/eliminar?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

### Editar Observaciones de un Pedido

**Descripción:**
Edita las observaciones de un pedido existente

**URL:**
`https://cianbox.org/{cuenta}/api/v2/pedidos/editar-observaciones`

**Método:** `PUT`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido (query param) |
| id | SI | ID del pedido (query param) |

**Payload:**
```json
{
  "observaciones": "Esta es una observación de prueba"
}
```

**Ejemplo:**
```bash
curl -X PUT -H "Content-Type: application/json" \
-d '{"observaciones": "Esta es una observación de prueba"}' \
'https://cianbox.org/micuenta/api/v2/pedidos/editar-observaciones?id=1001&access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": {
        "status": "ok",
        "description": "Las observaciones se modificaron correctamente"
    }
}
```

---

## Ventas

### Obtener Ventas

**Descripción:**
Obtiene una venta o lista de ventas

**URL:**
`https://cianbox.org/{cuenta}/api/v2/ventas`
o
`https://cianbox.org/{cuenta}/api/v2/ventas/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id | NO | id de la venta |
| fecha_desde | NO | fecha desde |
| fecha_hasta | NO | fecha hasta |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/ventas?limit=5&access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 5000,
            "fecha": "2019-05-20",
            "total": 1500.00,
            ...
        }
    ]
}
```

---

## Mercado Libre

### Obtener Ventas ML

**Descripción:**
Obtiene una venta o lista de ventas de Mercado Libre

**URL:**
`http://cianbox.test/{cuenta}/api/v2/mercadolibre/ventas`
o
`http://cianbox.test/{cuenta}/api/v2/mercadolibre/ventas/lista`

**Método:** `GET`

**Parámetros:**

| Parámetro | Requerido | Descripción |
|---|---|---|
| access_token | SI | Token de acceso válido |
| id_usuario_externo | NO | id del usuario que provee MercadoLibre |
| id_venta_ml | NO | Filtra por id de venta traído de ML |
| id_user_ml | NO | Filtra por id de la cuenta (integración) brindado por MercadoLibre |
| id_publicacion_ml | NO | Filtra por id de la publicacion ML |
| vigente | NO | Filtrar por las ventas vigentes / no vigentes |
| cancelada | NO | Filtrar por las ventas canceladas |
| limit | NO | Límite de ítems por petición |
| page | NO | Página solicitada |

**Ejemplo:**
```bash
curl -X GET 'https://cianbox.org/micuenta/api/v2/mercadolibre/ventas?access_token=CBX_AT-TcIHdWOvdpIMNsXG...'
```

**Respuesta:**
```json
{
    "status": "ok",
    "body": [
        {
            "id": 25422,
            "id_venta_ml": "2000009999999999",
            "detalle": { ... },
            ...
        }
    ]
}
```
