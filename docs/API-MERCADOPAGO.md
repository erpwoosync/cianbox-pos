# API - Mercado Pago

Documentación completa de la integración con Mercado Pago (Point y QR).

## Descripción General

El sistema integra **dos aplicaciones separadas de Mercado Pago**:

| Aplicación | Tipo | Uso | Device |
|------------|------|-----|--------|
| **Point** | Terminal físico | Pagos con tarjeta mediante lector Point | Dispositivo Bluetooth/USB |
| **QR** | Código dinámico | Pagos escaneando QR con app de MP | No requiere dispositivo |

Ambas aplicaciones usan **OAuth 2.0** para autorización delegada y tienen flujos independientes.

## Índice

1. [OAuth 2.0 - Vinculación de Cuenta](#oauth-20)
2. [Configuración](#configuración)
3. [Point - Órdenes de Pago](#point-órdenes)
4. [QR - Órdenes Dinámicas](#qr-órdenes)
5. [Dispositivos y Cajas](#dispositivos)
6. [Sincronización de Pagos](#sincronización)
7. [Webhooks](#webhooks)
8. [Flujos Completos](#flujos)

---

## OAuth 2.0

### GET /api/mercadopago/oauth/authorize

Genera la URL de autorización para vincular cuenta de Mercado Pago.

**Query Params:**
```
appType: POINT | QR  (default: POINT)
```

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://auth.mercadopago.com/authorization?client_id=...",
    "appType": "POINT"
  }
}
```

**Ejemplo de uso:**
```javascript
const response = await axios.get('/api/mercadopago/oauth/authorize', {
  params: { appType: 'POINT' },
  headers: { Authorization: `Bearer ${token}` }
});

// Redirigir al usuario a la URL de autorización
window.location.href = response.data.data.authorizationUrl;
```

---

### GET /api/mercadopago/oauth/callback

**Nota:** Esta ruta es llamada automáticamente por Mercado Pago después de la autorización.

**Query Params:**
```
code: string          # Código de autorización
state: string         # Base64 de {tenantId, appType}
error?: string        # Si hay error
error_description?: string
```

**Flujo:**
1. MP redirige aquí después de autorización
2. Se decodifica el `state` para obtener `tenantId` y `appType`
3. Se intercambia el `code` por tokens de acceso
4. Se guarda en la base de datos
5. Se redirige al backoffice con resultado

**Redirección:**
- Éxito: `{BACKOFFICE_URL}/integrations?mp_success=true&mp_app=POINT`
- Error: `{BACKOFFICE_URL}/integrations?mp_error=mensaje`

---

### DELETE /api/mercadopago/oauth/disconnect

Desvincula la cuenta de Mercado Pago.

**Query Params:**
```
appType: POINT | QR  (default: POINT)
```

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Cuenta de Mercado Pago POINT desvinculada exitosamente",
  "appType": "POINT"
}
```

---

## Configuración

### GET /api/mercadopago/config

Obtiene la configuración de Mercado Pago del tenant.

**Query Params (opcional):**
```
appType: POINT | QR  # Si no se especifica, devuelve ambas
```

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta (sin appType):**
```json
{
  "success": true,
  "data": {
    "point": {
      "id": "cfg_123",
      "tenantId": "tenant_abc",
      "appType": "POINT",
      "mpUserId": "123456789",
      "publicKey": "APP_USR-...",
      "scope": "read write offline_access",
      "isActive": true,
      "environment": "production",
      "tokenExpiresAt": "2025-12-26T10:00:00Z",
      "isTokenExpiringSoon": false,
      "isConnected": true,
      "createdAt": "2025-12-19T10:00:00Z",
      "updatedAt": "2025-12-19T10:00:00Z"
    },
    "qr": null
  },
  "isPointConnected": true,
  "isQrConnected": false
}
```

**Respuesta (con appType=POINT):**
```json
{
  "success": true,
  "data": {
    "id": "cfg_123",
    "mpUserId": "123456789",
    "isConnected": true,
    // ... mismo formato que arriba
  },
  "isConnected": true
}
```

---

### POST /api/mercadopago/refresh-token

Fuerza la renovación manual del token de acceso.

**Query Params:**
```
appType: POINT | QR  (default: POINT)
```

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Token de POINT renovado exitosamente",
  "appType": "POINT"
}
```

---

## Point - Órdenes

### POST /api/mercadopago/orders

Crea una orden de pago en un terminal Point.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "pointOfSaleId": "pos_123",
  "amount": 15000.50,
  "externalReference": "POS-001-20251219-0001",
  "description": "Venta POS - POS-001-20251219-0001"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-12345678",
    "status": "PENDING"
  }
}
```

**Errores:**
```json
{
  "success": false,
  "error": "Este punto de venta no tiene un dispositivo Mercado Pago Point configurado"
}
```

---

### GET /api/mercadopago/orders/:orderId

Consulta el estado de una orden Point.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-12345678",
    "status": "PROCESSED",
    "paymentId": "123456789",
    "paymentMethod": "credit_card",
    "cardBrand": "visa",
    "cardLastFour": "4242",
    "installments": 1,
    "amount": 15000.50
  }
}
```

**Estados posibles:**
- `PENDING` - Orden creada, esperando pago
- `PROCESSING` - Pago en proceso
- `PROCESSED` - Pago aprobado
- `CANCELED` - Orden cancelada
- `FAILED` - Pago rechazado
- `EXPIRED` - Orden expirada

---

### POST /api/mercadopago/orders/:orderId/cancel

Cancela una orden pendiente.

**Nota:** Solo se puede cancelar cuando status = 'created'. Si está 'at_terminal', debe cancelarse desde el dispositivo físico.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Orden cancelada exitosamente"
}
```

**Error:**
```json
{
  "success": false,
  "error": "La orden ya está en el terminal. Cancelá desde el dispositivo físico."
}
```

---

### GET /api/mercadopago/orders-pending

Lista las órdenes pendientes del tenant.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ord_internal_123",
      "orderId": "ORD-12345678",
      "externalReference": "POS-001-20251219-0001",
      "deviceId": "PAX_A910__8701012345",
      "amount": 15000.50,
      "status": "PENDING",
      "createdAt": "2025-12-19T10:00:00Z"
    }
  ]
}
```

---

## QR - Órdenes

### GET /api/mercadopago/qr/stores

Lista las sucursales de Mercado Pago configuradas para QR.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123456",
      "name": "Sucursal Centro",
      "external_id": "SUC-001"
    }
  ]
}
```

