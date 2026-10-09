// Downloads the Gelato model previews for colours the range sells but the
// owner mockups do not cover, then adds the EMBLARA mark.
// Originals go to public/products/original/ (with sources.csv), finished
// images to public/products/. Run from this folder:
//   node scripts-fetch-products.mjs
// Logo positions are fractions of a square tile: [x, y, width]. Adjust here.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const B = 'https://s3.eu-west-1.amazonaws.com/gelato-api-live/preflight/preview/';
const TOP = 'M760 7 L260 7 L5 255 L80 333 L305 113 L650 113 Z';
const BOTTOM = 'M630 258 L270 258 L90 435 L270 615 L725 615 L615 513 L310 513 L230 435 L310 357 L530 357 Z';
const mark = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 770 620"><path d="${TOP}" fill="${fill}"/><path d="${BOTTOM}" fill="${fill}"/></svg>`;
const COPPER = '#d07a3c';

// [output name, preview path, logo spot]
const jobs = [
  ['organic-black-model', 'polo.none.mens.organic.sols.03566/person1/front/black', [0.56, 0.4, 0.06]],
  ['organic-white-model', 'polo.none.mens.organic.sols.03566/person1/front/white', [0.56, 0.4, 0.06]],
  ['mens-polo-white-model', 'polo.none.mens.prm.sols.11346/person1/front/white', [0.56, 0.4, 0.06]],
  ['mens-polo-pure-grey-model', 'polo.none.mens.prm.sols.11346/person1/front/pure-grey', [0.56, 0.4, 0.06]],
  ['mens-polo-royal-blue-model', 'polo.none.mens.prm.sols.11346/person1/front/royal-blue', [0.56, 0.4, 0.06]],
  ['womens-polo-white-model', 'polo.none.womens.prm.sols.11347/person1/front/white', [0.555, 0.42, 0.065]],
  ['womens-polo-black-model', 'polo.none.womens.prm.sols.11347/person1/front/black', [0.555, 0.42, 0.065]],
  ['spring-grey-melange-model', 'polo.none.unisex.prm.sols.11362/person/front/grey-melange', [0.56, 0.39, 0.065]],
];

await mkdir('public/products/original', { recursive: true });
const rows = ['file,source_url'];
for (const [name, path, [fx, fy, fw]] of jobs) {
  const url = `${B}${path}-1000x1000.webp`;
  const res = await fetch(url);
  if (!res.ok) { console.log('MISS', url); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(`public/products/original/${name}.webp`, buf);
  rows.push(`${name}.webp,${url}`);
  const { width: W, height: H } = await sharp(buf).metadata();
  const lw = Math.round(fw * W), lh = Math.round((lw * 620) / 770);
  const logo = await sharp(Buffer.from(mark(COPPER))).resize(lw, lh).png().toBuffer();
  await sharp(buf)
    .composite([{ input: logo, left: Math.round(fx * W - lw / 2), top: Math.round(fy * H - lh / 2) }])
    .resize(1000, 1000, { fit: 'contain', background: '#ffffff' })
    .webp({ quality: 86 })
    .toFile(`public/products/${name}.webp`);
  console.log('ok', name);
}
await writeFile('public/products/original/sources.csv', rows.join('\n') + '\n');
