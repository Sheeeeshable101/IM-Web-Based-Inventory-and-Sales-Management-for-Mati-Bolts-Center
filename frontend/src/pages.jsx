import { useEffect, useState } from 'react';

function useResource(loader, dependencies, notify) {
  const [result, setResult] = useState({ data: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setResult({ data: null, loading: true });
    loader().then((data) => {
      if (active) setResult({ data, loading: false });
    }).catch((error) => {
      if (active) {
        setResult({ data: null, loading: false });
        notify(error.message, true);
      }
    });
    return () => { active = false; };
  }, [...dependencies, attempt]);

  return { ...result, retry: () => setAttempt((value) => value + 1) };
}

function money(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return '—';
  return new Date(String(value).replace(' ', 'T')).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function Table({ headers, rows, empty = 'No records found.' }) {
  if (!rows.length) return <div className="empty-state">{empty}</div>;
  return (
    <div className="table-panel">
      <div className="table-wrap">
        <table>
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ status }) {
  return <span className={`badge ${String(status).toLowerCase()}`}>{status}</span>;
}

function Loading({ label = 'Loading…' }) {
  return <div className="empty-state" role="status">{label}</div>;
}

function LoadFailure({ onRetry }) {
  return (
    <div className="empty-state" role="alert">
      Could not load this page.
      <button type="button" className="button secondary" onClick={onRetry}>Try again</button>
    </div>
  );
}

function PageAction({ children }) {
  return <div className="toolbar">{children}</div>;
}

function useRefresh() {
  return useState(0);
}

export function DashboardPage({ api, notify, setPage }) {
  const { data, loading, retry } = useResource(
    async () => {
      const [summary, lowStock] = await Promise.all([
        api('/reports/dashboard'),
        api('/reports/low-stock')
      ]);
      return { summary, lowStock };
    },
    [api],
    notify
  );

  if (loading) return <Loading />;
  if (!data) return <LoadFailure onRetry={retry} />;
  const { summary, lowStock } = data;
  return (
    <>
      <div className="metric-grid">
        <article className="metric-card"><div className="metric-label">Sales today</div><div className="metric-value">{money(summary.today.sales_total)}</div><div className="metric-note">Completed orders today</div></article>
        <article className="metric-card"><div className="metric-label">Orders today</div><div className="metric-value">{summary.today.order_count}</div><div className="metric-note">Completed sales</div></article>
        <article className="metric-card"><div className="metric-label">Products</div><div className="metric-value">{summary.inventory.product_count}</div><div className="metric-note">{summary.inventory.units_in_stock} units in stock</div></article>
        <article className="metric-card"><div className="metric-label">Low stock</div><div className="metric-value">{summary.low_stock_count}</div><div className="metric-note">At or below reorder level</div></article>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Recent orders</h2><p>Your latest sales activity</p></div>
            <button type="button" className="button secondary" onClick={() => setPage('orders')}>All orders</button>
          </div>
          <Table
            headers={['Order', 'Customer', 'Date', 'Total', 'Status']}
            rows={summary.recent_orders.map((order) => (
              <tr key={order.id}>
                <td><strong>#{order.id}</strong></td>
                <td>{order.customer_name || 'Walk-in'}</td>
                <td>{dateTime(order.created_at)}</td>
                <td>{money(order.total_amount)}</td>
                <td><Badge status={order.status} /></td>
              </tr>
            ))}
            empty="No sales have been recorded yet."
          />
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>Products to consider restocking</p></div></div>
          <div className="stock-list">
            {lowStock.slice(0, 7).map((product) => (
              <div className="stock-row" key={product.id}>
                <div><strong>{product.name}</strong><small>{product.sku} · Reorder at {product.reorder_level}</small></div>
                <span className="stock-number">{product.stock_quantity} left</span>
              </div>
            ))}
            {!lowStock.length && <div className="empty-state">All products are above their reorder level.</div>}
          </div>
        </section>
      </div>
    </>
  );
}

export function InventoryPage({ api, user, notify, openForm }) {
  const [refresh, setRefresh] = useRefresh();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const { data, loading, retry } = useResource(
    async () => {
      const [products, categories, suppliers] = await Promise.all([
        api('/products'), api('/categories'), api('/suppliers')
      ]);
      return { products, categories, suppliers };
    },
    [api, refresh],
    notify
  );

  if (loading) return <Loading />;
  if (!data) return <LoadFailure onRetry={retry} />;

  const openProductForm = (product = null) => openForm(
    product ? 'Edit product' : 'Add product',
    [
      { name: 'sku', label: 'SKU', required: true, value: product?.sku },
      { name: 'name', label: 'Product name', required: true, value: product?.name },
      { name: 'category_id', label: 'Category', type: 'select', required: true, value: product?.category_id, options: data.categories.map((row) => [row.id, row.name]) },
      { name: 'supplier_id', label: 'Supplier', type: 'select', value: product?.supplier_id, options: [['', 'No supplier'], ...data.suppliers.map((row) => [row.id, row.name])] },
      { name: 'size', label: 'Size', value: product?.size },
      { name: 'material', label: 'Material', value: product?.material },
      { name: 'price', label: 'Selling price (PHP)', type: 'number', step: '0.01', min: '0', required: true, value: product?.price }
    ],
    async (values) => {
      await api(product ? `/products/${product.id}` : '/products', {
        method: product ? 'PUT' : 'POST',
        body: JSON.stringify(values)
      });
      notify(product ? 'Product updated.' : 'Product added. Use Stock-in to record its starting stock.');
      setRefresh((value) => value + 1);
    }
  );

  const filteredProducts = data.products.filter((product) => {
    const text = `${product.sku} ${product.name} ${product.category_name} ${product.material || ''}`.toLowerCase();
    return text.includes(query.toLowerCase())
      && (!categoryId || String(product.category_id) === categoryId)
      && (!lowOnly || Number(product.stock_quantity) <= Number(product.reorder_level));
  });

  async function deleteProduct(productId) {
    if (!confirm('Delete this product? Products used in sales cannot be deleted.')) return;
    try {
      await api(`/products/${productId}`, { method: 'DELETE' });
      notify('Product deleted.');
      setRefresh((value) => value + 1);
    } catch (error) {
      notify(error.message, true);
    }
  }

  return (
    <>
      <PageAction><button type="button" className="button primary" onClick={() => openProductForm()}>＋ Add product</button></PageAction>
      <div className="toolbar">
        <input type="search" placeholder="Search SKU, product, or category" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter by category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
        <label className="inline-check"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /> Low stock only</label>
      </div>
      <Table
        headers={['SKU', 'Product', 'Category', 'Size / material', 'Price', 'In stock', 'Actions']}
        rows={filteredProducts.map((product) => (
          <tr key={product.id}>
            <td><strong>{product.sku}</strong></td>
            <td>{product.name}</td>
            <td>{product.category_name}</td>
            <td>{[product.size, product.material].filter(Boolean).join(' · ') || '—'}</td>
            <td>{money(product.price)}</td>
            <td>{Number(product.stock_quantity) <= Number(product.reorder_level) ? <span className="stock-number">{product.stock_quantity}</span> : product.stock_quantity}</td>
            <td><div className="table-actions">
              <button type="button" className="button secondary" onClick={() => openProductForm(product)}>Edit</button>
              {user.role === 'Admin' && <button type="button" className="button danger" onClick={() => deleteProduct(product.id)}>Delete</button>}
            </div></td>
          </tr>
        ))}
        empty="No matching products."
      />
    </>
  );
}

export function SalesPage({ api, notify, setPage }) {
  const [lookups, setLookups] = useState(null);
  const [cart, setCart] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('Completed');
  const [loading, setLoading] = useState(true);
  const [lookupError, setLookupError] = useState(false);
  const [lookupAttempt, setLookupAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLookupError(false);
    Promise.all([api('/products'), api('/categories'), api('/suppliers'), api('/customers')])
      .then(([products, categories, suppliers, customers]) => {
        if (active) setLookups({ products, categories, suppliers, customers });
      })
      .catch((error) => {
        if (active) {
          setLookupError(true);
          notify(error.message, true);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, notify, lookupAttempt]);

  if (loading) return <Loading />;
  if (lookupError || !lookups) return <LoadFailure onRetry={() => setLookupAttempt((value) => value + 1)} />;

  function addToCart() {
    const product = lookups.products.find((row) => String(row.id) === productId);
    const count = Number(quantity);
    if (!product || !Number.isInteger(count) || count < 1) {
      notify('Choose a product and valid quantity.', true);
      return;
    }
    const existing = cart.find((item) => String(item.id) === String(product.id));
    if (count + (existing?.quantity || 0) > Number(product.stock_quantity)) {
      notify(`Only ${product.stock_quantity} units are available.`, true);
      return;
    }
    setCart((items) => existing
      ? items.map((item) => String(item.id) === String(product.id) ? { ...item, quantity: item.quantity + count } : item)
      : [...items, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        stock_quantity: Number(product.stock_quantity),
        quantity: count
      }]);
  }

  function changeQuantity(index, rawValue) {
    const item = cart[index];
    const count = Number(rawValue);
    if (!Number.isInteger(count) || count < 1 || count > item.stock_quantity) {
      notify(`Quantity must be between 1 and ${item.stock_quantity}.`, true);
      return;
    }
    setCart((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: count } : row));
  }

  async function checkout() {
    if (!cart.length) {
      notify('Add at least one product to the sale.', true);
      return;
    }
    try {
      const result = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId || null,
          status,
          items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity }))
        })
      });
      setCart([]);
      notify(`Order #${result.id} saved as ${result.status.toLowerCase()} for ${money(result.total_amount)}.`);
      setPage('orders');
    } catch (error) {
      notify(error.message, true);
    }
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className="cart-layout">
      <section className="panel">
        <div className="panel-heading"><div><h2>Build a sale</h2><p>Add products to the current order</p></div></div>
        <div className="toolbar">
          <select aria-label="Product" value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Choose a product</option>
            {lookups.products.map((product) => (
              <option value={product.id} disabled={Number(product.stock_quantity) < 1} key={product.id}>
                {product.sku} · {product.name} ({product.stock_quantity} available)
              </option>
            ))}
          </select>
          <input type="number" min="1" value={quantity} aria-label="Quantity" onChange={(event) => setQuantity(event.target.value)} />
          <button type="button" id="add-to-cart" className="button secondary" onClick={addToCart}>Add item</button>
        </div>
        <div className="cart-list">
          {cart.map((item, index) => (
            <div className="cart-item" key={item.id}>
              <div><strong>{item.name}</strong><small>{money(item.price)} each</small></div>
              <input className="cart-qty" type="number" min="1" max={item.stock_quantity} value={item.quantity} aria-label={`Quantity for ${item.name}`} onChange={(event) => changeQuantity(index, event.target.value)} />
              <strong>{money(item.price * item.quantity)}</strong>
              <button type="button" className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
            </div>
          ))}
          {!cart.length && <div className="empty-state">Your sale is empty. Choose products to begin.</div>}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Order summary</h2><p>Prices are checked by the server</p></div></div>
        <label className="form-grid-label">Customer
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Walk-in customer</option>
            {lookups.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <label className="form-grid-label">Order status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="Completed">Completed</option><option value="Pending">Pending</option>
          </select>
        </label>
        <div className="total-line"><span>Total</span><strong>{money(total)}</strong></div>
        <button type="button" id="checkout-button" className="button primary wide" onClick={checkout}>Save order</button>
      </section>
    </div>
  );
}

