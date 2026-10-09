// Light, in-browser logo clean-up for the "see it with your logo" preview.
// Nothing leaves the visitor's browser. Steps:
//   1. draw the file onto a canvas (max 900 px on the long side)
//   2. if the file has no transparency, remove a flat background colour
//      sampled from the corners (white boxes behind JPG logos)
//   3. trim empty space around the mark
//   4. measure how light or dark the mark is, and make a light version for
//      dark garments and a dark version for light garments
// Anything harder (gradients, photos, low resolution) is a job for the paid
// professional clean-up.

const MAX = 900;
const LIGHT = [243, 239, 232];
const DARK = [22, 30, 48];

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image. Try a PNG, JPG or SVG.'));
    };
    img.src = url;
  });

const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function recolour(data, [r, g, b]) {
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return out;
}

function toDataUrl(pixels, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
  return c.toDataURL('image/png');
}

export async function cleanLogo(file) {
  if (!/^image\//.test(file.type) && !/\.(svg|png|jpe?g|webp)$/i.test(file.name)) {
    throw new Error('Please choose an image file: PNG, JPG, SVG or WebP.');
  }
  const { img, url } = await loadImage(file);
  try {
    // SVGs without a size report 0; give them a working size.
    const iw = img.naturalWidth || 800;
    const ih = img.naturalHeight || 800;
    const scale = Math.min(1, MAX / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // 2. Background removal when the file is fully opaque.
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent += 1;
    let removedBackground = false;
    if (transparent / (w * h) < 0.01) {
      const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
      const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + data[c + k], 0) / 4);
      for (let i = 0; i < data.length; i += 4) {
        const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
        // Fully clear close to the background, feather the edge.
        if (d < 28) data[i + 3] = 0;
        else if (d < 60) data[i + 3] = Math.round((data[i + 3] * (d - 28)) / 32);
      }
      removedBackground = true;
    }

    // 3. Trim to the visible mark, with a little breathing room.
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) throw new Error('The logo came out empty after removing the background. Try a file with a transparent background.');
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(w - 1, x1 + pad);
    y1 = Math.min(h - 1, y1 + pad);
    const tw = x1 - x0 + 1;
    const th = y1 - y0 + 1;
    const trimmed = new Uint8ClampedArray(tw * th * 4);
    for (let y = 0; y < th; y += 1) {
      const from = ((y + y0) * w + x0) * 4;
      trimmed.set(data.subarray(from, from + tw * 4), y * tw * 4);
    }

    // 4. Tone of the mark, weighted by opacity.
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < trimmed.length; i += 4) {
      const a = trimmed[i + 3] / 255;
      sum += luminance(trimmed[i], trimmed[i + 1], trimmed[i + 2]) * a;
      weight += a;
    }
    const tone = weight ? sum / weight : 0.5;

    return {
      name: file.name,
      src: toDataUrl(trimmed, tw, th),
      light: toDataUrl(recolour(trimmed, LIGHT), tw, th),
      dark: toDataUrl(recolour(trimmed, DARK), tw, th),
      ratio: tw / th,
      tone,
      removedBackground,
      lowRes: Math.max(iw, ih) < 400 && !/svg/i.test(file.type),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
