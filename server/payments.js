// Payment flow:
//   1. startCheckout  - price the cart from trusted data, store a pending order
//                       (snapshot), create a Stripe Checkout Session for exactly
//                       that amount.
//   2. Stripe takes the payment and collects the shipping address.
//   3. processWebhook - verifies the Stripe signature on the raw body, checks the
//                       amount against the stored order, and only then marks it
//                       paid. This is the ONLY place an order becomes paid.
//
// Without STRIPE_SECRET_KEY a demo payment page stands in for Stripe Checkout
// and delivers an event signed the same way, through the same processWebhook.

import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { config } from './config.js';
import { db, orderNumber } from './db.js';
import { priceCart, lineDescription, cleanText } from './checkout.js';
import { HttpError } from './http.js';
import { site } from '../src/data/site.js';

const stripeClient = () => new Stripe(config().stripeKey || 'sk_test_demo_key_not_used_for_network_calls');

export async function startCheckout({ items, notes, artwork, artwork_id: artworkId }, siteOrigin) {
  const cfg = config();
  const { lines, total_pence } = await priceCart(items);
  const attachedArtworkId = artwork === 'attached' ? String(artworkId ?? '') : null;
  if (artwork === 'attached' && !/^[0-9a-f-]{36}$/i.test(attachedArtworkId)) throw new HttpError(422, 'Upload the original artwork before checkout.');

  const order = await db().createOrder(
    {
      number: orderNumber(),
      currency: 'gbp',
      amount_total_pence: total_pence,
      notes: cleanText(notes, 500) || null,
      artwork: artwork === 'attached' ? 'attached' : 'later',
    },
    lines.map((l) => ({
      product_id: l.product.id,
      product_slug: l.product.slug,
      product_name: l.product.name,
      options: l.options,
      quantity: l.quantity,
      unit_amount_pence: l.unit_pence,
      line_amount_pence: l.line_pence,
    })), attachedArtworkId,
  );

  let session;
  if (cfg.demoPayments) {
    const id = `cs_demo_${randomBytes(18).toString('hex')}`;
    session = { id, url: `${siteOrigin}/demo-checkout.html?s=${id}` };
  } else {
    // Everything below comes from server-side data: the amounts are the ones priceCart()
    // computed from the stored products. Nothing here is taken from the browser.
    //   - No shipping_options: delivery is included in every price (approved plan).
    //   - No automatic_tax / tax_rates: Emblara is not VAT registered. If that changes, tax is
    //     turned on through Stripe Tax in the dashboard, not by a number in this code.
    //   - Address collection is for UK delivery only; there is no pickup option in the plan.
    const reconcile = { order_id: order.id, order_number: order.number, source: 'emblara-store' };
    session = await stripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: order.id,
        metadata: reconcile,
        payment_intent_data: { metadata: reconcile, description: `Emblara order ${order.number}` },
        line_items: lines.map((l) =>
          l.product.service
            ? { quantity: l.quantity, price_data: { currency: 'gbp', unit_amount: l.unit_pence, product_data: { name: l.title, ...(lineDescription(l) && { description: lineDescription(l) }) } } }
            : {
                quantity: 1,
                price_data: {
                  currency: 'gbp',
                  unit_amount: l.line_pence,
                  product_data: { name: `${l.title} × ${l.quantity}`, description: lineDescription(l).slice(0, 500) },
                },
              },
        ),
        shipping_address_collection: { allowed_countries: ['GB'] },
        phone_number_collection: { enabled: true },
        custom_text: { submit: { message: `Questions about your order? Email ${site.supportEmail}.` } },
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
        success_url: `${siteOrigin}/?session_id={CHECKOUT_SESSION_ID}#/order-success`,
        cancel_url: `${siteOrigin}/#/checkout`,
      },
      // One order, one session: a retried request cannot create a second charge page.
      { idempotencyKey: `emblara-checkout-${order.id}` },
    );
  }

  await db().patchOrder(order.id, { stripe_session_id: session.id });
  return { url: session.url, total_pence, number: order.number };
}

const addressOf = (d) =>
  d?.address
    ? { name: d.name ?? null, line1: d.address.line1 ?? '', line2: d.address.line2 ?? '', city: d.address.city ?? '', county: d.address.state ?? '', postcode: d.address.postal_code ?? '', country: d.address.country ?? 'GB' }
    : null;

// Verified Stripe event -> order state. Idempotent: Stripe retries and
// duplicates are safe.
export async function processWebhook(rawBody, signature) {
  const cfg = config();
  if (!cfg.webhookSecret) throw new HttpError(503, 'Webhook secret not configured.');
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature ?? '', cfg.webhookSecret);
  } catch {
    throw new HttpError(400, 'Invalid signature.');
  }

  // The signed event only tells us WHICH session to look at. Everything we act on is re-read from
  // Stripe's API with the secret key (session plus line items), not taken from the request body.
  // The offline demo has no Stripe API, so there the locally signed event is used as is.
  const sessionId = event.data.object?.id;
  const reread = async () => {
    if (config().demoPayments) return event.data.object;
    try {
      return await stripeClient().checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    } catch (err) {
      // A session Stripe does not know is a bad event (400, no retry). Anything else is ours or
      // Stripe's outage: let it surface as 500 so Stripe retries later.
      if (err?.code === 'resource_missing' || err?.statusCode === 404) throw new HttpError(400, 'Unknown checkout session.');
      throw err;
    }
  };

  if (event.type === 'checkout.session.expired') {
    const s = await reread();
    if (s.status === 'expired' || config().demoPayments) {
      const order = await db().getOrder({ sessionId });
      if (order) await db().patchOrder(order.id, { payment_status: 'expired' }, { payment_status: 'pending' });
    }
    return { received: true };
  }
  // Failed asynchronous payments are ignored on purpose: the Checkout Session stays open and the
  // customer may retry, so the order simply remains pending (and unpaid) until it is paid or expires.
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return { received: true, ignored: true };

  const s = await reread();
  if (s.payment_status !== 'paid') return { received: true, waiting: true };
  return completePaidSession(s);
}

