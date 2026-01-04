import { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Edit,
  Trash2,
  Gift,
  Calendar,
  Clock,
  Tag,
  Percent,
  Package,
  X,
  Check,
  AlertTriangle,
  Zap,
  Play,
} from 'lucide-react';
import {
  promotionsApi,
  categoriesApi,
  brandsApi,
  productsApi,
  Promotion,
  PromotionType,
  DiscountType,
  PromotionApplyTo,
  CreatePromotionDto,
  Category,
  Brand,
  Product,
} from '../services/api';

// Helper para formatear tipos de promocion
const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  PERCENTAGE: 'Porcentaje de descuento',
  FIXED_AMOUNT: 'Monto fijo de descuento',
  BUY_X_GET_Y: 'Compre X lleve Y (2x1, 3x2)',
  SECOND_UNIT_DISCOUNT: '2da unidad al X%',
  BUNDLE_PRICE: 'Precio especial combo',
  FREE_SHIPPING: 'Envio gratis',
  COUPON: 'Cupon',
  FLASH_SALE: 'Flash Sale (BlackFriday, etc)',
  LOYALTY: 'Programa de fidelidad',
};

const APPLY_TO_LABELS: Record<PromotionApplyTo, string> = {
  ALL_PRODUCTS: 'Todos los productos',
  SPECIFIC_PRODUCTS: 'Productos especificos',
  CATEGORIES: 'Categorias',
  BRANDS: 'Marcas',
  CART_TOTAL: 'Total del carrito',
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' },
];

