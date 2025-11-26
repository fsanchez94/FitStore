import { useEffect, useState } from 'react';
import { productsApi, salesApi, purchasesApi } from '../api/client';
import type { Product, Sale, Purchase } from '../types';
import { Package, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, salesRes, purchasesRes, lowStockRes] = await Promise.all([
          productsApi.getAll(),
          salesApi.getAll(),
          purchasesApi.getAll(),
          productsApi.getLowStock(),
        ]);

        setProducts(productsRes.data.results || productsRes.data);
        setSales(salesRes.data.results || salesRes.data);
        setPurchases(purchasesRes.data.results || purchasesRes.data);
        setLowStockProducts(lowStockRes.data.results || lowStockRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalInventoryValue = products.reduce(
    (sum, product) => sum + (product.current_stock * (product.average_cost_gtq || 0)),
    0
  );

  const totalSales = sales.reduce((sum, sale) => sum + (sale.total_revenue || 0), 0);
  const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Products</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Sales (GTQ)</p>
              <p className="text-2xl font-bold text-green-600">Q{totalSales.toFixed(2)}</p>
            </div>
            <ShoppingCart className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Profit (GTQ)</p>
              <p className="text-2xl font-bold text-purple-600">Q{totalProfit.toFixed(2)}</p>
            </div>
            <TrendingUp className="text-purple-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Inventory Value (GTQ)</p>
              <p className="text-2xl font-bold text-blue-600">Q{totalInventoryValue.toFixed(2)}</p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center">
            <AlertTriangle className="mr-2" size={24} />
            Low Stock Alert
          </h2>
          <div className="space-y-2">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{product.product_name}</span>
                  {product.brand_name && (
                    <span className="text-gray-500 ml-2">({product.brand_name})</span>
                  )}
                </div>
                <span className="text-red-600">
                  Stock: {product.current_stock} {product.unit} (Min: {product.min_stock_level})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Recent Sales</h2>
          <div className="space-y-3">
            {sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium">{sale.customer_name || 'Walk-in Customer'}</p>
                  <p className="text-sm text-gray-500">{sale.sale_date}</p>
                </div>
                <span className="font-bold text-green-600">Q{sale.total_revenue.toFixed(2)}</span>
              </div>
            ))}
            {sales.length === 0 && (
              <p className="text-gray-500">No sales recorded yet</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Recent Purchases</h2>
          <div className="space-y-3">
            {purchases.slice(0, 5).map((purchase) => (
              <div key={purchase.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium">{purchase.order_id || `Purchase #${purchase.id}`}</p>
                  <p className="text-sm text-gray-500">{purchase.purchase_date}</p>
                </div>
                <span className={`px-2 py-1 rounded text-sm ${
                  purchase.status === 'received' ? 'bg-green-100 text-green-800' :
                  purchase.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {purchase.status}
                </span>
              </div>
            ))}
            {purchases.length === 0 && (
              <p className="text-gray-500">No purchases recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
