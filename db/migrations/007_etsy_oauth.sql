-- Encrypted OAuth credentials for the server-side Etsy integration. The token is
-- AES-GCM encrypted before this table is written; browser/database roles cannot read it.
begin;
create table emblara.oauth_credentials (
  provider text primary key check (provider = 'etsy'),
  token_ciphertext text not null,
  scopes text not null,
  updated_at timestamptz not null default now()
);
alter table emblara.oauth_credentials enable row level security;
grant select, insert, update on emblara.oauth_credentials to emblara_app;
create policy oauth_runtime on emblara.oauth_credentials for all to emblara_app
  using (emblara.flow() = 'etsy_oauth')
  with check (emblara.flow() = 'etsy_oauth');
commit;
