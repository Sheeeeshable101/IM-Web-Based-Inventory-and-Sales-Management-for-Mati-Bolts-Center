const express = require('express');
const db = require('../db');
const { HttpError, wrap, requireFields, positiveInteger } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/suppliers', wrap(async (req, res) => {
  const rows = await db.allRows(() => db.client.from('supplier').select('*').order('name'));
  res.json(rows);
}));

router.post('/suppliers', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const supplier = await db.execute(db.client
    .from('supplier')
    .insert({
      name: String(req.body.name).trim(),
      phone: req.body.phone || null,
      email: req.body.email || null,
      address: req.body.address || null
    })
    .select('id')
    .single());
  res.status(201).json({ id: supplier.id });
}));

router.put('/suppliers/:id', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['name']);
  const [updated] = await db.execute(db.client
    .from('supplier')
    .update({
      name: String(req.body.name).trim(),
      phone: req.body.phone || null,
      email: req.body.email || null,
      address: req.body.address || null
    })
    .eq('id', positiveInteger(req.params.id, 'id'))
    .select('id'));
  if (!updated) throw new HttpError(404, 'Supplier not found.');
  res.json({ message: 'Supplier updated.' });
}));

router.delete('/suppliers/:id', requireAdmin, wrap(async (req, res) => {
  const [deleted] = await db.execute(db.client
    .from('supplier')
    .delete()
    .eq('id', positiveInteger(req.params.id, 'id'))
    .select('id'));
  if (!deleted) throw new HttpError(404, 'Supplier not found.');
  res.status(204).end();
}));

module.exports = router;
