import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, METHOD_IDS, fromRow } from '../lib/catalogue.js';
import { unitPrice } from '../lib/pricing.js';
import { gbp } from '../lib/utils.js';
import { api, useLoad } from '../admin/api.js';
import Navigation from '../admin/Navigation.jsx';
import ComingSoon from '../admin/ComingSoon.jsx';

// Store Dashboard. Everything the merchant does to products and orders goes
// through /api/admin/*, which re-checks the signed session cookie on every call.

const STATUS = { paid: 'Paid', processing: 'Processing', fulfilled: 'Fulfilled' };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const pounds = (pence) => gbp(pence / 100);

// ------------------------------------------------------------------ shell
export default function Admin({ route }) {
  const [email, setEmail] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    document.title = 'Store Dashboard — EMBLARA';
    api('me').then((d) => setEmail(d.email), (err) => setEmail(err.status === 403 ? 'denied' : null));
  }, []);

  const onSignOut = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setEmail(null);
  };

  if (email === undefined) return <div className="adm"><p className="adm__muted">Checking your session…</p></div>;
  if (!email) return <Login onDone={setEmail} />;
  if (email === 'denied') return <NoAccess onSignOut={onSignOut} />;

  const section = ['orders', 'sales', 'support', 'catalogue', 'products', 'settings'].includes(route.param) ? route.param : 'orders';
  return (
    <div className="adm">
      <header className="adm__bar">
        <strong className="adm__brand">Store Dashboard</strong>
        <Navigation section={section} />
        <a className="adm__shop" href="#/shop">View shop</a>
        <span className="adm__who">{email} · <button type="button" className="link-button" onClick={onSignOut}>Sign out</button></span>
      </header>
      <div className="adm__body">
        {section === 'orders' && (route.sub ? <OrderDetail id={route.sub} /> : <Orders />)}
        {section === 'products' && (route.sub ? <ProductForm id={route.sub} /> : <Products />)}
        {['sales', 'support', 'catalogue', 'settings'].includes(section) && <ComingSoon section={section[0].toUpperCase() + section.slice(1)} />}
      </div>
    </div>
  );
}

function NoAccess({ onSignOut }) {
  return (
    <div className="adm adm--login">
      <div className="adm__card adm__login" role="alert">
        <h1 className="adm__h1">No access</h1>
        <p className="adm__muted">This account is not store staff, or its access has been turned off. Ask the shop owner to restore it.</p>
        <button type="button" className="pill pill--copper pill--block" onClick={onSignOut}>Sign out</button>
        <a href="#/shop">Back to the shop</a>
      </div>
    </div>
  );
}

