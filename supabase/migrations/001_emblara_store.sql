-- EMBLARA store: schema `emblara` inside the shared Supabase project.
--
-- Additive only: nothing is dropped and no existing object is altered. If any
-- emblara table already exists this stops with a warning instead of replacing it.
--
-- Shared project rules (see docs/shared-supabase-project.md):
--   * everything lives in this business's own schema
--   * staff are a per-business table (emblara.staff), never a global flag
--   * Storage uses the prefixed bucket `emblara-products`, and every Storage
--     policy names that bucket
--   * the service-role key is used only by the server (server/db.js)
--
-- After running: expose the schema to the API (docs, "Expose the schema"),
-- then grant the first merchant with supabase/first-staff.sql.

begin;

do $guard$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'emblara' and table_name in ('products', 'orders', 'order_items', 'staff')
  ) then
    raise exception 'WARNING: tables already exist in schema emblara. Nothing was changed. Review them before running this migration.';
  end if;
end
$guard$;

create schema if not exists emblara;

-- ----------------------------------------------------------------- staff
-- Who may use the Store Dashboard, keyed by the Supabase Auth user id. A signed-in
-- user cannot add or change rows: browser roles get no insert/update/delete
-- privilege and no such policy, so rows are created only in the SQL Editor or by
-- the service role.
create table emblara.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER so policies can check the staff table without exposing it.
-- Empty search_path and qualified names: it cannot be hijacked.
create function emblara.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from emblara.staff s where s.user_id = (select auth.uid()));
$$;
revoke all on function emblara.is_staff() from public, anon;
grant execute on function emblara.is_staff() to authenticated, service_role;

-- -------------------------------------------------------------- products
-- Money is integer pence (GBP only). `config` holds the supplier-cost model the
-- shop prices garments from (colours, finishes, sizes, positions, costs); what a
-- customer pays is always computed server-side in whole pence.
create table emblara.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 2 and 80),
  category    text not null,
  kind        text not null default 'garment' check (kind in ('garment', 'service')),
  blurb       text not null default '' check (char_length(blurb) <= 600),
  material    text,
  fabric      text,
  price_pence integer check (price_pence is null or price_pence > 0),  -- services only
  config      jsonb not null default '{}'::jsonb,
  images      jsonb not null default '[]'::jsonb,  -- public URLs in emblara-products; first is primary
  published   boolean not null default false,       -- draft until the merchant publishes
  available   boolean not null default true,        -- the whole stock model
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint service_has_price check (kind <> 'service' or price_pence is not null)
);
create index products_public_idx on emblara.products (sort, name) where published and available;

create function emblara.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on emblara.products
  for each row execute function emblara.touch_updated_at();

-- ---------------------------------------------------------------- orders
-- No card data is ever stored; Stripe holds it. payment_status changes only on a
-- verified Stripe webhook; fulfillment_status only through the dashboard API.
create table emblara.orders (
  id                    uuid primary key default gen_random_uuid(),
  number                text not null unique,
  currency              text not null default 'gbp' check (currency = 'gbp'),
  amount_total_pence    integer not null check (amount_total_pence > 0),
  payment_status        text not null default 'pending' check (payment_status in ('pending', 'paid', 'expired')),
  fulfillment_status    text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'processing', 'fulfilled')),
  stripe_session_id     text unique,
  stripe_payment_intent text,
  email                 text,
  customer_name         text,
  phone                 text,
  shipping              jsonb,   -- address collected by Stripe Checkout
  notes                 text,
  artwork               text check (artwork in ('later', 'attached')),
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint fulfilment_needs_payment check (fulfillment_status = 'unfulfilled' or payment_status = 'paid')
);
create index orders_dashboard_idx on emblara.orders (paid_at desc) where payment_status = 'paid';
create trigger orders_touch before update on emblara.orders
  for each row execute function emblara.touch_updated_at();

-- ----------------------------------------------------------- order items
-- Snapshot at purchase: name, options, quantity and amounts are copied, so editing
-- or deleting a product never rewrites a paid order. product_id is a reference
-- only (set null if the product is ever deleted).
create table emblara.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references emblara.orders (id) on delete cascade,
  product_id        uuid references emblara.products (id) on delete set null,
  product_slug      text not null,
  product_name      text not null,
  options           jsonb not null default '{}'::jsonb,
  quantity          integer not null check (quantity > 0),
  unit_amount_pence integer not null check (unit_amount_pence >= 0),
  line_amount_pence integer not null check (line_amount_pence >= 0),
  created_at        timestamptz not null default now()
);
create index order_items_order_idx on emblara.order_items (order_id);

-- ------------------------------------------------------------------- RLS
alter table emblara.staff       enable row level security;
alter table emblara.products    enable row level security;
alter table emblara.orders      enable row level security;
alter table emblara.order_items enable row level security;

-- Privileges first (a new schema starts with none), then policies narrow them.
grant usage on schema emblara to anon, authenticated, service_role;
grant all on all tables in schema emblara to service_role;

-- Public: published AND available products only, public columns only.
grant select (id, slug, name, category, kind, blurb, material, fabric, price_pence, config, images, available, sort)
  on emblara.products to anon, authenticated;
create policy products_public_read on emblara.products
  for select to anon, authenticated
  using (published and available);

-- Staff (signed in AND listed in emblara.staff): manage products, no delete.
grant select, insert, update on emblara.products to authenticated;
create policy products_staff_read on emblara.products
  for select to authenticated using ((select emblara.is_staff()));
create policy products_staff_insert on emblara.products
  for insert to authenticated with check ((select emblara.is_staff()));
create policy products_staff_update on emblara.products
  for update to authenticated
  using ((select emblara.is_staff())) with check ((select emblara.is_staff()));

-- Orders and items: staff may read. NO browser role may insert or update, so
-- fulfilment changes go through the server after it verifies staff. Anonymous: nothing.
grant select on emblara.orders, emblara.order_items to authenticated;
create policy orders_staff_read on emblara.orders
  for select to authenticated using ((select emblara.is_staff()));
create policy order_items_staff_read on emblara.order_items
  for select to authenticated using ((select emblara.is_staff()));

-- Staff table: a signed-in user may see only their own row. No write path exists.
grant select on emblara.staff to authenticated;
create policy staff_read_self on emblara.staff
  for select to authenticated using (user_id = (select auth.uid()));

-- --------------------------------------------------------------- Storage
-- Public-read bucket for product photos. Public URLs need no policy; the policies
-- below are the only browser write path, and they name this bucket and need staff.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'emblara-products', 'emblara-products', true, 4194304, array['image/png', 'image/jpeg', 'image/webp']
where not exists (select 1 from storage.buckets where id = 'emblara-products');

create policy emblara_products_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'emblara-products' and (select emblara.is_staff()));
create policy emblara_products_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'emblara-products' and (select emblara.is_staff()))
  with check (bucket_id = 'emblara-products' and (select emblara.is_staff()));
create policy emblara_products_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'emblara-products' and (select emblara.is_staff()));

commit;
