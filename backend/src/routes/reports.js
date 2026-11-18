const express = require('express');
const pool = require('../db');
const { wrap, validDate, HttpError } = require('./common');

const router = express.Router();

router.get('/reports/dashboard', wrap(async (req, res) => {
  const [[summary]] = await pool.execute(
    `SELECT COUNT(*) AS order_count,
      COALESCE(SUM(total_amount), 0) AS sales_total
     FROM sales_order WHERE status = 'Completed' AND DATE(created_at) = CURRENT_DATE`
  );
  const [[inventory]] = await pool.execute(
    'SELECT COUNT(*) AS product_count, COALESCE(SUM(stock_quantity), 0) AS units_in_stock FROM product'
  );
  const [[lowStock]] = await pool.execute('SELECT COUNT(*) AS count FROM v_low_stock');
  const [recentOrders] = await pool.execute(
    `SELECT o.id, o.total_amount, o.status, o.created_at, c.name AS customer_name
     FROM sales_order o LEFT JOIN customer c ON c.id = o.customer_id
     ORDER BY o.created_at DESC LIMIT 8`
  );
  res.json({
    today: { order_count: summary.order_count, sales_total: summary.sales_total },
    inventory: { product_count: inventory.product_count, units_in_stock: inventory.units_in_stock },
    low_stock_count: lowStock.count,
    recent_orders: recentOrders
  });
}));

router.get('/reports/low-stock', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM v_low_stock ORDER BY stock_quantity, name');
  res.json(rows);
}));

router.get('/reports/sales', wrap(async (req, res) => {
  const from = validDate(req.query.from, 'from');
  const to = validDate(req.query.to, 'to');
  if (from && to && from > to) throw new HttpError(400, 'from must not be later than to.');
  const clauses = ["o.status = 'Completed'"];
  const values = [];
  if (from) {
    clauses.push('o.created_at >= ?');
    values.push(`${from} 00:00:00`);
  }
  if (to) {
    clauses.push("o.created_at < (?::date + INTERVAL '1 day')");
    values.push(to);
  }
  const where = clauses.join(' AND ');
  const [daily] = await pool.execute(
    `SELECT DATE(o.created_at) AS sale_date, COUNT(*) AS order_count,
      SUM(o.total_amount) AS sales_total
     FROM sales_order o WHERE ${where}
     GROUP BY DATE(o.created_at) ORDER BY sale_date DESC`,
    values
  );
  const [topSellers] = await pool.execute(
    `SELECT p.id, p.sku, p.name, SUM(oi.quantity) AS quantity_sold,
      SUM(oi.line_total) AS sales_total
     FROM order_item oi JOIN sales_order o ON o.id = oi.sales_order_id
     JOIN product p ON p.id = oi.product_id
     WHERE ${where}
     GROUP BY p.id ORDER BY quantity_sold DESC LIMIT 10`,
    values
  );
  res.json({ daily, top_sellers: topSellers });
}));

module.exports = router;
