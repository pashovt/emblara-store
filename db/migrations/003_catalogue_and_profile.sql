begin;

do $guard$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'invoicing' and table_name = 'catalogue_items') then
    raise exception 'Catalogue already exists. Refusing to replace it.';
  end if;
end
$guard$;

create type invoicing.decoration_method as enum ('print', 'embroidery');
create type invoicing.stock_movement_type as enum ('IN', 'OUT');

create table invoicing.business_profile (
  id smallint primary key default 1 check (id = 1),
  trading_name text not null check (btrim(trading_name) <> '' and char_length(trading_name) <= 120),
  legal_name text check (char_length(legal_name) <= 200), address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200), city text check (char_length(city) <= 100),
  postcode text check (char_length(postcode) <= 16), country text not null default 'United Kingdom' check (char_length(country) <= 100),
  company_number text check (company_number ~ '^[A-Za-z0-9]{8}$'), email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),
  phone text check (char_length(phone) <= 40), bank_account_name text check (char_length(bank_account_name) <= 120),
  bank_sort_code text check (bank_sort_code ~ '^[0-9]{2}-[0-9]{2}-[0-9]{2}$'), bank_account_number text check (bank_account_number ~ '^[0-9]{8}$'),
  default_payment_terms_days integer not null default 14 check (default_payment_terms_days between 1 and 120),
  default_deposit_percent numeric(5,2) not null default 100 check (default_deposit_percent > 0 and default_deposit_percent <= 100),
  default_delivery_estimate text check (char_length(default_delivery_estimate) <= 1000), default_artwork_note text check (char_length(default_artwork_note) <= 1000),
  default_returns_note text check (char_length(default_returns_note) <= 1000), updated_at timestamptz not null default now(),
  updated_by uuid references emblara.staff(id) on delete restrict
);
insert into invoicing.business_profile (id, trading_name, email, default_artwork_note) values (1, 'Emblara', 'support@emblara.co.uk', 'Production starts after you approve the digital proof of your artwork.');

create table invoicing.catalogue_items (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code ~ '^[A-Za-z0-9_-]{2,30}$'),
  name text not null check (btrim(name) <> '' and char_length(name) <= 200), fit text check (char_length(fit) <= 40), active boolean not null default true,
  sort_order integer not null default 0, track_stock boolean not null default false, stock_on_hand integer check (stock_on_hand >= 0),
  low_stock_threshold integer check (low_stock_threshold >= 0), monthly_order_limit integer check (monthly_order_limit > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint stock_only_when_tracked check ((track_stock and stock_on_hand is not null) or (not track_stock and stock_on_hand is null))
);
create table invoicing.catalogue_colours (item_id uuid not null references invoicing.catalogue_items(id) on delete cascade, colour text not null check (btrim(colour) <> '' and char_length(colour) <= 100), sort_order integer not null default 0, primary key(item_id, colour));
create table invoicing.catalogue_methods (item_id uuid not null references invoicing.catalogue_items(id) on delete cascade, method invoicing.decoration_method not null, primary key(item_id, method));
create table invoicing.catalogue_prices (item_id uuid not null, method invoicing.decoration_method not null, qty_from integer not null check(qty_from >= 1), unit_price_pence bigint not null check(unit_price_pence between 1 and 100000000), primary key(item_id, method, qty_from), foreign key(item_id, method) references invoicing.catalogue_methods(item_id, method) on delete cascade);
create table invoicing.catalogue_sizes (item_id uuid not null, method invoicing.decoration_method not null, size text not null check(size ~ '^[A-Za-z0-9 .+/-]{1,16}$'), sort_order integer not null default 0, surcharge_pence bigint not null default 0 check(surcharge_pence >= 0), primary key(item_id, method, size), foreign key(item_id, method) references invoicing.catalogue_methods(item_id, method) on delete cascade);
create table invoicing.catalogue_locations (item_id uuid not null, method invoicing.decoration_method not null, location text not null check(btrim(location) <> '' and char_length(location) <= 60), sort_order integer not null default 0, surcharge_pence bigint not null default 0 check(surcharge_pence >= 0), is_default boolean not null default false, primary key(item_id, method, location), foreign key(item_id, method) references invoicing.catalogue_methods(item_id, method) on delete cascade);
create table invoicing.catalogue_product_links (product_id uuid primary key references emblara.products(id) on delete restrict, catalogue_item_id uuid not null unique references invoicing.catalogue_items(id) on delete restrict);
create table invoicing.stock_movements (id uuid primary key default gen_random_uuid(), item_id uuid not null references invoicing.catalogue_items(id) on delete restrict, type invoicing.stock_movement_type not null, quantity integer not null check(quantity > 0), stock_before integer not null check(stock_before >= 0), stock_after integer not null check(stock_after >= 0), note text check(char_length(note) <= 500), created_by uuid not null references emblara.staff(id) on delete restrict, created_at timestamptz not null default clock_timestamp(), request_id uuid not null unique, constraint stock_after_matches check(stock_after = case when type = 'OUT' then stock_before - quantity else stock_before + quantity end), constraint out_requires_note check(type <> 'OUT' or (note is not null and btrim(note) <> '')));
create index stock_movements_item_idx on invoicing.stock_movements(item_id, created_at desc);

