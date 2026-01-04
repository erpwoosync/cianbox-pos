# Guía de Integración - Mercado Pago y AFIP

**Documentación Técnica para Desarrolladores e Implementadores**

Versión: 1.0.0
Fecha: Diciembre 2024

---

## Tabla de Contenidos

1. [Integración con Mercado Pago](#integración-con-mercado-pago)
   - [Arquitectura de la Integración](#arquitectura-de-la-integración)
   - [Configuración OAuth 2.0](#configuración-oauth-20)
   - [Mercado Pago Point](#mercado-pago-point)
   - [Mercado Pago QR](#mercado-pago-qr)
   - [Webhooks](#webhooks)
2. [Integración con AFIP](#integración-con-afip)
   - [Arquitectura de la Integración](#arquitectura-de-la-integración-afip)
   - [Generación de Certificados](#generación-de-certificados)
   - [Emisión de Facturas](#emisión-de-facturas)
   - [Notas de Crédito](#notas-de-crédito)

---

## Integración con Mercado Pago

### Arquitectura de la Integración

Cianbox POS implementa integración completa con **dos aplicaciones OAuth separadas** de Mercado Pago:

```
┌─────────────────────────────────────────────────────────┐
│              MERCADO PAGO ECOSYSTEM                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────┐         ┌────────────────┐         │
│  │   APP POINT    │         │    APP QR      │         │
│  │ (Client ID 1)  │         │ (Client ID 2)  │         │
│  └────────┬───────┘         └────────┬───────┘         │
│           │                          │                 │
│           └──────────┬───────────────┘                 │
│                      │                                 │
└──────────────────────┼─────────────────────────────────┘
                       │
                       │ OAuth 2.0 + Webhooks
                       │
┌──────────────────────▼─────────────────────────────────┐
│              CIANBOX POS BACKEND                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         MercadoPagoService                       │  │
│  │  - Token Management (auto-refresh)               │  │
│  │  - Point Orders API                              │  │
│  │  - QR Orders API                                 │  │
│  │  - Webhook Processing                            │  │
│  │  - Payment Details Fetching                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Database (PostgreSQL)                        │  │
│  │  - MercadoPagoConfig (tokens por tenant+appType)│  │
│  │  - MercadoPagoOrder (órdenes)                    │  │
│  │  - MercadoPagoStore (locales QR)                 │  │
│  │  - MercadoPagoCashier (cajas QR)                 │  │
│  │  - Payment (pagos vinculados a ventas)           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                       │
                       │ WebSocket + REST
                       │
┌──────────────────────▼─────────────────────────────────┐
│              FRONTENDS                                  │
├─────────────────────────────────────────────────────────┤
│  POS (Cajero)        │  Backoffice (Admin)             │
│  - MP Point Modal    │  - OAuth Connection             │
│  - MP QR Modal       │  - Device Management            │
│  - Payment Status    │  - QR Configuration             │
│                      │  - Orphan Payments              │
└─────────────────────────────────────────────────────────┘
```

### ¿Por Qué Dos Aplicaciones?

Mercado Pago requiere aplicaciones OAuth separadas para Point y QR debido a:

1. **Diferentes scopes de permisos:**
   - Point: `point.integration.write`, `point.integration.read`
   - QR: `mpmobile.instore.qr.write`, `mpmobile.instore.qr.read`

2. **Diferentes flujos de autorización:**
   - Point: Solo requiere access token
   - QR: Requiere stores (locales) y cashiers (cajas) configurados previamente

3. **Diferentes APIs:**
   - Point: `/point/integration-api/devices`, `/point/integration-api/payment-intents`
   - QR: `/instore/orders/qr/seller/collectors`, `/pos`

### Configuración OAuth 2.0

#### Paso 1: Crear Aplicaciones en Mercado Pago

**Para Point:**

1. Ir a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app)
2. Crear nueva aplicación
3. Nombre: "CIANBOX-POS-POINT"
4. Tipo: "Pagos presenciales"
5. Modelo de integración: "Point Smart / Plus"
6. Guardar el **Client ID** y **Client Secret**

**Para QR:**

1. Crear otra aplicación
2. Nombre: "CIANBOX-POS-QR"
3. Tipo: "Código QR"
4. Modelo de integración: "QR Dinámico"
5. Guardar el **Client ID** y **Client Secret**

#### Paso 2: Configurar Redirect URI

Ambas aplicaciones deben tener el mismo **Redirect URI**:

```
https://api.tudominio.com/api/mercadopago/oauth/callback
```

**IMPORTANTE:** Esta URL debe ser HTTPS en producción. MP no acepta HTTP para callbacks.

#### Paso 3: Configurar Variables de Entorno

En el backend (`apps/backend/.env`):

```env
# Mercado Pago Point
MP_CLIENT_ID_POINT="1234567890123456"
MP_CLIENT_SECRET_POINT="ABCDEFabcdef1234567890ABCDEFabcd"

# Mercado Pago QR
MP_CLIENT_ID_QR="6543210987654321"
MP_CLIENT_SECRET_QR="ZYXWVUzyxwvu9876543210ZYXWVUzyxw"

# Compartidos
MP_REDIRECT_URI="https://api.tudominio.com/api/mercadopago/oauth/callback"
MP_WEBHOOK_SECRET="tu-secret-para-validar-webhooks"
BACKOFFICE_URL="https://backoffice.tudominio.com"
```

#### Paso 4: Configurar Webhooks

En cada aplicación de Mercado Pago:

1. Ir a "Webhooks"
2. Agregar URL: `https://api.tudominio.com/api/webhooks/mercadopago`
3. Eventos a suscribirse:
   - **Point:** `payment` (notificaciones de pagos procesados)
   - **QR:** `merchant_order` (notificaciones de órdenes completadas)

### Flujo OAuth 2.0 Completo

```typescript
// 1. Frontend solicita URL de autorización
GET /api/mercadopago/oauth/authorize?appType=POINT

// Backend genera URL con state codificado
const state = Buffer.from(JSON.stringify({
  tenantId: 'cm123abc',
  appType: 'POINT'
})).toString('base64');

const authUrl = `https://auth.mercadopago.com.ar/authorization?` +
  `client_id=${MP_CLIENT_ID_POINT}&` +
  `response_type=code&` +
  `platform_id=mp&` +
  `state=${state}&` +
  `redirect_uri=${MP_REDIRECT_URI}`;

// 2. Usuario autoriza en Mercado Pago
// MP redirige a: /api/mercadopago/oauth/callback?code=ABC123&state=eyJ0ZW5h...

// 3. Backend intercambia code por tokens
const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
  grant_type: 'authorization_code',
  client_id: MP_CLIENT_ID_POINT,
  client_secret: MP_CLIENT_SECRET_POINT,
  code: code,
  redirect_uri: MP_REDIRECT_URI
});

// 4. Backend guarda tokens en DB
await prisma.mercadoPagoConfig.upsert({
  where: {
    tenantId_appType: {
      tenantId: 'cm123abc',
      appType: 'POINT'
    }
  },
  update: {
    accessToken: tokenResponse.data.access_token,
    refreshToken: tokenResponse.data.refresh_token,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
    mpUserId: tokenResponse.data.user_id,
    publicKey: tokenResponse.data.public_key
  },
  create: { /* ... */ }
});

// 5. Backend redirige al backoffice
res.redirect(`${BACKOFFICE_URL}/integrations?mp_success=true&mp_app=POINT`);
```

### Refresh de Tokens Automático

```typescript
// Cron job ejecutado cada hora
cron.schedule('0 * * * *', async () => {
  await mercadoPagoService.refreshAllTokens();
});

// En mercadopago.service.ts
async refreshAllTokens() {
  const configs = await prisma.mercadoPagoConfig.findMany({
    where: {
      isActive: true,
      tokenExpiresAt: { lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } // Próximos a expirar
    }
  });

  for (const config of configs) {
    try {
      await this.refreshAccessToken(config.tenantId, config.appType);
    } catch (error) {
      console.error(`Error refreshing token for ${config.tenantId}/${config.appType}:`, error);
    }
  }
}
```

---

## Mercado Pago Point

### Arquitectura Point

```
┌──────────────────┐         ┌──────────────────┐
│  Terminal Point  │         │   Cianbox POS    │
│  (Hardware)      │         │   (Backend)      │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │  1. Enviar intento de pago │
         │◄───────────────────────────┤
         │  POST /payment-intents     │
         │                            │
         │  2. Cliente pasa tarjeta   │
         │     en terminal            │
         │                            │
         │  3. Notificación webhook   │
         ├────────────────────────────►
         │  POST /webhooks/mp         │
         │                            │
         │  4. Consultar estado       │
         ├────────────────────────────►
         │  GET /payment-intents/ID   │
         │                            │
         │  5. Respuesta con datos    │
         │◄───────────────────────────┤
         │  {status: "approved"}      │
         │                            │
```

### Crear Orden Point

```typescript
// POST /api/mercadopago/orders
{
  "pointOfSaleId": "cm123abc",
  "amount": 15000,
  "externalReference": "POS-SUC-1-CAJA-01-20241225-0042",
  "description": "Venta POS"
}
```

**Flujo en el backend:**

```typescript
async createPointOrder({
  tenantId,
  deviceId,
  amount,
  externalReference,
  description
}: CreatePointOrderParams) {
  // 1. Obtener access token
  const config = await this.getConfig(tenantId, 'POINT');
  const accessToken = await this.ensureValidToken(tenantId, 'POINT');

  // 2. Crear intento de pago en MP
  const response = await axios.post(
    'https://api.mercadopago.com/point/integration-api/payment-intents',
    {
      amount: amount,
      description: description || 'Venta POS',
      payment: {
        type: 'credit_card', // Point acepta tarjetas
        installments: 1,
        installments_cost: 'BUYER'
      },
      additional_info: {
        external_reference: externalReference,
        print_on_terminal: true // Imprimir ticket en terminal
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Device-Id': deviceId // ID del dispositivo Point
      }
    }
  );

  // 3. Guardar orden en BD
  const order = await prisma.mercadoPagoOrder.create({
    data: {
      tenantId,
      orderId: response.data.id,
      externalReference,
      deviceId,
      amount,
      status: 'PENDING'
    }
  });

  // 4. Retornar ID para tracking
  return {
    orderId: response.data.id,
    status: 'PENDING'
  };
}
```

### Consultar Estado de Orden Point

```typescript
// GET /api/mercadopago/orders/:orderId

async getOrderStatus(tenantId: string, orderId: string) {
  const accessToken = await this.ensureValidToken(tenantId, 'POINT');

  const response = await axios.get(
    `https://api.mercadopago.com/point/integration-api/payment-intents/${orderId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  // Actualizar en BD
  await prisma.mercadoPagoOrder.update({
    where: { orderId },
    data: {
      status: response.data.state.toUpperCase(),
      paymentId: response.data.payment?.id,
      // ... más campos
    }
  });

  return {
    orderId,
    status: response.data.state,
    payment: response.data.payment
  };
}
```

### Cancelar Orden Point

```typescript
// POST /api/mercadopago/orders/:orderId/cancel

async cancelOrder(tenantId: string, orderId: string) {
  const accessToken = await this.ensureValidToken(tenantId, 'POINT');

  await axios.delete(
    `https://api.mercadopago.com/point/integration-api/payment-intents/${orderId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  // Actualizar en BD
  await prisma.mercadoPagoOrder.update({
    where: { orderId },
    data: { status: 'CANCELED' }
  });
}
```

### Listar Dispositivos Point

```typescript
// GET /api/mercadopago/devices

async listDevices(tenantId: string) {
  const accessToken = await this.ensureValidToken(tenantId, 'POINT');

  const response = await axios.get(
    'https://api.mercadopago.com/point/integration-api/devices',
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: {
        limit: 50,
        offset: 0
      }
    }
  );

  return response.data.devices.map(device => ({
    id: device.id,
    name: device.name || `Terminal ${device.id.slice(-4)}`,
    serialNumber: device.serial_number,
    operatingMode: device.operating_mode, // 'PDV' o 'STANDALONE'
    status: device.status // 'ACTIVE', 'INACTIVE'
  }));
}
```

### Cambiar Modo de Operación

Mercado Pago Point tiene dos modos:

- **STANDALONE:** Terminal funciona de forma independiente
- **PDV:** Terminal integrada con el punto de venta (permite enviar órdenes desde el POS)

```typescript
// PATCH /api/mercadopago/devices/:deviceId/operating-mode
{
  "operatingMode": "PDV"
}

async changeDeviceOperatingMode(
  tenantId: string,
  deviceId: string,
  operatingMode: 'PDV' | 'STANDALONE'
) {
  const accessToken = await this.ensureValidToken(tenantId, 'POINT');

  await axios.patch(
    `https://api.mercadopago.com/point/integration-api/devices/${deviceId}`,
    { operating_mode: operatingMode },
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  return { deviceId, operatingMode };
}
```

**IMPORTANTE:** Después de cambiar el modo, el dispositivo debe reiniciarse para aplicar el cambio.

---

## Mercado Pago QR

### Arquitectura QR

```
┌────────────────────────────────────────────────────────┐
│             MERCADO PAGO QR ECOSYSTEM                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐    │
│  │  Store 1 │      │  Store 2 │      │  Store 3 │    │
│  │ (Local)  │      │ (Local)  │      │ (Local)  │    │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘    │
│       │                 │                 │           │
│  ┌────▼─────┐      ┌────▼─────┐      ┌────▼─────┐    │
│  │ Cashier  │      │ Cashier  │      │ Cashier  │    │
│  │ (Caja 1) │      │ (Caja 2) │      │ (Caja 3) │    │
│  │   QR     │      │   QR     │      │   QR     │    │
│  └──────────┘      └──────────┘      └──────────┘    │
│                                                        │
└────────────────────────────────────────────────────────┘
                        │
                        │ API calls
                        │
┌───────────────────────▼────────────────────────────────┐
│              CIANBOX POS BACKEND                       │
├────────────────────────────────────────────────────────┤
│  - Sincroniza Stores y Cashiers                       │
│  - Crea órdenes QR dinámicas                          │
│  - Vincula Stores con Branches                        │
│  - Vincula Cashiers con PointsOfSale                  │
└────────────────────────────────────────────────────────┘
```

### Configuración Inicial QR

**Requisitos previos:**
1. Cuenta de Mercado Pago verificada
2. Haber creado al menos un "Local" (Store) en Mercado Pago
3. Haber creado al menos una "Caja" (Cashier) dentro del local

### Sincronizar Stores y Cashiers desde MP

```typescript
// POST /api/mercadopago/qr/sync-data

async syncQRDataFromMP(tenantId: string) {
  const accessToken = await this.ensureValidToken(tenantId, 'QR');

  // 1. Obtener stores de MP
  const storesResponse = await axios.get(
    `https://api.mercadopago.com/users/${mpUserId}/stores`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  // 2. Guardar en BD local (cache)
  for (const mpStore of storesResponse.data.results) {
    await prisma.mercadoPagoStore.upsert({
      where: {
        tenantId_mpStoreId: {
          tenantId,
          mpStoreId: mpStore.id
        }
      },
      update: {
        name: mpStore.name,
        externalId: mpStore.external_id,
        location: mpStore.location
      },
      create: {
        tenantId,
        mpStoreId: mpStore.id,
        name: mpStore.name,
        externalId: mpStore.external_id,
        location: mpStore.location
      }
    });
  }

  // 3. Obtener cashiers de MP
  const cashiersResponse = await axios.get(
    `https://api.mercadopago.com/pos`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { user_id: mpUserId }
    }
  );

  // 4. Guardar cashiers en BD local
  for (const mpCashier of cashiersResponse.data.results) {
    await prisma.mercadoPagoCashier.upsert({
      where: {
        tenantId_mpCashierId: {
          tenantId,
          mpCashierId: mpCashier.id
        }
      },
      update: {
        name: mpCashier.name,
        externalId: mpCashier.external_id,
        mpStoreId: mpCashier.store_id,
        qrUrl: mpCashier.fixed_amount ? null : mpCashier.qr.image
      },
      create: {
        tenantId,
        mpCashierId: mpCashier.id,
        mpStoreId: mpCashier.store_id,
        name: mpCashier.name,
        externalId: mpCashier.external_id,
        qrUrl: mpCashier.fixed_amount ? null : mpCashier.qr.image
      }
    });
  }

  return {
    storesAdded: storesResponse.data.results.length,
    cashiersAdded: cashiersResponse.data.results.length
  };
}
```

### Crear Store en MP desde Branch

```typescript
// POST /api/mercadopago/qr/stores/from-branch/:branchId

async createStoreFromBranch(tenantId: string, branchId: string) {
  // 1. Obtener datos de la sucursal
  const branch = await prisma.branch.findUnique({
    where: { id: branchId }
  });

  if (!branch) throw new Error('Sucursal no encontrada');

  const accessToken = await this.ensureValidToken(tenantId, 'QR');
  const mpUserId = (await this.getConfig(tenantId, 'QR')).mpUserId;

  // 2. Crear store en MP
  const response = await axios.post(
    `https://api.mercadopago.com/users/${mpUserId}/stores`,
    {
      name: branch.name,
      external_id: `BRANCH-${branch.code}`,
      location: {
        street_name: branch.address?.split(' ')[0] || 'Sin dirección',
        street_number: branch.address?.split(' ')[1] || 'S/N',
        city_name: branch.city || 'Ciudad',
        state_name: branch.state || 'Provincia'
      }
    },
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  // 3. Vincular en BD
  await prisma.branch.update({
    where: { id: branchId },
    data: {
      mpStoreId: response.data.id.toString(),
      mpExternalId: response.data.external_id
    }
  });

  return {
    storeId: response.data.id,
    externalId: response.data.external_id,
    branchId
  };
}
```

### Crear Orden QR Dinámica

```typescript
// POST /api/mercadopago/qr/orders
{
  "pointOfSaleId": "cm123abc",
  "amount": 15000,
  "externalReference": "POS-SUC-1-CAJA-01-20241225-0042",
  "description": "Venta POS",
  "items": [
    {
      "title": "Remera Negra",
      "quantity": 2,
      "unit_price": 7500
    }
  ]
}

async createQROrder({
  tenantId,
  externalPosId, // external_id de la cashier
  amount,
  externalReference,
  description,
  items
}: CreateQROrderParams) {
  const accessToken = await this.ensureValidToken(tenantId, 'QR');
  const mpUserId = (await this.getConfig(tenantId, 'QR')).mpUserId;

  // 1. Crear orden en MP
  const response = await axios.put(
    `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${mpUserId}/pos/${externalPosId}/qrs`,
    {
      external_reference: externalReference,
      title: description || 'Venta POS',
      description: description,
      notification_url: `${process.env.API_URL}/api/webhooks/mercadopago`,
      total_amount: amount,
      items: items || [
        {
          title: description || 'Venta',
          quantity: 1,
          unit_price: amount,
          unit_measure: 'unit',
          total_amount: amount
        }
      ]
    },
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  // 2. Guardar en BD
  await prisma.mercadoPagoOrder.create({
    data: {
      tenantId,
      orderId: response.data.qr_data || externalReference,
      externalReference,
      amount,
      status: 'PENDING',
      deviceId: externalPosId
    }
  });

  return {
    orderId: response.data.qr_data || externalReference,
    qrData: response.data.qr_data,
    status: 'PENDING'
  };
}
```

### Consultar Estado de Orden QR

```typescript
// GET /api/mercadopago/qr/status/:externalReference

async getQROrderStatus(tenantId: string, externalReference: string) {
  const accessToken = await this.ensureValidToken(tenantId, 'QR');
  const mpUserId = (await this.getConfig(tenantId, 'QR')).mpUserId;

  // MP QR no tiene endpoint directo para consultar por external_reference
  // Debemos buscar en merchant_orders
  const response = await axios.get(
    `https://api.mercadopago.com/merchant_orders/search`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: {
        external_reference: externalReference,
        status: 'opened,closed'
      }
    }
  );

  if (!response.data.results || response.data.results.length === 0) {
    return { status: 'NOT_FOUND' };
  }

  const merchantOrder = response.data.results[0];

  return {
    orderId: merchantOrder.id,
    status: merchantOrder.order_status,
    totalAmount: merchantOrder.total_amount,
    paidAmount: merchantOrder.paid_amount,
    externalReference: merchantOrder.external_reference,
    payments: merchantOrder.payments
  };
}
```

### Cancelar Orden QR

```typescript
// DELETE /api/mercadopago/qr/orders/:pointOfSaleId

async deleteQROrder(tenantId: string, externalPosId: string) {
  const accessToken = await this.ensureValidToken(tenantId, 'QR');
  const mpUserId = (await this.getConfig(tenantId, 'QR')).mpUserId;

  // Eliminar orden enviando orden vacía
  await axios.delete(
    `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${mpUserId}/pos/${externalPosId}/qrs`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  // Actualizar en BD
  await prisma.mercadoPagoOrder.updateMany({
    where: {
      tenantId,
      deviceId: externalPosId,
      status: 'PENDING'
    },
    data: { status: 'CANCELED' }
  });
}
```

---

## Webhooks

### Validación de Firma HMAC-SHA256

Mercado Pago firma cada webhook con HMAC-SHA256 para verificar autenticidad:

```typescript
function validateWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined
): boolean {
  if (!MP_WEBHOOK_SECRET) {
    console.warn('[Webhook MP] MP_WEBHOOK_SECRET no configurado');
    return true; // Permitir en desarrollo
  }

  if (!xSignature) {
    console.warn('[Webhook MP] Header x-signature no presente');
    return false;
  }

  // Parsear x-signature: ts=1234567890,v1=abc123...
  const signatureParts: Record<string, string> = {};
  xSignature.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) signatureParts[key.trim()] = value.trim();
  });

  const ts = signatureParts['ts'];
  const v1 = signatureParts['v1'];

  if (!ts || !v1) {
    console.warn('[Webhook MP] Firma incompleta');
    return false;
  }

  // Construir manifest
  const manifest = `id:${dataId || ''};request-id:${xRequestId || ''};ts:${ts};`;

  // Calcular HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  return calculatedHash === v1;
}
```

### Procesamiento de Webhooks

```typescript
// POST /api/webhooks/mercadopago

webhookRouter.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;
    const dataId = req.query['data.id'] as string || req.body?.data?.id;

    // Validar firma
    if (!validateWebhookSignature(xSignature, xRequestId, dataId)) {
      console.error('[Webhook MP] Firma inválida');
      return res.status(200).send('OK'); // Responder 200 igual para evitar reintentos
    }

    // Procesar webhook
    await mercadoPagoService.processWebhook(req.body);

    // Siempre responder 200
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook MP] Error procesando:', error);
    res.status(200).send('OK'); // Incluso con error, responder 200
  }
});
```

### Procesamiento por Tipo de Evento

```typescript
async processWebhook(webhookData: any) {
  const { type, action, data } = webhookData;

  console.log(`[Webhook MP] Tipo: ${type}, Acción: ${action}, Data ID: ${data?.id}`);

  // Point: Notificación de pago
  if (type === 'payment' && data?.id) {
    await this.handlePaymentNotification(data.id);
  }

  // QR: Notificación de merchant order
  if (type === 'merchant_order' && data?.id) {
    await this.handleMerchantOrderNotification(data.id);
  }
}

async handlePaymentNotification(paymentId: string) {
  // Buscar orden asociada
  const order = await prisma.mercadoPagoOrder.findFirst({
    where: { paymentId }
  });

  if (!order) {
    console.warn(`[Webhook MP] Orden no encontrada para payment ${paymentId}`);
    return;
  }

  // Obtener detalles del pago
  const paymentDetails = await this.getPaymentDetails(
    order.tenantId,
    paymentId,
    'POINT'
  );

  // Actualizar orden
  await prisma.mercadoPagoOrder.update({
    where: { id: order.id },
    data: {
      status: paymentDetails.status === 'approved' ? 'PROCESSED' : paymentDetails.status.toUpperCase(),
      paymentId: paymentDetails.mpPaymentId,
      cardBrand: paymentDetails.cardBrand,
      cardLastFour: paymentDetails.cardLastFour,
      installments: paymentDetails.installments,
      processedAt: new Date()
    }
  });

  // Emitir evento Socket.IO para notificar al frontend
  io.to(`tenant-${order.tenantId}`).emit('mp-payment-updated', {
    orderId: order.orderId,
    status: paymentDetails.status,
    amount: order.amount
  });
}

async handleMerchantOrderNotification(merchantOrderId: string) {
  // Similar a handlePaymentNotification pero para QR
  // ...
}
```

### Socket.IO para Notificaciones en Tiempo Real

```typescript
// En el frontend (POS)
socket.on('mp-payment-updated', (data) => {
  if (data.orderId === currentOrderId) {
    if (data.status === 'approved') {
      showSuccessMessage('Pago aprobado');
      completeSale();
    } else if (data.status === 'rejected') {
      showErrorMessage('Pago rechazado');
      cancelSale();
    }
  }
});
```

---

## Integración con AFIP

### Arquitectura de la Integración AFIP

```
┌────────────────────────────────────────────────────────┐
│                 AFIP WEB SERVICES                      │
├────────────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌──────────────┐            │
│  │    WSAA      │         │     WSFE     │            │
│  │ (Auth)       │         │ (Facturas)   │            │
│  └──────┬───────┘         └──────┬───────┘            │
│         │                        │                    │
└─────────┼────────────────────────┼────────────────────┘
          │                        │
          │ SOAP + TA (Ticket)     │ SOAP + CAE
          │                        │
┌─────────▼────────────────────────▼────────────────────┐
│              CIANBOX POS BACKEND                      │
├────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐  │
│  │          AfipService (AfipSDK)                  │  │
│  │  - Auto Certificate Generation                 │  │
│  │  - TA Management (auto-refresh)                │  │
│  │  - Invoice Emission (A, B, C)                  │  │
│  │  - Credit Notes                                │  │
│  │  - QR Generation                               │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │     Database (PostgreSQL)                       │  │
│  │  - AfipConfig (certificados, CUIT, etc.)       │  │
│  │  - AfipSalesPoint (puntos de venta)            │  │
│  │  - AfipInvoice (comprobantes emitidos)         │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Generación de Certificados

Cianbox POS soporta **generación automática de certificados** usando AfipSDK, eliminando el proceso manual tedioso.

#### Opción 1: Generación Automática (Recomendado)

```typescript
// POST /api/afip/generate-certificate
{
  "username": "20123456789",  // CUIT
  "password": "contraseña_clave_fiscal",
  "alias": "CIANBOX-POS-PROD",
  "isProduction": true
}

async generateCertificate(
  tenantId: string,
  {
    username,
    password,
    alias,
    isProduction
  }: GenerateCertificateParams
) {
  const config = await prisma.afipConfig.findUnique({
    where: { tenantId }
  });

  if (!config) {
    throw new Error('Configuración AFIP no encontrada');
  }

  // 1. Usar AfipSDK para generar certificado
  const Afip = (await import('@afipsdk/afip.js')).default;

  const afip = new Afip({
    CUIT: config.cuit,
    production: isProduction
  });

  try {
    // 2. Login automatizado en AFIP con Puppeteer
    const result = await afip.CreateCert(
      username,
      password,
      alias
    );

    // 3. Guardar certificado y clave en BD
    await prisma.afipConfig.update({
      where: { tenantId },
      data: {
        afipCert: result.cert,
        afipKey: result.key,
        isProduction
      }
    });

    return {
      success: true,
      message: 'Certificado generado exitosamente'
    };
  } catch (error) {
    console.error('Error generando certificado:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Proceso detrás de escena:**
1. AfipSDK automatiza el login en el sitio de AFIP usando Puppeteer
2. Genera un CSR (Certificate Signing Request)
3. Navega al wizard de certificados de AFIP
4. Sube el CSR
5. Descarga el certificado firmado (.crt)
6. Extrae la clave privada (.key)
7. Retorna ambos archivos como strings

#### Opción 2: Subir Certificado Manualmente

```typescript
// POST /api/afip/config
{
  "cuit": "20123456789",
  "businessName": "Mi Empresa S.A.",
  "taxCategory": "RESPONSABLE_INSCRIPTO",
  "afipCert": "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
  "afipKey": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----",
  "isProduction": true
}
```

### Obtención de Ticket de Acceso (TA)

AfipSDK maneja automáticamente el TA (Ticket de Acceso) que WSAA devuelve:

```typescript
async getTA(tenantId: string): Promise<string> {
  const config = await prisma.afipConfig.findUnique({
    where: { tenantId }
  });

  if (!config || !config.afipCert || !config.afipKey) {
    throw new Error('Certificado AFIP no configurado');
  }

  const Afip = (await import('@afipsdk/afip.js')).default;

  const afip = new Afip({
    CUIT: config.cuit,
    cert: config.afipCert,
    key: config.afipKey,
    production: config.isProduction,
    ta_folder: '/tmp/afip-ta', // Carpeta temporal para cachear TAs
    wsfe_wsdl: config.isProduction
      ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
      : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
  });

  // AfipSDK maneja el cache de TA automáticamente
  // Si el TA expiró, lo renueva transparentemente
  const ta = await afip.GetServiceTA('wsfe');

  return ta;
}
```

### Emisión de Facturas

#### Factura B (Consumidor Final)

```typescript
// POST /api/afip/invoices/factura-b
{
  "salesPointId": "cm123abc",
  "totalAmount": 30000,
  "receiverDocType": 99,  // 99 = Consumidor Final
  "receiverDocNum": "0",
  "saleId": "cm456def"
}

async createInvoiceB(
  tenantId: string,
  salesPointId: string,
  totalAmount: number,
  options?: {
    receiverDocType?: number;
    receiverDocNum?: string;
    receiverName?: string;
    taxRate?: number;
    saleId?: string;
  }
) {
  // 1. Obtener configuración y punto de venta
  const config = await prisma.afipConfig.findUnique({
    where: { tenantId },
    include: { salesPoints: true }
  });

  const salesPoint = await prisma.afipSalesPoint.findUnique({
    where: { id: salesPointId }
  });

  if (!salesPoint) {
    throw new Error('Punto de venta no encontrado');
  }

  // 2. Instanciar AfipSDK
  const Afip = (await import('@afipsdk/afip.js')).default;

  const afip = new Afip({
    CUIT: config.cuit,
    cert: config.afipCert,
    key: config.afipKey,
    production: config.isProduction
  });

  // 3. Obtener próximo número de comprobante
  const lastVoucherNumber = await afip.ElectronicBilling.getLastVoucher(
    salesPoint.number, // Pto Vta
    6 // Tipo Comprobante: 6 = Factura B
  );

  const nextVoucherNumber = lastVoucherNumber + 1;

  // 4. Calcular importes
  const taxRate = options?.taxRate || 21;
  const netAmount = totalAmount / (1 + taxRate / 100);
  const taxAmount = totalAmount - netAmount;

  // 5. Preparar datos del comprobante
  const voucherData = {
    CantReg: 1,  // Cantidad de comprobantes (siempre 1)
    PtoVta: salesPoint.number,
    CbteTipo: 6, // Factura B
    Concepto: 1, // 1=Productos, 2=Servicios, 3=Productos y Servicios
    DocTipo: options?.receiverDocType || 99, // 99=CF, 96=DNI, 80=CUIT
    DocNro: parseInt(options?.receiverDocNum || '0'),
    CbteDesde: nextVoucherNumber,
    CbteHasta: nextVoucherNumber,
    CbteFch: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')), // YYYYMMDD
    ImpTotal: totalAmount,
    ImpTotConc: 0, // Importe neto no gravado
    ImpNeto: netAmount,
    ImpOpEx: 0, // Importe exento
    ImpIVA: taxAmount,
    ImpTrib: 0, // Otros tributos
    MonId: 'PES', // Moneda: Pesos
    MonCotiz: 1,
    Iva: [
      {
        Id: 5, // 5 = 21%, 4 = 10.5%
        BaseImp: netAmount,
        Importe: taxAmount
      }
    ]
  };

  // 6. Emitir comprobante
  const response = await afip.ElectronicBilling.createVoucher(voucherData);

  // 7. Guardar en BD
  const invoice = await prisma.afipInvoice.create({
    data: {
      tenantId,
      afipConfigId: config.id,
      salesPointId,
      saleId: options?.saleId,
      voucherType: 'FACTURA_B',
      number: nextVoucherNumber,
      cae: response.CAE,
      caeExpiration: new Date(
        `${response.CAEFchVto.slice(0, 4)}-${response.CAEFchVto.slice(4, 6)}-${response.CAEFchVto.slice(6, 8)}`
      ),
      issueDate: new Date(),
      receiverDocType: (options?.receiverDocType || 99).toString(),
      receiverDocNum: options?.receiverDocNum || '0',
      receiverName: options?.receiverName || 'Consumidor Final',
      netAmount,
      taxAmount,
      totalAmount,
      status: 'ISSUED'
    }
  });

  return {
    success: true,
    invoiceId: invoice.id,
    voucherNumber: nextVoucherNumber,
    cae: response.CAE,
    caeExpiration: response.CAEFchVto
  };
}
```

#### Factura A (Responsable Inscripto)

Similar a Factura B pero con diferencias:

- **CbteTipo:** 1 (en lugar de 6)
- **DocTipo:** 80 (CUIT) siempre
- **ImpNeto:** Importe neto SIN IVA
- **ImpIVA:** Debe discriminar el IVA
- **Requiere:** CUIT del comprador

```typescript
async createInvoiceA(
  tenantId: string,
  salesPointId: string,
  totalAmount: number,
  options: {
    receiverCuit: string;
    receiverName: string;
    taxRate?: number;
    saleId?: string;
  }
) {
  // ... similar a createInvoiceB pero con:
  const voucherData = {
    // ...
    CbteTipo: 1, // Factura A
    DocTipo: 80, // CUIT
    DocNro: parseInt(options.receiverCuit.replace(/-/g, '')),
    // ... resto igual
  };

  // ...
}
```

### Notas de Crédito

```typescript
// POST /api/afip/invoices/nota-credito-b
{
  "salesPointId": "cm123abc",
  "originalInvoiceId": "cm789ghi",
  "amount": 15000  // Opcional, si es parcial
}

async createCreditNoteB(
  tenantId: string,
  salesPointId: string,
  originalInvoiceId: string,
  amount?: number
) {
  // 1. Obtener factura original
  const originalInvoice = await prisma.afipInvoice.findUnique({
    where: { id: originalInvoiceId },
    include: { salesPoint: true }
  });

  if (!originalInvoice) {
    throw new Error('Factura original no encontrada');
  }

  // 2. Calcular monto (total o parcial)
  const creditAmount = amount || Number(originalInvoice.totalAmount);
  const taxRate = 21;
  const netAmount = creditAmount / (1 + taxRate / 100);
  const taxAmount = creditAmount - netAmount;

  // 3. Obtener próximo número
  const config = await prisma.afipConfig.findUnique({
    where: { tenantId }
  });

  const afip = new Afip({
    CUIT: config.cuit,
    cert: config.afipCert,
    key: config.afipKey,
    production: config.isProduction
  });

  const lastVoucherNumber = await afip.ElectronicBilling.getLastVoucher(
    originalInvoice.salesPoint.number,
    8 // Tipo: 8 = Nota de Crédito B
  );

  const nextVoucherNumber = lastVoucherNumber + 1;

  // 4. Emitir Nota de Crédito
  const voucherData = {
    CantReg: 1,
    PtoVta: originalInvoice.salesPoint.number,
    CbteTipo: 8, // Nota de Crédito B
    Concepto: 1,
    DocTipo: parseInt(originalInvoice.receiverDocType),
    DocNro: parseInt(originalInvoice.receiverDocNum),
    CbteDesde: nextVoucherNumber,
    CbteHasta: nextVoucherNumber,
    CbteFch: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
    ImpTotal: creditAmount,
    ImpTotConc: 0,
    ImpNeto: netAmount,
    ImpOpEx: 0,
    ImpIVA: taxAmount,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    // IMPORTANTE: Comprobantes asociados (factura original)
    CbtesAsoc: [
      {
        Tipo: parseInt(originalInvoice.voucherType === 'FACTURA_B' ? '6' : '1'),
        PtoVta: originalInvoice.salesPoint.number,
        Nro: originalInvoice.number,
        Cuit: config.cuit
      }
    ],
    Iva: [
      {
        Id: 5,
        BaseImp: netAmount,
        Importe: taxAmount
      }
    ]
  };

  const response = await afip.ElectronicBilling.createVoucher(voucherData);

  // 5. Guardar en BD
  const creditNote = await prisma.afipInvoice.create({
    data: {
      tenantId,
      afipConfigId: config.id,
      salesPointId,
      voucherType: 'NOTA_CREDITO_B',
      number: nextVoucherNumber,
      cae: response.CAE,
      caeExpiration: new Date(
        `${response.CAEFchVto.slice(0, 4)}-${response.CAEFchVto.slice(4, 6)}-${response.CAEFchVto.slice(6, 8)}`
      ),
      issueDate: new Date(),
      receiverDocType: originalInvoice.receiverDocType,
      receiverDocNum: originalInvoice.receiverDocNum,
      receiverName: originalInvoice.receiverName,
      netAmount,
      taxAmount,
      totalAmount: creditAmount,
      relatedInvoiceId: originalInvoiceId,
      status: 'ISSUED'
    }
  });

  return {
    success: true,
    invoiceId: creditNote.id,
    voucherNumber: nextVoucherNumber,
    cae: response.CAE,
    caeExpiration: response.CAEFchVto
  };
}
```

### Generación de QR para Comprobantes

AFIP requiere que cada comprobante electrónico incluya un código QR con datos específicos:

```typescript
async getInvoiceQrUrl(tenantId: string, invoiceId: string): Promise<string | null> {
  const invoice = await prisma.afipInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { salesPoint: true, afipConfig: true }
  });

  if (!invoice) return null;

  // Estructura de datos para QR según especificación AFIP
  const qrData = {
    ver: 1, // Versión
    fecha: invoice.issueDate.toISOString().slice(0, 10),
    cuit: parseInt(invoice.afipConfig.cuit),
    ptoVta: invoice.salesPoint.number,
    tipoCmp: this.getVoucherTypeCode(invoice.voucherType),
    nroCmp: invoice.number,
    importe: Number(invoice.totalAmount),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: parseInt(invoice.receiverDocType),
    nroDocRec: parseInt(invoice.receiverDocNum || '0'),
    tipoCodAut: 'E', // E = CAE
    codAut: parseInt(invoice.cae)
  };

  // Codificar en base64
  const qrDataBase64 = Buffer.from(JSON.stringify(qrData)).toString('base64');

  // URL del QR de AFIP
  return `https://www.afip.gob.ar/fe/qr/?p=${qrDataBase64}`;
}

private getVoucherTypeCode(voucherType: string): number {
  const codes = {
    'FACTURA_A': 1,
    'FACTURA_B': 6,
    'FACTURA_C': 11,
    'NOTA_CREDITO_A': 3,
    'NOTA_CREDITO_B': 8,
    'NOTA_CREDITO_C': 13
  };
  return codes[voucherType] || 6;
}
```

### Verificación de Estado del Servidor AFIP

```typescript
// GET /api/afip/status

async checkServerStatus(tenantId: string) {
  const config = await prisma.afipConfig.findUnique({
    where: { tenantId }
  });

  if (!config) {
    throw new Error('Configuración AFIP no encontrada');
  }

  const afip = new Afip({
    CUIT: config.cuit,
    cert: config.afipCert,
    key: config.afipKey,
    production: config.isProduction
  });

  try {
    // Consultar estado del servidor
    const status = await afip.ElectronicBilling.getServerStatus();

    return {
      appServer: status.AppServer, // Estado del servidor de aplicación
      dbServer: status.DbServer,   // Estado del servidor de base de datos
      authServer: status.AuthServer, // Estado del servidor de autenticación
      isOnline: status.AppServer === 'OK' && status.DbServer === 'OK'
    };
  } catch (error) {
    return {
      isOnline: false,
      error: error.message
    };
  }
}
```

---

## Troubleshooting

### Mercado Pago

**Error: "Invalid access token"**

**Causa:** Token expirado o inválido.

**Solución:**
```bash
# Forzar refresh de token
POST /api/mercadopago/refresh-token?appType=POINT
```

**Error: "Device not found"**

**Causa:** El deviceId no pertenece a la cuenta vinculada.

**Solución:**
```bash
# Listar dispositivos de la cuenta
GET /api/mercadopago/devices

# Verificar que el deviceId existe en la lista
```

**Error: "Payment intent already exists"**

**Causa:** Se intentó crear una orden con un externalReference duplicado.

**Solución:**
- Usar externalReference únicos (timestamp + random)
- O cancelar la orden anterior antes de crear una nueva

**Pago huérfano (webhook no procesó)**

**Solución:**
```bash
# Listar pagos huérfanos
GET /api/mercadopago/orphan-payments?pointOfSaleId=cm123abc

# Vincular manualmente a una venta
POST /api/mercadopago/orphan-payments/:orderId/apply
{
  "pointOfSaleId": "cm123abc",
  "items": [...],
  "notes": "Venta recuperada manualmente"
}
```

### AFIP

**Error: "Certificado inválido o expirado"**

**Causa:** El certificado digital venció (son válidos por 1-3 años).

**Solución:**
```bash
# Generar nuevo certificado
POST /api/afip/generate-certificate
{
  "username": "20123456789",
  "password": "clave_fiscal",
  "alias": "CIANBOX-POS-PROD-2025",
  "isProduction": true
}
```

**Error: "AFIP Web Service no disponible"**

**Causa:** AFIP está en mantenimiento o caído.

**Solución:**
1. Verificar estado: `GET /api/afip/status`
2. Si está caído, esperar (los mantenimientos suelen ser nocturnos)
3. Emitir facturas manualmente y registrarlas después

**Error: "Número de comprobante inválido"**

**Causa:** El número no coincide con el siguiente esperado por AFIP.

**Solución:**
```bash
# Obtener último número desde AFIP
GET /api/afip/last-voucher?salesPointNumber=1&voucherType=FACTURA_B

# Sincronizar con BD local
# (El sistema debería hacer esto automáticamente)
```

**Error: "CUIT del receptor inválido"**

**Causa:** El CUIT tiene formato incorrecto o no existe en AFIP.

**Solución:**
- Verificar que el CUIT tiene 11 dígitos
- Remover guiones: `20-12345678-9` → `20123456789`
- Para Consumidor Final usar CUIT `0` con DocTipo `99`

---

## Mejores Prácticas

### Mercado Pago

1. **Siempre validar webhooks con HMAC-SHA256**
   - Evita procesar webhooks falsos/maliciosos

2. **Manejar idempotencia**
   - Un mismo pago puede generar múltiples webhooks
   - Verificar si ya fue procesado antes de registrar la venta

3. **Timeout de órdenes**
   - Point: Cancelar automáticamente órdenes > 5 minutos pendientes
   - QR: Cancelar automáticamente órdenes > 10 minutos pendientes

4. **Logging exhaustivo**
   - Registrar todos los webhooks recibidos
   - Guardar respuestas de API para debugging

5. **Retry con backoff exponencial**
   - Si una llamada a MP falla, reintentar con delays crecientes
   - Máximo 3 reintentos

### AFIP

1. **Backup de certificados**
   - Guardar certificados en lugar seguro fuera de la BD
   - Renovar antes del vencimiento (1 mes de anticipación)

2. **Cache de TAs (Tickets de Acceso)**
   - Los TAs son válidos por 12 horas
   - AfipSDK los cachea automáticamente en `/tmp/afip-ta`

3. **Manejo de errores de AFIP**
   - Guardar intentos fallidos en una tabla de retry
   - Procesar en lote las facturas pendientes cada 1 hora

4. **Testing en Homologación**
   - Siempre probar primero en ambiente de testing
   - Usar CUIT de testing: `20409378472`

5. **Validar datos antes de emitir**
   - CUIT válido y activo en AFIP
   - Montos coherentes (neto + IVA = total)
   - Punto de venta habilitado en AFIP

---

## Anexos

### A. Códigos de Tipo de Comprobante AFIP

| Código | Tipo |
|--------|------|
| 1 | Factura A |
| 2 | Nota de Débito A |
| 3 | Nota de Crédito A |
| 6 | Factura B |
| 7 | Nota de Débito B |
| 8 | Nota de Crédito B |
| 11 | Factura C |
| 12 | Nota de Débito C |
| 13 | Nota de Crédito C |

### B. Códigos de Tipo de Documento AFIP

| Código | Tipo |
|--------|------|
| 80 | CUIT |
| 86 | CUIL |
| 87 | CDI |
| 89 | LE |
| 90 | LC |
| 91 | CI Extranjera |
| 92 | En trámite |
| 93 | Acta nacimiento |
| 94 | CI Bs. As. RNP |
| 95 | CI Policía Federal |
| 96 | DNI |
| 99 | Consumidor Final |

### C. Códigos de IVA AFIP

| Código | Alícuota |
|--------|----------|
| 3 | 0% |
| 4 | 10.5% |
| 5 | 21% |
| 6 | 27% |
| 8 | 5% |
| 9 | 2.5% |

---

**Documento generado automáticamente - Versión 1.0.0**
