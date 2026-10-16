// The storefront catalogue. Everything comes from /api/products (loadCatalogue, called once
// before the app renders), which returns ONLY products that are published AND available.
// Nothing is bundled into the browser, so there is no list to fall back to: a draft,
// unpublished or unavailable product is simply never present here, and a direct link to
// one renders "not found".
//
// `products`, `bySlug` are exported as live objects and are refilled in place, so every
// page that imports them sees the loaded range.
//
// Prices here are for DISPLAY. The order total is always recalculated on the server from the
// stored product data (server/checkout.js).

import { categories, fromRow } from '../lib/catalogue.js';
import { unitPrice } from '../lib/pricing.js';
import aiShots from './ai-shots.json';

export { categories };
export const products = [];
export const bySlug = {};

function hydrate(p) {
  if (p.service) return p;
  // The owner's AI model shot (06-AI-Models), when there is one. The product
  // opens on that colour, finish and logo position so the first photo is it.
  p.ai = aiShots[p.slug] ?? null;
  if (p.ai) {
    p.colours = [...p.colours.filter((c) => c.name === p.ai.colour), ...p.colours.filter((c) => c.name !== p.ai.colour)];
    p.methods = [...p.methods.filter((m) => m.id === p.ai.method), ...p.methods.filter((m) => m.id !== p.ai.method)];
  }
  p.method = p.methods.map((m) => m.label).join(' or ');
  // Lowest price for one piece, for "from £x" labels.
  p.price = Math.min(...p.methods.map((m) => unitPrice(p, { method: m.id, qty: 1 })));
  return p;
}

export function applyCatalogue(list) {
  const next = list.map(hydrate).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  products.splice(0, products.length, ...next);
  Object.keys(bySlug).forEach((k) => delete bySlug[k]);
  products.forEach((p) => {
    bySlug[p.slug] = p;
  });
}

// Resolves true when the live catalogue loaded (an empty shop is still a loaded shop).
export async function loadCatalogue() {
  try {
    const res = await fetch('/api/products', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const data = res.ok && res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    if (Array.isArray(data?.products)) {
      applyCatalogue(data.products.map((row) => fromRow(row)));
      return true;
    }
  } catch {
    /* handled below */
  }
  return false;
}

// Short fabric tag for a colour, e.g. '100% cotton' or '50/50 cotton-poly'.
export const materialFor = (product, colour) => product.materialByColour?.[colour] ?? product.material;

// The logo position a product shows by default.
export const defaultPosition = (product) => product.ai?.position ?? product.methods?.[0].positions[0].label ?? '';
