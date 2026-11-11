# ShopNest: multi-tier e-commerce on AWS

| Tier | What | AWS services |
|---|---|---|
| Presentation | React storefront and admin (Vite) | CloudFront, S3 |
| Application | Node/Express REST API | ALB, Auto Scaling EC2, Secrets Manager, SES (email) |
| Data | Users, products, orders, images | RDS MySQL 8.4, S3 |

```
Browser -> CloudFront --/            -> S3 (React build)
                      --/images/*    -> S3 (product images)
                      --/api/*       -> ALB -> EC2 x2-4 (Express) -> RDS MySQL
                                                       |-> SES (emails)  |-> Razorpay
```

## Features

**Shopping:** search, categories, price filter, sorting, discount badges, product pages, star ratings and reviews
(after delivery), wishlist, cart that survives refresh, coupons, delivery address, free delivery above a limit.

**Checkout and orders:** pay online (Razorpay) or **cash on delivery**, animated order confirmation, order history with
a live tracking timeline, cancel before dispatch (stock returned, online payments refunded).

**Emails (Amazon SES):** welcome, order confirmation to the customer, new-order alert to the admin, status updates
(packing, shipped, delivered, cancelled), password reset.

**Accounts:** register, login, **forgot password** (emailed link, 1 hour, single use).

**Admin:** dashboard (revenue, orders, customers, 14-day sales chart, status and payment split, top sellers, low stock),
product add/edit/hide with image **upload or image from a link**, order management with status buttons, coupons.

## Folder layout

```
ecommerce-aws/
├── infra/ecommerce-stack.yaml      CloudFormation: all infrastructure
├── scripts/                        PowerShell: deploy-stack, deploy-frontend, refresh-servers
├── server/
│   ├── server.js  db.js  init-db.js  make-admin.js  schema.sql  seed.sql
│   ├── lib/      http.js  mail.js  orders.js  images.js  safe-fetch.js  razorpay.js
│   └── routes/   auth.js  products.js  wishlist.js  orders.js  payments.js  admin.js
└── client/src/
    ├── App.jsx  store.jsx  router.jsx  api.js  pay.js  ui.jsx  styles.css
    └── pages/    Home  ProductPage  CartPage  CheckoutPage  OrdersPage  WishlistPage  AuthPages  Admin
                  admin/  AdminDashboard  AdminProducts  AdminOrders  AdminCoupons
```

## Quick start

1. Push this folder to a PUBLIC GitHub repo (servers clone it at boot).
2. Deploy (add `-SesFromEmail you@example.com` to turn on emails):
   `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-stack.ps1 -RepoUrl https://github.com/<you>/<repo> -SesFromEmail you@example.com`
3. Click the verification link Amazon SES emails to that address.
4. Add sample products and make yourself admin (EC2 > Connect > Session Manager):
   ```
   sudo -i
   source /usr/local/bin/shop-env.sh
   cd /opt/shop/server
   node init-db.js --seed
   node make-admin.js you@example.com      (register on the site first)
   ```
5. `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-frontend.ps1`

Update later: push to GitHub then `scripts\refresh-servers.ps1` (backend) or `scripts\deploy-frontend.ps1` (frontend).
The database upgrades itself on start-up, so an older database keeps its data.

## Email notes

SES starts in **sandbox mode**: it only delivers to addresses you verified. To email real customers open
SES > Account dashboard > Request production access. Without `SesFromEmail` the shop works and emails are skipped.

## Clean up

```
aws s3 rm s3://<FrontendBucketName> --recursive
aws s3 rm s3://<ImagesBucketName> --recursive
aws cloudformation delete-stack --stack-name shop-stack
```

Never commit `.env` files or keys. On AWS all secrets live in Secrets Manager.
