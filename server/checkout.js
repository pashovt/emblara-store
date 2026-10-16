// The trusted checkout path. The browser sends ONLY: product id, finish,
// colour, size, logo position, quantity (+ logo file name and notes). Nothing
// about money. Every price here is recomputed from the stored product rows with
// the same pricing model the storefront uses for display.

import { fromRow } from '../src/lib/catalogue.js';
import { quote } from '../src/lib/pricing.js';
import { HttpError } from './http.js';
import { db } from './db.js';

const pence = (n) => Math.round(n * 100);
// eslint-disable-next-line no-control-regex
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

const describe = (o) => [o.method, o.colour, o.size, o.position].filter(Boolean).join(' · ');

// -> { lines: [{ product, options, quantity, unit_pence, line_pence, title }], total_pence }
export async function priceCart(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 40) throw new HttpError(400, 'Your bag is empty or too large.');

  const resolved = [];
  const problems = [];
  const refusedIds = [];
  for (const raw of rawItems) {
    const qty = Number(raw?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) throw new HttpError(400, 'Invalid quantity.');
    const row = typeof raw?.productId === 'string' ? await db().getProduct(raw.productId) : null;
    if (!row || !row.published) {
      problems.push('A product in your bag is no longer sold.');
      refusedIds.push(String(raw?.productId));
      continue;
    }
    const product = fromRow(row);
    if (!product.available) {
      problems.push(`${product.name} is currently unavailable.`);
      refusedIds.push(product.id);
      continue;
    }
    resolved.push({ raw, qty, product });
  }
  if (problems.length) throw new HttpError(409, [...new Set(problems)].join(' '), { unavailable: true, productIds: [...new Set(refusedIds)] });

  const garments = [];
  const lines = resolved.map(({ raw, qty, product }) => {
    const logoName = clean(raw.logoName, 120);
    if (product.service) {
      if (qty > 20) throw new HttpError(400, 'Invalid quantity.');
      return { product, quantity: qty, options: { logoName }, unit_pence: pence(product.price), line_pence: pence(product.price) * qty, title: product.name };
    }
    const method = product.methods.find((m) => m.id === raw.method);
    if (!method) throw new HttpError(400, `Invalid finish for ${product.name}.`);
    if (!product.colours.some((c) => c.name === raw.colour)) throw new HttpError(400, `Invalid colour for ${product.name}.`);
    if (!method.sizes.some((s) => s.label === raw.size)) throw new HttpError(400, `Invalid size for ${product.name}.`);
    if (!method.positions.some((p) => p.label === raw.position)) throw new HttpError(400, `Invalid logo position for ${product.name}.`);
    const options = { method: method.label, methodId: method.id, colour: raw.colour, size: raw.size, position: raw.position, logoName };
    const line = { product, quantity: qty, options, title: product.name };
    garments.push(line);
    return line;
  });

  if (garments.length) {
    // One order, one price: delivery follows the most expensive garment (see pricing.js).
    const q = quote(garments.map((l) => ({ product: l.product, method: l.options.methodId, size: l.options.size, position: l.options.position, qty: l.quantity })));
    garments.forEach((l, i) => {
      l.line_pence = pence(q.lines[i].total);
      l.unit_pence = Math.round(l.line_pence / l.quantity);
    });
  }

  const total_pence = lines.reduce((n, l) => n + l.line_pence, 0);
  if (!(total_pence > 0) || total_pence > 5_000_000) throw new HttpError(400, 'This order cannot be checked out online. Contact us.');
  return { lines, total_pence };
}

export const lineDescription = (l) => (l.options.method ? `${describe(l.options)}${l.options.logoName ? ` · Logo: ${l.options.logoName}` : ''}` : l.options.logoName ? `Logo: ${l.options.logoName}` : '');
export const cleanText = clean;