const getDefaultFormData = (): CreatePromotionDto => ({
  name: '',
  code: '',
  description: '',
  type: 'PERCENTAGE',
  discountType: 'PERCENTAGE',
  discountValue: 0,
  buyQuantity: 1,
  getQuantity: 2,
  minPurchase: undefined,
  maxDiscount: undefined,
  applyTo: 'ALL_PRODUCTS',
  categoryIds: [],
  brandIds: [],
  productIds: [],
  startDate: '',
  endDate: '',
  daysOfWeek: [],
  startTime: '',
  endTime: '',
  maxUses: undefined,
  maxUsesPerCustomer: undefined,
  isActive: true,
  priority: 1,
  stackable: false,
  badgeColor: '#22C55E',
  metadata: {},
});

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PromotionType | ''>('');
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreatePromotionDto>(getDefaultFormData());

  // Data for selectors
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Simulator
  const [showSimulator, setShowSimulator] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (filterType) params.type = filterType;
      if (filterActive) params.isActive = filterActive === 'true';

      const data = await promotionsApi.getAll(params);
      setPromotions(data || []);
    } catch (error) {
      console.error('Error cargando promociones:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectorsData = async () => {
    setLoadingData(true);
    try {
      const [cats, brnds, prodsResponse] = await Promise.all([
        categoriesApi.getAll(),
        brandsApi.getAll(),
        productsApi.getAll(),
      ]);
      setCategories(cats || []);
      setBrands(brnds || []);
      setProducts(prodsResponse?.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType, filterActive]);

  const openCreateModal = async () => {
    setEditingPromotion(null);
    setFormData(getDefaultFormData());
    setShowModal(true);
    await loadSelectorsData();
  };

  const openEditModal = async (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      code: promotion.code || '',
      description: promotion.description || '',
      type: promotion.type,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      buyQuantity: promotion.buyQuantity || 1,
      getQuantity: promotion.getQuantity || 2,
      minPurchase: promotion.minPurchase || undefined,
      maxDiscount: promotion.maxDiscount || undefined,
      applyTo: promotion.applyTo,
      categoryIds: promotion.categoryIds || [],
      brandIds: promotion.brandIds || [],
      productIds: promotion.applicableProducts?.map((p) => p.productId) || [],
      startDate: promotion.startDate ? promotion.startDate.split('T')[0] : '',
      endDate: promotion.endDate ? promotion.endDate.split('T')[0] : '',
      daysOfWeek: promotion.daysOfWeek || [],
      startTime: promotion.startTime || '',
      endTime: promotion.endTime || '',
      maxUses: promotion.maxUses || undefined,
      maxUsesPerCustomer: promotion.maxUsesPerCustomer || undefined,
      isActive: promotion.isActive,
      priority: promotion.priority,
      stackable: promotion.stackable,
      badgeColor: promotion.badgeColor || '#22C55E',
      metadata: promotion.metadata || {},
    });
    setShowModal(true);
    await loadSelectorsData();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPromotion(null);
    setFormData(getDefaultFormData());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        discountValue: Number(formData.discountValue),
        buyQuantity: formData.buyQuantity ? Number(formData.buyQuantity) : undefined,
        getQuantity: formData.getQuantity ? Number(formData.getQuantity) : undefined,
        minPurchase: formData.minPurchase ? Number(formData.minPurchase) : undefined,
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : undefined,
        maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
        maxUsesPerCustomer: formData.maxUsesPerCustomer ? Number(formData.maxUsesPerCustomer) : undefined,
        priority: Number(formData.priority),
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      };

      if (editingPromotion) {
        await promotionsApi.update(editingPromotion.id, payload);
      } else {
        await promotionsApi.create(payload);
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Error guardando promocion:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta promocion?')) return;
    setDeleting(id);
    try {
      await promotionsApi.delete(id);
      await loadData();
    } catch (error) {
      console.error('Error eliminando promocion:', error);
    } finally {
      setDeleting(null);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    const days = formData.daysOfWeek || [];
    if (days.includes(day)) {
      setFormData({ ...formData, daysOfWeek: days.filter((d) => d !== day) });
    } else {
      setFormData({ ...formData, daysOfWeek: [...days, day].sort() });
    }
  };

  const filteredPromotions = promotions.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
  );

  const formatDiscountValue = (promo: Promotion) => {
    if (promo.type === 'BUY_X_GET_Y') {
      return `${promo.buyQuantity || 1}x${promo.getQuantity || 2}`;
    }
    if (promo.discountType === 'PERCENTAGE') {
      return `${promo.discountValue}%`;
    }
    return `$${promo.discountValue.toLocaleString('es-AR')}`;
  };

  const formatDateRange = (promo: Promotion) => {
    if (!promo.startDate && !promo.endDate) return 'Sin limite';
    const start = promo.startDate ? new Date(promo.startDate).toLocaleDateString('es-AR') : '';
    const end = promo.endDate ? new Date(promo.endDate).toLocaleDateString('es-AR') : '';
    if (start && end) return `${start} - ${end}`;
    if (start) return `Desde ${start}`;
    if (end) return `Hasta ${end}`;
    return 'Sin limite';
  };

  const isPromotionActive = (promo: Promotion) => {
    if (!promo.isActive) return false;
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) return false;
    if (promo.endDate && new Date(promo.endDate) < now) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promociones</h1>
          <p className="text-gray-600">Gestiona descuentos, ofertas y promociones especiales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSimulator(true)}
            className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Play size={18} />
            Simulador
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Nueva Promocion
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o codigo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as PromotionType | '')}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-w-[180px]"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as '' | 'true' | 'false')}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-w-[140px]"
        >
          <option value="">Todos</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Promocion</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Descuento</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Aplica a</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Vigencia</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Usos</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    Cargando promociones...
                  </td>
                </tr>
              ) : filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Gift className="mx-auto mb-2 text-gray-300" size={48} />
                    No hay promociones
                  </td>
                </tr>
              ) : (
                filteredPromotions.map((promo) => {
                  const active = isPromotionActive(promo);
                  return (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{promo.name}</div>
                        {promo.code && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Tag size={12} />
                            {promo.code}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {PROMOTION_TYPE_LABELS[promo.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-green-600">
                          {formatDiscountValue(promo)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {APPLY_TO_LABELS[promo.applyTo]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDateRange(promo)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {promo.currentUses}/{promo.maxUses || '∞'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <Check size={12} />
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(promo)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(promo.id)}
                            disabled={deleting === promo.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deleting === promo.id ? (
                              <RefreshCw size={18} className="animate-spin" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingPromotion ? 'Editar Promocion' : 'Nueva Promocion'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Informacion basica */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Gift size={18} />
                  Informacion Basica
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: 2x1 en Bebidas"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Codigo (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Ej: BLACKFRIDAY2024"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripcion
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripcion de la promocion..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tipo de promocion */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Zap size={18} />
                  Tipo de Promocion
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'SECOND_UNIT_DISCOUNT', 'FLASH_SALE'] as PromotionType[]).map((type) => (
                    <label
                      key={type}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.type === type ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        checked={formData.type === type}
                        onChange={() => setFormData({ ...formData, type, discountType: type === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE' })}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{PROMOTION_TYPE_LABELS[type]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Configuracion del descuento (dinamica segun tipo) */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Percent size={18} />
                  Configuracion del Descuento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.type === 'BUY_X_GET_Y' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Comprar (unidades)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={formData.buyQuantity || 1}
                          onChange={(e) => setFormData({ ...formData, buyQuantity: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Llevar (unidades)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={formData.getQuantity || 2}
                          onChange={(e) => setFormData({ ...formData, getQuantity: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-end text-sm text-gray-500">
                        Ej: Comprar 1, llevar 2 = 2x1
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de descuento
                        </label>
                        <select
                          value={formData.discountType}
                          onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PERCENTAGE">Porcentaje (%)</option>
                          <option value="FIXED_AMOUNT">Monto fijo ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Valor {formData.discountType === 'PERCENTAGE' ? '(%)' : '($)'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={formData.discountType === 'PERCENTAGE' ? 1 : 0.01}
                          max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                          value={formData.discountValue}
                          onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descuento maximo ($)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={formData.maxDiscount || ''}
                          onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined })}
                          placeholder="Sin limite"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Aplica a */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Package size={18} />
                  ¿A que aplica?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(['ALL_PRODUCTS', 'CATEGORIES', 'BRANDS', 'SPECIFIC_PRODUCTS', 'CART_TOTAL'] as PromotionApplyTo[]).map((applyTo) => (
                    <label
                      key={applyTo}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.applyTo === applyTo ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="applyTo"
                        value={applyTo}
                        checked={formData.applyTo === applyTo}
                        onChange={() => setFormData({ ...formData, applyTo, categoryIds: [], brandIds: [], productIds: [] })}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{APPLY_TO_LABELS[applyTo]}</span>
                    </label>
                  ))}
                </div>

                {/* Seleccion dinamica segun applyTo */}
                {formData.applyTo === 'CATEGORIES' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar categorias
                    </label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {loadingData ? (
                        <p className="text-gray-500 text-sm p-2">Cargando...</p>
                      ) : categories.length === 0 ? (
                        <p className="text-gray-500 text-sm p-2">No hay categorias</p>
                      ) : (
                        categories.map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={formData.categoryIds?.includes(cat.id) || false}
                              onChange={(e) => {
                                const ids = formData.categoryIds || [];
                                if (e.target.checked) {
                                  setFormData({ ...formData, categoryIds: [...ids, cat.id] });
                                } else {
                                  setFormData({ ...formData, categoryIds: ids.filter((id) => id !== cat.id) });
                                }
                              }}
                              className="text-blue-600"
                            />
                            <span className="text-sm">{cat.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {formData.applyTo === 'BRANDS' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar marcas
                    </label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {loadingData ? (
                        <p className="text-gray-500 text-sm p-2">Cargando...</p>
                      ) : brands.length === 0 ? (
                        <p className="text-gray-500 text-sm p-2">No hay marcas</p>
                      ) : (
                        brands.map((brand) => (
                          <label key={brand.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={formData.brandIds?.includes(brand.id) || false}
                              onChange={(e) => {
                                const ids = formData.brandIds || [];
                                if (e.target.checked) {
                                  setFormData({ ...formData, brandIds: [...ids, brand.id] });
                                } else {
                                  setFormData({ ...formData, brandIds: ids.filter((id) => id !== brand.id) });
                                }
                              }}
                              className="text-blue-600"
                            />
                            <span className="text-sm">{brand.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {formData.applyTo === 'SPECIFIC_PRODUCTS' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar productos
                    </label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {loadingData ? (
                        <p className="text-gray-500 text-sm p-2">Cargando...</p>
                      ) : products.length === 0 ? (
                        <p className="text-gray-500 text-sm p-2">No hay productos</p>
                      ) : (
                        products.map((prod) => (
                          <label key={prod.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={formData.productIds?.includes(prod.id) || false}
                              onChange={(e) => {
                                const ids = formData.productIds || [];
                                if (e.target.checked) {
                                  setFormData({ ...formData, productIds: [...ids, prod.id] });
                                } else {
                                  setFormData({ ...formData, productIds: ids.filter((id) => id !== prod.id) });
                                }
                              }}
                              className="text-blue-600"
                            />
                            <span className="text-sm">{prod.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {formData.applyTo === 'CART_TOTAL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto minimo de compra ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.minPurchase || ''}
                      onChange={(e) => setFormData({ ...formData, minPurchase: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Ej: 10000"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 max-w-xs"
                    />
                  </div>
                )}
              </div>

              {/* Vigencia */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar size={18} />
                  Vigencia
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha inicio
                    </label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={formData.endDate || ''}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dias de la semana (vacio = todos)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDayOfWeek(day.value)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          (formData.daysOfWeek || []).includes(day.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Clock size={14} />
                      Hora inicio
                    </label>
                    <input
                      type="time"
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Clock size={14} />
                      Hora fin
                    </label>
                    <input
                      type="time"
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Limites */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Limites de Uso
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximo usos totales
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.maxUses || ''}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Ilimitado"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximo usos por cliente
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.maxUsesPerCustomer || ''}
                      onChange={(e) => setFormData({ ...formData, maxUsesPerCustomer: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Ilimitado"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Comportamiento */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Comportamiento</h3>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Activa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.stackable}
                      onChange={(e) => setFormData({ ...formData, stackable: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Acumulable con otras promociones</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Prioridad:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                      className="w-16 px-2 py-1 border rounded text-sm"
                    />
                    <span className="text-xs text-gray-500">(mayor = primero)</span>
                  </div>
                </div>

                {/* Color del Badge */}
                <div className="pt-3 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color del badge en POS
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.badgeColor || '#22C55E'}
                        onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                      />
                      <input
                        type="text"
                        value={formData.badgeColor || '#22C55E'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                            setFormData({ ...formData, badgeColor: value || '#22C55E' });
                          }
                        }}
                        placeholder="#22C55E"
                        className="w-24 px-2 py-1 border rounded text-sm font-mono"
                      />
                    </div>
                    {/* Vista previa */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Vista previa:</span>
                      <div
                        style={{ backgroundColor: formData.badgeColor || '#22C55E' }}
                        className="text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"
                      >
                        <Tag size={12} />
                        {formData.type === 'BUY_X_GET_Y'
                          ? `${formData.buyQuantity || 1}x${formData.getQuantity || 2}`
                          : formData.discountType === 'PERCENTAGE'
                          ? `-${formData.discountValue || 0}%`
                          : `-$${formData.discountValue || 0}`}
                      </div>
                    </div>
                  </div>
                  {/* Colores predefinidos */}
                  <div className="flex gap-2 mt-2">
                    {[
                      { color: '#22C55E', name: 'Verde' },
                      { color: '#EF4444', name: 'Rojo' },
                      { color: '#F59E0B', name: 'Naranja' },
                      { color: '#3B82F6', name: 'Azul' },
                      { color: '#8B5CF6', name: 'Violeta' },
                      { color: '#EC4899', name: 'Rosa' },
                      { color: '#14B8A6', name: 'Turquesa' },
                      { color: '#000000', name: 'Negro' },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setFormData({ ...formData, badgeColor: preset.color })}
                        style={{ backgroundColor: preset.color }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          formData.badgeColor === preset.color
                            ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400'
                            : 'border-white shadow'
                        }`}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {editingPromotion ? 'Guardar Cambios' : 'Crear Promocion'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {showSimulator && (
        <PromotionSimulator
          onClose={() => setShowSimulator(false)}
          products={products}
          loadProducts={loadSelectorsData}
        />
      )}
    </div>
  );
}

// Componente Simulador inline
interface SimulatorProps {
  onClose: () => void;
  products: Product[];
  loadProducts: () => Promise<void>;
}

function PromotionSimulator({ onClose, products, loadProducts }: SimulatorProps) {
  const [cartItems, setCartItems] = useState<Array<{ product: Product; quantity: number; unitPrice: number }>>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      promotion?: { id: string; name: string; type: PromotionType; discount?: number };
      promotions?: Array<{ id: string; name: string; type: PromotionType; discount: number }>;
      subtotal: number;
    }>;
    totalDiscount: number;
  } | null>(null);

  useEffect(() => {
    if (products.length === 0) {
      loadProducts();
    }
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchProduct.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    const existing = cartItems.find((item) => item.product.id === product.id);
    const price = product.prices?.[0]?.price || 0;
    if (existing) {
      setCartItems(
        cartItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCartItems([...cartItems, { product, quantity: 1, unitPrice: price }]);
    }
    setSearchProduct('');
    setResult(null);
  };

  const removeFromCart = (productId: string) => {
    setCartItems(cartItems.filter((item) => item.product.id !== productId));
    setResult(null);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(
      cartItems.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
    setResult(null);
  };

  const simulate = async () => {
    if (cartItems.length === 0) return;
    setLoading(true);
    try {
      const items = cartItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
      const res = await promotionsApi.simulate(items);
      setResult(res);
    } catch (error) {
      console.error('Error simulando:', error);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = result?.totalDiscount || 0;
  const total = subtotal - totalDiscount;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Play size={20} className="text-purple-600" />
            Simulador de Promociones
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Buscar producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agregar producto al carrito de prueba
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {searchProduct && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span className="text-sm">{prod.name}</span>
                    <span className="text-sm text-gray-500">
                      ${(prod.prices?.[0]?.price || 0).toLocaleString('es-AR')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de prueba */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Carrito de Prueba</h3>
            {cartItems.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-gray-500">
                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                Agrega productos para simular
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {cartItems.map((item) => {
                  const resultItem = result?.items.find((r) => r.productId === item.product.id);
                  return (
                    <div key={item.product.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{item.product.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm w-24 text-right">
                            ${(item.quantity * item.unitPrice).toLocaleString('es-AR')}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      {/* Mostrar todas las promociones aplicadas (acumulables) */}
                      {resultItem?.promotions && resultItem.promotions.length > 0 ? (
                        <div className="mt-1 space-y-1">
                          {resultItem.promotions.map((promo, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-green-600 flex items-center gap-1">
                                <Tag size={12} />
                                {promo.name}
                              </span>
                              <span className="text-green-600 font-medium">
                                -${promo.discount.toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : resultItem?.promotion && (
                        <div className="mt-1 flex items-center justify-between text-sm">
                          <span className="text-green-600 flex items-center gap-1">
                            <Tag size={12} />
                            {resultItem.promotion.name}
                          </span>
                          <span className="text-green-600 font-medium">
                            -${resultItem.discount.toLocaleString('es-AR')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Boton simular */}
          <button
            onClick={simulate}
            disabled={cartItems.length === 0 || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Play size={18} />
                Simular Promociones
              </>
            )}
          </button>

          {/* Resultado */}
          <div className="border-t pt-4 space-y-2">
            {/* Mostrar resumen de promociones aplicadas */}
            {result && (() => {
              const allPromos = result.items.flatMap(item => item.promotions || (item.promotion ? [item.promotion] : []));
              const uniquePromos = [...new Map(allPromos.map(p => [p.id, p])).values()];
              if (uniquePromos.length > 0) {
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                    <p className="text-sm font-medium text-green-800 mb-1">
                      {uniquePromos.length} {uniquePromos.length === 1 ? 'promoción aplicada' : 'promociones aplicadas'}:
                    </p>
                    <ul className="text-sm text-green-700 space-y-0.5">
                      {uniquePromos.map((promo, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <Tag size={12} />
                          {promo.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span>${subtotal.toLocaleString('es-AR')}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento:</span>
                <span>-${totalDiscount.toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>TOTAL:</span>
              <span>${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
