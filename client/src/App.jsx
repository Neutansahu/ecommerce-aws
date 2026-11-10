import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './store.jsx';
import { useRoute, go, qs } from './router.jsx';
import { Icon, Empty } from './ui.jsx';
import Home from './pages/Home.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage, { OrderSuccess } from './pages/CheckoutPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import { LoginPage, RegisterPage, ForgotPage, ResetPage } from './pages/AuthPages.jsx';
import Admin from './pages/Admin.jsx';

function Header({ query }) {
  const { user, logout, cartCount, bump, wishlist } = useApp();
  const [text, setText] = useState(query.q || '');
  useEffect(() => { setText(query.q || ''); }, [query.q]);
  const submit = (e) => { e.preventDefault(); go('/' + qs({ q: text.trim() })); };

  return (
    <>
      <div className="promo">Free delivery on orders above ₹499 · Cash on delivery available · Use code WELCOME10 on your first order</div>
      <header className="header">
        <div className="header-in">
          <a className="logo" href="#/"><span className="logo-mark"><Icon name="cart" size={20} /></span>ShopNest</a>
          <form className="search" onSubmit={submit}>
            <Icon name="search" size={18} />
            <input placeholder="Search for products, brands and more" value={text} onChange={(e) => setText(e.target.value)} />
          </form>
          <nav className="nav">
            <a href="#/wishlist"><Icon name="heart" /><span className="lbl">Wishlist</span>{wishlist.length > 0 && <span className="badge">{wishlist.length}</span>}</a>
            <a href="#/cart"><Icon name="cart" /><span className="lbl">Cart</span>{cartCount > 0 && <span key={bump} className={`badge ${bump ? 'bump' : ''}`}>{cartCount}</span>}</a>
            {user && <a href="#/orders"><Icon name="box" /><span className="lbl">Orders</span></a>}
            {user && user.role === 'admin' && <a href="#/admin"><Icon name="grid" /><span className="lbl">Admin</span></a>}
            {user ? (
              <button className="navbtn" onClick={() => { logout(); go('/'); }}><Icon name="user" /><span className="lbl">Logout ({user.name.split(' ')[0]})</span></button>
            ) : (
              <a href="#/login"><Icon name="user" /><span className="lbl">Login</span></a>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div><b>ShopNest</b><br />A multi-tier e-commerce demo running on AWS.</div>
        <div><b>Shop</b><br /><a href="#/">All products</a><br /><a href="#/wishlist">Wishlist</a><br /><a href="#/orders">My orders</a></div>
        <div><b>Pay your way</b><br />Cards, UPI, net banking<br />Cash on delivery</div>
      </div>
    </footer>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.text}</div>)}</div>;
}

function pick(path, query) {
  if (path === '/') return <Home query={query} />;
  if (path.startsWith('/product/')) return <ProductPage id={path.split('/')[2]} />;
  if (path === '/cart') return <CartPage />;
  if (path === '/checkout') return <CheckoutPage />;
  if (path.startsWith('/order-success/')) return <OrderSuccess id={path.split('/')[2]} method={query.m} />;
  if (path === '/orders') return <OrdersPage />;
  if (path === '/wishlist') return <WishlistPage />;
  if (path === '/login') return <LoginPage next={query.next} />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot') return <ForgotPage />;
  if (path === '/reset') return <ResetPage token={query.token} />;
  if (path.startsWith('/admin')) return <Admin section={path.split('/')[2] || 'dashboard'} />;
  return <div className="container"><Empty icon="search" title="Page not found"><a href="#/">Back to the shop</a></Empty></div>;
}

function Shell() {
  const { path, query } = useRoute();
  return (
    <>
      <Header query={query} />
      <main className="page" key={path}>{pick(path, query)}</main>
      <Footer />
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
