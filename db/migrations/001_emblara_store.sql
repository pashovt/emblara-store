-- EMBLARA store on Neon (plain Postgres). Schema `emblara`.
--
-- Additive only: nothing is dropped and no existing object is altered. If any
-- emblara table already exists this stops with a warning instead of replacing it.
-- Run as the project owner (scripts/migrate.mjs, or the Neon SQL Editor).
--
-- How access works on Neon (there is no PostgREST and no browser database role):
--   * browsers never connect to the database; only the server does
--   * the server uses two LOGIN roles, neither of which owns the tables, so RLS
--     applies to both:
--       emblara_public  read-only, sees published AND available products, nothing else
--       emblara_app     the store server; every policy below narrows what it can do
--   * "staff" is a row in emblara.staff. The server verifies the staff session, then
--     sets two transaction-local settings (emblara.staff_id, emblara.flow). Policies
--     check them, so a request that is not staff cannot write products or change a
--     fulfilment state even if application code has a bug
--   * passwords for the two roles are set by scripts/migrate.mjs, never in SQL

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

create extension if not exists pgcrypto with schema public;
create schema if not exists emblara;

-- ----------------------------------------------------------------- roles
do $roles$
begin
  if exists (select 1 from pg_roles where rolname = 'emblara_app') then
    raise notice 'Role emblara_app already exists; left as it is.';
  else
    create role emblara_app login noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
  if exists (select 1 from pg_roles where rolname = 'emblara_public') then
    raise notice 'Role emblara_public already exists; left as it is.';
  else
    create role emblara_public login noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
end
$roles$;

-- ----------------------------------------------------------------- staff
-- Who may use the Store Dashboard. Rows are created only by scripts/create-staff.mjs
-- (owner connection) or the SQL Editor. Neither runtime role can read or write this
-- table: it is reached only through the two functions below.
create table emblara.staff (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email)),
  password_hash text not null,           -- bcrypt via pgcrypto crypt(); never a plain password
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Per-request context, set by the server inside each transaction (set_config(..., true)).
create function emblara.flow() returns text
language sql stable set search_path = ''
as $$ select nullif(current_setting('emblara.flow', true), '') $$;

-- SECURITY DEFINER: policies can ask "is this request a live staff member?" without
-- the runtime role being able to read emblara.staff.
create function emblara.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from emblara.staff s
    where s.active and s.id = nullif(current_setting('emblara.staff_id', true), '')::uuid
  );
$$;

-- Sign-in check. Returns the staff id, or null. The password is checked inside the database.
create function emblara.staff_login(p_email text, p_password text) returns uuid
language sql stable security definer set search_path = ''
as $$
  select s.id from emblara.staff s
  where s.active and s.email = lower(p_email) and s.password_hash = public.crypt(p_password, s.password_hash);
$$;

-- -------------------------------------------------------------- products
-- Money is integer pence (GBP only). `config` holds the supplier-cost model the shop
-- prices garments from; what a customer pays is computed server-side in whole pence.
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
  images      jsonb not null default '[]'::jsonb,  -- object keys in the emblara-products bucket; first is primary
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
-- verified Stripe webhook; fulfillment_status only for staff.
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
-- or deleting a product never rewrites a paid order. product_id is a reference only
-- (set null if the product is ever deleted).
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
revoke all on schema emblara from public;
grant usage on schema emblara to emblara_app, emblara_public;
revoke all on function emblara.is_staff(), emblara.staff_login(text, text), emblara.flow() from public;
-- Only the store server may call these; the public reader can call none of them.
grant execute on function emblara.is_staff(), emblara.staff_login(text, text), emblara.flow() to emblara_app;

-- Public reader: published AND available products, public columns only. Nothing else.
grant select (id, slug, name, category, kind, blurb, material, fabric, price_pence, config, images, available, sort)
  on emblara.products to emblara_public;
create policy products_public_read on emblara.products
  for select to emblara_public
  using (published and available);

-- Store server, products: reads for staff or for the checkout flow (to price a bag
-- and say why an item is refused); writes for staff only; no delete.
grant select, insert, update on emblara.products to emblara_app;
create policy products_app_read on emblara.products
  for select to emblara_app
  using ((select emblara.is_staff()) or (select emblara.flow()) = 'checkout');
create policy products_staff_insert on emblara.products
  for insert to emblara_app with check ((select emblara.is_staff()));
create policy products_staff_update on emblara.products
  for update to emblara_app
  using ((select emblara.is_staff())) with check ((select emblara.is_staff()));

-- Store server, orders. Reads: staff, or the checkout / webhook / status-page flows.
grant select, insert, update, delete on emblara.orders to emblara_app;
create policy orders_read on emblara.orders
  for select to emblara_app
  using ((select emblara.is_staff()) or (select emblara.flow()) in ('checkout', 'webhook', 'status'));
-- A new order can only be created pending and unfulfilled, by the checkout flow.
create policy orders_insert on emblara.orders
  for insert to emblara_app
  with check ((select emblara.flow()) = 'checkout' and payment_status = 'pending' and fulfillment_status = 'unfulfilled');
-- Payment: only a pending order, only by checkout (to attach the Stripe session) or the
-- verified-webhook flow, and it can never touch fulfilment.
create policy orders_payment_update on emblara.orders
  for update to emblara_app
  using (payment_status = 'pending' and (select emblara.flow()) in ('checkout', 'webhook'))
  with check (payment_status in ('pending', 'paid', 'expired') and fulfillment_status = 'unfulfilled');
-- Fulfilment: staff only, only on a paid order.
create policy orders_fulfilment_update on emblara.orders
  for update to emblara_app
  using ((select emblara.is_staff()) and payment_status = 'paid')
  with check ((select emblara.is_staff()) and payment_status = 'paid');
-- Checkout may remove its own still-pending order if saving the lines fails.
create policy orders_pending_delete on emblara.orders
  for delete to emblara_app
  using ((select emblara.flow()) = 'checkout' and payment_status = 'pending');

grant select, insert on emblara.order_items to emblara_app;
create policy order_items_read on emblara.order_items
  for select to emblara_app
  using ((select emblara.is_staff()) or (select emblara.flow()) in ('checkout', 'webhook', 'status'));
create policy order_items_insert on emblara.order_items
  for insert to emblara_app
  with check ((select emblara.flow()) = 'checkout');

-- emblara.staff: RLS on and NO policy and NO grant for either runtime role.

commit;
