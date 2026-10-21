// Data access. One interface, two backends: Neon Postgres (pg, two least-privilege
// roles) with Neon Object Storage for photos, and a local JSON file for the offline demo.
// The browser never talks to the database.
//
// Postgres backend: every statement runs in a transaction that first sets
//   emblara.flow / emblara.staff_id   (from server/context.js)
// and the row-level-security policies in db/migrations/001_emblara_store.sql check them.
// Public catalogue reads use a SEPARATE read-only role, so a visitor's request can never
// reach orders or unpublished products, whatever the application code does.

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toRow } from '../src/lib/catalogue.js';
import { seedProducts } from '../src/data/catalogue-seed.js';
import pg from 'pg';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from './config.js';
import { context } from './context.js';
import { strictSsl } from './pg-url.js';
import { HttpError } from './http.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const orderNumber = () => 'EM-' + [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
const now = () => new Date().toISOString();

// Orders the dashboard may see: payment confirmed by a verified Stripe webhook.
// Filter values are fulfillment states.
const FULFILMENTS = ['unfulfilled', 'processing', 'fulfilled'];

// ---------------------------------------------------------------- Postgres
const pools = new Map();
const poolFor = (url) => {
  if (!pools.has(url)) pools.set(url, new pg.Pool({ connectionString: strictSsl(url), max: 5 }));
  return pools.get(url);
};

const PRODUCT_COLS = ['slug', 'name', 'category', 'kind', 'blurb', 'material', 'fabric', 'price_pence', 'config', 'images', 'published', 'available', 'sort'];
const JSONB = new Set(['config', 'images']);
const ORDER_SET = new Set(['payment_status', 'fulfillment_status', 'paid_at', 'stripe_session_id', 'stripe_payment_intent', 'email', 'customer_name', 'phone', 'shipping']);
const ORDER_WHEN = new Set(['payment_status', 'fulfillment_status']);

