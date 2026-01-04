# Manual de Usuario - Cianbox POS Backoffice

**Panel de Administración para Gestión de tu Negocio**

Versión: 1.0.0
Fecha: Diciembre 2024

---

## ¿Qué es Cianbox POS Backoffice?

Cianbox POS Backoffice es el panel de administración donde puedes gestionar todos los aspectos de tu negocio: productos, precios, stock, ventas, usuarios, y configuraciones. Es como el "cerebro" de tu sistema de punto de venta, donde tomas las decisiones importantes sobre cómo funciona tu tienda.

---

## Primeros Pasos

### Cómo acceder al sistema

1. Abre tu navegador web (Chrome, Firefox, Edge)
2. Ve a la dirección que te proporcionó tu proveedor (ejemplo: `https://backoffice.tutienda.com`)
3. Ingresa tu correo electrónico
4. Ingresa tu contraseña
5. Presiona el botón **"Iniciar Sesión"**

**Resultado esperado:** Verás el panel principal con las opciones del menú a la izquierda.

### Si olvidaste tu contraseña

1. En la pantalla de inicio de sesión, haz clic en **"¿Olvidaste tu contraseña?"**
2. Ingresa tu correo electrónico
3. Presiona **"Enviar"**
4. Revisa tu correo electrónico (también la carpeta de spam)
5. Haz clic en el enlace que recibiste
6. Ingresa tu nueva contraseña dos veces
7. Presiona **"Cambiar Contraseña"**

**Resultado esperado:** Podrás iniciar sesión con tu nueva contraseña.

---

## Panel Principal (Dashboard)

Al iniciar sesión, verás el panel principal con información resumida de tu negocio:

### Tarjetas de Resumen

**Ventas del día**
- **¿Qué muestra?** El dinero total vendido hoy
- **Ejemplo:** Si vendiste $150,000 hoy, verás: **Ventas del Día: $150,000**

**Ventas del mes**
- **¿Qué muestra?** El dinero total vendido en el mes actual
- **Útil para:** Comparar con meses anteriores y ver si tu negocio está creciendo

**Productos con stock bajo**
- **¿Qué muestra?** Cantidad de productos que se están agotando
- **Acción recomendada:** Si hay productos en rojo, deberías reponerlos pronto

**Transacciones hoy**
- **¿Qué muestra?** Cuántas ventas se realizaron hoy
- **Útil para:** Ver qué tan activo estuvo el día

### Gráficos

**Ventas de los últimos 7 días**
- **¿Para qué sirve?** Ver las tendencias de venta de la semana
- **Cómo leerlo:** Las barras más altas son los días con más ventas

**Productos más vendidos**
- **¿Para qué sirve?** Identificar qué productos debes tener siempre en stock
- **Acción recomendada:** Los productos de arriba son tus "estrellas", nunca los dejes agotar

---

## Gestión de Productos

### Ver todos tus productos

1. Haz clic en **"Productos"** en el menú lateral izquierdo
2. Verás una tabla con todos tus productos

**Información que verás:**
- **Nombre:** Cómo se llama el producto
- **SKU:** Código interno del producto (si lo tienes)
- **Código de Barras:** Número que escanea el lector de código de barras
- **Categoría:** A qué grupo pertenece (Remeras, Zapatillas, etc.)
- **Precio:** Cuánto cuesta
- **Stock:** Cuántas unidades tienes disponibles
- **Estado:** Si está activo (se puede vender) o inactivo

### Buscar un producto específico

1. Usa la barra de búsqueda en la parte superior
2. Escribe el nombre, código de barras o SKU del producto
3. Presiona **Enter**

**Resultado esperado:** La tabla mostrará solo los productos que coincidan con tu búsqueda.

### Ver detalles de un producto

1. Haz clic en el nombre del producto en la tabla
2. Se abrirá una página con toda la información detallada

**Información disponible:**
- Nombre completo y descripción
- Imágenes del producto
- Precios por lista (Minorista, Mayorista, etc.)
- Stock disponible por sucursal
- Historial de ventas
- Si tiene variantes (talles, colores)

### Agregar un producto nuevo

**IMPORTANTE:** Si tu sistema está conectado a Cianbox, los productos se agregan automáticamente desde allí. Esta opción es solo para productos locales.

1. Haz clic en **"Productos"**
2. Haz clic en el botón **"+ Nuevo Producto"** (esquina superior derecha)
3. Completa el formulario:
   - **Nombre:** Escribe el nombre del producto (ejemplo: "Remera Lisa Negra")
   - **Categoría:** Selecciona de la lista desplegable
   - **Marca:** Selecciona de la lista desplegable
   - **Código de Barras:** Escanea o escribe el código
   - **Precio:** Ingresa el precio de venta (con IVA incluido)
   - **Stock Inicial:** Cuántas unidades tienes
   - **Descripción:** (Opcional) Detalles adicionales
