const express = require('express');
const pool = require('../db');
const { HttpError, wrap, requireFields, positiveInteger } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/suppliers', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM supplier ORDER BY name');
  res.json(rows);
}));

router.post('/suppliers', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const [result] = await pool.execute(
    'INSERT INTO supplier (name, phone, email, address) VALUES (?, ?, ?, ?)',
    [String(req.body.name).trim(), req.body.phone || null, req.body.email || null, req.body.address || null]
  );
  res.status(201).json({ id: result.insertId });
}));

router.put('/suppliers/:id', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const [result] = await pool.execute(
    'UPDATE supplier SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
    [String(req.body.name).trim(), req.body.phone || null, req.body.email || null, req.body.address || null,
      positiveInteger(req.params.id, 'id')]
  );
  if (!result.affectedRows) {
    const [existing] = await pool.execute('SELECT id FROM supplier WHERE id = ?', [positiveInteger(req.params.id, 'id')]);
    if (!existing.length) throw new HttpError(404, 'Supplier not found.');
  }
  res.json({ message: 'Supplier updated.' });
}));

router.delete('/suppliers/:id', requireAdmin, wrap(async (req, res) => {
  const [result] = await pool.execute('DELETE FROM supplier WHERE id = ?', [positiveInteger(req.params.id, 'id')]);
  if (!result.affectedRows) throw new HttpError(404, 'Supplier not found.');
  res.status(204).end();
}));

module.exports = router;
