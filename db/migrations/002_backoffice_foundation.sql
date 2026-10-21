-- Back-office foundation. This is additive: existing store tables, policies and
-- runtime roles are left untouched.
begin;

do $guard$
begin
  if exists (select 1 from pg_roles where rolname = 'emblara_portal')
     or exists (select 1 from pg_namespace where nspname in ('invoicing', 'quoting', 'support', 'production')) then
    raise exception 'Back-office foundation objects already exist. Refusing to replace them.';
  end if;
end
$guard$;

create role emblara_portal login noinherit nobypassrls nosuperuser nocreatedb nocreaterole;

create schema invoicing;
create schema quoting;
create schema support;
create schema production;

revoke all on schema invoicing, quoting, support, production from public;
alter default privileges in schema invoicing revoke all on tables from public;
alter default privileges in schema quoting revoke all on tables from public;
alter default privileges in schema support revoke all on tables from public;
alter default privileges in schema production revoke all on tables from public;
alter default privileges in schema invoicing revoke all on functions from public;
alter default privileges in schema quoting revoke all on functions from public;
alter default privileges in schema support revoke all on functions from public;
alter default privileges in schema production revoke all on functions from public;

grant usage on schema invoicing, quoting, support, production to emblara_app;

create function emblara.acting_staff_id() returns uuid
language sql stable set search_path = ''
as $$ select nullif(current_setting('emblara.staff_id', true), '')::uuid $$;

revoke all on function emblara.acting_staff_id() from public;
grant execute on function emblara.acting_staff_id() to emblara_app;

commit;
