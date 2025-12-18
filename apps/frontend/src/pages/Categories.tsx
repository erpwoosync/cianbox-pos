import { useState, useEffect } from 'react';
import {
  Tags,
  Plus,
  Edit,
  Trash2,
  Loader2,
  FolderTree,
  Zap,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Palette,
  GripVertical,
} from 'lucide-react';
import { productsService, categoriesService } from '../services/api';

interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  isQuickAccess?: boolean;
  quickAccessOrder?: number;
  quickAccessColor?: string | null;
  _count?: { products: number };
}

// Colores predefinidos para acceso rápido
const QUICK_ACCESS_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickAccessCategories, setQuickAccessCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'quick-access'>('all');
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesRes, quickAccessRes] = await Promise.all([
        productsService.getCategories(),
        categoriesService.getQuickAccess(),
      ]);
      if (categoriesRes.success) setCategories(categoriesRes.data);
      if (quickAccessRes.success) setQuickAccessCategories(quickAccessRes.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleQuickAccess = async (category: Category) => {
    setSavingId(category.id);
    try {
      const newValue = !category.isQuickAccess;
      await categoriesService.updateQuickAccess(category.id, {
        isQuickAccess: newValue,
        quickAccessColor: newValue ? (category.quickAccessColor || '#3b82f6') : null,
      });
      await loadData();
    } catch (error) {
      console.error('Error toggling quick access:', error);
    } finally {
      setSavingId(null);
    }
  };

  const updateQuickAccessColor = async (categoryId: string, color: string) => {
    setSavingId(categoryId);
    try {
      await categoriesService.updateQuickAccess(categoryId, {
        isQuickAccess: true,
        quickAccessColor: color,
      });
      await loadData();
      setEditingColor(null);
    } catch (error) {
      console.error('Error updating color:', error);
    } finally {
      setSavingId(null);
    }
  };

  const moveQuickAccess = async (categoryId: string, direction: 'up' | 'down') => {
    const currentIndex = quickAccessCategories.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= quickAccessCategories.length) return;

    const newOrder = [...quickAccessCategories];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    setSavingId(categoryId);
    try {
      await categoriesService.reorderQuickAccess(newOrder.map(c => c.id));
      setQuickAccessCategories(newOrder);
    } catch (error) {
      console.error('Error reordering:', error);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500">Organiza tus productos y configura accesos rápidos para el POS</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'all'
              ? 'text-primary-600 border-primary-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Tags className="w-4 h-4" />
            Todas las categorías
          </span>
        </button>
        <button
          onClick={() => setActiveTab('quick-access')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'quick-access'
              ? 'text-primary-600 border-primary-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Acceso Rápido POS
            {quickAccessCategories.length > 0 && (
              <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                {quickAccessCategories.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : activeTab === 'all' ? (
        /* All Categories Tab */
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FolderTree className="w-12 h-12 mb-4" />
              <p>No hay categorías creadas</p>
              <button className="mt-4 btn btn-primary">Crear primera categoría</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Categoría</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Productos</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acceso Rápido</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: category.isQuickAccess && category.quickAccessColor
                                ? `${category.quickAccessColor}20`
                                : '#dcfce7',
                            }}
                          >
                            <Tags
                              className="w-5 h-5"
                              style={{
                                color: category.isQuickAccess && category.quickAccessColor
                                  ? category.quickAccessColor
                                  : '#059669',
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{category.name}</p>
                            {category.description && (
                              <p className="text-sm text-gray-500">{category.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-sm">
                        {category.code || '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">
                        {category._count?.products || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleQuickAccess(category)}
                          disabled={savingId === category.id}
                          className="relative inline-flex items-center"
                          title={category.isQuickAccess ? 'Quitar de acceso rápido' : 'Agregar a acceso rápido'}
                        >
                          {savingId === category.id ? (
                            <div className="w-11 h-6 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            </div>
                          ) : (
                            <>
                              {/* Switch Track */}
                              <div
                                className={`w-11 h-6 rounded-full transition-colors ${
                                  category.isQuickAccess
                                    ? 'bg-amber-500'
                                    : 'bg-gray-300'
                                }`}
                              >
                                {/* Switch Thumb */}
                                <div
                                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center ${
                                    category.isQuickAccess
                                      ? 'translate-x-5'
                                      : 'translate-x-0.5'
                                  }`}
                                >
                                  <Zap className={`w-3 h-3 ${category.isQuickAccess ? 'text-amber-500' : 'text-gray-400'}`} />
                                </div>
                              </div>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            category.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {category.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
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
      ) : (
        /* Quick Access Configuration Tab */
        <div className="space-y-6">
          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex gap-3">
              <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900">Categorías de Acceso Rápido</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Estas categorías aparecerán como botones destacados en el POS para acceso rápido.
                  Ideal para los productos más vendidos o categorías frecuentes.
                </p>
              </div>
            </div>
          </div>

          {quickAccessCategories.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Sin categorías de acceso rápido</h3>
              <p className="text-gray-500 text-sm mb-4">
                Activa el acceso rápido en una categoría desde la pestaña "Todas las categorías"
              </p>
              <button
                onClick={() => setActiveTab('all')}
                className="btn btn-primary"
              >
                Ver todas las categorías
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">Orden y configuración</h3>
                <p className="text-sm text-gray-500">Arrastra para reordenar o usa las flechas</p>
              </div>
              <div className="divide-y">
                {quickAccessCategories.map((category, index) => (
                  <div
                    key={category.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50"
                  >
                    {/* Drag Handle / Order */}
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-5 h-5 text-gray-300" />
                      <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                        {index + 1}
                      </span>
                    </div>

                    {/* Category Info */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
                      style={{
                        borderColor: category.quickAccessColor || '#3b82f6',
                        backgroundColor: `${category.quickAccessColor || '#3b82f6'}15`,
                      }}
                    >
                      <Tags
                        className="w-6 h-6"
                        style={{ color: category.quickAccessColor || '#3b82f6' }}
                      />
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-sm text-gray-500">
                        {category._count?.products || 0} productos
                      </p>
                    </div>

                    {/* Color Picker */}
                    <div className="relative">
                      <button
                        onClick={() => setEditingColor(editingColor === category.id ? null : category.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                      >
                        <div
                          className="w-5 h-5 rounded-full border"
                          style={{ backgroundColor: category.quickAccessColor || '#3b82f6' }}
                        />
                        <Palette className="w-4 h-4 text-gray-400" />
                      </button>

                      {editingColor === category.id && (
                        <div className="absolute right-0 top-full mt-2 p-3 bg-white rounded-xl shadow-lg border z-10">
                          <div className="grid grid-cols-5 gap-2">
                            {QUICK_ACCESS_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => updateQuickAccessColor(category.id, color)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                  category.quickAccessColor === color
                                    ? 'border-gray-900 scale-110'
                                    : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                              >
                                {category.quickAccessColor === color && (
                                  <Check className="w-4 h-4 text-white mx-auto" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Order Buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveQuickAccess(category.id, 'up')}
                        disabled={index === 0 || savingId === category.id}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveQuickAccess(category.id, 'down')}
                        disabled={index === quickAccessCategories.length - 1 || savingId === category.id}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => toggleQuickAccess(category)}
                      disabled={savingId === category.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Quitar de acceso rápido"
                    >
                      {savingId === category.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <X className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {quickAccessCategories.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">Vista previa en POS</h3>
              </div>
              <div className="p-4 bg-gradient-to-r from-primary-50 to-emerald-50">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {quickAccessCategories.map((cat) => (
                    <button
                      key={cat.id}
                      style={{
                        borderColor: cat.quickAccessColor || '#3b82f6',
                        color: cat.quickAccessColor || '#3b82f6',
                      }}
                      className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 bg-white font-medium whitespace-nowrap min-w-[100px]"
                    >
                      <span className="text-sm font-semibold">{cat.name}</span>
                      <span className="text-xs opacity-75">
                        {cat._count?.products || 0} productos
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
