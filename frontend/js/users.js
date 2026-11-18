import { $, api, badge, content, dateTime, escapeHtml, openRecordDialog, setPageAction, state, table, toast } from './core.js';

export async function renderUsers() {
  const users = await api('/users');
  setPageAction('＋ Add user', () => openRecordDialog('Add user', [
    { name: 'name', label: 'Full name', required: true },
    { name: 'username', label: 'Username', required: true },
    { name: 'password', label: 'Temporary password (12+ characters)', type: 'password', required: true, minlength: '12' },
    { name: 'role', label: 'Role', type: 'select', required: true, options: [['Staff', 'Staff'], ['Admin', 'Admin']] }
  ], async (values) => {
    await api('/users', { method: 'POST', body: JSON.stringify(values) });
    toast('User created.');
    renderUsers();
  }));
  content.innerHTML = table(['User', 'Username', 'Role', 'Status', 'Created', 'Actions'], users.map((u) => `<tr><td><strong>${escapeHtml(u.name)}</strong></td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.role)}</td><td>${badge(u.active ? 'Active' : 'Inactive')}</td><td>${dateTime(u.created_at)}</td><td><div class="table-actions"><button class="button secondary" data-edit-user="${u.id}">Edit</button><button class="button danger" data-delete-user="${u.id}" ${Number(u.id) === Number(state.user.id) ? 'disabled' : ''}>Delete</button></div></td></tr>`), 'No user accounts found.');
  content.querySelectorAll('[data-edit-user]').forEach((button) => button.addEventListener('click', () => {
    const user = users.find((u) => String(u.id) === button.dataset.editUser);
    openRecordDialog('Edit user', [
      { name: 'name', label: 'Full name', required: true, value: user.name },
      { name: 'username', label: 'Username', required: true, value: user.username },
      { name: 'password', label: 'New password (leave blank to keep current)', type: 'password', minlength: '12' },
      { name: 'role', label: 'Role', type: 'select', required: true, value: user.role, options: [['Staff', 'Staff'], ['Admin', 'Admin']] },
      { name: 'active', label: 'Account status', type: 'select', value: user.active ? 'true' : 'false', options: [['true', 'Active'], ['false', 'Inactive']] }
    ], async (values) => {
      values.active = values.active === 'true';
      await api(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(values) });
      toast('User updated.');
      renderUsers();
    });
  }));
  content.querySelectorAll('[data-delete-user]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Delete this account? Accounts with sales history cannot be deleted.')) return;
    try {
      await api(`/users/${button.dataset.deleteUser}`, { method: 'DELETE' });
      toast('User deleted.');
      renderUsers();
    } catch (error) { toast(error.message, true); }
  }));
}
