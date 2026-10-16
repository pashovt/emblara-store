// Server-side store tests: price authority, availability, webhook verification,
// order snapshot and fulfilment transitions. Runs against the local JSON store
// in a temp directory; no network, no Stripe account.
//   npm test

import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import Stripe from 'stripe';

process.env.STORE_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'emblara-store-'));
process.env.DEMO_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.ADMIN_SESSION_SECRET = 'x'.repeat(40);
delete process.env.STRIPE_SECRET_KEY;
delete process.env.EMBLARA_APP_DATABASE_URL; // these tests use the local file store
delete process.env.EMBLARA_PUBLIC_DATABASE_URL;
delete process.env.VERCEL;

const { db } = await import('../server/db.js');
const { startCheckout, processWebhook } = await import('../server/payments.js');
const { priceCart } = await import('../server/checkout.js');
const { advanceOrder, saveProduct } = await import('../server/admin.js');
const { fromRow } = await import('../src/lib/catalogue.js');
const { singleQuote } = await import('../src/lib/pricing.js');

const stripe = new Stripe('sk_test_unused');
const signed = (obj) => {
  const payload = JSON.stringify(obj);
  return [Buffer.from(payload), stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' })];
};
const completed = (sessionId, amount, extra = {}) => ({
  id: 'evt_1', object: 'event', type: 'checkout.session.completed',
  data: { object: { id: sessionId, object: 'checkout.session', payment_status: 'paid', amount_total: amount, currency: 'gbp', payment_intent: 'pi_1', customer_details: { email: 'a@b.co', name: 'A B' }, collected_information: { shipping_details: { name: 'A B', address: { line1: '1 St', city: 'Leeds', postal_code: 'LS1 1AA', country: 'GB' } } }, ...extra } },
});

let polo;
const line = (over = {}) => ({ productId: polo.id, method: 'embroidery', colour: polo.config.colours[0].name, size: 'M', position: 'Left chest', qty: 1, ...over });

before(async () => {
  await db().seedIfEmpty();
  polo = (await db().listProducts()).find((p) => p.slug === 'mens-polo');
});
after(() => {});

describe('price authority', () => {
  it('prices from stored product data and ignores any price the client sends', async () => {
    const honest = await priceCart([line()]);
    const tampered = await priceCart([line({ price: 0.01, unit_amount: 1, total: 1, subtotal: 1, currency: 'usd', paid: true })]);
    assert.equal(tampered.total_pence, honest.total_pence);
    assert.equal(honest.total_pence, Math.round(singleQuote(fromRow(polo), { method: 'embroidery', size: 'M', position: 'Left chest', qty: 1 }).total * 100));
  });

  it('rejects options the product does not offer', async () => {
    for (const bad of [{ size: 'ZZ' }, { colour: 'Pink' }, { position: 'Forehead' }, { method: 'print' }, { qty: 0 }, { qty: 1.5 }, { qty: 100000 }, { productId: 'nope' }]) {
      await assert.rejects(priceCart([line(bad)]), undefined, JSON.stringify(bad));
    }
    await assert.rejects(priceCart([]));
  });

  it('refuses unavailable and unpublished products', async () => {
    const input = (r, patch) => ({ kind: r.kind, slug: r.slug, name: r.name, category: r.category, blurb: r.blurb, material: r.material ?? '', fabric: r.fabric ?? '', specs: r.config.specs, ship: r.config.ship, colours: r.config.colours, methods: r.config.methods, images: [], published: r.published, available: r.available, sort: r.sort, ...patch });
    await saveProduct(input(polo, { available: false }), polo.id);
    await assert.rejects(priceCart([line()]), /unavailable/);
    await saveProduct(input(polo, { available: true, published: false }), polo.id);
    await assert.rejects(priceCart([line()]), /no longer sold/);
    await saveProduct(input(polo, {}), polo.id);
    await priceCart([line()]);
  });
});

describe('public catalogue', () => {
  it('lists only published AND available products', async () => {
    const slugs = async () => (await db().listProducts({ publicOnly: true })).map((p) => p.slug);
    assert.ok((await slugs()).includes('mens-polo'));
    await db().saveProduct({ available: false }, polo.id);
    assert.ok(!(await slugs()).includes('mens-polo'));
    await db().saveProduct({ available: true, published: false }, polo.id);
    assert.ok(!(await slugs()).includes('mens-polo'));
    await db().saveProduct({ available: true, published: true }, polo.id);
  });
});

describe('payment and fulfilment', () => {
  it('cannot fulfil an order that was never paid', async () => {
    const { url } = await startCheckout({ items: [line()] }, 'http://localhost');
    const unpaid = await db().getOrder({ sessionId: new URL(url).searchParams.get('s') });
    await assert.rejects(advanceOrder(unpaid.id, 'processing'), /not found/i);
  });

  it('rejects unsigned and wrongly signed webhooks', async () => {
    await assert.rejects(processWebhook(Buffer.from('{}'), undefined), /signature/i);
    const [body] = signed(completed('cs_x', 1));
    await assert.rejects(processWebhook(body, 't=1,v1=deadbeef'), /signature/i);
  });

  it('does not mark an order paid on an amount mismatch', async () => {
    const { url } = await startCheckout({ items: [line()] }, 'http://localhost');
    const session = new URL(url).searchParams.get('s');
    await assert.rejects(processWebhook(...signed(completed(session, 1))), /mismatch/i);
    assert.equal((await db().getOrder({ sessionId: session })).payment_status, 'pending');
  });

  it('marks paid once, snapshots the order, and survives later price changes and replays', async () => {
    const { url, total_pence } = await startCheckout({ items: [line({ qty: 2 })], notes: 'thread: navy' }, 'http://localhost');
    const session = new URL(url).searchParams.get('s');
    await processWebhook(...signed(completed(session, total_pence)));
    const replay = await processWebhook(...signed(completed(session, total_pence)));
    assert.equal(replay.duplicate, true);

    const order = await db().getOrder({ sessionId: session });
    assert.equal(order.payment_status, 'paid');
    assert.equal(order.fulfillment_status, 'unfulfilled');
    assert.equal(order.shipping.postcode, 'LS1 1AA');
    assert.equal(order.notes, 'thread: navy');

    // The merchant changes the price tomorrow: yesterday's order is unchanged.
    const before = await db().orderItems(order.id);
    const dearer = { ...polo.config, methods: polo.config.methods.map((m) => ({ ...m, base: m.base + 50 })) };
    await db().saveProduct({ config: dearer }, polo.id);
    const after = await db().orderItems(order.id);
    assert.deepEqual(after, before);
    assert.equal(after[0].product_name, 'Men’s polo');
    assert.equal(after[0].line_amount_pence, total_pence);
    assert.equal((await db().getOrder({ id: order.id })).amount_total_pence, total_pence);

    // Fulfilment only moves forward, one step at a time.
    await assert.rejects(advanceOrder(order.id, 'fulfilled'), /cannot move/);
    assert.equal((await advanceOrder(order.id, 'processing')).order.status, 'processing');
    assert.equal((await advanceOrder(order.id, 'fulfilled')).order.status, 'fulfilled');
    assert.equal((await db().getOrder({ id: order.id })).fulfillment_status, 'fulfilled');
    await assert.rejects(advanceOrder(order.id, 'processing'), /cannot move/);
  });

  it('keeps unpaid orders out of the merchant list', async () => {
    const pending = await startCheckout({ items: [line()] }, 'http://localhost');
    const orders = await db().listOrders();
    assert.ok(!orders.some((o) => o.number === pending.number));
  });
});
