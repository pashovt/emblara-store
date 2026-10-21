// Applies db/migrations/NNN_*.sql once, in filename order. Existing store
// databases predate this runner, so their already-present 001 schema is recorded
// rather than recreated. Runtime-role passwords are written only to a local env file.
//   npm run db:migrate
//   npm run db:migrate -- --set-passwords
//   npm run db:migrate -- --set-passwords --roles=emblara_portal --env-out=.env.development.local
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { ownerClient, upsertEnv } from './lib/db-owner.mjs';
import { strictSsl } from '../server/pg-url.js';

const roles = new Map([
  ['emblara_app', 'EMBLARA_APP_DATABASE_URL'],
  ['emblara_public', 'EMBLARA_PUBLIC_DATABASE_URL'],
  ['emblara_portal', 'EMBLARA_PORTAL_DATABASE_URL'],
]);
const envOut = process.argv.find((arg) => arg.startsWith('--env-out='))?.slice('--env-out='.length) ?? '.env.local';
const requested = process.argv.find((arg) => arg.startsWith('--roles='))?.slice('--roles='.length);
const selected = requested ? requested.split(',').filter(Boolean) : [...roles.keys()];

if (selected.length === 0 || selected.some((role) => !roles.has(role))) {
  throw new Error(`--roles must name one or more of: ${[...roles.keys()].join(', ')}`);
}

const dir = new URL('../db/migrations/', import.meta.url);
const files = fs.readdirSync(dir).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort();
const initial = '001_emblara_store.sql';
if (!files.includes(initial)) throw new Error(`Missing ${initial}.`);

const client = await ownerClient();
try {
  await client.query(`
    create table if not exists public.emblara_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    revoke all on public.emblara_migrations from public;`);

  let applied = new Set((await client.query('select name from public.emblara_migrations')).rows.map((row) => row.name));
  if (!applied.has(initial)) {
    const existing = await client.query("select 1 from information_schema.tables where table_schema = 'emblara' limit 1");
    if (existing.rowCount) {
      await client.query('insert into public.emblara_migrations (name) values ($1)', [initial]);
      console.log(`Recorded existing db/migrations/${initial}`);
      applied = new Set([...applied, initial]);
    }
  }

  for (const file of files) {
    if (applied.has(file)) continue;
    await client.query(fs.readFileSync(new URL(file, dir), 'utf8'));
    await client.query('insert into public.emblara_migrations (name) values ($1)', [file]);
    console.log(`Applied db/migrations/${file}`);
  }
  console.log('Migrations up to date.');

  if (process.argv.includes('--set-passwords')) {
    const base = new URL(process.env.DATABASE_URL);
    const entries = {};
    for (const role of selected) {
      const password = randomBytes(24).toString('base64url');
      const { rows } = await client.query('select format($1, $2::text, $3::text) as statement', ['alter role %I password %L', role, password]);
      await client.query(rows[0].statement);
      const url = new URL(base);
      url.username = role;
      url.password = password;
      entries[roles.get(role)] = strictSsl(url.toString());
      console.log(`Set a new password for ${role}; wrote ${roles.get(role)} to ${envOut}.`);
    }
    upsertEnv(envOut, entries);
    console.log('Add the same variables to Vercel yourself.');
  }
} finally {
  await client.end();
}
