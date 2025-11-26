import axios from 'axios';
import type { SystemSettings, Supplier, Product, Purchase, PurchaseItem, Customer, Sale, SaleItem, InventoryTransaction, CostReport } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// System Settings
export const settingsApi = {
  getSettings: () => apiClient.get<SystemSettings>('/settings/'),
  updateSettings: (data: Partial<SystemSettings>) => apiClient.patch<SystemSettings>('/settings/1/', data),
};

// Suppliers
export const suppliersApi = {
  getAll: () => apiClient.get<Supplier[]>('/suppliers/'),
  get: (id: number) => apiClient.get<Supplier>(`/suppliers/${id}/`),
  create: (data: Partial<Supplier>) => apiClient.post<Supplier>('/suppliers/', data),
  update: (id: number, data: Partial<Supplier>) => apiClient.patch<Supplier>(`/suppliers/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/suppliers/${id}/`),
};

// Products
export const productsApi = {
  getAll: () => apiClient.get<Product[]>('/products/'),
  get: (id: number) => apiClient.get<Product>(`/products/${id}/`),
  getLowStock: () => apiClient.get<Product[]>('/products/low_stock/'),
  create: (data: Partial<Product>) => apiClient.post<Product>('/products/', data),
  update: (id: number, data: Partial<Product>) => apiClient.patch<Product>(`/products/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/products/${id}/`),
};

// Purchases
export const purchasesApi = {
  getAll: () => apiClient.get<Purchase[]>('/purchases/'),
  get: (id: number) => apiClient.get<Purchase>(`/purchases/${id}/`),
  create: (data: Partial<Purchase>) => apiClient.post<Purchase>('/purchases/', data),
  update: (id: number, data: Partial<Purchase>) => apiClient.patch<Purchase>(`/purchases/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/purchases/${id}/`),
  receive: (id: number) => apiClient.post<Purchase>(`/purchases/${id}/receive/`),
};

// Purchase Items
export const purchaseItemsApi = {
  getAll: () => apiClient.get<PurchaseItem[]>('/purchase-items/'),
  create: (data: Partial<PurchaseItem>) => apiClient.post<PurchaseItem>('/purchase-items/', data),
  update: (id: number, data: Partial<PurchaseItem>) => apiClient.patch<PurchaseItem>(`/purchase-items/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/purchase-items/${id}/`),
};

// Customers
export const customersApi = {
  getAll: () => apiClient.get<Customer[]>('/customers/'),
  get: (id: number) => apiClient.get<Customer>(`/customers/${id}/`),
  create: (data: Partial<Customer>) => apiClient.post<Customer>('/customers/', data),
  update: (id: number, data: Partial<Customer>) => apiClient.patch<Customer>(`/customers/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/customers/${id}/`),
};

// Sales
export const salesApi = {
  getAll: () => apiClient.get<Sale[]>('/sales/'),
  get: (id: number) => apiClient.get<Sale>(`/sales/${id}/`),
  create: (data: Partial<Sale>) => apiClient.post<Sale>('/sales/', data),
  update: (id: number, data: Partial<Sale>) => apiClient.patch<Sale>(`/sales/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/sales/${id}/`),
  getCostReport: (startDate: string, endDate: string) =>
    apiClient.get<CostReport>(`/sales/cost_report/?start_date=${startDate}&end_date=${endDate}`),
};

// Sale Items
export const saleItemsApi = {
  getAll: () => apiClient.get<SaleItem[]>('/sale-items/'),
  create: (data: Partial<SaleItem>) => apiClient.post<SaleItem>('/sale-items/', data),
  update: (id: number, data: Partial<SaleItem>) => apiClient.patch<SaleItem>(`/sale-items/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/sale-items/${id}/`),
};

// Inventory Transactions
export const inventoryTransactionsApi = {
  getAll: () => apiClient.get<InventoryTransaction[]>('/inventory-transactions/'),
  get: (id: number) => apiClient.get<InventoryTransaction>(`/inventory-transactions/${id}/`),
};

export default apiClient;
