import { useState, useEffect } from 'react';
import { settingsApi } from '../api/client';
import type { SystemSettings } from '../types';
import { DollarSign, Save, RefreshCw } from 'lucide-react';

export default function ExchangeRateSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsApi.getSettings();
      const data = response.data;
      setSettings(data);
      setExchangeRate(data.usd_to_gtq_rate.toString());
    } catch (error) {
      console.error('Error fetching settings:', error);
      alert('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      alert('Please enter a valid exchange rate');
      return;
    }

    setSaving(true);
    try {
      const response = await settingsApi.updateSettings({
        usd_to_gtq_rate: parseFloat(exchangeRate),
      });
      setSettings(response.data);
      alert('Exchange rate updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update exchange rate');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-6">
          <DollarSign size={24} className="mr-2 text-blue-600" />
          <h2 className="text-2xl font-bold">Exchange Rate Settings</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              USD to GTQ Exchange Rate
            </label>
            <div className="flex items-center space-x-3">
              <span className="text-gray-600">1 USD =</span>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="7.7500"
              />
              <span className="text-gray-600">GTQ</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              This rate is used to convert purchase costs from USD to GTQ for profit calculations
            </p>
          </div>

          {settings && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Last Updated:</span>{' '}
                {new Date(settings.last_updated).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Current Rate:</span> 1 USD = {settings.usd_to_gtq_rate} GTQ
              </p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={saving || !exchangeRate}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              <Save size={18} className="mr-2" />
              {saving ? 'Saving...' : 'Save Exchange Rate'}
            </button>
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </button>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">How this works:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Purchase orders are entered and stored in USD</li>
              <li>• When purchases are received, costs are converted to GTQ using this rate</li>
              <li>• Sales profit calculations use GTQ costs via FIFO (First In, First Out)</li>
              <li>• Update this rate whenever the exchange rate changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
