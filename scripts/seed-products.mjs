// Loads the launch range (src/data/catalogue-seed.js) into emblara.products, and ONLY
// when the table is empty, so it never overwrites the merchant's edits.
//   npm run seed
import { seedProducts } from '../src/data/catalogue-seed.js';
import { toRow } from '../src/lib/catalogue.js';
import { ownerClient } from './lib/db-owner.mjs';

const client = await ownerClient();
try {
  const { rows } = await client.query('select count(*)::int as n from emblara.products');
  if (rows[0].n > 0) {
    console.log('Products already exist; nothing changed.');
  } else {
    for (const [i, p] of seedProducts.entries()) {
      const r = { ...toRow(p, i), published: true };
      await client.query(
        `insert into emblara.products (slug, name, category, kind, blurb, material, fabric, price_pence, config, images, published, available, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13)`,
        [r.slug, r.name, r.category, r.kind, r.blurb, r.material, r.fabric, r.price_pence, JSON.stringify(r.config), JSON.stringify(r.images), r.published, r.available, r.sort],
      );
    }
    console.log(`Seeded ${seedProducts.length} products.`);
  }
} finally {
  await client.end();
}
