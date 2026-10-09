import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tryon } from '../data/site.js';
import { bySlug } from '../data/products.js';
import { AI_VIEW } from '../data/placements.js';
import { gbp, motionOK, scrollToY } from '../lib/utils.js';
import { Garment, ThreadLines } from './ui.jsx';
import { useLogo } from '../store/logo.jsx';

gsap.registerPlugin(ScrollTrigger);

// "Virtual fitting room" hero. One continuous position (0 … n-1) drives
// everything: flat garments ride a 3D ring around the model, and as the next
// garment reaches the centre a scan line wipes the model into it. Within a
// garment type the model photo is identical, so only the clothing changes.
const STEP = 0.62; // radians between garments on the ring
const DESKTOP = '(min-width: 960px) and (prefers-reduced-motion: no-preference)';

export default function TryOnHero() {
  const looks = tryon.order
    .map((slug) => bySlug[slug])
    .filter((p) => p?.ai)
    .map((p) => ({
      slug: p.slug,
      label: p.name,
      colour: p.ai.colour,
      hex: p.colours.find((c) => c.name === p.ai.colour)?.hex ?? '#888',
      position: p.ai.position,
    }));
  const { mode, setPanelOpen } = useLogo();
  const n = looks.length;
  const root = useRef(null);
  const ring = useRef(null);
  const models = useRef([]);
  const flats = useRef([]);
  const scan = useRef(null);
  const pos = useRef({ v: 0 });
  const trigger = useRef(null);
  const [active, setActive] = useState(0);

  const apply = useCallback(
    (p) => {
      const v = Math.max(0, Math.min(n - 1, p));
      const k = Math.floor(v);
      const t = v - k;

      models.current.forEach((el, i) => {
        if (!el) return;
        if (i === k) {
          // The photos are cut out, so the outgoing model must also be clipped
          // at the scan line or it shows through the incoming one.
          el.style.opacity = '1';
          el.style.clipPath = t > 0 ? `inset(0 ${t * 100}% 0 0)` : 'none';
          el.style.zIndex = '1';
        } else if (i === k + 1 && t > 0) {
          el.style.opacity = '1';
          el.style.clipPath = `inset(0 0 0 ${(1 - t) * 100}%)`;
          el.style.zIndex = '2';
        } else {
          el.style.opacity = '0';
          el.style.zIndex = '0';
        }
      });

      if (scan.current) {
        scan.current.style.left = `${(1 - t) * 100}%`;
        scan.current.style.opacity = t > 0.01 && t < 0.99 ? '1' : '0';
      }

      const w = ring.current?.offsetWidth ?? 1200;
      const R = w * (w < 960 ? 0.78 : 0.42); // wider ring on phones so garments clear the model
      flats.current.forEach((el, i) => {
        if (!el) return;
        const d = i - v;
        const ad = Math.abs(d);
        if (ad > 3.4) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          return;
        }
        el.style.visibility = 'visible';
        const angle = d * STEP;
        const depth = (Math.cos(angle) + 1) / 2; // 1 at the front, 0 behind
        // Approaching the centre the garment shrinks onto the torso and fades,
        // handing over to the model photo.
        const near = Math.min(1, ad);
        const x = Math.sin(angle) * R * (0.35 + 0.65 * near);
        const scale = (0.5 + 0.5 * depth) * (0.62 + 0.38 * near);
        // Gone before it overlaps the body, so it never ghosts through the model.
        const opacity = ad < 1 ? 0.8 * Math.max(0, (ad - 0.55) / 0.45) : 0.8 * Math.max(0, 1 - (ad - 1) / 2.4);
        el.style.transform = `translate(-50%, -50%) translateX(${x}px) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.zIndex = String(1 + Math.round(depth * 3)); // always below the model (5)
      });

      const idx = Math.round(v);
      setActive((a) => (a === idx ? a : idx));
    },
    [n],
  );

  // Move to a garment: through the scroll position when pinned, otherwise tween.
  const go = useCallback(
    (target) => {
      const idx = (target + n) % n;
      const st = trigger.current;
      if (st) {
        scrollToY(st.start + (idx / (n - 1)) * (st.end - st.start));
        return;
      }
      if (!motionOK()) {
        pos.current.v = idx;
        apply(idx);
        return;
      }
      gsap.to(pos.current, { v: idx, duration: 1.1, ease: 'power3.inOut', overwrite: true, onUpdate: () => apply(pos.current.v) });
    },
    [apply, n],
  );

  useLayoutEffect(() => {
    apply(0);
    let ctx;
    let timer;
    let io;
    try {
      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add(DESKTOP, () => {
          trigger.current = ScrollTrigger.create({
            trigger: root.current,
            start: 'top top',
            end: `+=${(n - 1) * 34}%`,
            pin: true,
            scrub: 0.7,
            onUpdate: (self) => {
              pos.current.v = self.progress * (n - 1);
              apply(pos.current.v);
            },
          });
          gsap.from(root.current.querySelectorAll('.tryon__line > span'), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08 });
          return () => {
            trigger.current = null;
          };
        });
        // Small screens: no pinning; the fitting room advances on its own
        // while visible, and swipes or buttons take over.
        mm.add('(max-width: 959px) and (prefers-reduced-motion: no-preference)', () => {
          let visible = false;
          io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.4 });
          io.observe(root.current);
          timer = setInterval(() => {
            if (visible && !root.current?.dataset.touched) {
              const next = Math.round(pos.current.v) + 1;
              if (next >= n) {
                pos.current.v = 0;
                apply(0);
              } else {
                go(next);
              }
            }
          }, 3200);
          return () => {
            clearInterval(timer);
            io?.disconnect();
          };
        });
      }, root);
    } catch (err) {
      console.warn('Try-on hero animation disabled:', err);
    }
    const onResize = () => apply(pos.current.v);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      ctx?.revert();
    };
  }, [apply, go, n]);

  // Swipe on touch screens.
  const swipe = useRef(null);
  const onPointerDown = (e) => {
    swipe.current = e.clientX;
  };
  const onPointerUp = (e) => {
    if (swipe.current == null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) < 40) return;
    root.current.dataset.touched = '1';
    go(active + (dx < 0 ? 1 : -1));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
  };

  const look = looks[active];
  const product = bySlug[look.slug];

  return (
    <section className="tryon" ref={root} aria-labelledby="tryon-title" aria-roledescription="carousel">
      <ThreadLines className="threads--light" />

      <div className="tryon__copy">
        <p className="eyebrow">{tryon.eyebrow}</p>
        <h1 id="tryon-title" className="tryon__title">
          {tryon.lines.map((l) => (
            <span key={l.text} className={`tryon__line${l.serif ? ' tryon__line--serif' : ''}`}>
              <span>{l.text}</span>
            </span>
          ))}
        </h1>
        <p className="tryon__sub">{tryon.sub}</p>
        <button type="button" className="pill pill--copper tryon__logo-cta" onClick={() => setPanelOpen(true)}>
          {mode === 'custom' ? 'Change your logo' : 'See it with your logo'}
        </button>
      </div>

      <div className="tryon__stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="tryon__ring" ref={ring} aria-hidden="true">
          {looks.map((l, i) => (
            <div key={`${l.slug}-${l.colour}`} ref={(el) => { flats.current[i] = el; }} className="tryon__flat">
              <Garment product={bySlug[l.slug]} colour={l.colour} view="flat-front" position={l.position} alt="" eager={i < 3} />
            </div>
          ))}
        </div>

        <div className="tryon__model">
          <div className="tryon__glow" aria-hidden="true" />
          {looks.map((l, i) => (
            <div key={`${l.slug}-${l.colour}`} ref={(el) => { models.current[i] = el; }} className="tryon__layer">
              <Garment
                product={bySlug[l.slug]}
                colour={l.colour}
                view={AI_VIEW}
                position={l.position}
                alt={i === active ? `Model wearing the ${l.label} in ${l.colour} with ${mode === 'custom' ? 'your logo' : 'the EMBLARA logo'} (illustrative)` : ''}
                eager={i < 2}
              />
            </div>
          ))}
          <span className="tryon__scan" ref={scan} aria-hidden="true" />
        </div>
      </div>

      <div className="tryon__info" aria-live="polite">
        <p className="tryon__count">
          <span>{String(active + 1).padStart(2, '0')}</span> / {String(n).padStart(2, '0')}
        </p>
        <p className="tryon__name">{look.label}</p>
        <p className="tryon__meta">
          {look.colour} · from {gbp(product.price)}
        </p>
        <a className="pill pill--copper" href={`#/product/${look.slug}`}>
          Shop this
        </a>
      </div>

      <div className="tryon__controls" role="group" aria-label="Choose a garment" onKeyDown={onKeyDown}>
        <button type="button" className="tryon__arrow" onClick={() => go(active - 1)} aria-label="Previous garment">←</button>
        <div className="tryon__dots">
          {looks.map((l, i) => (
            <button
              key={`${l.slug}-${l.colour}`}
              type="button"
              className="tryon__dot"
              aria-label={`${l.label}, ${l.colour}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => go(i)}
              style={{ '--c': l.hex }}
            />
          ))}
        </div>
        <button type="button" className="tryon__arrow" onClick={() => go(active + 1)} aria-label="Next garment">→</button>
      </div>

      <p className="tryon__hint" aria-hidden="true">Scroll to change the kit</p>
    </section>
  );
}
