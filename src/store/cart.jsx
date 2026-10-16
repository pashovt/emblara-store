import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { bySlug } from '../data/products.js';
import { methodOf, quote } from '../lib/pricing.js';

// Bag state. It lives in this browser only (React state, mirrored to localStorage so a
// refresh keeps it). It is temporary interface state and NOT the price authority: the
// subtotal below is a convenience, and what anyone pays is recalculated on the server at
// checkout from the stored product data, which also rejects products that are no longer
// public or available.
//
// Products the merchant has since unpublished or marked unavailable are not in the loaded
// catalogue; they are removed from a stale bag and the customer is told which.
const KEY = 'emblara-bag-v2';
const MAX_QTY = 999; // a sanity cap only; the store has no stock quantities
const CartContext = createContext(null);

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return { items: [], gone: [] };
    const valid = raw.filter((i) => i && i.method);
    return {
      items: valid.filter((i) => bySlug[i.slug]),
      gone: [...new Set(valid.filter((i) => !bySlug[i.slug]).map((i) => i.name || 'An item'))],
    };
  } catch {
    return { items: [], gone: [] };
  }
};

const goneNotice = (names) =>
  names.length ? `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} no longer available and ${names.length > 1 ? 'were' : 'was'} removed from your bag.` : '';

export function CartProvider({ children }) {
  const [initial] = useState(load);
  const [items, setItems] = useState(initial.items);
  const [notice, setNotice] = useState(() => goneNotice(initial.gone));
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
      if (match) return list.map((i) => (i === match ? { ...i, qty: Math.min(MAX_QTY, i.qty + item.qty), logoName: item.logoName || i.logoName } : i));
      return [...list, { ...item, name: bySlug[item.slug]?.name, id: `${item.slug}-${Date.now().toString(36)}` }];
    });
    setOpen(true);
  }, []);

  const setQty = useCallback((id, qty) => {
    const n = Math.min(MAX_QTY, Math.floor(Number(qty)));
    setItems((list) => (!(n >= 1) ? list.filter((i) => i.id !== id) : list.map((i) => (i.id === id ? { ...i, qty: n } : i))));
  }, []);

  const remove = useCallback((id) => setItems((list) => list.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  // The server said these products can no longer be bought (ids from /api/checkout).
  const dropProducts = useCallback((productIds) => {
    const ids = new Set(productIds);
    let names = [];
    setItems((list) => {
      names = [...new Set(list.filter((i) => ids.has(bySlug[i.slug]?.id)).map((i) => bySlug[i.slug].name))];
      return list.filter((i) => !ids.has(bySlug[i.slug]?.id));
    });
    setNotice(goneNotice(names.length ? names : ['An item']));
  }, []);

  const totals = useMemo(() => totalsFor(items), [items]);

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, dropProducts, notice, dismissNotice: () => setNotice(''), open, setOpen, totals }),
    [items, add, setQty, remove, clear, dropProducts, notice, open, totals],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

// The whole bag is one order to one UK address: the price per piece falls as the
// piece count rises, and delivery is charged at the rate of the most expensive
// garment in the bag (see pricing.js). Delivery is inside the price.
// Services (logo clean-up) have a fixed price and no delivery.
export function totalsFor(items) {
  const garments = items.filter((i) => !bySlug[i.slug].service);
  const priced = quote(garments.map((i) => ({ ...i, product: bySlug[i.slug] })));
  const lines = items.map((i) => {
    const product = bySlug[i.slug];
    if (product.service) return { ...i, product, methodLabel: product.method, unit: product.price, total: product.price * i.qty };
    const line = priced.lines[garments.indexOf(i)];
    return { ...i, product, methodLabel: methodOf(product, i.method).label, unit: line.unit, total: line.total };
  });
  const total = lines.reduce((sum, l) => sum + l.total, 0);
  const count = items.reduce((n, i) => n + i.qty, 0);
  return { lines, subtotal: total, total, count, leadSlug: priced.lead };
}
