# Back office

## Phase 1: foundation

The store dashboard remains at `#/admin`. Existing Orders and Products screens are unchanged. Sales, Support, Catalogue and Settings are staff-only placeholders until their phases are built.

The database uses the existing `emblara_app` role for staff/server work and the new `emblara_portal` role for future customer-link routes. The portal role has no table privileges. In offline mode, any future back-office route that needs the portal role returns HTTP 503 with: “The back office needs the database.”

`public.emblara_migrations` records applied migration files. On an existing store database, the runner records `001_emblara_store.sql` as already applied before applying later migrations. It supports `--set-passwords`, `--roles=emblara_app,emblara_public,emblara_portal`, and `--env-out=<file>`.

## Phase 2: catalogue and business profile

`db/catalogue/price-list.json` is the approved source price list. Load or refresh it with `npm run db:import-catalogue`; the import preserves history by marking missing items inactive instead of deleting them. Catalogue items are linked to website products explicitly in the staff dashboard, never by a name match.

The monthly order figure is a warning only. It counts paid website order line quantities for the linked product from the start of the current Europe/London calendar month. The expected threshold is 100 individual garments and never blocks a sale.

Stock is optional per catalogue item. When tracked, staff can only adjust it through the append-only IN/OUT ledger; an OUT movement requires a note and cannot make stock negative. The business profile and quotation defaults are also written through database functions, not direct table updates.

## Phase 3: sales and quotation requests

The public quote request page is `#/request`. A request is stored only through the restricted portal role; the role has no direct table privileges. Staff can create clients, draft invoices, add invoice lines, progress invoices from draft to sent to paid, and download a generated PDF. Each download stores a staff-only PDF copy against its invoice. Private quotation links use `#/q/<token>` and send the token in an HTTP header, not a URL query string. Tokens are SHA-256 hashed in the database, while the recoverable staff link is encrypted with `LINK_ENCRYPTION_KEY`. These routes are noindex and their API responses set `Referrer-Policy: no-referrer`.

## What is not built yet

The full customer account portal, sales records, support tickets, artwork files and production orders are not built yet. Quotation email delivery is added with the email workflow phase; until then staff can copy the private link.

## Phase 4: orders and artwork

### Upload spike

Neon Object Storage has an S3-compatible presigned `PUT` flow. The server can create a short-lived, content-type-bound upload capability without exposing storage credentials, so customer originals can upload directly to the private `emblara-artwork` bucket. Vercel Functions have a 4.5 MB request-body limit, which rules out routing the allowed 25 MB originals through the application server. The browser upload needs the bucket to permit the store origin for `PUT`; that configuration is verified when the owner runs `neon deploy`.
