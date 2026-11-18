import {
  $, api, content, dateTime, escapeHtml, loadLookups, openRecordDialog, setPageAction, state, table, toast
} from './core.js';

export async function renderCategories() {
  await loadLookups();
  const categories = await api('/categories');
  setPageAction('＋ Add category', () => openRecordDialog('Add category', [
    { name: 'name', label: 'Category name', required: true },
    { name: 'description', label: 'Description', type: 'textarea', full: true }
  ], async (values) => {
    await api('/categories', { method: 'POST', body: JSON.stringify(values) });
    toast('Category added.');
    renderCategories();
  }));
  content.innerHTML = table(['Category', 'Description', 'Products'], categories.map((c) => `<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${escapeHtml(c.description || '—')}</td><td>${state.products.filter((p) => Number(p.category_id) === Number(c.id)).length || '—'}</td></tr>`), 'No categories added.');
}

function contactForm(record = {}) {
  return [
    { name: 'name', label: 'Name', required: true, value: record.name },
    { name: 'phone', label: 'Phone', value: record.phone },
    { name: 'email', label: 'Email', type: 'email', value: record.email },
    ...(Object.hasOwn(record, 'address') || state.page === 'suppliers' ? [{ name: 'address', label: 'Address', type: 'textarea', full: true, value: record.address }] : [])
  ];
}

export async function renderSuppliers() {
  const suppliers = await api('/suppliers');
  if (state.user.role === 'Admin') {
    setPageAction('＋ Add supplier', () => openRecordDialog('Add supplier', contactForm({ address: '' }), async (values) => {
      await api('/suppliers', { method: 'POST', body: JSON.stringify(values) });
      toast('Supplier added.');
      renderSuppliers();
    }));
  }
  content.innerHTML = table(['Supplier', 'Phone', 'Email', 'Address', ...(state.user.role === 'Admin' ? ['Actions'] : [])], suppliers.map((s) => `<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.phone || '—')}</td><td>${escapeHtml(s.email || '—')}</td><td>${escapeHtml(s.address || '—')}</td>${state.user.role === 'Admin' ? `<td><div class="table-actions"><button class="button secondary" data-edit-supplier="${s.id}">Edit</button><button class="button danger" data-delete-supplier="${s.id}">Delete</button></div></td>` : ''}</tr>`), 'No suppliers added.');
  if (state.user.role === 'Admin') {
    content.querySelectorAll('[data-edit-supplier]').forEach((button) => button.addEventListener('click', () => {
      const record = suppliers.find((s) => String(s.id) === button.dataset.editSupplier);
      openRecordDialog('Edit supplier', contactForm(record), async (values) => {
        await api(`/suppliers/${record.id}`, { method: 'PUT', body: JSON.stringify(values) });
        toast('Supplier updated.');
        renderSuppliers();
      });
    }));
    content.querySelectorAll('[data-delete-supplier]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Delete this supplier? Linked products and deliveries will keep working without a supplier.')) return;
      try {
        await api(`/suppliers/${button.dataset.deleteSupplier}`, { method: 'DELETE' });
        toast('Supplier deleted.');
        renderSuppliers();
      } catch (error) { toast(error.message, true); }
    }));
  }
}

export async function renderCustomers() {
  const customers = await api('/customers');
  setPageAction('＋ Add customer', () => openRecordDialog('Add customer', contactForm(), async (values) => {
    await api('/customers', { method: 'POST', body: JSON.stringify(values) });
    toast('Customer added.');
    renderCustomers();
  }));
  content.innerHTML = table(['Customer', 'Phone', 'Email', 'Added'], customers.map((c) => `<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${escapeHtml(c.phone || '—')}</td><td>${escapeHtml(c.email || '—')}</td><td>${dateTime(c.created_at)}</td></tr>`), 'No customers added.');
}
