import { useEffect, useState } from 'react';
import { salesApi } from '../api/client';
import type { Sale } from '../types';
import { Plus, Edit, Trash2, ShoppingBag, DollarSign, TrendingUp, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal';
import SaleForm from '../components/SaleForm';

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [completedSaleInfo, setCompletedSaleInfo] = useState<{
    id: number;
    customerName: string;
    revenue: number;
    profit: number;
  } | null>(null);
  const [expandedSales, setExpandedSales] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedSales(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await salesApi.getAll();
      setSales(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sale?')) return;

    try {
      await salesApi.delete(id);
      fetchSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Failed to delete sale');
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    setEditingSale(null);
    fetchSales();
  };

  const handleEdit = async (sale: Sale) => {
    try {
      const response = await salesApi.get(sale.id);
      setEditingSale(response.data);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      alert('Failed to load sale details');
    }
  };

  const handleMarkAsCompleted = async (sale: Sale) => {
    if (!confirm(`Mark sale #${sale.id} as completed?`)) return;

    try {
      await salesApi.update(sale.id, { status: 'completed' });

      // Store sale info for confirmation dialog
      setCompletedSaleInfo({
        id: sale.id,
        customerName: sale.display_customer_name,
        revenue: sale.total_revenue,
        profit: sale.profit,
      });

      // Show confirmation dialog
      setConfirmationDialogOpen(true);

      // Refresh sales list
      fetchSales();
    } catch (error) {
      console.error('Error marking sale as completed:', error);
      alert('Failed to mark sale as completed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-xl">Loading...</div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Sales</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-600"
        >
          <Plus className="mr-2" size={20} />
          New Sale
        </button>
      </div>

      {/* Sales List */}
      <div className="space-y-4">
        {sales.map((sale) => (
          <div key={sale.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <ShoppingBag className="text-gray-400" size={24} />
                <div>
                  <h3 className="font-bold text-lg">Sale #{sale.id}</h3>
                  <p className="text-sm text-gray-600">
                    {sale.display_customer_name} • {new Date(sale.sale_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleExpand(sale.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {expandedSales.has(sale.id) ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(sale.status)}`}>
                  {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                </span>
                {sale.status === 'pending' && (
                  <button
                    onClick={() => handleMarkAsCompleted(sale)}
                    className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-green-600 flex items-center"
                  >
                    <CheckCircle size={16} className="mr-1" />
                    Mark as Completed
                  </button>
                )}
                <button
                  onClick={() => handleEdit(sale)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(sale.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Summary Row */}
            <div className="px-6 py-4 bg-white grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-lg font-semibold text-blue-600">${sale.total_revenue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cost</p>
                <p className="text-lg font-semibold">${sale.total_cost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Profit</p>
                <p className={`text-xl font-bold ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${sale.profit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Items</p>
                <p className="text-lg font-semibold">{sale.items.length}</p>
              </div>
            </div>

            {/* Details (Collapsible) */}
            {expandedSales.has(sale.id) && (
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column - Products */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center">
                      <ShoppingBag size={16} className="mr-2" />
                      Products ({sale.items.length})
                    </h4>
                    <div className="bg-white rounded border overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sale.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm">{item.product_name}</td>
                              <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-right">${item.unit_price.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm text-right font-medium">
                                ${item.total_price.toFixed(2)}
                              </td>
                              <td className={`px-4 py-2 text-sm text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${item.profit.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan={3} className="px-4 py-2 text-sm text-right">Total:</td>
                            <td className="px-4 py-2 text-sm text-right text-blue-600">
                              ${sale.total_revenue.toFixed(2)}
                            </td>
                            <td className={`px-4 py-2 text-sm text-right ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${sale.profit.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column - Customer & Financial Info */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center">
                      <DollarSign size={16} className="mr-2" />
                      Customer & Financial Details
                    </h4>
                    <div className="space-y-4">
                      {/* Customer Info */}
                      <div className="bg-white rounded border p-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Customer Information</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Name:</span>
                            <span className="font-medium">{sale.display_customer_name}</span>
                          </div>
                          {sale.display_customer_phone && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Phone:</span>
                              <span className="font-medium">{sale.display_customer_phone}</span>
                            </div>
                          )}
                          {sale.display_customer_email && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Email:</span>
                              <span className="font-medium">{sale.display_customer_email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="bg-green-50 rounded border border-green-200 p-4">
                        <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                          <TrendingUp size={14} className="mr-1" />
                          Profit Analysis
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Revenue:</span>
                            <span className="font-medium text-blue-600">${sale.total_revenue.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Cost (FIFO):</span>
                            <span className="font-medium text-gray-700">${sale.total_cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-green-200">
                            <span className="font-semibold text-gray-700">Net Profit:</span>
                            <span className={`font-bold ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${sale.profit.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs pt-2">
                            <span className="text-gray-500">Profit Margin:</span>
                            <span className={`font-medium ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {sale.total_revenue > 0 ? ((sale.profit / sale.total_revenue) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Additional Info */}
                      {sale.notes && (
                        <div className="bg-gray-100 rounded p-4 text-sm">
                          <span className="text-gray-600 font-medium">Notes:</span>
                          <p className="mt-1 text-gray-800">{sale.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {sales.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <ShoppingBag className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sales</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first sale</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              <Plus className="inline mr-2" size={16} />
              New Sale
            </button>
          </div>
        )}
      </div>

      {/* Sale Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSale(null);
        }}
        title={editingSale ? 'Edit Sale' : 'Create Sale'}
        maxWidth="4xl"
      >
        <SaleForm
          editMode={!!editingSale}
          saleData={editingSale || undefined}
          onSuccess={handleSuccess}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingSale(null);
          }}
        />
      </Modal>

      {/* Confirmation Dialog */}
      <Modal
        isOpen={confirmationDialogOpen}
        onClose={() => {
          setConfirmationDialogOpen(false);
          setCompletedSaleInfo(null);
        }}
        title="Sale Completed"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle size={48} className="text-green-600" />
            </div>
          </div>

          <p className="text-center text-lg font-medium text-gray-900">
            Successfully marked as completed!
          </p>

          {completedSaleInfo && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Sale ID:</span>
                <span className="text-sm font-semibold text-gray-900">#{completedSaleInfo.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Customer:</span>
                <span className="text-sm font-semibold text-gray-900">{completedSaleInfo.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue:</span>
                <span className="text-sm font-semibold text-blue-600">${completedSaleInfo.revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Profit:</span>
                <span className={`text-lg font-bold ${completedSaleInfo.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${completedSaleInfo.profit.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 text-center">
            Inventory has been updated and profit has been calculated using FIFO cost tracking.
          </p>

          <div className="flex justify-center pt-4">
            <button
              onClick={() => {
                setConfirmationDialogOpen(false);
                setCompletedSaleInfo(null);
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