4. Si tienes una foto, haz clic en **"Subir Imagen"**
5. Presiona **"Guardar"**

**Resultado esperado:** El producto aparecerá en la lista y ya estará disponible para vender.

### Modificar un producto existente

1. Busca el producto en la lista
2. Haz clic en el ícono del lápiz (✏️) en la columna "Acciones"
3. Modifica los campos que necesites cambiar
4. Presiona **"Guardar Cambios"**

**Resultado esperado:** Los cambios se aplicarán inmediatamente. Si cambias el precio, afectará las próximas ventas.

### Desactivar un producto (dejar de venderlo)

1. Busca el producto en la lista
2. Haz clic en el interruptor de "Estado" para apagarlo
3. Confirma la acción si te lo pregunta

**Resultado esperado:** El producto ya no aparecerá en el punto de venta, pero conservarás su historial.

### Productos con Variantes (Curva de Talles)

Si vendes ropa, calzado o productos que vienen en diferentes talles/colores, estos se manejan de forma especial:

**Cómo verlos:**
1. El producto "padre" se llama igual sin talle (ejemplo: "Zapatilla Nike Air")
2. Al hacer clic, verás todas las variantes (talle 38, 39, 40, etc.)
3. Cada talle tiene su propio stock

**Cómo agregar stock a un talle específico:**
1. Haz clic en el producto padre
2. En la sección "Variantes", busca el talle
3. Haz clic en el ícono de stock
4. Ingresa la cantidad de unidades que ingresaron
5. Presiona **"Actualizar"**

---

## Gestión de Stock

### Ver el stock de todos los productos

1. Haz clic en **"Stock"** en el menú lateral
2. Verás una tabla con el stock de cada producto

**Información que verás:**
- **Producto:** Nombre del producto
- **Sucursal:** En qué local está el stock
- **Stock Actual:** Cuántas unidades hay ahora
- **Stock Reservado:** Unidades apartadas para ventas pendientes
- **Stock Disponible:** Lo que realmente puedes vender (Stock Actual - Reservado)
- **Stock Mínimo:** Cantidad de alerta (cuando llegue a este número, te avisará)

### Buscar el stock de un producto específico

1. Usa la barra de búsqueda
2. Escribe el nombre o código del producto
3. Presiona **Enter**

### Actualizar el stock de un producto

**Cuándo hacerlo:**
- Cuando recibes mercadería nueva
- Cuando haces un inventario y encontraste diferencias
- Cuando devolviste mercadería a un proveedor

**Cómo hacerlo:**
1. En la lista de stock, busca el producto
2. Haz clic en el ícono de edición (✏️)
3. Verás el stock actual
4. Ingresa el **nuevo stock total** (no lo que sumaste, sino el total que hay ahora)
5. (Opcional) Agrega un comentario explicando por qué cambiaste el stock
6. Presiona **"Actualizar"**

**Ejemplo:**
- Tenías 50 unidades
- Recibiste 30 más
- Ahora tienes 80 en total
- **Ingresa 80** en el campo de stock

**Resultado esperado:** El stock se actualiza inmediatamente y los cajeros verán la nueva cantidad disponible.

### Ver productos con stock bajo

1. En el panel principal (Dashboard), mira la tarjeta **"Productos con Stock Bajo"**
2. Haz clic en **"Ver Detalles"**
3. Verás la lista de productos que necesitan reposición

**Acción recomendada:**
- Imprime la lista
- Usa esta lista para hacer tu pedido al proveedor
- O transfiere stock desde otra sucursal si tienes

### Transferir stock entre sucursales

**NOTA:** Esta función requiere que tengas más de una sucursal configurada.

1. Haz clic en **"Stock"**
2. Haz clic en **"Transferencias"**
3. Haz clic en **"+ Nueva Transferencia"**
4. Selecciona:
   - **Desde:** La sucursal que tiene el producto
   - **Hacia:** La sucursal que lo necesita
   - **Producto:** Busca y selecciona el producto
   - **Cantidad:** Cuántas unidades transferir
5. Presiona **"Crear Transferencia"**
6. Imprime el comprobante para adjuntar al envío físico
7. En la sucursal destino, cuando llegue la mercadería, haz clic en **"Confirmar Recepción"**

**Resultado esperado:** El stock se descuenta de la sucursal origen y se suma a la destino.

---

## Gestión de Precios

### Ver precios de productos

1. Haz clic en **"Precios"** en el menú lateral
2. Verás todos tus productos con sus precios por lista

**Listas de Precios:**
Tu negocio puede tener varias listas de precios, por ejemplo:
- **Lista Minorista:** Precio normal para clientes finales
- **Lista Mayorista:** Precio con descuento para revendedores
- **Lista VIP:** Precio especial para clientes frecuentes

### Cambiar el precio de un producto

