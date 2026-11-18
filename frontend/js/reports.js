import { $, api, content, escapeHtml, money, table, toast } from './core.js';

export async function renderReports() {
  const low = await api('/reports/low-stock');
  content.innerHTML = `
    <div class="panel" style="margin-bottom:16px"><div class="panel-heading"><div><h2>Sales report</h2><p>Completed sales by day and best-selling products</p></div></div>
      <div class="toolbar"><label>From <input id="report-from" type="date"></label><label>To <input id="report-to" type="date"></label><button id="run-report" class="button primary">Run report</button></div>
      <div id="sales-report"></div>
    </div>
    <section class="panel"><div class="panel-heading"><div><h2>Low-stock products</h2><p>Current quantity is at or below reorder level</p></div></div>
      ${table(['SKU', 'Product', 'Category', 'In stock', 'Reorder at'], low.map((p) => `<tr><td><strong>${escapeHtml(p.sku)}</strong></td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category_name)}</td><td><span class="stock-number">${escapeHtml(p.stock_quantity)}</span></td><td>${escapeHtml(p.reorder_level)}</td></tr>`), 'No products need restocking.')}
    </section>`;
  const run = async () => {
    try {
      const params = new URLSearchParams();
      if ($('#report-from').value) params.set('from', $('#report-from').value);
      if ($('#report-to').value) params.set('to', $('#report-to').value);
      const report = await api(`/reports/sales?${params}`);
      $('#sales-report').innerHTML = `<div class="report-grid">
        <div>${table(['Date', 'Orders', 'Sales'], report.daily.map((d) => `<tr><td>${escapeHtml(d.sale_date)}</td><td>${escapeHtml(d.order_count)}</td><td>${money(d.sales_total)}</td></tr>`), 'No sales in this date range.')}</div>
        <div>${table(['Best sellers', 'Units', 'Sales'], report.top_sellers.map((p) => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.quantity_sold)}</td><td>${money(p.sales_total)}</td></tr>`), 'No products sold in this date range.')}</div>
      </div>`;
    } catch (error) { toast(error.message, true); }
  };
  $('#run-report').addEventListener('click', run);
  await run();
}
