// Loads the approved price list into the back-office catalogue. It is safe to rerun:
// items are matched by code; price-list children are refreshed; missing items go inactive.
import fs from 'node:fs';
import { ownerClient } from './lib/db-owner.mjs';

const file = new URL('../db/catalogue/price-list.json', import.meta.url);
const list = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(list.items) || list.items.length === 0) throw new Error('price-list.json has no items.');

const client = await ownerClient();
try {
  await client.query('begin');
  const seen = [];
  let order = 0;
  for (const item of list.items) {
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(item.code) || !item.name || !item.methods || !Array.isArray(item.colours)) throw new Error(`Invalid catalogue item: ${item.code ?? 'unknown'}`);
    const { rows } = await client.query(
      `insert into invoicing.catalogue_items (code, name, fit, active, sort_order)
       values ($1, $2, $3, $4, $5)
       on conflict (code) do update set name=excluded.name, fit=excluded.fit, active=excluded.active, sort_order=excluded.sort_order, updated_at=now()
       returning id`,
      [item.code, item.name, item.fit ?? null, item.active === true, order++],
    );
    const id = rows[0].id;
    seen.push(item.code);
    await client.query('delete from invoicing.catalogue_methods where item_id=$1', [id]);
    await client.query('delete from invoicing.catalogue_colours where item_id=$1', [id]);
    for (const [sort, colour] of item.colours.entries()) await client.query('insert into invoicing.catalogue_colours (item_id, colour, sort_order) values ($1, $2, $3)', [id, colour, sort]);
    for (const [method, pricing] of Object.entries(item.methods)) {
      if (!['print', 'embroidery'].includes(method) || !Array.isArray(pricing.tiers) || !Array.isArray(pricing.sizes)) throw new Error(`Invalid ${method} pricing for ${item.code}`);
      await client.query('insert into invoicing.catalogue_methods (item_id, method) values ($1, $2)', [id, method]);
      for (const tier of pricing.tiers) await client.query('insert into invoicing.catalogue_prices (item_id, method, qty_from, unit_price_pence) values ($1, $2, $3, $4)', [id, method, tier.qty, tier.pence]);
      for (const [sort, size] of pricing.sizes.entries()) await client.query('insert into invoicing.catalogue_sizes (item_id, method, size, sort_order, surcharge_pence) values ($1, $2, $3, $4, $5)', [id, method, size.size, sort, size.surchargePence]);
      for (const [sort, location] of (pricing.locations ?? []).entries()) await client.query('insert into invoicing.catalogue_locations (item_id, method, location, sort_order, surcharge_pence, is_default) values ($1, $2, $3, $4, $5, $6)', [id, method, location.location, sort, location.surchargePence, location.default === true]);
    }
  }
  const missing = await client.query('update invoicing.catalogue_items set active=false, updated_at=now() where code <> all($1::text[]) and active returning code', [seen]);
  await client.query('commit');
  const summary = (await client.query("select (select count(*) from invoicing.catalogue_items where active)::int as items, (select count(*) from invoicing.catalogue_prices)::int as prices, (select count(*) from invoicing.catalogue_sizes)::int as sizes, (select count(*) from invoicing.catalogue_locations)::int as locations, (select count(*) from invoicing.catalogue_colours)::int as colours")).rows[0];
  console.log(`Price list loaded: ${summary.items} active items, ${summary.colours} colours, ${summary.prices} price tiers, ${summary.sizes} sizes, ${summary.locations} placements.${missing.rowCount ? ` Marked inactive: ${missing.rows.map((row) => row.code).join(', ')}.` : ''}`);
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}
