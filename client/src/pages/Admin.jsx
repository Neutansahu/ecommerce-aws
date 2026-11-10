import { useApp } from '../store.jsx';
import { Icon, Empty } from '../ui.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdminProducts from './admin/AdminProducts.jsx';
import AdminOrders from './admin/AdminOrders.jsx';
import AdminCoupons from './admin/AdminCoupons.jsx';

const NAV = [
  ['dashboard', 'Dashboard', 'grid', '/admin'],
  ['products', 'Products', 'tag', '/admin/products'],
  ['orders', 'Orders', 'box', '/admin/orders'],
  ['coupons', 'Coupons', 'cash', '/admin/coupons'],
];

export default function Admin({ section }) {
  const { user } = useApp();
  if (!user) return <div className="container"><Empty icon="lock" title="Admin only"><a href="#/login?next=%2Fadmin">Log in</a> with an admin account.</Empty></div>;
  if (user.role !== 'admin') return <div className="container"><Empty icon="lock" title="Admins only">This account is not an admin.</Empty></div>;

  const page = { dashboard: <AdminDashboard />, products: <AdminProducts />, orders: <AdminOrders />, coupons: <AdminCoupons /> }[section] || <AdminDashboard />;
  return (
    <div className="container">
      <div className="admin">
        <nav className="sidebar">
          {NAV.map(([key, label, icon, to]) => (
            <a key={key} href={`#${to}`} className={section === key ? 'on' : ''}><Icon name={icon} size={18} /> {label}</a>
          ))}
        </nav>
        <div key={section} style={{ animation: 'fadeUp 0.4s ease both', minWidth: 0 }}>{page}</div>
      </div>
    </div>
  );
}
