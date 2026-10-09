// Downloads the clean Gelato catalogue previews (no logo) used by the store.
// Logos are drawn on top in the browser, so these files never carry a logo.
//
//   public/garments/<product>/<colour>-<view>.webp
//   public/garments/sources.csv            (file -> Gelato preview URL)
//
// Views: model-front, model-back, flat-front, flat-back.
// Run from the project root: node scripts/fetch-garments.mjs
// Gildan 2000 has no public preview; by the owner's instruction it reuses the
// Gildan 5000 images (see src/data/products.js).
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const B = 'https://s3.eu-west-1.amazonaws.com/gelato-api-live/preflight/preview/';

const gildanViews = {
  'model-front': 'premium/model/male/man2/front',
  'model-back': 'premium/model/male/man2/back',
  'flat-front': 'editor/front',
  'flat-back': 'editor/back',
};
const poloViews = (person) => ({
  'model-front': `${person}/front`,
  'model-back': `${person}/back`,
  'flat-front': 'editor/front',
  'flat-back': 'editor/back',
});

// folder: [Gelato preview id, views, colours]
const garments = {
  'mens-polo': ['polo.none.mens.prm.sols.11346', poloViews('person1'), ['black', 'white', 'pure-grey', 'royal-blue']],
  'womens-polo': ['polo.none.womens.prm.sols.11347', poloViews('person1'), ['french-navy', 'white', 'black']],
  'organic-polo': ['polo.none.mens.organic.sols.03566', poloViews('person1'), ['black', 'white']],
  'printed-polo': ['polo.none.unisex.prm.sols.11362', poloViews('person'), ['navy', 'black', 'white', 'grey-melange']],
  'heavy-cotton-tee': ['t-shirt.crewneck.unisex.heavy-weight.gildan.5000', gildanViews, ['navy', 'sport-grey', 'white', 'black']],
  'logo-hoodie': ['hoodie.pullover.unisex.classic.gildan.18500', gildanViews, ['navy', 'black', 'white', 'sport-grey']],
  'crew-sweatshirt': ['sweatshirt.crewneck.unisex.classic.gildan.18000', gildanViews, ['navy', 'sport-grey', 'white', 'black']],
};

const rows = ['file,source_url'];
let missing = 0;
for (const [folder, [id, views, colours]] of Object.entries(garments)) {
  await mkdir(`public/garments/${folder}`, { recursive: true });
  for (const colour of colours) {
    for (const [view, path] of Object.entries(views)) {
      const url = `${B}${id}/${path}/${colour}-1000x1000.webp`;
      const res = await fetch(url);
      if (!res.ok) { console.log('MISS', url); missing += 1; continue; }
      const file = `${folder}/${colour}-${view}.webp`;
      // Pad to a white 1000 x 1000 square so logo spots share one frame.
      await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(1000, 1000, { fit: 'contain', background: '#ffffff' })
        .webp({ quality: 84 })
        .toFile(`public/garments/${file}`);
      rows.push(`${file},${url}`);
    }
  }
  console.log('ok', folder);
}
await writeFile('public/garments/sources.csv', rows.join('\n') + '\n');
console.log(`${rows.length - 1} files, ${missing} missing`);
