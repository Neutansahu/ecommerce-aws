import { useEffect, useState } from 'react';
import { useApp } from '../../store.jsx';
import { inr, StatusChip, Empty, STATUS_LABEL } from '../../ui.jsx';

const ACTION = { PROCESSING: 'Mark as packing', SHIPPED: 'Mark as shipped', DELIVERED: 'Mark as delivered', CANCELLED: 'Cancel order' };

export default function AdminOrders() {
  const { call, toast } = useApp();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const load = () => call(`/admin/orders?page=${page}${status ? `&status=${status}` : ''}`).then(setData).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, [status, page]);

  const move = async (o, next) => {
    if (next === 'CANCELLED' && !window.confirm(`Cancel order #${o.id}? Stock is returned and paid online orders are refunded.`)) return;
    try {
      await call(`/admin/orders/${o.id}/status`, { method: 'PUT', body: { status: next } });
      toast(`Order #${o.id} is now ${STATUS_LABEL[next]}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h1>Orders</h1>
        <select style={{ width: 'auto' }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {data && data.items.length === 0 && <Empty icon="box" title="No orders here">Orders will appear when customers buy.</Empty>}
      {data && data.items.map((o) => (
        <div className="order" key={o.id}>
          <div className="order-head">
            <div><b>Order #{o.id}</b><div className="muted small">{new Date(o.created_at).toLocaleString('en-IN')}</div></div>
            <div><div className="muted small">Customer</div><b>{o.customer_name}</b><div className="muted small">{o.customer_email}</div></div>
            <div><div className="muted small">Total</div><b>{inr(o.total)}</b></div>
            <div><div className="muted small">Payment</div>{o.payment_method === 'COD' ? 'Cash on delivery' : 'Online'} · {o.payment_status}</div>
            <StatusChip status={o.status} />
          </div>
          <div className="order-body">
            {o.items.map((i) => <div className="sum-row" key={i.id}><span>{i.name} × {i.quantity}</span><span>{inr(i.price * i.quantity)}</span></div>)}
            {(Number(o.discount) > 0 || Number(o.shipping_fee) > 0) && (
              <p className="muted small">Discount {inr(o.discount)}{o.coupon_code ? ` (${o.coupon_code})` : ''} · Delivery {inr(o.shipping_fee)}</p>
            )}
            <p className="muted small" style={{ marginTop: 8 }}>
              Ship to: {o.ship_name}, {o.ship_phone}, {o.ship_address}, {o.ship_city}, {o.ship_state} {o.ship_pincode}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {o.next.map((n) => (
                <button key={n} className={`btn sm ${n === 'CANCELLED' ? 'danger' : n === 'DELIVERED' ? 'green' : ''}`} onClick={() => move(o, n)}>{ACTION[n]}</button>
              ))}
              {o.next.length === 0 && <span className="muted small">No further actions</span>}
            </div>
          </div>
        </div>
      ))}
      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn sm light" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {data.page} of {data.pages}</span>
          <button className="btn sm light" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
