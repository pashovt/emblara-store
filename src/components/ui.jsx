import { gbp } from '../lib/utils.js';
import { defaultPosition } from '../data/products.js';
import { AI_VIEW, aiUsable, boxesFor, garmentKey } from '../data/placements.js';
import { useLogo } from '../store/logo.jsx';

// ---------- brand mark ----------
const TOP = 'M760 7 L260 7 L5 255 L80 333 L305 113 L650 113 Z';
const BOTTOM = 'M630 258 L270 258 L90 435 L270 615 L725 615 L615 513 L310 513 L230 435 L310 357 L530 357 Z';

export function Mark({ className }) {
  return (
    <svg className={className} viewBox="0 0 770 620" aria-hidden="true">
      <path d={TOP} fill="currentColor" />
      <path d={BOTTOM} fill="currentColor" />
    </svg>
  );
}

// ---------- background thread lines ----------
// Loose stitched curves drawn across a section, like thread on fabric.
export function ThreadLines({ className = '' }) {
  return (
    <svg className={`threads ${className}`} viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-40 180 C 260 60, 420 380, 720 260 S 1180 40, 1500 220" />
      <path d="M-60 520 C 200 420, 380 700, 690 600 S 1100 380, 1500 560" />
      <path d="M-20 820 C 300 700, 520 940, 860 820 S 1260 640, 1480 760" />
      <path d="M200 -40 C 260 200, 120 420, 260 640 S 300 860, 240 960" />
      <path d="M1180 -40 C 1100 180, 1260 380, 1140 600 S 1220 820, 1160 960" />
    </svg>
  );
}

// ---------- marquee ----------
export function Marquee({ items, reverse = false, className = '' }) {
  const row = [...items, ...items, ...items];
  return (
    <div className={`marquee ${reverse ? 'marquee--reverse' : ''} ${className}`} aria-hidden="true">
      {[0, 1].map((copy) => (
        <div key={copy} className="marquee__track">
          {row.map((word, i) => (
            <span key={`${copy}-${i}`} className={i % 2 ? 'marquee__serif' : 'marquee__sans'}>
              {word}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- garment photo with the logo drawn on ----------
// Photos are clean Gelato previews; the logo (EMBLARA or the visitor's own) is
// placed in the decoration area for the chosen position. See placements.js.
const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const pct = (n) => `${(n * 100).toFixed(2)}%`;

export const garmentSrc = (product, colour, view) => `/garments/${garmentKey(product.slug)}/${kebab(colour)}-${view}.webp`;

// view 'ai-front' asks for the owner's AI model photo. It is used when it fits
// the colour, position and logo; otherwise the Gelato model photo stands in.
export function Garment({ product, colour, view = 'model-front', position, className = '', alt, eager = false }) {
  const { artFor } = useLogo();
  const c = product.colours.find((x) => x.name === colour) ?? product.colours[0];
  const pos = position ?? defaultPosition(product);
  const art = artFor(c.hex);
  const emblara = art.kind === 'emblara';
  const v = view === AI_VIEW && !aiUsable(product, c.name, pos, emblara) ? 'model-front' : view;
  // The EMBLARA AI photo already carries the logo at its own placement.
  const baked = v === AI_VIEW && emblara && pos === product.ai.position;
  const src = v === AI_VIEW ? (baked ? product.ai.emblara : product.ai.blank) : garmentSrc(product, c.name, v);
  const boxes = baked ? [] : boxesFor(product.slug, v, pos);
  const logoNote = art.kind === 'custom' ? 'your logo' : 'the EMBLARA logo';
  return (
    <div className={`garment${v === AI_VIEW ? ' garment--ai' : ''} ${className}`}>
      <img
        className="garment__photo"
        src={src}
        alt={alt ?? `${product.name} in ${c.name} with ${logoNote} (illustrative)`}
        width="1000"
        height="1000"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable="false"
      />
      {boxes.map((b) => (
        <span
          key={`${b.x}-${b.y}`}
          className={`garment__logo${art.darkGarment ? ' garment__logo--on-dark' : ''}`}
          style={{ left: pct(b.x - b.w / 2), top: pct(b.y - b.h / 2), width: pct(b.w), height: pct(b.h) }}
          aria-hidden="true"
        >
          {art.kind === 'custom' ? <img src={art.src} alt="" draggable="false" /> : <Mark className="garment__mark" />}
        </span>
      ))}
    </div>
  );
}

// ---------- product image: garment photo, or a tile for services ----------
export function ProductImage({ product, colour, view, position, className = '', eager }) {
  if (product.service) {
    return (
      <div className={`pimg pimg--placeholder ${className}`} role="img" aria-label={product.name}>
        <ThreadLines />
        <Mark className="pimg__mark" />
        <span className="pimg__name">{product.name}</span>
        <span className="pimg__note">Done by our team</span>
      </div>
    );
  }
  return <Garment product={product} colour={colour} view={view} position={position} className={className} eager={eager} />;
}

// ---------- product card ----------
export function ProductCard({ product }) {
  return (
    <a className="card" href={`#/product/${product.slug}`}>
      <div className={`card__media${product.service ? '' : ' card__media--swap'}`}>
        <ProductImage product={product} view={AI_VIEW} />
        {!product.service && <ProductImage product={product} view="flat-front" className="card__alt" />}
        {product.badge && <span className="card__badge">{product.badge}</span>}
      </div>
      <div className="card__body">
        <div className="card__row">
          <h3 className="card__name">{product.name}</h3>
          <span className="card__price">
            {!product.service && <span className="card__from">from</span>} {gbp(product.price)}
          </span>
        </div>
        <div className="card__row card__row--meta">
          <span className="card__method">{product.method}</span>
          {product.colours.length > 0 && (
            <span className="card__dots" aria-label={`${product.colours.length} colours`}>
              {product.colours.slice(0, 6).map((c) => (
                <i key={c.name} style={{ background: c.hex }} />
              ))}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
