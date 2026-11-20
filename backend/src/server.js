require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const api = require('./routes/api');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again later.' }
}));
app.get('/api/health', async (req, res, next) => {
  try {
    await db.execute(db.client.from('category').select('id').limit(1));
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

const frontendPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(frontendPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  if (error.code === '23505') {
    return res.status(409).json({ error: 'A record with that unique value already exists.' });
  }
  if (error.code === '23503') {
    return res.status(409).json({ error: 'This change conflicts with related records.' });
  }
  if (error.code === 'P0002') {
    return res.status(404).json({ error: error.message });
  }
  if (error.code === 'P0001') {
    return res.status(409).json({ error: error.message });
  }
  if (error.code === '22023') {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`Mati Bolts is available at http://${host}:${port}`);
});

async function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
