// Creates tables, upgrades older databases (safe to run many times).
// Add --seed to insert the sample catalogue (skipped if products already exist).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// columns added after the first version; "duplicate column" means it is already there
const ADD_COLUMNS = [
  'ALTER TABLE products ADD COLUMN mrp DECIMAL(10,2) NULL',
  "ALTER TABLE products ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT 'General'",
  'ALTER TABLE products ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1',
  'ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
  'ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0',
  'ALTER TABLE orders ADD COLUMN shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0',
  'ALTER TABLE orders ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0',
  'ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(40) NULL',
  "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(10) NOT NULL DEFAULT 'ONLINE'",
  "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(10) NOT NULL DEFAULT 'UNPAID'",
  'ALTER TABLE orders ADD COLUMN ship_name VARCHAR(100) NULL',
  'ALTER TABLE orders ADD COLUMN ship_phone VARCHAR(15) NULL',
  'ALTER TABLE orders ADD COLUMN ship_address VARCHAR(200) NULL',
  'ALTER TABLE orders ADD COLUMN ship_city VARCHAR(80) NULL',
  'ALTER TABLE orders ADD COLUMN ship_state VARCHAR(80) NULL',
  'ALTER TABLE orders ADD COLUMN ship_pincode VARCHAR(10) NULL',
  'ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'ALTER TABLE order_items ADD COLUMN name VARCHAR(200) NULL',
];

// old statuses from the first version
const FIX_DATA = [
  "UPDATE orders SET status = 'PENDING_PAYMENT' WHERE status = 'PENDING'",
  "UPDATE orders SET status = 'PLACED', payment_status = 'PAID' WHERE status = 'PAID'",
  'UPDATE orders SET subtotal = total WHERE subtotal = 0 AND total > 0',
];

async function run(conn, file) {
  await conn.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  console.log(`Applied ${file}`);
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  try {
    await run(conn, 'schema.sql');
    for (const sql of ADD_COLUMNS) {
      try { await conn.query(sql); } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    }
    for (const sql of FIX_DATA) await conn.query(sql);

    if (process.argv.includes('--seed')) {
      const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM products');
      if (c > 0) console.log('Products already exist, sample catalogue skipped');
      else await run(conn, 'seed.sql');
    }
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error('DB init failed:', e.message);
  process.exit(1);
});
