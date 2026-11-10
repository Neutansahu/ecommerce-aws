import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { go } from '../router.jsx';
import { Icon, inr, ProductImage, RatingChip, Stars, Skeleton, Empty } from '../ui.jsx';

export default function ProductPage({ id }) {
  const { addToCart, toggleWish, wishlist, call, user, toast, config } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = () => api(`/products/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { setData(null); setError(''); setQty(1); load(); }, [id]);

  if (error) {
    return (
      <div className="container"><Empty icon="alert" title="Product not found">This product is no longer available. <a href="#/">Back to shop</a></Empty></div>
    );
  }
  if (!data) {
    return (
      <div className="container pdp">
        <Skeleton h={420} r={20} />
        <div style={{ display: 'grid', gap: 12 }}><Skeleton h={30} w="70%" /><Skeleton h={20} w="30%" /><Skeleton h={44} w="40%" /><Skeleton h={90} /></div>
      </div>
    );
  }

  const p = data.product;
  const liked = wishlist.includes(p.id);
  const maxQty = Math.min(10, p.stock);

  const submitReview = async () => {
    try {
      await call(`/products/${id}/reviews`, { method: 'POST', body: { rating, comment } });
      toast('Thanks for your review!', 'success');
      setComment('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="container">
      <p className="muted small"><a href="#/">Home</a> / <a href={`#/?category=${encodeURIComponent(p.category)}`}>{p.category}</a> / {p.name}</p>
      <div className="pdp">
        <div className="bigimg"><ProductImage product={p} /></div>
        <div>
          <h1>{p.name}</h1>
          <div style={{ margin: '6px 0 12px' }}><RatingChip rating={p.rating} count={p.review_count} /></div>
          <div className="price">
            <span className="now">{inr(p.price)}</span>
            {p.discount_pct > 0 && <><span className="was">{inr(p.mrp)}</span><span className="pct">{p.discount_pct}% off</span></>}
          </div>
          <p className="muted small">Inclusive of all taxes</p>
          <div className="deliv"><Icon name="truck" /> {p.stock < 1 ? 'Currently unavailable' : `Free delivery on orders above ${inr(config.freeShippingAbove)} · Cash on delivery available`}</div>
          <p style={{ whiteSpace: 'pre-line' }}>{p.description}</p>
          {p.stock >= 1 && p.stock <= 5 && <p className="low">Hurry, only {p.stock} left!</p>}

          {p.stock >= 1 ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
              <div className="qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less"><Icon name="minus" size={16} /></button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="More"><Icon name="plus" size={16} /></button>
              </div>
              <button className="btn" onClick={() => addToCart(p, qty)}><Icon name="cart" size={18} /> Add to cart</button>
              <button className="btn accent" onClick={() => { addToCart(p, qty); go('/checkout'); }}>Buy now</button>
              <button className={`btn light`} onClick={() => toggleWish(p)}>
                <Icon name="heart" size={18} className={liked ? 'liked-icon' : ''} /> {liked ? 'Saved' : 'Save'}
              </button>
            </div>
          ) : (
            <p className="out" style={{ fontSize: 16 }}>Out of stock</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <h2>Ratings and reviews</h2>
        {data.reviews.length === 0 && <p className="muted">No reviews yet. Be the first after your order is delivered.</p>}
        {data.reviews.map((r) => (
          <div className="review" key={r.id}>
            <Stars value={r.rating} /> <b style={{ marginLeft: 8 }}>{r.name}</b>
            <span className="muted small" style={{ marginLeft: 8 }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
            {r.comment && <p style={{ margin: '6px 0 0' }}>{r.comment}</p>}
          </div>
        ))}
        {user ? (
          <div className="review">
            <h3>Write a review</h3>
            <div className="starpick">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                  <svg width="28" height="28" viewBox="0 0 24 24" className={i <= rating ? 'on' : ''}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>
            <textarea rows="3" placeholder="Share your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ margin: '10px 0' }} />
            <button className="btn sm" onClick={submitReview}>Submit review</button>
            <p className="muted small" style={{ marginTop: 8 }}>You can review a product after your order for it is delivered.</p>
          </div>
        ) : (
          <p className="muted"><a href={`#/login?next=${encodeURIComponent('/product/' + id)}`}>Log in</a> to write a review.</p>
        )}
      </div>
    </div>
  );
}
