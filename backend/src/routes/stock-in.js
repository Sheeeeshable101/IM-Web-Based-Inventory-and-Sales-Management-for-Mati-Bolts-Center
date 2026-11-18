const express = require('express');
const pool = require('../db');
const { HttpError, wrap, requireFields, positiveInteger, nonNegativeMoney, nullableId } = require('./common');

const router = express.Router();

router.get('/stock-in', wrap(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT si.*, p.sku, p.name AS product_name, s.name AS supplier_name, u.name AS staff_name
     FROM stock_in si JOIN product p ON p.id = si.product_id
     LEFT JOIN supplier s ON s.id = si.supplier_id
     JOIN \`user\` u ON u.id = si.user_id
     ORDER BY si.received_at DESC LIMIT 200`
  );
  res.json(rows);
}));

router.post('/stock-in', wrap(async (req, res) => {
  requireFields(req.body, ['product_id', 'quantity', 'cost_per_unit']);
  const productId = positiveInteger(req.body.product_id, 'product_id');
  const quantity = positiveInteger(req.body.quantity, 'quantity');
  const costPerUnit = nonNegativeMoney(req.body.cost_per_unit, 'cost_per_unit');
  const supplierId = nullableId(req.body.supplier_id, 'supplier_id');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.execute('SELECT id FROM product WHERE id = ? FOR UPDATE', [productId]);
    if (!products.length) throw new HttpError(404, 'Product not found.');
    const [result] = await connection.execute(
      `INSERT INTO stock_in (product_id, supplier_id, user_id, quantity, cost_per_unit, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, supplierId, req.user.id, quantity, costPerUnit, req.body.notes || null]
    );
    await connection.execute(
      'UPDATE product SET stock_quantity = stock_quantity + ? WHERE id = ?',
      [quantity, productId]
    );
    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
