// Two-step TEST-mode helper for proving a real paid Checkout Session becomes a paid order.
//   npm run stripe:order -- create         makes a pending order + a Stripe test session; prints the URL
//                                          (open it, pay with test card 4242 4242 4242 4242)
//   npm run stripe:order -- finish <cs_id> reads the REAL session back from Stripe and runs it through
//                                          our webhook handler with a locally signed event, then reports
// This stands in for webhook delivery until a public webhook endpoint exists. The handler, the
// signature check and the order update are the production code.
import Stripe from 'stripe';
import { withContext } from '../server/context.js';
import { db } from '../server/db.js';
import { processWebhook, startCheckout } from '../server/payments.js';

const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must be a TEST key (sk_test_...).');
const stripe = new Stripe(key);
const [cmd, arg] = process.argv.slice(2);
const BASE = process.env.CHECK_BASE_URL || 'http://localhost:5176';

if (cmd === 'create') {
  const { products } = await fetch(`${BASE}/api/products`).then((r) => r.json());
  const p = products.find((x) => x.slug === 'heavy-cotton-tee');
  const items = [{ productId: p.id, method: 'print', colour: p.config.colours[0].name, size: 'L', position: 'Front', qty: 2 }];
  const res = await fetch(`${BASE}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) }).then((r) => r.json());
  console.log(`Order ${res.number}, total £${(res.total_pence / 100).toFixed(2)}.\nOpen and pay (test card 4242 4242 4242 4242, any future date, any CVC, any UK address):\n${res.url}`);
} else if (cmd === 'finish' && /^cs_test_/.test(arg ?? '')) {
  const session = await stripe.checkout.sessions.retrieve(arg);
  if (session.payment_status !== 'paid') throw new Error(`Session is ${session.payment_status}, not paid. Complete the payment first.`);
  const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.DEMO_WEBHOOK_SECRET;
  if (!secret) throw new Error('Set STRIPE_WEBHOOK_SECRET or DEMO_WEBHOOK_SECRET.');
  const payload = JSON.stringify({ id: `evt_local_${Date.now()}`, object: 'event', type: 'checkout.session.completed', data: { object: session } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const result = await withContext({ flow: 'webhook' }, () => processWebhook(Buffer.from(payload), header));
  const order = await withContext({ flow: 'webhook' }, () => db().getOrder({ sessionId: arg }));
  console.log('Webhook result:', JSON.stringify(result));
  console.log('Order', order.number, '| payment:', order.payment_status, '| fulfilment:', order.fulfillment_status, '| paid_at set:', !!order.paid_at);
  console.log('Captured from Stripe (presence only):', JSON.stringify({ email: !!order.email, name: !!order.customer_name, phone: !!order.phone, payment_intent: !!order.stripe_payment_intent, shipping_line1: !!order.shipping?.line1, shipping_postcode: !!order.shipping?.postcode, country: order.shipping?.country }));
} else {
  console.log('Usage: npm run stripe:order -- create | finish <cs_test_...>');
}
process.exit(0);
