const express = require('express');
const pool = require('../db');
const { wrap, requireFields } = require('./common');

const router = express.Router();

router.get('/customers', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM customer ORDER BY name');
  res.json(rows);
}));

router.post('/customers', wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const [result] = await pool.execute(
    'INSERT INTO customer (name, phone, email) VALUES (?, ?, ?)',
    [String(req.body.name).trim(), req.body.phone || null, req.body.email || null]
  );
  res.status(201).json({ id: result.insertId });
}));

module.exports = router;
