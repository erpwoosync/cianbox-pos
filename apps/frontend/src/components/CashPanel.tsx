import { useState } from 'react';
import {
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CashSession } from '../services/api';

interface CashPanelProps {
  session: CashSession;
  expectedCash: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCount: () => void;
  onClose: () => void;
}

export default function CashPanel({
  session,
  expectedCash,
  onDeposit,
  onWithdraw,
  onCount,
  onClose,
}: CashPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white border-b shadow-sm">
      {/* Header colapsable */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium text-gray-700">
              {session.pointOfSale?.name || 'Caja'}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatTime(session.openedAt)}
          </span>
          <span className="text-sm font-medium text-green-700">
            Efectivo: {formatCurrency(expectedCash)}
          </span>
          <span className="text-sm text-gray-500">
            {session.salesCount} ventas
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Acciones rapidas */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeposit();
            }}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
            title="Ingreso"
          >
            <ArrowDownCircle className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWithdraw();
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            title="Retiro"
          >
            <ArrowUpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCount();
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="Arqueo"
          >
            <Calculator className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="Cerrar turno"
          >
            <Lock className="w-4 h-4" />
          </button>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Panel expandido */}
      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Fondo</p>
              <p className="font-semibold">{formatCurrency(Number(session.openingAmount))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Efectivo</p>
              <p className="font-semibold text-green-600">{formatCurrency(expectedCash - Number(session.openingAmount))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Debito</p>
              <p className="font-semibold">{formatCurrency(Number(session.totalDebit))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Credito</p>
              <p className="font-semibold">{formatCurrency(Number(session.totalCredit))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">QR</p>
              <p className="font-semibold">{formatCurrency(Number(session.totalQr))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Retiros</p>
              <p className="font-semibold text-red-600">{formatCurrency(Number(session.withdrawalsTotal))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Ingresos</p>
              <p className="font-semibold text-blue-600">{formatCurrency(Number(session.depositsTotal))}</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <Banknote className="w-4 h-4 inline mr-1" />
              Turno #{session.sessionNumber}
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Total ventas: </span>
              <span className="font-semibold">{formatCurrency(Number(session.salesTotal))}</span>
              <span className="text-gray-400 ml-2">({session.salesCount} ops)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
