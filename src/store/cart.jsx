import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { bySlug } from '../data/products.js';
import { methodOf, quote } from '../lib/pricing.js';

// Bag state for the demo. Persisted to localStorage so the bag survives a
// refresh; nothing is ever sent anywhere. v2: items carry a decoration method
// and bags saved against the earlier range are dropped.
const KEY = 'emblara-bag-v2';
const CartContext = createContext(null);

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((i) => bySlug[i.slug] && i.method) : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: bag lives in memory only */
    }
  }, [items]);

  const add = useCallback((item) => {
    setItems((list) => {
      const match = list.find(
        (i) => i.slug === item.slug && i.method === item.method && i.colour === item.colour && i.size === item.size && i.position === item.position,
      );
      if (match) return list.map((i) => (i === match ? { ...i, qty: i.qty + item.qty, logoName: item.logoName || i.logoName } : i));
      return [...list, { ...item, id: `${item.slug}-${Date.now().toString(36)}` }];
    });
    setOpen(true);
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((list) => (qty < 1 ? list.filter((i) => i.id !== id) : list.map((i) => (i.id === id ? { ...i, qty } : i))));
  }, []);

  const remove = useCallback((id) => setItems((list) => list.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo(() => totalsFor(items), [items]);

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, open, setOpen, totals }),
    [items, add, setQty, remove, clear, open, totals],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

// The whole bag is one order to one UK address: the price per piece falls as the
// piece count rises, and delivery is charged at the rate of the most expensive
// garment in the bag (see pricing.js). Delivery is inside the price.
export function totalsFor(items) {
  const priced = quote(items.map((i) => ({ ...i, product: bySlug[i.slug] })));
  const lines = items.map((i, n) => {
    const product = bySlug[i.slug];
    const line = priced.lines[n];
    return { ...i, product, methodLabel: methodOf(product, i.method).label, unit: line.unit, total: line.total };
  });
  const count = items.reduce((n, i) => n + i.qty, 0);
  return { lines, subtotal: priced.total, total: priced.total, count, leadSlug: priced.lead };
}
