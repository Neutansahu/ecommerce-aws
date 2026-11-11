import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { go, qs } from '../router.jsx';
import { Icon, inr, ProductImage, RatingChip, Skeleton, Empty } from '../ui.jsx';

export function ProductCard({ p, index = 0 }) {
  const { addToCart, toggleWish, wishlist } = useApp();
  const liked = wishlist.includes(p.id);
  return (
    <div className="pcard" style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }} onClick={() => go(`/product/${p.id}`)}>
      <div className="imgbox">
        <ProductImage product={p} />
        {p.discount_pct > 0 && <span className="off-badge">{p.discount_pct}% OFF</span>}
        <button className={`wish ${liked ? 'on' : ''}`} aria-label="Save to wishlist"
          onClick={(e) => { e.stopPropagation(); toggleWish(p); }}>
          <Icon name="heart" size={18} />
        </button>
      </div>
      <div className="pbody">
        <div className="pname">{p.name}</div>
        <RatingChip rating={p.rating} count={p.review_count} />
        <div className="price">
          <span className="now">{inr(p.price)}</span>
          {p.discount_pct > 0 && <span className="was">{inr(p.mrp)}</span>}
        </div>
        {p.stock < 1 && <span className="out">Out of stock</span>}
        {p.stock >= 1 && p.stock <= 5 && <span className="low">Only {p.stock} left</span>}
        <button className="btn sm" disabled={p.stock < 1} onClick={(e) => { e.stopPropagation(); addToCart(p); }}>
          <Icon name="cart" size={16} /> Add to cart
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="pcard" style={{ cursor: 'default' }}>
      <Skeleton h={230} r={0} />
      <div className="pbody"><Skeleton h={16} /><Skeleton h={16} w="60%" /><Skeleton h={26} w="45%" /><Skeleton h={34} r={10} /></div>
    </div>
  );
}

export default function Home({ query }) {
  const { config } = useApp();
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState('');

  const q = query.q || '';
  const category = query.category || '';
  const sort = query.sort || 'newest';
  const page = Number(query.page || 1);
  const min = query.min || '';
  const max = query.max || '';
  const [minIn, setMinIn] = useState(min);
  const [maxIn, setMaxIn] = useState(max);
  const filtered = q || category || min || max || page > 1;

  useEffect(() => { api('/products/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    setError('');
    api('/products' + qs({ q, category, sort, page, min, max })).then(setData).catch((e) => setError(e.message));
  }, [q, category, sort, page, min, max]);
  useEffect(() => { setMinIn(min); setMaxIn(max); }, [min, max]);

  const set = (patch) => go('/' + qs({ q, category, sort, min, max, ...patch, page: patch.page || 1 }));

  return (
    <div className="container">
      {!filtered && (
        <>
          <section className="hero">
            <span className="shape s1" /><span className="shape s2" /><span className="shape s3" />
            <span className="bag" aria-hidden="true">🛍️</span>
            <h1>Everything you love, delivered to your door</h1>
            <p>Great prices on electronics, fashion, home and more. Pay online or cash on delivery.</p>
            <a className="btn accent" href="#/?sort=discount">Shop the best deals</a>
          </section>
          <div className="perks">
            <div className="perk"><div className="ic"><Icon name="truck" className="truck" /></div><div><b>Free delivery</b><span>On orders above {inr(config.freeShippingAbove)}</span></div></div>
            <div className="perk"><div className="ic"><Icon name="cash" /></div><div><b>Cash on delivery</b><span>Pay when it arrives</span></div></div>
            <div className="perk"><div className="ic"><Icon name="shield" /></div><div><b>Secure payments</b><span>Cards, UPI and net banking</span></div></div>
            <div className="perk"><div className="ic"><Icon name="box" /></div><div><b>Live order tracking</b><span>Follow every step</span></div></div>
          </div>
        </>
      )}

      <div className="chips">
        <button className={`chipbtn ${!category ? 'on' : ''}`} onClick={() => set({ category: '' })}>All</button>
        {cats.map((c) => (
          <button key={c.category} className={`chipbtn ${category === c.category ? 'on' : ''}`} onClick={() => set({ category: c.category })}>
            {c.category} ({c.count})
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{q ? `Results for "${q}"` : category || 'All products'}</h2>
          {data && <span className="muted small">{data.total} item{data.total === 1 ? '' : 's'}</span>}
        </div>
        <div className="tools">
          <input type="number" placeholder="Min ₹" value={minIn} onChange={(e) => setMinIn(e.target.value)} />
          <input type="number" placeholder="Max ₹" value={maxIn} onChange={(e) => setMaxIn(e.target.value)} />
          <button className="btn sm light" onClick={() => set({ min: minIn, max: maxIn })}>Apply</button>
          <select value={sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="discount">Biggest discount</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="grid">
        {!data && !error && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        {data && data.items.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
      </div>

      {data && data.items.length === 0 && (
        <Empty icon="search" title="No products found">
          Try another word or clear the filters. <a href="#/">Show all products</a>
        </Empty>
      )}

      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn sm light" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Previous</button>
          <span className="muted">Page {data.page} of {data.pages}</span>
          <button className="btn sm light" disabled={page >= data.pages} onClick={() => set({ page: page + 1 })}>Next</button>
        </div>
      )}
    </div>
  );
}
