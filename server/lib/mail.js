// Email through Amazon SES. Never throws: a failed email must not break an order.
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');

const FROM = process.env.SES_FROM;
const ses = FROM ? new SESv2Client({ region: process.env.AWS_REGION }) : null;
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function sendMail({ to, subject, html, text }) {
  if (!ses || !to) {
    console.log('[mail skipped]', subject);
    return;
  }
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
        },
      },
    }));
  } catch (e) {
    console.error('[mail failed]', subject, e.message);
  }
}

const layout = (title, body) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:18px 24px;font-size:22px;font-weight:bold">ShopNest</div>
  <div style="padding:24px;color:#111827;line-height:1.5">
    <h2 style="margin-top:0">${esc(title)}</h2>${body}
  </div>
  <div style="padding:14px 24px;background:#f3f4f6;color:#6b7280;font-size:12px">This is an automated message from ShopNest.</div>
</div>`;

const button = (href, label) =>
  `<p><a href="${esc(href)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`;

const itemRows = (items) => items.map((i) =>
  `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${inr(i.price * i.quantity)}</td></tr>`).join('');

const totalsHtml = (o) => `
<table style="width:100%;border-collapse:collapse;margin:12px 0">
  ${''}<tr><td style="padding:4px 0;color:#6b7280">Subtotal</td><td style="text-align:right">${inr(o.subtotal)}</td></tr>
  ${Number(o.discount) > 0 ? `<tr><td style="padding:4px 0;color:#16a34a">Discount${o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : ''}</td><td style="text-align:right;color:#16a34a">− ${inr(o.discount)}</td></tr>` : ''}
  <tr><td style="padding:4px 0;color:#6b7280">Delivery</td><td style="text-align:right">${Number(o.shipping_fee) > 0 ? inr(o.shipping_fee) : 'FREE'}</td></tr>
  <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #e5e7eb">Total</td><td style="text-align:right;font-weight:bold;border-top:1px solid #e5e7eb">${inr(o.total)}</td></tr>
</table>`;

const addressHtml = (o) =>
  `${esc(o.ship_name)}<br>${esc(o.ship_address)}<br>${esc(o.ship_city)}, ${esc(o.ship_state)} ${esc(o.ship_pincode)}<br>Phone: ${esc(o.ship_phone)}`;

const payLine = (o) => o.payment_method === 'COD'
  ? `Payment: <b>Cash on delivery</b>. Please keep ${inr(o.total)} ready.`
  : 'Payment: <b>Paid online</b>. Thank you!';

const emails = {
  welcome: (name) => ({
    subject: 'Welcome to ShopNest',
    html: layout(`Welcome, ${name}!`, `<p>Your account is ready. Start shopping any time.</p>${button(SITE || '#', 'Visit ShopNest')}`),
    text: `Welcome to ShopNest, ${name}! Your account is ready.`,
  }),

  orderPlaced: (o, items) => ({
    subject: `Order #${o.id} confirmed`,
    html: layout(`Thank you for your order, ${o.ship_name}!`, `
      <p>We have received your order <b>#${o.id}</b>.</p><p>${payLine(o)}</p>
      <table style="width:100%;border-collapse:collapse">${itemRows(items)}</table>${totalsHtml(o)}
      <p style="margin-bottom:4px"><b>Delivering to</b></p><p style="margin-top:0">${addressHtml(o)}</p>
      ${button(`${SITE}/#/orders`, 'Track your order')}`),
    text: `Order #${o.id} confirmed. Total ${inr(o.total)}. ${o.payment_method === 'COD' ? 'Pay in cash on delivery.' : 'Paid online.'} Track it at ${SITE}/#/orders`,
  }),

  adminNewOrder: (o, items, customer) => ({
    subject: `New order #${o.id} - ${inr(o.total)} (${o.payment_method})`,
    html: layout(`New order #${o.id}`, `
      <p>Customer: <b>${esc(customer && customer.name)}</b> (${esc(customer && customer.email)})</p><p>${payLine(o)}</p>
      <table style="width:100%;border-collapse:collapse">${itemRows(items)}</table>${totalsHtml(o)}
      <p style="margin-bottom:4px"><b>Ship to</b></p><p style="margin-top:0">${addressHtml(o)}</p>
      ${button(`${SITE}/#/admin/orders`, 'Open admin orders')}`),
    text: `New order #${o.id} from ${customer && customer.name}: ${inr(o.total)} (${o.payment_method}). Open ${SITE}/#/admin/orders`,
  }),

  orderStatus: (o, status) => {
    const msg = {
      PROCESSING: 'Your order is being packed.',
      SHIPPED: 'Good news, your order is on its way!',
      DELIVERED: 'Your order has been delivered. We hope you love it! You can now review the products you bought.',
      CANCELLED: o.payment_status === 'REFUNDED'
        ? 'Your order was cancelled and your payment has been refunded. Banks usually take 5 to 7 working days to show it.'
        : 'Your order was cancelled.',
    }[status] || `Your order status is now ${status}.`;
    return {
      subject: `Order #${o.id}: ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      html: layout(`Order #${o.id} update`, `<p>${esc(msg)}</p>${button(`${SITE}/#/orders`, 'View order')}`),
      text: `Order #${o.id}: ${msg} ${SITE}/#/orders`,
    };
  },

  passwordReset: (name, link) => ({
    subject: 'Reset your ShopNest password',
    html: layout('Reset your password', `
      <p>Hi ${esc(name)}, we received a request to reset your password. The link works for 1 hour.</p>
      ${button(link, 'Choose a new password')}
      <p style="color:#6b7280;font-size:13px">If you did not ask for this, you can ignore this email. Your password stays the same.</p>`),
    text: `Reset your ShopNest password (valid for 1 hour): ${link}\nIf you did not ask for this, ignore this email.`,
  }),
};

module.exports = { sendMail, emails, SITE };
