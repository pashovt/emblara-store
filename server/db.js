// Data access. One interface, two backends: Supabase (PostgREST over fetch,
// service-role key, server only) and a local JSON file for the offline demo.
// The browser never talks to the database; RLS is on with no policies.

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toRow } from '../src/lib/catalogue.js';
import { seedProducts } from '../src/data/catalogue-seed.js';
import { config } from './config.js';

const BUCKET = 'store-images';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const orderNumber = () => 'EM-' + [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- Supabase
function supabase({ url, key }) {
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
      headers: { 'Content-Type': 'application/json', Prefer: prefer },
    });
    return res.status === 204 ? null : res.json();
  };
  const eq = (v) => `eq.${encodeURIComponent(v)}`;
  const one = (rows) => rows?.[0] ?? null;

  return {
    kind: 'supabase',
    imagePrefixes: () => [`${url}/storage/v1/object/public/${BUCKET}/`],
    async listProducts({ publishedOnly } = {}) {
      return rest(`store_products?select=*&order=sort.asc,name.asc${publishedOnly ? '&published=eq.true' : ''}`);
    },
    async getProduct(id) {
      return one(await rest(`store_products?select=*&id=${eq(id)}`));
    },
    async saveProduct(row, id) {
      if (id) return one(await rest(`store_products?id=${eq(id)}`, { method: 'PATCH', body: { ...row, updated_at: now() } }));
      return one(await rest('store_products', { method: 'POST', body: row }));
    },
    async seedIfEmpty() {
      const have = await rest('store_products?select=id&limit=1');
      if (have.length) return false;
      await rest('store_products', { method: 'POST', body: seedProducts.map((p, i) => toRow(p, i)) });
      return true;
    },
    async createOrder(order, items) {
      const created = one(await rest('store_orders', { method: 'POST', body: order }));
      try {
        await rest('store_order_items', { method: 'POST', body: items.map((i) => ({ ...i, order_id: created.id })), prefer: 'return=minimal' });
      } catch (err) {
        await rest(`store_orders?id=${eq(created.id)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
        throw err;
      }
      return created;
    },
    async getOrder({ id, sessionId }) {
      return one(await rest(`store_orders?select=*&${id ? `id=${eq(id)}` : `stripe_session_id=${eq(sessionId)}`}`));
    },
    async orderItems(orderId) {
      return rest(`store_order_items?select=*&order_id=${eq(orderId)}&order=created_at.asc`);
    },
    async patchOrder(id, patch, { ifStatus } = {}) {
      const filter = `id=${eq(id)}${ifStatus ? `&status=${eq(ifStatus)}` : ''}`;
      return one(await rest(`store_orders?${filter}`, { method: 'PATCH', body: { ...patch, updated_at: now() } }));
    },
    async listOrders(statuses) {
      return rest(`store_orders?select=*&status=in.(${statuses.join(',')})&order=paid_at.desc.nullslast,created_at.desc&limit=200`);
    },
    async isStaff(email) {
      return (await rest(`store_staff?select=email&email=${eq(email.toLowerCase())}`)).length > 0;
    },
    async storeImage(buf, name, contentType) {
      await call(`/storage/v1/object/${BUCKET}/${name}`, { method: 'POST', body: buf, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } });
      return `${url}/storage/v1/object/public/${BUCKET}/${name}`;
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
      cache.products = seedProducts.map((p, i) => ({ id: randomUUID(), ...toRow(p, i), created_at: now(), updated_at: now() }));
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
    async listProducts({ publishedOnly } = {}) {
      const { products } = await load();
      return clone(products.filter((p) => !publishedOnly || p.published).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)));
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
      const created = { id: randomUUID(), ...order, created_at: now(), updated_at: now() };
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
    async patchOrder(id, patch, { ifStatus } = {}) {
      const db = await load();
      const o = db.orders.find((x) => x.id === id);
      if (!o || (ifStatus && o.status !== ifStatus)) return null;
      Object.assign(o, patch, { updated_at: now() });
      await save();
      return clone(o);
    },
    async listOrders(statuses) {
      const { orders } = await load();
      return clone(orders.filter((o) => statuses.includes(o.status)).sort((a, b) => (b.paid_at ?? b.created_at).localeCompare(a.paid_at ?? a.created_at)));
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
  const key = cfg.supabase ? `${cfg.supabase.url}|${cfg.supabase.key}` : 'local';
  if (!backend || backendKey !== key) {
    backend = cfg.supabase ? supabase(cfg.supabase) : local();
    backendKey = key;
  }
  return backend;
}
