import { useEffect, useRef, useState } from 'react';
import { bySlug } from '../data/products.js';
import { nav, site } from '../data/site.js';
import { leadView } from '../data/placements.js';
import { useCart } from '../store/cart.jsx';
import { useLogo } from '../store/logo.jsx';
import { gbp, setScrollLock, useTheme } from '../lib/utils.js';
import { Mark, ProductImage } from './ui.jsx';

// ---------- header ----------
export function Header({ route }) {
  const { totals, setOpen } = useCart();
  const { mode, custom, setPanelOpen } = useLogo();
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
        <button type="button" className="pill pill--logo" onClick={() => setPanelOpen(true)}>
          <span className="pill--logo__thumb" aria-hidden="true">
            {mode === 'custom' && custom ? <img src={custom.src} alt="" /> : <Mark />}
          </span>
          <span className="pill--logo__label">{mode === 'custom' && custom ? 'Your logo' : 'Add your logo'}</span>
        </button>
        <ThemeButton />
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

// ---------- theme ----------
const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_ORDER = ['system', 'light', 'dark'];

function ThemeIcon({ theme }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function ThemeButton() {
  const [theme, setTheme] = useTheme();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  return (
    <button
      type="button"
      className="header__theme"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[next]}`}
      title={`Theme: ${THEME_LABELS[theme]}`}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}

function ThemeChooser() {
  const [theme, setTheme] = useTheme();
  return (
    <fieldset className="theme-chooser">
      <legend>Theme</legend>
      {THEME_ORDER.map((t) => (
        <label key={t}>
          <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => setTheme(t)} />
          <span>{THEME_LABELS[t]}</span>
        </label>
      ))}
    </fieldset>
  );
}

// ---------- your logo panel ----------
export function LogoPanel() {
  const { mode, custom, saved, setFromFile, choose, remove, panelOpen, setPanelOpen } = useLogo();
  const panel = useRef(null);
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const cleanUp = bySlug['logo-clean-up'];

  useEffect(() => {
    if (!panelOpen) return undefined;
    setScrollLock(true);
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      setScrollLock(false);
      prev?.focus?.();
    };
  }, [panelOpen, setPanelOpen]);

  const take = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await setFromFile(file);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className={`modal${panelOpen ? ' modal--open' : ''}`} aria-hidden={!panelOpen}>
      <button type="button" className="modal__scrim" tabIndex={-1} onClick={() => setPanelOpen(false)} aria-label="Close" />
      <section className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="logo-title" tabIndex={-1} ref={panel} inert={!panelOpen}>
        <div className="modal__head">
          <h2 id="logo-title">See it with <em>your</em> logo</h2>
          <button type="button" className="drawer__close" onClick={() => setPanelOpen(false)}>Close</button>
        </div>
        <p className="modal__sub">Every garment on the site will show the logo you pick. Switch back to ours at any time.</p>

        <div className="logo-options" role="radiogroup" aria-label="Logo shown on the garments">
          <label className="logo-option">
            <input type="radio" name="logo-mode" checked={mode === 'emblara'} onChange={() => choose('emblara')} />
            <span className="logo-option__art logo-option__art--emblara"><Mark /></span>
            <span className="logo-option__name">EMBLARA logo</span>
          </label>

          {custom ? (
            <label className="logo-option">
              <input type="radio" name="logo-mode" checked={mode === 'custom'} onChange={() => choose('custom')} />
              <span className="logo-option__art logo-option__art--pair">
                <span className="logo-option__swatch"><img src={custom.src} alt="" /></span>
                <span className="logo-option__swatch logo-option__swatch--dark"><img src={custom.tone < 0.35 ? custom.light : custom.src} alt="" /></span>
              </span>
              <span className="logo-option__name">{custom.name}</span>
            </label>
          ) : (
            <div
              className={`logo-drop${drag ? ' logo-drop--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
            >
              <span className="logo-drop__plus" aria-hidden="true">+</span>
              <span>Drop your logo here</span>
              <span className="logo-drop__hint">PNG, SVG, JPG or WebP</span>
            </div>
          )}
        </div>

        <div className="modal__actions">
          <label className={`pill pill--copper${busy ? ' is-busy' : ''}`}>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,.svg" className="visually-hidden" onChange={(e) => take(e.target.files?.[0])} disabled={busy} />
            {busy ? 'Preparing your logo…' : custom ? 'Change logo' : 'Upload your logo'}
          </label>
          {custom && <button type="button" className="link-button" onClick={remove}>Remove my logo</button>}
          <button type="button" className="pill pill--ghost-dark" onClick={() => setPanelOpen(false)}>Done</button>
        </div>

        <div className="modal__notes" aria-live="polite">
          {error && <p className="field__err">{error}</p>}
          {custom && custom.removedBackground && <p>We removed the background from your file.</p>}
          {custom && custom.lowRes && <p>This file is quite small, so it may look soft. A larger PNG or an SVG gives a sharper preview.</p>}
          {!saved && <p>Your browser didn’t let us save the logo, so it will be gone when you close this tab.</p>}
          <p>Your logo stays in this browser and is remembered next time you visit. It is not uploaded anywhere.</p>
          {cleanUp && (
            <p>
              Fuzzy edges, a busy background or only a photo of your sign? Our team can redraw it for print and embroidery:{' '}
              <a href={`#/product/${cleanUp.slug}`} onClick={() => setPanelOpen(false)}>{cleanUp.name}, {gbp(cleanUp.price)}</a>.
            </p>
          )}
        </div>
      </section>
    </div>
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
                    <ProductImage product={l.product} colour={l.colour} position={l.position} view={leadView(l.position ?? '')} />
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
                    {!l.product.service && <p className="line__tier">{gbp(l.unit)} each at this order size</p>}
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
// Outline wordmark with a few letters filled in copper.
const FILLED = new Set([0, 4]);

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
          <a href="#/product/logo-clean-up">Logo clean-up</a>
          <a href="#/process">How it works</a>
          <a href="#/checkout">Checkout</a>
        </nav>
        <ThemeChooser />
      </div>
      <p className="footer__word" aria-hidden="true">
        {[...site.brand].map((ch, i) => (
          <span key={i} className={FILLED.has(i) ? 'is-filled' : undefined}>{ch}</span>
        ))}
      </p>
      <p className="footer__notice">{site.demoNotice}</p>
    </footer>
  );
}
