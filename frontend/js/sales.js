import { $, api, escapeHtml, loadLookups, money, setPage, state, toast } from './core.js';

export async function renderSales() {
  await loadLookups();
  $('#page-content').innerHTML = `
    <div class="cart-layout">
      <section class="panel"><div class="panel-heading"><div><h2>Build a sale</h2><p>Add products to the current order</p></div></div>
        <div class="toolbar"><select id="sale-product"><option value="">Choose a product</option>${state.products.map((p) => `<option value="${p.id}" ${p.stock_quantity < 1 ? 'disabled' : ''}>${escapeHtml(p.sku)} · ${escapeHtml(p.name)} (${escapeHtml(p.stock_quantity)} available)</option>`).join('')}</select><input id="sale-quantity" type="number" min="1" value="1" aria-label="Quantity"><button id="add-to-cart" class="button secondary">Add item</button></div>
        <div id="cart-items" class="cart-list"></div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Order summary</h2><p>Prices are checked by the server</p></div></div>
        <label class="form-grid-label">Customer<select id="sale-customer"><option value="">Walk-in customer</option>${state.customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label>
        <label class="form-grid-label">Order status<select id="sale-status"><option value="Completed">Completed</option><option value="Pending">Pending</option></select></label>
        <div class="total-line"><span>Total</span><strong id="cart-total">${money(0)}</strong></div>
        <button id="checkout-button" class="button primary wide">Save order</button>
      </section>
    </div>`;
  const renderCart = () => {
    $('#cart-items').innerHTML = state.cart.map((item, index) => `<div class="cart-item"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} each</small></div><input class="cart-qty" type="number" min="1" max="${item.stock_quantity}" value="${item.quantity}" data-cart-qty="${index}" aria-label="Quantity for ${escapeHtml(item.name)}"><strong>${money(item.price * item.quantity)}</strong><button class="icon-button" data-remove-cart="${index}" aria-label="Remove item">×</button></div>`).join('') || '<div class="empty-state">Your sale is empty. Choose products to begin.</div>';
    $('#cart-total').textContent = money(state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
    $('#cart-items').querySelectorAll('[data-remove-cart]').forEach((button) => button.addEventListener('click', () => {
      state.cart.splice(Number(button.dataset.removeCart), 1);
      renderCart();
    }));
    $('#cart-items').querySelectorAll('[data-cart-qty]').forEach((input) => input.addEventListener('change', () => {
      const item = state.cart[Number(input.dataset.cartQty)];
      const quantity = Number(input.value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.stock_quantity) {
        input.value = item.quantity;
        toast(`Quantity must be between 1 and ${item.stock_quantity}.`, true);
        return;
      }
      item.quantity = quantity;
      renderCart();
    }));
  };
  state.cart = [];
  renderCart();
  $('#add-to-cart').addEventListener('click', () => {
    const product = state.products.find((row) => String(row.id) === $('#sale-product').value);
    const quantity = Number($('#sale-quantity').value);
    if (!product || !Number.isInteger(quantity) || quantity < 1) return toast('Choose a product and valid quantity.', true);
    const existing = state.cart.find((item) => item.id === product.id);
    if (quantity + (existing?.quantity || 0) > product.stock_quantity) return toast(`Only ${product.stock_quantity} units are available.`, true);
    if (existing) existing.quantity += quantity;
    else state.cart.push({ id: product.id, name: product.name, price: Number(product.price), stock_quantity: Number(product.stock_quantity), quantity });
    renderCart();
  });
  $('#checkout-button').addEventListener('click', async () => {
    if (!state.cart.length) return toast('Add at least one product to the sale.', true);
    try {
      const result = await api('/orders', { method: 'POST', body: JSON.stringify({
        customer_id: $('#sale-customer').value || null,
        status: $('#sale-status').value,
        items: state.cart.map((item) => ({ product_id: item.id, quantity: item.quantity }))
      }) });
      state.cart = [];
      toast(`Order #${result.id} saved as ${result.status.toLowerCase()} for ${money(result.total_amount)}.`);
      setPage('orders');
    } catch (error) { toast(error.message, true); }
  });
}