export function OrdersPage({ api, notify, openInfo }) {
  const [refresh, setRefresh] = useRefresh();
  const { data: orders, loading, retry } = useResource(() => api('/orders'), [api, refresh], notify);

  async function updateStatus(order, status) {
    try {
      await api(`/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      notify(status === 'Cancelled' ? 'Order cancelled and stock restored.' : 'Order marked completed.');
      setRefresh((value) => value + 1);
    } catch (error) {
      notify(error.message, true);
    }
  }

  async function showDetails(orderId) {
    try {
      const order = await api(`/orders/${orderId}`);
      openInfo(`Order #${order.id}`, <>
        <div><strong>Customer:</strong> {order.customer_name || 'Walk-in'}</div>
        <div><strong>Staff:</strong> {order.staff_name}</div>
        <div><strong>Date:</strong> {dateTime(order.created_at)}</div>
        <div><strong>Status:</strong> <Badge status={order.status} /></div>
        <div><strong>Items:</strong></div>
        {order.items.map((item, index) => <div key={`${item.sku}-${index}`}>{item.quantity} × {item.name} ({item.sku}) — {money(item.line_total)}</div>)}
        <div><strong>Total: {money(order.total_amount)}</strong></div>
      </>);
    } catch (error) {
      notify(error.message, true);
    }
  }

  if (loading) return <Loading />;
  if (!orders) return <LoadFailure onRetry={retry} />;
  return (
    <Table
      headers={['Order', 'Customer', 'Staff', 'Items', 'Date', 'Total', 'Status', 'Actions']}
      rows={orders.map((order) => (
        <tr key={order.id}>
          <td><strong>#{order.id}</strong></td>
          <td>{order.customer_name || 'Walk-in'}</td>
          <td>{order.staff_name}</td>
          <td>{order.item_count}</td>
          <td>{dateTime(order.created_at)}</td>
          <td>{money(order.total_amount)}</td>
          <td><Badge status={order.status} /></td>
          <td><div className="table-actions">
            <button type="button" className="button secondary" onClick={() => showDetails(order.id)}>Details</button>
            {order.status === 'Pending' && <button type="button" className="button secondary" onClick={() => updateStatus(order, 'Completed')}>Complete</button>}
            {order.status !== 'Cancelled' && <button type="button" className="button danger" onClick={() => {
              if (confirm(`Cancel order #${order.id}? Its items will be returned to stock.`)) updateStatus(order, 'Cancelled');
            }}>Cancel</button>}
          </div></td>
        </tr>
      ))}
      empty="No orders recorded yet."
    />
  );
}

