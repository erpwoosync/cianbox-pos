import { useState } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  MapPin,
  DollarSign,
  FileText,
} from 'lucide-react';
import { treasuryApi, TreasuryPending, TreasuryStatus } from '../services/api';

interface TreasuryConfirmModalProps {
  pending: TreasuryPending;
  mode: 'confirm' | 'reject' | 'view';
  onClose: () => void;
  onSuccess: () => void;
}

export default function TreasuryConfirmModal({
  pending,
  mode,
  onClose,
  onSuccess,
}: TreasuryConfirmModalProps) {
  const [receivedAmount, setReceivedAmount] = useState(pending.amount.toString());
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

  const getStatusIcon = (status: TreasuryStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'CONFIRMED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'PARTIAL':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: TreasuryStatus) => {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'CONFIRMED':
        return 'Confirmado';
      case 'PARTIAL':
        return 'Parcial';
      case 'REJECTED':
        return 'Rechazado';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: TreasuryStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleConfirm = async () => {
    const amount = parseFloat(receivedAmount);
    if (isNaN(amount) || amount < 0) {
      setError('Ingrese un monto valido');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await treasuryApi.confirm(pending.id, {
        receivedAmount: amount,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al confirmar el retiro';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reason || reason.length < 5) {
      setError('Ingrese una razon valida (minimo 5 caracteres)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await treasuryApi.reject(pending.id, { reason });
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al rechazar el retiro';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const difference = parseFloat(receivedAmount) - pending.amount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'confirm' && 'Confirmar Recepcion'}
            {mode === 'reject' && 'Rechazar Retiro'}
            {mode === 'view' && 'Detalle del Retiro'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Informacion del retiro */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                  pending.status
                )}`}
              >
                {getStatusIcon(pending.status)}
                {getStatusText(pending.status)}
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(pending.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Punto de Venta</p>
                  <p className="text-sm font-medium text-gray-900">
                    {pending.cashSession.pointOfSale.name}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Cajero</p>
                  <p className="text-sm font-medium text-gray-900">
                    {pending.cashSession.user.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Motivo del retiro</p>
                <p className="text-sm font-medium text-gray-900">
                  {pending.cashMovement.reason}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Monto esperado</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(pending.amount)}
                </p>
              </div>
            </div>

            {pending.confirmedAmount !== null && pending.confirmedAmount !== undefined && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Monto recibido:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(pending.confirmedAmount)}
                  </span>
                </div>
                {pending.confirmedBy && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-500">Confirmado por:</span>
                    <span className="text-sm text-gray-900">
                      {pending.confirmedBy.name}
                    </span>
                  </div>
                )}
                {pending.confirmedAt && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-500">Fecha:</span>
                    <span className="text-sm text-gray-900">
                      {formatDate(pending.confirmedAt)}
                    </span>
                  </div>
                )}
                {pending.differenceNotes && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                    {pending.differenceNotes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formulario de confirmacion */}
          {mode === 'confirm' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto recibido
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
                {!isNaN(difference) && difference !== 0 && (
                  <p
                    className={`mt-1 text-sm ${
                      difference > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    Diferencia: {difference > 0 ? '+' : ''}
                    {formatCurrency(difference)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
          )}

          {/* Formulario de rechazo */}
          {mode === 'reject' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Esta accion no se puede deshacer. El retiro quedara marcado como rechazado.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razon del rechazo
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Explique por que se rechaza este retiro..."
                />
                <p className="mt-1 text-xs text-gray-500">Minimo 5 caracteres</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {mode === 'view' ? 'Cerrar' : 'Cancelar'}
          </button>
          {mode === 'confirm' && (
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? 'Confirmando...' : 'Confirmar Recepcion'}
            </button>
          )}
          {mode === 'reject' && (
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              {isSubmitting ? 'Rechazando...' : 'Rechazar Retiro'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
