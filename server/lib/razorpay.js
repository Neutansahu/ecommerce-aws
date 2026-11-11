const Razorpay = require('razorpay');

// null until the keys are added to Secrets Manager
module.exports = process.env.RAZORPAY_KEY_ID
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;
