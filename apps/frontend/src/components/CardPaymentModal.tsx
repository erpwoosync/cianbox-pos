/**
 * CardPaymentModal - Modal para datos de cupón de tarjeta
 * Se muestra cuando se paga con crédito o débito usando terminales no integrados
 * Incluye selección de banco y detección de promociones bancarias
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Building2,
  Gift,
  Percent,
} from 'lucide-react';
import api from '../services/api';

// Tipos
interface CardTerminal {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  requiresAuthCode: boolean;
  requiresVoucherNumber: boolean;
  requiresCardBrand: boolean;
  requiresLastFour: boolean;
  requiresInstallments: boolean;
  requiresBatchNumber: boolean;
}

interface InstallmentRate {
  installment: number;
  rate: number;
}

interface CardBrand {
  id: string;
  name: string;
  code: string;
  maxInstallments: number;
  installmentRates: InstallmentRate[];
}

interface Bank {
  id: string;
  name: string;
  code: string;
}

interface BankPromotion {
  id: string;
  name: string;
  description: string | null;
  bankId: string;
  cardBrandId: string;
  bank: Bank;
  cardBrand: CardBrand;
  interestFreeInstallments: number[];
  cashbackPercent: number | null;
  cashbackDescription: string | null;
  daysOfWeek: number[];
  isActive: boolean;
}

export interface CardPaymentData {
  cardTerminalId: string;
  authorizationCode?: string;
  voucherNumber?: string;
  batchNumber?: string;
  installments: number;
  cardBrand?: string;
  cardBrandId?: string;
  cardLastFour?: string;
  bankId?: string;
  bankPromotionId?: string;
  surchargeRate?: number;
  surchargeAmount?: number;
}

interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CardPaymentData) => void;
  amount: number;
  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD';
  initialData?: CardPaymentData | null;
}

export default function CardPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  paymentMethod,
  initialData,
}: CardPaymentModalProps) {
  // Estado de datos maestros
  const [terminals, setTerminals] = useState<CardTerminal[]>([]);
  const [cardBrands, setCardBrands] = useState<CardBrand[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [promotions, setPromotions] = useState<BankPromotion[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Estado del formulario
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [installments, setInstallments] = useState(1);
  const [cardBrandId, setCardBrandId] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');
  const [bankId, setBankId] = useState('');

  // Estado de validación
  const [validationError, setValidationError] = useState<string | null>(null);

  // Derivados
  const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);
  const selectedCardBrand = cardBrands.find((c) => c.id === cardBrandId);
  const isCredit = paymentMethod === 'CREDIT_CARD';

  // Promoción aplicable para la combinación banco+tarjeta
  const applicablePromotion = useMemo(() => {
    if (!isCredit || !cardBrandId || !bankId) return null;
    return promotions.find(
      (p) => p.cardBrandId === cardBrandId && p.bankId === bankId && p.isActive
    );
  }, [isCredit, cardBrandId, bankId, promotions]);

  // Verificar si las cuotas seleccionadas son sin interés
  const isInterestFree = useMemo(() => {
    if (!applicablePromotion) return false;
    return applicablePromotion.interestFreeInstallments.includes(installments);
  }, [applicablePromotion, installments]);

  // Calcular recargo
  const surchargeInfo = useMemo(() => {
    if (!isCredit || installments === 1) {
      return { rate: 0, amount: 0, total: amount };
    }

    // Si hay promoción y las cuotas están sin interés
    if (isInterestFree) {
      return { rate: 0, amount: 0, total: amount };
    }

    // Buscar recargo de la tarjeta
    if (selectedCardBrand?.installmentRates) {
      const rateConfig = selectedCardBrand.installmentRates.find(
        (r) => r.installment === installments
      );
      if (rateConfig && rateConfig.rate > 0) {
        const surchargeAmount = (amount * rateConfig.rate) / 100;
        return {
          rate: rateConfig.rate,
          amount: surchargeAmount,
          total: amount + surchargeAmount,
        };
      }
    }

    return { rate: 0, amount: 0, total: amount };
  }, [isCredit, installments, isInterestFree, selectedCardBrand, amount]);

  // Opciones de cuotas basadas en la tarjeta seleccionada
  const installmentOptions = useMemo(() => {
    const max = selectedCardBrand?.maxInstallments || 12;
    const options: number[] = [];
    for (let i = 1; i <= max; i++) {
      options.push(i);
    }
    return options;
  }, [selectedCardBrand]);

  // Cargar datos al abrir
  const loadData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);

    try {
      const [terminalsRes, brandsRes, banksRes, promosRes] = await Promise.all([
        api.get('/card-terminals?activeOnly=true'),
        api.get('/card-brands?activeOnly=true'),
        api.get('/banks?activeOnly=true'),
        api.get('/bank-promotions/active'),
      ]);

      // Terminales
      let terminalsData = terminalsRes.data;
      if (!Array.isArray(terminalsData) || terminalsData.length === 0) {
        // Intentar inicializar
        await api.post('/card-terminals/initialize');
        const reloadRes = await api.get('/card-terminals?activeOnly=true');
        terminalsData = reloadRes.data;
      }
      setTerminals(terminalsData);

      // Card brands
      let brandsData = brandsRes.data;
      if (!Array.isArray(brandsData) || brandsData.length === 0) {
        await api.post('/card-brands/initialize');
        const reloadRes = await api.get('/card-brands?activeOnly=true');
        brandsData = reloadRes.data;
      }
      setCardBrands(brandsData);

      // Banks
      let banksData = banksRes.data;
      if (!Array.isArray(banksData) || banksData.length === 0) {
        await api.post('/banks/initialize');
        const reloadRes = await api.get('/banks?activeOnly=true');
        banksData = reloadRes.data;
      }
      setBanks(banksData);

      // Promotions
      setPromotions(promosRes.data || []);

      // Seleccionar primeros valores por defecto
      if (terminalsData.length > 0) {
        setSelectedTerminalId(terminalsData[0].id);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setDataError(
        axiosError.response?.data?.error?.message || errorMessage || 'Error al cargar datos'
      );
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Cargar datos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Inicializar con datos existentes o resetear
  useEffect(() => {
    if (isOpen && initialData) {
      setSelectedTerminalId(initialData.cardTerminalId || '');
      setAuthorizationCode(initialData.authorizationCode || '');
      setVoucherNumber(initialData.voucherNumber || '');
      setBatchNumber(initialData.batchNumber || '');
      setInstallments(initialData.installments || 1);
      setCardBrandId(initialData.cardBrandId || '');
      setCardLastFour(initialData.cardLastFour || '');
      setBankId(initialData.bankId || '');
      setValidationError(null);
    } else if (!isOpen) {
      setSelectedTerminalId('');
      setAuthorizationCode('');
      setVoucherNumber('');
      setBatchNumber('');
      setInstallments(1);
      setCardBrandId('');
      setCardLastFour('');
      setBankId('');
      setValidationError(null);
    }
  }, [isOpen, initialData]);

  // Validar formulario
  const validateForm = (): boolean => {
    if (!selectedTerminal) {
      setValidationError('Seleccione un terminal');
      return false;
    }

    if (selectedTerminal.requiresAuthCode && !authorizationCode.trim()) {
      setValidationError('El código de autorización es requerido');
      return false;
    }

    if (selectedTerminal.requiresVoucherNumber && !voucherNumber.trim()) {
      setValidationError('El número de cupón es requerido');
      return false;
    }

    if (selectedTerminal.requiresBatchNumber && !batchNumber.trim()) {
      setValidationError('El número de lote es requerido');
      return false;
    }

    if (selectedTerminal.requiresInstallments && installments < 1) {
      setValidationError('Las cuotas son requeridas');
      return false;
    }

    if (selectedTerminal.requiresCardBrand && !cardBrandId) {
      setValidationError('La marca de tarjeta es requerida');
      return false;
    }

    if (selectedTerminal.requiresLastFour) {
      if (!cardLastFour.trim()) {
        setValidationError('Los últimos 4 dígitos son requeridos');
        return false;
      }
      if (!/^\d{4}$/.test(cardLastFour)) {
        setValidationError('Los últimos 4 dígitos deben ser numéricos');
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  // Manejar confirmación
  const handleConfirm = () => {
    if (!validateForm()) return;

    onConfirm({
      cardTerminalId: selectedTerminalId,
      authorizationCode: authorizationCode.trim() || undefined,
      voucherNumber: voucherNumber.trim() || undefined,
      batchNumber: batchNumber.trim() || undefined,
      installments,
      cardBrand: selectedCardBrand?.code || undefined,
      cardBrandId: cardBrandId || undefined,
      cardLastFour: cardLastFour.trim() || undefined,
      bankId: bankId || undefined,
      bankPromotionId: isInterestFree && applicablePromotion ? applicablePromotion.id : undefined,
      surchargeRate: surchargeInfo.rate > 0 ? surchargeInfo.rate : undefined,
      surchargeAmount: surchargeInfo.amount > 0 ? surchargeInfo.amount : undefined,
    });
  };

  if (!isOpen) return null;

  const title = isCredit ? 'Datos del Cupón - Crédito' : 'Datos del Cupón - Débito';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`p-4 border-b ${isCredit ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gradient-to-r from-blue-50 to-cyan-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCredit ? 'bg-purple-100' : 'bg-blue-100'}`}>
              <CreditCard className={`w-5 h-5 ${isCredit ? 'text-purple-600' : 'text-blue-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-gray-500">
                Complete los datos del comprobante
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : dataError ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{dataError}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selector de terminal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terminal
                </label>
                <div className="relative">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedTerminalId}
                    onChange={(e) => setSelectedTerminalId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {terminals.map((terminal) => (
                      <option key={terminal.id} value={terminal.id}>
                        {terminal.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTerminal && (
                <>
                  {/* Marca de tarjeta */}
                  {(selectedTerminal.requiresCardBrand || cardBrandId) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <CreditCard className="inline w-4 h-4 mr-1" />
                        Tarjeta
                        {selectedTerminal.requiresCardBrand && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select
                        value={cardBrandId}
                        onChange={(e) => {
                          setCardBrandId(e.target.value);
                          setInstallments(1); // Reset cuotas al cambiar tarjeta
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleccionar tarjeta...</option>
                        {cardBrands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Banco - solo para crédito */}
                  {isCredit && cardBrandId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Building2 className="inline w-4 h-4 mr-1" />
                        Banco Emisor
                      </label>
                      <select
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Sin promoción bancaria</option>
                        {banks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Promoción detectada */}
                  {applicablePromotion && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">
                            {applicablePromotion.name}
                          </p>
                          <p className="text-sm text-green-700">
                            Cuotas sin interés: {applicablePromotion.interestFreeInstallments.join(', ')}
                          </p>
                          {applicablePromotion.cashbackPercent && (
                            <p className="text-sm text-green-600 mt-1">
                              + {applicablePromotion.cashbackPercent}% reintegro
                              {applicablePromotion.cashbackDescription && ` - ${applicablePromotion.cashbackDescription}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cuotas - solo para crédito */}
                  {isCredit && (selectedTerminal.requiresInstallments || installments > 1) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cuotas
                        {selectedTerminal.requiresInstallments && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {installmentOptions.map((num) => {
                          const isPromoInstallment = applicablePromotion?.interestFreeInstallments.includes(num);
                          const rateConfig = selectedCardBrand?.installmentRates?.find(
                            (r) => r.installment === num
                          );
                          const rate = isPromoInstallment ? 0 : (rateConfig?.rate || 0);
                          const total = amount + (amount * rate / 100);
                          const perInstallment = total / num;

                          let label = num === 1 ? '1 pago' : `${num} cuotas`;
                          if (num > 1) {
                            label += ` de $${perInstallment.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                            if (isPromoInstallment) {
                              label += ' (Sin Interés)';
                            } else if (rate > 0) {
                              label += ` (+${rate}%)`;
                            }
                          }

                          return (
                            <option key={num} value={num}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Código de autorización */}
                  {(selectedTerminal.requiresAuthCode || authorizationCode) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código de Autorización
                        {selectedTerminal.requiresAuthCode && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={authorizationCode}
                        onChange={(e) => setAuthorizationCode(e.target.value)}
                        placeholder="Ej: 123456"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Número de cupón */}
                  {(selectedTerminal.requiresVoucherNumber || voucherNumber) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nro de Cupón
                        {selectedTerminal.requiresVoucherNumber && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                        placeholder="Ej: 0001234"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Número de lote */}
                  {(selectedTerminal.requiresBatchNumber || batchNumber) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nro de Lote
                        {selectedTerminal.requiresBatchNumber && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={batchNumber}
                        onChange={(e) => setBatchNumber(e.target.value)}
                        placeholder="Ej: 001"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Últimos 4 dígitos */}
                  {(selectedTerminal.requiresLastFour || cardLastFour) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Últimos 4 dígitos
                        {selectedTerminal.requiresLastFour && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={cardLastFour}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setCardLastFour(val);
                        }}
                        placeholder="XXXX"
                        maxLength={4}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Resumen del monto */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Monto de productos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {surchargeInfo.amount > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600 flex items-center gap-1">
                        <Percent className="w-4 h-4" />
                        Recargo {surchargeInfo.rate}%
                      </span>
                      <span className="text-orange-600 font-medium">
                        +${surchargeInfo.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2 font-bold text-lg">
                      <span>Total a pagar</span>
                      <span className="text-purple-700">
                        ${surchargeInfo.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                {isCredit && installments > 1 && (
                  <p className={`text-sm mt-2 text-center font-medium ${isInterestFree ? 'text-green-600' : 'text-purple-600'}`}>
                    {installments} cuotas de ${(surchargeInfo.total / installments).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {isInterestFree && ' (Sin Interés)'}
                  </p>
                )}
              </div>

              {/* Error de validación */}
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{validationError}</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedTerminalId}
                  className={`flex-1 py-3 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                    isCredit
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Pago
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