1. En la lista de precios, busca el producto
2. Haz clic en el ícono de edición (✏️)
3. Verás los precios en cada lista
4. Modifica el precio que necesites cambiar
5. Presiona **"Guardar"**

**Resultado esperado:** El nuevo precio se aplicará a todas las ventas nuevas desde ese momento.

### Cambiar precios masivamente (Remarcación)

**Cuándo usarlo:**
- Cuando aumentas todos los precios por inflación
- Cuando aplicas un descuento general a una categoría

**Cómo hacerlo:**
1. Haz clic en **"Precios"**
2. Haz clic en **"Actualización Masiva"**
3. Selecciona los productos:
   - **Todos los productos**, o
   - **Por Categoría** (ejemplo: todas las remeras), o
   - **Por Marca**
4. Elige el tipo de cambio:
   - **Porcentaje:** Ejemplo: +15% aumenta todos los precios un 15%
   - **Monto Fijo:** Ejemplo: +$500 suma $500 a cada producto
5. Vista previa: Verás cómo quedarán los precios
6. Si está correcto, presiona **"Aplicar Cambios"**

**IMPORTANTE:** Esta acción no se puede deshacer fácilmente, revisa bien antes de confirmar.

**Resultado esperado:** Todos los precios seleccionados cambiarán según el porcentaje o monto que elegiste.

---

## Gestión de Ventas

### Ver todas las ventas realizadas

1. Haz clic en **"Ventas"** en el menú lateral
2. Verás una lista de todas las ventas

**Información que verás:**
- **Número de Venta:** Código único (ejemplo: SUC-1-CAJA-01-20241225-0042)
- **Fecha y Hora:** Cuándo se realizó la venta
- **Cajero:** Quién atendió la venta
- **Cliente:** Nombre del cliente (si se registró)
- **Total:** Monto total de la venta
- **Método de Pago:** Efectivo, tarjeta, QR, etc.
- **Estado:** Completada, Anulada, Devuelta

### Filtrar ventas por fecha

1. En la pantalla de ventas, busca los campos de fecha
2. **Desde:** Selecciona la fecha inicial
3. **Hasta:** Selecciona la fecha final
4. Presiona **"Filtrar"**

**Resultado esperado:** Verás solo las ventas del período seleccionado.

### Ver el detalle de una venta

1. Haz clic en el número de venta o en el ícono de ojo (👁️)
2. Se abrirá una ventana con todos los detalles:
   - **Lista de productos vendidos** con cantidades y precios
   - **Forma de pago utilizada**
   - **Comprobante fiscal** (si se emitió factura)
   - **Datos del cliente** (si los tiene)
   - **Descuentos aplicados**
3. Desde aquí puedes:
   - **Imprimir comprobante** para dárselo al cliente
   - **Facturar** si aún no se emitió factura AFIP
   - **Procesar devolución** si el cliente devuelve productos

### Anular una venta

**Cuándo hacerlo:**
- Cuando se registró una venta por error
- Cuando el cliente canceló la compra inmediatamente

**IMPORTANTE:** Solo se puede anular una venta del mismo día y requiere permisos de supervisor.

**Cómo hacerlo:**
1. Busca la venta en la lista
2. Haz clic en el ícono de tres puntos (⋮)
3. Selecciona **"Anular Venta"**
4. Ingresa el motivo de la anulación
5. Si es requerido, ingresa el PIN del supervisor
6. Presiona **"Confirmar Anulación"**

**Resultado esperado:** La venta queda marcada como anulada, el stock se repone, y el dinero se descuenta del turno de caja.

### Procesar una devolución

**Cuándo hacerlo:**
- Cuando un cliente devuelve productos defectuosos
- Cuando el cliente se arrepiente de la compra (dentro del período legal)

**Cómo hacerlo:**
1. Busca la venta original
2. Haz clic en **"Detalle"**
3. Haz clic en el botón **"Procesar Devolución"**
4. Selecciona los productos que el cliente devuelve:
   - Marca cada producto
   - Indica la cantidad (puede ser parcial)
5. Ingresa el motivo de la devolución
6. Si quieres emitir una nota de crédito fiscal (AFIP), marca la casilla
7. Presiona **"Procesar Devolución"**

**Resultado esperado:**
- El stock regresa al inventario
- Se genera una venta negativa (devolución)
- Si elegiste facturar, se emite una Nota de Crédito AFIP
- Puedes devolver el dinero al cliente según tu política

### Generar reportes de ventas

1. Haz clic en **"Ventas"**
2. Haz clic en **"Reportes"**
3. Selecciona el tipo de reporte:
   - **Ventas por Día:** Total vendido cada día
   - **Ventas por Cajero:** Quién vendió cuánto
   - **Ventas por Producto:** Qué productos se vendieron más
   - **Ventas por Método de Pago:** Cuánto ingresó por efectivo, tarjeta, etc.
