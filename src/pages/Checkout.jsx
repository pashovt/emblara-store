import { useMemo, useState } from 'react';
import { imagesFor } from '../data/products.js';
import { deliveryNote } from '../data/site.js';
import { totalsFor, useCart } from '../store/cart.jsx';
import { gbp, scrollToY } from '../lib/utils.js';
import { ProductImage } from '../components/ui.jsx';

// Demo checkout: validates the form and shows a confirmation, but takes no
// payment and sends nothing. Replace placeOrder() with a real payment flow.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

const empty = { email: '', name: '', company: '', phone: '', line1: '', line2: '', city: '', postcode: '', notes: '' };

function validate(v) {
  const e = {};
  if (!EMAIL.test(v.email.trim())) e.email = 'Enter an email address like name@business.co.uk.';
  if (!v.name.trim()) e.name = 'Enter your full name.';
  if (!v.line1.trim()) e.line1 = 'Enter the first line of the address.';
  if (!v.city.trim()) e.city = 'Enter a town or city.';
  if (!POSTCODE.test(v.postcode.trim())) e.postcode = 'Enter a UK postcode like S72 8JB.';
  return e;
}

async function placeOrder() {
  return { ref: `DEMO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, charged: false };
}

export default function Checkout() {
  const { items, clear } = useCart();
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [artwork, setArtwork] = useState('later');
  const [done, setDone] = useState(null);
  const totals = useMemo(() => totalsFor(items), [items]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`co-${first}`)?.focus();
      return;
    }
    const result = await placeOrder();
    setDone({ ...result, totals, values });
    clear();
    scrollToY(0, true);
  };

  if (done) {
    return (
      <div className="page page--checkout">
        <section className="confirm" role="status">
          <p className="eyebrow">Order {done.ref}</p>
          <h1 className="h2">Demo order <em>prepared</em>.</h1>
          <p className="confirm__note">This is a demo checkout. Nothing has been charged and no order has been sent.</p>
          <p>In the live store, {done.values.name.split(' ')[0] || 'you'} would now receive an email at {done.values.email} with the order reference, followed by a digital proof to approve before production.</p>
          <p className="confirm__total">Order total {gbp(done.totals.total)}</p>
          <a className="pill pill--copper pill--lg" href="#/shop">Back to the shop</a>
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page page--checkout">
        <section className="confirm">
          <h1 className="h2">Your bag is <em>empty</em>.</h1>
          <p>Add some kit, then come back here to check out.</p>
          <a className="pill pill--copper pill--lg" href="#/shop">Browse the range</a>
        </section>
      </div>
    );
  }

  const field = (k, label, props = {}) => (
    <div className={`field${errors[k] ? ' field--error' : ''}`}>
      <label htmlFor={`co-${k}`}>
        {label}
        {props.optional && <span> (optional)</span>}
      </label>
      <input
        id={`co-${k}`}
        value={values[k]}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `co-${k}-err` : undefined}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
      />
      {errors[k] && <p className="field__err" id={`co-${k}-err`}>{errors[k]}</p>}
    </div>
  );

  return (
    <div className="page page--checkout">
      <h1 className="checkout__title">Checkout</h1>
      <div className="demo-banner" role="note">
        Demo checkout — no payment is taken and nothing is sent.
      </div>
      <div className="checkout">
        <form className="checkout__form" onSubmit={onSubmit} noValidate>
          <fieldset className="co-block">
            <legend><span>1</span> Contact</legend>
            {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
            <div className="field-row">
              {field('name', 'Full name', { autoComplete: 'name' })}
              {field('company', 'Business name', { optional: true, autoComplete: 'organization' })}
            </div>
            {field('phone', 'Phone', { optional: true, type: 'tel', autoComplete: 'tel' })}
          </fieldset>

          <fieldset className="co-block">
            <legend><span>2</span> Delivery address</legend>
            {field('line1', 'Address line 1', { autoComplete: 'address-line1' })}
            {field('line2', 'Address line 2', { optional: true, autoComplete: 'address-line2' })}
            <div className="field-row">
              {field('city', 'Town or city', { autoComplete: 'address-level2' })}
              {field('postcode', 'Postcode', { autoComplete: 'postal-code' })}
            </div>
            <p className="co-hint">United Kingdom only in this demo. One delivery address per order.</p>
          </fieldset>

          <fieldset className="co-block">
            <legend><span>3</span> Delivery</legend>
            <div className="radio-card">
              <span className="radio-card__body">
                <strong>Tracked UK delivery</strong>
                <em>{deliveryNote}</em>
              </span>
              <span className="radio-card__price">Included</span>
            </div>
          </fieldset>

          <fieldset className="co-block">
            <legend><span>4</span> Your logo</legend>
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
              <textarea id="co-notes" rows="3" value={values.notes} onChange={set('notes')} placeholder="Thread colours, names under the logo, deadline…" />
            </div>
          </fieldset>

          <fieldset className="co-block co-block--payment">
            <legend><span>5</span> Payment</legend>
            <p className="co-hint">Payments are not connected in this demo. These fields are disabled and nothing is collected.</p>
            <div className="pay-methods" aria-hidden="true">
              <span>Card</span><span>Apple Pay</span><span>Google Pay</span><span>Pay by invoice (business)</span>
            </div>
            <div className="field">
              <label htmlFor="co-card">Card number</label>
              <input id="co-card" disabled placeholder="Disabled in demo" />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="co-exp">Expiry</label>
                <input id="co-exp" disabled placeholder="MM / YY" />
              </div>
              <div className="field">
                <label htmlFor="co-cvc">Security code</label>
                <input id="co-cvc" disabled placeholder="•••" />
              </div>
            </div>
          </fieldset>

          <button type="submit" className="pill pill--copper pill--lg pill--block">
            Place demo order · {gbp(totals.total)}
          </button>
          <p className="co-hint co-hint--center">By placing the order you’d agree to approve a proof before production. Demo: nothing is charged.</p>
        </form>

        <aside className="summary" aria-label="Order summary">
          <h2 className="summary__title">Order summary</h2>
          <ul className="summary__lines">
            {totals.lines.map((l) => (
              <li key={l.id}>
                <div className="summary__img">
                  <ProductImage product={l.product} src={imagesFor(l.product, l.colour)[0]} />
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
