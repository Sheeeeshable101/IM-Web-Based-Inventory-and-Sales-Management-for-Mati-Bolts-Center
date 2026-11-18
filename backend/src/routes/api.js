const express = require('express');
const authRoutes = require('./auth');
const productsRoutes = require('./products');
const categoriesRoutes = require('./categories');
const suppliersRoutes = require('./suppliers');
const customersRoutes = require('./customers');
const ordersRoutes = require('./orders');
const stockInRoutes = require('./stock-in');
const reportsRoutes = require('./reports');
const usersRoutes = require('./users');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('./common');

const router = express.Router();

router.use(authRoutes);
router.use(requireAuth);
router.use(productsRoutes);
router.use(categoriesRoutes);
router.use(suppliersRoutes);
router.use(customersRoutes);
router.use(ordersRoutes);
router.use(stockInRoutes);
router.use(reportsRoutes);
router.use(usersRoutes);

router.use((error, req, res, next) => {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  return next(error);
});

module.exports = router;