create function invoicing.block_stock_movement_change() returns trigger language plpgsql set search_path = '' as $$ begin raise exception 'stock_movements is append-only'; end $$;
create trigger stock_movements_no_update_delete before update or delete on invoicing.stock_movements for each row execute function invoicing.block_stock_movement_change();
create function invoicing.record_stock_movement(p_item_id uuid, p_type invoicing.stock_movement_type, p_quantity integer, p_note text, p_request_id uuid) returns invoicing.stock_movements language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := emblara.acting_staff_id(); v_item invoicing.catalogue_items; v_existing invoicing.stock_movements; v_after bigint; v_row invoicing.stock_movements; v_note text := nullif(btrim(p_note), '');
begin
 if v_actor is null or not emblara.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
 if p_quantity is null or p_quantity <= 0 or p_request_id is null then raise exception 'invalid_movement' using errcode = '22023'; end if;
 if p_type is null then raise exception 'invalid_movement' using errcode = '22023'; end if;
 if p_type = 'OUT' and v_note is null then raise exception 'note_required' using errcode = '22023'; end if;
 select * into v_item from invoicing.catalogue_items where id=p_item_id for update; if not found then raise exception 'item_not_found'; end if;
 if not v_item.track_stock then raise exception 'stock_not_tracked'; end if;
 select * into v_existing from invoicing.stock_movements where request_id=p_request_id; if found then return v_existing; end if;
 v_after := v_item.stock_on_hand::bigint + case when p_type='OUT'::invoicing.stock_movement_type then -p_quantity else p_quantity end; if v_after < 0 or v_after > 2147483647 then raise exception 'invalid_stock_level' using errcode = '22003'; end if;
 update invoicing.catalogue_items set stock_on_hand=v_after::integer, updated_at=now() where id=v_item.id;
 insert into invoicing.stock_movements(item_id,type,quantity,stock_before,stock_after,note,created_by,request_id) values(v_item.id,p_type,p_quantity,v_item.stock_on_hand,v_after::integer,v_note,v_actor,p_request_id) returning * into v_row;
 return v_row;
end $$;

