import {
  $, api, badge, content, dateTime, escapeHtml, money, openInfoDialog, table, toast
} from './core.js';

export async function renderOrders() {
  const orders = await api('/orders');
  content.innerHTML = table(['Order', 'Customer', 'Staff', 'Items', 'Date', 'Total', 'Status', 'Actions'], orders.map((o) => `<tr><td><strong>#${escapeHtml(o.id)}</strong></td><td>${escapeHtml(o.customer_name || 'Walk-in')}</td><td>${escapeHtml(o.staff_name)}</td><td>${escapeHtml(o.item_count)}</td><td>${dateTime(o.created_at)}</td><td>${money(o.total_amount)}</td><td>${badge(o.status)}</td><td><div class="table-actions"><button class="button secondary" data-order-detail="${o.id}">Details</button>${o.status === 'Pending' ? `<button class="button secondary" data-complete-order="${o.id}">Complete</button>` : ''}${o.status !== 'Cancelled' ? `<button class="button danger" data-cancel-order="${o.id}">Cancel</button>` : ''}</div></td></tr>`), 'No orders recorded yet.');
  content.querySelectorAll('[data-order-detail]').forEach((button) => button.addEventListener('click', async () => {
    try {
      const order = await api(`/orders/${button.dataset.orderDetail}`);
      openInfoDialog(`Order #${order.id}`, `<div class="detail-list"><div><strong>Customer:</strong> ${escapeHtml(order.customer_name || 'Walk-in')}</div><div><strong>Staff:</strong> ${escapeHtml(order.staff_name)}</div><div><strong>Date:</strong> ${dateTime(order.created_at)}</div><div><strong>Status:</strong> ${badge(order.status)}</div><div><strong>Items:</strong></div>${order.items.map((item) => `<div>${escapeHtml(item.quantity)} × ${escapeHtml(item.name)} (${escapeHtml(item.sku)}) — ${money(item.line_total)}</div>`).join('')}<div><strong>Total: ${money(order.total_amount)}</strong></div></div>`);
    } catch (error) { toast(error.message, true); }
  }));
  content.querySelectorAll('[data-cancel-order]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm(`Cancel order #${button.dataset.cancelOrder}? Its items will be returned to stock.`)) return;
    try {
      await api(`/orders/${button.dataset.cancelOrder}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Cancelled' }) });
      toast('Order cancelled and stock restored.');
      renderOrders();
    } catch (error) { toast(error.message, true); }
  }));
  content.querySelectorAll('[data-complete-order]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/orders/${button.dataset.completeOrder}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Completed' }) });
      toast('Order marked completed.');
      renderOrders();
    } catch (error) { toast(error.message, true); }
  }));
}
