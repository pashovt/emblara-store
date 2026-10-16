# Prompt for the chat that manages the Rest & Relax (rr-website) project

Paste everything below the line into that chat.

---

The Supabase project that rr-website uses is now **shared** with a second business, Emblara (POD workwear). Same project, separate schemas. Nothing of yours should change, but from now on please follow these rules so the two never interfere.

**What was added (additive only, nothing of rr-website was altered)**
- Schema `emblara` with tables `products`, `orders`, `order_items`, `staff`, all with RLS, and the function `emblara.is_staff()`.
- Storage bucket `emblara-products` (public read, staff-only write policies that each name that bucket).
- `emblara` was added to the API's exposed schemas, alongside the existing ones.

**Rules for rr-website work from now on**
1. Do not touch the `emblara` schema, the `emblara-products` bucket, or any policy that names them. Never run a schema-wide removal, or bulk operations over `storage.objects` or `storage.buckets` without a `bucket_id` filter.
2. Keep rr-website's tables where they are (`public`, or move them into an `rr` schema only as a deliberate, separate migration). If you ever change the exposed schemas (`pgrst.db_schemas` or Project Settings → API), keep `emblara` in the list.
3. Name new Storage buckets with an `rr-` prefix and write every Storage policy with `bucket_id = '<that bucket>'`. Never write a Storage policy without a bucket condition.
4. `auth.users` is shared. Emblara's staff are rows in `emblara.staff`; rr-website must not treat "signed in" or any user-metadata flag as admin for Emblara, and Emblara does the same for rr. If rr-website has its own admin or staff concept, keep it in an rr-owned table (for example `rr.staff` or the existing equivalent), never in a project-wide flag.
5. Do not delete or edit auth users you did not create, and do not add auth triggers that create rows for every new user (for example profile tables) without checking they do not touch `emblara`.
6. The service-role key is shared. It must stay server-side. If either site leaks it, rotate it and update both Vercel projects.
7. Treat any DDL against this project as production for two businesses: additive migrations only, no destructive statements, and show me the SQL before it runs.

**What I need from you first (read-only)**
- List rr-website's current schemas, tables, RLS policies, Storage buckets and policies, and any `auth` triggers or functions.
- Say how rr-website defines admin or staff today and where that is stored.
- Confirm none of that conflicts with the rules above, or list the conflicts.
- Tell me which Supabase env vars rr-website uses (names only, never values).

Do not run any SQL that changes data or structure until I have read your findings.
