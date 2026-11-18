const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { HttpError, wrap, requireFields, positiveInteger } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/users', wrap(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, username, role, active, created_at FROM `user` ORDER BY name'
  );
  res.json(rows);
}));

router.post('/users', wrap(async (req, res) => {
  requireFields(req.body, ['name', 'username', 'password', 'role']);
  if (!['Admin', 'Staff'].includes(req.body.role)) throw new HttpError(400, 'role must be Admin or Staff.');
  if (String(req.body.password).length < 12) throw new HttpError(400, 'password must contain at least 12 characters.');
  const hash = await bcrypt.hash(String(req.body.password), 12);
  const [result] = await pool.execute(
    'INSERT INTO `user` (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [String(req.body.name).trim(), String(req.body.username).trim(), hash, req.body.role]
  );
  res.status(201).json({ id: result.insertId });
}));

router.put('/users/:id', wrap(async (req, res) => {
  requireFields(req.body, ['name', 'username', 'role', 'active']);
  const id = positiveInteger(req.params.id, 'id');
  if (typeof req.body.active !== 'boolean') throw new HttpError(400, 'active must be true or false.');
  if (!['Admin', 'Staff'].includes(req.body.role)) throw new HttpError(400, 'role must be Admin or Staff.');
  if (id === req.user.id && (!req.body.active || req.body.role !== 'Admin')) {
    throw new HttpError(400, 'You cannot deactivate or demote your own account.');
  }
  const values = [
    String(req.body.name).trim(),
    String(req.body.username).trim(),
    req.body.role,
    req.body.active
  ];
  let query = 'UPDATE `user` SET name = ?, username = ?, role = ?, active = ?';
  if (req.body.password) {
    if (String(req.body.password).length < 12) throw new HttpError(400, 'password must contain at least 12 characters.');
    query += ', password_hash = ?';
    values.push(await bcrypt.hash(String(req.body.password), 12));
  }
  query += ' WHERE id = ?';
  values.push(id);
  const [result] = await pool.execute(query, values);
  if (!result.affectedRows) {
    const [existing] = await pool.execute('SELECT id FROM `user` WHERE id = ?', [id]);
    if (!existing.length) throw new HttpError(404, 'User not found.');
  }
  res.json({ message: 'User updated.' });
}));

router.delete('/users/:id', wrap(async (req, res) => {
  const id = positiveInteger(req.params.id, 'id');
  if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account.');
  const [result] = await pool.execute('DELETE FROM `user` WHERE id = ?', [id]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found.');
  res.status(204).end();
}));

module.exports = router;