export function StockInPage({ api, notify, openForm }) {
  const [refresh, setRefresh] = useRefresh();
  const { data, loading, retry } = useResource(
    async () => {
      const [rows, products, suppliers] = await Promise.all([
        api('/stock-in'), api('/products'), api('/suppliers')
      ]);
      return { rows, products, suppliers };
    },
    [api, refresh],
    notify
  );

  if (loading) return <Loading />;
  if (!data) return <LoadFailure onRetry={retry} />;
  function addStockIn() {
    openForm('Record stock-in', [
      { name: 'product_id', label: 'Product', type: 'select', required: true, options: data.products.map((product) => [product.id, `${product.sku} · ${product.name}`]) },
      { name: 'supplier_id', label: 'Supplier', type: 'select', options: [['', 'No supplier'], ...data.suppliers.map((supplier) => [supplier.id, supplier.name])] },
      { name: 'quantity', label: 'Quantity received', type: 'number', min: '1', required: true },
      { name: 'cost_per_unit', label: 'Cost per unit (PHP)', type: 'number', min: '0', step: '0.01', required: true },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true }
    ], async (values) => {
      await api('/stock-in', { method: 'POST', body: JSON.stringify(values) });
      notify('Stock-in recorded and inventory updated.');
      setRefresh((value) => value + 1);
    });
  }

  return (
    <>
      <PageAction><button type="button" className="button primary" onClick={addStockIn}>＋ Record stock-in</button></PageAction>
      <Table
        headers={['Date', 'Product', 'Supplier', 'Quantity', 'Cost / unit', 'Recorded by', 'Notes']}
        rows={data.rows.map((row) => (
          <tr key={row.id}>
            <td>{dateTime(row.received_at)}</td>
            <td><strong>{row.product_name}</strong><small className="muted"> {row.sku}</small></td>
            <td>{row.supplier_name || '—'}</td>
            <td>{row.quantity}</td>
            <td>{money(row.cost_per_unit)}</td>
            <td>{row.staff_name}</td>
            <td>{row.notes || '—'}</td>
          </tr>
        ))}
        empty="No deliveries recorded yet."
      />
    </>
  );
}

