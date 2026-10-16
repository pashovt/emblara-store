// Owner connection for one-off admin scripts (migrate, seed, create-staff).
// Uses the direct (unpooled) URL from `neon env pull`. The store server never uses it.
import fs from 'node:fs';
import pg from 'pg';

export async function ownerClient() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set. Run with: node --env-file=.env.local <script>');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

// Insert or replace KEY=value lines in an env file without printing the values.
export function upsertEnv(file, entries) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(entries)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
}
