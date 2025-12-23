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
  action?: string;
  api_version?: string;
  data?: {
    id: string;
  };
  date_created?: string;
  id?: number | string;
  live_mode?: boolean;
  type?: string;
  topic?: string; // Formato alternativo de MP
  user_id?: string | number;
}

interface MPPaymentWebhookData {
  id: number;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  card?: {
    last_four_digits?: string;
  };
  installments?: number;
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

// Respuesta completa de un pago de MP
interface MPFullPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  operation_type: string;
  transaction_amount: number;
  currency_id: string;
  description: string;
  external_reference: string;
  date_approved: string;
  date_created: string;
  authorization_code?: string;
  installments?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  payment_method?: {
    id: string;
    type: string;
    issuer_id?: string;
  };
  order?: {
    id: string;
    type: string;
  };
  payer?: {
    id?: string;
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  card?: {
    first_six_digits?: string;
    last_four_digits?: string;
    expiration_month?: number;
    expiration_year?: number;
    cardholder?: {
      name?: string;
      identification?: {
        type?: string;
        number?: string;
      };
    };
    tags?: string[];
  };
  amounts?: {
    collector?: {
      net_received?: number;
      transaction?: number;
    };
  };
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
    installment_amount?: number;
    bank_transfer_id?: number;
    transaction_id?: string;
  };
  fee_details?: Array<{
    type: string;
    amount: number;
    fee_payer: string;
  }>;
  charges_details?: Array<{
    name: string;
    type: string;
    amounts: {
      original: number;
      refunded?: number;
    };
    rate?: number;
  }>;
  point_of_interaction?: {
    type: string;
    device?: {
      serial_number?: string;
    };
    transaction_data?: {
      bank_info?: {
        origin_bank_id?: string;
        payer?: {
          long_name?: string;
          account_id?: number;
        };
        collector?: {
          account_id?: number;
          long_name?: string;
        };
      };
      transaction_id?: string;
    };
  };
  additional_info?: {
    poi_id?: string;
    items?: Array<{
      title: string;
      quantity: number;
      unit_price: number;
    }>;
  };
  pos_id?: string;
  store_id?: string;
}

// Detalles de pago procesados para guardar en Payment
interface MPPaymentDetails {
  // IDs
  mpPaymentId?: string;
  mpOrderId?: string;

  // Tipo de operación
  mpOperationType?: string;
  mpPointType?: string;

  // Datos de la tarjeta
  cardBrand?: string;
  cardLastFour?: string;
  cardFirstSix?: string;
  cardExpirationMonth?: number;
  cardExpirationYear?: number;
  cardholderName?: string;
  cardType?: string;

  // Método de pago
  paymentMethodType?: string;
  installments?: number;

  // Datos del pagador
  payerEmail?: string;
  payerIdType?: string;
  payerIdNumber?: string;

  // Autorización
  authorizationCode?: string;

  // Montos
  transactionAmount?: number;
  netReceivedAmount?: number;
  mpFeeAmount?: number;
  mpFeeRate?: number;

  // Banco (para QR/transferencia)
  bankOriginId?: string;
  bankOriginName?: string;
  bankTransferId?: string;

  // Dispositivo
  mpDeviceId?: string;
  mpPosId?: string;
  mpStoreId?: string;

  // Status
  status?: string;
  statusDetail?: string;

  // Fechas
  dateApproved?: string;
  dateCreated?: string;

