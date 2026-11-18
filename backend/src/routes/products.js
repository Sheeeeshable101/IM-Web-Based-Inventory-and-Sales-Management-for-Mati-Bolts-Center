const express = require('express');
const pool = require('../db');
const { HttpError, wrap, requireFields, positiveInteger, nullableId, nonNegativeMoney } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function productValues(body) {
  requireFields(body, ['sku', 'name', 'category_id', 'price']);
  if (!String(body.sku).trim() || !String(body.name).trim()) {
    throw new HttpError(400, 'sku and name cannot be blank.');
  }
  if (body.stock_quantity !== undefined) {
    throw new HttpError(400, 'Use the stock-in endpoint to change inventory quantities.');
  }
  return [
    String(body.sku).trim(),
    String(body.name).trim(),
    positiveInteger(body.category_id, 'category_id'),
    nullableId(body.supplier_id, 'supplier_id'),
    body.size ? String(body.size).trim() : null,
    body.material ? String(body.material).trim() : null,
    nonNegativeMoney(body.price, 'price'),
    body.reorder_level === undefined ? 0 : positiveInteger(body.reorder_level, 'reorder_level', true)
  ];
}

router.get('/products', wrap(async (req, res) => {
  const conditions = [];
  const values = [];
  if (req.query.q) {
    conditions.push('(p.name ILIKE ? OR p.sku ILIKE ? OR p.material ILIKE ?)');
    const term = `%${String(req.query.q).trim()}%`;
    values.push(term, term, term);
  }
  if (req.query.category_id) {
    conditions.push('p.category_id = ?');
    values.push(positiveInteger(req.query.category_id, 'category_id'));
  }
  if (req.query.low === '1') conditions.push('p.stock_quantity <= p.reorder_level');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM product p JOIN category c ON c.id = p.category_id
     LEFT JOIN supplier s ON s.id = p.supplier_id
     ${where} ORDER BY p.name`,
    values
  );
  res.json(rows);
}));

router.post('/products', wrap(async (req, res) => {
  const values = productValues(req.body);
  const [result] = await pool.execute(
    `INSERT INTO product
      (sku, name, category_id, supplier_id, size, material, price, reorder_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  res.status(201).json({ id: result.insertId });
}));

router.put('/products/:id', wrap(async (req, res) => {
  const values = productValues(req.body);
  const [result] = await pool.execute(
    `UPDATE product SET sku = ?, name = ?, category_id = ?, supplier_id = ?,
      size = ?, material = ?, price = ?, reorder_level = ?
     WHERE id = ?`,
    [...values, positiveInteger(req.params.id, 'id')]
  );
  if (!result.affectedRows) {
    const [existing] = await pool.execute('SELECT id FROM product WHERE id = ?', [positiveInteger(req.params.id, 'id')]);
    if (!existing.length) throw new HttpError(404, 'Product not found.');
  }
  res.json({ message: 'Product updated.' });
}));

router.delete('/products/:id', requireAdmin, wrap(async (req, res) => {
  const [result] = await pool.execute('DELETE FROM product WHERE id = ?', [positiveInteger(req.params.id, 'id')]);
  if (!result.affectedRows) throw new HttpError(404, 'Product not found.');
  res.status(204).end();
}));

module.exports = router;
