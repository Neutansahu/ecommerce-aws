const pool = require('../db');
const rzp = require('./razorpay');
const { HttpError } = require('./http');
const { sendMail, emails } = require('./mail');

const CONFIG = { freeShippingAbove: 499, shippingFee: 40, codMax: 20000 };

// which status an order may move to next
const FLOW = {
  PENDING_PAYMENT: ['CANCELLED'],
  PLACED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function parseAddress(a) {
  a = a || {};
  const clean = (v, n = 200) => String(v || '').trim().slice(0, n);
  const out = {
    name: clean(a.name, 100),
    phone: String(a.phone || '').replace(/\s+/g, '').slice(0, 15),
    address: clean(a.address),
    city: clean(a.city, 80),
    state: clean(a.state, 80),
    pincode: clean(a.pincode, 10),
  };
  if (out.name.length < 2) throw new HttpError(400, 'Enter the recipient name');
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw new HttpError(400, 'Enter a valid 10-digit mobile number');
  if (out.address.length < 5) throw new HttpError(400, 'Enter the full delivery address');
  if (!out.city) throw new HttpError(400, 'Enter the city');
  if (!out.state) throw new HttpError(400, 'Enter the state');
  if (!/^\d{6}$/.test(out.pincode)) throw new HttpError(400, 'Enter a valid 6-digit pincode');
  return out;
}

async function computeDiscount(db, rawCode, subtotalCents) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { code: null, cents: 0 };
  const [rows] = await db.query('SELECT * FROM coupons WHERE code = ?', [code]);
  const c = rows[0];
  if (!c || !c.active) throw new HttpError(400, 'Invalid coupon code');
  if (c.expires_at && new Date(c.expires_at) < new Date()) throw new HttpError(400, 'This coupon has expired');
  if (subtotalCents < Math.round(Number(c.min_order) * 100)) {
    throw new HttpError(400, `Add items worth ₹${Number(c.min_order).toFixed(0)} or more to use ${code}`);
  }
  let cents = c.type === 'percent'
    ? Math.floor((subtotalCents * Number(c.value)) / 100)
    : Math.round(Number(c.value) * 100);
  if (c.type === 'percent' && c.max_discount != null) cents = Math.min(cents, Math.round(Number(c.max_discount) * 100));
  return { code, cents: Math.min(cents, subtotalCents) };
}

function shippingCents(afterDiscountCents) {
  return afterDiscountCents >= CONFIG.freeShippingAbove * 100 ? 0 : CONFIG.shippingFee * 100;
}