function Login({ onDone }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sign-in failed.');
      onDone(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm adm--login">
      <form className="adm__card adm__login" onSubmit={submit}>
        <h1 className="adm__h1">Store Dashboard</h1>
        <p className="adm__muted">Staff sign-in. Customers do not need an account to order.</p>
        <label>Email<input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="adm__error" role="alert">{error}</p>}
        <button className="pill pill--copper pill--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------- orders
// Payment and fulfilment are separate states. "Paid" here means paid and not yet started.
const PAYMENT = { paid: 'Paid', pending: 'Not paid', expired: 'Expired' };
const FULFIL_LABEL = { paid: 'Waiting to start', processing: 'Processing', fulfilled: 'Fulfilled' };

function Orders() {
  const [filter, setFilter] = useState('');
  const [state] = useLoad(`orders${filter ? `?status=${filter}` : ''}`, [filter]);
  const orders = state.data?.orders ?? [];
  const waiting = state.data?.counts?.paid ?? 0;
  const inProgress = state.data?.counts?.processing ?? 0;
  return (
    <section>
      <h1 className="adm__h1">Orders</h1>
      {!filter && !state.loading && (
        <p className={`adm__attn${waiting ? ' adm__attn--on' : ''}`} role="status">
          {waiting ? <><strong>{waiting}</strong> paid {waiting === 1 ? 'order is' : 'orders are'} waiting to be started</> : 'Nothing is waiting to be started'}
          {inProgress > 0 && <> · <strong>{inProgress}</strong> in progress</>}
        </p>
      )}
      <div className="adm__tabs" role="group" aria-label="Filter by status">
        {[['', 'All'], ['paid', 'Paid'], ['processing', 'Processing'], ['fulfilled', 'Fulfilled']].map(([v, label]) => (
          <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}>{label}</button>
        ))}
      </div>
      {state.error && <p className="adm__error">{state.error}</p>}
      {!state.loading && !orders.length && <p className="adm__muted">No orders here yet. An order appears once Stripe confirms its payment.</p>}
      {orders.length > 0 && (
        <div className="adm__scroll">
          <table className="adm__table adm__table--cards">
            <thead><tr><th>Order</th><th>Paid</th><th>Customer</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={o.status === 'paid' ? 'is-attention' : undefined}>
                  <td data-label="Order"><a href={`#/admin/orders/${o.id}`}><strong>{o.number}</strong></a></td>
                  <td data-label="Paid">{when(o.paid_at)}</td>
                  <td data-label="Customer">{o.customer_name}<small>{o.email}</small></td>
                  <td data-label="Delivery">{o.fulfilment_method}<small>{o.city}</small></td>
                  <td data-label="Total">{pounds(o.amount_total_pence)}</td>
                  <td data-label="Status"><span className={`adm__badge adm__badge--${o.status}`}>{STATUS[o.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrderDetail({ id }) {
  const [state, reload] = useLoad(`orders?id=${encodeURIComponent(id)}`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { order, items = [] } = state.data ?? {};
  const next = { paid: ['processing', 'Start processing'], processing: ['fulfilled', 'Mark as fulfilled'] }[order?.status];

  const advance = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`orders/status?id=${encodeURIComponent(id)}`, { method: 'POST', body: { status: next[0] } });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (state.error) return <p className="adm__error">{state.error} <a href="#/admin/orders">Back to orders</a></p>;
  if (!order) return <p className="adm__muted">Loading…</p>;
  const ship = order.shipping;
  const steps = ['paid', 'processing', 'fulfilled'];
  return (
    <section>
      <p><a href="#/admin/orders">← All orders</a></p>
      <h1 className="adm__h1">Order {order.number}</h1>
      <div className="adm__states" aria-label="Order status">
        <p><span>Payment</span><strong className="adm__badge adm__badge--fulfilled">{PAYMENT[order.payment_status]}</strong><small>{when(order.paid_at)}</small></p>
        <p><span>Fulfilment</span><strong className={`adm__badge adm__badge--${order.status}`}>{FULFIL_LABEL[order.status]}</strong></p>
      </div>
      <ol className="adm__steps" aria-label="Fulfilment progress">
        {steps.map((st, i) => (
          <li key={st} className={steps.indexOf(order.status) >= i ? 'is-done' : undefined} aria-current={order.status === st ? 'step' : undefined}>{STATUS[st]}</li>
        ))}
      </ol>
      <div className="adm__cols">
        <div className="adm__card">
          <h2>Customer</h2>
          <p>{order.customer_name}<br />{order.email}<br />{order.phone}</p>
          <h2>{order.fulfilment_method}</h2>
          {ship ? (
            <address>
              {ship.name}<br />{ship.line1}<br />{ship.line2 && <>{ship.line2}<br /></>}{ship.city}{ship.county && `, ${ship.county}`}<br />{ship.postcode}<br />{ship.country}
            </address>
          ) : <p className="adm__muted">No address recorded.</p>}
          <h2>Artwork</h2>
          <p>{order.artwork === 'attached' ? 'The customer chose a logo on the product page (see the item lines).' : 'The customer will send their logo after ordering.'}</p>
          {order.notes && <><h2>Notes for the proof</h2><p>{order.notes}</p></>}
        </div>
        <div className="adm__card">
          <h2>Items</h2>
          <table className="adm__table adm__table--plain">
            <thead><tr><th>Item</th><th>Qty</th><th>Each</th><th>Line</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.product_name}<small>{[i.options?.method, i.options?.colour, i.options?.size, i.options?.position].filter(Boolean).join(' · ')}{i.options?.logoName && ` · Logo: ${i.options.logoName}`}</small></td>
                  <td>{i.quantity}</td>
                  <td>{pounds(i.unit_amount_pence)}</td>
                  <td>{pounds(i.line_amount_pence)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="3">Total paid</td><td><strong>{pounds(order.amount_total_pence)}</strong></td></tr></tfoot>
          </table>
          <p className="adm__muted">Prices are the ones captured at purchase. Editing a product later never changes this order. “Each” is the line total divided by the quantity, rounded to the penny.</p>
          {error && <p className="adm__error" role="alert">{error}</p>}
          {next ? (
            <button type="button" className="pill pill--copper pill--block" disabled={busy} onClick={advance}>{next[1]}</button>
          ) : <p><strong>Fulfilled.</strong> Nothing more to do.</p>}
          {order.payment_reference && (
            <details className="adm__ref"><summary>Payment reference</summary><p className="adm__muted">For finding this payment in Stripe: <code>{order.payment_reference}</code></p></details>
          )}
        </div>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- products
const rowToInput = (r, patch = {}) => ({
  kind: r.kind, slug: r.slug, name: r.name, category: r.category, blurb: r.blurb, material: r.material ?? '', fabric: r.fabric ?? '',
  price: r.price_pence == null ? undefined : r.price_pence / 100, specs: r.config?.specs ?? [], ship: r.config?.ship, colours: r.config?.colours, methods: r.config?.methods,
  images: r.images ?? [], published: r.published, available: r.available, sort: r.sort, ...patch,
});

function Products() {
  const [state, reload] = useLoad('products');
  const [error, setError] = useState('');
  const toggle = async (row, patch) => {
    setError('');
    try {
      await api(`products?id=${row.id}`, { method: 'PUT', body: rowToInput(row, patch) });
      reload();
    } catch (err) {
      setError(`${row.name}: ${err.message}`);
    }
  };
  const rows = state.data?.products ?? [];
  return (
    <section>
      <div className="adm__head">
        <h1 className="adm__h1">Products</h1>
        <a className="pill pill--copper" href="#/admin/products/new">New product</a>
      </div>
      <p className="adm__muted">“Published” puts a product in the shop. “Available” lets customers add it to the bag; switch it off when you cannot supply it.</p>
      {(error || state.error) && <p className="adm__error" role="alert">{error || state.error}</p>}
      <div className="adm__scroll">
        <table className="adm__table adm__table--cards">
          <thead><tr><th>Product</th><th>Finish</th><th>From</th><th>Published</th><th>Available</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = fromRow(r);
              const from = p.service ? p.price : Math.min(...p.methods.map((m) => unitPrice(p, { method: m.id, qty: 1 })));
              return (
                <tr key={r.id}>
                  <td data-label="Product"><strong>{r.name}</strong><small>/{r.slug} · {r.category}</small></td>
                  <td data-label="Finish">{p.service ? 'Service' : p.methods.map((m) => m.label).join(' or ')}</td>
                  <td data-label="From">{gbp(from)}</td>
                  <td data-label="Published"><Switch on={r.published} label={`Published: ${r.name}`} onChange={(v) => toggle(r, { published: v })} /></td>
                  <td data-label="Available"><Switch on={r.available} label={`Available: ${r.name}`} onChange={(v) => toggle(r, { available: v })} /></td>
                  <td data-label=""><a className="pill pill--ghost-dark adm__edit" href={`#/admin/products/${r.id}`}>Edit</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Switch({ on, label, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="adm__switch" onClick={() => onChange(!on)}>
      <span>{on ? 'Yes' : 'No'}</span>
    </button>
  );
}

// "Navy #1d2840" per line
const coloursToText = (cs = []) => cs.map((c) => `${c.name} ${c.hex}`).join('\n');
const textToColours = (t) =>
  t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(.*?)\s+(#[0-9a-fA-F]{6})$/.exec(l);
    return m ? { name: m[1].trim(), hex: m[2] } : { name: l, hex: '' };
  });
// "S, M, 2XL:1.65" : an optional extra cost after a colon
const optsToText = (os = []) => os.map((o) => (o.cost ? `${o.label}:${o.cost}` : o.label)).join(', ');
const textToOpts = (t) =>
  t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [label, cost] = x.split(':');
    return { label: label.trim(), cost: cost === undefined ? 0 : Number(cost) };
  });

const blank = () => ({
  kind: 'garment', slug: '', name: '', category: 'polos', blurb: '', material: '', fabric: '', price: 15, sort: 100,
  specs: '', shipFirst: '3.42', shipExtra: '0.97', colours: 'Black #121214\nWhite #f5f5f2', images: [], published: false, available: true,
  methods: {
    print: { on: false, base: '13', sizes: 'S, M, L, XL, 2XL:1.7', positions: 'Front, Back, Front + back:4.6' },
    embroidery: { on: true, base: '12.89', sizes: 'S, M, L, XL, 2XL:1.65', positions: 'Left chest, Large back' },
  },
});

function toForm(row) {
  const c = row.config ?? {};
  const f = { ...blank(), kind: row.kind, slug: row.slug, name: row.name, category: row.category, blurb: row.blurb, material: row.material ?? '', fabric: row.fabric ?? '', price: row.price_pence == null ? 15 : row.price_pence / 100, sort: row.sort, images: row.images ?? [], published: row.published, available: row.available, specs: (c.specs ?? []).join('\n') };
  if (row.kind === 'garment') {
    f.shipFirst = String(c.ship?.first ?? 0);
    f.shipExtra = String(c.ship?.extra ?? 0);
    f.colours = coloursToText(c.colours);
    for (const id of Object.keys(METHOD_IDS)) {
      const m = c.methods?.find((x) => x.id === id);
      f.methods[id] = m ? { on: true, base: String(m.base), sizes: optsToText(m.sizes), positions: optsToText(m.positions) } : { ...f.methods[id], on: false };
    }
  }
  return f;
}

function toInput(f) {
  const base = { kind: f.kind, slug: f.slug.trim(), name: f.name, blurb: f.blurb, images: f.images, published: f.published, available: f.available, sort: f.sort, specs: f.specs.split('\n').map((s) => s.trim()).filter(Boolean) };
  if (f.kind === 'service') return { ...base, category: 'services', price: Number(f.price) };
  return {
    ...base, category: f.category, material: f.material, fabric: f.fabric,
    ship: { first: Number(f.shipFirst), extra: Number(f.shipExtra) },
    colours: textToColours(f.colours),
    methods: Object.entries(f.methods).filter(([, m]) => m.on).map(([id, m]) => ({ id, base: Number(m.base), sizes: textToOpts(m.sizes), positions: textToOpts(m.positions) })),
  };
}

function ProductForm({ id }) {
  const isNew = id === 'new';
  const [state] = useLoad('products');
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    if (isNew) return setF(blank());
    const row = state.data.products.find((p) => p.id === id);
    setF(row ? toForm(row) : null);
  }, [state.data, id, isNew]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setM = (mid, k) => (e) => setF((s) => ({ ...s, methods: { ...s.methods, [mid]: { ...s.methods[mid], [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } } }));

  // What the shop would charge for one piece, from the numbers in the form.
  const preview = useMemo(() => {
    if (!f) return null;
    try {
      if (f.kind === 'service') return gbp(Number(f.price));
      const row = { id: 'x', slug: 'x', name: 'x', category: f.category, kind: 'garment', config: { ...toInput(f), specs: [] }, images: [] };
      const p = fromRow(row);
      const low = Math.min(...p.methods.map((m) => unitPrice(p, { method: m.id, qty: 1 })));
      return Number.isFinite(low) ? `from ${gbp(low)}` : null;
    } catch {
      return null;
    }
  }, [f]);

  const upload = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setError('');
    for (const file of files) {
      try {
        const { url } = await api('upload', { method: 'POST', raw: file });
        setF((s) => ({ ...s, images: [...s.images, url] }));
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const { product } = await api(isNew ? 'products' : `products?id=${id}`, { method: isNew ? 'POST' : 'PUT', body: toInput(f) });
      setSaved('Saved.');
      if (isNew) window.location.hash = `#/admin/products/${product.id}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (state.error) return <p className="adm__error">{state.error}</p>;
  if (!f) return <p className="adm__muted">{state.loading ? 'Loading…' : 'Product not found.'} <a href="#/admin/products">Back</a></p>;
  const garment = f.kind === 'garment';
  return (
    <section>
      <p><a href="#/admin/products">← All products</a></p>
      <h1 className="adm__h1">{isNew ? 'New product' : f.name}</h1>
      <form className="adm__form" onSubmit={save}>
        <div className="adm__card">
          <h2>Basics</h2>
          {isNew && (
            <label>Type
              <select value={f.kind} onChange={set('kind')}><option value="garment">Garment (priced from cost)</option><option value="service">Service (fixed price)</option></select>
            </label>
          )}
          <label>Name<input required maxLength={80} value={f.name} onChange={set('name')} /></label>
          <label>Slug (the web address)<input required value={f.slug} onChange={set('slug')} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="lowercase letters, numbers and single hyphens" disabled={!isNew} /></label>
          {garment && <label>Category<select value={f.category} onChange={set('category')}>{CATEGORIES.filter((c) => c !== 'services').map((c) => <option key={c}>{c}</option>)}</select></label>}
          <label>Description<textarea required rows="3" maxLength={600} value={f.blurb} onChange={set('blurb')} /></label>
          <label>Points to show (one per line, up to 8)<textarea rows="4" value={f.specs} onChange={set('specs')} /></label>
          {garment ? (
            <>
              <label>Material tag on the shop card (e.g. 100% cotton)<input maxLength={60} value={f.material} onChange={set('material')} /></label>
              <label>Fabric detail<input maxLength={200} value={f.fabric} onChange={set('fabric')} /></label>
            </>
          ) : (
            <label>Price per unit (£)<input type="number" step="0.01" min="0.5" max="1000" required value={f.price} onChange={set('price')} /></label>
          )}
          <label>Display order (lowest first)<input type="number" min="0" max="1000" value={f.sort} onChange={set('sort')} /></label>
        </div>

        {garment && (
          <div className="adm__card">
            <h2>Colours</h2>
            <label>One per line: name then hex colour<textarea rows="5" value={f.colours} onChange={set('colours')} /></label>
            <h2>Costs and pricing</h2>
            <p className="adm__muted">Enter what the supplier charges, ex VAT. The shop price is calculated from these costs with the margin and fees in <code>src/lib/pricing.js</code>.</p>
            <div className="adm__row">
              <label>Delivery, first item (£)<input type="number" step="0.01" min="0" value={f.shipFirst} onChange={set('shipFirst')} /></label>
              <label>Delivery, each extra item (£)<input type="number" step="0.01" min="0" value={f.shipExtra} onChange={set('shipExtra')} /></label>
            </div>
            {Object.entries(METHOD_IDS).map(([mid, label]) => (
              <fieldset key={mid} className="adm__method">
                <legend><label><input type="checkbox" checked={f.methods[mid].on} onChange={setM(mid, 'on')} /> Offer as {label.toLowerCase()}</label></legend>
                {f.methods[mid].on && (
                  <>
                    <label>Garment cost with one logo, smallest size (£)<input type="number" step="0.01" min="0" value={f.methods[mid].base} onChange={setM(mid, 'base')} /></label>
                    <label>Sizes, comma separated. Add “:cost” for a surcharge, e.g. 2XL:1.65<input value={f.methods[mid].sizes} onChange={setM(mid, 'sizes')} /></label>
                    <label>Logo positions, same format<input value={f.methods[mid].positions} onChange={setM(mid, 'positions')} /></label>
                  </>
                )}
              </fieldset>
            ))}
          </div>
        )}
        {preview && <p className="adm__preview">Shop price for one piece: <strong>{preview}</strong></p>}

        <div className="adm__card">
          <h2>Photos</h2>
          <p className="adm__muted">PNG, JPEG or WebP, up to 4 MB each. The first photo is the main one. {garment && 'Leave empty to use the built-in model photos with the live logo preview (only the launch range has these).'}</p>
          <ul className="adm__images">
            {f.images.map((src, i) => (
              <li key={src}>
                <img src={src} alt="" />
                <span className="adm__muted">{i === 0 ? 'Main photo' : `Photo ${i + 1}`}</span>
                {i > 0 && <button type="button" onClick={() => setF((s) => { const a = [...s.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...s, images: a }; })}>{i === 1 ? 'Make main' : 'Move earlier'}</button>}
                <button type="button" onClick={() => setF((s) => ({ ...s, images: s.images.filter((x) => x !== src) }))}>Remove</button>
              </li>
            ))}
          </ul>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={upload} aria-label="Upload product photos" />
        </div>

        <div className="adm__card">
          <h2>Visibility</h2>
          <label className="adm__check"><input type="checkbox" checked={f.published} onChange={set('published')} /> Published (shown in the shop)</label>
          <label className="adm__check"><input type="checkbox" checked={f.available} onChange={set('available')} /> Available (customers can add it to the bag)</label>
        </div>

        {error && <p className="adm__error" role="alert">{error}</p>}
        {saved && <p className="adm__ok" role="status">{saved}</p>}
        <button className="pill pill--copper pill--lg" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
      </form>
    </section>
  );
}
