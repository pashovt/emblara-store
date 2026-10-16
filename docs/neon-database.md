# Emblara database on Neon

One dedicated Neon project, `emblara-store` (`aws-eu-central-1`, Frankfurt: the nearest region with Neon Object Storage). Plain Postgres plus an S3-compatible bucket. There is no PostgREST, no Data API and no browser database connection: **only the store server talks to the database**, through two least-privilege roles.

Nothing here is shared with Rest & Relax or any other business, so none of the shared-project rules (schemas per business, prefixed buckets) are needed. Neon isolates by project.

## What exists

| Piece | Name | Notes |
|---|---|---|
| Project | `emblara-store` | org `org-polished-meadow-53904041`, branch `main`. Linked by `.neon` (git-ignored). |
| Schema | `emblara` | Created by `db/migrations/001_emblara_store.sql`. |
| Tables | `products`, `orders`, `order_items`, `staff` | RLS enabled on all four. |
| Roles | `emblara_public`, `emblara_app` | Login roles that own nothing, so RLS applies to both. |
| Functions | `emblara.is_staff()`, `staff_login()`, `flow()` | The first two are `security definer` with an empty `search_path`. Only `emblara_app` can run them. |
| Bucket | `emblara-products` | Neon Object Storage, `public_read`. Declared in `neon.ts`. |

## Models

**Products.** `id`, `slug`, `name`, `category`, `kind` (garment or service), `blurb`, `material`, `fabric`, `price_pence` (services only), `config` (the supplier-cost model garments are priced from), `images` (bucket object keys; the first is primary), `published`, `available`, `sort`, `created_at`, `updated_at`. No variants table, no inventory.

**Publication.** `published` (draft until the merchant publishes) and `available` (the whole stock model). The public reader sees a row only when `published and available`, enforced by a row-level policy and a column grant (it cannot even select the `published` column). An unavailable product disappears from the shop and its product page. Checkout also refuses it if it is already in someone's bag.

**Money.** Integer pence, GBP only (`currency check (currency = 'gbp')`). Order totals and line amounts are integers. Garment prices are computed server-side in whole pence from `config`; the browser never supplies an amount.

**Orders.** `number`, `amount_total_pence`, `payment_status` (`pending`, `paid`, `expired`), `fulfillment_status` (`unfulfilled`, `processing`, `fulfilled`), `stripe_session_id`, `stripe_payment_intent`, contact and shipping details collected by Stripe Checkout, `notes`, `artwork`, `paid_at`, `created_at`. A table constraint forbids a fulfilment state on an unpaid order. No card data is stored. The dashboard shows Paid, Processing, Fulfilled, derived from the two columns.

**Order items (snapshot).** `product_name`, `product_slug`, `options`, `quantity`, `unit_amount_pence`, `line_amount_pence` are copied at checkout. `product_id` is a reference only and becomes `null` if a product is ever deleted. Editing or deleting a product never rewrites a paid order.

