import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

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

// ============================================
// SERVICIO DE MERCADO PAGO POINT
// ============================================

class MercadoPagoService {
  private baseUrl = 'https://api.mercadopago.com';

  /**
   * Obtiene la configuración de MP para un tenant
   */
  async getConfig(tenantId: string) {
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) {
      throw new Error('Mercado Pago no está configurado para este tenant');
    }

    return config;
  }

  /**
   * Crea una orden de pago en un terminal Point
   */
  async createPointOrder(params: MPOrderRequest): Promise<{ orderId: string; status: string }> {
    const config = await this.getConfig(params.tenantId);

    const idempotencyKey = randomUUID();

    const orderBody = {
      type: 'point',
      external_reference: params.externalReference,
      description: params.description || 'Venta POS',
      transactions: {
        payments: [
          {
            amount: params.amount,
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
        Authorization: `Bearer ${config.accessToken}`,
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
   * Consulta el estado de una orden
   */
  async getOrderStatus(tenantId: string, orderId: string) {
    const config = await this.getConfig(tenantId);

    const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
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
      responseData: orderData as unknown as Record<string, unknown>,
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
   * Cancela una orden pendiente
   */
  async cancelOrder(tenantId: string, orderId: string): Promise<void> {
    const config = await this.getConfig(tenantId);

    const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Error al cancelar orden: ${response.status}`);
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

  /**
   * Lista los dispositivos Point del tenant
   */
  async listDevices(tenantId: string): Promise<MPDevice[]> {
    const config = await this.getConfig(tenantId);

    const response = await fetch(`${this.baseUrl}/point/integration-api/devices`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
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
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedHash = hmac.digest('hex');

    return calculatedHash === hash;
  }

  /**
   * Guarda o actualiza la configuración de MP para un tenant
   */
  async saveConfig(
    tenantId: string,
    data: {
      accessToken: string;
      publicKey?: string;
      userId?: string;
      webhookSecret?: string;
      environment?: string;
      isActive?: boolean;
    }
  ) {
    return prisma.mercadoPagoConfig.upsert({
      where: { tenantId },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        accessToken: data.accessToken,
        publicKey: data.publicKey,
        userId: data.userId,
        webhookSecret: data.webhookSecret,
        environment: data.environment || 'production',
        isActive: data.isActive ?? true,
      },
    });
  }

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
}

export const mercadoPagoService = new MercadoPagoService();
export default mercadoPagoService;
