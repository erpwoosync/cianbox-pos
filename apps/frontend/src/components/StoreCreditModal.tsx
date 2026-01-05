/**
 * StoreCreditModal - Modal para generar vale de credito
 * Se muestra cuando el total del carrito es negativo (devolucion sin cambio)
 */

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  User,
  Printer,
  Copy,
  Check,
} from 'lucide-react';
import api from '../services/api';
import { Customer, CONSUMIDOR_FINAL } from '../services/customers';

interface StoreCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  amount: number; // Monto absoluto del vale (positivo)
  customer?: Customer | null;
  returnItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    originalSaleId?: string;
    originalSaleItemId?: string;
    returnReason?: string;
  }>;
  branchId?: string;
  pointOfSaleId?: string;
}

interface GeneratedCredit {
  id: string;
  code: string;
  barcode: string;
  amount: number;
  expiresAt?: string;
}

export default function StoreCreditModal({
  isOpen,
  onClose,
  onComplete,
  amount,
  customer,
  returnItems,
  branchId: _branchId,
  pointOfSaleId: _pointOfSaleId,
}: StoreCreditModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCredit, setGeneratedCredit] = useState<GeneratedCredit | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setGeneratedCredit(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleGenerateCredit = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Crear el vale de credito
      const response = await api.post('/store-credits', {
        amount,
        customerId: customer?.id !== CONSUMIDOR_FINAL.id ? customer?.id : undefined,
        notes: `Generado por devolucion - ${returnItems.map(i => `${i.productName} x${i.quantity}`).join(', ')}`,
      });

      if (response.data.success) {
        const credit = response.data.storeCredit;
        setGeneratedCredit({
          id: credit.id,
          code: credit.code,
          barcode: credit.barcode,
          amount: credit.originalAmount,
          expiresAt: credit.expiresAt,
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Error al generar vale';
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedCredit) {
      navigator.clipboard.writeText(generatedCredit.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (!generatedCredit) return;

    // Crear contenido para imprimir
    const printContent = `
      <html>
        <head>
          <title>Vale de Credito</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .code {
              font-size: 24px;
              font-weight: bold;
              text-align: center;
              padding: 15px;
              background: #f0f0f0;
              border: 2px solid #333;
              margin: 15px 0;
              letter-spacing: 2px;
            }
            .amount {
              font-size: 28px;
              font-weight: bold;
              text-align: center;
              color: #16a34a;
              margin: 10px 0;
            }
            .info {
              font-size: 12px;
              margin: 5px 0;
            }
            .footer {
              border-top: 2px dashed #000;
              padding-top: 10px;
              margin-top: 15px;
              text-align: center;
              font-size: 11px;
            }
            .barcode {
              text-align: center;
              font-size: 10px;
              letter-spacing: 3px;
              margin-top: 10px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">VALE DE CREDITO</div>
            <div>Cianbox POS</div>
          </div>

          <div class="code">${generatedCredit.code}</div>

          <div class="amount">$${generatedCredit.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>

          ${customer && customer.id !== CONSUMIDOR_FINAL.id ? `
            <div class="info"><strong>Cliente:</strong> ${customer.name}</div>
          ` : ''}

          <div class="info"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')}</div>

          ${generatedCredit.expiresAt ? `
            <div class="info"><strong>Vence:</strong> ${new Date(generatedCredit.expiresAt).toLocaleDateString('es-AR')}</div>
          ` : ''}

          <div class="barcode">*${generatedCredit.barcode}*</div>

          <div class="footer">
            <p>Presente este vale para canjearlo</p>
            <p>por productos de igual o mayor valor.</p>
            <p>No canjeable por dinero.</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handleClose = () => {
    if (generatedCredit) {
      onComplete();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Generar Vale de Credito</h3>
              <p className="text-sm text-gray-500">
                {generatedCredit ? 'Vale generado exitosamente' : 'Devolucion sin cambio por producto'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {generatedCredit ? (
            // Vale generado exitosamente
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <p className="text-gray-600 mb-2">Codigo del vale:</p>
                <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 flex items-center justify-center gap-2">
                  <span className="text-2xl font-mono font-bold tracking-wider">
                    {generatedCredit.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Copiar codigo"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-3xl font-bold text-green-600">
                ${generatedCredit.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>

              {customer && customer.id !== CONSUMIDOR_FINAL.id && (
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{customer.name}</span>
                </div>
              )}

              {generatedCredit.expiresAt && (
                <p className="text-sm text-gray-500">
                  Vence: {new Date(generatedCredit.expiresAt).toLocaleDateString('es-AR')}
                </p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Imprimir Vale
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            // Formulario de generacion
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-gray-600 mb-2">Monto del vale a generar:</p>
                <div className="text-4xl font-bold text-orange-600">
                  ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {customer && customer.id !== CONSUMIDOR_FINAL.id && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Cliente:</p>
                    <p className="font-medium">{customer.name}</p>
                  </div>
                </div>
              )}

              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-sm text-orange-800 font-medium mb-2">Productos a devolver:</p>
                <ul className="text-sm text-orange-700 space-y-1">
                  {returnItems.map((item, idx) => (
                    <li key={idx}>
                      {item.productName} x{item.quantity} - ${(item.unitPrice * item.quantity).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateCredit}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Generar Vale
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
