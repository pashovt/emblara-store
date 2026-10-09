// Where a logo sits on each garment photo.
//
// Every photo in public/garments is a 1000 x 1000 square. For each product and
// view we record four anchors, as fractions of the square:
//   cx  centre line of the garment
//   yn  top of the collar / neckline (hood base on hoodies)
//   ya  armpit line
//   w   chest width at the armpit line
// Placement rules (below) then place each Gelato decoration area relative to
// those anchors. The ratios come from the owner's Gelato placement screenshots
// in 02-Listings/Gelato/01-Products/*/02-Print-Locations: e.g. polo left chest
// is a box about 18% of the chest wide, its centre just above the armpit line
// and 20% of the chest width to the wearer's left.
//
// A box is { x, y, w, h }: centre and size as fractions of the photo. The logo
// is fitted inside the box, keeping its proportions.

const anchors = {
  'mens-polo': {
    'model-front': [0.48, 0.27, 0.47, 0.43],
    'model-back': [0.51, 0.29, 0.48, 0.42],
    'flat-front': [0.47, 0.03, 0.39, 0.43],
    'flat-back': [0.5, 0.04, 0.4, 0.43],
  },
  'womens-polo': {
    'model-front': [0.49, 0.3, 0.48, 0.42],
    'model-back': [0.48, 0.28, 0.47, 0.43],
    'flat-front': [0.49, 0.04, 0.37, 0.45],
    'flat-back': [0.5, 0.04, 0.38, 0.45],
  },
  'organic-polo': {
    'model-front': [0.49, 0.28, 0.47, 0.44],
    'model-back': [0.5, 0.28, 0.48, 0.45],
    'flat-front': [0.49, 0.04, 0.39, 0.44],
    'flat-back': [0.51, 0.04, 0.39, 0.46],
  },
  'printed-polo': {
    'model-front': [0.5, 0.27, 0.46, 0.38],
    'model-back': [0.52, 0.26, 0.47, 0.35],
    'flat-front': [0.49, 0.06, 0.38, 0.47],
    'flat-back': [0.51, 0.06, 0.39, 0.47],
  },
  'heavy-cotton-tee': {
    'model-front': [0.49, 0.16, 0.29, 0.2],
    'model-back': [0.505, 0.14, 0.28, 0.19],
    'flat-front': [0.5, 0.04, 0.45, 0.6],
    'flat-back': [0.5, 0.04, 0.45, 0.6],
  },
  'logo-hoodie': {
    'model-front': [0.485, 0.19, 0.31, 0.22],
    'model-back': [0.52, 0.22, 0.32, 0.22],
    'flat-front': [0.47, 0.26, 0.44, 0.43],
    'flat-back': [0.5, 0.24, 0.43, 0.45],
  },
  'crew-sweatshirt': {
    'model-front': [0.515, 0.16, 0.27, 0.19],
    'model-back': [0.525, 0.15, 0.26, 0.21],
    'flat-front': [0.505, 0.15, 0.48, 0.58],
    'flat-back': [0.5, 0.15, 0.47, 0.6],
  },
};

// Placement rules per garment type: side ('front' | 'back'), dx (offset from
// the centre line in chest widths, + = wearer's left), t (box centre between
// collar 0 and armpit 1), bw / bh (box size in chest widths).
const P = (side, dx, t, bw, bh = bw) => ({ side, dx, t, bw, bh });

const poloEmbroidery = {
  'Left chest': P('front', 0.2, 0.88, 0.18),
  'Large back': P('back', 0, 0.7, 0.45, 0.27),
};
const rules = {
  'mens-polo': poloEmbroidery,
  'womens-polo': poloEmbroidery,
  'organic-polo': poloEmbroidery,
  'printed-polo': {
    // Gelato's DTF front area on this polo is the left chest.
    Front: P('front', 0.2, 0.88, 0.18),
    Back: P('back', 0, 1.2, 0.5, 0.62),
  },
  'heavy-cotton-tee': {
    Front: P('front', 0, 0.92, 0.5, 0.56),
    Back: P('back', 0, 0.9, 0.55, 0.62),
    'Left chest': P('front', 0.22, 0.64, 0.17),
    'Centre chest': P('front', 0, 0.62, 0.17),
    'Large chest': P('front', 0, 0.74, 0.4, 0.27),
  },
  'logo-hoodie': {
    Front: P('front', 0, 0.95, 0.45, 0.5),
    Back: P('back', 0, 1.0, 0.55, 0.62),
    'Left chest': P('front', 0.2, 0.75, 0.17),
    'Centre chest': P('front', 0, 0.75, 0.17),
    'Large chest': P('front', 0, 0.85, 0.38, 0.25),
  },
  'crew-sweatshirt': {
    Front: P('front', 0, 0.92, 0.5, 0.56),
    Back: P('back', 0, 0.92, 0.55, 0.62),
    'Left chest': P('front', 0.2, 0.66, 0.17),
    'Centre chest': P('front', 0, 0.64, 0.17),
    'Large chest': P('front', 0, 0.76, 0.4, 0.27),
  },
};

// Gildan 2000 reuses the Gildan 5000 photos and placements (owner instruction).
const alias = { 'ultra-cotton-tee': 'heavy-cotton-tee' };

export const garmentKey = (slug) => alias[slug] ?? slug;

export const VIEWS = ['model-front', 'model-back', 'flat-front', 'flat-back'];
export const sideOf = (view) => (view.endsWith('back') ? 'back' : 'front');

// "Front + back" style packages cover both of their parts.
const parts = (position) => (position === 'Front + back' ? ['Front', 'Back'] : [position]);

// Boxes to draw on one photo for a chosen position (empty if not visible).
export function boxesFor(slug, view, position) {
  const key = garmentKey(slug);
  const a = anchors[key]?.[view];
  const r = rules[key];
  if (!a || !r) return [];
  const [cx, yn, ya, w] = a;
  return parts(position)
    .map((p) => r[p])
    .filter((rule) => rule && rule.side === sideOf(view))
    .map((rule) => ({
      x: cx + rule.dx * w,
      y: yn + rule.t * (ya - yn),
      w: rule.bw * w,
      h: rule.bh * w,
    }));
}

// The view that best shows a position: back-only positions open on the back.
export const leadView = (position) =>
  (/back/i.test(position) && !/front/i.test(position) ? 'model-back' : 'model-front');