function postgres({ appUrl, publicUrl, portalUrl, bucket, endpoint, region }) {
  const base = `${endpoint}/${bucket}/`;
  const toUrl = (key) => (key.startsWith('http') ? key : `${base}${key}`);
  const toKey = (url) => (url.startsWith(base) ? url.slice(base.length) : url);
  const outProduct = (r) => (r ? { ...r, images: (r.images ?? []).map(toUrl) } : r);

  // One transaction, with the request context handed to the RLS policies.
  async function tx(url, fn) {
    const { flow, staffId } = context();
    const client = await poolFor(url).connect();
    try {
      await client.query('begin');
      await client.query("select set_config('emblara.flow', $1, true), set_config('emblara.staff_id', $2, true)", [flow ?? '', staffId ?? '']);
      const out = await fn(client);
      await client.query('commit');
      return out;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  const app = (fn) => tx(appUrl, fn);
  const portal = (fn) => {
    if (!portalUrl) throw new HttpError(503, 'The back office needs the database.');
    return tx(portalUrl, fn);
  };

  const s3 = new S3Client({ region, endpoint, forcePathStyle: true }); // credentials: AWS_* env

  return {
    kind: 'postgres',
    portal,
    imagePrefixes: () => [`${base}products/`],

    async listProducts({ publicOnly } = {}) {
      if (publicOnly) {
        const { rows } = await tx(publicUrl, (c) =>
          // No WHERE needed: this role can only ever see published AND available rows (RLS).
          c.query('select id, slug, name, category, kind, blurb, material, fabric, price_pence, config, images, available, sort from emblara.products order by sort, name'),
        );
        return rows.map((r) => outProduct({ ...r, published: true }));
      }
      return (await app((c) => c.query('select * from emblara.products order by sort, name'))).rows.map(outProduct);
    },
    async getProduct(id) {
      if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
      return outProduct((await app((c) => c.query('select * from emblara.products where id = $1', [id]))).rows[0] ?? null);
    },
    async saveProduct(row, id) {
      const data = { ...row, images: (row.images ?? []).map(toKey) };
      const cols = PRODUCT_COLS.filter((k) => k in data);
      const vals = cols.map((k) => (JSONB.has(k) ? JSON.stringify(data[k]) : data[k]));
      const cast = (k, i) => `$${i + 1}${JSONB.has(k) ? '::jsonb' : ''}`;
      if (id) {
        const set = cols.map((k, i) => `${k} = ${cast(k, i)}`).join(', ');
        const r = await app((c) => c.query(`update emblara.products set ${set} where id = $${cols.length + 1} returning *`, [...vals, id]));
        return outProduct(r.rows[0] ?? null);
      }
      const r = await app((c) => c.query(`insert into emblara.products (${cols.join(', ')}) values (${cols.map(cast).join(', ')}) returning *`, vals));
      return outProduct(r.rows[0]);
    },
    // Seeding runs from scripts/seed-products.mjs with the owner connection.
    async seedIfEmpty() {
      return false;
    },

    // The order and its lines are saved in ONE transaction: both or neither.
    async createOrder(order, items) {
      return app(async (c) => {
        const o = (
          await c.query(
            'insert into emblara.orders (number, currency, amount_total_pence, notes, artwork) values ($1,$2,$3,$4,$5) returning *',
            [order.number, order.currency, order.amount_total_pence, order.notes ?? null, order.artwork ?? null],
          )
        ).rows[0];
        for (const i of items) {
          await c.query(
            'insert into emblara.order_items (order_id, product_id, product_slug, product_name, options, quantity, unit_amount_pence, line_amount_pence) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)',
            [o.id, i.product_id, i.product_slug, i.product_name, JSON.stringify(i.options), i.quantity, i.unit_amount_pence, i.line_amount_pence],
          );
        }
        return o;
      });
    },
    async getOrder({ id, sessionId }) {
      if (id && !/^[0-9a-f-]{36}$/i.test(String(id))) return null;
      const q = id ? ['select * from emblara.orders where id = $1', [id]] : ['select * from emblara.orders where stripe_session_id = $1', [sessionId]];
      return (await app((c) => c.query(...q))).rows[0] ?? null;
    },
    async orderItems(orderId) {
      return (await app((c) => c.query('select * from emblara.order_items where order_id = $1 order by created_at', [orderId]))).rows;
    },
    // `when` makes the update conditional (compare-and-set), e.g. { payment_status: 'pending' }.
    async patchOrder(id, patch, when = {}) {
      const keys = Object.keys(patch).filter((k) => ORDER_SET.has(k));
      const conds = Object.keys(when).filter((k) => ORDER_WHEN.has(k));
      const vals = [...keys.map((k) => (k === 'shipping' ? JSON.stringify(patch[k]) : patch[k])), id, ...conds.map((k) => when[k])];
      const set = keys.map((k, i) => `${k} = $${i + 1}${k === 'shipping' ? '::jsonb' : ''}`).join(', ');
      const where = ['id = $' + (keys.length + 1), ...conds.map((k, i) => `${k} = $${keys.length + 2 + i}`)].join(' and ');
      return (await app((c) => c.query(`update emblara.orders set ${set} where ${where} returning *`, vals))).rows[0] ?? null;
    },
    async listOrders(fulfilments = FULFILMENTS) {
      return (
        await app((c) => c.query("select * from emblara.orders where payment_status = 'paid' and fulfillment_status = any($1) order by paid_at desc nulls last limit 200", [fulfilments]))
      ).rows;
    },

    // Staff. The password is checked inside Postgres; emblara.staff is unreadable to this role.
    async staffLogin(email, password) {
      return (await app((c) => c.query('select emblara.staff_login($1, $2) as id', [email, password]))).rows[0].id ?? null;
    },
    async staffActive(staffId) {
      if (!/^[0-9a-f-]{36}$/i.test(String(staffId))) return false;
      const r = await tx(appUrl, async (c) => {
        await c.query("select set_config('emblara.staff_id', $1, true)", [staffId]);
        return c.query('select emblara.is_staff() as ok');
      });
      return r.rows[0].ok === true;
    },
    async businessProfile() {
      return (await app((c) => c.query('select * from invoicing.business_profile where id = 1'))).rows[0] ?? null;
    },
    async saveBusinessProfile(profile) {
      return (await app((c) => c.query('select * from invoicing.save_business_profile($1::jsonb)', [JSON.stringify(profile)]))).rows[0] ?? null;
    },
    async catalogueItems() {
      return (await app((c) => c.query(`select i.*, l.product_id,
        coalesce((select sum(oi.quantity)::int from emblara.order_items oi join emblara.orders o on o.id=oi.order_id where oi.product_id=l.product_id and o.payment_status='paid' and o.created_at >= date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London'), 0) as ordered_this_month,
        coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'qty_from', p.qty_from, 'unit_price_pence', p.unit_price_pence) order by p.method, p.qty_from) from invoicing.catalogue_prices p where p.item_id=i.id), '[]'::jsonb) as price_tiers
        from invoicing.catalogue_items i left join invoicing.catalogue_product_links l on l.catalogue_item_id=i.id order by i.sort_order, i.name`))).rows;
    },
    async linkCatalogueProduct(productId, itemId) {
      await app((c) => c.query('select invoicing.link_store_product($1, $2)', [productId, itemId]));
    },
    async recordStockMovement({ itemId, type, quantity, note, requestId }) {
      return (await app((c) => c.query('select * from invoicing.record_stock_movement($1, $2::invoicing.stock_movement_type, $3, $4, $5)', [itemId, type, quantity, note, requestId]))).rows[0] ?? null;
    },
    async salesRequests() { return (await app((c) => c.query('select id, reference, status, contact_name, organisation, email, quantity_total, quantity_unsure, needed_by, created_at from quoting.quote_requests order by created_at desc'))).rows; },
    async salesInvoices() { return (await app((c) => c.query("select i.id,i.number,i.status,i.total_pence,i.due_date,i.created_at,c.organisation_name from invoicing.invoices i join invoicing.clients c on c.id=i.client_id order by i.created_at desc"))).rows; },
    async salesClients() { return (await app((c) => c.query('select id, organisation_name, contact_name, email, archived, created_at from invoicing.clients order by organisation_name'))).rows; },
    async createSalesClient(input) { return (await app((c) => c.query('select invoicing.create_client($1::jsonb) as id', [JSON.stringify(input)]))).rows[0].id; },
    async createQuote(requestId) { return (await app((c) => c.query('select quoting.create_quote($1) as id', [requestId]))).rows[0].id; },
    async addQuoteLine(quoteId, line) { await app((c) => c.query('select quoting.add_quote_line($1,$2,$3,$4)', [quoteId, line.description, line.quantity, line.unit_price_pence])); },
    async issueQuote(quoteId, token, ciphertext) { return (await app((c) => c.query('select * from quoting.issue_quote($1,$2,$3)', [quoteId, token, ciphertext]))).rows[0]; },

    async storeImage(buf, name, contentType) {
      const key = `products/${name}`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
      return toUrl(key);
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
    async portal() {
      throw new HttpError(503, 'The back office needs the database.');
    },
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
    async staffLogin() {
      return null; // local mode signs in with DEMO_STAFF_* (see auth.js)
    },
    async staffActive() {
      return false;
    },
    async businessProfile() { throw new HttpError(503, 'The back office needs the database.'); },
    async saveBusinessProfile() { throw new HttpError(503, 'The back office needs the database.'); },
    async catalogueItems() { throw new HttpError(503, 'The back office needs the database.'); },
    async linkCatalogueProduct() { throw new HttpError(503, 'The back office needs the database.'); },
    async recordStockMovement() { throw new HttpError(503, 'The back office needs the database.'); },
    async salesRequests() { throw new HttpError(503, 'The back office needs the database.'); },
    async salesInvoices() { throw new HttpError(503, 'The back office needs the database.'); },
    async salesClients() { throw new HttpError(503, 'The back office needs the database.'); },
    async createSalesClient() { throw new HttpError(503, 'The back office needs the database.'); },
    async createQuote() { throw new HttpError(503, 'The back office needs the database.'); },
    async addQuoteLine() { throw new HttpError(503, 'The back office needs the database.'); },
    async issueQuote() { throw new HttpError(503, 'The back office needs the database.'); },
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
  const key = cfg.neon ? `${cfg.neon.appUrl}|${cfg.neon.publicUrl}|${cfg.neon.portalUrl}|${cfg.neon.bucket}|${cfg.neon.endpoint}` : 'local';
  if (!backend || backendKey !== key) {
    backend = cfg.neon ? postgres(cfg.neon) : local();
    backendKey = key;
  }
  return backend;
}
