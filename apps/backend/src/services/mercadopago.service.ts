import { PrismaClient, MercadoPagoAppType } from '@prisma/client';
import { randomUUID, createHmac } from 'crypto';

const prisma = new PrismaClient();

// ============================================
// CONFIGURACIÓN OAUTH - DOS APLICACIONES
// ============================================

// App Point (Terminales)
const MP_POINT_CLIENT_ID = process.env.MP_POINT_CLIENT_ID || '';
const MP_POINT_CLIENT_SECRET = process.env.MP_POINT_CLIENT_SECRET || '';

// App QR (Código QR)
const MP_QR_CLIENT_ID = process.env.MP_QR_CLIENT_ID || '';
const MP_QR_CLIENT_SECRET = process.env.MP_QR_CLIENT_SECRET || '';

// Callback URL común (diferenciamos por state)
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI || '';

// Helper para obtener credenciales según tipo de app
function getAppCredentials(appType: MercadoPagoAppType): { clientId: string; clientSecret: string } {
  if (appType === 'POINT') {
    return { clientId: MP_POINT_CLIENT_ID, clientSecret: MP_POINT_CLIENT_SECRET };
  } else {
    return { clientId: MP_QR_CLIENT_ID, clientSecret: MP_QR_CLIENT_SECRET };
  }
}

// ============================================
// TIPOS
// ============================================

interface MPOrderRequest {
  tenantId: string;
  deviceId: string;
  amount: number;
  externalReference: string;
  description?: string;
  additionalInfo?: {
    items?: Array<{
      title: string;
      quantity: number;
      unit_price: number;
    }>;
  };
}

interface MPOrderResponse {
  id: string;
  status: string;
  external_reference: string;
  type: string;
  config: {
    point: {
      terminal_id: string;
    };
  };
  transactions: {
    payments: Array<{
      id?: string;
      amount: number;
      status?: string;
      payment_method?: {
        id: string;
        type: string;
      };
      payment_type?: {
        id: string;
      };
      card?: {
        first_six_digits?: string;
        last_four_digits?: string;
      };
      installments?: number;
    }>;
  };
  created_date?: string;
  last_updated_date?: string;
}

interface MPDevice {
  id: string;
  operating_mode: string;
  pos_id?: number;
  store_id?: string;
  external_pos_id?: string;
}

interface MPWebhookEvent {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: string;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

// ============================================
// SERVICIO DE MERCADO PAGO POINT
// ============================================

class MercadoPagoService {
  private baseUrl = 'https://api.mercadopago.com';
  private authUrl = 'https://auth.mercadopago.com';

  // ============================================
  // OAUTH 2.0 FLOW
  // ============================================