  // Datos completos
  rawData?: MPFullPaymentResponse;
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
   * Obtiene los detalles completos de un pago de MP por su ID
   * Devuelve toda la información para guardar en Payment
   * Maneja diferentes formatos de ID:
   * - orderId (empieza con "ORD"): consulta la orden primero
   * - externalReference (formato POS-*): busca por external_reference (QR)
   * - paymentId numérico: consulta directamente
   */
  async getPaymentDetails(tenantId: string, paymentIdOrOrderId: string, appType: MercadoPagoAppType = 'POINT'): Promise<MPPaymentDetails> {
    const accessToken = await this.getValidAccessToken(tenantId, appType);

    let actualPaymentId = paymentIdOrOrderId;
    let orderId: string | undefined;

    // Si es un orderId (empieza con "ORD"), buscar primero en nuestra BD local
    if (paymentIdOrOrderId.startsWith('ORD')) {
      orderId = paymentIdOrOrderId;

      // Buscar en nuestra tabla de órdenes MP que tiene el responseData con el reference_id
      const mpOrder = await prisma.mercadoPagoOrder.findUnique({
        where: { orderId: paymentIdOrOrderId },
        select: { responseData: true, paymentId: true },
      });

      if (mpOrder?.responseData) {
        const responseData = mpOrder.responseData as {
          transactions?: {
            payments?: Array<{
              reference_id?: string;
              id?: string;
            }>;
          };
        };
        // El reference_id es el paymentId numérico real de MP
        const referenceId = responseData.transactions?.payments?.[0]?.reference_id;
        if (referenceId) {
          actualPaymentId = referenceId;
          console.log(`[MP] Orden ${paymentIdOrOrderId} -> referenceId: ${referenceId}`);
        } else {
          throw new Error('La orden no tiene reference_id en nuestra BD');
        }
      } else {
        // Si no está en nuestra BD, intentar consultar la API de MP
        const orderResponse = await fetch(`${this.baseUrl}/v1/orders/${paymentIdOrOrderId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!orderResponse.ok) {
          throw new Error(`Error al consultar orden: ${orderResponse.status}`);
        }

        const orderData = await orderResponse.json() as MPOrderResponse;

        // Obtener el paymentId del primer pago de la orden
        const payment = orderData.transactions?.payments?.[0];
        if (!payment?.id) {
          throw new Error('La orden no tiene un pago asociado');
        }
        actualPaymentId = payment.id.toString();
      }
    }
    // Si es un externalReference (formato POS-* o similar, no numérico), buscar por external_reference
    else if (isNaN(Number(paymentIdOrOrderId))) {
      const searchResponse = await fetch(
        `${this.baseUrl}/v1/payments/search?external_reference=${encodeURIComponent(paymentIdOrOrderId)}&sort=date_created&criteria=desc`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Error al buscar pago por external_reference: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json() as { results: Array<{ id: number }> };
      const foundPayment = searchData.results?.[0];

      if (!foundPayment?.id) {
        throw new Error('No se encontró un pago con esa referencia externa');
      }
      actualPaymentId = foundPayment.id.toString();
    }

    const response = await fetch(`${this.baseUrl}/v1/payments/${actualPaymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar pago: ${response.status}`);
    }

    const data = await response.json() as MPFullPaymentResponse;

    // Extraer comisión
    const feeDetail = data.fee_details?.find((f: { type: string }) => f.type === 'mercadopago_fee');
    const chargeDetail = data.charges_details?.find((c: { name: string }) => c.name === 'mercadopago_fee');

    // Datos de transferencia bancaria (para QR)
    const bankInfo = data.point_of_interaction?.transaction_data?.bank_info;

    return {
      // IDs
      mpPaymentId: data.id?.toString(),
      mpOrderId: orderId || data.order?.id?.toString(),

      // Tipo de operación
      mpOperationType: data.operation_type,
      mpPointType: data.point_of_interaction?.type,

      // Datos de la tarjeta
      cardBrand: data.payment_method?.id || data.payment_method_id,
      cardLastFour: data.card?.last_four_digits,
      cardFirstSix: data.card?.first_six_digits,
      cardExpirationMonth: data.card?.expiration_month,
      cardExpirationYear: data.card?.expiration_year,
      cardholderName: data.card?.cardholder?.name?.trim(),
      cardType: data.card?.tags?.[0], // credit, debit

      // Método de pago
      paymentMethodType: data.payment_method?.type || data.payment_type_id,
      installments: data.installments,

      // Datos del pagador
      payerEmail: data.payer?.email,
      payerIdType: data.payer?.identification?.type,
      payerIdNumber: data.payer?.identification?.number,

      // Autorización
      authorizationCode: data.authorization_code,

      // Montos
      transactionAmount: data.transaction_amount,
      netReceivedAmount: data.amounts?.collector?.net_received || data.transaction_details?.net_received_amount,
      mpFeeAmount: feeDetail?.amount || chargeDetail?.amounts?.original,
      mpFeeRate: chargeDetail?.rate,

      // Banco (para QR/transferencia)
      bankOriginId: bankInfo?.origin_bank_id,
      bankOriginName: bankInfo?.payer?.long_name,
      bankTransferId: data.transaction_details?.bank_transfer_id?.toString(),

      // Dispositivo
      mpDeviceId: data.point_of_interaction?.device?.serial_number || data.additional_info?.poi_id,
      mpPosId: data.pos_id?.toString(),
      mpStoreId: data.store_id?.toString(),

      // Status
      status: data.status,
      statusDetail: data.status_detail,

      // Fechas
      dateApproved: data.date_approved,
      dateCreated: data.date_created,

      // Datos completos para referencia
      rawData: data,
    };
  }

  /**
   * Consulta el estado de una orden QR buscando pagos por external_reference
   */
  async getQROrderStatus(tenantId: string, externalReference: string) {
    const accessToken = await this.getValidAccessToken(tenantId, 'QR');

    // Buscar pagos por external_reference
    const response = await fetch(
      `${this.baseUrl}/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error al consultar pagos QR: ${response.status}`);
    }

    const data = (await response.json()) as { results: Array<{ id: string; status: string; status_detail: string; transaction_amount: number; payment_method_id: string; card?: { last_four_digits?: string }; installments?: number }> };

    const payment = data.results?.[0];

    if (!payment) {
      return {
        status: 'PENDING',
        externalReference,
      };
    }

    // Mapear status de pago a nuestro status
    let status = 'PENDING';
    if (payment.status === 'approved') {
      status = 'PROCESSED';
    } else if (payment.status === 'cancelled' || payment.status === 'refunded') {
      status = 'CANCELED';
    } else if (payment.status === 'rejected') {
      status = 'FAILED';
    }

    // Actualizar en nuestra DB si existe
    try {
      await prisma.mercadoPagoOrder.updateMany({
        where: { externalReference },
        data: {
          status,
          paymentId: payment.id?.toString(),
          paymentMethod: payment.payment_method_id,
          cardLastFour: payment.card?.last_four_digits,
          installments: payment.installments,
          updatedAt: new Date(),
          ...(status === 'PROCESSED' ? { processedAt: new Date() } : {}),
        },
      });
    } catch (e) {
      console.error('Error actualizando orden QR en DB:', e);
    }

    return {
      status,
      externalReference,
      paymentId: payment.id?.toString(),
      paymentMethod: payment.payment_method_id,
      cardLastFour: payment.card?.last_four_digits,
      installments: payment.installments,
      amount: payment.transaction_amount,
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

  /**
   * Cambia el modo de operación de un dispositivo Point
   * @param tenantId - ID del tenant
   * @param deviceId - ID del dispositivo Point
   * @param operatingMode - Modo de operación: 'PDV' (integrado) o 'STANDALONE' (no integrado)
   * @returns Dispositivo actualizado
   *
   * IMPORTANTE: El dispositivo debe reiniciarse después del cambio para que tome efecto
   */
  async changeDeviceOperatingMode(
    tenantId: string,
    deviceId: string,
    operatingMode: 'PDV' | 'STANDALONE'
  ): Promise<MPDevice> {
    const accessToken = await this.getValidAccessToken(tenantId, 'POINT');

    const response = await fetch(`${this.baseUrl}/point/integration-api/devices/${deviceId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operating_mode: operatingMode }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string };
      console.error('Error cambiando modo de operación:', errorData);
      throw new Error(errorData.message || errorData.error || `Error al cambiar modo de operación: ${response.status}`);
    }

    const device = (await response.json()) as MPDevice;
    return device;
  }

  /**
   * NOTA: La asociación terminal→POS NO se puede hacer vía API.
   * Se debe configurar desde el dispositivo físico:
   * Más opciones > Ajustes > Modo de vinculación
   *
   * Este método queda comentado porque la API de MP no lo soporta.
   * Solo es posible:
   * - Consultar terminales con GET /terminals/v1/list
   * - Cambiar operating_mode con PATCH /terminals/v1/setup
   */

  /**
   * Lista stores para Point (usa la misma estructura que QR)
   */
  async listPointStores(tenantId: string): Promise<Array<{ id: string; name: string; external_id: string }>> {
    const accessToken = await this.getValidAccessToken(tenantId, 'POINT');

    const config = await this.getConfig(tenantId, 'POINT');
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
      console.error('Error listando stores MP Point:', error);
      throw new Error('Error al obtener sucursales de Mercado Pago');
    }

    const data = await response.json() as { results?: Array<{ id: string; name: string; external_id: string }> };
    return data.results || [];
  }

  /**
   * Lista POS para Point (usa la misma estructura que QR)
   */
  async listPointPOS(tenantId: string, storeId?: string): Promise<Array<{
    id: number;
    name: string;
    external_id: string;
    store_id: string;
  }>> {
    const accessToken = await this.getValidAccessToken(tenantId, 'POINT');

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
      console.error('Error listando POS MP Point:', errorData);
      throw new Error('Error al obtener POS de Mercado Pago');
    }

    interface MPPosResult {
      id: number;
      name: string;
      external_id: string;
      store_id: string;
    }

    const data = await response.json() as { results?: MPPosResult[] };
    return data.results || [];
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Procesa un webhook de Mercado Pago
   * Soporta eventos de tipo 'order' (Point) y 'payment' (QR y otros)
   * También soporta topic_merchant_order_wh para merchant orders
   */
  async processWebhook(event: MPWebhookEvent): Promise<void> {
    console.log('[Webhook MP] Procesando evento:', event);

    // Extraer el ID del evento de diferentes formatos posibles
    const eventId = event.data?.id || event.id;
    const eventType = event.type || event.topic;

    if (!eventId) {
      console.warn('[Webhook MP] No se pudo extraer ID del evento:', event);
      return;
    }

    console.log(`[Webhook MP] Tipo: ${eventType}, ID: ${eventId}`);

    // Procesar eventos de órdenes (Point)
    if (eventType === 'order') {
      const order = await prisma.mercadoPagoOrder.findUnique({
        where: { orderId: String(eventId) },
      });

      if (!order) {
        console.log('[Webhook MP] Orden no encontrada en DB:', eventId);
        return;
      }

      try {
        await this.getOrderStatus(order.tenantId, String(eventId));
        console.log('[Webhook MP] Orden actualizada:', eventId);
      } catch (error) {
        console.error('[Webhook MP] Error actualizando orden:', error);
      }
      return;
    }

    // Procesar eventos de pagos (QR y otros)
    if (eventType === 'payment') {
      await this.processPaymentWebhook(String(eventId), String(event.user_id || ''));
      return;
    }

    // Procesar merchant orders (puede contener info de pago QR)
    if (eventType === 'topic_merchant_order_wh' || eventType === 'merchant_order') {
      console.log('[Webhook MP] Merchant order recibida, ID:', eventId);
      // Las merchant orders contienen info agregada, el pago ya debería procesarse por el evento payment
      return;
    }

    console.log('[Webhook MP] Evento ignorado, tipo:', eventType);
  }

  /**
   * Procesa un webhook de pago (usado para QR principalmente)
   * Busca el pago en MP y actualiza la orden correspondiente por external_reference
   */
  async processPaymentWebhook(paymentId: string, mpUserId: string): Promise<void> {
    console.log(`[Webhook MP] Procesando pago ${paymentId} para user ${mpUserId}`);

    try {
      // Buscar el tenant por mpUserId en la config de QR
      const mpConfig = await prisma.mercadoPagoConfig.findFirst({
        where: {
          mpUserId: mpUserId,
          isActive: true,
        },
      });

      if (!mpConfig) {
        console.log(`[Webhook MP] No se encontró config para mpUserId ${mpUserId}`);
        return;
      }

      // Obtener detalles del pago desde MP
      const accessToken = await this.getValidAccessToken(mpConfig.tenantId, mpConfig.appType);

      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error(`[Webhook MP] Error obteniendo pago ${paymentId}: ${response.status}`);
        return;
      }

      const paymentData = await response.json() as MPPaymentWebhookData;
      console.log(`[Webhook MP] Pago ${paymentId}:`, {
        status: paymentData.status,
        external_reference: paymentData.external_reference,
        amount: paymentData.transaction_amount,
      });

      // Si el pago está aprobado, buscar y actualizar la orden por external_reference
      if (paymentData.status === 'approved' && paymentData.external_reference) {
        const updateResult = await prisma.mercadoPagoOrder.updateMany({
          where: {
            externalReference: paymentData.external_reference,
            tenantId: mpConfig.tenantId,
            status: 'PENDING',
          },
          data: {
            status: 'PROCESSED',
            paymentId: paymentId,
            paymentMethod: paymentData.payment_method_id,
            cardLastFour: paymentData.card?.last_four_digits,
            installments: paymentData.installments,
            processedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        if (updateResult.count > 0) {
          console.log(`[Webhook MP] Orden actualizada: ${paymentData.external_reference} -> PROCESSED`);
        } else {
          // Si no encontramos una orden pendiente, crear una nueva (para casos donde no se creó orden previa)
          console.log(`[Webhook MP] No se encontró orden pendiente para ${paymentData.external_reference}, creando nueva...`);

          await prisma.mercadoPagoOrder.create({
            data: {
              tenantId: mpConfig.tenantId,
              orderId: paymentId, // Usar paymentId como orderId
              externalReference: paymentData.external_reference,
              deviceId: 'QR-WEBHOOK', // Dispositivo genérico para pagos QR vía webhook
              amount: paymentData.transaction_amount || 0,
              status: 'PROCESSED',
              paymentId: paymentId,
              paymentMethod: paymentData.payment_method_id,
              cardLastFour: paymentData.card?.last_four_digits,
              installments: paymentData.installments,
              processedAt: new Date(),
            },
          });
          console.log(`[Webhook MP] Nueva orden creada para pago ${paymentId}`);
        }
      }
    } catch (error) {
      console.error(`[Webhook MP] Error procesando pago ${paymentId}:`, error);
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
   * Crea una sucursal (store) en Mercado Pago para QR
   */
  async createQRStore(tenantId: string, data: {
    name: string;
    external_id: string;
    location: {
      street_name: string;
      street_number: string;
      city_name: string;
      state_name: string;
    };
  }): Promise<{ id: string; name: string; external_id: string }> {
    const accessToken = await this.getValidAccessToken(tenantId, 'QR');

    const config = await this.getConfig(tenantId, 'QR');
    if (!config?.mpUserId) {
      throw new Error('No se encontró el user_id de Mercado Pago');
    }

    // Mercado Pago requiere latitude y longitude - usamos coordenadas por defecto de Buenos Aires
    const locationWithCoords = {
      ...data.location,
      latitude: -34.6037,
      longitude: -58.3816,
    };

    const requestBody = {
      name: data.name,
      external_id: data.external_id,
      location: locationWithCoords,
    };

    console.log('Creando store en MP:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `${this.baseUrl}/users/${config.mpUserId}/stores`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creando store MP - Status:', response.status, 'Response:', errorText);

      let errorMessage = 'Error al crear local en Mercado Pago';
      try {
        const errorJson = JSON.parse(errorText);
        // MP devuelve detalles en 'cause' o 'causes'
        if (errorJson.cause && Array.isArray(errorJson.cause) && errorJson.cause.length > 0) {
          const causes = errorJson.cause.map((c: { code?: string; description?: string }) =>
            c.description || c.code || JSON.stringify(c)
          ).join(', ');
          errorMessage = `${errorJson.message || 'Error'}: ${causes}`;
        } else if (errorJson.causes && Array.isArray(errorJson.causes) && errorJson.causes.length > 0) {
          const causes = errorJson.causes.map((c: { code?: string; description?: string }) =>
            c.description || c.code || JSON.stringify(c)
          ).join(', ');
          errorMessage = `${errorJson.message || 'Error'}: ${causes}`;
        } else {
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        }
      } catch {
        // Si no es JSON, usar el texto como mensaje
        if (errorText) errorMessage = errorText;
      }

      throw new Error(errorMessage);
    }

    const store = await response.json() as { id: string; name: string; external_id: string };

    // Guardar en DB local
    await this.saveLocalStore(tenantId, {
      mpStoreId: store.id,
      externalId: store.external_id,
      name: store.name,
      streetName: data.location.street_name,
      streetNumber: data.location.street_number,
      cityName: data.location.city_name,
      stateName: data.location.state_name,
    });

    return store;
  }

  /**
   * Crea una caja (POS) en Mercado Pago para QR
   */
  async createQRCashier(tenantId: string, data: {
    name: string;
    external_id: string;
    store_id: string;
    fixed_amount?: boolean;
  }): Promise<{
    id: number;
    name: string;
    external_id: string;
    store_id: string;
    qr: {
      image: string;
      template_document: string;
      template_image: string;
    };
  }> {
    const accessToken = await this.getValidAccessToken(tenantId, 'QR');

    const response = await fetch(`${this.baseUrl}/pos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        external_id: data.external_id,
        store_id: data.store_id,
        fixed_amount: data.fixed_amount ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string; error?: string };
      console.error('Error creando POS MP:', error);
      throw new Error(error.message || error.error || 'Error al crear caja en Mercado Pago');
    }

    const pos = await response.json() as {
      id: number;
      name: string;
      external_id: string;
      store_id: string;
      qr: {
        image: string;
        template_document: string;
        template_image: string;
      };
    };

    // Guardar en DB local
    await this.saveLocalCashier(tenantId, {
      mpCashierId: pos.id,
      externalId: pos.external_id,
      name: pos.name,
      mpStoreId: pos.store_id,
      qrImage: pos.qr?.image,
      qrTemplate: pos.qr?.template_document,
    });

    return pos;
  }

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
  async listQRCashiers(tenantId: string, storeId?: string): Promise<Array<{
    id: number;
    name: string;
    external_id: string;
    store_id: string;
    qr?: {
      image: string;
      template_document: string;
      template_image: string;
    };
  }>> {
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

    interface MPPosResult {
      id: number;
      name: string;
      external_id: string;
      store_id: string;
      qr?: {
        image: string;
        template_document: string;
        template_image: string;
      };
    }

    const data = await response.json() as { results?: MPPosResult[] };
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
  }): Promise<{ orderId: string; qrData: string; inStoreOrderId: string; externalReference: string }> {
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
    const qrUrl = `${this.baseUrl}/instore/qr/seller/collectors/${config.mpUserId}/pos/${params.externalPosId}/orders`;
    console.log('[MP QR] Creating order:', {
      url: qrUrl,
      externalPosId: params.externalPosId,
      amount: params.amount,
      externalReference: params.externalReference,
      itemsCount: items.length,
      orderData: JSON.stringify(orderData, null, 2)
    });

    // Primero eliminar cualquier orden existente en el QR
    try {
      const deleteResponse = await fetch(qrUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      console.log('[MP QR] Delete existing order response:', deleteResponse.status);
    } catch (deleteError) {
      console.log('[MP QR] No existing order to delete or error:', deleteError);
    }

    const response = await fetch(
      qrUrl,
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

    console.log('[MP QR] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      console.error('[MP QR] Error creando orden:', errorData);
      throw new Error(errorData.message || 'Error al crear orden QR');
    }

    // MP puede devolver 200/201 con body vacío o con datos
    const responseText = await response.text();
    console.log('[MP QR] Response body:', responseText);
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
      externalReference: params.externalReference,
    };
  }

  /**
   * Elimina/cancela una orden QR pendiente
   */
  async deleteQROrder(tenantId: string, externalPosId: string): Promise<void> {
    const accessToken = await this.getValidAccessToken(tenantId, 'QR');
    const config = await this.getConfig(tenantId, 'QR');

    if (!config?.mpUserId) {
      throw new Error('Configuración de MP QR no encontrada');
    }

    const qrUrl = `${this.baseUrl}/instore/qr/seller/collectors/${config.mpUserId}/pos/${externalPosId}/orders`;
    console.log('[MP QR] Deleting order:', { url: qrUrl, externalPosId });

    const response = await fetch(qrUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log('[MP QR] Delete response:', response.status);

    // 204 = success, 400 = no order to delete (also ok)
    if (!response.ok && response.status !== 400) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(errorData.message || 'Error al cancelar orden QR');
    }
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

  // ============================================
  // BRANCHES CON MP STORES
  // ============================================

  /**
   * Crea un Store en MP usando los datos de una Branch del sistema
   * Vincula automáticamente el Store creado con la Branch
   */
  // Mapeo de nombres de provincias a valores válidos de MP
  private normalizeStateName(state: string | null): string {
    if (!state) return 'Buenos Aires';

    const stateMap: Record<string, string> = {
      // Variaciones comunes
      'bsas': 'Buenos Aires',
      'bs as': 'Buenos Aires',
      'bs. as.': 'Buenos Aires',
      'buenos aires': 'Buenos Aires',
      'pcia buenos aires': 'Buenos Aires',
      'provincia de buenos aires': 'Buenos Aires',
      'caba': 'Capital Federal',
      'capital': 'Capital Federal',
      'capital federal': 'Capital Federal',
      'ciudad de buenos aires': 'Capital Federal',
      'ciudad autonoma de buenos aires': 'Capital Federal',
      'cordoba': 'Córdoba',
      'córdoba': 'Córdoba',
      'cba': 'Córdoba',
      'entre rios': 'Entre Ríos',
      'entreríos': 'Entre Ríos',
      'neuquen': 'Neuquén',
      'neuquén': 'Neuquén',
      'rio negro': 'Río Negro',
      'río negro': 'Río Negro',
      'tucuman': 'Tucumán',
      'tucumán': 'Tucumán',
      'catamarca': 'Catamarca',
      'chaco': 'Chaco',
      'chubut': 'Chubut',
      'corrientes': 'Corrientes',
      'formosa': 'Formosa',
      'jujuy': 'Jujuy',
      'la pampa': 'La Pampa',
      'la rioja': 'La Rioja',
      'mendoza': 'Mendoza',
      'misiones': 'Misiones',
      'salta': 'Salta',
      'san juan': 'San Juan',
      'san luis': 'San Luis',
      'santa cruz': 'Santa Cruz',
      'santa fe': 'Santa Fe',
      'santiago del estero': 'Santiago del Estero',
      'tierra del fuego': 'Tierra del Fuego',
    };

    const normalized = state.toLowerCase().trim();
    return stateMap[normalized] || state;
  }

  // Ciudad por defecto según la provincia (MP requiere ciudades específicas)
  private getDefaultCityForState(state: string): string {
    const cityByState: Record<string, string> = {
      'Buenos Aires': 'La Plata',
      'Capital Federal': 'Capital Federal',
      'Catamarca': 'Catamarca',
      'Chaco': 'Resistencia',
      'Chubut': 'Rawson',
      'Corrientes': 'Corrientes',
      'Córdoba': 'Córdoba',
      'Entre Ríos': 'Paraná',
      'Formosa': 'Formosa',
      'Jujuy': 'San Salvador de Jujuy',
      'La Pampa': 'Santa Rosa',
      'La Rioja': 'La Rioja',
      'Mendoza': 'Mendoza',
      'Misiones': 'Posadas',
      'Neuquén': 'Neuquén',
      'Río Negro': 'Viedma',
      'Salta': 'Salta',
      'San Juan': 'San Juan',
      'San Luis': 'San Luis',
      'Santa Cruz': 'Río Gallegos',
      'Santa Fe': 'Santa Fe',
      'Santiago del Estero': 'Santiago del Estero',
      'Tierra del Fuego': 'Ushuaia',
      'Tucumán': 'San Miguel de Tucumán',
    };
    return cityByState[state] || 'Capital Federal';
  }

  async createStoreFromBranch(tenantId: string, branchId: string): Promise<{
    branch: { id: string; name: string; code: string; mpStoreId: string | null; mpExternalId: string | null };
    store: { id: string; name: string; external_id: string };
  }> {
    // Obtener la Branch
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new Error('Sucursal no encontrada');
    }

    if (branch.mpStoreId) {
      throw new Error('Esta sucursal ya tiene un Local de MP vinculado');
    }

    // Generar external_id limpiando caracteres especiales del code
    const externalId = branch.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Normalizar provincia y obtener ciudad válida
    const stateName = this.normalizeStateName(branch.state);
    // MP tiene una lista limitada de ciudades por provincia, usamos la capital como fallback seguro
    const cityName = this.getDefaultCityForState(stateName);

    // Preparar datos para crear Store
    const storeData = {
      name: branch.name,
      external_id: externalId,
      location: {
        street_name: branch.address || 'Sin dirección',
        street_number: '0',
        city_name: cityName,
        state_name: stateName,
      },
    };

    // Crear Store en MP
    const store = await this.createQRStore(tenantId, storeData);

    // Actualizar Branch con los datos del Store
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        mpStoreId: store.id,
        mpExternalId: store.external_id,
      },
      select: {
        id: true,
        name: true,
        code: true,
        mpStoreId: true,
        mpExternalId: true,
      },
    });

    return {
      branch: updatedBranch,
      store,
    };
  }

  /**
   * Sincroniza Stores existentes en MP con las Branches del sistema
   * Busca coincidencias por external_id similar al code de Branch
   */
  async syncExistingStores(tenantId: string): Promise<{
    synced: number;
    notMatched: Array<{ id: string; name: string; external_id: string }>;
  }> {
    // Listar Stores en MP
    const stores = await this.listQRStores(tenantId);

    // Obtener Branches sin Store vinculado
    const branches = await prisma.branch.findMany({
      where: {
        tenantId,
        mpStoreId: null,
      },
    });

    let synced = 0;
    const notMatched: Array<{ id: string; name: string; external_id: string }> = [];

    for (const store of stores) {
      // Buscar Branch que coincida por external_id
      // Comparamos limpiando caracteres especiales
      const storeExternalIdClean = store.external_id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

      const matchingBranch = branches.find(branch => {
        const branchCodeClean = branch.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return branchCodeClean === storeExternalIdClean;
      });

      if (matchingBranch) {
        // Vincular Store con Branch
        await prisma.branch.update({
          where: { id: matchingBranch.id },
          data: {
            mpStoreId: store.id,
            mpExternalId: store.external_id,
          },
        });
        synced++;
        // Remover de la lista de branches para no volver a matchear
        const idx = branches.findIndex(b => b.id === matchingBranch.id);
        if (idx !== -1) branches.splice(idx, 1);
      } else {
        // Verificar si ya está vinculado a otra Branch
        const existingLink = await prisma.branch.findFirst({
          where: { tenantId, mpStoreId: store.id },
        });

        if (!existingLink) {
          notMatched.push(store);
        }
      }
    }

    return { synced, notMatched };
  }

  /**
   * Lista las Branches del tenant con su estado de MP
   */
  async getBranchesWithMPStatus(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    state: string | null;
    hasStore: boolean;
    mpStoreId: string | null;
    mpExternalId: string | null;
  }>> {
    const branches = await prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        city: true,
        state: true,
        mpStoreId: true,
        mpExternalId: true,
      },
      orderBy: { name: 'asc' },
    });

    return branches.map(branch => ({
      ...branch,
      hasStore: !!branch.mpStoreId,
    }));
  }

  /**
   * Vincula manualmente un Store existente de MP a una Branch del sistema
   */
  async linkStoreToBranch(tenantId: string, branchId: string, storeId: string, externalId: string): Promise<{
    id: string;
    name: string;
    code: string;
    mpStoreId: string | null;
    mpExternalId: string | null;
  }> {
    // Verificar que la Branch existe y pertenece al tenant
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new Error('Sucursal no encontrada');
    }

    // Verificar que el Store no está vinculado a otra Branch
    const existingLink = await prisma.branch.findFirst({
      where: { tenantId, mpStoreId: storeId, id: { not: branchId } },
    });

    if (existingLink) {
      throw new Error(`Este local ya está vinculado a la sucursal "${existingLink.name}"`);
    }

    // Vincular Store a Branch
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        mpStoreId: storeId,
        mpExternalId: externalId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        mpStoreId: true,
        mpExternalId: true,
      },
    });

    return updatedBranch;
  }

  /**
   * Desvincula un Store de MP de una Branch
   */
  async unlinkStoreFromBranch(tenantId: string, branchId: string): Promise<{
    id: string;
    name: string;
    code: string;
    mpStoreId: string | null;
    mpExternalId: string | null;
  }> {
    // Verificar que la Branch existe y pertenece al tenant
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new Error('Sucursal no encontrada');
    }

    // Desvincular
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        mpStoreId: null,
        mpExternalId: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        mpStoreId: true,
        mpExternalId: true,
      },
    });

    return updatedBranch;
  }

  /**
   * Lista Stores de MP que no están vinculados a ninguna Branch
   */
  async getUnlinkedStores(tenantId: string): Promise<Array<{ id: string; name: string; external_id: string }>> {
    // Obtener stores de la DB local
    const allStores = await this.getLocalStores(tenantId);

    // Obtener IDs de stores ya vinculados a branches
    const linkedBranches = await prisma.branch.findMany({
      where: { tenantId, mpStoreId: { not: null } },
      select: { mpStoreId: true },
    });

    const linkedStoreIds = new Set(linkedBranches.map(b => b.mpStoreId));

    // Filtrar stores no vinculados
    return allStores
      .filter(store => !linkedStoreIds.has(store.mpStoreId))
      .map(store => ({
        id: store.mpStoreId,
        name: store.name,
        external_id: store.externalId,
      }));
  }

  // ============================================
  // CACHE LOCAL DE STORES Y CASHIERS
  // ============================================

  /**
   * Obtiene stores de la DB local
   */
  async getLocalStores(tenantId: string): Promise<Array<{
    id: string;
    mpStoreId: string;
    name: string;
    externalId: string;
    streetName: string | null;
    streetNumber: string | null;
    cityName: string | null;
    stateName: string | null;
    cashierCount: number;
  }>> {
    const stores = await prisma.mercadoPagoStore.findMany({
      where: { tenantId },
      include: {
        _count: { select: { cashiers: true } },
      },
      orderBy: { name: 'asc' },
    });

    return stores.map(store => ({
      id: store.id,
      mpStoreId: store.mpStoreId,
      name: store.name,
      externalId: store.externalId,
      streetName: store.streetName,
      streetNumber: store.streetNumber,
      cityName: store.cityName,
      stateName: store.stateName,
      cashierCount: store._count.cashiers,
    }));
  }

  /**
   * Obtiene cashiers de la DB local
   */
  async getLocalCashiers(tenantId: string, mpStoreId?: string): Promise<Array<{
    id: string;
    mpCashierId: number;
    name: string;
    externalId: string;
    mpStoreId: string;
    qrImage: string | null;
    qrTemplate: string | null;
  }>> {
    const where: { tenantId: string; store?: { mpStoreId: string } } = { tenantId };
    if (mpStoreId) {
      where.store = { mpStoreId };
    }

    const cashiers = await prisma.mercadoPagoCashier.findMany({
      where,
      include: { store: { select: { mpStoreId: true } } },
      orderBy: { name: 'asc' },
    });

    return cashiers.map(cashier => ({
      id: cashier.id,
      mpCashierId: cashier.mpCashierId,
      name: cashier.name,
      externalId: cashier.externalId,
      mpStoreId: cashier.store.mpStoreId,
      qrImage: cashier.qrImage,
      qrTemplate: cashier.qrTemplate,
    }));
  }

  /**
   * Guarda un store en la DB local (upsert)
   */
  async saveLocalStore(tenantId: string, storeData: {
    mpStoreId: string;
    externalId?: string;
    name: string;
    streetName?: string;
    streetNumber?: string;
    cityName?: string;
    stateName?: string;
  }): Promise<{ id: string; mpStoreId: string }> {
    // Usar mpStoreId como fallback si externalId no está definido
    const externalId = storeData.externalId || `STORE${storeData.mpStoreId}`;

    const store = await prisma.mercadoPagoStore.upsert({
      where: {
        tenantId_mpStoreId: { tenantId, mpStoreId: storeData.mpStoreId },
      },
      update: {
        name: storeData.name,
        externalId,
        streetName: storeData.streetName,
        streetNumber: storeData.streetNumber,
        cityName: storeData.cityName,
        stateName: storeData.stateName,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        mpStoreId: storeData.mpStoreId,
        externalId,
        name: storeData.name,
        streetName: storeData.streetName,
        streetNumber: storeData.streetNumber,
        cityName: storeData.cityName,
        stateName: storeData.stateName,
      },
    });

    return { id: store.id, mpStoreId: store.mpStoreId };
  }

  /**
   * Guarda un cashier en la DB local (upsert)
   */
  async saveLocalCashier(tenantId: string, cashierData: {
    mpCashierId: number;
    externalId?: string;
    name: string;
    mpStoreId: string;
    qrImage?: string;
    qrTemplate?: string;
  }): Promise<{ id: string; mpCashierId: number }> {
    // Buscar el store local por mpStoreId
    const store = await prisma.mercadoPagoStore.findFirst({
      where: { tenantId, mpStoreId: cashierData.mpStoreId },
    });

    if (!store) {
      throw new Error(`Store con mpStoreId ${cashierData.mpStoreId} no encontrado en DB local`);
    }

    // Usar mpCashierId como fallback si externalId no está definido
    const externalId = cashierData.externalId || `CAJA${cashierData.mpCashierId}`;

    const cashier = await prisma.mercadoPagoCashier.upsert({
      where: {
        tenantId_mpCashierId: { tenantId, mpCashierId: cashierData.mpCashierId },
      },
      update: {
        name: cashierData.name,
        externalId,
        qrImage: cashierData.qrImage,
        qrTemplate: cashierData.qrTemplate,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        storeId: store.id,
        mpCashierId: cashierData.mpCashierId,
        externalId,
        name: cashierData.name,
        qrImage: cashierData.qrImage,
        qrTemplate: cashierData.qrTemplate,
      },
    });

    return { id: cashier.id, mpCashierId: cashier.mpCashierId };
  }

  /**
   * Sincroniza stores y cashiers desde MP a la DB local
   */
  async syncQRDataFromMP(tenantId: string): Promise<{
    storesAdded: number;
    storesUpdated: number;
    cashiersAdded: number;
    cashiersUpdated: number;
  }> {
    let storesAdded = 0;
    let storesUpdated = 0;
    let cashiersAdded = 0;
    let cashiersUpdated = 0;

    try {
      // 1. Sincronizar stores
      const mpStores = await this.listQRStores(tenantId);

      for (const mpStore of mpStores) {
        const existing = await prisma.mercadoPagoStore.findFirst({
          where: { tenantId, mpStoreId: mpStore.id },
        });

        await this.saveLocalStore(tenantId, {
          mpStoreId: mpStore.id,
          externalId: mpStore.external_id,
          name: mpStore.name,
        });

        if (existing) {
          storesUpdated++;
        } else {
          storesAdded++;
        }
      }

      // 2. Sincronizar cashiers
      const mpCashiers = await this.listQRCashiers(tenantId);

      for (const mpCashier of mpCashiers) {
        const existing = await prisma.mercadoPagoCashier.findFirst({
          where: { tenantId, mpCashierId: mpCashier.id },
        });

        try {
          await this.saveLocalCashier(tenantId, {
            mpCashierId: mpCashier.id,
            externalId: mpCashier.external_id,
            name: mpCashier.name,
            mpStoreId: mpCashier.store_id,
            qrImage: mpCashier.qr?.image,
            qrTemplate: mpCashier.qr?.template_document,
          });

          if (existing) {
            cashiersUpdated++;
          } else {
            cashiersAdded++;
          }
        } catch (err) {
          console.error(`Error guardando cashier ${mpCashier.id}:`, err);
        }
      }
    } catch (error) {
      console.error('Error sincronizando datos QR desde MP:', error);
      throw error;
    }

    return { storesAdded, storesUpdated, cashiersAdded, cashiersUpdated };
  }
}

export const mercadoPagoService = new MercadoPagoService();
export default mercadoPagoService;
