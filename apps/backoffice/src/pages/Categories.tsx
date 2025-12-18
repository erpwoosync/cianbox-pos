import { useState, useEffect } from 'react';
import { categoriesApi, Category } from '../services/api';
import {
  FolderTree,
  ChevronRight,
  RefreshCw,
  Search,
  Zap,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Palette,
  GripVertical,
  Loader2,
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'quick-access'>('all');
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesData, quickAccessData] = await Promise.all([
        categoriesApi.getAll(),
        categoriesApi.getQuickAccess(),
      ]);
      setCategories(categoriesData);
      setQuickAccessCategories(quickAccessData);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleQuickAccess = async (category: Category) => {
    setSavingId(category.id);
    try {
      const newValue = !category.isQuickAccess;
      await categoriesApi.updateQuickAccess(category.id, {
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
      await categoriesApi.updateQuickAccess(categoryId, {
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
    const currentIndex = quickAccessCategories.findIndex((c) => c.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= quickAccessCategories.length) return;

    const newOrder = [...quickAccessCategories];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    setSavingId(categoryId);
    try {
      await categoriesApi.reorderQuickAccess(newOrder.map((c) => c.id));
      setQuickAccessCategories(newOrder);
    } catch (error) {
      console.error('Error reordering:', error);
    } finally {
      setSavingId(null);
    }
  };

  // Organizar categorías en árbol
  const buildTree = (items: Category[], parentId: string | null = null): Category[] => {
    return items
      .filter((item) => item.parentId === parentId)
      .map((item) => ({
        ...item,
        children: buildTree(items, item.id),
      }));
  };

  const filteredCategories = search
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : buildTree(categories);

  const CategoryItem = ({ category, level = 0 }: { category: Category; level?: number }) => {
    const [expanded, setExpanded] = useState(level === 0);
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div>
        <div
          className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b ${
            level > 0 ? 'bg-gray-50' : ''
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }}
        >
          <div
            className="cursor-pointer"
            onClick={() => hasChildren && setExpanded(!expanded)}
          >
            {hasChildren ? (
              <ChevronRight
                size={18}
                className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            ) : (
              <div className="w-[18px]" />
            )}
          </div>
          <FolderTree size={18} className="text-purple-500" />
          <span className="flex-1 font-medium text-gray-700">{category.name}</span>
          <span className="text-sm text-gray-500">{category._count?.products || 0} productos</span>

          {/* Quick Access Toggle */}
          <button
            onClick={() => toggleQuickAccess(category)}
            disabled={savingId === category.id}
            className="inline-flex items-center justify-center"
            title={category.isQuickAccess ? 'Quitar de acceso rápido' : 'Agregar a acceso rápido'}
          >
            {savingId === category.id ? (
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            ) : (
              <div
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  category.isQuickAccess ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 flex items-center justify-center ${
                    category.isQuickAccess ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  <Zap
                    className={`w-3 h-3 ${category.isQuickAccess ? 'text-amber-500' : 'text-gray-400'}`}
                  />
                </div>
              </div>
            )}
          </button>

          <span
            className={`px-2 py-1 text-xs rounded-full ${
              category.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {category.isActive ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        {expanded && hasChildren && (
          <div>
            {category.children!.map((child) => (
              <CategoryItem key={child.id} category={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500 text-sm">
            Organiza tus productos y configura accesos rápidos para el POS
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'all'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <FolderTree size={18} />
            Todas las categorías
          </span>
        </button>
        <button
          onClick={() => setActiveTab('quick-access')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'quick-access'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Zap size={18} />
            Acceso Rápido POS
            {quickAccessCategories.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                {quickAccessCategories.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : activeTab === 'all' ? (
        /* All Categories Tab */
        <div className="bg-white rounded-xl shadow-sm">
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600">
            <div className="w-[18px]" />
            <div className="w-[18px]" />
            <span className="flex-1">Categoría</span>
            <span className="w-24 text-center">Productos</span>
            <span className="w-24 text-center">POS Rápido</span>
            <span className="w-20 text-center">Estado</span>
          </div>

          {/* Categories list */}
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No se encontraron categorías</div>
          ) : search ? (
            // Flat list when searching
            <div>
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b"
                >
                  <div className="w-[18px]" />
                  <FolderTree size={18} className="text-purple-500" />
                  <span className="flex-1 font-medium text-gray-700">{category.name}</span>
                  {category.parentId && (
                    <span className="text-sm text-gray-400">(subcategoría)</span>
                  )}
                  <span className="w-24 text-center text-sm text-gray-500">
                    {category._count?.products || 0}
                  </span>
                  <div className="w-24 flex justify-center">
                    <button
                      onClick={() => toggleQuickAccess(category)}
                      disabled={savingId === category.id}
                      className="inline-flex items-center justify-center"
                    >
                      {savingId === category.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                      ) : (
                        <div
                          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                            category.isQuickAccess ? 'bg-amber-500' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 flex items-center justify-center ${
                              category.isQuickAccess ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          >
                            <Zap
                              className={`w-3 h-3 ${
                                category.isQuickAccess ? 'text-amber-500' : 'text-gray-400'
                              }`}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                  <span
                    className={`w-20 text-center px-2 py-1 text-xs rounded-full ${
                      category.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {category.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            // Tree view
            <div>
              {(filteredCategories as Category[]).map((category) => (
                <CategoryItem key={category.id} category={category} />
              ))}
            </div>
          )}

          <div className="p-4 text-sm text-gray-500 border-t">
            Total: {categories.length} categorías
          </div>
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
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Sin categorías de acceso rápido</h3>
              <p className="text-gray-500 text-sm mb-4">
                Activa el acceso rápido en una categoría usando el switch en la pestaña "Todas las
                categorías"
              </p>
              <button onClick={() => setActiveTab('all')} className="btn btn-primary">
                Ver todas las categorías
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">Orden y configuración</h3>
                <p className="text-sm text-gray-500">Configura el color y el orden de cada categoría</p>
              </div>
              <div className="divide-y">
                {quickAccessCategories.map((category, index) => (
                  <div key={category.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
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
                      <FolderTree
                        className="w-6 h-6"
                        style={{ color: category.quickAccessColor || '#3b82f6' }}
                      />
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-sm text-gray-500">{category._count?.products || 0} productos</p>
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
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">Vista previa en POS</h3>
                <p className="text-sm text-gray-500">Así se verán los botones de acceso rápido</p>
              </div>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {quickAccessCategories.map((cat) => (
                    <button
                      key={cat.id}
                      style={{
                        borderColor: cat.quickAccessColor || '#3b82f6',
                        color: cat.quickAccessColor || '#3b82f6',
                      }}
                      className="flex items-center justify-center px-5 py-3 rounded-xl border-2 bg-white font-semibold whitespace-nowrap min-w-[100px]"
                    >
                      {cat.name}
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
