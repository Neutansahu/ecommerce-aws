import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { payOnline } from '../pay.js';
import { Icon, inr, ProductImage, StatusChip, Empty, Skeleton } from '../ui.jsx';

const STEPS = [['PLACED', 'Placed', 'tag'], ['PROCESSING', 'Packing', 'box'], ['SHIPPED', 'Shipped', 'truck'], ['DELIVERED', 'Delivered', 'check']];

function Timeline({ status }) {
  if (status === 'CANCELLED') return <div className="cancelled-note">This order was cancelled.</div>;
  const idx = status === 'PENDING_PAYMENT' ? -1 : STEPS.findIndex((s) => s[0] === status);
  const delivered = status === 'DELIVERED';
  return (
    <div className="timeline">
      {idx > 0 && <span className="fill" style={{ width: `${(idx / (STEPS.length - 1)) * 88}%` }} />}
      {STEPS.map((s, i) => (
        <div key={s[0]} className={`tstep ${i < idx || delivered ? 'done' : i === idx ? 'now' : ''}`}>
          <div className="tdot"><Icon name={s[2]} size={16} /></div>{s[1]}
        </div>
      ))}
    </div>
  );
}

function payText(o) {
  if (o.payment_status === 'REFUNDED') return 'Refunded to your original payment method';
  if (o.payment_method === 'COD') return o.payment_status === 'PAID' ? 'Cash on delivery (paid)' : 'Cash on delivery (pay when it arrives)';
  return o.payment_status === 'PAID' ? 'Paid online' : 'Online payment pending';
}

export default function OrdersPage() {
  const { user, call, toast } = useApp();
  const [orders, setOrders] = useState(null);
  const load = () => call('/orders').then(setOrders).catch((e) => toast(e.message, 'error'));
  useEffect(() => { if (user) load(); }, [user && user.id]);

  if (!user) return <div className="container"><Empty icon="lock" title="Log in to see your orders"><a href="#/login?next=%2Forders">Log in</a></Empty></div>;
  if (!orders) return <div className="container"><Skeleton h={220} r={16} /></div>;
  if (!orders.length) return <div className="container"><Empty icon="box" title="No orders yet">When you order something it shows up here. <a href="#/">Start shopping</a></Empty></div>;

  const pay = async (o) => {
    try {
      const r = await payOnline(call, o.id, user);
      toast(r === 'paid' ? 'Payment successful!' : 'Payment was not completed', r === 'paid' ? 'success' : 'info');
    } catch (e) {
      toast(e.message, 'error');
    }
    load();
  };
  const cancel = async (o) => {
    if (!window.confirm(`Cancel order #${o.id}?`)) return;
    try {
      await call(`/orders/${o.id}/cancel`, { method: 'POST' });
      toast('Order cancelled', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
    load();
  };

  return (
    <div className="container">
      <h1>My orders</h1>
      {orders.map((o, n) => (
        <div className="order" key={o.id} style={{ animationDelay: `${n * 70}ms` }}>
          <div className="order-head">
            <div><b>Order #{o.id}</b><div className="muted small">{new Date(o.created_at).toLocaleString('en-IN')}</div></div>
            <div><div className="muted small">Total</div><b>{inr(o.total)}</b></div>
            <div><div className="muted small">Payment</div><span className="small">{payText(o)}</span></div>
            <StatusChip status={o.status} />
          </div>
          <div className="order-body">
            {o.items.map((i) => (
              <div className="oitem" key={i.id}>
                <div className="thumb"><ProductImage product={{ id: i.product_id, name: i.name, image_url: i.image_url }} /></div>
                <div style={{ flex: 1 }}>
                  <a href={`#/product/${i.product_id}`}>{i.name}</a>
                  <div className="muted small">Qty {i.quantity} · {inr(i.price)} each</div>
                </div>
                {o.status === 'DELIVERED' && <a className="btn sm light" href={`#/product/${i.product_id}`}>Write a review</a>}
              </div>
            ))}
            <Timeline status={o.status} />
            {o.ship_address && <p className="muted small" style={{ marginTop: 14 }}>Delivering to {o.ship_name}, {o.ship_address}, {o.ship_city}, {o.ship_state} {o.ship_pincode}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {o.status === 'PENDING_PAYMENT' && o.payment_method === 'ONLINE' && <button className="btn sm green" onClick={() => pay(o)}>Pay now</button>}
              {['PENDING_PAYMENT', 'PLACED'].includes(o.status) && <button className="btn sm light" onClick={() => cancel(o)}>Cancel order</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
