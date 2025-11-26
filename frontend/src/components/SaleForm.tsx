import { useState, useEffect } from 'react';
import { salesApi, saleItemsApi, productsApi, customersApi } from '../api/client';
import type { Sale, Product, Customer } from '../types';
import { Plus, Trash2, DollarSign, TrendingUp } from 'lucide-react';
import CustomerSelector from './CustomerSelector';

interface SaleFormProps {
  editMode?: boolean;
  saleData?: Sale;
  onSuccess: () => void;
  onCancel: () => void;
}

interface SaleItemInput {
  product: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_price: number;
  total_cost: number;
  profit: number;
  available_stock: number;
}

export default function SaleForm({ editMode = false, saleData, onSuccess, onCancel }: SaleFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    customer: null as number | null,
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    sale_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [items, setItems] = useState<SaleItemInput[]>([
    {
      product: null,
      product_name: '',
      quantity: 1,
      unit_price: 0,
      unit_cost: 0,
      total_price: 0,
      total_cost: 0,
      profit: 0,
      available_stock: 0,
    },
  ]);
  const [manualCustomerEntry, setManualCustomerEntry] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (editMode && saleData) {
      loadSaleData();
    }
  }, [editMode, saleData]);

  const fetchProducts = async () => {
    try {
      const response = await productsApi.getAll();
      setProducts((response.data as any).results || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const loadSaleData = async () => {
    if (!saleData) return;

    // Determine if using linked customer or manual entry
    const useManualEntry = saleData.customer === null;

    setFormData({
      customer: saleData.customer,
      customer_name: saleData.customer_name,
      customer_phone: saleData.customer_phone,
      customer_email: saleData.customer_email,
      sale_date: saleData.sale_date,
      notes: saleData.notes,
    });

    setManualCustomerEntry(useManualEntry);

    if (saleData.items && saleData.items.length > 0) {
      const loadedItems = saleData.items.map((item) => {
        const product = products.find((p) => p.id === item.product);
        return {
          product: item.product,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_cost: item.unit_cost,
          total_price: item.total_price,
          total_cost: item.total_cost,
          profit: item.profit,
          available_stock: product?.current_stock || 0,
        };
      });
      setItems(loadedItems);
    }
  };

  const handleProductChange = (index: number, productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product: productId,
      product_name: product.product_name,
      unit_price: product.current_price,
      unit_cost: product.average_cost_gtq,
      available_stock: product.current_stock,
    };

    recalculateItem(newItems, index);
    setItems(newItems);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    recalculateItem(newItems, index);
    setItems(newItems);
  };

  const handlePriceChange = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index].unit_price = price;
    recalculateItem(newItems, index);
    setItems(newItems);
  };

  const recalculateItem = (items: SaleItemInput[], index: number) => {
    const item = items[index];
    item.total_price = item.quantity * item.unit_price;
    item.total_cost = item.quantity * item.unit_cost;
    item.profit = item.total_price - item.total_cost;
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        product: null,
        product_name: '',
        quantity: 1,
        unit_price: 0,
        unit_cost: 0,
        total_price: 0,
        total_cost: 0,
        profit: 0,
        available_stock: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      alert('Cannot remove the last item');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const total_revenue = items.reduce((sum, item) => sum + item.total_price, 0);
    const total_cost = items.reduce((sum, item) => sum + item.total_cost, 0);
    const profit = total_revenue - total_cost;
    return { total_revenue, total_cost, profit };
  };

  const validateForm = () => {
    // Require a saved customer (either selected or newly saved via CustomerSelector)
    if (!formData.customer) {
      alert('Please select a customer or save the new customer first');
      return false;
    }

    // Validate items
    if (items.length === 0) {
      alert('Please add at least one product');
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.product) {
        alert(`Please select a product for item #${i + 1}`);
        return false;
      }

      if (item.quantity <= 0) {
        alert(`Please enter a valid quantity for item #${i + 1}`);
        return false;
      }

      if (item.quantity > item.available_stock) {
        alert(
          `Insufficient stock for ${item.product_name}. Available: ${item.available_stock}, Requested: ${item.quantity}`
        );
        return false;
      }

      if (item.unit_price <= 0) {
        alert(`Please enter a valid unit price for item #${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare sale data - customer is always saved first via CustomerSelector
      const salePayload = {
        customer: formData.customer,
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        sale_date: formData.sale_date,
        status: 'pending' as const,
        notes: formData.notes,
      };

      let saleId: number;

      if (editMode && saleData) {
        // Update existing sale
        await salesApi.update(saleData.id, salePayload);
        saleId = saleData.id;

        // Delete old items
        if (saleData.items) {
          for (const item of saleData.items) {
            await saleItemsApi.delete(item.id);
          }
        }
      } else {
        // Create new sale
        const response = await salesApi.create(salePayload);
        saleId = response.data.id;
      }

      // Create sale items
      for (const item of items) {
        await saleItemsApi.create({
          sale: saleId,
          product: item.product!,
          quantity: item.quantity,
          unit_price: item.unit_price,
          // unit_cost will be auto-calculated by backend using FIFO
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving sale:', error);
      const errorMsg = error.response?.data?.error || 'Failed to save sale';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
        <CustomerSelector
          selectedCustomerId={formData.customer}
          onCustomerSelect={(customerId) =>
            setFormData({ ...formData, customer: customerId })
          }
          manualEntry={manualCustomerEntry}
          onManualEntryToggle={setManualCustomerEntry}
          manualCustomerData={{
            name: formData.customer_name,
            phone: formData.customer_phone,
            email: formData.customer_email,
          }}
          onManualCustomerChange={(data) =>
            setFormData({
              ...formData,
              customer_name: data.name,
              customer_phone: data.phone,
              customer_email: data.email,
            })
          }
        />
      </div>

      {/* Sale Details */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Sale Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sale Date *
            </label>
            <input
              type="date"
              required
              value={formData.sale_date}
              onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={1}
              placeholder="Optional notes"
            />
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Products</h3>
          <button
            type="button"
            onClick={addItem}
            className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 flex items-center"
          >
            <Plus size={16} className="mr-1" />
            Add Product
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Product *
                  </label>
                  <select
                    value={item.product || ''}
                    onChange={(e) => handleProductChange(index, Number(e.target.value))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_name} - {product.brand_name} (Stock: {product.current_stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {item.product && item.quantity > item.available_stock && (
                    <p className="text-xs text-red-600 mt-1">
                      Only {item.available_stock} in stock!
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Price (GTQ) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={item.unit_price}
                    onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Q0.00"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Cost (GTQ)
                  </label>
                  <input
                    type="number"
                    value={item.unit_cost}
                    disabled
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg bg-gray-50"
                    placeholder="Auto"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Profit (GTQ)
                  </label>
                  <div className={`text-sm font-semibold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Q{item.profit.toFixed(2)}
                  </div>
                </div>

                <div className="col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-800 p-1"
                    disabled={items.length === 1}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border-2 border-blue-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <DollarSign size={20} className="mr-2" />
          Sale Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Revenue (GTQ)</p>
            <p className="text-2xl font-bold text-blue-600">Q{totals.total_revenue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Cost (GTQ)</p>
            <p className="text-2xl font-bold text-gray-700">Q{totals.total_cost.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600 mb-1 flex items-center">
              <TrendingUp size={16} className="mr-1" />
              Profit (GTQ)
            </p>
            <p className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Q{totals.profit.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : editMode ? 'Update Sale' : 'Create Sale'}
        </button>
      </div>
    </form>
  );
}
