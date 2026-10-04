import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { bySlug } from '../data/products.js';
import { delivery, freeDeliveryOver } from '../data/site.js';
import { tierFor, unitPrice } from '../lib/utils.js';

// Bag state for the demo. Persisted to localStorage so the bag survives a
// refresh; nothing is ever sent anywhere.
const KEY = 'emblara-bag';
const CartContext = createContext(null);

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((i) => bySlug[i.slug]) : [];
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
        (i) => i.slug === item.slug && i.colour === item.colour && i.size === item.size && i.position === item.position && i.style === item.style,
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

// Quantity discounts apply per product across all its sizes and colours,
// so a team mixing sizes still reaches the tier.
export function totalsFor(items, deliveryId = 'standard') {
  const perProduct = {};
  items.forEach((i) => {
    perProduct[i.slug] = (perProduct[i.slug] ?? 0) + i.qty;
  });

  let gross = 0;
  let savings = 0;
  const lines = items.map((i) => {
    const product = bySlug[i.slug];
    const unit = unitPrice(product, i);
    const tier = tierFor(perProduct[i.slug]);
    const lineGross = unit * i.qty;
    const lineSaving = lineGross * tier.off;
    gross += lineGross;
    savings += lineSaving;
    return { ...i, product, unit, tier, total: lineGross - lineSaving };
  });

  const subtotal = gross - savings;
  const option = delivery.find((d) => d.id === deliveryId) ?? delivery[0];
  const shipping = items.length === 0 ? 0 : subtotal >= freeDeliveryOver && option.id === 'standard' ? 0 : option.price;
  const count = items.reduce((n, i) => n + i.qty, 0);
  return { lines, gross, savings, subtotal, shipping, total: subtotal + shipping, count };
}
