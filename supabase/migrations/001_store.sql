-- Emblara store: products, paid orders, order lines, authorised staff.
-- All access goes through the server with the service-role key. RLS is on and
-- there are NO policies, so the anon/authenticated keys can read nothing.
-- Names are prefixed store_ so this can share a Supabase project safely.

create extension if not exists pgcrypto;

create table if not exists store_products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  category    text not null,
  kind        text not null default 'garment' check (kind in ('garment', 'service')),
  blurb       text not null default '',
  material    text,
  fabric      text,
  price       numeric(10, 2) check (price is null or price > 0), -- services only
  config      jsonb not null default '{}'::jsonb,                -- colours, finishes, sizes, positions, costs
  images      jsonb not null default '[]'::jsonb,                -- uploaded image URLs
  published   boolean not null default false,
  available   boolean not null default true,                     -- the whole stock model
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists store_orders (
  id                    uuid primary key default gen_random_uuid(),
  number                text not null unique,
  status                text not null default 'pending_payment'
                          check (status in ('pending_payment', 'paid', 'processing', 'fulfilled', 'cancelled')),
  currency              text not null default 'gbp',
  amount_total_pence    int  not null check (amount_total_pence > 0),
  stripe_session_id     text unique,
  stripe_payment_intent text,
  email                 text,
  customer_name         text,
  phone                 text,
  shipping              jsonb,            -- address collected by Stripe Checkout
  notes                 text,
  artwork               text,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists store_orders_status_idx on store_orders (status, paid_at desc);

-- Snapshot: name, options, quantity and amounts are copied at checkout, so a
-- later price change never touches a paid order. product_id is kept for
-- reference only and is nulled if the product is ever deleted.
create table if not exists store_order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references store_orders (id) on delete cascade,
  product_id        uuid references store_products (id) on delete set null,
  product_slug      text not null,
  product_name      text not null,
  options           jsonb not null default '{}'::jsonb,
  quantity          int not null check (quantity > 0),
  unit_amount_pence int not null check (unit_amount_pence >= 0),
  line_amount_pence int not null check (line_amount_pence >= 0),
  created_at        timestamptz not null default now()
);
create index if not exists store_order_items_order_idx on store_order_items (order_id);

-- Who may use the Store Dashboard. Add a row, then create the same email under
-- Authentication > Users in Supabase. Sign-in is checked against both.
create table if not exists store_staff (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table store_products    enable row level security;
alter table store_orders      enable row level security;
alter table store_order_items enable row level security;
alter table store_staff       enable row level security;

-- Public product images. Reads are public; writes happen only server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
