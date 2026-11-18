import { $, api, badge, dateTime, escapeHtml, money, setPage, table } from './core.js';

const content = $('#page-content');

export async function renderDashboard() {
  const data = await api('/reports/dashboard');
  const lowStock = await api('/reports/low-stock');
  content.innerHTML = `
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-label">Sales today</div><div class="metric-value">${money(data.today.sales_total)}</div><div class="metric-note">Completed orders today</div></article>
      <article class="metric-card"><div class="metric-label">Orders today</div><div class="metric-value">${escapeHtml(data.today.order_count)}</div><div class="metric-note">Completed sales</div></article>
      <article class="metric-card"><div class="metric-label">Products</div><div class="metric-value">${escapeHtml(data.inventory.product_count)}</div><div class="metric-note">${escapeHtml(data.inventory.units_in_stock)} units in stock</div></article>
      <article class="metric-card"><div class="metric-label">Low stock</div><div class="metric-value">${escapeHtml(data.low_stock_count)}</div><div class="metric-note">At or below reorder level</div></article>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><h2>Recent orders</h2><p>Your latest sales activity</p></div><button class="button secondary" data-go="orders">All orders</button></div>
        ${table(['Order', 'Customer', 'Date', 'Total', 'Status'], data.recent_orders.map((order) => `<tr><td><strong>#${escapeHtml(order.id)}</strong></td><td>${escapeHtml(order.customer_name || 'Walk-in')}</td><td>${dateTime(order.created_at)}</td><td>${money(order.total_amount)}</td><td>${badge(order.status)}</td></tr>`), 'No sales have been recorded yet.')}
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Needs attention</h2><p>Products to consider restocking</p></div></div>
        <div class="stock-list">${lowStock.slice(0, 7).map((product) => `<div class="stock-row"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku)} · Reorder at ${escapeHtml(product.reorder_level)}</small></div><span class="stock-number">${escapeHtml(product.stock_quantity)} left</span></div>`).join('') || '<div class="empty-state">All products are above their reorder level.</div>'}</div>
      </section>
    </div>`;
  content.querySelector('[data-go="orders"]')?.addEventListener('click', () => setPage('orders'));
}
