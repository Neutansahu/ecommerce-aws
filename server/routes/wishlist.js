const express = require('express');
const pool = require('../db');
const { ah, auth } = require('../lib/http');

const router = express.Router();
router.use(auth);

router.get('/', ah(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, IF(p.mrp IS NOT NULL AND p.mrp > p.price, ROUND((p.mrp - p.price) / p.mrp * 100), 0) AS discount_pct,
       (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id) AS rating,
       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
     FROM wishlist w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.active = 1 ORDER BY w.created_at DESC`, [req.user.id]);
  res.json(rows);
}));

router.put('/:id', ah(async (req, res) => {
  await pool.query('INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?,?)', [req.user.id, Number(req.params.id)]);
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  await pool.query('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, Number(req.params.id)]);
  res.json({ ok: true });
}));

module.exports = router;