create function invoicing.save_business_profile(p_profile jsonb) returns invoicing.business_profile language plpgsql security definer set search_path = '' as $$
declare v_row invoicing.business_profile;
begin
 if emblara.acting_staff_id() is null or not emblara.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
 if p_profile is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'profile_invalid' using errcode = '22023'; end if;
 update invoicing.business_profile set
   trading_name = coalesce(nullif(btrim(p_profile->>'trading_name'), ''), trading_name), legal_name = nullif(btrim(p_profile->>'legal_name'), ''),
   address_line1 = nullif(btrim(p_profile->>'address_line1'), ''), address_line2 = nullif(btrim(p_profile->>'address_line2'), ''),
   city = nullif(btrim(p_profile->>'city'), ''), postcode = nullif(btrim(p_profile->>'postcode'), ''), country = coalesce(nullif(btrim(p_profile->>'country'), ''), country),
   company_number = nullif(btrim(p_profile->>'company_number'), ''), email = coalesce(nullif(btrim(p_profile->>'email'), ''), email), phone = nullif(btrim(p_profile->>'phone'), ''),
   bank_account_name = nullif(btrim(p_profile->>'bank_account_name'), ''), bank_sort_code = nullif(btrim(p_profile->>'bank_sort_code'), ''), bank_account_number = nullif(btrim(p_profile->>'bank_account_number'), ''),
   default_payment_terms_days = coalesce((p_profile->>'default_payment_terms_days')::integer, default_payment_terms_days),
   default_deposit_percent = coalesce((p_profile->>'default_deposit_percent')::numeric, default_deposit_percent),
   default_delivery_estimate = nullif(btrim(p_profile->>'default_delivery_estimate'), ''), default_artwork_note = nullif(btrim(p_profile->>'default_artwork_note'), ''),
   default_returns_note = nullif(btrim(p_profile->>'default_returns_note'), ''), updated_at=now(), updated_by=emblara.acting_staff_id()
 where id=1 returning * into v_row;
 return v_row;
end $$;

create function invoicing.link_store_product(p_product_id uuid, p_item_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if emblara.acting_staff_id() is null or not emblara.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
 if not exists(select 1 from emblara.products where id=p_product_id) or not exists(select 1 from invoicing.catalogue_items where id=p_item_id) then raise exception 'mapping_target_not_found'; end if;
 delete from invoicing.catalogue_product_links where product_id=p_product_id or catalogue_item_id=p_item_id;
 insert into invoicing.catalogue_product_links(product_id,catalogue_item_id) values(p_product_id,p_item_id);
end $$;

alter table invoicing.business_profile enable row level security; alter table invoicing.catalogue_items enable row level security; alter table invoicing.catalogue_colours enable row level security; alter table invoicing.catalogue_methods enable row level security; alter table invoicing.catalogue_prices enable row level security; alter table invoicing.catalogue_sizes enable row level security; alter table invoicing.catalogue_locations enable row level security; alter table invoicing.catalogue_product_links enable row level security; alter table invoicing.stock_movements enable row level security;
grant select on all tables in schema invoicing to emblara_app;
create policy invoicing_staff_read on invoicing.business_profile for select to emblara_app using (emblara.is_staff());
create policy catalogue_staff_read on invoicing.catalogue_items for select to emblara_app using (emblara.is_staff());
create policy catalogue_colours_staff_read on invoicing.catalogue_colours for select to emblara_app using (emblara.is_staff());
create policy catalogue_methods_staff_read on invoicing.catalogue_methods for select to emblara_app using (emblara.is_staff());
create policy catalogue_prices_staff_read on invoicing.catalogue_prices for select to emblara_app using (emblara.is_staff());
create policy catalogue_sizes_staff_read on invoicing.catalogue_sizes for select to emblara_app using (emblara.is_staff());
create policy catalogue_locations_staff_read on invoicing.catalogue_locations for select to emblara_app using (emblara.is_staff());
create policy catalogue_links_staff_read on invoicing.catalogue_product_links for select to emblara_app using (emblara.is_staff());
create policy stock_staff_read on invoicing.stock_movements for select to emblara_app using (emblara.is_staff());
revoke all on function invoicing.record_stock_movement(uuid, invoicing.stock_movement_type, integer, text, uuid) from public; grant execute on function invoicing.record_stock_movement(uuid, invoicing.stock_movement_type, integer, text, uuid) to emblara_app;
revoke all on function invoicing.save_business_profile(jsonb), invoicing.link_store_product(uuid, uuid) from public;
grant execute on function invoicing.save_business_profile(jsonb), invoicing.link_store_product(uuid, uuid) to emblara_app;
commit;
