import { useEffect, useState } from 'react';
import { productsApi } from '../api/client';
import type { Product } from '../types';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import Modal from '../components/Modal';
import ProductForm from '../components/ProductForm';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProductIds, setEditingProductIds] = useState<Set<number>>(new Set());
  const [editedPrices, setEditedPrices] = useState<Map<number, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await productsApi.getAll();
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDoubleClick = (product: Product) => {
    const newEditingIds = new Set(editingProductIds);
    newEditingIds.add(product.id);
    setEditingProductIds(newEditingIds);

    // Initialize with current price if not already set
    if (!editedPrices.has(product.id)) {
      const newPrices = new Map(editedPrices);
      newPrices.set(product.id, product.current_price);
      setEditedPrices(newPrices);
    }
  };

  const handlePriceChange = (productId: number, newPrice: number) => {
    const newPrices = new Map(editedPrices);
    newPrices.set(productId, newPrice);
    setEditedPrices(newPrices);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save all edited products
      const savePromises = Array.from(editedPrices.entries()).map(([productId, newPrice]) => {
        return productsApi.update(productId, { current_price: newPrice });
      });

      await Promise.all(savePromises);

      // Exit edit mode and clear edited prices
      setEditingProductIds(new Set());
      setEditedPrices(new Map());

      // Refresh product list
      await fetchProducts();

      alert(`Successfully updated ${savePromises.length} product price(s)`);
    } catch (error: any) {
      console.error('Error saving prices:', error);
      alert('Failed to save some prices. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, productId: number) => {
    if (e.key === 'Escape') {
      // Cancel editing for this product
      const newEditingIds = new Set(editingProductIds);
      newEditingIds.delete(productId);
      setEditingProductIds(newEditingIds);

      const newPrices = new Map(editedPrices);
      newPrices.delete(productId);
      setEditedPrices(newPrices);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleProductSuccess = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await productsApi.delete(id);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product. It may be referenced by purchases or sales.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-xl">Loading...</div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Products</h1>
        <div className="flex space-x-3">
          {editingProductIds.size > 0 && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-600 disabled:bg-gray-400"
            >
              <Save className="mr-2" size={20} />
              {saving ? 'Saving...' : `Save ${editingProductIds.size} Change${editingProductIds.size > 1 ? 's' : ''}`}
            </button>
          )}
          <button
            onClick={handleAddProduct}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-600"
          >
            <Plus className="mr-2" size={20} />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (GTQ)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount/Serving</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serving Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units/Container</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (g)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.product_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.brand_name || '-'}</td>
                <td
                  onDoubleClick={() => handleDoubleClick(product)}
                  className={`px-6 py-4 whitespace-nowrap text-sm ${
                    editingProductIds.has(product.id) ? 'bg-blue-50' : 'cursor-pointer hover:bg-gray-50'
                  }`}
                  title="Double-click to edit price"
                >
                  {editingProductIds.has(product.id) ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editedPrices.get(product.id) || 0}
                      onChange={(e) => handlePriceChange(product.id, parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => handleKeyDown(e, product.id)}
                      autoFocus
                      className="w-32 px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:border-blue-600"
                    />
                  ) : (
                    <span className="font-semibold text-green-600">
                      Q{product.current_price ? product.current_price.toFixed(2) : '0.00'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.amount_per_serving || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.serving_size || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.units_per_container || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.weight_g || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.current_stock} {product.unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {product.is_low_stock ? (
                    <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Low Stock</span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">In Stock</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-8 text-gray-500">No products found. Add your first product!</div>
        )}
      </div>

      {/* Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        maxWidth="2xl"
      >
        <ProductForm
          editMode={!!editingProduct}
          productData={editingProduct || undefined}
          onSuccess={handleProductSuccess}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingProduct(null);
          }}
        />
      </Modal>
    </div>
  );
}