4. Selecciona el período (última semana, último mes, personalizado)
5. Presiona **"Generar Reporte"**

**Resultado esperado:** Verás un reporte con gráficos y tablas. Puedes:
- **Imprimir:** Para tener una copia en papel
- **Exportar a Excel:** Para análisis más detallado
- **Exportar a PDF:** Para enviar por correo

---

## Gestión de Caja (Turnos de Cajero)

### Ver turnos de caja

1. Haz clic en **"Turnos de Caja"** en el menú lateral
2. Verás una lista de todos los turnos abiertos y cerrados

**Información que verás:**
- **Número de Turno:** Código del turno
- **Cajero:** Quién trabajó en ese turno
- **Caja:** En qué punto de venta
- **Apertura:** Fecha y hora de inicio, dinero inicial
- **Cierre:** Fecha y hora de cierre, dinero final
- **Ventas:** Cantidad y monto total de ventas del turno
- **Diferencia:** Si sobró o faltó dinero al cerrar

### Ver el detalle de un turno

1. Haz clic en el número de turno
2. Verás toda la información:
   - **Dinero de apertura:** Con qué empezó el cajero
   - **Ventas realizadas:** Listado completo
   - **Ingresos por método de pago:** Efectivo, tarjetas, QR
   - **Retiros y depósitos:** Dinero sacado o agregado durante el turno
   - **Arqueos:** Conteos de dinero realizados
   - **Dinero de cierre:** Con qué terminó el cajero
   - **Diferencia:** Sobrante o faltante

### Revisar un arqueo de caja

**¿Qué es un arqueo?**
Es cuando el cajero cuenta el dinero en efectivo de la caja, billete por billete y moneda por moneda.

**Cómo verlo:**
1. En el detalle del turno, ve a la sección **"Arqueos"**
2. Haz clic en un arqueo para ver el detalle
3. Verás:
   - **Cantidad de cada billete:** Cuántos billetes de $10,000, $5,000, etc.
   - **Cantidad de cada moneda:** Cuántas monedas de $500, $100, etc.
   - **Total contado:** Suma de todo el dinero físico
   - **Total esperado:** Lo que debería haber según las ventas
   - **Diferencia:** Si sobra o falta dinero

**Si hay diferencia:**
- **Sobrante (verde):** Hay más dinero del esperado
- **Faltante (rojo):** Hay menos dinero del esperado

### Autorizar un retiro de caja

**Cuándo se usa:**
Cuando el cajero necesita sacar dinero de la caja para:
- Depositar en caja fuerte (por seguridad)
- Llevar al banco
- Pagar a un proveedor
- Gastos menores

**Cómo hacerlo:**
1. El cajero te pedirá autorización (puede ser por teléfono o en persona)
2. Ve a **"Turnos de Caja"**
3. Busca el turno activo del cajero
4. Haz clic en **"Movimientos"**
5. Verás el retiro pendiente
6. Ingresa tu PIN de supervisor
7. Presiona **"Autorizar"**

**Resultado esperado:** El cajero podrá completar el retiro y el dinero se descontará del turno.

---

## Gestión de Clientes

### Ver todos los clientes

1. Haz clic en **"Clientes"** en el menú lateral
2. Verás una lista de todos los clientes registrados

**Información que verás:**
- **Nombre:** Nombre completo o razón social
- **Tipo de Documento:** DNI, CUIT, Pasaporte
- **Número de Documento:** El número identificatorio
- **Email:** Correo electrónico
- **Teléfono:** Número de contacto
- **Compras:** Cantidad de veces que compró
- **Total Comprado:** Dinero total que gastó en tu negocio

### Agregar un cliente nuevo

1. Haz clic en **"+ Nuevo Cliente"**
2. Completa el formulario:
   - **Tipo de Cliente:**
     - *Consumidor Final:* Cliente común que compra para uso personal
     - *Responsable Inscripto:* Empresa que factura con CUIT
     - *Monotributista:* Trabajador independiente con monotributo
   - **Nombre Completo** (o Razón Social si es empresa)
   - **Tipo de Documento:** DNI, CUIT, etc.
   - **Número de Documento**
   - **Email**
   - **Teléfono**
   - **Dirección** (Calle, Ciudad, Provincia, Código Postal)
3. Si el cliente tiene cuenta corriente (compra "fiado"):
   - Marca la casilla **"Habilitar Cuenta Corriente"**
   - Ingresa el **Límite de Crédito** (máximo que puede deber)
   - Ingresa los **Días de Crédito** (plazo para pagar)
4. Presiona **"Guardar"**

**Resultado esperado:** El cliente estará disponible para seleccionar en el punto de venta.

### Ver el historial de compras de un cliente

