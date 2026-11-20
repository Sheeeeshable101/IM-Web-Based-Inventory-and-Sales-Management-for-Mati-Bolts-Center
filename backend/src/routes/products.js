const express = require('express');
const db = require('../db');
const { HttpError, wrap, requireFields, positiveInteger, nullableId, nonNegativeMoney } = require('./common');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function productValues(body) {
  requireFields(body, ['sku', 'name', 'category_id', 'price']);
  if (!String(body.sku).trim() || !String(body.name).trim()) {
    throw new HttpError(400, 'sku and name cannot be blank.');
  }
  if (body.stock_quantity !== undefined) {
    throw new HttpError(400, 'Use the stock-in endpoint to change inventory quantities.');
  }
  return {
    sku: String(body.sku).trim(),
    name: String(body.name).trim(),
    category_id: positiveInteger(body.category_id, 'category_id'),
    supplier_id: nullableId(body.supplier_id, 'supplier_id'),
    size: body.size ? String(body.size).trim() : null,
    material: body.material ? String(body.material).trim() : null,
    price: nonNegativeMoney(body.price, 'price'),
    reorder_level: body.reorder_level === undefined ? 0 : positiveInteger(body.reorder_level, 'reorder_level', true)
  };
}

router.get('/products', wrap(async (req, res) => {
  const [products, categories, suppliers] = await Promise.all([
    db.allRows(() => db.client.from('product').select('*').order('name')),
    db.allRows(() => db.client.from('category').select('id, name')),
    db.allRows(() => db.client.from('supplier').select('id, name'))
  ]);
  const categoryNames = new Map(categories.map((category) => [String(category.id), category.name]));
  const supplierNames = new Map(suppliers.map((supplier) => [String(supplier.id), supplier.name]));
  const term = String(req.query.q || '').trim().toLowerCase();
  const categoryId = req.query.category_id ? String(positiveInteger(req.query.category_id, 'category_id')) : null;
  const rows = products
    .map((product) => ({
      ...product,
      category_name: categoryNames.get(String(product.category_id)) || null,
      supplier_name: supplierNames.get(String(product.supplier_id)) || null
    }))
    .filter((product) => {
      const matchesTerm = !term || [product.name, product.sku, product.material]
        .some((value) => String(value || '').toLowerCase().includes(term));
      const matchesCategory = !categoryId || String(product.category_id) === categoryId;
      const matchesLowStock = req.query.low !== '1' || Number(product.stock_quantity) <= Number(product.reorder_level);
      return matchesTerm && matchesCategory && matchesLowStock;
    });
  res.json(rows);
}));

router.post('/products', wrap(async (req, res) => {
  const product = await db.execute(db.client
    .from('product')
    .insert(productValues(req.body))
    .select('id')
    .single());
  res.status(201).json({ id: product.id });
}));

router.put('/products/:id', wrap(async (req, res) => {
  const [updated] = await db.execute(db.client
    .from('product')
    .update(productValues(req.body))
    .eq('id', positiveInteger(req.params.id, 'id'))
    .select('id'));
  if (!updated) throw new HttpError(404, 'Product not found.');
  res.json({ message: 'Product updated.' });
}));

router.delete('/products/:id', requireAdmin, wrap(async (req, res) => {
  const [deleted] = await db.execute(db.client
    .from('product')
    .delete()
    .eq('id', positiveInteger(req.params.id, 'id'))
    .select('id'));
  if (!deleted) throw new HttpError(404, 'Product not found.');
  res.status(204).end();
}));

module.exports = router;
