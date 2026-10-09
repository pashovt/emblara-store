import { useEffect, useRef, useState } from 'react';
import { imagesFor } from '../data/products.js';
import { nav, site } from '../data/site.js';
import { useCart } from '../store/cart.jsx';
import { gbp, setScrollLock } from '../lib/utils.js';
import { Mark, ProductImage } from './ui.jsx';

// ---------- header ----------
export function Header({ route }) {
  const { totals, setOpen } = useCart();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const onDark = route.page === 'checkout';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const close = () => setMenu(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  return (
    <>
    {/* Outside <header> so its difference blend reaches the page and the
        mark flips between light and dark sections. */}
    <a className="wordmark" href="#/" aria-label={`${site.brand} home`}>
      <Mark className="wordmark__mark" />
      <span>{site.brand}</span>
    </a>
    <header className={`header${scrolled ? ' header--scrolled' : ''}${onDark ? ' header--plain' : ''}`}>
      <span className="header__spacer" aria-hidden="true" />

      <nav className="header__nav" aria-label="Main">
        {nav.map((n) => (
          <a key={n.href} href={n.href} aria-current={`#/${route.page}` === n.href ? 'page' : undefined}>
            {n.label}
          </a>
        ))}
      </nav>

      <div className="header__right">
        <button type="button" className="pill pill--bag" onClick={() => setOpen(true)}>
          <BagIcon />
          <span>Bag</span>
          <span className="pill__count" aria-label={`${totals.count} items`}>
            {totals.count}
          </span>
        </button>
        <button
          type="button"
          className="header__menu"
          aria-expanded={menu}
          aria-controls="menu-panel"
          onClick={() => setMenu((v) => !v)}
        >
          <span className="visually-hidden">{menu ? 'Close menu' : 'Open menu'}</span>
          <span className="header__menu-lines" aria-hidden="true" />
        </button>
      </div>

      <div id="menu-panel" className="menu-panel" hidden={!menu}>
        {nav.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
        <a href="#/checkout">Checkout</a>
      </div>
    </header>
    </>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 8h14l-1.2 12H6.2L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

// ---------- bag drawer ----------
export function CartDrawer() {
  const { open, setOpen, totals, setQty, remove } = useCart();
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setScrollLock(true);
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      setScrollLock(false);
      prev?.focus?.();
    };
  }, [open, setOpen]);

  return (
    <div className={`drawer${open ? ' drawer--open' : ''}`} aria-hidden={!open}>
      <button type="button" className="drawer__scrim" tabIndex={-1} onClick={() => setOpen(false)} aria-label="Close bag" />
      <aside
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bag-title"
        tabIndex={-1}
        ref={panel}
        inert={!open}
      >
        <div className="drawer__head">
          <h2 id="bag-title">Your bag <span>({totals.count})</span></h2>
          <button type="button" className="drawer__close" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        {totals.lines.length === 0 ? (
          <div className="drawer__empty">
            <p>Your bag is empty.</p>
            <a className="pill pill--copper" href="#/shop" onClick={() => setOpen(false)}>
              Browse the range
            </a>
          </div>
        ) : (
          <>
            <p className="drawer__free">Tracked UK delivery is included in every price</p>
            <ul className="drawer__lines">
              {totals.lines.map((l) => (
                <li key={l.id} className="line">
                  <a className="line__img" href={`#/product/${l.slug}`} onClick={() => setOpen(false)}>
                    <ProductImage product={l.product} src={imagesFor(l.product, l.colour)[0]} />
                  </a>
                  <div className="line__info">
                    <p className="line__name">{l.product.name}</p>
                    <p className="line__meta">
                      {[l.methodLabel, l.colour, l.size, l.position].filter(Boolean).join(' · ')}
                    </p>
                    {l.logoName && <p className="line__meta">Logo: {l.logoName}</p>}
                    <div className="line__row">
                      <div className="stepper" aria-label={`Quantity for ${l.product.name}`}>
                        <button type="button" onClick={() => setQty(l.id, l.qty - 1)} aria-label="Decrease quantity">−</button>
                        <span>{l.qty}</span>
                        <button type="button" onClick={() => setQty(l.id, l.qty + 1)} aria-label="Increase quantity">+</button>
                      </div>
                      <span className="line__total">{gbp(l.total)}</span>
                    </div>
                    <p className="line__tier">{gbp(l.unit)} each at this order size</p>
                    <button type="button" className="line__remove" onClick={() => remove(l.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer__foot">
              <p className="sum-row sum-row--big">
                <span>Subtotal</span>
                <span>{gbp(totals.subtotal)}</span>
              </p>
              <p className="drawer__note">Delivery is included. Proof sent before production.</p>
              <a className="pill pill--copper pill--block" href="#/checkout" onClick={() => setOpen(false)}>
                Checkout
              </a>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ---------- footer ----------
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div>
          <p className="footer__tag">{site.tagline}</p>
          <p className="footer__partner">{site.line}</p>
        </div>
        <nav className="footer__nav" aria-label="Footer">
          <a href="#/shop">Shop all</a>
          <a href="#/shop/polos">Polos</a>
          <a href="#/shop/tees">T-shirts</a>
          <a href="#/shop/sweats">Hoodies & sweatshirts</a>
          <a href="#/process">How it works</a>
          <a href="#/checkout">Checkout</a>
        </nav>
      </div>
      <p className="footer__word" aria-hidden="true">
        {site.brand}
      </p>
      <p className="footer__notice">{site.demoNotice}</p>
    </footer>
  );
}
