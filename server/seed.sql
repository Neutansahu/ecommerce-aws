-- Sample catalogue (no images yet: add them in Admin > Products by upload or link).
INSERT INTO products (name, description, price, mrp, category, stock) VALUES
('Wireless Bluetooth Earbuds', 'Noise-isolating earbuds with 24-hour battery life and a pocket charging case.', 1499, 2999, 'Electronics', 40),
('Smart Fitness Band', 'Tracks steps, heart rate and sleep. Water resistant with a 10-day battery.', 1999, 3499, 'Electronics', 35),
('Portable Power Bank 20000mAh', 'Fast-charging power bank with two USB ports and a USB-C port.', 1799, 2499, 'Electronics', 50),
('Men''s Cotton Casual Shirt', 'Soft breathable cotton, regular fit, easy to wash and wear.', 799, 1499, 'Fashion', 60),
('Women''s Running Shoes', 'Lightweight mesh shoes with a cushioned sole for daily runs.', 1999, 3999, 'Fashion', 30),
('Classic Analog Watch', 'Stainless steel case with a leather strap and date display.', 2499, 4999, 'Fashion', 25),
('Non-stick Cookware Set (3 pcs)', 'Frying pan, kadhai and tawa with cool-touch handles.', 1299, 2199, 'Home & Kitchen', 45),
('Stainless Steel Water Bottle 1L', 'Keeps drinks cold for 24 hours and hot for 12 hours.', 449, 799, 'Home & Kitchen', 80),
('LED Study Desk Lamp', 'Dimmable LED lamp with three colour modes and a flexible neck.', 699, 1199, 'Home & Kitchen', 55),
('Programming Fundamentals (Paperback)', 'A beginner friendly guide to thinking like a programmer.', 549, 899, 'Books', 40),
('Habit Building Guide (Paperback)', 'Small daily changes that add up to big results.', 399, 699, 'Books', 70),
('Vitamin C Face Serum 30ml', 'Brightening serum with hyaluronic acid for daily use.', 499, 899, 'Beauty', 65),
('Herbal Shampoo 340ml', 'Gentle sulphate-free shampoo for all hair types.', 249, 399, 'Beauty', 90),
('Yoga Mat 6mm', 'Non-slip, extra thick mat with a carry strap.', 599, 999, 'Sports', 50),
('Badminton Racket Set', 'Two rackets, three shuttlecocks and a carry bag.', 899, 1499, 'Sports', 28);

INSERT IGNORE INTO coupons (code, type, value, min_order, max_discount) VALUES
('WELCOME10', 'percent', 10, 499, 200),
('FLAT100', 'flat', 100, 999, NULL);
