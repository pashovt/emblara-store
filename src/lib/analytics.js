// Google Analytics 4, loaded only after the visitor accepts. Nothing is requested from
// Google before that, and a Reject (or a withdrawn Accept) stops it again.
//
// The site is a hash-routed SPA, so GA's automatic page view would only see the first
// load. Page views are sent by hand, once per route, from App.jsx via pageview().
import { useEffect, useState } from 'react';

export const GA_ID = 'G-B6MSCZ9TK9';
export const CONSENT_KEY = 'emblara-consent';
export const CONSENT_EVENT = 'emblara-consent';
export const CONSENT_OPEN_EVENT = 'emblara-consent-open';

export const parseConsent = (v) => (v === 'granted' || v === 'denied' ? v : null);

// '#/shop/polos?x=1' -> '/shop/polos'. Query strings never reach GA.
export const routePath = (hash = '') => {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
  return path.startsWith('/') ? path : `/${path}`;
};

// The address GA is told about: origin plus the route, never the query string. The Stripe
// return URL is /?session_id=...#/order-success and keeps that query for the whole visit,
// so this is also set globally (see loadGa) to cover events GA sends on its own.
export const cleanLocation = (origin, hash) => `${origin}${routePath(hash)}`;

// Off in `vite dev`, so local work never counts as a visit.
const enabled = () => typeof window !== 'undefined' && !import.meta.env?.DEV;

export const getConsent = () => {
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
};

let loaded = false;
let lastPath = '';

function loadGa() {
  if (loaded || !enabled()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('set', { page_location: cleanLocation(window.location.origin, window.location.hash) });
  window.gtag('config', GA_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

// GA keeps working for the rest of the page's life once loaded, so withdrawing consent
// flips its documented kill switch and clears its cookies.
function clearGaCookies() {
  const labels = window.location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < labels.length - 1; i += 1) domains.push(`; domain=.${labels.slice(i).join('.')}`);
  document.cookie
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter((name) => name === '_ga' || name.startsWith('_ga_'))
    .forEach((name) => domains.forEach((d) => {
      document.cookie = `${name}=; Max-Age=0; path=/${d}`;
    }));
}

export function setConsent(value) {
  const v = parseConsent(value);
  if (!v) return;
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* choice applies to this page view only */
  }
  if (typeof window === 'undefined') return;
  window[`ga-disable-${GA_ID}`] = v === 'denied';
  if (v === 'denied') {
    lastPath = '';
    clearGaCookies();
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v }));
}

export const openConsent = () => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));

export function useConsent() {
  const [consent, setState] = useState(getConsent);
  useEffect(() => {
    const onChange = (e) => setState(e.detail ?? getConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);
  return consent;
}

// One page_view per route change. The staff dashboard is never tracked.
export function pageview() {
  if (!enabled() || getConsent() !== 'granted') return;
  const path = routePath(window.location.hash);
  if (path.startsWith('/admin') || path === lastPath) return;
  loadGa();
  lastPath = path;
  const page_location = cleanLocation(window.location.origin, window.location.hash);
  window.gtag('set', { page_location });
  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_location,
    page_path: path,
  });
}

// For later events (add_to_cart, purchase, ...). Sends nothing without consent.
export function track(name, params = {}) {
  if (!enabled() || getConsent() !== 'granted') return;
  loadGa();
  window.gtag('event', name, params);
}
