import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function App() {
  const [view, setView] = useState('products'); // products | cart | login | orders
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // { productId: quantity }
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/products').then(setProducts).catch((e) => setMsg(e.message));
  }, []);

  const addToCart = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id) =>
    setCart((c) => {
      const n = { ...c };
      delete n[id];
      return n;
    });

  const cartItems = Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((p) => p.id === Number(id)),
    quantity,
  })).filter((i) => i.product);
  const total = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  const logout = () => {
    localStorage.clear();
    setToken('');
    setUser(null);
    setView('products');
  };

  const placeOrder = async () => {
    if (!token) return setView('login');
    try {
      const items = cartItems.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
      const r = await api('/orders', { method: 'POST', token, body: { items } });
      setMsg(`Order #${r.order_id} placed. Total: ₹${r.total}`);
      setCart({});
      api('/products').then(setProducts);
      setView('orders');
      loadOrders();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const loadOrders = () =>
    api('/orders', { token }).then(setOrders).catch((e) => setMsg(e.message));

  return (
    <div>
      <header>
        <h1 onClick={() => setView('products')}>Shop</h1>
        <nav>
          <button onClick={() => setView('products')}>Products</button>
          <button onClick={() => setView('cart')}>Cart ({count})</button>
          {user ? (
            <>
              <button onClick={() => { setView('orders'); loadOrders(); }}>Orders</button>
              <button onClick={logout}>Logout ({user.name})</button>
            </>
          ) : (
            <button onClick={() => setView('login')}>Login</button>
          )}
        </nav>
      </header>

      {msg && <p className="msg" onClick={() => setMsg('')}>{msg} (click to dismiss)</p>}

      <main>
        {view === 'products' && (
          <div className="grid">
            {products.map((p) => (
              <div className="card" key={p.id}>
                {p.image_url && <img src={p.image_url} alt={p.name} />}
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <p><b>₹{p.price}</b> · Stock: {p.stock}</p>
                <button disabled={p.stock < 1} onClick={() => addToCart(p.id)}>
                  {p.stock < 1 ? 'Out of stock' : 'Add to cart'}
                </button>
              </div>
            ))}
          </div>
        )}

        {view === 'cart' && (
          <div>
            <h2>Your cart</h2>
            {cartItems.length === 0 && <p>Cart is empty.</p>}
            {cartItems.map((i) => (
              <div className="row" key={i.product.id}>
                <span>{i.product.name} × {i.quantity}</span>
                <span>₹{(i.product.price * i.quantity).toFixed(2)}</span>
                <button onClick={() => removeFromCart(i.product.id)}>Remove</button>
              </div>
            ))}
            {cartItems.length > 0 && (
              <>
                <h3>Total: ₹{total.toFixed(2)}</h3>
                <button onClick={placeOrder}>Place order</button>
              </>
            )}
          </div>
        )}

        {view === 'login' && (
          <AuthForm
            onDone={(data) => {
              localStorage.setItem('token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              setToken(data.token);
              setUser(data.user);
              setView('products');
            }}
            onMsg={setMsg}
          />
        )}

        {view === 'orders' && (
          <div>
            <h2>My orders</h2>
            {orders.length === 0 && <p>No orders yet.</p>}
            {orders.map((o) => (
              <div className="row" key={o.id}>
                <span>Order #{o.id}</span>
                <span>₹{o.total}</span>
                <span>{o.status}</span>
                <span>{new Date(o.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AuthForm({ onDone, onMsg }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    try {
      if (mode === 'register') {
        await api('/auth/register', { method: 'POST', body: form });
        onMsg('Registered. Please log in.');
        setMode('login');
      } else {
        const data = await api('/auth/login', {
          method: 'POST',
          body: { email: form.email, password: form.password },
        });
        onDone(data);
      }
    } catch (e) {
      onMsg(e.message);
    }
  };

  return (
    <div className="form">
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      {mode === 'register' && <input placeholder="Name" value={form.name} onChange={set('name')} />}
      <input placeholder="Email" value={form.email} onChange={set('email')} />
      <input placeholder="Password" type="password" value={form.password} onChange={set('password')} />
      <button onClick={submit}>{mode === 'login' ? 'Login' : 'Create account'}</button>
      <p className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New user? Register' : 'Have an account? Login'}
      </p>
    </div>
  );
}