---

### GET /api/mercadopago/qr/cashiers

Lista las cajas (POS) de Mercado Pago para QR.

**Query Params (opcional):**
```
storeId: string  # Filtrar por sucursal
```

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 789012,
      "name": "Caja 1",
      "external_id": "CAJA-001",
      "store_id": "123456",
      "qr": {
        "image": "https://www.mercadopago.com/instore/merchant/qr/...",
        "template_document": "https://...",
        "template_image": "https://..."
      }
    }
  ]
}
```

---

### POST /api/mercadopago/qr/orders

Crea una orden QR dinámica.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "pointOfSaleId": "pos_123",
  "amount": 15000.50,
  "externalReference": "POS-001-20251219-0001",
  "description": "Venta POS",
  "items": [
    {
      "title": "Producto 1",
      "quantity": 2,
      "unit_price": 5000.25
    },
    {
      "title": "Producto 2",
      "quantity": 1,
      "unit_price": 5000.00
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "orderId": "POS-001-20251219-0001",
    "qrData": "00020101021243650016COM.MERCADOLIBRE...",
    "inStoreOrderId": "a1b2c3d4-e5f6-..."
  }
}
```

**Uso del QR:**
```javascript
// El qrData puede usarse para generar el código QR
import QRCode from 'qrcode';

const qrCodeImage = await QRCode.toDataURL(response.data.data.qrData);
// Mostrar imagen al cliente
```

