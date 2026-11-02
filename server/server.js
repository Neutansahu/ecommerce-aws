require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },               // 5 MB
  fileFilter: (req, file, cb) =>
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ---------- middleware ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
app.post('/api/products/upload', auth, adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Only jpg, png, webp up to 5 MB' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const key = `images/${crypto.randomUUID()}${ext}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    res.json({ image_url: '/' + key });                 // served by CloudFront at /images/...
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ---------- health ----------
app.get('/health', (req, res) => res.send('ok'));
app.get('/api/health', (req, res) => res.send('ok'));

// ---------- auth ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)', [name, email, hash]);
    res.status(201).json({ message: 'Registered' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already used' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- products ----------
app.get('/api/products', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
  res.json(rows);
});

app.get('/api/products/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.post('/api/products', auth, adminOnly, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;
  const [r] = await pool.query(
    'INSERT INTO products (name, description, price, stock, image_url) VALUES (?,?,?,?,?)',
    [name, description, price, stock, image_url]
  );
  res.status(201).json({ id: r.insertId });
});

// ---------- orders ----------
// body: { items: [{ product_id, quantity }] }
app.post('/api/orders', auth, async (req, res) => {
  const items = req.body.items || [];
  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    const priced = [];
    for (const it of items) {
      const [rows] = await conn.query('SELECT price, stock FROM products WHERE id = ? FOR UPDATE', [it.product_id]);
      const p = rows[0];
      if (!p || p.stock < it.quantity) throw new Error('Out of stock');
      total += p.price * it.quantity;           // price comes from DB, not the client
      priced.push({ ...it, price: p.price });
    }
    const [o] = await conn.query('INSERT INTO orders (user_id, total, status) VALUES (?,?,?)', [req.user.id, total, 'PENDING']);
    for (const it of priced) {
      await conn.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?,?,?,?)',
        [o.insertId, it.product_id, it.quantity, it.price]);
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, it.product_id]);
    }
    await conn.commit();
    res.status(201).json({ order_id: o.insertId, total });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.get('/api/orders', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));