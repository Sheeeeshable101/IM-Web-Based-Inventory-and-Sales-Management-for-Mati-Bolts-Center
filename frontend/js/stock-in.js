import {
  $, api, content, dateTime, escapeHtml, loadLookups, money, openRecordDialog, setPageAction, state, table, toast
} from './core.js';

export async function renderStockIn() {
  await loadLookups();
  setPageAction('＋ Record stock-in', () => openRecordDialog('Record stock-in', [
    { name: 'product_id', label: 'Product', type: 'select', required: true, options: state.products.map((p) => [p.id, `${p.sku} · ${p.name}`]) },
    { name: 'supplier_id', label: 'Supplier', type: 'select', options: [['', 'No supplier'], ...state.suppliers.map((s) => [s.id, s.name])] },
    { name: 'quantity', label: 'Quantity received', type: 'number', min: '1', required: true },
    { name: 'cost_per_unit', label: 'Cost per unit (PHP)', type: 'number', min: '0', step: '0.01', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
  ], async (values) => {
    await api('/stock-in', { method: 'POST', body: JSON.stringify(values) });
    toast('Stock-in recorded and inventory updated.');
    renderStockIn();
  }));
  const rows = await api('/stock-in');
  content.innerHTML = table(['Date', 'Product', 'Supplier', 'Quantity', 'Cost / unit', 'Recorded by', 'Notes'], rows.map((r) => `<tr><td>${dateTime(r.received_at)}</td><td><strong>${escapeHtml(r.product_name)}</strong><small class="muted"> ${escapeHtml(r.sku)}</small></td><td>${escapeHtml(r.supplier_name || '—')}</td><td>${escapeHtml(r.quantity)}</td><td>${money(r.cost_per_unit)}</td><td>${escapeHtml(r.staff_name)}</td><td>${escapeHtml(r.notes || '—')}</td></tr>`), 'No deliveries recorded yet.');
}
