# Stripe checkout

One-time **Stripe Checkout** (hosted by Stripe), GBP only, test mode until launch. Card details are entered on Stripe's page; this app never sees them.

## Trusted path (server only: `server/checkout.js`, `server/payments.js`, `server/router.js`)

1. `POST /api/checkout` receives product ids, finish, colour, size, logo position, quantity, logo file name, notes.
2. Each product is loaded from Neon by id. Unpublished or unavailable products are refused (409, with the product ids so the browser can drop them from a stale bag).
3. Options and quantities are validated against the stored product (whole numbers, 1 to 999).
4. The price is computed from the stored cost model by `src/lib/pricing.js`, in whole pence.
5. A pending order and its snapshot lines are saved in one transaction.
6. The Checkout Session is created with those server-computed amounts, then its id is stored on the order. An idempotency key (`emblara-checkout-<order id>`) stops a retry creating a second session.
7. The browser gets only the hosted Checkout URL and the order number.

**Ignored if sent:** any unit price, subtotal, total, currency, paid or status field, and any extra fields. The server never reads them.

## Reconciliation

Session and PaymentIntent both carry `metadata`: `order_id`, `order_number`, `source=emblara-store`. The session also has `client_reference_id = order id`. The paid amount and currency must equal the stored order before it is marked paid.

## Fulfilment, shipping, tax

- Stripe collects the delivery address (UK only) and a phone number. Customer email is collected by Stripe as well. No carrier API.
- Delivery is included in every price, so there are no `shipping_options`. No local pickup is offered in the approved plan.
- No tax is set: Emblara is not VAT registered. If that changes, enable Stripe Tax in the dashboard and set `automatic_tax` then; do not hardcode a rate.

## Becoming `paid`

Only `POST /api/stripe-webhook` can do it: the signature is verified on the raw body with `STRIPE_WEBHOOK_SECRET`, the event must be `checkout.session.completed` (or `async_payment_succeeded`) with `payment_status = paid`, and the amount and currency must match. Duplicates are no-ops. `checkout.session.expired` marks the order `expired`.

## Environment variables

`STRIPE_SECRET_KEY` (server only, never in browser code), `STRIPE_WEBHOOK_SECRET`, optional `SITE_URL`. No publishable key is needed because the browser only redirects to the hosted page.

## Test mode

```bash
npm run dev          # one terminal
npm run stripe:check # another: creates sessions via the API, then asks Stripe what they contain (refuses non-test keys)
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Webhook endpoint (to do once the store is deployed)

Stripe dashboard (sandbox), Developers, Webhooks, add endpoint `https://<your-domain>/api/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel. The endpoint must be publicly reachable, so it cannot sit behind Vercel deployment protection.
