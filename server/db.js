// Data access. One interface, two backends: Supabase (PostgREST over fetch,
// service-role key, server only) and a local JSON file for the offline demo.
// The browser never talks to the database. RLS is on in Supabase as well, so even
// a leaked anon key can read only published, available products.
//
// Shared Supabase project: this store uses its own schema (default `emblara`,
// selected with the Accept-Profile / Content-Profile headers) and its own Storage
// bucket (default `emblara-products`).

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toRow } from '../src/lib/catalogue.js';
import { seedProducts } from '../src/data/catalogue-seed.js';
import { config } from './config.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const orderNumber = () => 'EM-' + [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
const now = () => new Date().toISOString();

// Orders the dashboard may see: payment confirmed by a verified Stripe webhook.
// Filter values are fulfillment states.
const FULFILMENTS = ['unfulfilled', 'processing', 'fulfilled'];

// ---------------------------------------------------------------- Supabase
function supabase({ url, key, schema, bucket }) {
  const call = async (p, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(`${url}${p}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers },
      body,
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${p.split('?')[0]} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res;
  };
  const rest = async (p, { method = 'GET', body, prefer = 'return=representation' } = {}) => {
    const res = await call(`/rest/v1/${p}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Prefer: prefer, 'Accept-Profile': schema, 'Content-Profile': schema },
    });
    return res.status === 204 ? null : res.json();
  };
  const eq = (v) => `eq.${encodeURIComponent(v)}`;
  const one = (rows) => rows?.[0] ?? null;
  const publicPrefix = `${url}/storage/v1/object/public/${bucket}/`;

  return {
    kind: 'supabase',
    imagePrefixes: () => [publicPrefix],
    // publicOnly = what a visitor may see: published AND available (same rule as the RLS policy).
    async listProducts({ publicOnly } = {}) {
      return rest(`products?select=*&order=sort.asc,name.asc${publicOnly ? '&published=eq.true&available=eq.true' : ''}`);
    },
    async getProduct(id) {
      return one(await rest(`products?select=*&id=${eq(id)}`));
    },
    async saveProduct(row, id) {
      if (id) return one(await rest(`products?id=${eq(id)}`, { method: 'PATCH', body: row }));
      return one(await rest('products', { method: 'POST', body: row }));
    },
    async seedIfEmpty() {
      const have = await rest('products?select=id&limit=1');
      if (have.length) return false;
      await rest('products', { method: 'POST', body: seedProducts.map((p, i) => ({ ...toRow(p, i), published: true })) });
      return true;
    },
    async createOrder(order, items) {
      const created = one(await rest('orders', { method: 'POST', body: order }));
      try {
        await rest('order_items', { method: 'POST', body: items.map((i) => ({ ...i, order_id: created.id })), prefer: 'return=minimal' });
      } catch (err) {
        // Roll back our own half-written order (a pending row we just created).
        await rest(`orders?id=${eq(created.id)}&payment_status=eq.pending`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
        throw err;
      }
      return created;
    },
    async getOrder({ id, sessionId }) {
      return one(await rest(`orders?select=*&${id ? `id=${eq(id)}` : `stripe_session_id=${eq(sessionId)}`}`));
    },
    async orderItems(orderId) {
      return rest(`order_items?select=*&order_id=${eq(orderId)}&order=created_at.asc`);
    },
    // `when` makes the update conditional (compare-and-set), e.g. { payment_status: 'pending' }.
    async patchOrder(id, patch, when = {}) {
      const cond = Object.entries(when).map(([k, v]) => `&${k}=${eq(v)}`).join('');
      return one(await rest(`orders?id=${eq(id)}${cond}`, { method: 'PATCH', body: patch }));
    },
    async listOrders(fulfilments = FULFILMENTS) {
      return rest(`orders?select=*&payment_status=eq.paid&fulfillment_status=in.(${fulfilments.join(',')})&order=paid_at.desc.nullslast&limit=200`);
    },
    // Authorised staff: a row in <schema>.staff for this Supabase Auth user id.
    async isStaff(userId) {
      return (await rest(`staff?select=user_id&user_id=${eq(userId)}`)).length > 0;
    },
    async storeImage(buf, name, contentType) {
      await call(`/storage/v1/object/${bucket}/${name}`, { method: 'POST', body: buf, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } });
      return `${publicPrefix}${name}`;
    },
  };
}

