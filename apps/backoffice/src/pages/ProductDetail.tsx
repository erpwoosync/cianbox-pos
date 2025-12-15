import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productsApi, pricesApi, stockApi, Product, ProductPrice, ProductStock } from '../services/api';
import { Package, ArrowLeft, RefreshCw, DollarSign, Warehouse, Tag, FolderTree } from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const [productData, pricesData, stockData] = await Promise.all([
        productsApi.getById(id!),
        pricesApi.getByProduct(id!),
        stockApi.getByProduct(id!),
      ]);
      setProduct(productData);
      setPrices(pricesData);
      setStock(stockData);
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Producto no encontrado</p>
        <Link to="/products" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a productos
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'info', label: 'Información', icon: Package },
    { id: 'prices', label: 'Precios', icon: DollarSign },
    { id: 'stock', label: 'Stock', icon: Warehouse },
  ];

  return (
    <div>
      <Link
        to="/products"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Volver a productos
      </Link>

      <div className="bg-white rounded-xl shadow-sm">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
              <Package size={32} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>SKU: {product.sku}</span>
                {product.barcode && <span>Código: {product.barcode}</span>}
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    product.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {product.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre corto</label>
                  <p className="mt-1 text-gray-900">{product.shortName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Descripción</label>
                  <p className="mt-1 text-gray-900">{product.description || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Unidad</label>
                  <p className="mt-1 text-gray-900">{product.unit || 'UN'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                  <FolderTree className="text-purple-600" size={20} />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Categoría</label>
                    <p className="text-gray-900">{product.category?.name || 'Sin categoría'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg">
                  <Tag className="text-indigo-600" size={20} />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Marca</label>
                    <p className="text-gray-900">{product.brand?.name || 'Sin marca'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prices' && (
            <div>
              {prices.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay precios configurados para este producto
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Lista de Precios
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prices.map((price) => (
                        <tr key={price.id}>
                          <td className="px-4 py-3 text-gray-900">
                            {price.priceList?.name || 'Lista ' + price.priceListId}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            ${price.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stock' && (
            <div>
              {stock.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay stock registrado para este producto
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Sucursal
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Reservado
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Disponible
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stock.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-3 text-gray-900">
                            {s.branch?.name || 'Sucursal ' + s.branchId}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900">{s.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{s.reserved}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            <span
                              className={
                                s.available <= 0
                                  ? 'text-red-600'
                                  : s.available < 10
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                              }
                            >
                              {s.available}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Total</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {stock.reduce((sum, s) => sum + s.quantity, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-500">
                          {stock.reduce((sum, s) => sum + s.reserved, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {stock.reduce((sum, s) => sum + s.available, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
