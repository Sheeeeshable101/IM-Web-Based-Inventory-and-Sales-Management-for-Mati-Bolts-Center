import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CategoriesPage,
  CustomersPage,
  DashboardPage,
  InventoryPage,
  OrdersPage,
  ReportsPage,
  SalesPage,
  StockInPage,
  SuppliersPage,
  UsersPage
} from './pages.jsx';

const pages = {
  dashboard: { title: 'Dashboard', eyebrow: 'OVERVIEW', component: DashboardPage },
  inventory: { title: 'Inventory', eyebrow: 'OPERATIONS', component: InventoryPage },
  sales: { title: 'New sale', eyebrow: 'OPERATIONS', component: SalesPage },
  orders: { title: 'Orders', eyebrow: 'OPERATIONS', component: OrdersPage },
  'stock-in': { title: 'Stock-in', eyebrow: 'OPERATIONS', component: StockInPage },
  categories: { title: 'Categories', eyebrow: 'MANAGE', component: CategoriesPage, adminOnly: true },
  suppliers: { title: 'Suppliers', eyebrow: 'MANAGE', component: SuppliersPage },
  customers: { title: 'Customers', eyebrow: 'MANAGE', component: CustomersPage },
  reports: { title: 'Reports', eyebrow: 'INSIGHTS', component: ReportsPage },
  users: { title: 'Users', eyebrow: 'ADMINISTRATION', component: UsersPage, adminOnly: true }
};

const navigation = [
  { page: 'dashboard', icon: '▦', label: 'Dashboard' },
  { caption: 'OPERATIONS' },
  { page: 'inventory', icon: '▤', label: 'Inventory' },
  { page: 'sales', icon: '＋', label: 'New sale' },
  { page: 'orders', icon: '≡', label: 'Orders' },
  { page: 'stock-in', icon: '↓', label: 'Stock-in' },
  { caption: 'MANAGE' },
  { page: 'categories', icon: '◫', label: 'Categories', adminOnly: true },
  { page: 'suppliers', icon: '▱', label: 'Suppliers' },
  { page: 'customers', icon: '♙', label: 'Customers' },
  { page: 'reports', icon: '▥', label: 'Reports' },
  { page: 'users', icon: '♧', label: 'Users', adminOnly: true }
];

