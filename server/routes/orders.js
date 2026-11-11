const express = require('express');
const pool = require('../db');
const { ah, auth, HttpError } = require('../lib/http');
const orders = require('../lib/orders');

const router = express.Router();

// preview only: the real discount is recalculated when the order is placed
router.post('/validate-coupon', ah(async (req, res) => {
  const subtotalCents = Math.round(Number(req.body && req.body.subtotal) * 100);
  if (!(subtotalCents > 0)) throw new HttpError(400, 'Nothing in the cart');
  const d = await orders.computeDiscount(pool, req.body.code, subtotalCents);
  if (!d.code) throw new HttpError(400, 'Enter a coupon code');
  res.json({ code: d.code, discount: d.cents / 100 });
}));

router.post('/', auth, ah(async (req, res) => {
  const o = await orders.createOrder(req.user.id, req.body || {});
  res.status(201).json({ order_id: o.id, total: o.total, payment_method: o.payment_method, status: o.status });
}));

router.get('/', auth, ah(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50', [req.user.id]);
  if (!rows.length) return res.json([]);
  const [items] = await pool.query(
    'SELECT oi.*, p.image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (?)',
    [rows.map((r) => r.id)]);
  res.json(rows.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) })));
}));

router.post('/:id/cancel', auth, ah(async (req, res) => {
  await orders.cancelOrder(Number(req.params.id), { userId: req.user.id });
  orders.notifyStatus(Number(req.params.id));
  res.json({ message: 'Order cancelled' });
}));

module.exports = router;