  /**
   * Genera la URL de autorización OAuth para que el cliente vincule su cuenta MP
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  getAuthorizationUrl(tenantId: string, appType: MercadoPagoAppType = 'POINT'): string {
    const { clientId } = getAppCredentials(appType);

    if (!clientId || !MP_REDIRECT_URI) {
      throw new Error(`Configuración de OAuth incompleta para ${appType}. Verificar credenciales.`);
    }

    // Incluimos tenantId y appType en el state
    const state = Buffer.from(JSON.stringify({ tenantId, appType })).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      state: state,
      redirect_uri: MP_REDIRECT_URI,
    });

    return `${this.authUrl}/authorization?${params.toString()}`;
  }

  /**
   * Intercambia el código de autorización por tokens
   * @param code - Código de autorización
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  async exchangeCodeForTokens(code: string, tenantId: string, appType: MercadoPagoAppType = 'POINT'): Promise<OAuthTokenResponse> {
    const { clientId, clientSecret } = getAppCredentials(appType);

    if (!clientId || !clientSecret || !MP_REDIRECT_URI) {
      throw new Error(`Configuración de OAuth incompleta para ${appType}`);
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: MP_REDIRECT_URI,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Error intercambiando código OAuth (${appType}):`, errorData);
      throw new Error(`Error en OAuth: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const tokens = (await response.json()) as OAuthTokenResponse;

    // Calcular fecha de expiración (expires_in viene en segundos)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Guardar tokens en la base de datos (upsert por tenantId + appType)
    await prisma.mercadoPagoConfig.upsert({
      where: {
        tenantId_appType: { tenantId, appType },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        mpUserId: tokens.user_id.toString(),
        publicKey: tokens.public_key,
        scope: tokens.scope,
        appId: clientId,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        appType,
        appId: clientId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        mpUserId: tokens.user_id.toString(),
        publicKey: tokens.public_key,
        scope: tokens.scope,
        isActive: true,
        environment: 'production',
      },
    });

    return tokens;
  }

  /**
   * Renueva el access token usando el refresh token
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  async refreshAccessToken(tenantId: string, appType: MercadoPagoAppType = 'POINT'): Promise<void> {
    const { clientId, clientSecret } = getAppCredentials(appType);

    if (!clientId || !clientSecret) {
      throw new Error(`Configuración de OAuth incompleta para ${appType}`);
    }

    const config = await prisma.mercadoPagoConfig.findUnique({
      where: {
        tenantId_appType: { tenantId, appType },
      },
    });

    if (!config || !config.refreshToken) {
      throw new Error(`No hay refresh token disponible para ${appType}. El cliente debe re-autorizar.`);
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Error renovando token (${appType}):`, errorData);

      // Si el refresh token es inválido, desactivamos la integración
      if (response.status === 400 || response.status === 401) {
        await prisma.mercadoPagoConfig.update({
          where: {
            tenantId_appType: { tenantId, appType },
          },
          data: { isActive: false },
        });
        throw new Error(`Refresh token inválido para ${appType}. El cliente debe re-autorizar.`);
      }

      throw new Error(`Error renovando token (${appType}): ${response.status}`);
    }

    const tokens = (await response.json()) as OAuthTokenResponse;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.mercadoPagoConfig.update({
      where: {
        tenantId_appType: { tenantId, appType },
      },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        publicKey: tokens.public_key,
        scope: tokens.scope,
        updatedAt: new Date(),
      },
    });

    console.log(`Token renovado para tenant ${tenantId} (${appType})`);
  }

  /**
   * Obtiene un access token válido, renovándolo si es necesario
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  async getValidAccessToken(tenantId: string, appType: MercadoPagoAppType = 'POINT'): Promise<string> {
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: {
        tenantId_appType: { tenantId, appType },
      },
    });

    if (!config || !config.isActive) {
      throw new Error(`Mercado Pago ${appType} no está configurado para este tenant`);
    }

    // Verificar si el token está por expirar (renovar si expira en menos de 1 hora)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    if (config.tokenExpiresAt && config.tokenExpiresAt < oneHourFromNow) {
      console.log(`Token ${appType} próximo a expirar para tenant ${tenantId}, renovando...`);
      await this.refreshAccessToken(tenantId, appType);

      // Obtener el token actualizado
      const updatedConfig = await prisma.mercadoPagoConfig.findUnique({
        where: {
          tenantId_appType: { tenantId, appType },
        },
      });
      return updatedConfig!.accessToken;
    }

    return config.accessToken;
  }

  /**
   * Desvincula la cuenta de MP del tenant para un tipo de app específico
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  async disconnectAccount(tenantId: string, appType: MercadoPagoAppType = 'POINT'): Promise<void> {
    await prisma.mercadoPagoConfig.delete({
      where: {
        tenantId_appType: { tenantId, appType },
      },
    }).catch(() => {
      // Ignorar si no existe
    });
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  /**
   * Obtiene la configuración de MP para un tenant y tipo de app
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  async getConfig(tenantId: string, appType: MercadoPagoAppType = 'POINT') {
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: {
        tenantId_appType: { tenantId, appType },
      },
    });

    if (!config || !config.isActive) {
      throw new Error(`Mercado Pago ${appType} no está configurado para este tenant`);
    }

    return config;
  }

  /**
   * Obtiene la configuración sin lanzar error si no existe
   * @param tenantId - ID del tenant
   * @param appType - Tipo de app: 'POINT' o 'QR'
   */
  async getConfigSafe(tenantId: string, appType: MercadoPagoAppType = 'POINT') {
    return prisma.mercadoPagoConfig.findUnique({
      where: {
        tenantId_appType: { tenantId, appType },
      },
    });
  }

  /**
   * Obtiene todas las configuraciones de MP para un tenant (Point y QR)
   * @param tenantId - ID del tenant
   */
  async getAllConfigs(tenantId: string) {
    return prisma.mercadoPagoConfig.findMany({
      where: { tenantId },
    });
  }

  // ============================================
  // ÓRDENES DE PAGO POINT
  // ============================================