export function CategoriesPage({ api, notify, openForm }) {
  const [refresh, setRefresh] = useRefresh();
  const { data, loading, retry } = useResource(
    async () => {
      const [categories, products] = await Promise.all([api('/categories'), api('/products')]);
      return { categories, products };
    },
    [api, refresh],
    notify
  );

  if (loading) return <Loading />;
  if (!data) return <LoadFailure onRetry={retry} />;
  return (
    <>
      <PageAction>
        <button type="button" className="button primary" onClick={() => openForm('Add category', [
          { name: 'name', label: 'Category name', required: true },
          { name: 'description', label: 'Description', type: 'textarea', full: true }
        ], async (values) => {
          await api('/categories', { method: 'POST', body: JSON.stringify(values) });
          notify('Category added.');
          setRefresh((value) => value + 1);
        })}>＋ Add category</button>
      </PageAction>
      <Table
        headers={['Category', 'Description', 'Products']}
        rows={data.categories.map((category) => (
          <tr key={category.id}>
            <td><strong>{category.name}</strong></td>
            <td>{category.description || '—'}</td>
            <td>{data.products.filter((product) => Number(product.category_id) === Number(category.id)).length || '—'}</td>
          </tr>
        ))}
        empty="No categories added."
      />
    </>
  );
}

