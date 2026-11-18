import {
  $, api, content, escapeHtml, loadLookups, money, openRecordDialog, setPageAction, state, table, toast
} from './core.js';

function productForm(product = {}) {
  return [
    { name: 'sku', label: 'SKU', required: true, value: product.sku },
    { name: 'name', label: 'Product name', required: true, value: product.name },
    { name: 'category_id', label: 'Category', type: 'select', required: true, value: product.category_id, options: state.categories.map((row) => [row.id, row.name]) },
    { name: 'supplier_id', label: 'Supplier', type: 'select', value: product.supplier_id, options: [['', 'No supplier'], ...state.suppliers.map((row) => [row.id, row.name])] },
    { name: 'size', label: 'Size', value: product.size },
    { name: 'material', label: 'Material', value: product.material },
    { name: 'price', label: 'Selling price (PHP)', type: 'number', step: '0.01', min: '0', required: true, value: product.price }
  ];
}

export async function renderInventory(query = '') {
  await loadLookups();
  setPageAction('＋ Add product', () => openRecordDialog('Add product', productForm(), async (values) => {
    await api('/products', { method: 'POST', body: JSON.stringify(values) });
    toast('Product added. Use Stock-in to record its starting stock.');
    renderInventory($('#inventory-search')?.value || '');
  }));
  const products = state.products.filter((row) => {
    const text = `${row.sku} ${row.name} ${row.category_name} ${row.material || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  content.innerHTML = `
    <div class="toolbar"><input id="inventory-search" type="search" placeholder="Search SKU, product, or category" value="${escapeHtml(query)}"><select id="category-filter"><option value="">All categories</option>${state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select><label class="inline-check"><input id="low-filter" type="checkbox"> Low stock only</label></div>
    <div id="inventory-table">${table(['SKU', 'Product', 'Category', 'Size / material', 'Price', 'In stock', 'Actions'], products.map((p) => `<tr><td><strong>${escapeHtml(p.sku)}</strong></td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category_name)}</td><td>${escapeHtml([p.size, p.material].filter(Boolean).join(' · ') || '—')}</td><td>${money(p.price)}</td><td>${Number(p.stock_quantity) <= Number(p.reorder_level) ? `<span class="stock-number">${escapeHtml(p.stock_quantity)}</span>` : escapeHtml(p.stock_quantity)}</td><td><div class="table-actions"><button class="button secondary" data-edit-product="${p.id}">Edit</button>${state.user.role === 'Admin' ? `<button class="button danger" data-delete-product="${p.id}">Delete</button>` : ''}</div></td></tr>`), 'No matching products.')}</div>`;
  const applyFilters = () => {
    const term = $('#inventory-search').value.toLowerCase();
    const categoryId = $('#category-filter').value;
    const lowOnly = $('#low-filter').checked;
    content.querySelectorAll('#inventory-table tbody tr').forEach((row) => {
      const productId = row.querySelector('[data-edit-product]')?.dataset.editProduct
        || row.querySelector('[data-delete-product]')?.dataset.deleteProduct;
      const product = state.products.find((item) => String(item.id) === productId);
      const matchesTerm = row.textContent.toLowerCase().includes(term);
      const matchesCategory = !categoryId || String(product?.category_id) === categoryId;
      const matchesLow = !lowOnly || !!row.children[5].querySelector('.stock-number');
      row.hidden = !(matchesTerm && matchesCategory && matchesLow);
    });
  };
  $('#inventory-search').addEventListener('input', applyFilters);
  $('#category-filter').addEventListener('change', applyFilters);
  $('#low-filter').addEventListener('change', applyFilters);
  content.querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => {
    const product = state.products.find((row) => String(row.id) === button.dataset.editProduct);
    openRecordDialog('Edit product', productForm(product), async (values) => {
      await api(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(values) });
      toast('Product updated.');
      renderInventory($('#inventory-search')?.value || '');
    });
  }));
  content.querySelectorAll('[data-delete-product]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Delete this product? Products used in sales cannot be deleted.')) return;
    try {
      await api(`/products/${button.dataset.deleteProduct}`, { method: 'DELETE' });
      toast('Product deleted.');
      renderInventory($('#inventory-search')?.value || '');
    } catch (error) { toast(error.message, true); }
  }));
}
