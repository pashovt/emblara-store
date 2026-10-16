# Emblara on the shared Supabase project

One Supabase project serves several of our own small businesses. Each business gets its **own schema**, its **own prefixed Storage bucket** and its **own staff table**. `auth.users` and the service-role key are shared by the whole project, so those rules matter.

This document covers Emblara (`emblara` schema, `emblara-products` bucket). It is also the template for the next business.

## What exists

| Piece | Name | Notes |
|---|---|---|
| Schema | `emblara` | Created by `supabase/migrations/001_emblara_store.sql`. Nothing in `public` is touched. |
| Tables | `emblara.products`, `orders`, `order_items`, `staff` | RLS enabled on all four. |
| Function | `emblara.is_staff()` | `security definer`, empty `search_path`. Checks `emblara.staff` for `auth.uid()`. |
| Bucket | `emblara-products` | Public read, 4 MB, PNG/JPEG/WebP. Staff-only write policies, each naming this bucket. |
| Auth | shared `auth.users` | Signed in is **not** staff. Staff = a row in `emblara.staff`. |

## Models

**Products.** `id`, `slug`, `name`, `category`, `kind` (garment or service), `blurb`, `material`, `fabric`, `price_pence` (services only), `config` (the supplier-cost model the shop prices garments from), `images`, `published`, `available`, `sort`, `created_at`, `updated_at`. No variants table, no inventory.

**Publication.** `published` (draft until the merchant publishes) and `available` (the whole stock model). The anonymous role can read a row only when `published and available`, enforced by RLS and a column-level grant, not by the frontend. The shop API (service role) still lists published-but-unavailable products so the card can say "Unavailable"; the anonymous Supabase API cannot see them.

**Money.** Integer pence, GBP only (`currency check (currency = 'gbp')`). Order totals and line amounts are integers. Garment prices are computed server-side in whole pence from `config`; the browser never supplies an amount. `config` holds supplier costs in pounds as pricing-model inputs, not as Stripe amounts.

**Orders.** `number`, `amount_total_pence`, `payment_status` (`pending`, `paid`, `expired`), `fulfillment_status` (`unfulfilled`, `processing`, `fulfilled`), `stripe_session_id`, `stripe_payment_intent`, contact and shipping details collected by Stripe Checkout, `notes`, `artwork`, `paid_at`, `created_at`. A check constraint forbids a fulfilment state on an unpaid order. No card data is stored. The dashboard shows Paid → Processing → Fulfilled, derived from those two columns.

**Order items (snapshot).** `product_name`, `product_slug`, `options`, `quantity`, `unit_amount_pence`, `line_amount_pence` are copied at checkout. `product_id` is a reference only and becomes `null` if a product is ever deleted. Editing or deleting a product never rewrites a paid order.

## Access model

| Role | products | orders / order_items | staff | Storage `emblara-products` |
|---|---|---|---|---|
| anon | read published AND available rows, public columns only | nothing | nothing | read by public URL; no write |
| authenticated, not staff | same as anon | nothing | own row only (none) | no write |
| authenticated staff | read all, insert, update, no delete | read | own row | insert, update, delete |
| service role (server only) | all | all | all | all |

Nobody in a browser role can change a payment or fulfilment state. The server does it after verifying a Stripe signature (payment) or a staff session (fulfilment). Staff status is a row in `emblara.staff`; browser roles have no insert, update or delete privilege there, and it is not read from `localStorage`, user metadata or any claim the user can edit.

## Run order

1. **Review** `supabase/migrations/001_emblara_store.sql`. It is additive, has no destructive statements, and stops with a warning if an `emblara` table already exists.
2. **Apply it** (SQL Editor, or the Supabase MCP `apply_migration`).
3. **Expose the schema.** Dashboard: Project Settings → API → Exposed schemas → add `emblara`. Or in the SQL Editor, first read the current value, then set it with `emblara` appended and nothing removed:

   ```sql
   select rolconfig from pg_roles where rolname = 'authenticator';
   -- then, using the schemas you saw plus emblara:
   alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, emblara';
   notify pgrst, 'reload config';
   notify pgrst, 'reload schema';
   ```
4. **Grant the first merchant** with `supabase/first-staff.sql` (create the user in Authentication → Users first, never by public sign-up).
5. **Env vars** (Vercel and local): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ADMIN_SESSION_SECRET`, plus `SUPABASE_SCHEMA=emblara` and `SUPABASE_BUCKET=emblara-products` (these two are the defaults). Never commit values.
6. `npm run seed` loads the launch range once (only when `emblara.products` is empty).

## Checks to run after applying

```sql
-- RLS on for every table
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'emblara' and c.relkind = 'r';

-- Anonymous sees only public products and cannot touch orders
begin;
set local role anon;
select count(*) from emblara.products;   -- only published AND available rows
select count(*) from emblara.orders;     -- must fail: permission denied
rollback;
```

## Rules for the next business

1. New schema named for the business (`rr`, `clientx`), added to Exposed schemas without removing the others.
2. Every table in that schema, RLS on, no `using (true)` for private data.
3. A per-business staff table keyed by `auth.users.id`, and an `is_staff()` function in that schema. Never a global "is staff" flag.
4. A prefixed bucket (`<business>-<purpose>`) and Storage policies that name `bucket_id = '<that bucket>'`.
5. The service-role key stays on the server. One leaked key exposes every business, so rotate it if it ever leaks.
6. Client work, where the client is the UK GDPR controller, gets its own Supabase project, not a schema here.
7. A live shop should not sit on a free project: free projects pause after a week of inactivity.

## Limits to remember

- All businesses share one `auth.users` pool. Customers of one business can sign up in the same pool as another's; staff tables are what keep them apart.
- Anyone holding the anon key can call any exposed schema. RLS, not obscurity, protects each business.
