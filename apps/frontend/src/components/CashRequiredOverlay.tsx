/**
 * Overlay que bloquea el POS cuando se requiere abrir caja
 * Se muestra cuando cashMode es 'REQUIRED' y no hay sesion activa
 */

import { Wallet, AlertTriangle, DollarSign } from 'lucide-react';

interface CashRequiredOverlayProps {
  onOpenCash: () => void;
  userName?: string;
  posName?: string;
}

export default function CashRequiredOverlay({
  onOpenCash,
  userName,
  posName,
}: CashRequiredOverlayProps) {
  return (
    <div className="fixed inset-0 bg-gray-900/95 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header con icono */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Turno de Caja Requerido</h2>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Mensaje de alerta */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-medium">
                Debe abrir un turno de caja para comenzar a vender
              </p>
              <p className="text-amber-700 text-sm mt-1">
                Esta configuracion es requerida por la administracion para mantener el control de efectivo.
              </p>
            </div>
          </div>

          {/* Info del usuario */}
          {(userName || posName) && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              {userName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cajero:</span>
                  <span className="font-medium">{userName}</span>
                </div>
              )}
              {posName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Punto de Venta:</span>
                  <span className="font-medium">{posName}</span>
                </div>
              )}
            </div>
          )}

          {/* Instrucciones */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700">Para abrir el turno:</h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Haga clic en el boton de abajo</li>
              <li>Ingrese el monto inicial de efectivo en caja</li>
              <li>Confirme la apertura del turno</li>
            </ol>
          </div>

          {/* Boton de accion */}
          <button
            onClick={onOpenCash}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl"
          >
            <DollarSign className="w-6 h-6" />
            Abrir Turno de Caja
          </button>

          <p className="text-xs text-gray-400 text-center">
            El turno quedara asociado a su usuario y punto de venta
          </p>
        </div>
      </div>
    </div>
  );
}
