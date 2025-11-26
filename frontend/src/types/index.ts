export interface SystemSettings {
  id: number;
  usd_to_gtq_rate: number;
  last_updated: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  webpage?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  product_name: string;
  brand_name: string;
  product_type: string;
  url: string;
  amount_per_serving: string;
  serving_size: string;
  units_per_container: number | null;
  weight_g: number | null;
  description: string;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  is_low_stock: boolean;
  average_cost: number;
  average_cost_gtq: number;
  current_price: number;
  last_purchase_cost: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostLayer {
  id: number;
  product: number;
  purchase_item: number | null;
  unit_cost: number;
  unit_cost_gtq: number;
  quantity_remaining: number;
  original_quantity: number;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase: number;
  product: number;
  product_name: string;
  product_brand: string;
  quantity: number;
  unit_cost: number;
  discount: number;
  total_price: number;
}

export interface Purchase {
  id: number;
  order_id: string;
  purchase_date: string;
  delivery_date: string | null;
  status: 'pending' | 'received' | 'cancelled';
  weight_lb: number;

  // Estimated Logistics
  estimated_shipping: number;
  estimated_taxes: number;

  // Real Logistics
  real_shipping: number | null;
  real_taxes: number | null;

  notes: string;
  items: PurchaseItem[];

  // Calculated costs (USD)
  product_cost: number;
  estimated_logistic_cost: number;
  real_logistic_cost: number | null;
  estimated_total: number;
  real_total: number | null;
  total_cost: number;

  // GTQ conversion
  total_cost_gtq: number;

  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  sales_count: number;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale: number;
  product: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_price: number;
  total_cost: number;
  profit: number;
}

export interface Sale {
  id: number;

  // Customer relationship
  customer: number | null;
  customer_data: Customer | null;

  // Manual customer entry fields
  customer_name: string;
  customer_phone: string;
  customer_email: string;

  // Display fields (from backend methods)
  display_customer_name: string;
  display_customer_phone: string;
  display_customer_email: string;

  // Sale details
  sale_date: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string;
  items: SaleItem[];

  // Financials
  total_revenue: number;
  total_cost: number;
  profit: number;

  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: number;
  product: number;
  product_name: string;
  transaction_type: 'purchase' | 'sale' | 'adjustment';
  quantity_change: number;
  quantity_after: number;
  reference_id: number | null;
  notes: string;
  created_at: string;
}

export interface CostReportProduct {
  product_id: number;
  product_name: string;
  brand_name: string;
  quantity_sold: number;
  avg_unit_cost: number;
  total_cost: number;
  total_revenue: number;
  profit: number;
}

// Keep old type for backwards compatibility
export interface MonthlyCostReportProduct {
  product_id: number;
  product_name: string;
  brand_name: string;
  quantity_sold: number;
  avg_unit_cost: number;
  total_cost: number;
}

export interface CostReport {
  start_date: string;
  end_date: string;
  products: CostReportProduct[];
  totals: {
    total_quantity: number;
    total_cost: number;
    total_revenue: number;
    total_profit: number;
  };
}

// Keep old type for backwards compatibility
export interface MonthlyCostReport {
  year: number;
  month: number;
  products: MonthlyCostReportProduct[];
  totals: {
    total_quantity: number;
    total_cost: number;
  };
}
