/**
 * Servicio de Facturación Electrónica AFIP
 *
 * Integración con AfipSDK para emitir comprobantes electrónicos:
 * - Facturas A, B, C
 * - Notas de Crédito A, B, C
 * - Notas de Débito A, B, C
 */

import Afip from '@afipsdk/afip.js';
import { PrismaClient, AfipVoucherType, AfipInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Mapeo de tipos de comprobante a códigos AFIP
const VOUCHER_TYPE_CODES: Record<AfipVoucherType, number> = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13,
};

// Mapeo inverso: código AFIP a tipo
const CODE_TO_VOUCHER_TYPE: Record<number, AfipVoucherType> = Object.entries(VOUCHER_TYPE_CODES)
  .reduce((acc, [type, code]) => ({ ...acc, [code]: type as AfipVoucherType }), {});

// Tipos de documento receptor
export const DOC_TYPES = {
  CUIT: 80,
  CUIL: 86,
  CDI: 87,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

// Condiciones IVA receptor
export const IVA_CONDITIONS = {
  IVA_RESPONSABLE_INSCRIPTO: 1,
  IVA_RESPONSABLE_NO_INSCRIPTO: 2,
  IVA_NO_RESPONSABLE: 3,
  IVA_SUJETO_EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  RESPONSABLE_MONOTRIBUTO: 6,
  SUJETO_NO_CATEGORIZADO: 7,
  PROVEEDOR_DEL_EXTERIOR: 8,
  CLIENTE_DEL_EXTERIOR: 9,
  IVA_LIBERADO: 10,
  IVA_RESPONSABLE_INSCRIPTO_AGENTE_PERCEPCION: 11,
  PEQUENO_CONTRIBUYENTE_EVENTUAL: 12,
  MONOTRIBUTISTA_SOCIAL: 13,
  PEQUENO_CONTRIBUYENTE_EVENTUAL_SOCIAL: 14,
} as const;

// Alícuotas IVA
export const IVA_RATES = {
  NO_GRAVADO: { id: 1, rate: 0 },
  EXENTO: { id: 2, rate: 0 },
  IVA_0: { id: 3, rate: 0 },
  IVA_10_5: { id: 4, rate: 10.5 },
  IVA_21: { id: 5, rate: 21 },
  IVA_27: { id: 6, rate: 27 },
  IVA_5: { id: 8, rate: 5 },
  IVA_2_5: { id: 9, rate: 2.5 },
} as const;

// Conceptos
export const CONCEPTS = {
  PRODUCTOS: 1,
  SERVICIOS: 2,
  PRODUCTOS_Y_SERVICIOS: 3,
} as const;

interface AfipInstance {
  instance: typeof Afip.prototype;
  cuit: string;
}

interface CreateVoucherData {
  salesPointId: string;
  voucherType: AfipVoucherType;
  concept: number;
  receiverDocType: number;
  receiverDocNum: string;
  receiverName?: string;
  receiverTaxCategory?: number;
  netAmount: number;       // Neto gravado
  exemptAmount?: number;   // Exento
  taxAmount: number;       // IVA
  otherTaxes?: number;     // Otros tributos
  totalAmount: number;     // Total
  ivaDetails?: Array<{
    id: number;           // ID alícuota (5 = 21%)
    baseImp: number;      // Base imponible
    importe: number;      // Importe IVA
  }>;
  // Para NC/ND
  relatedVoucher?: {
    type: AfipVoucherType;
    ptoVta: number;
    number: number;
    cuit?: string;
  };
  // Vínculo con venta
  saleId?: string;
}

interface VoucherResult {
  success: boolean;
  invoiceId?: string;
  cae?: string;
  caeExpiration?: Date;
  voucherNumber?: number;
  error?: string;
}

class AfipService {
  private instances: Map<string, AfipInstance> = new Map();

  /**
   * Obtiene o crea una instancia de Afip para un tenant
   */
  async getAfipInstance(tenantId: string): Promise<AfipInstance | null> {
    // Verificar cache
    if (this.instances.has(tenantId)) {
      return this.instances.get(tenantId)!;
    }

    // Obtener configuración del tenant
    const config = await prisma.afipConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) {
      return null;
    }

    if (!config.afipAccessToken) {
      throw new Error('Token de acceso AfipSDK no configurado');
    }

    // Crear instancia
    const afipOptions: any = {
      CUIT: config.cuit.replace(/\D/g, ''), // Remover guiones
      access_token: config.afipAccessToken,
      production: config.isProduction,
    };

    // Si tiene certificado propio
    if (config.afipCert && config.afipKey) {
      afipOptions.cert = config.afipCert;
      afipOptions.key = config.afipKey;
    }

    const afip = new Afip(afipOptions);

    const instance: AfipInstance = {
      instance: afip,
      cuit: config.cuit.replace(/\D/g, ''),
    };

    this.instances.set(tenantId, instance);
    return instance;
  }

  /**
   * Invalida la instancia cacheada de un tenant
   */
  invalidateInstance(tenantId: string): void {
    this.instances.delete(tenantId);
  }

  /**
   * Obtiene el último número de comprobante
   */
  async getLastVoucherNumber(
    tenantId: string,
    salesPointNumber: number,
    voucherType: AfipVoucherType
  ): Promise<number> {
    const afipInstance = await this.getAfipInstance(tenantId);
    if (!afipInstance) {
      throw new Error('Configuración AFIP no encontrada');
    }

    const cbteTipo = VOUCHER_TYPE_CODES[voucherType];
    const lastVoucher = await afipInstance.instance.ElectronicBilling.getLastVoucher(
      salesPointNumber,
      cbteTipo
    );

    return lastVoucher || 0;
  }

  /**
   * Crea un comprobante electrónico (factura, NC, ND)
   */
  async createVoucher(tenantId: string, data: CreateVoucherData): Promise<VoucherResult> {
    const afipInstance = await this.getAfipInstance(tenantId);
    if (!afipInstance) {
      return { success: false, error: 'Configuración AFIP no encontrada' };
    }

    // Obtener punto de venta
    const salesPoint = await prisma.afipSalesPoint.findUnique({
      where: { id: data.salesPointId },
      include: { afipConfig: true },
    });

    if (!salesPoint || salesPoint.afipConfig.tenantId !== tenantId) {
      return { success: false, error: 'Punto de venta no encontrado' };
    }

    const cbteTipo = VOUCHER_TYPE_CODES[data.voucherType];

    // Obtener último número de AFIP
    const lastNumber = await this.getLastVoucherNumber(
      tenantId,
      salesPoint.number,
      data.voucherType
    );
    const nextNumber = lastNumber + 1;

    // Fecha en formato YYYYMMDD
    const now = new Date();
    const fecha = parseInt(
      now.toISOString().split('T')[0].replace(/-/g, '')
    );

    // Construir datos del comprobante
    const voucherData: any = {
      CantReg: 1,
      PtoVta: salesPoint.number,
      CbteTipo: cbteTipo,
      Concepto: data.concept,
      DocTipo: data.receiverDocType,
      DocNro: data.receiverDocType === DOC_TYPES.CONSUMIDOR_FINAL ? 0 : parseInt(data.receiverDocNum.replace(/\D/g, '')),
      CbteDesde: nextNumber,
      CbteHasta: nextNumber,
      CbteFch: fecha,
      ImpTotal: data.totalAmount,
      ImpTotConc: 0, // No gravado
      ImpNeto: data.netAmount,
      ImpOpEx: data.exemptAmount || 0,
      ImpIVA: data.taxAmount,
      ImpTrib: data.otherTaxes || 0,
      MonId: 'PES',
      MonCotiz: 1,
    };

    // Condición IVA del receptor (para facturas A)
    if (data.receiverTaxCategory) {
      voucherData.CondicionIVAReceptorId = data.receiverTaxCategory;
    } else {
      // Default: Consumidor Final para B/C
      voucherData.CondicionIVAReceptorId = IVA_CONDITIONS.CONSUMIDOR_FINAL;
    }

    // Detalle de IVA
    if (data.ivaDetails && data.ivaDetails.length > 0) {
      voucherData.Iva = data.ivaDetails.map(iva => ({
        Id: iva.id,
        BaseImp: iva.baseImp,
        Importe: iva.importe,
      }));
    } else if (data.taxAmount > 0) {
      // Default: IVA 21%
      voucherData.Iva = [{
        Id: IVA_RATES.IVA_21.id,
        BaseImp: data.netAmount,
        Importe: data.taxAmount,
      }];
    }

    // Para NC/ND: referencia al comprobante original
    if (data.relatedVoucher) {
      voucherData.CbtesAsoc = [{
        Tipo: VOUCHER_TYPE_CODES[data.relatedVoucher.type],
        PtoVta: data.relatedVoucher.ptoVta,
        Nro: data.relatedVoucher.number,
        Cuit: data.relatedVoucher.cuit || afipInstance.cuit,
      }];
    }

    try {
      // Llamar a AFIP
      const response = await afipInstance.instance.ElectronicBilling.createVoucher(voucherData);

      if (!response || !response.CAE) {
        return {
          success: false,
          error: 'AFIP no retornó CAE',
        };
      }

      // Guardar en base de datos
      const invoice = await prisma.afipInvoice.create({
        data: {
          tenantId: tenantId,
          afipConfigId: salesPoint.afipConfigId,
          salesPointId: salesPoint.id,
          voucherType: data.voucherType,
          number: nextNumber,
          cae: response.CAE,
          caeExpiration: this.parseCaeDate(response.CAEFchVto),
          issueDate: now,
          receiverDocType: String(data.receiverDocType),
          receiverDocNum: data.receiverDocNum,
          receiverName: data.receiverName,
          receiverTaxCategory: data.receiverTaxCategory ? String(data.receiverTaxCategory) : null,
          netAmount: new Decimal(data.netAmount),
          exemptAmount: new Decimal(data.exemptAmount || 0),
          taxAmount: new Decimal(data.taxAmount),
          otherTaxes: new Decimal(data.otherTaxes || 0),
          totalAmount: new Decimal(data.totalAmount),
          concept: data.concept,
          relatedVoucherType: data.relatedVoucher?.type,
          relatedVoucherPtoVta: data.relatedVoucher?.ptoVta,
          relatedVoucherNumber: data.relatedVoucher?.number,
          saleId: data.saleId,
          afipResponse: response,
          status: AfipInvoiceStatus.ISSUED,
        },
      });

      // Actualizar secuencia local
      await this.updateLocalSequence(salesPoint.id, data.voucherType, nextNumber);

      return {
        success: true,
        invoiceId: invoice.id,
        cae: response.CAE,
        caeExpiration: this.parseCaeDate(response.CAEFchVto),
        voucherNumber: nextNumber,
      };
    } catch (error: any) {
      console.error('Error al crear comprobante AFIP:', error);

      // Guardar registro de error
      await prisma.afipInvoice.create({
        data: {
          tenantId: tenantId,
          afipConfigId: salesPoint.afipConfigId,
          salesPointId: salesPoint.id,
          voucherType: data.voucherType,
          number: nextNumber,
          cae: 'ERROR',
          caeExpiration: now,
          issueDate: now,
          receiverDocType: String(data.receiverDocType),
          receiverDocNum: data.receiverDocNum,
          receiverName: data.receiverName,
          netAmount: new Decimal(data.netAmount),
          taxAmount: new Decimal(data.taxAmount),
          totalAmount: new Decimal(data.totalAmount),
          concept: data.concept,
          saleId: data.saleId,
          afipResponse: { error: error.message },
          status: AfipInvoiceStatus.ERROR,
        },
      });

      return {
        success: false,
        error: error.message || 'Error al comunicarse con AFIP',
      };
    }
  }

  /**
   * Crea una Factura B (consumidor final)
   */
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
  ): Promise<VoucherResult> {
    const taxRate = options?.taxRate || 21;
    const netAmount = totalAmount / (1 + taxRate / 100);
    const taxAmount = totalAmount - netAmount;

    return this.createVoucher(tenantId, {
      salesPointId,
      voucherType: AfipVoucherType.FACTURA_B,
      concept: CONCEPTS.PRODUCTOS,
      receiverDocType: options?.receiverDocType || DOC_TYPES.CONSUMIDOR_FINAL,
      receiverDocNum: options?.receiverDocNum || '0',
      receiverName: options?.receiverName,
      receiverTaxCategory: IVA_CONDITIONS.CONSUMIDOR_FINAL,
      netAmount: Math.round(netAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount,
      saleId: options?.saleId,
    });
  }

  /**
   * Crea una Nota de Crédito B
   */
  async createCreditNoteB(
    tenantId: string,
    salesPointId: string,
    originalInvoiceId: string,
    amount?: number
  ): Promise<VoucherResult> {
    // Obtener factura original
    const originalInvoice = await prisma.afipInvoice.findUnique({
      where: { id: originalInvoiceId },
      include: { salesPoint: true, afipConfig: true },
    });

    if (!originalInvoice || originalInvoice.afipConfig.tenantId !== tenantId) {
      return { success: false, error: 'Factura original no encontrada' };
    }

    const totalAmount = amount || Number(originalInvoice.totalAmount);
    const netAmount = Number(originalInvoice.netAmount) * (amount ? amount / Number(originalInvoice.totalAmount) : 1);
    const taxAmount = Number(originalInvoice.taxAmount) * (amount ? amount / Number(originalInvoice.totalAmount) : 1);

    return this.createVoucher(tenantId, {
      salesPointId,
      voucherType: AfipVoucherType.NOTA_CREDITO_B,
      concept: originalInvoice.concept,
      receiverDocType: parseInt(originalInvoice.receiverDocType),
      receiverDocNum: originalInvoice.receiverDocNum,
      receiverName: originalInvoice.receiverName || undefined,
      receiverTaxCategory: originalInvoice.receiverTaxCategory
        ? parseInt(originalInvoice.receiverTaxCategory)
        : IVA_CONDITIONS.CONSUMIDOR_FINAL,
      netAmount: Math.round(netAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      relatedVoucher: {
        type: originalInvoice.voucherType,
        ptoVta: originalInvoice.salesPoint.number,
        number: originalInvoice.number,
      },
    });
  }

  /**
   * Genera la URL del QR de AFIP para un comprobante
   */
  generateQrUrl(invoice: {
    cuit: string;
    ptoVta: number;
    cbteTipo: number;
    nro: number;
    importe: number;
    moneda: string;
    ctz: number;
    tipoDocRec: number;
    nroDocRec: string;
    tipoCodAut: string;
    codAut: string;
  }): string {
    const data = {
      ver: 1,
      fecha: new Date().toISOString().split('T')[0],
      cuit: invoice.cuit,
      ptoVta: invoice.ptoVta,
      tipoCmp: invoice.cbteTipo,
      nroCmp: invoice.nro,
      importe: invoice.importe,
      moneda: invoice.moneda,
      ctz: invoice.ctz,
      tipoDocRec: invoice.tipoDocRec,
      nroDocRec: parseInt(invoice.nroDocRec) || 0,
      tipoCodAut: invoice.tipoCodAut,
      codAut: parseInt(invoice.codAut),
    };

    const base64Data = Buffer.from(JSON.stringify(data)).toString('base64');
    return `https://www.afip.gob.ar/fe/qr/?p=${base64Data}`;
  }

  /**
   * Genera la URL del QR para una factura guardada
   */
  async getInvoiceQrUrl(tenantId: string, invoiceId: string): Promise<string | null> {
    const invoice = await prisma.afipInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        salesPoint: true,
        afipConfig: true,
      },
    });

    if (!invoice || invoice.afipConfig.tenantId !== tenantId) {
      return null;
    }

    return this.generateQrUrl({
      cuit: invoice.afipConfig.cuit.replace(/\D/g, ''),
      ptoVta: invoice.salesPoint.number,
      cbteTipo: VOUCHER_TYPE_CODES[invoice.voucherType],
      nro: invoice.number,
      importe: Number(invoice.totalAmount),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: parseInt(invoice.receiverDocType),
      nroDocRec: invoice.receiverDocNum,
      tipoCodAut: 'E', // CAE
      codAut: invoice.cae,
    });
  }

  /**
   * Obtiene información de un comprobante desde AFIP
   */
  async getVoucherInfo(
    tenantId: string,
    salesPointNumber: number,
    voucherType: AfipVoucherType,
    voucherNumber: number
  ): Promise<any> {
    const afipInstance = await this.getAfipInstance(tenantId);
    if (!afipInstance) {
      throw new Error('Configuración AFIP no encontrada');
    }

    const cbteTipo = VOUCHER_TYPE_CODES[voucherType];
    return afipInstance.instance.ElectronicBilling.getVoucherInfo(
      voucherNumber,
      salesPointNumber,
      cbteTipo
    );
  }

  /**
   * Obtiene los puntos de venta habilitados en AFIP
   * NOTA: En modo testing, AFIP no devuelve puntos de venta (solo existe el 1)
   */
  async getSalesPointsFromAfip(tenantId: string): Promise<{
    salesPoints: Array<{ number: number; type: string; blocked: string; dropDate: string | null }>;
    isProduction: boolean;
  }> {
    // Obtener configuración para saber si es producción
    const config = await prisma.afipConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) {
      throw new Error('Configuración AFIP no encontrada');
    }

    const afipInstance = await this.getAfipInstance(tenantId);
    if (!afipInstance) {
      throw new Error('No se pudo crear instancia AFIP');
    }

    // En modo testing, AFIP no retorna puntos de venta reales
    if (!config.isProduction) {
      console.log('AFIP en modo testing - no hay puntos de venta reales disponibles');
      return {
        salesPoints: [],
        isProduction: false,
      };
    }

    try {
      console.log('Consultando puntos de venta en AFIP (producción)...');
      const result = await afipInstance.instance.ElectronicBilling.getSalesPoints();

      console.log('AFIP getSalesPoints raw result:', JSON.stringify(result, null, 2));

      // Normalizar respuesta
      let salesPoints: Array<{ number: number; type: string; blocked: string; dropDate: string | null }> = [];

      if (!result) {
        return { salesPoints: [], isProduction: true };
      }

      // Si es un array, mapearlo
      if (Array.isArray(result)) {
        salesPoints = result.map((sp: any) => ({
          number: sp.Nro || sp.nro || sp.PtoVta || sp.ptoVta,
          type: sp.EmisionTipo || sp.emisionTipo || sp.Tipo || sp.tipo || 'N/A',
          blocked: sp.Bloqueado || sp.bloqueado || 'N',
          dropDate: sp.FchBaja || sp.fchBaja || null,
        }));
      }
      // Si es un objeto con ResultGet, extraer de ahí
      else if (result.ResultGet && Array.isArray(result.ResultGet)) {
        salesPoints = result.ResultGet.map((sp: any) => ({
          number: sp.Nro || sp.nro || sp.PtoVta || sp.ptoVta,
          type: sp.EmisionTipo || sp.emisionTipo || sp.Tipo || sp.tipo || 'N/A',
          blocked: sp.Bloqueado || sp.bloqueado || 'N',
          dropDate: sp.FchBaja || sp.fchBaja || null,
        }));
      }
      // Si es un objeto con PtoVta (un solo punto de venta)
      else if (result.PtoVta || result.Nro) {
        salesPoints = [{
          number: result.Nro || result.PtoVta,
          type: result.EmisionTipo || 'N/A',
          blocked: result.Bloqueado || 'N',
          dropDate: result.FchBaja || null,
        }];
      }

      return { salesPoints, isProduction: true };
    } catch (error: any) {
      console.error('Error en getSalesPointsFromAfip:', error.message);
      console.error('Error details:', JSON.stringify(error.response?.data || error, null, 2));

      // Si el error indica que no hay puntos de venta, devolver array vacío
      if (error.message?.includes('602') || // Error AFIP: no hay puntos de venta
          error.message?.includes('no posee') ||
          error.message?.includes('No sales points') ||
          error.message?.includes('400')) {
        return { salesPoints: [], isProduction: true };
      }

      throw error;
    }
  }

  /**
   * Consulta estado de los servidores de AFIP
   */
  async checkServerStatus(tenantId: string): Promise<{ appserver: string; dbserver: string; authserver: string }> {
    const afipInstance = await this.getAfipInstance(tenantId);
    if (!afipInstance) {
      throw new Error('Configuración AFIP no encontrada');
    }

    const status = await afipInstance.instance.ElectronicBilling.getServerStatus();

    // AfipSDK devuelve con mayúsculas, normalizamos
    return {
      appserver: status.AppServer || status.appserver || 'N/A',
      dbserver: status.DbServer || status.dbserver || 'N/A',
      authserver: status.AuthServer || status.authserver || 'N/A',
    };
  }

  // Métodos auxiliares privados

  private parseCaeDate(dateStr: string): Date {
    // Formato: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  private async updateLocalSequence(
    salesPointId: string,
    voucherType: AfipVoucherType,
    lastNumber: number
  ): Promise<void> {
    const fieldMap: Record<AfipVoucherType, string> = {
      FACTURA_A: 'lastInvoiceA',
      NOTA_DEBITO_A: 'lastDebitNoteA',
      NOTA_CREDITO_A: 'lastCreditNoteA',
      FACTURA_B: 'lastInvoiceB',
      NOTA_DEBITO_B: 'lastDebitNoteB',
      NOTA_CREDITO_B: 'lastCreditNoteB',
      FACTURA_C: 'lastInvoiceC',
      NOTA_DEBITO_C: 'lastDebitNoteC',
      NOTA_CREDITO_C: 'lastCreditNoteC',
    };

    const field = fieldMap[voucherType];
    await prisma.afipSalesPoint.update({
      where: { id: salesPointId },
      data: { [field]: lastNumber },
    });
  }
}

// Singleton
export const afipService = new AfipService();

// Exportar tipos y constantes
export {
  AfipService,
  CreateVoucherData,
  VoucherResult,
  VOUCHER_TYPE_CODES,
  CODE_TO_VOUCHER_TYPE,
};