  /**
   * Crea una orden de pago en un terminal Point
   * Usa exclusivamente la app POINT
   */
  async createPointOrder(params: MPOrderRequest): Promise<{ orderId: string; status: string }> {
    const accessToken = await this.getValidAccessToken(params.tenantId, 'POINT');

    const idempotencyKey = randomUUID();

    // Asegurar que el amount tenga exactamente 2 decimales
    const formattedAmount = Number(params.amount).toFixed(2);

    const orderBody = {
      type: 'point',
      external_reference: params.externalReference,
      description: params.description || 'Venta POS',
      transactions: {
        payments: [
          {
            amount: formattedAmount,
          },
        ],
      },
      config: {
        point: {
          terminal_id: params.deviceId,
        },
      },
      ...(params.additionalInfo && { additional_info: params.additionalInfo }),
    };

    const response = await fetch(`${this.baseUrl}/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(orderBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error creando orden MP:', errorData);
      throw new Error(`Error al crear orden en Mercado Pago: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const orderResponse = (await response.json()) as MPOrderResponse;

    // Guardar la orden en nuestra DB
    await prisma.mercadoPagoOrder.create({
      data: {
        tenantId: params.tenantId,
        orderId: orderResponse.id,
        externalReference: params.externalReference,
        deviceId: params.deviceId,
        amount: params.amount,
        status: 'PENDING',
        responseData: JSON.parse(JSON.stringify(orderResponse)),
      },
    });

    return {
      orderId: orderResponse.id,
      status: orderResponse.status || 'PENDING',
    };
  }

  /**
   * Consulta el estado de una orden (Point)
   */
  async getOrderStatus(tenantId: string, orderId: string) {
    const accessToken = await this.getValidAccessToken(tenantId, 'POINT');

    const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar orden: ${response.status}`);
    }

    const orderData = (await response.json()) as MPOrderResponse;

    // Mapear status de MP a nuestro status
    let status = 'PENDING';
    const payment = orderData.transactions?.payments?.[0];

    if (orderData.status === 'processed' || payment?.status === 'approved') {
      status = 'PROCESSED';
    } else if (orderData.status === 'canceled') {
      status = 'CANCELED';
    } else if (orderData.status === 'failed' || payment?.status === 'rejected') {
      status = 'FAILED';
    } else if (orderData.status === 'expired') {
      status = 'EXPIRED';
    }

    // Actualizar en nuestra DB
    const updateData: Record<string, unknown> = {
      status,
      responseData: JSON.parse(JSON.stringify(orderData)),
      updatedAt: new Date(),
    };

    if (status === 'PROCESSED' && payment) {
      updateData.processedAt = new Date();
      updateData.paymentId = payment.id;
      updateData.paymentMethod = payment.payment_method?.type;
      updateData.cardBrand = payment.payment_method?.id;
      updateData.cardLastFour = payment.card?.last_four_digits;
      updateData.installments = payment.installments;
    }

    await prisma.mercadoPagoOrder.update({
      where: { orderId },
      data: updateData,
    });

    return {
      orderId: orderData.id,
      status,
      paymentId: payment?.id,
      paymentMethod: payment?.payment_method?.type,
      cardBrand: payment?.payment_method?.id,
      cardLastFour: payment?.card?.last_four_digits,
      installments: payment?.installments,
      amount: payment?.amount,
    };
  }

  /**
   * Cancela una orden pendiente (Point)
   * Nota: Solo se puede cancelar cuando status = 'created'.
   * Si está 'at_terminal', debe cancelarse desde el dispositivo físico.
   */
  async cancelOrder(tenantId: string, orderId: string): Promise<void> {
    const accessToken = await this.getValidAccessToken(tenantId, 'POINT');

    const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `cancel-${orderId}-${Date.now()}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json().catch(() => ({})) as { errors?: Array<{ message?: string }> };
      const errorMsg = errorData.errors?.[0]?.message || `Error ${response.status}`;

      // Si la orden ya está en el terminal, no se puede cancelar via API
      if (errorMsg.includes('at_terminal')) {
        throw new Error('La orden ya está en el terminal. Cancelá desde el dispositivo físico.');
      }

      throw new Error(`Error al cancelar orden: ${errorMsg}`);
    }

    // Actualizar en nuestra DB
    await prisma.mercadoPagoOrder.update({
      where: { orderId },
      data: {
        status: 'CANCELED',
        updatedAt: new Date(),
      },
    });
  }

