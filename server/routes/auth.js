const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { ah, auth, HttpError } = require('../lib/http');
const { sendMail, emails, SITE } = require('../lib/mail');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

router.post('/register', limiter, ah(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
  if (!emailOk(email)) throw new HttpError(400, 'Enter a valid email');
  if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(String(password), 10);
  try {
    await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)', [String(name).trim().slice(0, 100), email.toLowerCase(), hash]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already registered');
    throw e;
  }
  sendMail({ to: email.toLowerCase(), ...emails.welcome(String(name).trim()) });
  res.status(201).json({ message: 'Registered' });
}));

router.post('/login', limiter, ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password), u.password_hash))) throw new HttpError(401, 'Invalid email or password');
  const token = jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));

router.get('/me', auth, ah(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Unauthorized');
  res.json({ user: rows[0] });
}));

// always answers the same, so nobody can find out which emails have accounts
router.post('/forgot-password', limiter, ah(async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const reply = { message: 'If that email has an account, a reset link is on its way.' };
  if (!emailOk(email)) return res.json(reply);
  const [rows] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email]);
  if (rows[0]) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?, NOW() + INTERVAL 1 HOUR)", [rows[0].id, sha256(token)]);
    sendMail({ to: email, ...emails.passwordReset(rows[0].name, `${SITE}/#/reset?token=${token}`) });
  }
  res.json(reply);
}));

router.post('/reset-password', limiter, ah(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) throw new HttpError(400, 'Missing token or password');
  if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const [rows] = await pool.query(
    'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW()', [sha256(String(token))]);
  if (!rows[0]) throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  const hash = await bcrypt.hash(String(password), 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
  await pool.query('UPDATE password_resets SET used = 1 WHERE user_id = ?', [rows[0].user_id]);
  res.json({ message: 'Password changed. You can log in now.' });
}));

module.exports = router;