1. En la lista de clientes, haz clic en el nombre del cliente
2. Verás:
   - **Datos personales**
   - **Estado de cuenta corriente** (si tiene)
   - **Historial completo de compras** con fechas y montos
   - **Productos que compra frecuentemente**

**Útil para:**
- Ofrecer productos que sabes que le interesan
- Hacer seguimiento de pagos pendientes
- Aplicar descuentos especiales a clientes frecuentes

### Modificar los datos de un cliente

1. Busca al cliente en la lista
2. Haz clic en el ícono de edición (✏️)
3. Modifica los campos que necesites
4. Presiona **"Guardar Cambios"**

---

## Gestión de Usuarios (Empleados)

### Ver todos los usuarios del sistema

1. Haz clic en **"Usuarios"** en el menú lateral
2. Verás una lista de todos los usuarios

**Información que verás:**
- **Nombre:** Nombre del empleado
- **Email:** Correo con el que inicia sesión
- **Rol:** Cajero, Supervisor, Administrador, etc.
- **Sucursal:** En qué local trabaja
- **Estado:** Activo o Inactivo

### Agregar un usuario nuevo (empleado)

1. Haz clic en **"+ Nuevo Usuario"**
2. Completa el formulario:
   - **Nombre Completo**
   - **Email:** Dirección de correo (será su usuario de inicio de sesión)
   - **Contraseña:** Contraseña inicial (el usuario podrá cambiarla después)
   - **Rol:** Selecciona el rol apropiado:
     - *Cajero:* Solo puede vender en el punto de venta
     - *Supervisor:* Puede vender y autorizar descuentos/anulaciones
     - *Administrador:* Acceso completo al backoffice
   - **Sucursal:** En qué local trabajará
   - **PIN de 4 dígitos:** (Opcional) Para login rápido en el POS
3. Presiona **"Crear Usuario"**

**Resultado esperado:** El usuario recibirá un correo con sus credenciales y podrá iniciar sesión.

### Cambiar el rol de un usuario

**Cuándo hacerlo:**
- Cuando asciende a un empleado (de Cajero a Supervisor)
- Cuando necesitas dar o quitar permisos

**Cómo hacerlo:**
1. Busca al usuario en la lista
2. Haz clic en el ícono de edición (✏️)
3. En el campo **"Rol"**, selecciona el nuevo rol
4. Presiona **"Guardar Cambios"**

**Resultado esperado:** El usuario tendrá los permisos del nuevo rol la próxima vez que inicie sesión.

### Desactivar un usuario

**Cuándo hacerlo:**
- Cuando un empleado renuncia
- Cuando despides a un empleado
- Cuando suspendes temporalmente a un empleado

**Cómo hacerlo:**
1. Busca al usuario en la lista
2. Haz clic en el interruptor de "Estado" para desactivarlo
3. Confirma la acción

**Resultado esperado:** El usuario no podrá iniciar sesión, pero conservarás su historial de ventas.

### Restablecer la contraseña de un usuario

1. Busca al usuario en la lista
2. Haz clic en el ícono de tres puntos (⋮)
3. Selecciona **"Restablecer Contraseña"**
4. Elige:
   - **Enviar email:** El usuario recibirá un enlace para crear nueva contraseña, o
   - **Establecer contraseña temporal:** Tú creas una contraseña temporal
5. Presiona **"Confirmar"**

**Resultado esperado:** El usuario podrá iniciar sesión con la nueva contraseña.

---

## Integraciones

### Mercado Pago

#### Vincular tu cuenta de Mercado Pago

**¿Para qué sirve?**
Para que tus clientes puedan pagar con:
- Terminal Point (lectora de tarjetas)
- Código QR (con la billetera de Mercado Pago)

**Cómo hacerlo:**

1. Haz clic en **"Integraciones"** en el menú lateral
2. En la sección **"Mercado Pago"**, haz clic en **"Conectar Point"** (o "Conectar QR" si quieres usar QR)
3. Se abrirá una ventana de Mercado Pago
4. Inicia sesión con tu cuenta de Mercado Pago
5. Lee y acepta los permisos
6. Haz clic en **"Autorizar"**
7. Serás redirigido de vuelta al backoffice

**Resultado esperado:** Verás el mensaje "Conectado" y tus dispositivos Point o QR estarán listos para usar.

#### Ver tus dispositivos Mercado Pago Point

1. En **"Integraciones"** → **"Mercado Pago Point"**
2. Haz clic en **"Ver Dispositivos"**
3. Verás una lista de tus lectoras Point con:
   - **Nombre:** Identificación del dispositivo
   - **Número de Serie:** Serial único
   - **Estado:** Si está en línea o apagada
   - **Última Conexión:** Cuándo se usó por última vez

#### Asignar un dispositivo Point a una caja

**Cuándo hacerlo:**
Para que el cajero pueda enviar pagos a la lectora Point desde el punto de venta.