// ------------------------------------------------------------- local file
function local() {
  const dir = path.resolve(process.env.STORE_DATA_DIR || path.join(process.cwd(), '.data'));
  const file = path.join(dir, 'store.json');
  let cache = null;

  const load = async () => {
    if (cache) return cache;
    try {
      cache = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      cache = { products: [], orders: [], items: [] };
    }
    if (cache.products.length === 0) {
      cache.products = seedProducts.map((p, i) => ({ id: randomUUID(), ...toRow(p, i), published: true, created_at: now(), updated_at: now() }));
      await save();
    }
    return cache;
  };
  const save = async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(cache, null, 2));
    await rename(`${file}.tmp`, file);
  };
  const clone = (x) => (x ? structuredClone(x) : null);

  return {
    kind: 'local',
    imagePrefixes: () => ['/api/uploads/'],
    async listProducts({ publicOnly } = {}) {
      const { products } = await load();
      return clone(products.filter((p) => !publicOnly || (p.published && p.available)).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)));
    },
    async getProduct(id) {
      return clone((await load()).products.find((p) => p.id === id));
    },
    async saveProduct(row, id) {
      const db = await load();
      if (id) {
        const i = db.products.findIndex((p) => p.id === id);
        if (i < 0) return null;
        db.products[i] = { ...db.products[i], ...row, id, updated_at: now() };
        await save();
        return clone(db.products[i]);
      }
      if (db.products.some((p) => p.slug === row.slug)) throw new Error('duplicate key value violates unique constraint "slug"');
      const created = { id: randomUUID(), ...row, created_at: now(), updated_at: now() };
      db.products.push(created);
      await save();
      return clone(created);
    },
    async seedIfEmpty() {
      await load();
      return false;
    },
    async createOrder(order, items) {
      const db = await load();
      // Same defaults the Postgres table applies.
      const created = { id: randomUUID(), payment_status: 'pending', fulfillment_status: 'unfulfilled', ...order, created_at: now(), updated_at: now() };
      db.orders.push(created);
      items.forEach((i) => db.items.push({ id: randomUUID(), ...i, order_id: created.id, created_at: now() }));
      await save();
      return clone(created);
    },
    async getOrder({ id, sessionId }) {
      return clone((await load()).orders.find((o) => (id ? o.id === id : o.stripe_session_id === sessionId)));
    },
    async orderItems(orderId) {
      return clone((await load()).items.filter((i) => i.order_id === orderId));
    },
    async patchOrder(id, patch, when = {}) {
      const db = await load();
      const o = db.orders.find((x) => x.id === id);
      if (!o || Object.entries(when).some(([k, v]) => o[k] !== v)) return null;
      Object.assign(o, patch, { updated_at: now() });
      await save();
      return clone(o);
    },
    async listOrders(fulfilments = FULFILMENTS) {
      const { orders } = await load();
      return clone(
        orders
          .filter((o) => o.payment_status === 'paid' && fulfilments.includes(o.fulfillment_status))
          .sort((a, b) => (b.paid_at ?? b.created_at).localeCompare(a.paid_at ?? a.created_at)),
      );
    },
    async isStaff() {
      return false; // local mode signs in with DEMO_STAFF_* (see auth.js)
    },
    async storeImage(buf, name) {
      await mkdir(path.join(dir, 'uploads'), { recursive: true });
      await writeFile(path.join(dir, 'uploads', name), buf);
      return `/api/uploads/${name}`;
    },
    async readUpload(name) {
      return readFile(path.join(dir, 'uploads', name));
    },
  };
}

let backend = null;
let backendKey = '';
export function db() {
  const cfg = config();
  const key = cfg.supabase ? `${cfg.supabase.url}|${cfg.supabase.key}|${cfg.supabase.schema}|${cfg.supabase.bucket}` : 'local';
  if (!backend || backendKey !== key) {
    backend = cfg.supabase ? supabase(cfg.supabase) : local();
    backendKey = key;
  }
  return backend;
}
