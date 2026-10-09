import { useState } from 'react';
import { bySlug, categories, imagesFor, products } from '../data/products.js';
import { breaks, deliveryNote } from '../data/site.js';
import { useCart } from '../store/cart.jsx';
import { breakIndex, gbp } from '../lib/utils.js';
import { methodOf, singleQuote, unitPrice } from '../lib/pricing.js';
import { ProductCard, ProductImage } from '../components/ui.jsx';

export default function Product({ slug }) {
  const product = bySlug[slug];
  if (!product) {
    return (
      <div className="page page--missing">
        <h1 className="h2">Product not found.</h1>
        <a className="pill pill--copper" href="#/shop">Back to the shop</a>
      </div>
    );
  }
  return <ProductView key={product.slug} product={product} />;
}

function ProductView({ product }) {
  const { add } = useCart();
  const [image, setImage] = useState(0);
  const [methodId, setMethodId] = useState(product.methods[0].id);
  const [colour, setColour] = useState(product.colours[0].name);
  const [size, setSize] = useState('');
  const [position, setPosition] = useState(product.methods[0].positions[0].label);
  const [qty, setQty] = useState(1);
  const [logoName, setLogoName] = useState('');
  const [error, setError] = useState('');

  const method = methodOf(product, methodId);
  const quoteFor = (q) => singleQuote(product, { method: methodId, size, position, qty: q });
  const price = (q) => quoteFor(q).total / q;
  const lineTotal = quoteFor(qty).total;
  const unit = lineTotal / qty;
  const active = breakIndex(qty);

  const shots = imagesFor(product, colour);
  const ownPhoto = Boolean(product.colourImages?.[colour]);
  const previewNote = shots.length && !ownPhoto ? `Preview shown in ${product.previewColour}. The ${colour} photo is coming soon.` : '';
  const gallery = shots.length ? shots : [null];
  const categoryLabel = categories.find((c) => c.id === product.category)?.label ?? 'Range';

  const sameCategory = products.filter((p) => p.category === product.category && p.slug !== product.slug);
  const related = [...sameCategory, ...products.filter((p) => p.category !== product.category && p.slug !== product.slug)].slice(0, 4);

  const pickMethod = (id) => {
    const next = methodOf(product, id);
    setMethodId(id);
    setPosition(next.positions[0].label);
    if (!next.sizes.some((s) => s.label === size)) setSize('');
  };

  const onAdd = (e) => {
    e.preventDefault();
    if (!size) {
      setError('Choose a size to continue.');
      document.getElementById('size-group')?.focus();
      return;
    }
    setError('');
    add({ slug: product.slug, method: methodId, colour, size, position, qty, logoName });
  };

  return (
    <div className="page page--product">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/shop">Shop</a>
        <span aria-hidden="true">/</span>
        <a href={`#/shop/${product.category}`}>{categoryLabel}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp">
        <div className="pdp__gallery">
          <div className="pdp__main">
            <ProductImage product={product} src={gallery[Math.min(image, gallery.length - 1)]} />
            <span className="pdp__illustrative">Illustrative image</span>
          </div>
          {gallery.length > 1 && (
            <div className="pdp__thumbs" role="group" aria-label="Product images">
              {gallery.map((src, i) => (
                <button key={src} type="button" className="pdp__thumb" aria-pressed={i === image} onClick={() => setImage(i)} aria-label={`Show image ${i + 1}`}>
                  <ProductImage product={product} src={src} />
                </button>
              ))}
            </div>
          )}
          {previewNote && <p className="opt__hint">{previewNote}</p>}
        </div>

        <form className="pdp__info" onSubmit={onAdd} noValidate>
          <p className="eyebrow">{method.label}</p>
          <h1 className="pdp__title">{product.name}</h1>
          <p className="pdp__price">
            {gbp(unit)} <span>each · delivery{method.id === 'embroidery' ? ', logo set-up' : ''} and proof included</span>
          </p>
          <p className="pdp__blurb">{product.blurb}</p>

          {product.methods.length > 1 && (
            <fieldset className="opt">
              <legend>Finish <span>{method.label}</span></legend>
              <div className="opt__row">
                {product.methods.map((m) => (
                  <label key={m.id} className="chip">
                    <input type="radio" name="method" value={m.id} checked={methodId === m.id} onChange={() => pickMethod(m.id)} />
                    <span>{m.label} · from {gbp(unitPrice(product, { method: m.id, qty: 1 }))}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="opt">
            <legend>Colour <span>{colour}</span></legend>
            <div className="opt__row">
              {product.colours.map((c) => (
                <label key={c.name} className="swatch" title={c.name}>
                  <input type="radio" name="colour" value={c.name} checked={colour === c.name} onChange={() => { setColour(c.name); setImage(0); }} />
                  <span style={{ background: c.hex }} />
                  <em className="visually-hidden">{c.name}</em>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={`opt${error ? ' opt--error' : ''}`} id="size-group" tabIndex={-1} aria-describedby={error ? 'size-error' : undefined}>
            <legend>Size <span>{size || 'Choose'}</span></legend>
            <div className="opt__row">
              {method.sizes.map((s) => (
                <label key={s.label} className="chip">
                  <input type="radio" name="size" value={s.label} checked={size === s.label} onChange={() => { setSize(s.label); setError(''); }} />
                  <span>{s.label}{s.add ? ` +${gbp(s.add)}` : ''}</span>
                </label>
              ))}
            </div>
            {error && <p className="opt__error" id="size-error">{error}</p>}
            <p className="opt__hint">Mixing sizes? Add each size to the bag. They are priced together as one order.</p>
          </fieldset>

          <fieldset className="opt">
            <legend>Logo position</legend>
            <div className="opt__row">
              {method.positions.map((p) => (
                <label key={p.label} className="chip">
                  <input type="radio" name="position" value={p.label} checked={position === p.label} onChange={() => setPosition(p.label)} />
                  <span>{p.label}{p.add ? ` +${gbp(p.add)}` : ''}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="opt opt--logo">
            <label htmlFor="logo-file">Your logo <span>(optional now)</span></label>
            <input id="logo-file" type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,.ai,.eps" onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? '')} aria-describedby="logo-hint" />
            <p className="opt__hint" id="logo-hint">Demo only: the file stays on your device. Vector (SVG, PDF, AI, EPS) or a large transparent PNG works best.</p>
          </div>

          <div className="pdp__buy">
            <div className="stepper stepper--lg" aria-label="Quantity">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <input type="number" min="1" max="999" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} aria-label="Quantity" />
              <button type="button" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="Increase quantity">+</button>
            </div>
            <button type="submit" className="pill pill--copper pill--lg pdp__add">
              Add to bag · {gbp(lineTotal)}
            </button>
          </div>

          <table className="tiers">
            <caption>Price per piece by quantity</caption>
            <tbody>
              <tr>
                {breaks.map((b, i) => (
                  <td key={b.min} className={i === active ? 'is-active' : ''}>
                    <span>{b.label}</span>
                    <strong>{gbp(price(b.min))}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="opt__hint">Prices are for this item on its own. In the bag the whole order is priced together, across items, sizes and colours. {deliveryNote}</p>

          <details className="acc" open>
            <summary>Fabric & fit</summary>
            <p>{product.fabricByColour?.[colour] ?? product.fabric}</p>
            <ul>{product.specs.map((s) => <li key={s}>{s}</li>)}</ul>
          </details>
          <details className="acc">
            <summary>Proof & production</summary>
            <p>After you order, we send a digital proof showing the garment, logo position, size and colours. Production starts when you approve it. Production and delivery times are confirmed with your proof.</p>
          </details>
          <details className="acc">
            <summary>Returns</summary>
            <p>Personalised items can’t be returned for change of mind, so check sizes before approving your proof. Faulty items or anything that doesn’t match the approved proof will be put right.</p>
          </details>
        </form>
      </div>

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title" className="h3">Complete the kit</h2>
          <div className="grid grid--4">
            {related.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
