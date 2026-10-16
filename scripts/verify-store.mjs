// Focused verification of the live store in Stripe TEST mode. Uses clearly named test products
// (zz-verify-*), a throwaway staff login and test orders, all removed by the `cleanup` phase.
//   node --env-file=.env.local scripts/verify-store.mjs phase1      everything that needs no payment
//   (pay the printed Stripe test link with test card 4242 4242 4242 4242)
//   node --env-file=.env.local scripts/verify-store.mjs phase2      payment, webhook retry, merchant, edit-after-purchase, secrets
//   node --env-file=.env.local scripts/verify-store.mjs cleanup
// BASE defaults to the production site; no secret is ever printed.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import Stripe from 'stripe';
import { fromRow } from '../src/lib/catalogue.js';
import { quote } from '../src/lib/pricing.js';
import { ownerClient } from './lib/db-owner.mjs';

const BASE = (process.env.VERIFY_BASE || 'https://emblara-store.vercel.app').replace(/\/$/, '');
const STATE = process.env.VERIFY_STATE || '.verify-state.json';
const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_')) throw new Error('Needs the Stripe TEST key (sk_test_...).');
const stripe = new Stripe(key);
const phase = process.argv[2];

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
};
const load = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s), { mode: 0o600 });

async function api(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, headers: res.headers };
}
async function login(email, password) {
  const r = await api('/admin/login', { method: 'POST', body: { email, password } });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return { ok: r.status === 200 && cookie.includes('='), cookie };
}
const garment = (slug, name, available, published) => ({
  kind: 'garment', slug, name, category: 'tees', blurb: 'Verification product. Not for sale.', material: '100% cotton', fabric: 'Test', specs: ['Test'],
  ship: { first: 3, extra: 1 }, colours: [{ name: 'Black', hex: '#111111' }], images: [], published, available, sort: 900,
  methods: [{ id: 'print', base: 7, sizes: [{ label: 'M', cost: 0 }, { label: 'L', cost: 1 }], positions: [{ label: 'Front', cost: 0 }] }],
});
const itemFor = (p, qty = 2, extra = {}) => ({ productId: p.id, method: 'print', colour: 'Black', size: 'M', position: 'Front', qty, ...extra });
const pence = (n) => Math.round(n * 100);

