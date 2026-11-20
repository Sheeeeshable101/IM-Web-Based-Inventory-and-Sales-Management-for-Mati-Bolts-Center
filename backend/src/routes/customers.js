const express = require('express');
const db = require('../db');
const { wrap, requireFields } = require('./common');

const router = express.Router();

router.get('/customers', wrap(async (req, res) => {
  const rows = await db.allRows(() => db.client.from('customer').select('*').order('name'));
  res.json(rows);
}));

router.post('/customers', wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const customer = await db.execute(db.client
    .from('customer')
    .insert({
      name: String(req.body.name).trim(),
      phone: req.body.phone || null,
      email: req.body.email || null
    })
    .select('id')
    .single());
  res.status(201).json({ id: customer.id });
}));

module.exports = router;