// prices, stock, discount and delivery charge are always calculated here, never trusted from the browser
async function createOrder(userId, body) {
  const method = body.payment_method === 'COD' ? 'COD' : 'ONLINE';
  const addr = parseAddress(body.address);

  const raw = Array.isArray(body.items) ? body.items : [];
  if (!raw.length) throw new HttpError(400, 'Your cart is empty');
  const merged = new Map();
  for (const it of raw) {
    const id = Number(it.product_id);
    const qty = Number(it.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, 'Invalid cart item');
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const items = [...merged.entries()].sort((a, b) => a[0] - b[0]); // same lock order avoids deadlocks

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let subtotal = 0;
    const lines = [];
    for (const [id, qty] of items) {
      const [rows] = await conn.query('SELECT name, price, stock, active FROM products WHERE id = ? FOR UPDATE', [id]);
      const p = rows[0];
      if (!p || !p.active) throw new HttpError(400, 'A product in your cart is no longer available');
      if (p.stock < qty) throw new HttpError(400, `Only ${p.stock} left of ${p.name}`);
      const cents = Math.round(Number(p.price) * 100);
      subtotal += cents * qty;
      lines.push({ id, qty, name: p.name, cents });
    }
    const { code, cents: discount } = await computeDiscount(conn, body.coupon_code, subtotal);
    const shipping = shippingCents(subtotal - discount);
    const total = subtotal - discount + shipping;
    if (method === 'COD' && total > CONFIG.codMax * 100) {
      throw new HttpError(400, `Cash on delivery is available up to ₹${CONFIG.codMax}. Please pay online.`);
    }

    const [o] = await conn.query(
      `INSERT INTO orders (user_id, subtotal, shipping_fee, discount, total, coupon_code, status, payment_method, payment_status,
        ship_name, ship_phone, ship_address, ship_city, ship_state, ship_pincode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, subtotal / 100, shipping / 100, discount / 100, total / 100, code,
        method === 'COD' ? 'PLACED' : 'PENDING_PAYMENT', method, method === 'COD' ? 'COD' : 'UNPAID',
        addr.name, addr.phone, addr.address, addr.city, addr.state, addr.pincode]
    );
    for (const l of lines) {
      await conn.query('INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?,?,?,?,?)',
        [o.insertId, l.id, l.name, l.qty, l.cents / 100]);
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [l.qty, l.id]);
    }
    await conn.commit();
    if (method === 'COD') notifyPlaced(o.insertId);
    return { id: o.insertId, total: total / 100, payment_method: method, status: method === 'COD' ? 'PLACED' : 'PENDING_PAYMENT' };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getOrder(id) {
  const [o] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!o[0]) return null;
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
  return { order: o[0], items };
}

// emails: fire and forget, they never throw
async function notifyPlaced(id) {
  try {
    const d = await getOrder(id);
    if (!d) return;
    const [u] = await pool.query('SELECT name, email FROM users WHERE id = ?', [d.order.user_id]);
    const customer = u[0];
    if (customer) sendMail({ to: customer.email, ...emails.orderPlaced(d.order, d.items) });
    if (process.env.ADMIN_EMAIL) sendMail({ to: process.env.ADMIN_EMAIL, ...emails.adminNewOrder(d.order, d.items, customer) });
  } catch (e) {
    console.error('notifyPlaced failed:', e.message);
  }
}

async function notifyStatus(id) {
  try {
    const d = await getOrder(id);
    if (!d) return;
    const [u] = await pool.query('SELECT email FROM users WHERE id = ?', [d.order.user_id]);
    if (u[0]) sendMail({ to: u[0].email, ...emails.orderStatus(d.order, d.order.status) });
  } catch (e) {
    console.error('notifyStatus failed:', e.message);
  }
}

// called by the browser after checkout and by the Razorpay webhook; the first one wins
async function markPaid(razorpayOrderId, paymentId, userId = null) {
  let sql = "UPDATE orders SET status='PLACED', payment_status='PAID', razorpay_payment_id=? WHERE razorpay_order_id=? AND payment_status='UNPAID' AND status='PENDING_PAYMENT'";
  const params = [paymentId, razorpayOrderId];
  if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
  const [r] = await pool.query(sql, params);
  const [rows] = await pool.query('SELECT id, status, payment_status, total FROM orders WHERE razorpay_order_id = ?', [razorpayOrderId]);
  const o = rows[0];
  if (!o) return;
  if (r.affectedRows === 1) return notifyPlaced(o.id);
  // money arrived for an order that was already cancelled (for example the 30-minute timeout): give it back
  if (o.status === 'CANCELLED' && o.payment_status === 'UNPAID' && rzp) {
    try {
      await rzp.payments.refund(paymentId, { amount: Math.round(Number(o.total) * 100) });
      await pool.query("UPDATE orders SET payment_status='REFUNDED', razorpay_payment_id=? WHERE id=?", [paymentId, o.id]);
    } catch (e) {
      console.error('auto-refund failed for order', o.id, e.message);
    }
  }
}

// cancels, puts the stock back and refunds paid online orders
async function cancelOrder(id, { userId = null, isAdmin = false, onlyStatus = null } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    const o = rows[0];
    if (!o || (!isAdmin && o.user_id !== userId)) throw new HttpError(404, 'Order not found');
    if (onlyStatus && o.status !== onlyStatus) throw new HttpError(409, 'Order changed');
    const allowed = isAdmin ? ['PENDING_PAYMENT', 'PLACED', 'PROCESSING'] : ['PENDING_PAYMENT', 'PLACED'];
    if (!allowed.includes(o.status)) throw new HttpError(400, 'This order can no longer be cancelled');

    let paymentStatus = o.payment_status;
    if (o.payment_method === 'ONLINE' && o.payment_status === 'PAID') {
      if (!rzp || !o.razorpay_payment_id) throw new HttpError(502, 'Refund is not possible right now. Please contact support.');
      try {
        await rzp.payments.refund(o.razorpay_payment_id, { amount: Math.round(Number(o.total) * 100) });
        paymentStatus = 'REFUNDED';
      } catch (e) {
        console.error('refund failed for order', id, e.message);
        throw new HttpError(502, 'The refund failed. Please try again or contact support.');
      }
    }
    await conn.query('UPDATE products p JOIN order_items oi ON oi.product_id = p.id SET p.stock = p.stock + oi.quantity WHERE oi.order_id = ?', [id]);
    await conn.query("UPDATE orders SET status='CANCELLED', payment_status=? WHERE id = ?", [paymentStatus, id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateStatus(id, next) {
  if (next === 'CANCELLED') {
    await cancelOrder(id, { isAdmin: true });
    return notifyStatus(id);
  }
  const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(404, 'Order not found');
  if (!(FLOW[rows[0].status] || []).includes(next)) {
    throw new HttpError(400, `An order that is ${rows[0].status} cannot be moved to ${next}`);
  }
  const [r] = await pool.query(
    "UPDATE orders SET status = ?, payment_status = IF(? = 'DELIVERED' AND payment_method = 'COD', 'PAID', payment_status) WHERE id = ? AND status = ?",
    [next, next, id, rows[0].status]
  );
  if (r.affectedRows !== 1) throw new HttpError(409, 'Someone else changed this order. Refresh and try again.');
  notifyStatus(id);
}

// online orders not paid within 30 minutes are cancelled and their stock released
async function expireStaleOrders() {
  try {
    const [old] = await pool.query("SELECT id FROM orders WHERE status = 'PENDING_PAYMENT' AND created_at < (NOW() - INTERVAL 30 MINUTE)");
    for (const o of old) {
      try { await cancelOrder(o.id, { isAdmin: true, onlyStatus: 'PENDING_PAYMENT' }); } catch { /* changed meanwhile */ }
    }
  } catch (e) {
    console.error('expireStaleOrders failed:', e.message);
  }
}

module.exports = { CONFIG, FLOW, createOrder, computeDiscount, getOrder, markPaid, cancelOrder, updateStatus, notifyPlaced, notifyStatus, expireStaleOrders };