// Marks the order for a PAID Checkout Session as paid. Called only by the verified webhook, with
// the session re-read from Stripe. Idempotent: the session id is unique on the order, and the update
// is a compare-and-set on payment_status = 'pending', so a retry or replay changes nothing.
async function completePaidSession(s) {
  const order = await db().getOrder({ sessionId: s.id });
  if (!order) throw new HttpError(400, 'Unknown checkout session.');
  if (order.payment_status !== 'pending') return { received: true, duplicate: true };
  // The session must be the one we created for this order.
  if (s.client_reference_id !== order.id || (s.metadata?.order_id && s.metadata.order_id !== order.id)) {
    console.error(`[stripe-webhook] reference mismatch on ${order.number}`);
    throw new HttpError(400, 'Reference mismatch.');
  }
  // Line items, when Stripe returned them, must add up to the amount charged.
  const lineTotal = s.line_items?.data?.reduce((n, l) => n + l.amount_total, 0);
  if (lineTotal !== undefined && lineTotal !== s.amount_total) {
    console.error(`[stripe-webhook] line items (${lineTotal}) do not match amount_total (${s.amount_total}) on ${order.number}`);
    throw new HttpError(400, 'Line items mismatch.');
  }
  // The paid amount must be the amount WE stored, in GBP.
  if (s.amount_total !== order.amount_total_pence || String(s.currency).toLowerCase() !== order.currency) {
    console.error(`[stripe-webhook] amount mismatch on ${order.number}: paid ${s.amount_total} ${s.currency}, expected ${order.amount_total_pence}`);
    throw new HttpError(400, 'Amount mismatch.');
  }

  const ship = s.collected_information?.shipping_details ?? s.shipping_details;
  await db().patchOrder(
    order.id,
    {
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null,
      email: s.customer_details?.email ?? null,
      customer_name: s.customer_details?.name ?? ship?.name ?? null,
      phone: s.customer_details?.phone ?? null,
      shipping: addressOf(ship),
    },
    { payment_status: 'pending' },
  );
  return { received: true, paid: order.number };
}

// ------------------------------------------------------------ demo payment
// Only reachable when STRIPE_SECRET_KEY is absent.
export async function demoSession(sessionId) {
  const order = await db().getOrder({ sessionId });
  if (!order || order.payment_status !== 'pending') throw new HttpError(404, 'Session not found or already used.');
  const items = await db().orderItems(order.id);
  return { number: order.number, total_pence: order.amount_total_pence, items: items.map((i) => ({ name: i.product_name, quantity: i.quantity, options: i.options, line_amount_pence: i.line_amount_pence })) };
}

export async function demoPay(sessionId, f, siteOrigin) {
  const cfg = config();
  const order = await db().getOrder({ sessionId });
  if (!order || order.payment_status !== 'pending') throw new HttpError(404, 'Session not found or already used.');
  const t = (v, max = 120) => cleanText(v, max);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t(f.email, 254)) || !t(f.name) || !t(f.line1) || !t(f.city) || !/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(t(f.postcode, 10))) {
    throw new HttpError(400, 'Check your email, name, address and UK postcode.');
  }
  const payload = JSON.stringify({
    id: `evt_demo_${randomBytes(8).toString('hex')}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: order.amount_total_pence,
        currency: order.currency,
        client_reference_id: order.id,
        metadata: { order_id: order.id },
        payment_intent: `pi_demo_${randomBytes(8).toString('hex')}`,
        customer_details: { email: t(f.email, 254), name: t(f.name), phone: t(f.phone, 30) || null },
        collected_information: { shipping_details: { name: t(f.name), address: { line1: t(f.line1), line2: t(f.line2), city: t(f.city), state: t(f.county), postal_code: t(f.postcode, 10).toUpperCase(), country: 'GB' } } },
      },
    },
  });
  const header = stripeClient().webhooks.generateTestHeaderString({ payload, secret: cfg.webhookSecret });
  await processWebhook(Buffer.from(payload), header);
  return { url: `${siteOrigin}/?session_id=${sessionId}#/order-success` };
}

// What the "thank you" page may know: only paid-or-not, by the session id the buyer was redirected
// with. No personal data. This page is INTERFACE ONLY: it reads our own order state and never
// changes it. Whether an order is paid is decided solely by the verified Stripe webhook.
export async function orderStatus(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length < 10 || sessionId.length > 200) throw new HttpError(400, 'Bad session.');
  const o = await db().getOrder({ sessionId });
  if (!o) throw new HttpError(404, 'Not found.');
  return { number: o.number, paid: o.payment_status === 'paid', total_pence: o.amount_total_pence };
}
