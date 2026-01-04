import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Filter,
  Download,
  Upload,
} from 'lucide-react';
import { productsService } from '../services/api';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category?: { id: string; name: string };
  brand?: { id: string; name: string };
  basePrice: number;
  taxRate: number;
  trackStock: boolean;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productsService.list({ pageSize: 50 }),
        productsService.getCategories(),
      ]);

      if (productsRes.success) {
        setProducts(productsRes.data);
      }
      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Memoizar filtrado para evitar recálculos innecesarios
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === '' || product.category?.id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500">Gestiona el catálogo de productos</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button className="btn btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none bg-white"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Package className="w-12 h-12 mb-4" />
            <p>No se encontraron productos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Producto
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    SKU
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Categoría
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Precio
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
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {product.barcode}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{product.sku}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {product.category?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      ${product.basePrice?.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          product.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {product.isActive ? 'Activo' : 'Inactivo'}
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

      {/* Pagination info */}
      <div className="text-sm text-gray-500 text-center">
        Mostrando {filteredProducts.length} de {products.length} productos
      </div>
    </div>
  );
}
