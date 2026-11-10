import { useEffect } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { go } from '../router.jsx';
import { Icon, inr, ProductImage, Empty } from '../ui.jsx';

export default function CartPage() {
  const { lines, cartSubtotal, config, setQty, removeFromCart, syncCart } = useApp();

  // refresh prices and stock when the cart opens
  useEffect(() => {
    const ids = lines.map((l) => l.product.id);
    if (ids.length) api('/products/by-ids?ids=' + ids.join(',')).then(syncCart).catch(() => {});
  }, []);

  if (!lines.length) {
    return (
      <div className="container">
        <Empty icon="cart" title="Your cart is empty">Add something you like and it will show up here. <a href="#/">Start shopping</a></Empty>
      </div>
    );
  }

  const shipping = cartSubtotal >= config.freeShippingAbove ? 0 : config.shippingFee;
  const left = Math.max(0, config.freeShippingAbove - cartSubtotal);
  const pct = Math.min(100, (cartSubtotal / config.freeShippingAbove) * 100);

  return (
    <div className="container">
      <h1>Shopping cart</h1>
      <div className="two">
        <div>
          {lines.map((l, i) => (
            <div className="line" key={l.product.id} style={{ animationDelay: `${i * 60}ms` }}>
              <a className="thumb" href={`#/product/${l.product.id}`}><ProductImage product={l.product} /></a>
              <div className="info">
                <b>{l.product.name}</b>
                <div className="price"><span className="now" style={{ fontSize: 17 }}>{inr(l.product.price)}</span>{l.product.mrp > l.product.price && <span className="was">{inr(l.product.mrp)}</span>}</div>
                <div className="qty" style={{ marginTop: 8 }}>
                  <button onClick={() => setQty(l.product.id, l.qty - 1)} aria-label="Less"><Icon name="minus" size={14} /></button>
                  <span>{l.qty}</span>
                  <button onClick={() => setQty(l.product.id, l.qty + 1)} aria-label="More"><Icon name="plus" size={14} /></button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>{inr(Number(l.product.price) * l.qty)}</b>
                <div><button className="btn sm light" style={{ marginTop: 8 }} onClick={() => removeFromCart(l.product.id)}><Icon name="trash" size={14} /> Remove</button></div>
              </div>
            </div>
          ))}
        </div>

        <div className="card summary">
          <h3>Order summary</h3>
          {left > 0 ? (
            <p className="small">Add <b>{inr(left)}</b> more for <b className="green-t">free delivery</b></p>
          ) : (
            <p className="small green-t"><b>You get free delivery!</b></p>
          )}
          <div className="progress"><i style={{ width: `${pct}%` }} /></div>
          <div className="sum-row"><span>Subtotal</span><span>{inr(cartSubtotal)}</span></div>
          <div className="sum-row"><span>Delivery</span><span className={shipping === 0 ? 'green-t' : ''}>{shipping === 0 ? 'FREE' : inr(shipping)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{inr(cartSubtotal + shipping)}</span></div>
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => go('/checkout')}>Proceed to checkout</button>
          <p className="muted small" style={{ marginTop: 10 }}>Coupons can be applied at checkout.</p>
        </div>
      </div>
    </div>
  );
}