function readSession() {
  const token = localStorage.getItem('mati_bolts_token');
  const savedUser = localStorage.getItem('mati_bolts_user');
  if (!token || !savedUser) return null;

  try {
    const user = JSON.parse(savedUser);
    return user && user.id && user.name && user.role ? { token, user } : null;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem('mati_bolts_token');
  localStorage.removeItem('mati_bolts_user');
}

function App() {
  const [session, setSession] = useState(readSession);
  const [page, setPage] = useState('dashboard');
  const [toastMessage, setToastMessage] = useState(null);
  const [dialog, setDialog] = useState(null);

  const notify = useCallback((message, error = false) => {
    setToastMessage({ message, error });
  }, []);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = setTimeout(() => setToastMessage(null), 3600);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const request = useCallback(async (path, options = {}) => {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

    let response;
    try {
      response = await fetch(`/api${path}`, { ...options, headers });
    } catch {
      throw new Error('Cannot reach the API. Check that the backend is running.');
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login') {
        clearStoredSession();
        setSession(null);
      }
      throw new Error(payload?.error || `Request failed (${response.status}).`);
    }
    return payload;
  }, [session]);

  const signOut = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setPage('dashboard');
  }, []);

  const signIn = useCallback(async (values) => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(values)
    });
    const nextSession = { token: result.token, user: result.user };
    localStorage.setItem('mati_bolts_token', nextSession.token);
    localStorage.setItem('mati_bolts_user', JSON.stringify(nextSession.user));
    setSession(nextSession);
    setPage('dashboard');
  }, [request]);

  useEffect(() => {
    if (session && pages[page]?.adminOnly && session.user.role !== 'Admin') {
      setPage('dashboard');
    }
  }, [page, session]);

  if (!session) return <LoginScreen onSignIn={signIn} />;

  const currentPage = pages[page] || pages.dashboard;
  const Page = currentPage.component;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Mati Bolts home" onClick={(event) => {
          event.preventDefault();
          setPage('dashboard');
        }}>
          <span className="brand-mark">MB</span>
          <span><strong>Mati Bolts</strong><small>Inventory &amp; Sales</small></span>
        </a>
        <nav id="navigation" aria-label="Main navigation">
          {navigation.map((item) => {
            if (item.caption) return <p className="nav-caption" key={item.caption}>{item.caption}</p>;
            if (item.adminOnly && session.user.role !== 'Admin') return null;
            return (
              <button
                key={item.page}
                type="button"
                data-page={item.page}
                className={`nav-link${page === item.page ? ' active' : ''}`}
                aria-current={page === item.page ? 'page' : undefined}
                onClick={() => setPage(item.page)}
              >
                <span aria-hidden="true">{item.icon}</span>{item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</div>
          <div className="user-summary">
            <strong>{session.user.name}</strong>
            <small>{session.user.role}</small>
          </div>
          <button type="button" className="icon-button" title="Sign out" aria-label="Sign out" onClick={signOut}>↗</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">{currentPage.eyebrow}</p><h1>{currentPage.title}</h1></div>
        </header>
        <section id="page-content" aria-live="polite">
          <Page
            api={request}
            user={session.user}
            notify={notify}
            setPage={setPage}
            openForm={(title, fields, onSubmit) => setDialog({ type: 'form', title, fields, onSubmit })}
            openInfo={(title, content) => setDialog({ type: 'info', title, content })}
          />
        </section>
      </main>

      {toastMessage && (
        <div className={`toast${toastMessage.error ? ' error' : ''}`} role="status">
          {toastMessage.message}
        </div>
      )}
      <RecordDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function LoginScreen({ onSignIn }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await onSignIn(values);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="login-screen" className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">MB</div>
        <p className="eyebrow">MATI BOLTS CENTER</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage inventory and sales.</p>
        <label>Username<input name="username" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="button primary wide" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="error-message" role="alert">{error}</p>
      </form>
    </div>
  );
}

function RecordDialog({ dialog, onClose }) {
  const dialogRef = useRef(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError('');
    setSubmitting(false);
    const node = dialogRef.current;
    if (dialog && node && !node.open) node.showModal();
    if (!dialog && node?.open) node.close();
  }, [dialog]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (dialog?.type !== 'form') return;
    setError('');
    setSubmitting(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await dialog.onSubmit(values);
      dialogRef.current?.close();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="record-dialog"
      aria-labelledby="dialog-title"
      onClose={onClose}
    >
      {dialog && (
        <form onSubmit={handleSubmit}>
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">{dialog.type === 'form' ? 'RECORD' : 'DETAILS'}</p>
              <h2 id="dialog-title">{dialog.title}</h2>
            </div>
            <button type="button" className="icon-button" onClick={() => dialogRef.current?.close()} aria-label="Close dialog">×</button>
          </div>
          {dialog.type === 'form'
            ? <div className="form-grid">{dialog.fields.map((field) => <RecordField key={field.name} field={field} />)}</div>
            : <div className="detail-list">{dialog.content}</div>}
          <p className="error-message" role="alert">{error}</p>
          {dialog.type === 'form' && (
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="button primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
            </div>
          )}
        </form>
      )}
    </dialog>
  );
}

function RecordField({ field }) {
  const common = {
    name: field.name,
    required: field.required,
    min: field.min,
    max: field.max,
    step: field.step,
    minLength: field.minlength,
    defaultValue: field.value ?? ''
  };
  let control;
  if (field.type === 'select') {
    control = (
      <select {...common}>
        {(field.options || []).map(([value, label]) => (
          <option value={value} key={String(value)}>{label}</option>
        ))}
      </select>
    );
  } else if (field.type === 'textarea') {
    control = <textarea {...common} />;
  } else {
    control = <input {...common} type={field.type || 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined} />;
  }
  return <label className={field.full ? 'full' : undefined}>{field.label}{control}</label>;
}

export default App;
