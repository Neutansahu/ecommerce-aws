import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { go } from './router.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const read = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
};

const MAX_QTY = 10;
const slim = (p) => ({ id: p.id, name: p.name, price: p.price, mrp: p.mrp, image_url: p.image_url, stock: p.stock, category: p.category });

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => read('user', null));
  const [cart, setCart] = useState(() => read('cart', {})); // { [productId]: { qty, product } }
  const [wishlist, setWishlist] = useState([]);              // product ids
  const [toasts, setToasts] = useState([]);
  const [bump, setBump] = useState(0);                        // makes the cart badge pop
  const [config, setConfig] = useState({ freeShippingAbove: 499, shippingFee: 40, codMax: 20000, onlinePayments: false });

  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { api('/config').then(setConfig).catch(() => {}); }, []);

  const toast = useCallback((text, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const logout = useCallback((message) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setWishlist([]);
    if (message) toast(message, 'error');
  }, [toast]);

  const login = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  // every logged-in API call goes through here, so an expired login is handled in one place
  const call = useCallback(async (path, opts = {}) => {
    try {
      return await api(path, { ...opts, token });
    } catch (e) {
      if (e.status === 401 && token) {
        logout('Your session expired. Please log in again.');
        go('/login');
      }
      throw e;
    }
  }, [token, logout]);

  // keep the user (and role) and wishlist fresh
  useEffect(() => {
    if (!token) return;
    api('/auth/me', { token })
      .then((d) => { setUser(d.user); localStorage.setItem('user', JSON.stringify(d.user)); })
      .catch((e) => { if (e.status === 401) logout(); });
    api('/wishlist', { token }).then((d) => setWishlist(d.map((p) => p.id))).catch(() => {});
  }, [token]);

  const addToCart = (product, qty = 1) => {
    if (product.stock < 1) return toast('Sorry, this item is out of stock', 'error');
    setCart((c) => {
      const cur = c[product.id] ? c[product.id].qty : 0;
      return { ...c, [product.id]: { qty: Math.min(cur + qty, MAX_QTY, product.stock), product: slim(product) } };
    });
    setBump((n) => n + 1);
    toast(`Added to cart: ${product.name}`, 'success');
  };
  const setQty = (id, qty) =>
    setCart((c) => {
      if (!c[id]) return c;
      const max = Math.min(MAX_QTY, c[id].product.stock);
      return { ...c, [id]: { ...c[id], qty: Math.max(1, Math.min(qty, max)) } };
    });
  const removeFromCart = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });
  const clearCart = () => setCart({});
  // refresh prices and stock from the server
  const syncCart = (fresh) =>
    setCart((c) => {
      const n = {};
      Object.entries(c).forEach(([id, line]) => {
        const p = fresh.find((x) => x.id === Number(id));
        if (p && p.stock > 0) n[id] = { qty: Math.min(line.qty, p.stock, MAX_QTY), product: slim(p) };
      });
      return n;
    });

  const toggleWish = async (product) => {
    if (!token) {
      toast('Log in to save items to your wishlist', 'info');
      return go('/login?next=' + encodeURIComponent(window.location.hash.replace(/^#/, '') || '/'));
    }
    const has = wishlist.includes(product.id);
    setWishlist((w) => (has ? w.filter((x) => x !== product.id) : [...w, product.id]));
    try {
      await api(`/wishlist/${product.id}`, { method: has ? 'DELETE' : 'PUT', token });
    } catch {
      setWishlist((w) => (has ? [...w, product.id] : w.filter((x) => x !== product.id)));
      toast('Could not update your wishlist', 'error');
    }
  };

  const lines = Object.values(cart);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const cartSubtotal = lines.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);

  return (
    <Ctx.Provider value={{
      token, user, login, logout, call, config,
      cart, lines, cartCount, cartSubtotal, bump, addToCart, setQty, removeFromCart, clearCart, syncCart,
      wishlist, toggleWish, toast, toasts,
    }}>
      {children}
    </Ctx.Provider>
  );
}