  // ============================================
  // DISPOSITIVOS POINT
  // ============================================

  /**
   * Lista los dispositivos Point del tenant
   * Usa exclusivamente la app POINT
   */
  async listDevices(tenantId: string): Promise<MPDevice[]> {
    const accessToken = await this.getValidAccessToken(tenantId, 'POINT');

    const response = await fetch(`${this.baseUrl}/point/integration-api/devices`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error listando dispositivos:', errorData);
      throw new Error(`Error al listar dispositivos: ${response.status}`);
    }

    const data = (await response.json()) as { devices?: MPDevice[] };
    return data.devices || [];
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Procesa un webhook de Mercado Pago
   */
  async processWebhook(event: MPWebhookEvent): Promise<void> {
    console.log('Procesando webhook MP:', event);

    // Solo procesamos eventos de órdenes
    if (event.type !== 'order') {
      console.log('Evento ignorado, tipo:', event.type);
      return;
    }

    const orderId = event.data.id;

    // Buscar la orden en nuestra DB
    const order = await prisma.mercadoPagoOrder.findUnique({
      where: { orderId },
    });

    if (!order) {
      console.log('Orden no encontrada en DB:', orderId);
      return;
    }

    // Actualizar el estado desde MP
    try {
      await this.getOrderStatus(order.tenantId, orderId);
      console.log('Orden actualizada desde webhook:', orderId);
    } catch (error) {
      console.error('Error actualizando orden desde webhook:', error);
    }
  }

  /**
   * Valida la firma de un webhook
   */
  validateWebhookSignature(
    xSignature: string,
    xRequestId: string,
    dataId: string,
    secret: string
  ): boolean {
    // Separar x-signature en ts y v1
    const parts = xSignature.split(',');
    let ts = '';
    let hash = '';

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key.trim() === 'ts') {
        ts = value.trim();
      } else if (key.trim() === 'v1') {
        hash = value.trim();
      }
    }

    if (!ts || !hash) {
      return false;
    }

    // Construir el manifest
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calcular HMAC
    const hmac = createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedHash = hmac.digest('hex');

    return calculatedHash === hash;
  }

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Obtiene una orden por su ID interno
   */
  async getOrderById(id: string) {
    return prisma.mercadoPagoOrder.findUnique({
      where: { id },
    });
  }

  /**
   * Obtiene una orden por su ID de MP
   */
  async getOrderByMPId(orderId: string) {
    return prisma.mercadoPagoOrder.findUnique({
      where: { orderId },
    });
  }

  /**
   * Asocia una orden de MP con una venta
   */
  async linkOrderToSale(orderId: string, saleId: string) {
    return prisma.mercadoPagoOrder.update({
      where: { orderId },
      data: { saleId },
    });
  }