**Cómo hacerlo:**
1. Ve a **"Puntos de Venta"** (no confundir con "Integraciones")
2. Busca la caja donde está la lectora Point
3. Haz clic en el ícono de edición (✏️)
4. En el campo **"Dispositivo Mercado Pago Point"**, selecciona la lectora
5. Presiona **"Guardar"**

**Resultado esperado:** Cuando el cajero registre una venta, podrá enviar el pago a esa lectora Point.

#### Configurar QR de Mercado Pago

**Requisitos previos:**
- Tener una cuenta de Mercado Pago verificada
- Haber creado "Locales" y "Cajas" en Mercado Pago

**Cómo hacerlo:**
1. En **"Integraciones"** → **"Mercado Pago QR"**
2. Haz clic en **"Sincronizar Locales y Cajas"**
3. El sistema traerá tus locales de Mercado Pago
4. Vincula cada local con tu sucursal:
   - Busca el local
   - Haz clic en **"Vincular con Sucursal"**
   - Selecciona la sucursal correspondiente
5. Luego vincula las cajas:
   - Busca la caja QR
   - Haz clic en **"Vincular con Punto de Venta"**
   - Selecciona el punto de venta correspondiente

**Resultado esperado:** Los cajeros podrán generar códigos QR para cobros.

#### Ver pagos huérfanos

**¿Qué son?**
Pagos que se procesaron en Mercado Pago pero no se registraron como venta en tu sistema (por ejemplo, por un corte de luz o error de red).

**Cómo verlos:**
1. En **"Integraciones"** → **"Mercado Pago"**
2. Haz clic en **"Pagos Huérfanos"**
3. Verás una lista de pagos sin venta asociada con:
   - Monto del pago
   - Fecha y hora
   - Referencia (código del intento de venta)
   - Método de pago usado

**Cómo vincularlos a una venta:**
1. Haz clic en **"Crear Venta"** junto al pago
2. Verifica que el monto coincida
3. Ingresa los productos vendidos (puedes preguntarle al cajero)
4. Presiona **"Vincular y Crear Venta"**

**Resultado esperado:** El pago queda registrado correctamente y el stock se descuenta.

### Cianbox ERP

#### Conectar con Cianbox

**¿Para qué sirve?**
Para sincronizar automáticamente:
- Productos y precios
- Stock
- Categorías y marcas
- Clientes
- Ventas (las ventas del POS se envían a Cianbox)

**Cómo hacerlo:**
1. Haz clic en **"Integraciones"** → **"Cianbox"**
2. Haz clic en **"Configurar Conexión"**
3. Completa el formulario:
   - **Cuenta Cianbox:** Nombre de tu cuenta (ejemplo: "miempresa")
   - **Nombre de App:** El nombre que te dio Cianbox
   - **Código de App:** El código que te dio Cianbox
   - **Usuario:** Tu usuario de Cianbox
   - **Contraseña:** Tu contraseña de Cianbox
4. Presiona **"Probar Conexión"**
5. Si la prueba es exitosa, presiona **"Guardar"**

**Resultado esperado:** Verás el mensaje "Conexión exitosa" y podrás sincronizar datos.

#### Sincronizar productos desde Cianbox

**Cuándo hacerlo:**
- La primera vez que conectas Cianbox (para traer todo tu catálogo)
- Cuando agregas productos nuevos en Cianbox
- Una vez por día (se puede programar automático)

**Cómo hacerlo:**
1. En **"Integraciones"** → **"Cianbox"**
2. Haz clic en **"Sincronizar Productos"**
3. Espera a que el proceso termine (puede tardar varios minutos si tienes muchos productos)
4. Verás un resumen:
   - Productos nuevos agregados
   - Productos actualizados
   - Errores (si los hubo)

**Resultado esperado:** Todos tus productos de Cianbox estarán disponibles en el POS.

#### Ver el estado de sincronización

1. En **"Integraciones"** → **"Cianbox"**
2. Verás:
   - **Última Sincronización:** Fecha y hora de la última vez que se sincronizó
   - **Estado:** "Activo" o "Error"
   - **Próxima Sincronización Automática:** Cuándo se sincronizará la próxima vez

### AFIP (Facturación Electrónica)

#### Configurar facturación electrónica

**Requisitos previos:**
- Tener CUIT activo
- Estar inscripto en AFIP como facturador electrónico
- Tener certificado digital (.crt) y clave privada (.key)

**Cómo hacerlo:**

**Paso 1: Configurar datos de la empresa**

1. Haz clic en **"Integraciones"** → **"AFIP"**
2. Completa el formulario:
   - **CUIT:** Tu CUIT sin guiones (ejemplo: 20123456789)
   - **Razón Social:** Nombre legal de tu empresa
   - **Nombre de Fantasía:** (Opcional) Nombre comercial
   - **Condición frente al IVA:** Selecciona tu categoría:
     - *Responsable Inscripto:* Si eres empresa grande
     - *Monotributista:* Si pagas monotributo
   - **Dirección Fiscal:** Tu domicilio fiscal completo
   - **Fecha de Inicio de Actividades:** Cuando empezaste a facturar

