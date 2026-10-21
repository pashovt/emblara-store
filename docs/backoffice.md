# Back office

## Phase 1: foundation

The store dashboard remains at `#/admin`. Existing Orders and Products screens are unchanged. Sales, Support, Catalogue and Settings are staff-only placeholders until their phases are built.

The database uses the existing `emblara_app` role for staff/server work and the new `emblara_portal` role for future customer-link routes. The portal role has no table privileges. In offline mode, any future back-office route that needs the portal role returns HTTP 503 with: “The back office needs the database.”

`public.emblara_migrations` records applied migration files. On an existing store database, the runner records `001_emblara_store.sql` as already applied before applying later migrations. It supports `--set-passwords`, `--roles=emblara_app,emblara_public,emblara_portal`, and `--env-out=<file>`.

## Phase 2: catalogue and business profile

`db/catalogue/price-list.json` is the approved source price list. Load or refresh it with `npm run db:import-catalogue`; the import preserves history by marking missing items inactive instead of deleting them. Catalogue items are linked to website products explicitly in the staff dashboard, never by a name match.

The monthly order figure is a warning only. It counts paid website order line quantities for the linked product from the start of the current Europe/London calendar month. The expected threshold is 100 individual garments and never blocks a sale.

Stock is optional per catalogue item. When tracked, staff can only adjust it through the append-only IN/OUT ledger; an OUT movement requires a note and cannot make stock negative. The business profile and quotation defaults are also written through database functions, not direct table updates.

## What is not built yet

No customer portal route, sales record, support ticket, artwork file or production order exists yet.
