const express = require('express');
const pool = require('../db');
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let total = 0;
    const pricedItems = [];
    for (const item of items) {
      const [products] = await connection.execute(
        'SELECT id, name, price, stock_quantity FROM product WHERE id = ? FOR UPDATE',
        [item.productId]
      );
      const product = products[0];
      if (!product) throw new HttpError(404, `Product ${item.productId} was not found.`);
      if (product.stock_quantity < item.quantity) {
        throw new HttpError(409, `Not enough stock for ${product.name}. Available: ${product.stock_quantity}.`);
      }
      const lineTotal = Math.round(product.price * item.quantity * 100) / 100;
      total = Math.round((total + lineTotal) * 100) / 100;
      pricedItems.push({ ...item, price: product.price, lineTotal });
    }
    if (customerId) {
      const [customers] = await connection.execute('SELECT id FROM customer WHERE id = ?', [customerId]);
      if (!customers.length) throw new HttpError(400, 'Selected customer does not exist.');
    }
    const [orderResult] = await connection.execute(
      'INSERT INTO sales_order (customer_id, user_id, total_amount, status) VALUES (?, ?, ?, ?)',
      [customerId, req.user.id, total, status]
    );
    for (const item of pricedItems) {
      await connection.execute(
        'INSERT INTO order_item (sales_order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
        [orderResult.insertId, item.productId, item.quantity, item.price, item.lineTotal]
      );
      await connection.execute(
        'UPDATE product SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }
    await connection.commit();
    res.status(201).json({ id: orderResult.insertId, total_amount: total, status });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/orders', wrap(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS staff_name,
      c.name AS customer_name,
      (SELECT COUNT(*) FROM order_item oi WHERE oi.sales_order_id = o.id) AS item_count
     FROM sales_order o JOIN \`user\` u ON u.id = o.user_id
     LEFT JOIN customer c ON c.id = o.customer_id
     ORDER BY o.created_at DESC LIMIT 200`
  );
  res.json(rows);
}));

router.get('/orders/:id', wrap(async (req, res) => {
  const id = positiveInteger(req.params.id, 'id');
  const [orders] = await pool.execute(
    `SELECT o.*, u.name AS staff_name, c.name AS customer_name
     FROM sales_order o JOIN \`user\` u ON u.id = o.user_id
     LEFT JOIN customer c ON c.id = o.customer_id WHERE o.id = ?`,
    [id]
  );
  if (!orders.length) throw new HttpError(404, 'Order not found.');
  const [items] = await pool.execute(
    `SELECT oi.product_id, p.sku, p.name, oi.quantity, oi.unit_price, oi.line_total
     FROM order_item oi JOIN product p ON p.id = oi.product_id WHERE oi.sales_order_id = ?`,
    [id]
  );
  res.json({ ...orders[0], items });
}));

router.patch('/orders/:id/status', wrap(async (req, res) => {
  if (!['Pending', 'Completed', 'Cancelled'].includes(req.body.status)) {
    throw new HttpError(400, 'status must be Pending, Completed, or Cancelled.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute(
      'SELECT id, status FROM sales_order WHERE id = ? FOR UPDATE',
      [positiveInteger(req.params.id, 'id')]
    );
    const order = orders[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === 'Cancelled') throw new HttpError(409, 'A cancelled order cannot be reopened.');
    if (order.status === 'Completed' && req.body.status === 'Pending') {
      throw new HttpError(409, 'A completed order cannot be changed back to pending.');
    }
    if (req.body.status === 'Cancelled' && order.status !== 'Cancelled') {
      const [items] = await connection.execute(
        'SELECT product_id, quantity FROM order_item WHERE sales_order_id = ? ORDER BY product_id',
        [order.id]
      );
      for (const item of items) {
        await connection.execute(
          'UPDATE product SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }
    await connection.execute('UPDATE sales_order SET status = ? WHERE id = ?', [req.body.status, order.id]);
    await connection.commit();
    res.json({ message: 'Order status updated.', status: req.body.status });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
