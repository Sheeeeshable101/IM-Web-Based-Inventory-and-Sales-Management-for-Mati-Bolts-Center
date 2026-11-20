const express = require('express');
const db = require('../db');
const { wrap, requireFields } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/categories', wrap(async (req, res) => {
  const rows = await db.allRows(() => db.client
    .from('category')
    .select('id, name, description')
    .order('name'));
  res.json(rows);
}));

router.post('/categories', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const category = await db.execute(db.client
    .from('category')
    .insert({ name: String(req.body.name).trim(), description: req.body.description || null })
    .select('id')
    .single());
  res.status(201).json({ id: category.id });
}));

module.exports = router;