---

### GET /api/mercadopago/qr/status/:externalReference

Consulta el estado de una orden QR por external_reference.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "status": "APPROVED",
    "externalReference": "POS-001-20251219-0001",
    "paymentId": "123456789",
    "paymentMethod": "account_money",
    "cardLastFour": null,
    "installments": 1,
    "amount": 15000.50
  }
}
```

**Estados:**
- `PENDING` - Esperando pago
- `APPROVED` - Pago aprobado
- `REJECTED` - Pago rechazado
- `CANCELLED` - Pago cancelado

---

## Dispositivos

### GET /api/mercadopago/devices

Lista los dispositivos Point vinculados a la cuenta.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "PAX_A910__8701012345",
      "operating_mode": "PDV",
      "pos_id": 123456,
      "store_id": "789012",
      "external_pos_id": "POS-001"
    }
  ]
}
```

---

### PUT /api/mercadopago/points-of-sale/:id/device

Asocia un dispositivo Point a un punto de venta del sistema.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "mpDeviceId": "PAX_A910__8701012345",
  "mpDeviceName": "Point Caja 1"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "pos_123",
    "code": "POS-001",
    "name": "Caja 1",
    "mpDeviceId": "PAX_A910__8701012345",
    "mpDeviceName": "Point Caja 1"
  }
}
```

---

### PUT /api/mercadopago/points-of-sale/:id/qr-cashier

Vincula una caja QR de MP a un punto de venta.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "mpQrPosId": 789012,
  "mpQrPosExternalId": "CAJA-001"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "pos_123",
    "code": "POS-001",
    "mpQrPosId": 789012,
    "mpQrExternalId": "CAJA-001"
  }
}
```

---

## Sincronización

### GET /api/mercadopago/payments/:paymentId/details

Obtiene detalles completos de un pago de Mercado Pago.

**Query Params:**
```
appType: POINT | QR  (default: POINT)
```

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "mpPaymentId": "123456789",
    "mpOrderId": "ORD-12345678",
    "mpOperationType": "regular_payment",
    "mpPointType": "CARD_PRESENT",
    "cardBrand": "visa",
    "cardLastFour": "4242",
    "cardFirstSix": "424242",
    "cardExpirationMonth": 12,
    "cardExpirationYear": 2028,
    "cardholderName": "JUAN PEREZ",
    "cardType": "credit",
    "paymentMethodType": "credit_card",
    "installments": 1,
    "authorizationCode": "123456",
    "transactionAmount": 15000.50,
    "netReceivedAmount": 14550.48,
    "mpFeeAmount": 450.02,
    "mpFeeRate": 2.99,
    "status": "approved",
    "dateApproved": "2025-12-19T10:05:00Z",
    "dateCreated": "2025-12-19T10:04:30Z"
  }
}
```

---

### POST /api/mercadopago/payments/sync

Sincroniza pagos existentes con datos de Mercado Pago.

**Headers:**
```
Authorization: Bearer {token}
```

**Body (opcional):**
```json
{
  "paymentIds": ["payment_123", "payment_456"]
}
```

Si no se envía `paymentIds`, sincroniza todos los pagos pendientes.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización completada: 5 exitosos, 1 errores",
  "synced": 5,
  "errors": 1,
  "total": 6,
  "results": [
    {
      "paymentId": "payment_123",
      "saleNumber": "POS-001-20251219-0001",
      "status": "synced"
    },
    {
      "paymentId": "payment_456",
      "saleNumber": "POS-001-20251219-0002",
      "status": "error",
      "error": "Payment not found"
    }
  ]
}
```

---

### GET /api/mercadopago/payments/pending-sync

