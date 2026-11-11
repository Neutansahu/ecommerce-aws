import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { Empty, Skeleton } from '../ui.jsx';
import { ProductCard } from './Home.jsx';

export default function WishlistPage() {
  const { user, call, wishlist } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => { if (user) call('/wishlist').then(setItems).catch(() => setItems([])); }, [user && user.id]);

  if (!user) return <div className="container"><Empty icon="heart" title="Log in to see your wishlist"><a href="#/login?next=%2Fwishlist">Log in</a></Empty></div>;
  if (!items) return <div className="container"><Skeleton h={240} r={16} /></div>;
  const shown = items.filter((p) => wishlist.includes(p.id)); // hearts you remove disappear at once
  if (!shown.length) return <div className="container"><Empty icon="heart" title="Your wishlist is empty">Tap the heart on any product to save it. <a href="#/">Browse products</a></Empty></div>;

  return (
    <div className="container">
      <h1>My wishlist</h1>
      <div className="grid">{shown.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</div>
    </div>
  );
}
