import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seedProducts } from '../src/data/catalogue-seed.js';
import { toRow } from '../src/lib/catalogue.js';
import { buildDraftPlan, etsyUserId, listingInventory, missingDrafts } from '../server/etsy-listings.js';

describe('Etsy draft listing plan', () => {
  it('uses the validated numeric OAuth token prefix for Etsy user endpoints', () => {
    assert.equal(etsyUserId('12345678.token-value'), 12345678);
    assert.equal(etsyUserId('not-a-number.token-value'), null);
  });

  it('splits the website range into eleven finish-specific Etsy drafts', () => {
    const plan = buildDraftPlan(seedProducts);

    assert.deepEqual(plan.map(({ key }) => key), [
      'mens-polo-embroidery', 'womens-polo-embroidery', 'organic-polo-embroidery', 'printed-polo-print',
      'heavy-cotton-tee-print', 'heavy-cotton-tee-embroidery', 'ultra-cotton-tee-print',
      'logo-hoodie-print', 'logo-hoodie-embroidery', 'crew-sweatshirt-print', 'crew-sweatshirt-embroidery',
    ]);
    assert.equal(plan.length, 11);
    assert.ok(plan.every(({ title, product, method }) => title.startsWith('EMBLARA ') && product.service !== true && method));
  });

  it('creates colour, size and print-location inventory with matrix prices', () => {
    const product = seedProducts.find(({ slug }) => slug === 'printed-polo');
    const method = product.methods[0];
    const inventory = listingInventory(product, method);

    assert.equal(inventory.products.length, 96);
    assert.deepEqual(inventory.products[0].property_values.map(({ property_id, property_name, values }) => ({ property_id, property_name, values })), [
      { property_id: 513, property_name: 'Colour', values: ['Navy'] },
      { property_id: 514, property_name: 'Size', values: ['S'] },
      { property_id: 516, property_name: 'Print location', values: ['Front'] },
    ]);
    assert.equal(inventory.products[0].offerings[0].quantity, 999);
    assert.equal(inventory.products[0].offerings[0].price, 25.36);
    assert.deepEqual(inventory.price_on_property, [513, 514, 516]);
  });

  it('does not recreate a draft already marked with its Emblara product and finish tags', () => {
    const plan = buildDraftPlan(seedProducts);
    const missing = missingDrafts(plan, [{ listing_id: 1, tags: ['emblara', 'mens-polo', 'embroidery'] }]);

    assert.equal(missing.length, 10);
    assert.ok(!missing.some(({ key }) => key === 'mens-polo-embroidery'));
  });

  it('uses the correct finish label when planning from stored product rows', () => {
    const stored = seedProducts.map((product, index) => ({ ...toRow(product, index), service: product.service }));
    const plan = buildDraftPlan(stored.map((row) => row.kind === 'service' ? row : { ...row, ...row.config }));

    assert.equal(plan.find(({ key }) => key === 'printed-polo-print').title, 'EMBLARA Printed polo — Printed');
  });
});
