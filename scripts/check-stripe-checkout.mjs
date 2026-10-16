// Creates a Checkout Session through the running store API (with a tampered request), then
// asks Stripe's TEST mode what that session really contains. Expires the session and removes
// the pending order afterwards. Needs the dev server running with STRIPE_SECRET_KEY (sk_test_).
//   npm run dev   (in one terminal)   then   npm run stripe:check
import Stripe from 'stripe';
import { ownerClient } from './lib/db-owner.mjs';

const BASE = process.env.CHECK_BASE_URL || 'http://localhost:5176';
const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Refusing to run.');
const stripe = new Stripe(key);

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
};
const post = (path, body) => fetch(`${BASE}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

const { products } = await fetch(`${BASE}/api/products`).then((r) => r.json());
const polo = products.find((p) => p.slug === 'mens-polo');
const item = { productId: polo.id, method: 'embroidery', colour: polo.config.colours[0].name, size: 'M', position: 'Left chest', qty: 3 };

// What the browser is allowed to send, plus everything it is NOT allowed to decide.
const honest = await post('/checkout', { items: [item] });
const tampered = await post('/checkout', {
  items: [{ ...item, price: 0.01, unit_amount: 1, unitPrice: 1, total: 1 }],
  subtotal: 1, total: 1, currency: 'usd', paid: true, status: 'paid', amount_total: 1,
});
check('checkout returns a Stripe-hosted URL', /^https:\/\/checkout\.stripe\.com\//.test(honest.url ?? ''), honest.error);
check('a tampered request is priced exactly like an honest one', tampered.total_pence === honest.total_pence, `${tampered.total_pence} vs ${honest.total_pence}`);

const owner = await ownerClient();
try {
  const orders = (await owner.query("select id, number, amount_total_pence, stripe_session_id, payment_status from emblara.orders where number = any($1)", [[honest.number, tampered.number]])).rows;
  for (const o of orders) {
    const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id, { expand: ['line_items'] });
    const label = o.number;
    check(`${label}: test-mode session, one-time payment, GBP`, !s.livemode && s.mode === 'payment' && s.currency === 'gbp', `${s.livemode} ${s.mode} ${s.currency}`);
    check(`${label}: Stripe amount equals the server's stored total`, s.amount_total === o.amount_total_pence, `${s.amount_total} vs ${o.amount_total_pence}`);
    check(`${label}: line items add up to the amount`, s.line_items.data.reduce((n, l) => n + l.amount_total, 0) === s.amount_total);
    check(`${label}: reference and metadata reconcile to the order`, s.client_reference_id === o.id && s.metadata?.order_id === o.id && s.metadata?.order_number === o.number, JSON.stringify(s.metadata));
    check(`${label}: collects a UK shipping address and a phone number`, s.shipping_address_collection?.allowed_countries?.join() === 'GB' && s.phone_number_collection?.enabled === true);
    check(`${label}: no shipping cost, no tax rule written into the session`, (s.shipping_options ?? []).length === 0 && s.automatic_tax?.enabled === false && s.total_details?.amount_tax === 0, JSON.stringify(s.total_details));
    check(`${label}: order is still pending (only a verified webhook can pay it)`, o.payment_status === 'pending');
    await stripe.checkout.sessions.expire(o.stripe_session_id).catch(() => {});
  }
  await owner.query('delete from emblara.orders where number = any($1) and payment_status = $2', [[honest.number, tampered.number], 'pending']);
} finally {
  await owner.end();
}
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll Stripe checks passed (test mode; sessions expired, pending orders removed).');
process.exit(failed ? 1 : 0);
