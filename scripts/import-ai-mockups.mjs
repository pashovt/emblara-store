// Imports the owner's AI model photos (06-AI-Models/Product-Mockups) into the
// store. Run from the project root: node scripts/import-ai-mockups.mjs
//
// Source: 2026-10-09-Website-Expansion/image-index.csv, 41 blank shots (no logo,
// no placeholder): every colour front, one back per product, and the second
// model on the unisex garments. The site draws the logo on top, so the same
// photo works for the EMBLARA logo and for a visitor's own.
//
// Output:
//   public/garments/<product>/<colour>-ai-front.webp       main model, front
//   public/garments/<product>/<colour>-ai-front-alt.webp   second model, front
//   public/garments/<product>/<colour>-ai-back.webp        main model, back
//   src/data/ai-shots.json                                  what exists (do not edit)
//
// The 1024 x 1536 portraits are widened to a square by extending the plain
// studio backdrop (blurred edge pixels), then scaled to 1000 x 1000, so they
// share one square frame with the Gelato photos and the logo placement maths.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ROOT = '../../../06-AI-Models/Product-Mockups/';
const EXPANSION = `${ROOT}2026-10-09-Website-Expansion/`;
const FIRST_SET = `${ROOT}2026-10-09-Gelato/`;

const parseCsv = async (path) => {
  const lines = (await readFile(path, 'utf8')).trim().split('\n');
  const head = lines.shift().split(',');
  // Prompts can contain commas, so only the leading columns are read.
  return lines.map((line) => Object.fromEntries(line.split(',').slice(0, head.length).map((v, i) => [head[i], v])));
};

// Which colour, finish and logo position each product opens on: the first set
// of mockups was made for these.
const METHOD = (m) => (/embroider/i.test(m) ? 'embroidery' : 'print');
const POSITION = (p) => (/left chest/i.test(p) && !/front/i.test(p) ? 'Left chest' : 'Front');
const SLUG = {
  SOLS11346: 'mens-polo', SOLS11347: 'womens-polo', SOLS03566: 'organic-polo', SOLS11362: 'printed-polo',
  G5000: 'heavy-cotton-tee', G2000: 'ultra-cotton-tee', G18500: 'logo-hoodie', G18000: 'crew-sweatshirt',
};
const shots = {};
for (const r of await parseCsv(`${FIRST_SET}image-index.csv`)) {
  if (r.variant !== 'emblara') continue;
  shots[SLUG[r.product_id]] = { colour: r.colour, method: METHOD(r.method), position: POSITION(r.placement), model: r.model_id, shots: {} };
}

const rows = (await parseCsv(`${EXPANSION}image-index.csv`)).filter((r) => r.variant === 'blank');
for (const r of rows) {
  const product = shots[r.slug];
  if (!product) continue;
  const view = r.view === 'back' ? 'ai-back' : r.model_id === product.model ? 'ai-front' : 'ai-front-alt';
  const file = `/garments/${r.slug}/${r.colour_key}-${view}.webp`;
  product.shots[r.colour] = { ...product.shots[r.colour], [view]: file };
  if (view === 'ai-front-alt') product.altModel = r.model_id;

  const src = `${EXPANSION}${r.file}`;
  await mkdir(`public/garments/${r.slug}`, { recursive: true });
  const { width, height } = await sharp(src).metadata();
  const pad = Math.max(0, Math.round((height - width) / 2));
  // Side bands: the edge pixels stretched outwards and blurred, so the plain
  // studio backdrop continues without streaks. The photo sits on top, untouched.
  const bands = await sharp(src).extend({ left: pad, right: pad, extendWith: 'copy' }).blur(30).toBuffer();
  const square = await sharp(bands).composite([{ input: src, left: pad, top: 0 }]).toBuffer();
  await sharp(square).resize(1000, 1000).webp({ quality: 84 }).toFile(`public${file}`);
  console.log('ok', file);
}

await writeFile('src/data/ai-shots.json', JSON.stringify(shots, null, 2) + '\n');
console.log(`${rows.length} images`);