Lista pagos que necesitan sincronización.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payment_123",
      "method": "CREDIT_CARD",
      "amount": 15000.50,
      "transactionId": "123456789",
      "cardBrand": "visa",
      "cardLastFour": "4242",
      "createdAt": "2025-12-19T10:00:00Z",
      "sale": {
        "id": "sale_abc",
        "saleNumber": "POS-001-20251219-0001",
        "total": 15000.50,
        "createdAt": "2025-12-19T10:00:00Z"
      }
    }
  ],
  "count": 1
}
```

---

## Webhooks

### POST /api/webhooks/mercadopago

**Nota:** Esta ruta es pública (sin autenticación) y recibe notificaciones de Mercado Pago.

**Headers enviados por MP:**
```
x-signature: ts=1234567890,v1=abc123...
x-request-id: unique-request-id
```

**Body:**
```json
{
  "action": "payment.updated",
  "api_version": "v1",
  "data": {
    "id": "123456789"
  },
  "date_created": "2025-12-19T10:05:00Z",
  "id": 987654321,
  "live_mode": true,
  "type": "payment",
  "user_id": "123456"
}
```

**Respuesta:** Siempre `200 OK` (para evitar reintentos de MP)

---

## Flujos Completos

### Flujo Point: Pago con Terminal

```
1. Frontend POS
   └─> POST /api/mercadopago/orders
       {
         pointOfSaleId: "pos_123",
         amount: 15000.50,
         externalReference: "POS-001-20251219-0001"
       }

2. Backend
   ├─> Verifica que el POS tiene mpDeviceId configurado
   ├─> Llama a MP API: POST /v1/orders
   └─> Guarda orden en BD con status PENDING

3. Terminal Point
   └─> Recibe orden y muestra monto al cajero

4. Cliente
   └─> Pasa/inserta tarjeta en el terminal

5. Frontend POS (Polling cada 1 segundo)
   └─> GET /api/mercadopago/orders/{orderId}
       │
       ├─> PENDING → Continúa polling
       ├─> PROCESSING → Muestra "Procesando..."
       └─> PROCESSED → Pago aprobado
           │
           └─> Obtiene detalles completos:
               GET /api/mercadopago/payments/{paymentId}/details

6. Frontend POS
   └─> Crea venta con datos del pago:
       POST /api/sales
       {
         items: [...],
         payments: [{
           method: "MP_POINT",
           amount: 15000.50,
           transactionId: "123456789",
           mpPaymentId: "123456789",
           mpOrderId: "ORD-12345678",
           cardBrand: "visa",
           cardLastFour: "4242",
           installments: 1,
           mpFeeAmount: 450.02,
           netReceivedAmount: 14550.48
         }]
       }
```

### Flujo QR: Pago Escaneando

```
1. Frontend POS
   └─> POST /api/mercadopago/qr/orders
       {
         pointOfSaleId: "pos_123",
         amount: 15000.50,
         externalReference: "POS-001-20251219-0001",
         items: [...]
       }

2. Backend
   ├─> Llama a MP API: PUT /instore/qr/seller/collectors/{userId}/pos/{externalPosId}/orders
   └─> Recibe qrData

3. Frontend POS
   └─> Muestra código QR generado del qrData

4. Cliente
   └─> Escanea QR con app de Mercado Pago y confirma pago

5. Frontend POS (Polling cada 2 segundos)
   └─> GET /api/mercadopago/qr/status/{externalReference}
       │
       ├─> PENDING → Continúa polling
       └─> APPROVED → Pago aprobado
           │
           └─> Obtiene detalles:
               GET /api/mercadopago/payments/{paymentId}/details?appType=QR

6. Frontend POS
   └─> Crea venta con datos del pago (igual que Point)
```

---

**Ver también:**
- [API - Ventas](./API-SALES.md)
- [API - Caja](./API-CASH.md)
- [USUARIOS_FRONTENDS.md](./USUARIOS_FRONTENDS.md)
