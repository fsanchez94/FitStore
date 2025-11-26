import { useEffect, useState } from 'react';
import { purchasesApi } from '../api/client';
import type { Purchase } from '../types';
import { Plus, Edit, Trash2, Package, DollarSign, TrendingUp, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal';
import PurchaseOrderForm from '../components/PurchaseOrderForm';

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveringPurchase, setDeliveringPurchase] = useState<Purchase | null>(null);
  const [realShipping, setRealShipping] = useState('');
  const [realTaxes, setRealTaxes] = useState('');
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [receivedPurchaseInfo, setReceivedPurchaseInfo] = useState<{
    orderId: string;
    totalCost: number;
    itemCount: number;
  } | null>(null);
  const [expandedPurchases, setExpandedPurchases] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedPurchases(prev => {
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
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      const response = await purchasesApi.getAll();
      setPurchases(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      await purchasesApi.delete(id);
      fetchPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Failed to delete purchase order');
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
    fetchPurchases();
  };

  const handleEdit = async (purchase: Purchase) => {
    try {
      // Fetch full purchase details to ensure we have all item data
      const response = await purchasesApi.get(purchase.id);
      setEditingPurchase(response.data);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching purchase details:', error);
      alert('Failed to load purchase details');
    }
  };

  const handleMarkAsDelivered = async (purchase: Purchase) => {
    // Check if real shipping and taxes are already set
    if (purchase.real_shipping === null || purchase.real_taxes === null) {
      // Open dialog to input real shipping and taxes
      setDeliveringPurchase(purchase);
      setRealShipping(purchase.real_shipping?.toString() || '');
      setRealTaxes(purchase.real_taxes?.toString() || '');
      setDeliveryDialogOpen(true);
    } else {
      // Directly mark as received
      await markAsReceived(purchase.id);
    }
  };

  const handleDeliverySubmit = async () => {
    if (!deliveringPurchase) return;

    const shipping = parseFloat(realShipping);
    const taxes = parseFloat(realTaxes);

    if (isNaN(shipping) || isNaN(taxes)) {
      alert('Please enter valid numbers for shipping and taxes');
      return;
    }

    try {
      // Update purchase with real shipping and taxes
      await purchasesApi.update(deliveringPurchase.id, {
        real_shipping: shipping,
        real_taxes: taxes,
      });

      // Then mark as received
      await markAsReceived(deliveringPurchase.id);

      // Close dialog and reset state
      setDeliveryDialogOpen(false);
      setDeliveringPurchase(null);
      setRealShipping('');
      setRealTaxes('');
    } catch (error) {
      console.error('Error updating purchase:', error);
      alert('Failed to update purchase order');
    }
  };

  const markAsReceived = async (purchaseId: number) => {
    try {
      // Get the purchase details before marking as received
      const purchaseResponse = await purchasesApi.get(purchaseId);
      const purchase = purchaseResponse.data;

      // Mark as received
      await purchasesApi.receive(purchaseId);

      // Store purchase info for confirmation dialog
      setReceivedPurchaseInfo({
        orderId: purchase.order_id || `#${purchase.id}`,
        totalCost: purchase.total_cost,
        itemCount: purchase.items.length,
      });

      // Show confirmation dialog
      setConfirmationDialogOpen(true);

      // Refresh purchases list
      fetchPurchases();
    } catch (error) {
      console.error('Error marking purchase as received:', error);
      alert('Failed to mark purchase as received');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':
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
        <h1 className="text-3xl font-bold">Purchase Orders</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-600"
        >
          <Plus className="mr-2" size={20} />
          New Purchase Order
        </button>
      </div>

      {/* Purchase Orders List */}
      <div className="space-y-4">
        {purchases.map((purchase) => (
          <div key={purchase.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <Package className="text-gray-400" size={24} />
                <div>
                  <h3 className="font-bold text-lg">
                    {purchase.order_id ? `Order ${purchase.order_id}` : `Purchase #${purchase.id}`}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(purchase.purchase_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleExpand(purchase.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {expandedPurchases.has(purchase.id) ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(purchase.status)}`}>
                  {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                </span>
                {purchase.status === 'pending' && (
                  <button
                    onClick={() => handleMarkAsDelivered(purchase)}
                    className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-green-600 flex items-center"
                  >
                    <CheckCircle size={16} className="mr-1" />
                    Mark as Delivered
                  </button>
                )}
                <button
                  onClick={() => handleEdit(purchase)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(purchase.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Summary Row */}
            <div className="px-6 py-4 bg-white grid grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-500">Product Cost</p>
                <p className="text-lg font-semibold">${purchase.product_cost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Logistic Cost</p>
                <p className="text-lg font-semibold">
                  ${(purchase.real_logistic_cost || purchase.estimated_logistic_cost).toFixed(2)}
                  {!purchase.real_logistic_cost && (
                    <span className="text-xs text-yellow-600 ml-1">(est.)</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cost (USD)</p>
                <p className="text-xl font-bold text-blue-600">${purchase.total_cost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cost (GTQ)</p>
                <p className="text-xl font-bold text-green-600">Q{purchase.total_cost_gtq.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Weight</p>
                <p className="text-lg font-semibold">{purchase.weight_lb} lb</p>
              </div>
            </div>

            {/* Details (Collapsible) */}
            {expandedPurchases.has(purchase.id) && (
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 gap-6">
                    {/* Left Column - Products */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <Package size={16} className="mr-2" />
                        Products ({purchase.items.length})
                      </h4>
                      <div className="bg-white rounded border overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Brand</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {purchase.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-sm">{item.product_name}</td>
                                <td className="px-4 py-2 text-sm text-gray-600">{item.product_brand || '-'}</td>
                                <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                                <td className="px-4 py-2 text-sm text-right">${item.unit_cost.toFixed(2)}</td>
                                <td className="px-4 py-2 text-sm text-right font-medium">
                                  {item.discount > 0 ? (
                                    <span>
                                      ${(item.quantity * item.unit_cost).toFixed(2)} - ${item.discount.toFixed(2)} = ${item.total_price.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span>${item.total_price.toFixed(2)}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-semibold">
                              <td colSpan={4} className="px-4 py-2 text-sm text-right">Product Total:</td>
                              <td className="px-4 py-2 text-sm text-right">${purchase.product_cost.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Column - Logistics */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <DollarSign size={16} className="mr-2" />
                        Logistics Costs
                      </h4>
                      <div className="space-y-4">
                        {/* Estimated */}
                        <div className="bg-white rounded border p-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Estimated (Calculator)</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Shipping:</span>
                              <span className="font-medium">${purchase.estimated_shipping.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Taxes:</span>
                              <span className="font-medium">${purchase.estimated_taxes.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                              <span className="font-semibold">Est. Total:</span>
                              <span className="font-semibold">${purchase.estimated_logistic_cost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t text-blue-600">
                              <span className="font-bold">Est. Grand Total:</span>
                              <span className="font-bold">${purchase.estimated_total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Real */}
                        {purchase.real_shipping !== null && purchase.real_taxes !== null && (
                          <div className="bg-green-50 rounded border border-green-200 p-4">
                            <h5 className="text-sm font-medium text-green-800 mb-2">Real (Invoice)</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Shipping:</span>
                                <span className="font-medium">${purchase.real_shipping.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Taxes:</span>
                                <span className="font-medium">${purchase.real_taxes.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-green-200">
                                <span className="font-semibold">Real Total:</span>
                                <span className="font-semibold">${purchase.real_logistic_cost?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-green-200 text-green-600">
                                <span className="font-bold">Real Grand Total:</span>
                                <span className="font-bold">${purchase.real_total?.toFixed(2)}</span>
                              </div>
                              {purchase.real_total && purchase.estimated_total && (
                                <div className="flex justify-between pt-2 text-xs">
                                  <span className="text-gray-500">Difference:</span>
                                  <span className={purchase.real_total > purchase.estimated_total ? 'text-red-600' : 'text-green-600'}>
                                    ${(purchase.real_total - purchase.estimated_total).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Additional Info */}
                        <div className="bg-gray-100 rounded p-4 text-sm">
                          <div className="space-y-1">
                            {purchase.delivery_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Delivery Date:</span>
                                <span className="font-medium">{new Date(purchase.delivery_date).toLocaleDateString()}</span>
                              </div>
                            )}
                            {purchase.notes && (
                              <div className="pt-2 border-t">
                                <span className="text-gray-600">Notes:</span>
                                <p className="mt-1 text-gray-800">{purchase.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {purchases.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Purchase Orders</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first purchase order</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              <Plus className="inline mr-2" size={16} />
              New Purchase Order
            </button>
          </div>
        )}
      </div>

      {/* Purchase Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPurchase(null);
        }}
        title={editingPurchase ? 'Edit Purchase Order' : 'Create Purchase Order'}
        maxWidth="4xl"
      >
        <PurchaseOrderForm
          editMode={!!editingPurchase}
          purchaseData={editingPurchase || undefined}
          onSuccess={handleSuccess}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingPurchase(null);
          }}
        />
      </Modal>

      {/* Delivery Dialog */}
      <Modal
        isOpen={deliveryDialogOpen}
        onClose={() => {
          setDeliveryDialogOpen(false);
          setDeliveringPurchase(null);
          setRealShipping('');
          setRealTaxes('');
        }}
        title="Enter Real Shipping & Taxes"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please enter the actual shipping and taxes from the invoice before marking this purchase as delivered.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Real Shipping ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={realShipping}
              onChange={(e) => setRealShipping(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Real Taxes ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={realTaxes}
              onChange={(e) => setRealTaxes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setDeliveryDialogOpen(false);
                setDeliveringPurchase(null);
                setRealShipping('');
                setRealTaxes('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeliverySubmit}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
            >
              <CheckCircle size={16} className="mr-2" />
              Mark as Delivered
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <Modal
        isOpen={confirmationDialogOpen}
        onClose={() => {
          setConfirmationDialogOpen(false);
          setReceivedPurchaseInfo(null);
        }}
        title="Purchase Order Received"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle size={48} className="text-green-600" />
            </div>
          </div>

          <p className="text-center text-lg font-medium text-gray-900">
            Successfully marked as received!
          </p>

          {receivedPurchaseInfo && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Order ID:</span>
                <span className="text-sm font-semibold text-gray-900">{receivedPurchaseInfo.orderId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Items Received:</span>
                <span className="text-sm font-semibold text-gray-900">{receivedPurchaseInfo.itemCount}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Total Cost:</span>
                <span className="text-lg font-bold text-blue-600">${receivedPurchaseInfo.totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 text-center">
            Inventory has been updated and cost layers have been created for FIFO tracking.
          </p>

          <div className="flex justify-center pt-4">
            <button
              onClick={() => {
                setConfirmationDialogOpen(false);
                setReceivedPurchaseInfo(null);
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