  /**
   * Lista órdenes pendientes de un tenant
   */
  async listPendingOrders(tenantId: string) {
    return prisma.mercadoPagoOrder.findMany({
      where: {
        tenantId,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // ============================================
  // QR: SUCURSALES Y CAJAS
  // ============================================

  /**
   * Lista sucursales (stores) de la cuenta MP para QR
   */
  async listQRStores(tenantId: string): Promise<Array<{ id: string; name: string; external_id: string }>> {
    const accessToken = await this.getValidAccessToken(tenantId, 'QR');

    // Obtener el user_id de la config
    const config = await this.getConfig(tenantId, 'QR');
    if (!config?.mpUserId) {
      throw new Error('No se encontró el user_id de Mercado Pago');
    }

    const response = await fetch(
      `${this.baseUrl}/users/${config.mpUserId}/stores/search`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Error listando stores MP:', error);
      throw new Error('Error al obtener sucursales de Mercado Pago');
    }

    const data = await response.json() as { results?: Array<{ id: string; name: string; external_id: string }> };
    return data.results || [];
  }

  /**
   * Lista cajas (POS) de una sucursal para QR
   */
  async listQRCashiers(tenantId: string, storeId?: string): Promise<Array<{ id: number; name: string; external_id: string; store_id: string }>> {
    const accessToken = await this.getValidAccessToken(tenantId, 'QR');

    // Obtener el user_id de la config
    const config = await this.getConfig(tenantId, 'QR');
    if (!config?.mpUserId) {
      throw new Error('No se encontró el user_id de Mercado Pago');
    }

    let url = `${this.baseUrl}/pos?`;
    if (storeId) {
      url += `store_id=${storeId}&`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error listando POS MP:', errorData);
      throw new Error('Error al obtener cajas de Mercado Pago');
    }

    const data = await response.json() as { results?: Array<{ id: number; name: string; external_id: string; store_id: string }> };
    return data.results || [];
  }

  /**
   * Crea una orden QR dinámica
   */
  async createQROrder(params: {
    tenantId: string;
    externalPosId: string;
    amount: number;
    externalReference: string;
    description?: string;
    items?: Array<{ title: string; quantity: number; unit_price: number }>;
  }): Promise<{ orderId: string; qrData: string; inStoreOrderId: string }> {
    const accessToken = await this.getValidAccessToken(params.tenantId, 'QR');

    // Obtener el user_id de la config
    const config = await this.getConfig(params.tenantId, 'QR');
    if (!config?.mpUserId) {
      throw new Error('No se encontró el user_id de Mercado Pago');
    }

    // Preparar items con unit_measure requerido por MP
    // Asegurar que los precios tengan exactamente 2 decimales
    const items = params.items
      ? params.items.map(item => {
          const unitPrice = Math.round(item.unit_price * 100) / 100;
          const totalAmt = Math.round(unitPrice * item.quantity * 100) / 100;
          return {
            ...item,
            unit_price: unitPrice,
            unit_measure: 'unit',
            total_amount: totalAmt,
          };
        })
      : [
          {
            title: params.description || 'Venta POS',
            unit_price: Math.round(params.amount * 100) / 100,
            quantity: 1,
            unit_measure: 'unit',
            total_amount: Math.round(params.amount * 100) / 100,
          },
        ];

    // Calcular total_amount como suma de items (redondeado a 2 decimales)
    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.total_amount, 0) * 100) / 100;

    const orderData = {
      external_reference: params.externalReference,
      title: params.description || 'Venta POS',
      description: params.description || 'Venta desde Cianbox POS',
      total_amount: totalAmount,
      items,
      expiration_date: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
      notification_url: `${process.env.API_BASE_URL || 'https://api.cianbox-pos.ews-cdn.link'}/api/webhooks/mercadopago`,
    };

    // Crear orden QR dinámica
    const response = await fetch(
      `${this.baseUrl}/instore/qr/seller/collectors/${config.mpUserId}/pos/${params.externalPosId}/orders`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': params.externalReference,
        },
        body: JSON.stringify(orderData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      console.error('Error creando orden QR:', errorData);
      throw new Error(errorData.message || 'Error al crear orden QR');
    }

    // MP puede devolver 200/201 con body vacío o con datos
    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) as { in_store_order_id?: string; qr_data?: string } : {};

    // Guardar la orden en BD
    await prisma.mercadoPagoOrder.create({
      data: {
        tenantId: params.tenantId,
        orderId: data.in_store_order_id || params.externalReference,
        externalReference: params.externalReference,
        deviceId: params.externalPosId,
        amount: params.amount,
        status: 'PENDING',
      },
    });

    return {
      orderId: data.in_store_order_id || params.externalReference,
      qrData: data.qr_data || '',
      inStoreOrderId: data.in_store_order_id || '',
    };
  }

  // ============================================
  // CRON: RENOVACIÓN AUTOMÁTICA DE TOKENS
  // ============================================

  /**
   * Renueva tokens que están próximos a expirar (para cron job)
   * Renueva tokens que expiran en menos de 7 días
   */
  async refreshExpiringTokens(): Promise<void> {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiringConfigs = await prisma.mercadoPagoConfig.findMany({
      where: {
        isActive: true,
        refreshToken: { not: null },
        tokenExpiresAt: { lt: sevenDaysFromNow },
      },
    });

    console.log(`Encontrados ${expiringConfigs.length} tokens próximos a expirar`);

    for (const config of expiringConfigs) {
      try {
        await this.refreshAccessToken(config.tenantId, config.appType);
        console.log(`Token renovado exitosamente para tenant ${config.tenantId} (${config.appType})`);
      } catch (error) {
        console.error(`Error renovando token para tenant ${config.tenantId} (${config.appType}):`, error);
      }
    }
  }
}

export const mercadoPagoService = new MercadoPagoService();
export default mercadoPagoService;
