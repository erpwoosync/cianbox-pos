import { useState, useEffect } from 'react';
import {
  BarChart3,
  Search,
  Calendar,
  Download,
  Eye,
  Loader2,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import { salesService } from '../services/api';

interface Sale {
  id: string;
  saleNumber: string;
  saleDate: string;
  total: number;
  status: string;
  user: { name: string };
  customer?: { name: string };
  _count?: { items: number };
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalAmount: 0,
    avgTicket: 0,
    totalItems: 0,
  });

  useEffect(() => {
    loadSales();
    loadSummary();
  }, []);

  const loadSales = async () => {
    try {
      const response = await salesService.list({ pageSize: 50 });
      if (response.success) {
        setSales(response.data);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await salesService.getDailySummary();
      if (response.success) {
        setSummary({
          totalSales: response.data.totalSales || 0,
          totalAmount: response.data.totalAmount || 0,
          avgTicket: response.data.avgTicket || 0,
          totalItems: response.data.totalItems || 0,
        });
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      case 'REFUNDED':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELLED':
        return 'Anulada';
      case 'REFUNDED':
        return 'Devuelta';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500">Historial y reportes de ventas</p>
        </div>
        <button className="btn btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${summary.totalAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-500">Ventas hoy</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalSales}</p>
              <p className="text-sm text-gray-500">Transacciones</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${summary.avgTicket.toFixed(2)}</p>
              <p className="text-sm text-gray-500">Ticket promedio</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalItems}</p>
              <p className="text-sm text-gray-500">Items vendidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número de venta..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 mb-4" />
            <p>No hay ventas registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    # Venta
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Cajero
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Cliente
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">
                      {sale.saleNumber}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(sale.saleDate).toLocaleString('es-AR')}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {sale.user?.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {sale.customer?.name || 'Consumidor Final'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      ${Number(sale.total).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          sale.status
                        )}`}
                      >
                        {getStatusLabel(sale.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
