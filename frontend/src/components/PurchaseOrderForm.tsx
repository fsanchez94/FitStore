import { useState, type FormEvent, useEffect } from 'react';
import { purchasesApi, purchaseItemsApi, productsApi } from '../api/client';
import type { Product, Purchase } from '../types';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import ProductForm from './ProductForm';

interface ProductRow {
  itemId?: number;  // For tracking existing items in edit mode
  product: number | '';
  quantity: number;
  unit_cost: number;
  discount: number;
}

interface PurchaseOrderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editMode?: boolean;
  purchaseData?: Purchase;
}

export default function PurchaseOrderForm({ onSuccess, onCancel, editMode = false, purchaseData }: PurchaseOrderFormProps) {
  const [formData, setFormData] = useState({
    order_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    weight_lb: 0,
    estimated_shipping: 0,
    estimated_taxes: 0,
    real_shipping: null as number | null,
    real_taxes: null as number | null,
    notes: '',
  });

  const [productRows, setProductRows] = useState<ProductRow[]>([
    { product: '', quantity: 1, unit_cost: 0, discount: 0 }
  ]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [originalItemIds, setOriginalItemIds] = useState<number[]>([]);  // Track original items for deletion
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [pendingProductRowIndex, setPendingProductRowIndex] = useState<number | null>(null);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productsApi.getAll();
        setProducts((response.data as any).results || response.data);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products');
      }
    };
    fetchProducts();
  }, []);

  // Populate form data when in edit mode
  useEffect(() => {
    if (editMode && purchaseData) {
      try {
        setFormData({
          order_id: purchaseData.order_id || '',
          purchase_date: purchaseData.purchase_date || new Date().toISOString().split('T')[0],
          delivery_date: purchaseData.delivery_date || '',
          weight_lb: purchaseData.weight_lb || 0,
          estimated_shipping: purchaseData.estimated_shipping || 0,
          estimated_taxes: purchaseData.estimated_taxes || 0,
          real_shipping: purchaseData.real_shipping ?? null,
          real_taxes: purchaseData.real_taxes ?? null,
          notes: purchaseData.notes || '',
        });

        // Convert existing items to product rows
        if (purchaseData.items && Array.isArray(purchaseData.items)) {
          const rows: ProductRow[] = purchaseData.items.map(item => ({
            itemId: item.id,
            product: item.product,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            discount: item.discount || 0,
          }));
          setProductRows(rows.length > 0 ? rows : [{ product: '', quantity: 1, unit_cost: 0, discount: 0 }]);

          // Track original item IDs
          setOriginalItemIds(purchaseData.items.map(item => item.id));
        } else {
          setProductRows([{ product: '', quantity: 1, unit_cost: 0, discount: 0 }]);
          setOriginalItemIds([]);
        }
      } catch (err) {
        console.error('Error loading purchase data:', err);
        setError('Failed to load purchase data');
      }
    }
  }, [editMode, purchaseData]);

  const addProductRow = () => {
    setProductRows([...productRows, { product: '', quantity: 1, unit_cost: 0, discount: 0 }]);
  };

  const removeProductRow = (index: number) => {
    if (productRows.length > 1) {
      setProductRows(productRows.filter((_, i) => i !== index));
    }
  };

  const updateProductRow = (index: number, field: keyof ProductRow, value: number | string) => {
    const newRows = [...productRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setProductRows(newRows);
  };

  const handleProductSelectChange = (index: number, value: string) => {
    if (value === 'add_new') {
      setPendingProductRowIndex(index);
      setIsProductModalOpen(true);
    } else {
      updateProductRow(index, 'product', parseInt(value));
    }
  };

  const handleNewProductSuccess = async (newProduct: Product) => {
    // Refresh products list
    try {
      const response = await productsApi.getAll();
      setProducts((response.data as any).results || response.data);
    } catch (err) {
      console.error('Error refreshing products:', err);
    }

    // Auto-select the new product in the pending row
    if (pendingProductRowIndex !== null) {
      updateProductRow(pendingProductRowIndex, 'product', newProduct.id);
    }

    setIsProductModalOpen(false);
    setPendingProductRowIndex(null);
  };

  // Calculate totals
  const productCost = productRows.reduce((sum, row) => {
    if (row.product && row.quantity && row.unit_cost) {
      return sum + ((row.quantity * row.unit_cost) - (row.discount || 0));
    }
    return sum;
  }, 0);

  const estimatedLogisticCost = (Number(formData.estimated_shipping) || 0) + (Number(formData.estimated_taxes) || 0);
  const estimatedTotal = productCost + estimatedLogisticCost;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.order_id.trim()) {
      setError('Order ID is required');
      return;
    }

    if (!formData.purchase_date) {
      setError('Purchase date is required');
      return;
    }

    // Validate at least one product is selected
    const validRows = productRows.filter(row => row.product && row.quantity > 0);
    if (validRows.length === 0) {
      setError('Please add at least one product');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editMode && purchaseData) {
        // EDIT MODE: Update existing purchase
        await purchasesApi.update(purchaseData.id, {
          order_id: formData.order_id,
          purchase_date: formData.purchase_date,
          delivery_date: formData.delivery_date || null,
          weight_lb: formData.weight_lb,
          estimated_shipping: formData.estimated_shipping,
          estimated_taxes: formData.estimated_taxes,
          real_shipping: formData.real_shipping,
          real_taxes: formData.real_taxes,
          notes: formData.notes,
        });

        const purchaseId = purchaseData.id;

        // Identify item changes
        const currentItemIds = validRows.filter(row => row.itemId).map(row => row.itemId as number);
        const deletedItemIds = originalItemIds.filter(id => !currentItemIds.includes(id));
        const newItems = validRows.filter(row => !row.itemId);
        const updatedItems = validRows.filter(row => row.itemId);

        // Delete removed items
        await Promise.all(deletedItemIds.map(id => purchaseItemsApi.delete(id)));

        // Update existing items
        await Promise.all(
          updatedItems.map(row =>
            purchaseItemsApi.update(row.itemId as number, {
              purchase: purchaseId,
              product: row.product as number,
              quantity: row.quantity,
              unit_cost: row.unit_cost,
              discount: row.discount || 0,
            })
          )
        );

        // Create new items
        await Promise.all(
          newItems.map(row =>
            purchaseItemsApi.create({
              purchase: purchaseId,
              product: row.product as number,
              quantity: row.quantity,
              unit_cost: row.unit_cost,
              discount: row.discount || 0,
            })
          )
        );
      } else {
        // CREATE MODE: Create new purchase
        const purchaseResponse = await purchasesApi.create({
          order_id: formData.order_id,
          purchase_date: formData.purchase_date,
          delivery_date: formData.delivery_date || null,
          weight_lb: formData.weight_lb,
          estimated_shipping: formData.estimated_shipping,
          estimated_taxes: formData.estimated_taxes,
          real_shipping: formData.real_shipping,
          real_taxes: formData.real_taxes,
          notes: formData.notes,
          status: 'pending',
        });

        const purchaseId = purchaseResponse.data.id;

        // Create purchase items
        await Promise.all(
          validRows.map(row =>
            purchaseItemsApi.create({
              purchase: purchaseId,
              product: row.product as number,
              quantity: row.quantity,
              unit_cost: row.unit_cost,
              discount: row.discount || 0,
            })
          )
        );
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${editMode ? 'update' : 'create'} purchase order`);
      console.error(`Error ${editMode ? 'updating' : 'creating'} purchase order:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Warning for received purchases */}
      {editMode && purchaseData?.status === 'received' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">This purchase has been received</p>
            <p className="text-xs mt-1">Editing items (products/quantities) won't automatically adjust inventory. You may need to create manual inventory adjustments.</p>
          </div>
        </div>
      )}

      {/* Purchase Details Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Purchase Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.order_id}
              onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Amazon order number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight (lbs)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.weight_lb}
              onChange={(e) => setFormData({ ...formData, weight_lb: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Date
            </label>
            <input
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Shipping ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.estimated_shipping}
              onChange={(e) => setFormData({ ...formData, estimated_shipping: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Taxes ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.estimated_taxes}
              onChange={(e) => setFormData({ ...formData, estimated_taxes: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Real Logistics (Invoice)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Real Shipping ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.real_shipping ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  real_shipping: e.target.value === '' ? null : parseFloat(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty if not available"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Real Taxes ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.real_taxes ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  real_taxes: e.target.value === '' ? null : parseFloat(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty if not available"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Additional notes..."
          />
        </div>
      </div>

      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Products</h3>
          <button
            type="button"
            onClick={addProductRow}
            className="flex items-center space-x-1 text-blue-500 hover:text-blue-600 text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Column Headers */}
        <div className="flex items-center space-x-3 px-1">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-600">Product</span>
          </div>
          <div className="w-24">
            <span className="text-xs font-medium text-gray-600">Qty</span>
          </div>
          <div className="w-32">
            <span className="text-xs font-medium text-gray-600">Unit Cost</span>
          </div>
          <div className="w-28">
            <span className="text-xs font-medium text-gray-600">Discount</span>
          </div>
          <div className="w-40">
            <span className="text-xs font-medium text-gray-600">Total</span>
          </div>
          <div className="w-10">
            {/* Space for delete button */}
          </div>
        </div>

        <div className="space-y-3">
          {productRows.map((row, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <select
                  value={row.product}
                  onChange={(e) => handleProductSelectChange(index, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Product</option>
                  <option value="add_new" className="text-blue-600 font-medium">+ Add New Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_name} - {product.brand_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateProductRow(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Qty"
                  required
                />
              </div>

              <div className="w-32">
                <input
                  type="number"
                  step="0.01"
                  value={row.unit_cost}
                  onChange={(e) => updateProductRow(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Unit Cost"
                  required
                />
              </div>

              <div className="w-28">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={row.quantity * row.unit_cost}
                  value={Number(row.discount) || 0}
                  onChange={(e) => {
                    const discount = parseFloat(e.target.value) || 0;
                    const maxDiscount = row.quantity * row.unit_cost;
                    updateProductRow(index, 'discount', Math.min(discount, maxDiscount));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Discount"
                />
              </div>

              <div className="w-40 px-3 py-2 text-gray-700 font-medium text-sm">
                {(Number(row.discount) || 0) > 0 ? (
                  <span>
                    ${(row.quantity * row.unit_cost).toFixed(2)} - ${(Number(row.discount) || 0).toFixed(2)} = ${((row.quantity * row.unit_cost) - (Number(row.discount) || 0)).toFixed(2)}
                  </span>
                ) : (
                  <span>${(row.quantity * row.unit_cost).toFixed(2)}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeProductRow(index)}
                className="p-2 text-red-500 hover:text-red-600 disabled:text-gray-300"
                disabled={productRows.length === 1}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Section */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Product Cost:</span>
          <span className="font-medium">${productCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Estimated Logistics:</span>
          <span className="font-medium">${estimatedLogisticCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
          <span>Estimated Total:</span>
          <span className="text-blue-600">${estimatedTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
          disabled={loading}
        >
          {loading
            ? (editMode ? 'Updating...' : 'Creating...')
            : (editMode ? 'Update Purchase Order' : 'Create Purchase Order')
          }
        </button>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setPendingProductRowIndex(null);
        }}
        title="Add New Product"
        maxWidth="2xl"
      >
        <ProductForm
          onSuccess={handleNewProductSuccess}
          onCancel={() => {
            setIsProductModalOpen(false);
            setPendingProductRowIndex(null);
          }}
        />
      </Modal>
    </form>
  );
}
