// Applies db/migrations/001_emblara_store.sql (once) and, with --set-passwords,
// gives the two runtime roles fresh random passwords and writes their connection
// strings to .env.local. No secret is ever printed.
//   npm run db:migrate
//   npm run db:migrate -- --set-passwords
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { ownerClient, upsertEnv } from './lib/db-owner.mjs';

const client = await ownerClient();
try {
  const present = await client.query("select 1 from information_schema.tables where table_schema = 'emblara' limit 1");
  if (present.rowCount) {
    console.log('WARNING: schema emblara already has tables. The migration was NOT run. Review them first.');
  } else {
    await client.query(fs.readFileSync(new URL('../db/migrations/001_emblara_store.sql', import.meta.url), 'utf8'));
    console.log('Applied db/migrations/001_emblara_store.sql');
  }

  if (process.argv.includes('--set-passwords')) {
    const base = new URL(process.env.DATABASE_URL); // pooled host for app traffic
    const out = {};
    for (const [role, envKey] of [['emblara_app', 'EMBLARA_APP_DATABASE_URL'], ['emblara_public', 'EMBLARA_PUBLIC_DATABASE_URL']]) {
      const password = randomBytes(24).toString('base64url');
      const { rows } = await client.query('select format($1, $2::text, $3::text) as stmt', ['alter role %I password %L', role, password]);
      await client.query(rows[0].stmt);
      const u = new URL(base);
      u.username = role;
      u.password = password;
      out[envKey] = u.toString();
    }
    upsertEnv('.env.local', out);
    console.log('Set new passwords for emblara_app and emblara_public; wrote their connection strings to .env.local.');
    console.log('Add the same two variables to Vercel (Project Settings > Environment Variables) yourself.');
  }
} finally {
  await client.end();
}
