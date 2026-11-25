import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { marquee, gallery, process } from '../data/site.js';
import TryOnHero from '../components/TryOnHero.jsx';
import { Cms, CmsProvider, useCopy } from '../lib/agencyCms/Cms.jsx';
import { statementWords } from '../lib/agencyCms/fields.js';
import { bySlug, products } from '../data/products.js';
import { Garment, Marquee, ProductCard, ThreadLines } from '../components/ui.jsx';

gsap.registerPlugin(ScrollTrigger);

const DESKTOP = '(min-width: 960px) and (prefers-reduced-motion: no-preference)';
const ANY = '(prefers-reduced-motion: no-preference)';

function HomeContent() {
  const root = useRef(null);
  const copy = useCopy();
  const words = statementWords(copy['promise-statement']);

  useLayoutEffect(() => {
    let ctx;
    try {
      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        const q = gsap.utils.selector(root);

        // Running stitch sewn across the marquee.
        mm.add(ANY, () => {
          gsap.fromTo(
            q('.stitch__reveal'),
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: q('.stitch')[0], start: 'top 75%', end: 'bottom 30%', scrub: 0.6 } },
          );
        });

        // Gallery parallax.
        mm.add(DESKTOP, () => {
          q('.gallery__item').forEach((el) => {
            gsap.fromTo(
              el,
              { y: 0 },
              { y: Number(el.dataset.speed), ease: 'none', scrollTrigger: { trigger: q('.gallery')[0], start: 'top bottom', end: 'bottom top', scrub: true } },
            );
          });
        });

        // Section reveals.
        mm.add(ANY, () => {
          q('[data-reveal]').forEach((el) => {
            gsap.from(el, { opacity: 0, y: 40, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
          });
        });
      }, root);
    } catch (err) {
      console.warn('Animations disabled:', err);
    }
    return () => ctx?.revert();
  }, []);

  // Statement lights up word by word. Kept separate so edited text keeps its animation: it is rebuilt only when the number of
  // words changes (the animation targets one element per word), and the rest of the page's animation is left alone.
  useLayoutEffect(() => {
    let ctx;
    try {
      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        const q = gsap.utils.selector(root);
        mm.add(ANY, () => {
          gsap.fromTo(
            q('.statement__word'),
            { opacity: 0.16 },
            { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: q('.statement')[0], start: 'top 70%', end: 'bottom 70%', scrub: 0.5 } },
          );
        });
      }, root);
    } catch (err) {
      console.warn('Animations disabled:', err);
    }
    return () => ctx?.revert();
  }, [words.length]);

  const featured = ['mens-polo', 'womens-polo', 'printed-polo', 'heavy-cotton-tee', 'logo-hoodie', 'crew-sweatshirt']
    .map((s) => products.find((p) => p.slug === s))
    .filter(Boolean);

  return (
    <div ref={root}>
      <TryOnHero />

      {/* ---------- stitched marquee ---------- */}
      <section className="stitch" aria-label="What we do">
        <Marquee items={marquee.top} />
        <Marquee items={marquee.bottom} reverse className="marquee--copper" />
        <svg className="stitch__svg" viewBox="0 0 1440 520" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <mask id="stitch-mask">
              <path className="stitch__reveal" d="M-40 360 C 180 120, 360 120, 470 300 S 700 470, 820 240 S 1020 40, 1120 260 S 1320 440, 1500 160" pathLength="1" />
            </mask>
          </defs>
          <path className="stitch__thread" d="M-40 360 C 180 120, 360 120, 470 300 S 700 470, 820 240 S 1020 40, 1120 260 S 1320 440, 1500 160" mask="url(#stitch-mask)" />
        </svg>
      </section>

      {/* ---------- statement ---------- */}
      <section className="statement" aria-label="Our promise">
        <ThreadLines className="threads--dark" />
        <Cms as="p" field="promise-eyebrow" className="eyebrow eyebrow--center" />
        <p className="statement__text">
          {words.map(([w, serif], i) => (
            <span key={i} className={`statement__word${serif ? ' statement__word--serif' : ''}`}>
              {w}{' '}
            </span>
          ))}
        </p>
      </section>

      {/* ---------- featured products ---------- */}
      <section className="featured" aria-labelledby="featured-title">
        <div className="section-head" data-reveal>
          <Cms as="p" field="range-eyebrow" className="eyebrow" />
          <Cms as="h2" field="range-title" emphasis id="featured-title" className="h2" />
          <Cms as="a" field="range-cta" className="pill pill--ghost-dark" href="#/shop" />
        </div>
        <div className="grid">
          {featured.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* ---------- editorial gallery ---------- */}
      <section className="gallery" aria-label="Logos in place">
        <ThreadLines className="threads--stone" />
        <blockquote className="gallery__quote" data-reveal>
          <Cms as="p" field="quote-text" emphasis />
          <Cms as="footer" field="quote-footer" />
        </blockquote>
        <div className="gallery__row">
          {gallery.filter((g) => bySlug[g.slug]).map((g) => (
            <a key={g.caption} className="gallery__item" href={`#/product/${g.slug}`} style={{ '--col': g.col, '--span': g.span, '--drop': `${g.drop}rem` }} data-speed={g.speed}>
              <span className="gallery__cap">{g.caption}</span>
              <Garment product={bySlug[g.slug]} view={g.view} position={g.position} />
            </a>
          ))}
        </div>
      </section>

      {/* ---------- process ---------- */}
      <section className="process" id="process" aria-labelledby="process-title">
        <div className="section-head section-head--light" data-reveal>
          <Cms as="p" field="process-eyebrow" className="eyebrow" />
          <Cms as="h2" field="process-title" emphasis id="process-title" className="h2" />
        </div>
        <ol className="steps">
          {process.map((s, i) => (
            <li key={s.title} className="step" data-reveal>
              <span className="step__num">{String(i + 1).padStart(2, '0')}</span>
              <Cms as="h3" field={`step-${i + 1}-title`} className="step__title" />
              <Cms as="p" field={`step-${i + 1}-body`} className="step__body" />
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- mock-up CTA ---------- */}
      <section className="cta" id="mockup" aria-labelledby="cta-title">
        <ThreadLines className="threads--light" />
        <Cms as="h2" field="cta-title" emphasis id="cta-title" className="cta__title" data-reveal />
        <Cms as="p" field="cta-sub" className="cta__sub" data-reveal />
        <div className="cta__actions" data-reveal>
          <Cms as="a" field="cta-button" className="pill pill--copper pill--lg" href="#/shop" />
        </div>
      </section>
    </div>
  );
}

// The CMS text supplier wraps only this page. With the CMS switched off it just hands back the store's own text.
export default function Home() {
  return (
    <CmsProvider>
      <HomeContent />
    </CmsProvider>
  );
}