function contactFields(record = {}, includeAddress = false) {
  return [
    { name: 'name', label: 'Name', required: true, value: record.name },
    { name: 'phone', label: 'Phone', value: record.phone },
    { name: 'email', label: 'Email', type: 'email', value: record.email },
    ...(includeAddress ? [{ name: 'address', label: 'Address', type: 'textarea', full: true, value: record.address }] : [])
  ];
}

export function SuppliersPage({ api, user, notify, openForm }) {
  const [refresh, setRefresh] = useRefresh();
  const { data: suppliers, loading, retry } = useResource(() => api('/suppliers'), [api, refresh], notify);

  if (loading) return <Loading />;
  if (!suppliers) return <LoadFailure onRetry={retry} />;
  const isAdmin = user.role === 'Admin';

  function addSupplier() {
    openForm('Add supplier', contactFields({ address: '' }, true), async (values) => {
      await api('/suppliers', { method: 'POST', body: JSON.stringify(values) });
      notify('Supplier added.');
      setRefresh((value) => value + 1);
    });
  }

  async function deleteSupplier(id) {
    if (!confirm('Delete this supplier? Linked products and deliveries will keep working without a supplier.')) return;
    try {
      await api(`/suppliers/${id}`, { method: 'DELETE' });
      notify('Supplier deleted.');
      setRefresh((value) => value + 1);
    } catch (error) {
      notify(error.message, true);
    }
  }

  return (
    <>
      {isAdmin && <PageAction><button type="button" className="button primary" onClick={addSupplier}>＋ Add supplier</button></PageAction>}
      <Table
        headers={['Supplier', 'Phone', 'Email', 'Address', ...(isAdmin ? ['Actions'] : [])]}
        rows={suppliers.map((supplier) => (
          <tr key={supplier.id}>
            <td><strong>{supplier.name}</strong></td>
            <td>{supplier.phone || '—'}</td>
            <td>{supplier.email || '—'}</td>
            <td>{supplier.address || '—'}</td>
            {isAdmin && <td><div className="table-actions">
              <button type="button" className="button secondary" onClick={() => openForm('Edit supplier', contactFields(supplier, true), async (values) => {
                await api(`/suppliers/${supplier.id}`, { method: 'PUT', body: JSON.stringify(values) });
                notify('Supplier updated.');
                setRefresh((value) => value + 1);
              })}>Edit</button>
              <button type="button" className="button danger" onClick={() => deleteSupplier(supplier.id)}>Delete</button>
            </div></td>}
          </tr>
        ))}
        empty="No suppliers added."
      />
    </>
  );
}

export function CustomersPage({ api, notify, openForm }) {
  const [refresh, setRefresh] = useRefresh();
  const { data: customers, loading, retry } = useResource(() => api('/customers'), [api, refresh], notify);

  if (loading) return <Loading />;
  if (!customers) return <LoadFailure onRetry={retry} />;
  return (
    <>
      <PageAction><button type="button" className="button primary" onClick={() => openForm('Add customer', contactFields(), async (values) => {
        await api('/customers', { method: 'POST', body: JSON.stringify(values) });
        notify('Customer added.');
        setRefresh((value) => value + 1);
      })}>＋ Add customer</button></PageAction>
      <Table
        headers={['Customer', 'Phone', 'Email', 'Added']}
        rows={customers.map((customer) => (
          <tr key={customer.id}>
            <td><strong>{customer.name}</strong></td>
            <td>{customer.phone || '—'}</td>
            <td>{customer.email || '—'}</td>
            <td>{dateTime(customer.created_at)}</td>
          </tr>
        ))}
        empty="No customers added."
      />
    </>
  );
}

