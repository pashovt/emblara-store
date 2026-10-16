// Product rows <-> the shapes the storefront and the pricing model use.
// Pure functions, shared by the browser (hydrating the API response) and the
// server (validating dashboard input and building a checkout from trusted data).

import { retailAdd } from './pricing.js';

export const CATEGORIES = ['polos', 'tees', 'sweats', 'services'];
export const METHOD_IDS = { print: 'Printed', embroidery: 'Embroidered' };

const opt = (o) => ({ label: o.label, cost: o.cost ?? 0, add: o.cost ? retailAdd(o.cost) : 0 });

// A stored row (what the products table holds) -> the product object the UI uses.
export function fromRow(row) {
  const c = row.config ?? {};
  const base = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    blurb: row.blurb ?? '',
    material: row.material || undefined,
    fabric: row.fabric || undefined,
    specs: c.specs ?? [],
    images: row.images ?? [],
    available: row.available !== false,
    published: row.published !== false,
    sort: row.sort ?? 0,
  };
  if (row.kind === 'service') {
    return { ...base, service: true, price: row.price_pence / 100, colours: [], method: 'Service' };
  }
  return {
    ...base,
    materialByColour: c.materialByColour,
    fabricByColour: c.fabricByColour,
    ship: c.ship,
    colours: c.colours ?? [],
    methods: (c.methods ?? []).map((m) => ({
      id: m.id,
      label: METHOD_IDS[m.id] ?? m.label,
      base: m.base,
      digitised: m.id === 'embroidery',
      sizes: m.sizes.map(opt),
      positions: m.positions.map(opt),
    })),
  };
}

// A seed product (src/data/catalogue-seed.js) -> a row without id/timestamps.
export function toRow(p, sort = 0) {
  if (p.service) {
    return { slug: p.slug, name: p.name, category: p.category, kind: 'service', blurb: p.blurb, material: null, fabric: null, price_pence: Math.round(p.price * 100), config: { specs: p.specs }, images: [], published: true, available: true, sort };
  }
  return {
    slug: p.slug, name: p.name, category: p.category, kind: 'garment', blurb: p.blurb,
    material: p.material ?? null, fabric: p.fabric ?? null, price_pence: null,
    config: {
      specs: p.specs, ship: p.ship, colours: p.colours,
      materialByColour: p.materialByColour, fabricByColour: p.fabricByColour,
      methods: p.methods.map((m) => ({
        id: m.id, base: m.base,
        sizes: m.sizes.map(({ label, cost }) => ({ label, cost })),
        positions: m.positions.map(({ label, cost }) => ({ label, cost })),
      })),
    },
    images: [], published: true, available: true, sort,
  };
}

// ---------- validation of dashboard input ----------
class Invalid extends Error {}
export const isInvalid = (e) => e instanceof Invalid;
const bad = (msg) => {
  throw new Invalid(msg);
};

const str = (v, label, { min = 0, max = 200 } = {}) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min) bad(`${label} is required.`);
  if (s.length > max) bad(`${label} is too long (max ${max}).`);
  return s;
};
const num = (v, label, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) bad(`${label} must be a number from ${min} to ${max}.`);
  return Math.round(n * 100) / 100;
};
const list = (v, label, max) => {
  if (!Array.isArray(v) || v.length > max) bad(`${label}: at most ${max} entries.`);
  return v;
};

const options = (v, label, max) =>
  list(v, label, max).map((o) => ({ label: str(o?.label, `${label} name`, { min: 1, max: 30 }), cost: num(o?.cost ?? 0, `${label} cost`, 0, 100) }));

// `input` comes from the dashboard form; returns a clean row (no id/timestamps).
// `imagePrefixes` limits where images may be served from (our own uploads only).
export function parseProductInput(input, imagePrefixes) {
  if (!input || typeof input !== 'object') bad('Missing product.');
  const kind = input.kind === 'service' ? 'service' : 'garment';
  const slug = str(input.slug, 'Slug', { min: 2, max: 60 }).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) bad('Slug may use lowercase letters, numbers and single hyphens.');
  const category = kind === 'service' ? 'services' : input.category;
  if (!CATEGORIES.includes(category) || (kind === 'garment' && category === 'services')) bad('Pick a category.');

  const images = list(input.images ?? [], 'Images', 8).map((u) => {
    if (typeof u !== 'string' || !imagePrefixes.some((p) => u.startsWith(p)) || u.length > 500) bad('Images must be uploaded through the dashboard.');
    return u;
  });

  const row = {
    slug, kind, category, images,
    name: str(input.name, 'Name', { min: 2, max: 80 }),
    blurb: str(input.blurb, 'Description', { min: 1, max: 600 }),
    published: input.published === true,
    available: input.available !== false,
    sort: Math.round(num(input.sort ?? 0, 'Order', 0, 1000)),
  };
  const specs = list(input.specs ?? [], 'Spec points', 8).map((s) => str(s, 'Spec point', { min: 1, max: 120 }));

  if (kind === 'service') {
    return { ...row, material: null, fabric: null, price_pence: Math.round(num(input.price, 'Price', 0.5, 1000) * 100), config: { specs } };
  }

  const colours = list(input.colours, 'Colours', 12).map((c) => {
    const hex = str(c?.hex, 'Colour hex', { min: 4, max: 7 });
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) bad(`Colour ${c?.name ?? ''}: use a hex like #1d2840.`);
    return { name: str(c?.name, 'Colour name', { min: 1, max: 30 }), hex: hex.toLowerCase() };
  });
  if (colours.length === 0) bad('Add at least one colour.');
  if (new Set(colours.map((c) => c.name)).size !== colours.length) bad('Colour names must be different.');

  const methods = list(input.methods, 'Finishes', 2).map((m) => {
    if (!METHOD_IDS[m?.id]) bad('Finish must be printed or embroidered.');
    const sizes = options(m.sizes, 'Sizes', 12);
    const positions = options(m.positions, 'Positions', 8);
    if (!sizes.length || !positions.length) bad(`${METHOD_IDS[m.id]}: add at least one size and one position.`);
    return { id: m.id, base: num(m.base, `${METHOD_IDS[m.id]} garment cost`, 0, 500), sizes, positions };
  });
  if (methods.length === 0) bad('Offer at least one finish.');
  if (new Set(methods.map((m) => m.id)).size !== methods.length) bad('Each finish can only be listed once.');

  const ship = { first: num(input.ship?.first, 'First-item delivery cost', 0, 100), extra: num(input.ship?.extra, 'Extra-item delivery cost', 0, 100) };
  return {
    ...row,
    material: str(input.material ?? '', 'Material', { max: 60 }) || null,
    fabric: str(input.fabric ?? '', 'Fabric', { max: 200 }) || null,
    price_pence: null,
    config: { specs, ship, colours, methods },
  };
}
