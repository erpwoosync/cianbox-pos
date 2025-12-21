import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi, Customer } from '../services/api';
import { ArrowLeft, Users, RefreshCw, Mail, Phone, MapPin, CreditCard, Percent, ShoppingCart, Calendar, DollarSign, FileText } from 'lucide-react';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customersApi.getById(id!);
      setCustomer(data);
    } catch (err) {
      console.error('Error loading customer:', err);
      setError('Error al cargar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCustomerTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      CONSUMER: 'Consumidor Final',
      BUSINESS: 'Empresa',
      GOVERNMENT: 'Gobierno',
      RESELLER: 'Revendedor',
    };
    return types[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      CANCELLED: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Cliente no encontrado'}</p>
        <button
          onClick={() => navigate('/customers')}
          className="text-blue-600 hover:underline"
        >
          Volver a clientes
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/customers')}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              customer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {customer.isActive ? 'Activo' : 'Inactivo'}
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {getCustomerTypeLabel(customer.customerType)}
            </span>
            {customer.cianboxCustomerId && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                Cianbox #{customer.cianboxCustomerId}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={loadCustomer}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos Fiscales */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-gray-400" />
              Datos Fiscales
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Tipo Documento</label>
                <p className="font-medium">{customer.taxIdType || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Número</label>
                <p className="font-medium font-mono">{customer.taxId || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-500">Condición Fiscal</label>
                <p className="font-medium">{customer.taxCategory || '-'}</p>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={20} className="text-gray-400" />
              Contacto
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-gray-400" />
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-medium">{customer.email}</p>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={18} className="text-gray-400" />
                  <div>
                    <label className="text-sm text-gray-500">Teléfono</label>
                    <p className="font-medium">{customer.phone}</p>
                  </div>
                </div>
              )}
              {customer.mobile && (
                <div className="flex items-center gap-2">
                  <Phone size={18} className="text-gray-400" />
                  <div>
                    <label className="text-sm text-gray-500">Celular</label>
                    <p className="font-medium">{customer.mobile}</p>
                  </div>
                </div>
              )}
            </div>

            {(customer.address || customer.city || customer.state) && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-start gap-2">
                  <MapPin size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <label className="text-sm text-gray-500">Dirección</label>
                    <p className="font-medium">
                      {[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Últimas Ventas */}
          {customer.sales && customer.sales.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingCart size={20} className="text-gray-400" />
                Últimas Ventas
                {customer._count?.sales && (
                  <span className="text-sm font-normal text-gray-500">
                    ({customer._count.sales} total)
                  </span>
                )}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nro. Venta</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {customer.sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/sales/${sale.id}`)}
                      >
                        <td className="px-4 py-2 font-mono text-sm">{sale.saleNumber}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(sale.status)}`}>
                            {sale.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Crédito */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={20} className="text-gray-400" />
              Crédito
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Límite de Crédito</label>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(Number(customer.creditLimit) || 0)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Saldo</label>
                <p className={`text-lg font-semibold ${
                  Number(customer.creditBalance) > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(Number(customer.creditBalance) || 0)}
                </p>
              </div>
              {customer.paymentTermDays && customer.paymentTermDays > 0 && (
                <div>
                  <label className="text-sm text-gray-500">Plazo de Pago</label>
                  <p className="font-medium">{customer.paymentTermDays} días</p>
                </div>
              )}
            </div>
          </div>

          {/* Descuentos y Precios */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Percent size={20} className="text-gray-400" />
              Descuentos y Precios
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Descuento Global</label>
                <p className="text-2xl font-bold text-green-600">
                  {Number(customer.globalDiscount) || 0}%
                </p>
              </div>
              {customer.priceList && (
                <div>
                  <label className="text-sm text-gray-500">Lista de Precios</label>
                  <p className="font-medium flex items-center gap-2">
                    <DollarSign size={16} className="text-blue-500" />
                    {customer.priceList.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Info Sync */}
          {customer.lastSyncedAt && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={16} />
                <span>Última sincronización:</span>
              </div>
              <p className="text-sm font-medium text-gray-700 mt-1">
                {formatDate(customer.lastSyncedAt)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