export function ReportsPage({ api, notify }) {
  const { data: lowStock, loading, retry } = useResource(() => api('/reports/low-stock'), [api], notify);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  async function runReport(event) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setReportLoading(true);
    try {
      const result = await api(`/reports/sales?${params}`);
      setReport(result);
    } catch (error) {
      notify(error.message, true);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => { runReport(); }, [api]);

  if (loading) return <Loading />;
  if (!lowStock) return <LoadFailure onRetry={retry} />;
  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-heading"><div><h2>Sales report</h2><p>Completed sales by day and best-selling products</p></div></div>
        <form className="toolbar" onSubmit={runReport}>
          <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button type="submit" className="button primary" disabled={reportLoading}>{reportLoading ? 'Running…' : 'Run report'}</button>
        </form>
        {reportLoading && !report && <Loading label="Loading report…" />}
        {report && (
          <div className="report-grid">
            <Table
              headers={['Date', 'Orders', 'Sales']}
              rows={report.daily.map((day) => <tr key={day.sale_date}><td>{day.sale_date}</td><td>{day.order_count}</td><td>{money(day.sales_total)}</td></tr>)}
              empty="No sales in this date range."
            />
            <Table
              headers={['Best sellers', 'Units', 'Sales']}
              rows={report.top_sellers.map((product) => <tr key={product.name}><td><strong>{product.name}</strong></td><td>{product.quantity_sold}</td><td>{money(product.sales_total)}</td></tr>)}
              empty="No products sold in this date range."
            />
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Low-stock products</h2><p>Current quantity is at or below reorder level</p></div></div>
        <Table
          headers={['SKU', 'Product', 'Category', 'In stock', 'Reorder at']}
          rows={lowStock.map((product) => (
            <tr key={product.id}>
              <td><strong>{product.sku}</strong></td><td>{product.name}</td><td>{product.category_name}</td>
              <td><span className="stock-number">{product.stock_quantity}</span></td><td>{product.reorder_level}</td>
            </tr>
          ))}
          empty="No products need restocking."
        />
      </section>
    </>
  );
}

export function UsersPage({ api, user, notify, openForm }) {
  const [refresh, setRefresh] = useRefresh();
  const { data: users, loading, retry } = useResource(() => api('/users'), [api, refresh], notify);

  if (loading) return <Loading />;
  if (!users) return <LoadFailure onRetry={retry} />;
  function userFields(record = null) {
    return [
      { name: 'name', label: 'Full name', required: true, value: record?.name },
      { name: 'username', label: 'Username', required: true, value: record?.username },
      { name: 'password', label: record ? 'New password (leave blank to keep current)' : 'Temporary password (12+ characters)', type: 'password', required: !record, minlength: '12' },
      { name: 'role', label: 'Role', type: 'select', required: true, value: record?.role || 'Staff', options: [['Staff', 'Staff'], ['Admin', 'Admin']] },
      ...(record ? [{ name: 'active', label: 'Account status', type: 'select', value: record.active ? 'true' : 'false', options: [['true', 'Active'], ['false', 'Inactive']] }] : [])
    ];
  }

  function addUser() {
    openForm('Add user', userFields(), async (values) => {
      await api('/users', { method: 'POST', body: JSON.stringify(values) });
      notify('User created.');
      setRefresh((value) => value + 1);
    });
  }

  async function deleteUser(id) {
    if (!confirm('Delete this account? Accounts with sales history cannot be deleted.')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      notify('User deleted.');
      setRefresh((value) => value + 1);
    } catch (error) {
      notify(error.message, true);
    }
  }

  return (
    <>
      <PageAction><button type="button" className="button primary" onClick={addUser}>＋ Add user</button></PageAction>
      <Table
        headers={['User', 'Username', 'Role', 'Status', 'Created', 'Actions']}
        rows={users.map((record) => (
          <tr key={record.id}>
            <td><strong>{record.name}</strong></td><td>{record.username}</td><td>{record.role}</td>
            <td><Badge status={record.active ? 'Active' : 'Inactive'} /></td><td>{dateTime(record.created_at)}</td>
            <td><div className="table-actions">
              <button type="button" className="button secondary" onClick={() => openForm('Edit user', userFields(record), async (values) => {
                values.active = values.active === 'true';
                await api(`/users/${record.id}`, { method: 'PUT', body: JSON.stringify(values) });
                notify('User updated.');
                setRefresh((value) => value + 1);
              })}>Edit</button>
              <button type="button" className="button danger" disabled={Number(record.id) === Number(user.id)} onClick={() => deleteUser(record.id)}>Delete</button>
            </div></td>
          </tr>
        ))}
        empty="No user accounts found."
      />
    </>
  );
}
