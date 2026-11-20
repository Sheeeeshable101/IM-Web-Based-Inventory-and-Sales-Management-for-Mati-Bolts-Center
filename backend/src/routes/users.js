const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { HttpError, wrap, requireFields, positiveInteger } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/users', wrap(async (req, res) => {
  const rows = await db.allRows(() => db.client
    .from('user')
    .select('id, name, username, role, active, created_at')
    .order('name'));
  res.json(rows);
}));

router.post('/users', wrap(async (req, res) => {
  requireFields(req.body, ['name', 'username', 'password', 'role']);
  if (!['Admin', 'Staff'].includes(req.body.role)) throw new HttpError(400, 'role must be Admin or Staff.');
  if (String(req.body.password).length < 12) throw new HttpError(400, 'password must contain at least 12 characters.');
  const hash = await bcrypt.hash(String(req.body.password), 12);
  const user = await db.execute(db.client
    .from('user')
    .insert({
      name: String(req.body.name).trim(),
      username: String(req.body.username).trim(),
      password_hash: hash,
      role: req.body.role
    })
    .select('id')
    .single());
  res.status(201).json({ id: user.id });
}));

router.put('/users/:id', wrap(async (req, res) => {
  requireFields(req.body, ['name', 'username', 'role', 'active']);
  const id = positiveInteger(req.params.id, 'id');
  if (typeof req.body.active !== 'boolean') throw new HttpError(400, 'active must be true or false.');
  if (!['Admin', 'Staff'].includes(req.body.role)) throw new HttpError(400, 'role must be Admin or Staff.');
  if (id === req.user.id && (!req.body.active || req.body.role !== 'Admin')) {
    throw new HttpError(400, 'You cannot deactivate or demote your own account.');
  }
  const values = {
    name: String(req.body.name).trim(),
    username: String(req.body.username).trim(),
    role: req.body.role,
    active: req.body.active
  };
  if (req.body.password) {
    if (String(req.body.password).length < 12) throw new HttpError(400, 'password must contain at least 12 characters.');
    values.password_hash = await bcrypt.hash(String(req.body.password), 12);
  }
  const [updated] = await db.execute(db.client.from('user').update(values).eq('id', id).select('id'));
  if (!updated) throw new HttpError(404, 'User not found.');
  res.json({ message: 'User updated.' });
}));

router.delete('/users/:id', wrap(async (req, res) => {
  const id = positiveInteger(req.params.id, 'id');
  if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account.');
  const [deleted] = await db.execute(db.client.from('user').delete().eq('id', id).select('id'));
  if (!deleted) throw new HttpError(404, 'User not found.');
  res.status(204).end();
}));

module.exports = router;
