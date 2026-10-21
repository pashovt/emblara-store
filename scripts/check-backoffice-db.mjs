// Back-office database checks. Phase 1 proves the customer-link role cannot
// read a table in any Emblara schema. Later phases append the ported checks here.
import pg from 'pg';
import { strictSsl } from '../server/pg-url.js';
import { ownerClient } from './lib/db-owner.mjs';

const portalUrl = process.env.EMBLARA_PORTAL_DATABASE_URL;
if (!portalUrl) throw new Error('EMBLARA_PORTAL_DATABASE_URL is not set. Run db:migrate with --set-passwords first.');

const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const owner = await ownerClient();
const portal = new pg.Client({ connectionString: strictSsl(portalUrl) });
let failed = 0;
try {
  const { rows: tables } = await owner.query(`
    select table_schema, table_name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema in ('public', 'emblara', 'invoicing', 'quoting', 'support', 'production')
    order by table_schema, table_name`);
  await portal.connect();
  for (const { table_schema, table_name } of tables) {
    let denied = false;
    try {
      await portal.query(`select 1 from ${quote(table_schema)}.${quote(table_name)} limit 1`);
    } catch (error) {
      denied = error.code === '42501';
    }
    if (!denied) failed += 1;
    console.log(`${denied ? 'PASS' : 'FAIL'}  portal cannot read ${table_schema}.${table_name}`);
  }
} finally {
  await portal.end().catch(() => {});
  await owner.end();
}

process.exit(failed ? 1 : 0);
