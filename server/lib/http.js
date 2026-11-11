const jwt = require('jsonwebtoken');
const pool = require('../db');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// lets async route handlers throw without crashing the process
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// the role is read from the database, so make-admin.js takes effect immediately
const adminOnly = ah(async (req, res, next) => {
  const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0] || rows[0].role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
});

module.exports = { HttpError, ah, auth, adminOnly };
