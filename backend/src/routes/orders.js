const express = require('express');
const db = require('../db');
const { HttpError, wrap, positiveInteger, nullableId } = require('./common');

const router = express.Router();

router.post('/orders', wrap(async (req, res) => {
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    throw new HttpError(400, 'An order must contain at least one item.');
  }
  const items = req.body.items.map((item) => ({
    productId: positiveInteger(item.product_id, 'product_id'),
    quantity: positiveInteger(item.quantity, 'quantity')
  })).sort((a, b) => a.productId - b.productId);
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new HttpError(400, 'Each product may only appear once in an order.');
  }
  const customerId = nullableId(req.body.customer_id, 'customer_id');
  const status = req.body.status === undefined ? 'Completed' : req.body.status;
  if (!['Pending', 'Completed'].includes(status)) {
    throw new HttpError(400, 'New orders may be Pending or Completed.');
  }
  const result = await db.execute(db.client.rpc('api_create_order', {
    p_customer_id: customerId,
    p_user_id: req.user.id,
    p_status: status,
    p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity }))
  }));
  res.status(201).json(result);
}));

router.get('/orders', wrap(async (req, res) => {
  const orders = await db.execute(db.client
    .from('sales_order')
    .select('id, total_amount, status, created_at, user_id, customer_id')
    .order('created_at', { ascending: false })
    .limit(200));
  const orderIds = orders.map((order) => order.id);
  const userIds = [...new Set(orders.map((order) => order.user_id))];
  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
  const [users, customers, items] = await Promise.all([
    userIds.length ? db.allRows(() => db.client.from('user').select('id, name').in('id', userIds)) : [],
    customerIds.length ? db.allRows(() => db.client.from('customer').select('id, name').in('id', customerIds)) : [],
    orderIds.length ? db.allRows(() => db.client.from('order_item').select('sales_order_id').in('sales_order_id', orderIds)) : []
  ]);
  const userNames = new Map(users.map((user) => [String(user.id), user.name]));
  const customerNames = new Map(customers.map((customer) => [String(customer.id), customer.name]));
  const itemCounts = new Map();
  for (const item of items) {
    const key = String(item.sales_order_id);
    itemCounts.set(key, (itemCounts.get(key) || 0) + 1);
  }
  res.json(orders.map((order) => ({
    id: order.id,
    total_amount: order.total_amount,
    status: order.status,
    created_at: order.created_at,
    staff_name: userNames.get(String(order.user_id)),
    customer_name: customerNames.get(String(order.customer_id)) || null,
    item_count: itemCounts.get(String(order.id)) || 0
  })));
}));

router.get('/orders/:id', wrap(async (req, res) => {
  const id = positiveInteger(req.params.id, 'id');
  const order = await db.execute(db.client.from('sales_order').select('*').eq('id', id).maybeSingle());
  if (!order) throw new HttpError(404, 'Order not found.');
  const [users, customers, items] = await Promise.all([
    db.execute(db.client.from('user').select('id, name').eq('id', order.user_id)),
    order.customer_id
      ? db.execute(db.client.from('customer').select('id, name').eq('id', order.customer_id))
      : [],
    db.allRows(() => db.client.from('order_item')
      .select('product_id, quantity, unit_price, line_total')
      .eq('sales_order_id', id))
  ]);
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const products = productIds.length
    ? await db.allRows(() => db.client.from('product').select('id, sku, name').in('id', productIds))
    : [];
  const productDetails = new Map(products.map((product) => [String(product.id), product]));
  res.json({
    ...order,
    staff_name: users[0]?.name,
    customer_name: customers[0]?.name || null,
    items: items.map((item) => ({
      ...item,
      sku: productDetails.get(String(item.product_id))?.sku,
      name: productDetails.get(String(item.product_id))?.name
    }))
  });
}));

router.patch('/orders/:id/status', wrap(async (req, res) => {
  if (!['Pending', 'Completed', 'Cancelled'].includes(req.body.status)) {
    throw new HttpError(400, 'status must be Pending, Completed, or Cancelled.');
  }
  const result = await db.execute(db.client.rpc('api_update_order_status', {
    p_order_id: positiveInteger(req.params.id, 'id'),
    p_status: req.body.status
  }));
  res.json(result);
}));

module.exports = router;
