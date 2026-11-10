const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { ah, auth, adminOnly, HttpError } = require('../lib/http');
const { saveImage } = require('../lib/images');
const { importImageFromLink } = require('../lib/safe-fetch');
const orders = require('../lib/orders');

const router = express.Router();
router.use(auth, adminOnly);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const COUNTED = "status NOT IN ('CANCELLED','PENDING_PAYMENT')";

// ---------- dashboard ----------
router.get('/stats', ah(async (req, res) => {
  const q = (sql, p) => pool.query(sql, p).then(([r]) => r);
  const [totals, today, customers, products, toProcess, daily, byStatus, byMethod, top, low, recent] = await Promise.all([
    q(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders WHERE ${COUNTED}`),
    q(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders WHERE ${COUNTED} AND created_at >= CURDATE()`),
    q("SELECT COUNT(*) AS c FROM users WHERE role = 'customer'"),
    q('SELECT COUNT(*) AS c FROM products WHERE active = 1'),
    q("SELECT COUNT(*) AS c FROM orders WHERE status = 'PLACED'"),
    q(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS orders, SUM(total) AS revenue FROM orders
       WHERE ${COUNTED} AND created_at >= (CURDATE() - INTERVAL 13 DAY) GROUP BY d`),
    q('SELECT status, COUNT(*) AS c FROM orders GROUP BY status'),
    q(`SELECT payment_method, COUNT(*) AS c, COALESCE(SUM(total),0) AS revenue FROM orders WHERE ${COUNTED} GROUP BY payment_method`),
    q(`SELECT oi.product_id, oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.${COUNTED}
       GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 5`),
    q('SELECT id, name, stock FROM products WHERE active = 1 AND stock <= 5 ORDER BY stock ASC LIMIT 8'),
    q(`SELECT o.id, o.total, o.status, o.payment_method, o.created_at, u.name AS customer
       FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 8`),
  ]);

  const map = new Map(daily.map((r) => [r.d, r]));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const r = map.get(key);
    series.push({ date: key, orders: r ? r.orders : 0, revenue: r ? Number(r.revenue) : 0 });
  }
  res.json({
    revenue: totals[0].revenue, orders: totals[0].orders,
    todayRevenue: today[0].revenue, todayOrders: today[0].orders,
    customers: customers[0].c, products: products[0].c, toProcess: toProcess[0].c,
    series, byStatus, byMethod, top, low, recent,
  });
}));

// ---------- products ----------
function parseProduct(b) {
  b = b || {};
  const name = String(b.name || '').trim();
  const price = Number(b.price);
  const stock = Number(b.stock);
  const mrp = b.mrp === '' || b.mrp == null ? null : Number(b.mrp);
  if (name.length < 2 || name.length > 200) throw new HttpError(400, 'Enter a product name');
  if (!(price > 0)) throw new HttpError(400, 'Price must be above 0');
  if (mrp !== null && !(mrp >= price)) throw new HttpError(400, 'MRP must be equal to or higher than the selling price');
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be a whole number');
  const image = String(b.image_url || '');
  if (image && !/^\/images\/[A-Za-z0-9._-]+$/.test(image)) throw new HttpError(400, 'Use the image upload or the image link option');
  return {
    name, price, mrp, stock, image_url: image,
    description: String(b.description || '').slice(0, 5000),
    category: String(b.category || 'General').trim().slice(0, 80) || 'General',
  };
}

router.get('/products', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const [rows] = q
    ? await pool.query('SELECT * FROM products WHERE name LIKE ? ORDER BY id DESC LIMIT 200', [`%${q}%`])
    : await pool.query('SELECT * FROM products ORDER BY id DESC LIMIT 200');
  res.json(rows);
}));

router.post('/products', ah(async (req, res) => {
  const p = parseProduct(req.body);
  const [r] = await pool.query(
    'INSERT INTO products (name, description, price, mrp, category, stock, image_url) VALUES (?,?,?,?,?,?,?)',
    [p.name, p.description, p.price, p.mrp, p.category, p.stock, p.image_url]);
  res.status(201).json({ id: r.insertId });
}));

router.put('/products/:id', ah(async (req, res) => {
  const p = parseProduct(req.body);
  const [r] = await pool.query(
    'UPDATE products SET name=?, description=?, price=?, mrp=?, category=?, stock=?, image_url=? WHERE id=?',
    [p.name, p.description, p.price, p.mrp, p.category, p.stock, p.image_url, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Product not found');
  res.json({ ok: true });
}));

// hide instead of delete, so old orders keep their product
router.patch('/products/:id/active', ah(async (req, res) => {
  await pool.query('UPDATE products SET active = ? WHERE id = ?', [req.body && req.body.active ? 1 : 0, req.params.id]);
  res.json({ ok: true });
}));

router.post('/upload', upload.single('image'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose an image file');
  res.json({ image_url: await saveImage(req.file.buffer) });
}));

router.post('/import-image', ah(async (req, res) => {
  res.json({ image_url: await importImageFromLink(req.body && req.body.url) });
}));

// ---------- orders ----------
router.get('/orders', ah(async (req, res) => {
  const limit = 15;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const status = String(req.query.status || '');
  const where = status ? 'WHERE o.status = ?' : '';
  const params = status ? [status] : [];
  const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM orders o ${where}`, params);
  const [rows] = await pool.query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id
     ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  let items = [];
  if (rows.length) [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [rows.map((r) => r.id)]);
  res.json({
    items: rows.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id), next: orders.FLOW[o.status] || [] })),
    total: c, page, pages: Math.max(1, Math.ceil(c / limit)),
  });
}));

router.put('/orders/:id/status', ah(async (req, res) => {
  await orders.updateStatus(Number(req.params.id), String((req.body && req.body.status) || ''));
  res.json({ ok: true });
}));

// ---------- coupons ----------
router.get('/coupons', ah(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json(rows);
}));

router.post('/coupons', ah(async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  const type = b.type === 'flat' ? 'flat' : 'percent';
  const value = Number(b.value);
  const minOrder = Number(b.min_order) || 0;
  const maxDiscount = b.max_discount === '' || b.max_discount == null ? null : Number(b.max_discount);
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new HttpError(400, 'Code: 3 to 20 letters or numbers');
  if (!(value > 0) || (type === 'percent' && value > 90)) throw new HttpError(400, 'Enter a valid discount value (percent must be 90 or less)');
  const expires = b.expires_at ? new Date(b.expires_at) : null;
  if (expires && isNaN(expires.getTime())) throw new HttpError(400, 'Invalid expiry date');
  try {
    await pool.query('INSERT INTO coupons (code, type, value, min_order, max_discount, expires_at) VALUES (?,?,?,?,?,?)',
      [code, type, value, minOrder, maxDiscount, expires]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That coupon code already exists');
    throw e;
  }
  res.status(201).json({ ok: true });
}));

router.patch('/coupons/:code', ah(async (req, res) => {
  await pool.query('UPDATE coupons SET active = ? WHERE code = ?', [req.body && req.body.active ? 1 : 0, req.params.code]);
  res.json({ ok: true });
}));

router.delete('/coupons/:code', ah(async (req, res) => {
  await pool.query('DELETE FROM coupons WHERE code = ?', [req.params.code]);
  res.json({ ok: true });
}));

module.exports = router;