if (phase === 'phase1') {
  const email = `verify-${randomBytes(3).toString('hex')}@invalid.test`;
  const password = randomBytes(18).toString('base64url');
  const owner = await ownerClient();
  await owner.query("insert into emblara.staff (email, password_hash) values ($1, public.crypt($2, public.gen_salt('bf', 8)))", [email, password]);
  await owner.end();
  const { ok, cookie } = await login(email, password);
  check('merchant (throwaway staff) can sign in', ok);

  // ---- 1. PRODUCTS
  const make = async (slug, name, available, published) => (await api('/admin/products', { method: 'POST', cookie, body: garment(slug, name, available, published) })).json.product;
  const live = await make('zz-verify-tee', 'ZZ Verification tee (test)', true, true);
  const draft = await make('zz-verify-draft', 'ZZ Draft (test)', true, false);
  const off = await make('zz-verify-unavailable', 'ZZ Unavailable (test)', false, true);
  check('test products created by staff', !!(live && draft && off));
  const pub = (await api('/products')).json.products.map((p) => p.slug);
  check('1a published + available product is public', pub.includes('zz-verify-tee'));
  check('1b draft product is not in the public API', !pub.includes('zz-verify-draft'));
  check('1c unavailable product is not in the public API', !pub.includes('zz-verify-unavailable'));
  const html = await fetch(`${BASE}/`).then((r) => r.text());
  check('1d draft name is not in the page HTML or any public response', !html.includes('ZZ Draft') && !JSON.stringify(pub).includes('ZZ Draft'));
  const c1 = await api('/checkout', { method: 'POST', body: { items: [itemFor(off)] } });
  check('1e unavailable product cannot enter a new checkout (409, names it)', c1.status === 409 && c1.json.productIds?.includes(off.id), `${c1.status} ${c1.text.slice(0, 80)}`);
  const c2 = await api('/checkout', { method: 'POST', body: { items: [itemFor(draft)] } });
  check('1f draft product cannot be checked out (409)', c2.status === 409, `${c2.status}`);
  for (const [name, r] of [
    ['create', await api('/admin/products', { method: 'POST', body: garment('zz-verify-hack', 'hack', true, true) })],
    ['edit', await api(`/admin/products?id=${live.id}`, { method: 'PUT', body: garment('zz-verify-tee', 'HACKED', true, true) })],
    ['upload', await api('/admin/upload', { method: 'POST', body: { x: 1 } })],
    ['list', await api('/admin/products')],
  ]) check(`1g visitor cannot ${name} products (401)`, r.status === 401, `${r.status}`);
  const forged = await api('/admin/products', { method: 'POST', body: garment('zz-verify-hack', 'hack', true, true), headers: { cookie: 'emblara_staff=eyJzdWIiOiJ4IiwiZW1haWwiOiJ4IiwiZXhwIjo5OTk5OTk5OTk5fQ.AAAA' } });
  check('1h a forged staff cookie is refused', forged.status === 401 || forged.status === 403, `${forged.status}`);

  // ---- 2/3. CART SUBTOTAL AND PRICE TAMPERING
  const product = fromRow({ ...live, config: live.config });
  const expected = pence(quote([{ product, method: 'print', size: 'M', position: 'Front', qty: 2 }]).total);
  const honest = await api('/checkout', { method: 'POST', body: { items: [itemFor(live, 2)] } });
  check('2 a cart subtotal computed in the browser model equals the server total', honest.json?.total_pence === expected, `${honest.json?.total_pence} vs ${expected}`);
  const tampered = await api('/checkout', {
    method: 'POST',
    body: { items: [itemFor(live, 2, { price: 0.01, unit_amount: 1, unitPrice: 1, total: 1 })], subtotal: 1, total: 1, currency: 'usd', paid: true, status: 'paid', amount_total: 1 },
  });
  check('3a tampered request (price 0.01, total 1, usd, paid) is priced from the trusted data', tampered.json?.total_pence === expected, `${tampered.json?.total_pence}`);
  const owner2 = await ownerClient();
  const rows = (await owner2.query('select number, stripe_session_id, amount_total_pence, payment_status from emblara.orders where number = any($1)', [[honest.json.number, tampered.json.number]])).rows;
  for (const o of rows) {
    const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id, { expand: ['line_items'] });
    check(`3b ${o.number}: Stripe session is GBP, test mode, amount ${s.amount_total} = server total ${expected}`, s.currency === 'gbp' && !s.livemode && s.amount_total === expected && o.amount_total_pence === expected);
  }
  // the tampered order is not needed; expire it and remove it. The honest one is the order to pay.
  const t = rows.find((o) => o.number === tampered.json.number);
  await stripe.checkout.sessions.expire(t.stripe_session_id).catch(() => {});
  await owner2.query("delete from emblara.orders where number = $1 and payment_status = 'pending'", [t.number]);

  // ---- 5. SUCCESS PAGE
  const mine = rows.find((o) => o.number === honest.json.number);
  const sid = mine.stripe_session_id;
  const page = await fetch(`${BASE}/?session_id=${sid}`, { redirect: 'manual' });
  const status = await api(`/order-status?session=${sid}`);
  const listed = (await api('/admin/orders', { cookie })).json.orders.some((o) => o.number === mine.number);
  const after = (await owner2.query('select payment_status from emblara.orders where number = $1', [mine.number])).rows[0].payment_status;
  check('5 opening the success URL manually loads the page but creates/changes no paid order', page.status === 200 && status.json?.paid === false && !listed && after === 'pending', `${page.status} ${JSON.stringify(status.json)} listed=${listed} ${after}`);
  const fake = await api('/order-status?session=cs_test_madeup0000000000');
  check('5b a made-up success session id finds nothing (404)', fake.status === 404, `${fake.status}`);
  await owner2.end();

  save({ email, password, ids: { live: live.id, draft: draft.id, off: off.id }, order: honest.json.number, expected });
  console.log(`\nPay this TEST order (£${(expected / 100).toFixed(2)}) with card 4242 4242 4242 4242, any future date, any CVC, any UK address:\n${honest.json.url}`);
} else if (phase === 'phase2') {
  const st = load();
  const { cookie } = await login(st.email, st.password);
  const owner = await ownerClient();
  const o = (await owner.query('select * from emblara.orders where number = $1', [st.order])).rows[0];

  // ---- 4. PAYMENT
  check('4a the test order is paid (set by the webhook, not by the page)', o.payment_status === 'paid', o.payment_status);
  const session = await stripe.checkout.sessions.retrieve(o.stripe_session_id, { expand: ['line_items'] });
  check('4b Stripe confirms the session was paid in test mode for the trusted total', session.payment_status === 'paid' && !session.livemode && session.amount_total === st.expected && o.amount_total_pence === st.expected);
  const evs = await stripe.events.list({ type: 'checkout.session.completed', limit: 10 });
  const ev = evs.data.find((e) => e.data.object.id === o.stripe_session_id);
  check('4c Stripe delivered the webhook event (no deliveries pending)', !!ev && ev.pending_webhooks === 0, JSON.stringify(ev && ev.pending_webhooks));
  check('4d customer, phone and UK address captured', !!(o.email && o.phone && o.shipping?.postcode && o.shipping?.country === 'GB'));
  const items = (await owner.query('select product_name, quantity, unit_amount_pence, line_amount_pence, options from emblara.order_items where order_id = $1', [o.id])).rows;
  check('4e order item snapshot: name, quantity, unit and line amounts', items.length === 1 && items[0].product_name === 'ZZ Verification tee (test)' && items[0].quantity === 2 && items[0].line_amount_pence === st.expected && items[0].unit_amount_pence * 2 === st.expected, JSON.stringify(items));
  const bad = await api('/stripe-webhook', { method: 'POST', body: { id: 'evt_x' }, headers: { 'stripe-signature': 't=1,v1=deadbeef' } });
  check('4f webhook with a bad signature is rejected (400)', bad.status === 400, `${bad.status}`);
  const nosig = await api('/stripe-webhook', { method: 'POST', body: { id: 'evt_x' } });
  check('4g webhook with no signature is rejected (400)', nosig.status === 400, `${nosig.status}`);

  // ---- 6. WEBHOOK RETRY
  const raw = JSON.stringify(ev);
  const sign = () => stripe.webhooks.generateTestHeaderString({ payload: raw, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const send = () => fetch(`${BASE}/api/stripe-webhook`, { method: 'POST', headers: { 'stripe-signature': sign(), 'content-type': 'application/json' }, body: raw }).then(async (r) => ({ status: r.status, json: await r.json() }));
  const r1 = await send();
  const r2 = await send();
  const count = (await owner.query('select count(*)::int n from emblara.orders where stripe_session_id = $1', [o.stripe_session_id])).rows[0].n;
  const again = (await owner.query('select paid_at from emblara.orders where id = $1', [o.id])).rows[0];
  check('6 the same signed event replayed twice: accepted, flagged duplicate, still ONE order, paid_at unchanged', r1.status === 200 && r1.json.duplicate && r2.json.duplicate && count === 1 && String(again.paid_at) === String(o.paid_at), JSON.stringify([r1, r2, count]));

  // ---- 7. MERCHANT
  const list = (await api('/admin/orders', { cookie })).json;
  const row = list.orders?.find((x) => x.number === st.order);
  check('7a staff sees the paid order in the dashboard list', !!row && row.status === 'paid');
  check('7b the list carries no Stripe ids', list.orders.every((x) => !('stripe_session_id' in x) && !('stripe_payment_intent' in x)));
  const detail = (await api(`/admin/orders?id=${o.id}`, { cookie })).json;
  check('7c order detail shows items, captured unit price, trusted total', detail.items?.[0]?.unit_amount_pence * 2 === st.expected && detail.order.amount_total_pence === st.expected);
  for (const [name, r] of [
    ['list orders', await api('/admin/orders')],
    ['read an order', await api(`/admin/orders?id=${o.id}`)],
    ['change a fulfilment state', await api(`/admin/orders/status?id=${o.id}`, { method: 'POST', body: { status: 'processing' } })],
  ]) check(`7d visitor cannot ${name} (401)`, r.status === 401, `${r.status}`);
  const step = async (to) => (await api(`/admin/orders/status?id=${o.id}`, { method: 'POST', cookie, body: { status: to } }));
  check('7e cannot skip Paid -> Fulfilled', (await step('fulfilled')).status === 409);
  check('7f Paid -> Processing', (await step('processing')).json?.order?.status === 'processing');
  check('7g Processing -> Fulfilled', (await step('fulfilled')).json?.order?.status === 'fulfilled');
  check('7h cannot go backwards', (await step('processing')).status === 409);
  const pay = (await owner.query('select payment_status, fulfillment_status from emblara.orders where id = $1', [o.id])).rows[0];
  check('7i payment and fulfilment stayed separate states', pay.payment_status === 'paid' && pay.fulfillment_status === 'fulfilled');

  // ---- 8. PRODUCT EDIT AFTER PURCHASE
  const prod = (await api('/admin/products', { cookie })).json.products.find((p) => p.id === st.ids.live);
  const dearer = { ...prod, specs: prod.config.specs, ship: prod.config.ship, colours: prod.config.colours, methods: prod.config.methods.map((m) => ({ ...m, base: m.base + 10 })) };
  const put = await api(`/admin/products?id=${prod.id}`, { method: 'PUT', cookie, body: dearer });
  const newQuote = (await api('/checkout', { method: 'POST', body: { items: [itemFor({ id: prod.id }, 2)] } })).json;
  const o2 = (await owner.query('select amount_total_pence from emblara.orders where id = $1', [o.id])).rows[0];
  const i2 = (await owner.query('select product_name, unit_amount_pence, line_amount_pence from emblara.order_items where order_id = $1', [o.id])).rows[0];
  check('8a the product price was changed (new checkouts cost more)', put.status === 200 && newQuote.total_pence > st.expected, `${put.status} ${newQuote.total_pence}`);
  check('8b the historical order keeps its original total and item price', o2.amount_total_pence === st.expected && i2.line_amount_pence === st.expected && i2.unit_amount_pence * 2 === st.expected);
  if (newQuote.number) {
    const pend = (await owner.query('select stripe_session_id from emblara.orders where number = $1', [newQuote.number])).rows[0];
    await stripe.checkout.sessions.expire(pend.stripe_session_id).catch(() => {});
    await owner.query("delete from emblara.orders where number = $1 and payment_status = 'pending'", [newQuote.number]);
  }
  await owner.end();

  // ---- 9. SECRETS
  const assets = [];
  const index = await fetch(`${BASE}/`).then((r) => r.text());
  for (const m of index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) assets.push(m[1]);
  const bodies = [index];
  for (const a of assets) {
    bodies.push(await fetch(BASE + a).then((r) => r.text()));
    const map = await fetch(`${BASE}${a}.map`);
    if (map.status === 200 && (map.headers.get('content-type') || '').includes('json')) bodies.push('SOURCEMAP-PUBLISHED');
  }
  bodies.push((await api('/products')).text);
  const blob = bodies.join('\n');
  const secretValues = [process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET, process.env.AWS_SECRET_ACCESS_KEY, ...['EMBLARA_APP_DATABASE_URL', 'EMBLARA_PUBLIC_DATABASE_URL', 'DATABASE_URL', 'DATABASE_URL_UNPOOLED'].map((k) => { try { return new URL(process.env[k]).password; } catch { return ''; } })].filter((v) => v && v.length > 8);
  check(`9a none of the ${secretValues.length} real secret values appear in any browser asset or public API response (${assets.length} assets scanned)`, secretValues.every((v) => !blob.includes(v)));
  check('9b no key-shaped strings (sk_, rk_, whsec_, postgres://, service_role, private key)', !/(sk|rk)_(test|live)_[A-Za-z0-9]{10}|whsec_[A-Za-z0-9]{10}|postgres(ql)?:\/\/|service_role|-----BEGIN/i.test(blob));
  check('9c no source maps published', !blob.includes('SOURCEMAP-PUBLISHED'));
  const probes = await Promise.all(['/.env', '/.env.local', '/.neon', '/server/db.js', '/scripts/migrate.mjs', '/.git/config'].map((p) => fetch(BASE + p).then(async (r) => ({ p, ok: r.status === 200 && !(r.headers.get('content-type') || '').includes('html') }))));
  check('9d server files and env files are not served', probes.every((x) => !x.ok), JSON.stringify(probes.filter((x) => x.ok)));
  check('9e no Supabase key is used or present (this store runs on Neon)', !/supabase/i.test(blob));
} else if (phase === 'cleanup') {
  const st = fs.existsSync(STATE) ? load() : null;
  const owner = await ownerClient();
  const p = await owner.query("delete from emblara.products where slug like 'zz-verify-%'");
  const o = await owner.query('delete from emblara.orders where number = any($1)', [[st?.order].filter(Boolean)]);
  const s = st ? await owner.query('delete from emblara.staff where email = $1', [st.email]) : { rowCount: 0 };
  const left = (await owner.query("select (select count(*) from emblara.orders)::int orders, (select count(*) from emblara.products)::int products, (select string_agg(email, ',') from emblara.staff) staff")).rows[0];
  await owner.end();
  fs.rmSync(STATE, { force: true });
  console.log(`Removed test products: ${p.rowCount}, test orders: ${o.rowCount}, throwaway staff: ${s.rowCount}. Now: ${JSON.stringify(left)}`);
} else {
  console.log('Usage: phase1 | phase2 | cleanup');
}
if (phase !== 'cleanup') console.log(failed ? `\n${failed} check(s) FAILED.` : '\nAll checks in this phase passed.');
process.exit(failed ? 1 : 0);
