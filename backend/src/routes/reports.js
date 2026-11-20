const express = require('express');
const db = require('../db');
const { wrap, validDate, HttpError } = require('./common');

const router = express.Router();

router.get('/reports/dashboard', wrap(async (req, res) => {
  const report = await db.execute(db.client.rpc('api_dashboard'));
  res.json(report);
}));

router.get('/reports/low-stock', wrap(async (req, res) => {
  const rows = await db.execute(db.client.rpc('api_low_stock'));
  res.json(rows);
}));

router.get('/reports/sales', wrap(async (req, res) => {
  const from = validDate(req.query.from, 'from');
  const to = validDate(req.query.to, 'to');
  if (from && to && from > to) throw new HttpError(400, 'from must not be later than to.');
  const report = await db.execute(db.client.rpc('api_sales_report', {
    p_from: from,
    p_to: to
  }));
  res.json(report);
}));

module.exports = router;
