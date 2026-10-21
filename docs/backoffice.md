# Back office

## Phase 1: foundation

The store dashboard remains at `#/admin`. Existing Orders and Products screens are unchanged. Sales, Support, Catalogue and Settings are staff-only placeholders until their phases are built.

The database uses the existing `emblara_app` role for staff/server work and the new `emblara_portal` role for future customer-link routes. The portal role has no table privileges. In offline mode, any future back-office route that needs the portal role returns HTTP 503 with: “The back office needs the database.”

`public.emblara_migrations` records applied migration files. On an existing store database, the runner records `001_emblara_store.sql` as already applied before applying later migrations. It supports `--set-passwords`, `--roles=emblara_app,emblara_public,emblara_portal`, and `--env-out=<file>`.

## What is not built yet

No customer portal route, sales record, catalogue record, support ticket, artwork file or production order exists in Phase 1.
