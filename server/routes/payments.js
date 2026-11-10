const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const rzp = require('../lib/razorpay');
const { ah, auth, HttpError } = require('../lib/http');
const orders = require('../lib/orders');

const router = express.Router();

router.post('/create-order', auth, ah(async (req, res) => {
  if (!rzp) throw new HttpError(503, 'Online payments are not set up yet. Please choose Cash on Delivery.');
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.body && req.body.order_id, req.user.id]);
  const order = rows[0];
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.payment_method !== 'ONLINE' || order.status !== 'PENDING_PAYMENT') throw new HttpError(400, 'This order is not waiting for payment');
  const amount = Math.round(Number(order.total) * 100); // paise, from the database
  const rpOrder = await rzp.orders.create({ amount, currency: 'INR', receipt: `order_${order.id}` });
  await pool.query('UPDATE orders SET razorpay_order_id = ? WHERE id = ?', [rpOrder.id, order.id]);
  res.json({ key_id: process.env.RAZORPAY_KEY_ID, razorpay_order_id: rpOrder.id, amount, currency: 'INR' });
}));

router.post('/verify', auth, ah(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !process.env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(400, 'Missing fields');
  }
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
  const given = String(razorpay_signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) {
    throw new HttpError(400, 'Invalid payment signature');
  }
  await orders.markPaid(razorpay_order_id, razorpay_payment_id, req.user.id);
  res.json({ message: 'Payment verified' });
}));

// registered in server.js BEFORE express.json(): the signature is checked on the raw body
const webhook = ah(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send('Webhook not configured');
  const sig = String(req.headers['x-razorpay-signature'] || '');
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(400).send('Invalid signature');
  }
  const event = JSON.parse(req.body.toString());
  if (event.event === 'order.paid' || event.event === 'payment.captured') {
    const p = event.payload.payment.entity;
    await orders.markPaid(p.order_id, p.id);
  }
  res.json({ ok: true });
});

module.exports = { router, webhook };
