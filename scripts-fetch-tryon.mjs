// Downloads the Gelato "man2" model shots + flat garments used by the try-on hero.
import { writeFile } from 'node:fs/promises';
const B = 'https://s3.eu-west-1.amazonaws.com/gelato-api-live/preflight/preview/';
const P = { tee: 't-shirt.crewneck.unisex.heavy-weight.gildan.5000', hoodie: 'hoodie.pullover.unisex.classic.gildan.18500', sweat: 'sweatshirt.crewneck.unisex.classic.gildan.18000' };
// Every colour the range sells: Navy, Sport Grey, Black and White.
const looks = ['tee', 'hoodie', 'sweat'].flatMap((g) => ['navy', 'sport-grey', 'black', 'white'].map((c) => [g, c]));
const rows = ['file,source_url'];
for (const [g, c] of looks) {
  for (const [kind, path] of [['model', `premium/model/male/man2/front`], ['flat', `editor/front`]]) {
    const url = `${B}${P[g]}/${path}/${c}-1000x1000.webp`;
    const r = await fetch(url);
    if (!r.ok) { console.log('MISS', url); continue; }
    const f = `${g}-${c}-${kind}.webp`;
    await writeFile(`public/tryon/original/${f}`, Buffer.from(await r.arrayBuffer()));
    rows.push(`${f},${url}`);
  }
}
await writeFile('public/tryon/original/sources.csv', rows.join('\n') + '\n');
console.log('done', rows.length - 1);