**Paso 2: Generar certificado digital (Opción Fácil)**

Si aún no tienes certificado, el sistema puede generarlo automáticamente:

1. Haz clic en **"Generar Certificado Automáticamente"**
2. Ingresa:
   - **CUIT:** Tu CUIT
   - **Clave Fiscal:** Tu contraseña de AFIP
   - **Alias:** Un nombre para el certificado (ejemplo: "CIANBOX-POS-PROD")
   - **Ambiente:** Selecciona "Producción" (o "Homologación" para pruebas)
3. Presiona **"Generar"**
4. Espera (puede tardar 1-2 minutos)

**Resultado esperado:** El certificado se genera y guarda automáticamente.

**Paso 2 Alternativo: Subir certificado existente**

Si ya tienes el certificado:

1. Haz clic en **"Subir Certificado .crt"**
2. Selecciona tu archivo .crt
3. Haz clic en **"Subir Clave Privada .key"**
4. Selecciona tu archivo .key

**Paso 3: Crear puntos de venta AFIP**

Un punto de venta AFIP es como un "talonario" de facturas:

1. En **"AFIP"** → **"Puntos de Venta"**
2. Haz clic en **"+ Nuevo Punto de Venta"**
3. Ingresa:
   - **Número:** El número que te asignó AFIP (1, 2, 3, etc.)
   - **Nombre:** Un nombre descriptivo (ejemplo: "Punto Venta Local Centro")
4. (Opcional) Vincula con un punto de venta del sistema:
   - Esto permite facturar automáticamente al finalizar la venta
5. Presiona **"Guardar"**

**Paso 4: Probar que funciona**

1. Haz clic en **"Probar Conexión con AFIP"**
2. Si todo está bien, verás: "Conexión exitosa. AFIP responde OK"

**Resultado esperado:** Ya puedes emitir facturas electrónicas.

#### Emitir una factura desde el backoffice

**Cuándo hacerlo:**
- Cuando una venta no se facturó en el momento
- Cuando el cliente pide factura días después

**Cómo hacerlo:**

1. Ve a **"Ventas"**
2. Busca la venta que quieres facturar
3. Haz clic en **"Detalle"**
4. Si aún no tiene factura, verás el botón **"Emitir Factura"**
5. Haz clic en **"Emitir Factura"**
6. Completa los datos del cliente:
   - **Tipo de Documento:** DNI, CUIT, etc.
   - **Número de Documento:** El número
   - **Nombre:** Nombre del cliente
7. Selecciona el **Tipo de Comprobante**:
   - **Factura B:** Para consumidores finales
   - **Factura C:** Para monotributistas
   - **Factura A:** Solo si el cliente es Responsable Inscripto
8. Presiona **"Emitir"**
9. Espera (tarda 3-5 segundos)

**Resultado esperado:**
- Se emite la factura en AFIP
- Recibes un **CAE** (Código de Autorización Electrónica)
- Se genera un PDF con la factura
- Puedes imprimir o enviar por email al cliente

#### Ver facturas emitidas

1. Haz clic en **"Integraciones"** → **"AFIP"** → **"Comprobantes"**
2. Verás una lista de todas las facturas con:
   - Tipo (Factura B, C, A, Nota de Crédito)
   - Número
   - Cliente
   - Monto
   - CAE
   - Fecha de vencimiento del CAE

#### Emitir una Nota de Crédito (devolución)

**Cuándo hacerlo:**
Cuando procesaste una devolución y necesitas anular la factura original.

**Cómo hacerlo:**
1. Busca la venta con devolución en **"Ventas"**
2. Haz clic en **"Detalle"**
3. Si tiene factura, verás **"Emitir Nota de Crédito"**
4. Haz clic en **"Emitir Nota de Crédito"**
5. Confirma el monto (total o parcial)
6. Presiona **"Emitir"**

**Resultado esperado:** Se emite una Nota de Crédito en AFIP que anula total o parcialmente la factura original.

---

## Resolución de Problemas

### No puedo iniciar sesión

**Causa probable:** Contraseña incorrecta o cuenta desactivada.

**Solución:**
1. Verifica que tu cuenta esté activa (pregunta a tu administrador)
2. Si olvidaste la contraseña, usa **"¿Olvidaste tu contraseña?"**
3. Revisa que el teclado no tenga Bloq Mayús activado
4. Si el problema persiste, contacta a soporte técnico

### Los productos no aparecen en el punto de venta

**Causa probable:** El producto está inactivo o sin stock.

