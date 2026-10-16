// Loads the launch range (src/data/catalogue-seed.js) into the products table.
// Only inserts when the table is empty, so it never overwrites the merchant's edits.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
import { db } from '../server/db.js';

const seeded = await db().seedIfEmpty();
console.log(seeded ? 'Seeded the launch range.' : 'Products already exist; nothing changed.');
