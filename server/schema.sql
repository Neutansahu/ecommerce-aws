-- Idempotent: every server runs this at start-up (see init-db.js for upgrades of older databases).
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(20) DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200),
  description TEXT,
  price DECIMAL(10,2),
  mrp DECIMAL(10,2) NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'General',
  stock INT,
  image_url VARCHAR(300),
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_category (category)
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2),
  coupon_code VARCHAR(40) NULL,
  status VARCHAR(20),
  payment_method VARCHAR(10) NOT NULL DEFAULT 'ONLINE',
  payment_status VARCHAR(10) NOT NULL DEFAULT 'UNPAID',
  ship_name VARCHAR(100) NULL,
  ship_phone VARCHAR(15) NULL,
  ship_address VARCHAR(200) NULL,
  ship_city VARCHAR(80) NULL,
  ship_state VARCHAR(80) NULL,
  ship_pincode VARCHAR(10) NULL,
  razorpay_order_id VARCHAR(60),
  razorpay_payment_id VARCHAR(60),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status, created_at),
  INDEX idx_orders_rzp (razorpay_order_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT,
  product_id INT,
  name VARCHAR(200) NULL,
  quantity INT,
  price DECIMAL(10,2),
  INDEX idx_items_order (order_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  code VARCHAR(20) PRIMARY KEY,
  type VARCHAR(10) NOT NULL DEFAULT 'percent',
  value DECIMAL(10,2) NOT NULL,
  min_order DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(10,2) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reset_hash (token_hash)
);
