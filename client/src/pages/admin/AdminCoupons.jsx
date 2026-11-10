import { useEffect, useState } from 'react';
import { useApp } from '../../store.jsx';
import { Icon, inr } from '../../ui.jsx';

const BLANK = { code: '', type: 'percent', value: '', min_order: '', max_discount: '', expires_at: '' };

export default function AdminCoupons() {
  const { call, toast } = useApp();
  const [list, setList] = useState(null);
  const [f, setF] = useState(BLANK);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = () => call('/admin/coupons').then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await call('/admin/coupons', { method: 'POST', body: f });
      toast('Coupon created', 'success');
      setF(BLANK);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const toggle = async (c) => { await call(`/admin/coupons/${c.code}`, { method: 'PATCH', body: { active: !c.active } }).catch((e) => toast(e.message, 'error')); load(); };
  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    await call(`/admin/coupons/${c.code}`, { method: 'DELETE' }).catch((e) => toast(e.message, 'error'));
    load();
  };

  return (
    <div>
      <h1>Coupons</h1>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Create a coupon</h3>
        <div className="row3">
          <div className="field"><label>Code</label><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
          <div className="field"><label>Type</label>
            <select value={f.type} onChange={set('type')}><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select>
          </div>
          <div className="field"><label>{f.type === 'percent' ? 'Percent (max 90)' : 'Amount (₹)'}</label><input type="number" value={f.value} onChange={set('value')} /></div>
        </div>
        <div className="row3">
          <div className="field"><label>Minimum order (₹)</label><input type="number" value={f.min_order} onChange={set('min_order')} /></div>
          <div className="field"><label>Max discount (₹, percent only)</label><input type="number" value={f.max_discount} onChange={set('max_discount')} /></div>
          <div className="field"><label>Expires on (optional)</label><input type="date" value={f.expires_at} onChange={set('expires_at')} /></div>
        </div>
        <button className="btn" onClick={create}><Icon name="plus" size={16} /> Create coupon</button>
      </div>

      <div className="card scroll-x">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Expires</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(list || []).map((c) => (
              <tr key={c.code}>
                <td><b>{c.code}</b></td>
                <td>{c.type === 'percent' ? `${c.value}%${c.max_discount != null ? ` (up to ${inr(c.max_discount)})` : ''}` : inr(c.value)}</td>
                <td>{inr(c.min_order)}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : 'Never'}</td>
                <td>{c.active ? 'Active' : 'Off'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm light" onClick={() => toggle(c)}>{c.active ? 'Turn off' : 'Turn on'}</button>{' '}
                  <button className="btn sm light" onClick={() => remove(c)}><Icon name="trash" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list && list.length === 0 && <p className="muted">No coupons yet.</p>}
      </div>
    </div>
  );
}
