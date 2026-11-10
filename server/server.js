require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set');
  process.exit(1);
}

const { HttpError } = require('./lib/http');
const orders = require('./lib/orders');
const payments = require('./routes/payments');

const app = express();
// traffic arrives through CloudFront and then the load balancer: trust 2 hops to see the real client IP
app.set('trust proxy', 2);
app.use(helmet());
app.use(cors());

// load balancer health check
app.get('/health', (req, res) => res.send('ok'));
app.get('/api/health', (req, res) => res.send('ok'));

// must come BEFORE express.json(): the webhook signature is checked on the raw body
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), payments.webhook);

app.use(express.json({ limit: '100kb' }));

// values the storefront needs (delivery charge, COD limit, is online payment on)
app.get('/api/config', (req, res) => res.json({ ...orders.CONFIG, onlinePayments: !!process.env.RAZORPAY_KEY_ID }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', payments.router);
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image too large (max 5 MB)' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

setInterval(orders.expireStaleOrders, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
