const express = require('express');
const pool = require('../db');
const { ah, auth, HttpError } = require('../lib/http');

const router = express.Router();

const SELECT = `
  SELECT p.*,
    IF(p.mrp IS NOT NULL AND p.mrp > p.price, ROUND((p.mrp - p.price) / p.mrp * 100), 0) AS discount_pct,
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
  FROM products p`;

const SORTS = {
  newest: 'p.id DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  rating: 'rating DESC, review_count DESC',
  discount: 'discount_pct DESC',
};

router.get('/', ah(async (req, res) => {
  const where = ['p.active = 1'];
  const params = [];
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.category) { where.push('p.category = ?'); params.push(String(req.query.category)); }
  if (Number(req.query.min) > 0) { where.push('p.price >= ?'); params.push(Number(req.query.min)); }
  if (Number(req.query.max) > 0) { where.push('p.price <= ?'); params.push(Number(req.query.max)); }
  const limit = 12;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const order = SORTS[req.query.sort] || SORTS.newest;
  const clause = where.join(' AND ');

  const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM products p WHERE ${clause}`, params);
  const [items] = await pool.query(`${SELECT} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  res.json({ items, total: c, page, pages: Math.max(1, Math.ceil(c / limit)) });
}));

router.get('/categories', ah(async (req, res) => {
  const [rows] = await pool.query('SELECT category, COUNT(*) AS count FROM products WHERE active = 1 GROUP BY category ORDER BY category');
  res.json(rows);
}));

// used by the cart to refresh prices and stock
router.get('/by-ids', ah(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
  if (!ids.length) return res.json([]);
  const [rows] = await pool.query(`${SELECT} WHERE p.id IN (?) AND p.active = 1`, [ids]);
  res.json(rows);
}));

router.get('/:id', ah(async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE p.id = ? AND p.active = 1`, [req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  const [reviews] = await pool.query(
    'SELECT r.id, r.rating, r.comment, r.created_at, u.name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.id DESC LIMIT 50',
    [req.params.id]);
  res.json({ product: rows[0], reviews });
}));

// only customers whose order was delivered can review
router.post('/:id/reviews', auth, ah(async (req, res) => {
  const rating = Number(req.body && req.body.rating);
  const comment = String((req.body && req.body.comment) || '').trim().slice(0, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Choose a rating from 1 to 5 stars');
  const [bought] = await pool.query(
    "SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'DELIVERED' LIMIT 1",
    [req.user.id, req.params.id]);
  if (!bought[0]) throw new HttpError(403, 'You can review a product after your order for it is delivered');
  await pool.query(
    'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = NOW()',
    [req.params.id, req.user.id, rating, comment]);
  res.status(201).json({ message: 'Thanks for your review' });
}));

module.exports = router;
