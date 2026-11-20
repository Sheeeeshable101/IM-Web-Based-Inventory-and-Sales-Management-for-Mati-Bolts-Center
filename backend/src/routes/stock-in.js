const express = require('express');
const db = require('../db');
const { wrap, requireFields, positiveInteger, nonNegativeMoney, nullableId } = require('./common');

const router = express.Router();

router.get('/stock-in', wrap(async (req, res) => {
  const rows = await db.execute(db.client
    .from('stock_in')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(200));
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const supplierIds = [...new Set(rows.map((row) => row.supplier_id).filter(Boolean))];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const [products, suppliers, users] = await Promise.all([
    productIds.length ? db.allRows(() => db.client.from('product').select('id, sku, name').in('id', productIds)) : [],
    supplierIds.length ? db.allRows(() => db.client.from('supplier').select('id, name').in('id', supplierIds)) : [],
    userIds.length ? db.allRows(() => db.client.from('user').select('id, name').in('id', userIds)) : []
  ]);
  const productById = new Map(products.map((product) => [String(product.id), product]));
  const supplierNames = new Map(suppliers.map((supplier) => [String(supplier.id), supplier.name]));
  const userNames = new Map(users.map((user) => [String(user.id), user.name]));
  res.json(rows.map((row) => ({
    ...row,
    sku: productById.get(String(row.product_id))?.sku,
    product_name: productById.get(String(row.product_id))?.name,
    supplier_name: supplierNames.get(String(row.supplier_id)) || null,
    staff_name: userNames.get(String(row.user_id))
  })));
}));

router.post('/stock-in', wrap(async (req, res) => {
  requireFields(req.body, ['product_id', 'quantity', 'cost_per_unit']);
  const productId = positiveInteger(req.body.product_id, 'product_id');
  const quantity = positiveInteger(req.body.quantity, 'quantity');
  const costPerUnit = nonNegativeMoney(req.body.cost_per_unit, 'cost_per_unit');
  const supplierId = nullableId(req.body.supplier_id, 'supplier_id');
  const result = await db.execute(db.client.rpc('api_record_stock_in', {
    p_product_id: productId,
    p_supplier_id: supplierId,
    p_user_id: req.user.id,
    p_quantity: quantity,
    p_cost_per_unit: costPerUnit,
    p_notes: req.body.notes || null
  }));
  res.status(201).json(result);
}));

module.exports = router;