**Solución:**
1. Ve a **"Productos"**
2. Busca el producto
3. Verifica que el interruptor de "Estado" esté en verde (Activo)
4. Verifica que tenga stock disponible
5. Si el producto tiene variantes, verifica que al menos una variante tenga stock

### El stock no se actualiza después de una venta

**Causa probable:** El producto tiene configurado "No controlar stock".

**Solución:**
1. Ve a **"Productos"**
2. Busca el producto
3. Haz clic en editar
4. Verifica que la opción **"Controlar Stock"** esté activada
5. Guarda los cambios

### No puedo facturar con AFIP

**Posibles causas:**
- Certificado vencido
- AFIP en mantenimiento
- Datos incorrectos del cliente

**Solución:**
1. Ve a **"Integraciones"** → **"AFIP"**
2. Haz clic en **"Probar Conexión"**
3. Si dice "Error de certificado", necesitas renovar el certificado
4. Si dice "AFIP no disponible", espera unos minutos y reintenta
5. Si el error menciona datos del cliente, verifica el CUIT/DNI

### Un pago de Mercado Pago no aparece

**Causa probable:** Es un pago huérfano (problema de conexión).

**Solución:**
1. Ve a **"Integraciones"** → **"Mercado Pago"** → **"Pagos Huérfanos"**
2. Busca el pago por fecha y monto
3. Haz clic en **"Crear Venta"**
4. Ingresa los productos vendidos
5. Presiona **"Vincular y Crear Venta"**

### Diferencia en el turno de caja

**Causa probable:** Error en el conteo, ventas no registradas, o gastos no declarados.

**Solución:**
1. Revisa el arqueo de cierre con el cajero
2. Vuelve a contar el dinero billete por billete
3. Verifica que todas las ventas del día estén registradas
4. Revisa si hubo retiros o depósitos no autorizados
5. Documenta la diferencia y explica el motivo

### El sistema está lento

**Causa probable:** Conexión a internet lenta o muchos usuarios conectados.

**Solución:**
1. Verifica tu conexión a internet
2. Cierra pestañas del navegador que no uses
3. Cierra sesión y vuelve a iniciar
4. Si persiste, contacta a soporte técnico

---

## Preguntas Frecuentes

**P: ¿Puedo usar el sistema sin conexión a internet?**
R: No, Cianbox POS requiere conexión a internet permanente para funcionar. Los datos están en la nube para que puedas acceder desde cualquier lugar.

**P: ¿Cuántos usuarios puedo crear?**
R: Depende de tu plan. Contacta con tu proveedor para conocer el límite de tu plan.

**P: ¿Puedo cambiar precios desde el punto de venta?**
R: No, por seguridad los precios solo se pueden cambiar desde el backoffice. Los cajeros no tienen permiso para modificar precios.

**P: ¿Cómo descargo un respaldo de mi información?**
R: Tu información se respalda automáticamente todos los días. Si necesitas un respaldo manual, contacta a soporte técnico.

**P: ¿Puedo tener más de una sucursal?**
R: Sí, puedes crear múltiples sucursales y cada una tendrá su propio control de stock.

**P: ¿Qué pasa si me equivoco al cargar stock?**
R: Puedes corregirlo inmediatamente editando el stock del producto. El sistema guarda un historial de cambios.

**P: ¿Cómo sé si un empleado hizo algo incorrecto?**
R: El sistema registra quién hizo cada acción (ventas, cambios de precio, anulaciones, etc.). Puedes revisar el historial en cada sección.

**P: ¿Puedo usar Mercado Pago sin tener una lectora Point?**
R: Sí, puedes usar códigos QR. Los clientes escanean el QR con la app de Mercado Pago y pagan sin necesidad de lectora.

**P: ¿Las facturas de AFIP se envían automáticamente al cliente?**
R: No, el sistema genera el PDF de la factura pero tú debes imprimirla o enviársela al cliente por email.

**P: ¿Puedo facturar una venta de días anteriores?**
R: Sí, puedes emitir factura para cualquier venta desde el backoffice, incluso de días o semanas anteriores.

**P: ¿Qué hago si Cianbox y mi POS tienen stock diferente?**
R: Sincroniza los productos desde **"Integraciones"** → **"Cianbox"** → **"Sincronizar Productos"**. Esto traerá el stock actualizado de Cianbox.

---

## Contacto y Soporte

**Soporte Técnico:**
- Email: soporte@tuempresa.com
- Teléfono: (011) 1234-5678
- Horario: Lunes a Viernes de 9:00 a 18:00

**Documentación Adicional:**
- Manual de Usuario del POS (para cajeros)
- Guía de Integraciones
- Video tutoriales en YouTube: [tu canal]

**Actualizaciones:**
El sistema se actualiza automáticamente. No necesitas hacer nada. Cuando hay cambios importantes, recibirás un aviso en el panel.

---

**Manual generado automáticamente - Versión 1.0.0**
