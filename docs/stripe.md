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

## Becoming `paid` (webhook only)

`POST /api/stripe-webhook` is the only thing that can mark an order paid. The thank-you page is interface only: it reads our order state and changes nothing, so a closed browser, a replayed redirect or a forged success URL cannot create or pay an order.

1. The raw request body is read first and the `Stripe-Signature` header is verified with `STRIPE_WEBHOOK_SECRET` before anything else. A bad signature is a 400 and nothing else happens.
2. The event only names the Checkout Session. The server then **re-reads the session and its line items from Stripe's API** with the secret key; nothing is taken from the request body.
3. For `checkout.session.completed` and `checkout.session.async_payment_succeeded` with `payment_status = paid`, the session must be the one created for the order (`client_reference_id` and `metadata.order_id`), its line items must add up to `amount_total`, and the amount and currency must equal what the server stored. Then the order becomes `paid` and the customer, phone and UK address Stripe collected are saved. Fulfilment starts as `unfulfilled`, which the dashboard shows as Paid.
4. **No duplicates:** the order already exists (created pending at checkout, with its item snapshot). The Stripe Checkout Session id is stored on it with a database UNIQUE constraint, and the update is a compare-and-set on `payment_status = 'pending'`. A retried or replayed event finds the order already paid and does nothing.

Events handled: `checkout.session.completed`, `checkout.session.async_payment_succeeded` (pay), `checkout.session.expired` (marks the order `expired`, after confirming with Stripe). Failed asynchronous payments are ignored on purpose: the session stays open and can be retried, and the order stays pending. A pending, expired or failed order is never shown to the merchant and never counts as a sale.

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

## Receipts and emails

This store sends no email in version 1. Stripe's own customer receipt is a separate Stripe setting (Dashboard, Settings, Customer emails, "Successful payments"), and in **test mode Stripe does not send receipts to customers**, so a test payment never produces an email. The thank-you page therefore makes no promise of one. Emailing the order confirmation and the proof is a later feature.
