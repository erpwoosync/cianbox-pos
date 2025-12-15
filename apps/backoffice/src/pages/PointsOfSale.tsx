import { useState, useEffect } from 'react';
import { pointsOfSaleApi, stockApi, pricesApi, PointOfSale, CreatePointOfSaleDto } from '../services/api';
import { Monitor, RefreshCw, Search, Plus, Pencil, Trash2, X, Store, ListOrdered } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface PriceList {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
}

export default function PointsOfSale() {
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPos, setEditingPos] = useState<PointOfSale | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreatePointOfSaleDto>({
    branchId: '',
    code: '',
    name: '',
    description: '',
    priceListId: '',
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [posData, branchesData, priceListsData] = await Promise.all([
        pointsOfSaleApi.getAll(),
        stockApi.getBranches(),
        pricesApi.getPriceLists(),
      ]);
      setPointsOfSale(posData);
      setBranches(branchesData);
      setPriceLists(priceListsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPointsOfSale = pointsOfSale.filter((pos) =>
    pos.name.toLowerCase().includes(search.toLowerCase()) ||
    pos.code.toLowerCase().includes(search.toLowerCase()) ||
    pos.branch?.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingPos(null);
    setFormData({
      branchId: branches[0]?.id || '',
      code: '',
      name: '',
      description: '',
      priceListId: priceLists.find(pl => pl.isDefault)?.id || '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (pos: PointOfSale) => {
    setEditingPos(pos);
    setFormData({
      branchId: pos.branchId,
      code: pos.code,
      name: pos.name,
      description: pos.description || '',
      priceListId: pos.priceListId || '',
      isActive: pos.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPos(null);
    setFormData({
      branchId: '',
      code: '',
      name: '',
      description: '',
      priceListId: '',
      isActive: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPos) {
        await pointsOfSaleApi.update(editingPos.id, formData);
      } else {
        await pointsOfSaleApi.create(formData);
      }
      closeModal();
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error saving point of sale:', error);
      alert(err.response?.data?.error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pos: PointOfSale) => {
    if (!confirm(`¿Eliminar el punto de venta "${pos.name}"?`)) return;

    setDeleting(pos.id);
    try {
      await pointsOfSaleApi.delete(pos.id);
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      console.error('Error deleting point of sale:', error);
      alert(err.response?.data?.error?.message || 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Puntos de Venta</h1>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            Nuevo POS
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar punto de venta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Points of Sale table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredPointsOfSale.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {pointsOfSale.length === 0
              ? 'No hay puntos de venta configurados. Crea uno nuevo para comenzar.'
              : 'No se encontraron puntos de venta'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Punto de Venta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sucursal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lista de Precios
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPointsOfSale.map((pos) => (
                  <tr key={pos.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Monitor size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {pos.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            Código: {pos.code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Store size={16} className="text-orange-500" />
                        <span className="text-sm text-gray-700">
                          {pos.branch?.name || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pos.priceList ? (
                        <div className="flex items-center gap-2">
                          <ListOrdered size={16} className="text-teal-500" />
                          <span className="text-sm text-gray-700">
                            {pos.priceList.name}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {pos.priceList.currency}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Sin lista asignada</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          pos.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {pos.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(pos)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(pos)}
                          disabled={deleting === pos.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deleting === pos.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        Total: {pointsOfSale.length} puntos de venta
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPos ? 'Editar Punto de Venta' : 'Nuevo Punto de Venta'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sucursal *
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Seleccionar sucursal...</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code}){!branch.isActive ? ' (Inactiva)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  placeholder="Ej: CAJA-01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ej: Caja Principal"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Descripción opcional..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lista de Precios
                </label>
                <select
                  value={formData.priceListId || ''}
                  onChange={(e) => setFormData({ ...formData, priceListId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Sin lista asignada</option>
                  {priceLists.map((priceList) => (
                    <option key={priceList.id} value={priceList.id}>
                      {priceList.name} ({priceList.currency})
                      {priceList.isDefault ? ' - Por defecto' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Define qué precios se usarán en este punto de venta
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Activo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <RefreshCw size={16} className="animate-spin" />}
                  {editingPos ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
