import { useEffect, useState } from 'react';
import { customersApi } from '../api/client';
import type { Customer } from '../types';
import { UserPlus, Save } from 'lucide-react';

interface CustomerSelectorProps {
  selectedCustomerId: number | null;
  onCustomerSelect: (customerId: number | null) => void;
  manualEntry: boolean;
  onManualEntryToggle: (enabled: boolean) => void;
  manualCustomerData: {
    name: string;
    phone: string;
    email: string;
  };
  onManualCustomerChange: (data: { name: string; phone: string; email: string }) => void;
}

export default function CustomerSelector({
  selectedCustomerId,
  onCustomerSelect,
  manualEntry,
  onManualEntryToggle,
  manualCustomerData,
  onManualCustomerChange,
}: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await customersApi.getAll();
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    setSaveError(null);

    // Validate required fields
    if (!manualCustomerData.name.trim()) {
      setSaveError('Customer name is required');
      return;
    }
    if (!manualCustomerData.phone.trim()) {
      setSaveError('Phone number is required');
      return;
    }

    setSaving(true);
    try {
      // Check for duplicate phone
      const existingCustomers = await customersApi.getAll();
      const customersList = existingCustomers.data.results || existingCustomers.data;
      const duplicate = customersList.find((c: Customer) => c.phone === manualCustomerData.phone.trim());

      if (duplicate) {
        setSaveError(`Customer with this phone already exists: ${duplicate.name}`);
        setSaving(false);
        return;
      }

      // Create customer
      const response = await customersApi.create({
        name: manualCustomerData.name.trim(),
        phone: manualCustomerData.phone.trim(),
        email: manualCustomerData.email.trim(),
      });

      // Switch to selected customer mode
      onCustomerSelect(response.data.id);
      onManualEntryToggle(false);

      // Refresh customer list
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      setSaveError('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Customer
        </label>
        <button
          type="button"
          onClick={() => {
            onManualEntryToggle(!manualEntry);
            if (!manualEntry) {
              onCustomerSelect(null);
            }
          }}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
        >
          <UserPlus size={16} className="mr-1" />
          {manualEntry ? 'Select Existing Customer' : 'Add New Customer'}
        </button>
      </div>

      {manualEntry ? (
        <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={manualCustomerData.name}
              onChange={(e) =>
                onManualCustomerChange({ ...manualCustomerData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter customer name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone *
              </label>
              <input
                type="tel"
                required
                value={manualCustomerData.phone}
                onChange={(e) =>
                  onManualCustomerChange({ ...manualCustomerData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={manualCustomerData.email}
                onChange={(e) =>
                  onManualCustomerChange({ ...manualCustomerData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email"
              />
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}

          <button
            type="button"
            onClick={handleSaveCustomer}
            disabled={saving}
            className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 flex items-center justify-center"
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      ) : (
        <div>
          <select
            value={selectedCustomerId || ''}
            onChange={(e) => onCustomerSelect(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          >
            <option value="">Select a customer...</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.phone ? `- ${customer.phone}` : ''}
              </option>
            ))}
          </select>
          {loading && (
            <p className="text-sm text-gray-500 mt-1">Loading customers...</p>
          )}
        </div>
      )}
    </div>
  );
}
