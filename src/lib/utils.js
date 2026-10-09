import { useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { breaks } from '../data/site.js';

gsap.registerPlugin(ScrollTrigger);

export const gbp = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

export const motionOK = () =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- pricing ----------
// Index of the price break a quantity falls in (0 = 1 piece … 5 = 50+).
export const breakIndex = (qty) => breaks.reduce((hit, b, i) => (qty >= b.min ? i : hit), 0);

// Pricing itself lives in pricing.js (order-level, most expensive item sets delivery).

// ---------- hash router ----------
// Routes: #/ (home), #/shop, #/shop/<category>, #/product/<slug>, #/checkout,
// #/process and #/mockup (home sections).
const parse = () => {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [page = 'home', param] = parts;
  if (page === 'process' || page === 'mockup') return { page: 'home', section: page };
  return { page, param };
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

// ---------- smooth scroll ----------
let lenis = null;

export function useSmoothScroll() {
  useEffect(() => {
    if (!motionOK()) return undefined;
    lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
}

export function scrollToY(y, immediate = false) {
  if (lenis) lenis.scrollTo(y, { immediate });
  else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -80 });
  else el.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto' });
}

export function setScrollLock(locked) {
  if (lenis && locked) lenis.stop();
  else if (lenis) lenis.start();
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}
