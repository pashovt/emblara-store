import { useMemo, useState } from 'react';
import { bySlug } from '../data/products.js';
import { leadView } from '../data/placements.js';
import { deliveryNote } from '../data/site.js';
import { totalsFor, useCart } from '../store/cart.jsx';
import { gbp } from '../lib/utils.js';
import { ProductImage } from '../components/ui.jsx';

// Checkout. The bag is sent to /api/checkout as product ids, options and
// quantities ONLY. The server prices it from the stored product data, saves a
// pending order, and returns a Stripe Checkout URL for exactly that amount.
// Stripe collects the delivery address and takes payment; the order becomes
// "paid" only when Stripe's signed webhook reaches the server.

export default function Checkout() {
  const { items, dropProducts, notice, dismissNotice } = useCart();
  const [artwork, setArtwork] = useState('later');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const totals = useMemo(() => totalsFor(items), [items]);

  const onPay = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: bySlug[i.slug].id, method: i.method, colour: i.colour, size: i.size, position: i.position, qty: i.qty, logoName: i.logoName })),
          artwork,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.productIds?.length) {
        // Stale bag: the merchant made something unavailable after it was added.
        dropProducts(data.productIds);
        setBusy(false);
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error || 'Checkout is not available right now. Please try again.');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page page--checkout">
        <section className="confirm">
          {notice && (
            <p className="drawer__alert" role="status">
              {notice} <button type="button" className="link-button" onClick={dismissNotice}>Dismiss</button>
            </p>
          )}
          <h1 className="h2">Your bag is <em>empty</em>.</h1>
          <p>Add some kit, then come back here to check out.</p>
          <a className="pill pill--copper pill--lg" href="#/shop">Browse the range</a>
        </section>
      </div>
    );
  }

  return (
    <div className="page page--checkout">
      <h1 className="checkout__title">Checkout</h1>
      {notice && (
        <p className="drawer__alert" role="status">
          {notice} <button type="button" className="link-button" onClick={dismissNotice}>Dismiss</button>
        </p>
      )}
      <div className="checkout">
        <form className="checkout__form" onSubmit={onPay} noValidate>
          <fieldset className="co-block">
            <legend><span>1</span> Delivery and payment</legend>
            <p className="co-hint">You enter your email, delivery address and card on the next page, which is hosted by Stripe. United Kingdom delivery only. One address per order.</p>
            <div className="radio-card">
              <span className="radio-card__body">
                <strong>Tracked UK delivery</strong>
                <em>{deliveryNote}</em>
              </span>
              <span className="radio-card__price">Included</span>
            </div>
          </fieldset>

          <fieldset className="co-block">
            <legend><span>2</span> Your logo</legend>
            <label className="radio-card">
              <input type="radio" name="artwork" value="later" checked={artwork === 'later'} onChange={() => setArtwork('later')} />
              <span className="radio-card__body"><strong>I’ll send it after ordering</strong><em>We email you a secure upload link with your order confirmation.</em></span>
            </label>
            <label className="radio-card">
              <input type="radio" name="artwork" value="attached" checked={artwork === 'attached'} onChange={() => setArtwork('attached')} />
              <span className="radio-card__body"><strong>Already added on the product page</strong><em>We’ll use the file you chose there.</em></span>
            </label>
            <div className="field">
              <label htmlFor="co-notes">Notes for the proof <span>(optional)</span></label>
              <textarea id="co-notes" rows="3" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thread colours, names under the logo, deadline…" />
            </div>
          </fieldset>

          {error && <p className="field__err co-error" role="alert">{error}</p>}
          <button type="submit" className="pill pill--copper pill--lg pill--block" disabled={busy}>
            {busy ? 'Taking you to Stripe…' : `Pay securely · ${gbp(totals.total)}`}
          </button>
          <p className="co-hint co-hint--center">The final amount is calculated again on our server when you pay. By paying you agree to approve a proof before production.</p>
        </form>

        <aside className="summary" aria-label="Order summary">
          <h2 className="summary__title">Order summary</h2>
          <ul className="summary__lines">
            {totals.lines.map((l) => (
              <li key={l.id}>
                <div className="summary__img">
                  <ProductImage product={l.product} colour={l.colour} position={l.position} view={leadView(l.position ?? '')} />
                  <span className="summary__qty">{l.qty}</span>
                </div>
                <div>
                  <p className="summary__name">{l.product.name}</p>
                  <p className="summary__meta">{[l.methodLabel, l.colour, l.size, l.position].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="summary__price">{gbp(l.total)}</span>
              </li>
            ))}
          </ul>
          <div className="summary__rows">
            <p className="sum-row"><span>Items</span><span>{gbp(totals.subtotal)}</span></p>
            <p className="sum-row"><span>Delivery</span><span>Included</span></p>
            <p className="sum-row sum-row--big"><span>Total</span><span>{gbp(totals.total)}</span></p>
            <p className="co-hint">Emblara is not VAT registered, so no VAT is added.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
