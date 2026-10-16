// Store Dashboard API. Every function assumes requireStaff() already passed.

import { randomBytes } from 'node:crypto';
import { isInvalid, parseProductInput } from '../src/lib/catalogue.js';
import { db } from './db.js';
import { HttpError } from './http.js';

// The dashboard shows one status per order: Paid -> Processing -> Fulfilled.
// Underneath, payment and fulfilment are separate columns; only paid orders are visible.
const NEXT = { unfulfilled: 'processing', processing: 'fulfilled' };
const FULFILMENT_OF = { paid: 'unfulfilled', processing: 'processing', fulfilled: 'fulfilled' };
const withStatus = (o) => ({ ...o, status: o.fulfillment_status === 'unfulfilled' ? 'paid' : o.fulfillment_status });
const isVisible = (o) => o?.payment_status === 'paid';

const invalid = (fn) => {
  try {
    return fn();
  } catch (err) {
    if (isInvalid(err)) throw new HttpError(422, err.message);
    throw err;
  }
};

export const listProducts = async () => ({ products: await db().listProducts() });

export async function saveProduct(input, id) {
  const row = invalid(() => parseProductInput(input, db().imagePrefixes()));
  if (id) {
    const existing = await db().getProduct(id);
    if (!existing) throw new HttpError(404, 'Product not found.');
    // Keep per-colour fabric notes the form does not edit, for colours that remain.
    const keep = (k) => {
      const old = existing.config?.[k];
      if (!old || row.kind !== 'garment') return undefined;
      const names = new Set(row.config.colours.map((c) => c.name));
      const kept = Object.fromEntries(Object.entries(old).filter(([c]) => names.has(c)));
      return Object.keys(kept).length ? kept : undefined;
    };
    row.config = { ...row.config, materialByColour: keep('materialByColour'), fabricByColour: keep('fabricByColour') };
  }
  try {
    const saved = await db().saveProduct(row, id);
    if (!saved) throw new HttpError(404, 'Product not found.');
    return { product: saved };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (/duplicate|unique/i.test(err.message)) throw new HttpError(409, 'That slug is already used by another product.');
    throw err;
  }
}

export async function listOrders(statusFilter) {
  const orders = await db().listOrders(FULFILMENT_OF[statusFilter] ? [FULFILMENT_OF[statusFilter]] : undefined);
  return { orders: orders.map(withStatus) };
}

export async function getOrder(id) {
  const order = await db().getOrder({ id });
  if (!isVisible(order)) throw new HttpError(404, 'Order not found.');
  return { order: withStatus(order), items: await db().orderItems(order.id) };
}

// Paid -> Processing -> Fulfilled, one step at a time, never backwards.
export async function advanceOrder(id, to) {
  const order = await db().getOrder({ id });
  if (!isVisible(order)) throw new HttpError(404, 'Order not found.');
  const from = withStatus(order).status;
  if (NEXT[order.fulfillment_status] !== to) throw new HttpError(409, `An order that is ${from} cannot move to ${to}.`);
  // Compare-and-set on both columns: only a paid order moves, and only from the state we just read.
  const updated = await db().patchOrder(id, { fulfillment_status: to }, { payment_status: 'paid', fulfillment_status: order.fulfillment_status });
  if (!updated) throw new HttpError(409, 'The order changed. Reload and try again.');
  return { order: withStatus(updated) };
}

// Images: PNG, JPEG or WebP only, identified by content (not by the claimed type).
const sniff = (b) => {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['png', 'image/png'];
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['jpg', 'image/jpeg'];
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return ['webp', 'image/webp'];
  return null;
};

export async function uploadImage(buf) {
  const kind = sniff(buf);
  if (!kind) throw new HttpError(415, 'Upload a PNG, JPEG or WebP image.');
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${kind[0]}`;
  return { url: await db().storeImage(buf, name, kind[1]) };
}

export async function readUpload(name) {
  if (!/^[a-z0-9]+-[a-f0-9]{12}\.(png|jpg|webp)$/.test(name)) throw new HttpError(404, 'Not found.');
  const ext = name.split('.').pop();
  try {
    return { buf: await db().readUpload(name), type: { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[ext] };
  } catch {
    throw new HttpError(404, 'Not found.');
  }
}
