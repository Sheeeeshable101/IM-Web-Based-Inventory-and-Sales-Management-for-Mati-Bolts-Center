import { registerPages, startApp } from './core.js';
import { renderDashboard } from './dashboard.js';
import { renderInventory } from './inventory.js';
import { renderSales } from './sales.js';
import { renderOrders } from './orders.js';
import { renderStockIn } from './stock-in.js';
import { renderCategories, renderSuppliers, renderCustomers } from './contacts.js';
import { renderReports } from './reports.js';
import { renderUsers } from './users.js';

registerPages({
  dashboard: renderDashboard,
  inventory: renderInventory,
  sales: renderSales,
  orders: renderOrders,
  'stock-in': renderStockIn,
  categories: renderCategories,
  suppliers: renderSuppliers,
  customers: renderCustomers,
  reports: renderReports,
  users: renderUsers
});

startApp();
