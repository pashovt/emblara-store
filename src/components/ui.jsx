import { gbp } from '../lib/utils.js';

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

// ---------- product image or labelled placeholder ----------
export function ProductImage({ product, index = 0, className = '', sizes }) {
  const src = product.images[index];
  if (src) {
    return (
      <img
        className={`pimg ${className}`}
        src={src}
        alt={`${product.name} with the EMBLARA logo (illustrative image)`}
        width="1000"
        height="1000"
        loading="lazy"
        decoding="async"
        sizes={sizes}
      />
    );
  }
  return (
    <div className={`pimg pimg--placeholder ${className}`} role="img" aria-label={`${product.name} — photo coming soon`}>
      <ThreadLines />
      <Mark className="pimg__mark" />
      <span className="pimg__name">{product.name}</span>
      <span className="pimg__note">Photo coming soon</span>
    </div>
  );
}

// ---------- product card ----------
export function ProductCard({ product }) {
  return (
    <a className="card" href={`#/product/${product.slug}`}>
      <div className={`card__media${product.images[1] ? ' card__media--swap' : ''}`}>
        <ProductImage product={product} />
        {product.images[1] && <ProductImage product={product} index={1} className="card__alt" />}
        {product.badge && <span className="card__badge">{product.badge}</span>}
      </div>
      <div className="card__body">
        <div className="card__row">
          <h3 className="card__name">{product.name}</h3>
          <span className="card__price">
            <span className="card__from">from</span> {gbp(product.price)}
          </span>
        </div>
        <div className="card__row card__row--meta">
          <span className="card__method">{product.method}</span>
          <span className="card__dots" aria-label={`${product.colours.length} colours`}>
            {product.colours.slice(0, 6).map((c) => (
              <i key={c.name} style={{ background: c.hex }} />
            ))}
            {product.colours.length > 6 && <em>+{product.colours.length - 6}</em>}
          </span>
        </div>
      </div>
    </a>
  );
}
