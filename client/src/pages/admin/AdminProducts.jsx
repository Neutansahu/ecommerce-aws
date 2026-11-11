import { useEffect, useState } from 'react';
import { apiUpload } from '../../api.js';
import { useApp } from '../../store.jsx';
import { Icon, inr, ProductImage } from '../../ui.jsx';

function ProductForm({ initial, categories, onClose, onSaved }) {
  const { call, token, toast } = useApp();
  const [f, setF] = useState(initial || { name: '', description: '', category: 'General', price: '', mrp: '', stock: '', image_url: '' });
  const [tab, setTab] = useState('link');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const upload = async (file) => {
    if (!file) return;
    setBusy('image');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await apiUpload('/admin/upload', fd, token);
      setF((x) => ({ ...x, image_url: r.image_url }));
      toast('Image uploaded', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const fetchLink = async () => {
    if (!link.trim()) return toast('Paste an image link or a product page link first', 'error');
    setBusy('image');
    try {
      const r = await call('/admin/import-image', { method: 'POST', body: { url: link.trim() } });
      setF((x) => ({ ...x, image_url: r.image_url }));
      toast('Image fetched from the link', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      const body = { ...f, mrp: f.mrp === null ? '' : f.mrp };
      if (initial && initial.id) await call(`/admin/products/${initial.id}`, { method: 'PUT', body });
      else await call('/admin/products', { method: 'POST', body });
      toast('Product saved', 'success');
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>{initial && initial.id ? 'Edit product' : 'Add product'}</h2>
          <button className="btn sm light" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="field"><label>Product name</label><input value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Description</label><textarea rows="3" value={f.description || ''} onChange={set('description')} /></div>
        <div className="row2">
          <div className="field">
            <label>Category</label>
            <input list="cats" value={f.category} onChange={set('category')} />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="field"><label>Stock</label><input type="number" value={f.stock} onChange={set('stock')} /></div>
        </div>
        <div className="row2">
          <div className="field"><label>Selling price (₹)</label><input type="number" value={f.price} onChange={set('price')} /></div>
          <div className="field"><label>MRP / original price (₹, optional)</label><input type="number" value={f.mrp == null ? '' : f.mrp} onChange={set('mrp')} /></div>
        </div>

        <label>Product image</label>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div className="preview">
            {f.image_url ? <ProductImage product={{ id: 1, name: f.name || 'Preview', image_url: f.image_url }} /> : 'No image yet'}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="tabs">
              <button className={tab === 'link' ? 'on' : ''} onClick={() => setTab('link')}><Icon name="link" size={16} /> From a link</button>
              <button className={tab === 'upload' ? 'on' : ''} onClick={() => setTab('upload')}><Icon name="upload" size={16} /> Upload file</button>
            </div>
            {tab === 'link' ? (
              <>
                <input placeholder="https://... image link or product page link" value={link} onChange={(e) => setLink(e.target.value)} />
                <button className="btn sm" style={{ marginTop: 8 }} disabled={busy === 'image'} onClick={fetchLink}>
                  {busy === 'image' ? <span className="spinner" /> : <Icon name="link" size={14} />} Fetch image
                </button>
                <p className="muted small" style={{ marginTop: 8 }}>
                  Paste a direct image link, or a product page and we pick its main picture. Some big shopping sites block this; then save the image and upload it. Only use images you have the right to use.
                </p>
              </>
            ) : (
              <>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files[0])} />
                <p className="muted small" style={{ marginTop: 8 }}>JPG, PNG or WebP, up to 5 MB.</p>
              </>
            )}
            {f.image_url && <button className="btn sm light" style={{ marginTop: 8 }} onClick={() => setF({ ...f, image_url: '' })}>Remove image</button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn light" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy === 'save'} onClick={save}>{busy === 'save' && <span className="spinner" />} Save product</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProducts() {
  const { call, toast } = useApp();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | product

  const load = (term = q) => call('/admin/products' + (term ? `?q=${encodeURIComponent(term)}` : '')).then(setItems).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(''); }, []);

  const toggle = async (p) => {
    try {
      await call(`/admin/products/${p.id}/active`, { method: 'PATCH', body: { active: !p.active } });
      toast(p.active ? 'Product hidden from the shop' : 'Product is visible again', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const categories = [...new Set((items || []).map((p) => p.category))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h1>Products</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(q)} style={{ width: 200 }} />
          <button className="btn" onClick={() => setEditing({})}><Icon name="plus" size={16} /> Add product</button>
        </div>
      </div>
      <div className="card scroll-x">
        <table className="tbl">
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(items || []).map((p) => (
              <tr key={p.id} style={p.active ? {} : { opacity: 0.55 }}>
                <td><div className="thumb"><ProductImage product={p} /></div></td>
                <td><b>{p.name}</b></td>
                <td>{p.category}</td>
                <td>{inr(p.price)}{p.mrp > p.price && <span className="muted small"> <s>{inr(p.mrp)}</s></span>}</td>
                <td><span className={p.stock === 0 ? 'err' : p.stock <= 5 ? 'low' : ''}>{p.stock}</span></td>
                <td>{p.active ? 'Visible' : 'Hidden'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm light" onClick={() => setEditing(p)}>Edit</button>{' '}
                  <button className="btn sm light" onClick={() => toggle(p)}>{p.active ? 'Hide' : 'Show'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items && items.length === 0 && <p className="muted">No products found.</p>}
      </div>
      {editing && (
        <ProductForm
          initial={editing.id ? editing : null}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
