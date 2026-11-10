import { useEffect, useState } from 'react';
import { useApp } from '../../store.jsx';
import { Icon, inr, useCountUp, StatusChip, Skeleton, STATUS_LABEL } from '../../ui.jsx';

function StatCard({ cls, label, value, money, sub, icon, delay }) {
  const v = useCountUp(value);
  return (
    <div className={`stat ${cls}`} style={{ animationDelay: delay }}>
      <div className="sm">{label}</div>
      <div className="big">{money ? inr(Math.round(v)) : Math.round(v).toLocaleString('en-IN')}</div>
      <div className="sm">{sub}</div>
      <Icon name={icon} size={90} className="ghost" />
    </div>
  );
}

function Bars({ rows, labelKey, valueKey, format = (x) => x }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey])));
  return rows.map((r) => (
    <div className="hbar" key={r[labelKey]}>
      <div className="top"><span>{STATUS_LABEL[r[labelKey]] || r[labelKey]}</span><b>{format(r[valueKey])}</b></div>
      <div className="track"><i style={{ width: `${(Number(r[valueKey]) / max) * 100}%` }} /></div>
    </div>
  ));
}

export default function AdminDashboard() {
  const { call, toast } = useApp();
  const [s, setS] = useState(null);
  useEffect(() => { call('/admin/stats').then(setS).catch((e) => toast(e.message, 'error')); }, []);

  if (!s) return <div style={{ display: 'grid', gap: 14 }}><Skeleton h={110} r={16} /><Skeleton h={260} r={16} /></div>;
  const maxRev = Math.max(1, ...s.series.map((d) => d.revenue));

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="stats">
        <StatCard cls="g1" label="Total revenue" value={s.revenue} money sub={`Today: ${inr(s.todayRevenue)}`} icon="rupee" delay="0ms" />
        <StatCard cls="g2" label="Orders" value={s.orders} sub={`Today: ${s.todayOrders} · To process: ${s.toProcess}`} icon="box" delay="80ms" />
        <StatCard cls="g3" label="Customers" value={s.customers} sub="Registered accounts" icon="users" delay="160ms" />
        <StatCard cls="g4" label="Active products" value={s.products} sub={`${s.low.length} low on stock`} icon="tag" delay="240ms" />
      </div>

      <div className="panels">
        <div className="card">
          <h3>Sales, last 14 days</h3>
          <div className="bars">
            {s.series.map((d, i) => (
              <div className="bar" key={d.date} title={`${d.date}: ${inr(d.revenue)} from ${d.orders} orders`}>
                <i style={{ height: `${Math.max(2, (d.revenue / maxRev) * 88)}%`, animationDelay: `${i * 45}ms` }} />
                {d.date.slice(8)}
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Orders by status</h3>
          {s.byStatus.length === 0 ? <p className="muted">No orders yet.</p> : <Bars rows={s.byStatus} labelKey="status" valueKey="c" />}
          <h3 style={{ marginTop: 18 }}>Payment method</h3>
          {s.byMethod.length === 0 ? <p className="muted">No paid or COD orders yet.</p> : (
            <Bars rows={s.byMethod.map((m) => ({ ...m, payment_method: m.payment_method === 'COD' ? 'Cash on delivery' : 'Online' }))} labelKey="payment_method" valueKey="revenue" format={inr} />
          )}
        </div>
      </div>

      <div className="panels">
        <div className="card scroll-x">
          <h3>Recent orders</h3>
          <table className="tbl">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {s.recent.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td><td>{o.customer || '-'}</td><td>{inr(o.total)}</td>
                  <td>{o.payment_method === 'COD' ? 'COD' : 'Online'}</td><td><StatusChip status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.recent.length === 0 && <p className="muted">No orders yet.</p>}
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card">
            <h3>Top selling</h3>
            {s.top.length === 0 && <p className="muted">Nothing sold yet.</p>}
            {s.top.map((t, i) => (
              <div className="sum-row" key={t.product_id}><span>{i + 1}. {t.name}</span><b>{t.qty} sold</b></div>
            ))}
          </div>
          <div className="card">
            <h3>Low stock</h3>
            {s.low.length === 0 && <p className="muted">All products have enough stock.</p>}
            {s.low.map((p) => (
              <div className="sum-row" key={p.id}><span>{p.name}</span><b className={p.stock === 0 ? 'err' : 'low'}>{p.stock} left</b></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
