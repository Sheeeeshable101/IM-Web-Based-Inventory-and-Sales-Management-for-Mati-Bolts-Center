const express = require('express');
const pool = require('../db');
const { wrap, requireFields } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/categories', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT id, name, description FROM category ORDER BY name');
  res.json(rows);
}));

router.post('/categories', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const [result] = await pool.execute(
    'INSERT INTO category (name, description) VALUES (?, ?)',
    [String(req.body.name).trim(), req.body.description || null]
  );
  res.status(201).json({ id: result.insertId });
}));

module.exports = router;
