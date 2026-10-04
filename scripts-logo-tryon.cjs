// Adds the EMBLARA mark to the try-on images. Positions are fractions of a
// square tile (image contained, centred): [x, y, width].
const fs = require('fs');
const sharp = require('sharp');
const TOP = 'M760 7 L260 7 L5 255 L80 333 L305 113 L650 113 Z';
const BOTTOM = 'M630 258 L270 258 L90 435 L270 615 L725 615 L615 513 L310 513 L230 435 L310 357 L530 357 Z';
const mark = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 770 620"><path d="${TOP}" fill="${fill}"/><path d="${BOTTOM}" fill="${fill}"/></svg>`;
const spots = {
  'tee-model': [0.527, 0.238, 0.04],
  'hoodie-model': [0.555, 0.27, 0.045],
  'sweat-model': [0.548, 0.25, 0.045],
  'tee-flat': [0.6, 0.3, 0.09],
  'hoodie-flat': [0.6, 0.4, 0.1],
  'sweat-flat': [0.6, 0.33, 0.09],
};
(async () => {
  fs.mkdirSync('public/tryon', { recursive: true });
  for (const f of fs.readdirSync('public/tryon/original').filter((x) => x.endsWith('.webp'))) {
    const [g, ...rest] = f.replace('.webp', '').split('-');
    const kind = rest.pop();
    const colour = rest.join('-');
    const [fx, fy, fw] = spots[`${g}-${kind}`];
    const src = `public/tryon/original/${f}`;
    const { width: W, height: H } = await sharp(src).metadata();
    const T = Math.max(W, H);
    const cx = fx * T - (T - W) / 2, cy = fy * T - (T - H) / 2;
    const lw = Math.round(fw * T), lh = Math.round(lw * 620 / 770);
    const fill = ['sand', 'sport-grey'].includes(colour) ? '#16233d' : '#d07a3c';
    const logo = await sharp(Buffer.from(mark(fill))).resize(lw, lh).png().toBuffer();
    // Pad models to a square so every hero layer shares the same geometry.
    const base = await sharp(src).composite([{ input: logo, left: Math.round(cx - lw / 2), top: Math.round(cy - lh / 2) }]).toBuffer();
    await sharp(base).resize(1000, 1000, { fit: 'contain', background: '#ffffff' }).webp({ quality: 86 }).toFile(`public/tryon/${f}`);
  }
  console.log('logos done');
})();
