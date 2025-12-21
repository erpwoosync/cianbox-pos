import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi, Customer, CustomerStats } from '../services/api';
import { Users, RefreshCw, Search, Eye, Mail, Phone, MapPin, CreditCard, Percent, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const pageSize = 25;

  useEffect(() => {
    loadData();
  }, [page, search, filterActive]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await customersApi.getAll({
        search: search || undefined,
        page,
        pageSize,
        isActive: filterActive,
      });
      setCustomers(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await customersApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
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

  const getCustomerTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      CONSUMER: 'bg-gray-100 text-gray-700',
      BUSINESS: 'bg-blue-100 text-blue-700',
      GOVERNMENT: 'bg-purple-100 text-purple-700',
      RESELLER: 'bg-green-100 text-green-700',
    };
    return styles[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <button
          onClick={() => { loadData(); loadStats(); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-gray-500">Activos</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-400">{stats.inactive}</div>
            <div className="text-sm text-gray-500">Inactivos</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.withCredit}</div>
            <div className="text-sm text-gray-500">Con Crédito</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{stats.fromCianbox}</div>
            <div className="text-sm text-gray-500">Desde Cianbox</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre, CUIT/DNI o email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Buscar
            </button>
          </form>
          <select
            value={filterActive === undefined ? '' : filterActive.toString()}
            onChange={(e) => {
              setPage(1);
              setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true');
            }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users size={48} className="mx-auto mb-3 text-gray-300" />
            <p>No se encontraron clientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crédito</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getCustomerTypeBadge(customer.customerType)}`}>
                            {getCustomerTypeLabel(customer.customerType)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {customer.taxId ? (
                          <>
                            <span className="text-gray-500">{customer.taxIdType}: </span>
                            <span className="font-mono">{customer.taxId}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                      {customer.taxCategory && (
                        <div className="text-xs text-gray-500">{customer.taxCategory}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail size={14} />
                            <span className="truncate max-w-[150px]">{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone size={14} />
                            {customer.phone}
                          </div>
                        )}
                        {customer.city && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <MapPin size={14} />
                            {customer.city}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {customer.creditLimit && Number(customer.creditLimit) > 0 ? (
                          <>
                            <div className="flex items-center gap-1 text-sm">
                              <CreditCard size={14} className="text-blue-500" />
                              <span>Límite: {formatCurrency(Number(customer.creditLimit))}</span>
                            </div>
                            {customer.paymentTermDays && customer.paymentTermDays > 0 && (
                              <div className="text-xs text-gray-500">
                                {customer.paymentTermDays} días
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">Sin crédito</span>
                        )}
                        {customer.globalDiscount && Number(customer.globalDiscount) > 0 && (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <Percent size={14} />
                            {Number(customer.globalDiscount)}% dto.
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        customer.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {customer.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                      {customer.cianboxCustomerId && (
                        <div className="text-xs text-purple-600 mt-1">
                          Cianbox #{customer.cianboxCustomerId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Ver detalle"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-500">
              Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-700">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
