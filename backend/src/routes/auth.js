const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { HttpError, wrap, requireFields } = require('./common');

const router = express.Router();

router.post('/auth/login', wrap(async (req, res) => {
  requireFields(req.body, ['username', 'password']);
  const [rows] = await pool.execute(
    'SELECT id, name, username, password_hash, role, active FROM `user` WHERE username = ? LIMIT 1',
    [String(req.body.username).trim()]
  );
  const user = rows[0];
  if (!user || !user.active || !(await bcrypt.compare(String(req.body.password), user.password_hash))) {
    throw new HttpError(401, 'Incorrect username or password.');
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
}));

module.exports = router;
