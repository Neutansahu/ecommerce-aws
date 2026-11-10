import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { go } from '../router.jsx';
import { payOnline } from '../pay.js';
import { Icon, inr, Confetti, Empty, ProductImage } from '../ui.jsx';

const BLANK = { name: '', phone: '', address: '', city: '', state: '', pincode: '' };

export default function CheckoutPage() {
  const { user, lines, cartSubtotal, config, call, clearCart, toast } = useApp();
  const [addr, setAddr] = useState(() => {
    try { return { ...BLANK, ...(JSON.parse(localStorage.getItem('address')) || {}) }; } catch { return BLANK; }
  });
  const [method, setMethod] = useState(null);
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setAddr({ ...addr, [k]: e.target.value });

  useEffect(() => { if (user && !addr.name) setAddr((a) => ({ ...a, name: user.name })); }, [user]);

  if (!user) {
    return (
      <div className="container">
        <Empty icon="lock" title="Log in to continue">You need an account to place an order. <a href="#/login?next=%2Fcheckout">Log in</a> or <a href="#/register">create an account</a>.</Empty>
      </div>
    );
  }
  if (!lines.length) {
    return <div className="container"><Empty icon="cart" title="Your cart is empty"><a href="#/">Continue shopping</a></Empty></div>;
  }

  const discount = applied ? applied.discount : 0;
  const after = cartSubtotal - discount;
  const shipping = after >= config.freeShippingAbove ? 0 : config.shippingFee;
  const total = after + shipping;
  const codOk = total <= config.codMax;
  const effective = method || (config.onlinePayments ? 'ONLINE' : 'COD');

  const applyCoupon = async () => {
    try {
      const r = await call('/orders/validate-coupon', { method: 'POST', body: { code, subtotal: cartSubtotal } });
      setApplied(r);
      toast(`Coupon ${r.code} applied. You save ${inr(r.discount)}`, 'success');
    } catch (e) {
      setApplied(null);
      toast(e.message, 'error');
    }
  };

  const place = async () => {
    setBusy(true);
    try {
      localStorage.setItem('address', JSON.stringify(addr));
      const r = await call('/orders', {
        method: 'POST',
        body: {
          items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
          payment_method: effective,
          address: addr,
          coupon_code: applied ? applied.code : '',
        },
      });
      clearCart();
      if (effective === 'COD') return go(`/order-success/${r.order_id}?m=COD`);
      try {
        const result = await payOnline(call, r.order_id, user);
        if (result === 'paid') return go(`/order-success/${r.order_id}?m=ONLINE`);
        toast('Payment was not completed. You can pay from My Orders.', 'info');
      } catch (e) {
        toast(e.message, 'error');
      }
      go('/orders');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h1>Checkout</h1>
      <div className="two">
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card">
            <h3>1. Delivery address</h3>
            <div className="row2">
              <div className="field"><label>Full name</label><input value={addr.name} onChange={set('name')} /></div>
              <div className="field"><label>Mobile number</label><input value={addr.phone} onChange={set('phone')} inputMode="numeric" maxLength={10} placeholder="10 digits" /></div>
            </div>
            <div className="field"><label>Address (house, street, area)</label><input value={addr.address} onChange={set('address')} /></div>
            <div className="row3">
              <div className="field"><label>City</label><input value={addr.city} onChange={set('city')} /></div>
              <div className="field"><label>State</label><input value={addr.state} onChange={set('state')} /></div>
              <div className="field"><label>Pincode</label><input value={addr.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} /></div>
            </div>
          </div>

          <div className="card">
            <h3>2. Payment method</h3>
            <div className="paychoice">
              <label className={`opt ${effective === 'ONLINE' ? 'on' : ''} ${!config.onlinePayments ? 'disabled' : ''}`}>
                <input type="radio" name="pay" disabled={!config.onlinePayments} checked={effective === 'ONLINE'} onChange={() => setMethod('ONLINE')} />
                <span className="ic"><Icon name="card" /></span>
                <span><b>Pay online</b><br /><span className="muted small">{config.onlinePayments ? 'Cards, UPI, net banking and wallets' : 'Not available yet'}</span></span>
              </label>
              <label className={`opt ${effective === 'COD' ? 'on' : ''} ${!codOk ? 'disabled' : ''}`}>
                <input type="radio" name="pay" disabled={!codOk} checked={effective === 'COD'} onChange={() => setMethod('COD')} />
                <span className="ic"><Icon name="cash" /></span>
                <span><b>Cash on delivery</b><br /><span className="muted small">{codOk ? 'Pay in cash when your order arrives' : `Available up to ${inr(config.codMax)}`}</span></span>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>3. Review items</h3>
            {lines.map((l) => (
              <div className="oitem" key={l.product.id}>
                <div className="thumb"><ProductImage product={l.product} /></div>
                <div style={{ flex: 1 }}><b>{l.product.name}</b><div className="muted small">Qty {l.qty}</div></div>
                <b>{inr(Number(l.product.price) * l.qty)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="card summary">
          <h3>Price details</h3>
          <div className="coupon" style={{ marginBottom: 12 }}>
            <input placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn sm light" onClick={applyCoupon}>Apply</button>
          </div>
          <div className="sum-row"><span>Subtotal</span><span>{inr(cartSubtotal)}</span></div>
          {applied && <div className="sum-row green-t"><span>Coupon {applied.code}</span><span>− {inr(discount)}</span></div>}
          <div className="sum-row"><span>Delivery</span><span className={shipping === 0 ? 'green-t' : ''}>{shipping === 0 ? 'FREE' : inr(shipping)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{inr(total)}</span></div>
          <button className="btn block" style={{ marginTop: 14 }} disabled={busy} onClick={place}>
            {busy ? <span className="spinner" /> : <Icon name="lock" size={16} />}
            {effective === 'COD' ? 'Place order (pay on delivery)' : `Pay ${inr(total)}`}
          </button>
          <p className="muted small" style={{ marginTop: 10 }}>Prices and stock are confirmed again when you place the order.</p>
        </div>
      </div>
    </div>
  );
}

export function OrderSuccess({ id, method }) {
  const { call } = useApp();
  const [order, setOrder] = useState(null);
  useEffect(() => {
    call('/orders').then((list) => setOrder(list.find((o) => String(o.id) === String(id)) || null)).catch(() => {});
  }, [id]);

  const day = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const cod = method === 'COD';

  return (
    <div className="container">
      <Confetti />
      <div className="card success">
        <svg className="check" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" /><path d="M36 62 l16 16 l32 -34" /></svg>
        <h1>{cod ? 'Your order is placed!' : 'Payment successful!'}</h1>
        <p className="sub muted">Order <b>#{id}</b> is confirmed.{cod ? ' Keep the cash ready for the delivery.' : ' Thank you for shopping with us.'}</p>
        <div className="detail">
          <div className="deliv"><Icon name="truck" /> Estimated delivery: {day(3)} to {day(6)}</div>
          {order && (
            <>
              {order.items.map((i) => (
                <div className="oitem" key={i.id}>
                  <div className="thumb"><ProductImage product={{ id: i.product_id, name: i.name, image_url: i.image_url }} /></div>
                  <div style={{ flex: 1 }}>{i.name}<div className="muted small">Qty {i.quantity}</div></div>
                  <b>{inr(i.price * i.quantity)}</b>
                </div>
              ))}
              <div className="sum-row total"><span>{cod ? 'To pay on delivery' : 'Paid'}</span><span>{inr(order.total)}</span></div>
              <p className="muted small">Delivering to {order.ship_name}, {order.ship_address}, {order.ship_city}, {order.ship_state} {order.ship_pincode}</p>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="btn" href="#/orders"><Icon name="box" size={18} /> Track my order</a>
          <a className="btn light" href="#/">Continue shopping</a>
        </div>
      </div>
    </div>
  );
}
