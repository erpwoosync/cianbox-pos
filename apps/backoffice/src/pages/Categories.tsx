import { useState, useEffect } from 'react';
import { categoriesApi, Category } from '../services/api';
import { FolderTree, ChevronRight, RefreshCw, Search } from 'lucide-react';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
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
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : buildTree(categories);

  const CategoryItem = ({ category, level = 0 }: { category: Category; level?: number }) => {
    const [expanded, setExpanded] = useState(level === 0);
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div>
        <div
          className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b ${
            level > 0 ? 'bg-gray-50' : ''
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          {hasChildren ? (
            <ChevronRight
              size={18}
              className={`text-gray-400 transition-transform ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          ) : (
            <div className="w-[18px]" />
          )}
          <FolderTree size={18} className="text-purple-500" />
          <span className="flex-1 font-medium text-gray-700">{category.name}</span>
          <span className="text-sm text-gray-500">
            {category._count?.products || 0} productos
          </span>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              category.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
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
        <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
        <button
          onClick={loadCategories}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
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

        {/* Categories list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se encontraron categorías
          </div>
        ) : search ? (
          // Flat list when searching
          <div>
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b"
              >
                <FolderTree size={18} className="text-purple-500" />
                <span className="flex-1 font-medium text-gray-700">{category.name}</span>
                {category.parentId && (
                  <span className="text-sm text-gray-400">
                    (subcategoría)
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {category._count?.products || 0} productos
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
      </div>

      <div className="text-sm text-gray-500">
        Total: {categories.length} categorías
      </div>
    </div>
  );
}