**Photos.** The database stores object keys (`products/<name>`), not URLs. The server builds the public URL from `AWS_ENDPOINT_URL_S3`. Only the server uploads (it checks the file's real type: PNG, JPEG or WebP, 4 MB). Put a CDN in front of the bucket before launch; every new photo is written to a new key.

## How "staff" is enforced (Neon has no `auth.uid()`)

1. A staff member is a row in `emblara.staff` (`email`, bcrypt `password_hash`, `active`). Nobody can create one through the website.
2. Sign-in calls `emblara.staff_login(email, password)`. The password is checked inside Postgres; neither runtime role can read the table or the hashes.
3. The server issues a signed, HttpOnly, SameSite=Strict cookie holding the staff id.
4. On every dashboard request the server re-checks that the staff row is still active, then opens each database transaction with two transaction-local settings: `emblara.staff_id` and `emblara.flow`.
5. The policies read those settings through `emblara.is_staff()` and `emblara.flow()`. Product writes and fulfilment changes require `is_staff()`. Checkout and the webhook get a narrow, named flow each.

Honest limit: the settings are set by server code. The database cannot tell a genuine staff request from code that lies about it, so the protection is "a bug or a missing check in a normal request cannot write", not "a compromised server is contained". Browsers have no database access at all, so there is no browser role to attack.

## Access model

| Who | Can do |
|---|---|
| Visitors | Nothing directly. Their catalogue request is served by `emblara_public`: published AND available product columns only. Orders, items and staff are unreachable. |
| Checkout flow | Read products to price a bag; create an order that is `pending` and `unfulfilled`; attach the Stripe session; remove its own pending order. |
| Webhook flow | Read an order; move a `pending` order to `paid` or `expired`. Cannot create orders, cannot touch fulfilment. |
| Status page flow | Read an order by its Stripe session. |
| Staff (verified session) | Read products and orders; create and update products (no delete); move a paid order one step forward. |
| Nobody | Remove a product or a paid order; move a payment state backwards; read card data (none exists). |

## Setup (already done for this project)

```bash
neon link --org-id org-polished-meadow-53904041 --project-name emblara-store --region-id aws-eu-central-1
neon deploy                             # creates the emblara-products bucket from neon.ts
npm run db:migrate -- --set-passwords   # schema + RLS + roles; random role passwords go to .env.local
npm run seed                            # the 9 launch products, only if the table is empty
```

### Grant the first merchant

Run on your own machine, once. It prompts for the email and a password (hidden, 12+ characters), hashes it inside Postgres and prints nothing secret:

```bash
npm run db:create-staff
```

Alternative in the Neon SQL Editor (the password then appears in query history, so prefer the script):

```sql
insert into emblara.staff (email, password_hash)
values (lower('OWNER@EXAMPLE.COM'), public.crypt('CHOOSE-A-LONG-PASSWORD', public.gen_salt('bf', 12)))
returning id, email;
```

To set a new password for an existing login (also re-activates it): `npm run db:create-staff -- --reset`.

To revoke someone: `update emblara.staff set active = false where email = '...';` (takes effect on their next request).

## Environment variables

Local: all in `.env.local`, written by `neon link`, `neon deploy` and `npm run db:migrate -- --set-passwords`. Never commit values.

| Variable | Used by | Source |
|---|---|---|
| `EMBLARA_APP_DATABASE_URL` | store server (role `emblara_app`, pooled) | `db:migrate --set-passwords` |
| `EMBLARA_PUBLIC_DATABASE_URL` | catalogue reads (role `emblara_public`, pooled) | `db:migrate --set-passwords` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | photo uploads and URLs | `neon deploy` / `neon env pull` |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | admin scripts only (owner) | `neon link` |
| `ADMIN_SESSION_SECRET` | dashboard session cookie | you |
| `STRIPE_SECRET_KEY` | creates Checkout Sessions (server only; `sk_test_...` now, the live key at launch) | Stripe dashboard, Developers, API keys |
| `STRIPE_WEBHOOK_SECRET` | verifies webhook signatures (`whsec_...`) | the webhook endpoint in the Stripe dashboard |
| `SITE_URL` | optional public origin for Stripe redirects | you |

**Vercel** (project `emblara-store`, Production and Preview; done 2026-10-16): `EMBLARA_APP_DATABASE_URL`, `EMBLARA_PUBLIC_DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (all Sensitive), `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, and a Vercel-only `ADMIN_SESSION_SECRET` (Sensitive). The owner `DATABASE_URL*` is deliberately not in Vercel: the running site never needs it. The store refuses to start on Vercel without the two role URLs. Preview deployments currently share the production database; create a Neon dev branch for them if that becomes a concern. Stripe variables come next.

## Check the rules hold

```bash
npm run db:check
```

Connects as the real `emblara_public` and `emblara_app` roles and proves 28 things, for example: the public role sees only published AND available rows and cannot read orders or staff; the server with no context can neither read an order nor write a product; checkout cannot create a paid or fulfilled order; the webhook flow can mark a pending order paid but not fulfil it; a made-up staff id is not staff; staff cannot remove a product or fulfil an unpaid order; `staff_login` rejects a wrong password. Every write is rolled back; one throwaway staff row is removed at the end.

## Limits and decisions

- **Region.** Frankfurt, not London, because Object Storage is not offered in `aws-eu-west-2`. Data stays in the EU.
- **Neon plans (from neon.com/pricing, 2026-10-16).** Free: 100 projects, 1 GB Postgres per project, 100 CU-hours per project, 5 GB Object Storage, 5 GB public egress per project, 10 branches, Auth to 60k MAU, scale-to-zero after 5 minutes (cannot be turned off), and only a **6-hour** restore history with no instant restore. Running out of CU-hours or egress suspends compute until the next billing period; over 1 GB blocks writes; none of it deletes data. Launch lifts the restore window to 7 days and adds instant restore; Scale gives 30 days, an uptime SLA and IP Allow. For a shop taking real orders, move to Launch first: 6 hours is too short a safety net for order data, and the 5 GB egress cap includes product photos served from the bucket (a CDN in front of it helps).
- **Neon Auth** (managed Better Auth) was not used: one merchant does not need an identity service, and `emblara.staff` keeps the rule inside the database. Revisit if customers ever get accounts.
- **Backups.** Restore history is 6 hours on Free and 7 days on Launch (see above). Consider a scheduled `pg_dump` of `emblara` to a place you control before launch.
