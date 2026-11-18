const API_BASE = '/api';

export const state = {
  token: localStorage.getItem('mati_bolts_token'),
  user: JSON.parse(localStorage.getItem('mati_bolts_user') || 'null'),
  page: 'dashboard',
  products: [],
  categories: [],
  suppliers: [],
  customers: [],
  cart: [],
  formSubmit: null
};

export const $ = (selector) => document.querySelector(selector);
export const content = $('#page-content');
const dialog = $('#record-dialog');
const renderers = {};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function money(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(String(value).replace(' ', 'T')).toLocaleString('en-PH', {
    dateStyle: 'medium', timeStyle: 'short'
  });
}

export async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach the API. Check that the backend is running.');
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') signOut();
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }
  return payload;
}

export function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add('hidden'), 3600);
}

function setSignedIn(signedIn) {
  $('#login-screen').classList.toggle('hidden', signedIn);
  $('#app-shell').classList.toggle('hidden', !signedIn);
  if (signedIn && state.user) {
    $('#user-name').textContent = state.user.name;
    $('#user-role').textContent = state.user.role;
    $('#user-avatar').textContent = state.user.name.slice(0, 1).toUpperCase();
    document.querySelectorAll('.admin-only').forEach((node) => {
      node.classList.toggle('hidden', state.user.role !== 'Admin');
    });
  }
}

export function signOut() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('mati_bolts_token');
  localStorage.removeItem('mati_bolts_user');
  setSignedIn(false);
  $('#login-form').reset();
}

export function registerPages(pages) {
  Object.assign(renderers, pages);
}

export function setPage(page) {
  state.page = page;
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  const titles = {
    dashboard: ['OVERVIEW', 'Dashboard'],
    inventory: ['OPERATIONS', 'Inventory'],
    sales: ['OPERATIONS', 'New sale'],
    orders: ['OPERATIONS', 'Orders'],
    'stock-in': ['OPERATIONS', 'Stock-in'],
    categories: ['MANAGE', 'Categories'],
    suppliers: ['MANAGE', 'Suppliers'],
    customers: ['MANAGE', 'Customers'],
    reports: ['INSIGHTS', 'Reports'],
    users: ['ADMINISTRATION', 'Users']
  };
  const [eyebrow, title] = titles[page] || titles.dashboard;
  $('#page-eyebrow').textContent = eyebrow;
  $('#page-title').textContent = title;
  renderPage().catch((error) => toast(error.message, true));
}

function renderPage() {
  setPageAction('', null);
  const render = renderers[state.page] || renderers.dashboard;
  return render();
}

export function setPageAction(label, action) {
  const target = $('#page-actions');
  target.replaceChildren();
  if (!label) return;
  const button = document.createElement('button');
  button.className = 'button primary';
  button.textContent = label;
  button.addEventListener('click', action);
  target.append(button);
}

export function table(headers, rows, emptyMessage = 'No records found.') {
  if (!rows.length) return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  return `<div class="table-panel"><div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}

export function badge(status) {
  return `<span class="badge ${escapeHtml(String(status).toLowerCase())}">${escapeHtml(status)}</span>`;
}

export async function loadLookups() {
  const [products, categories, suppliers, customers] = await Promise.all([
    api('/products'), api('/categories'), api('/suppliers'), api('/customers')
  ]);
  Object.assign(state, { products, categories, suppliers, customers });
}

export function openRecordDialog(title, fields, onSubmit) {
  $('#dialog-eyebrow').textContent = 'RECORD';
  $('#dialog-title').textContent = title;
  $('#dialog-error').textContent = '';
  $('#dialog-fields').innerHTML = fields.map((field) => {
    const common = `name="${escapeHtml(field.name)}" ${field.required ? 'required' : ''} ${field.min !== undefined ? `min="${escapeHtml(field.min)}"` : ''} ${field.max !== undefined ? `max="${escapeHtml(field.max)}"` : ''} ${field.step ? `step="${escapeHtml(field.step)}"` : ''} ${field.minlength ? `minlength="${escapeHtml(field.minlength)}"` : ''}`;
    let control;
    if (field.type === 'select') {
      control = `<select ${common}>${(field.options || []).map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(value) === String(field.value ?? '') ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`;
    } else if (field.type === 'textarea') {
      control = `<textarea ${common}>${escapeHtml(field.value || '')}</textarea>`;
    } else {
      control = `<input ${common} type="${escapeHtml(field.type || 'text')}" ${field.type === 'number' ? 'inputmode="decimal"' : ''} value="${escapeHtml(field.value ?? '')}">`;
    }
    return `<label class="${field.full ? 'full' : ''}">${escapeHtml(field.label)}${control}</label>`;
  }).join('');
  state.formSubmit = onSubmit;
  dialog.showModal();
}

export function openInfoDialog(title, body) {
  $('#dialog-title').textContent = title;
  $('#dialog-eyebrow').textContent = 'DETAILS';
  $('#dialog-fields').innerHTML = body;
  $('#dialog-error').textContent = '';
  $('#record-form').querySelector('.dialog-actions').classList.add('hidden');
  dialog.showModal();
}

function initializeForms() {
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    $('#record-form').querySelector('.dialog-actions').classList.remove('hidden');
    $('#dialog-fields').replaceChildren();
    state.formSubmit = null;
  });

  $('#record-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.formSubmit) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await state.formSubmit(values);
      dialog.close();
    } catch (error) {
      $('#dialog-error').textContent = error.message;
    }
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#login-error').textContent = '';
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(values) });
      state.token = result.token;
      state.user = result.user;
      localStorage.setItem('mati_bolts_token', state.token);
      localStorage.setItem('mati_bolts_user', JSON.stringify(state.user));
      setSignedIn(true);
      setPage('dashboard');
    } catch (error) {
      $('#login-error').textContent = error.message;
    }
  });

  $('#logout-button').addEventListener('click', signOut);
  $('#navigation').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button && !button.classList.contains('hidden')) setPage(button.dataset.page);
  });
}

export function startApp() {
  initializeForms();
  if (state.token && state.user) {
    setSignedIn(true);
    setPage('dashboard');
  } else {
    setSignedIn(false);
  }
}
