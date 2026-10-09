// Brand, copy and store settings. Updated 9 Oct 2026 for the Gelato-only launch
// range: see 05-Business-Plan/Pricing/README.md. Anything marked CONFIRM is
// still open.

export const site = {
  brand: 'EMBLARA',
  tagline: 'Branded clothing for business & teams',
  demoNotice: 'Concept store demo — products, prices and images are illustrative. No orders are taken.',
  line: 'Made to order with your logo, embroidered or printed.',
  currency: 'GBP',
};

export const nav = [
  { label: 'Shop', href: '#/shop' },
  { label: 'How it works', href: '#/process' },
  { label: 'Mock-up', href: '#/mockup' },
];

// Quantities shown in the price-by-quantity table. The delivered price per
// garment falls as the number of pieces in the order rises; see lib/pricing.js.
export const breaks = [
  { min: 1, label: '1' },
  { min: 2, label: '2–4' },
  { min: 5, label: '5–9' },
  { min: 10, label: '10–24' },
  { min: 25, label: '25–49' },
  { min: 50, label: '50+' },
];

// Delivery is inside every price (one UK address per order). A mixed order is
// delivered at the rate of its most expensive garment (owner rule, 9 Oct 2026).
// CONFIRM: delivery times, and several delivery addresses.
export const deliveryNote = 'Tracked UK delivery is included. A mixed order ships at the rate of its most expensive item.';

export const marquee = {
  top: ['Embroidered', 'Printed', 'Stitched', 'Delivered'],
  bottom: ['Your logo', 'Your team', 'Your colours', 'Your sizes'],
};

export const statement = [
  ['Kit', false], ['out', false], ['the', false], ['whole', false], ['team,', false],
  ['from', false], ['the', false], ['first', true], ['polo', false], ['to', false], ['the', false], ['fiftieth,', true],
  ['with', false], ['your', false], ['logo', false], ['placed', true], ['exactly', false], ['where', false],
  ['you', false], ['approved', true], ['it.', false],
];

// Editorial row: col = start column, span = width (12-column grid),
// drop = vertical offset in rem, speed = parallax distance in px.
// Each item shows the product's AI model shot (its own colour and logo position).
export const gallery = [
  { slug: 'logo-hoodie', caption: 'Hoodie — front print', col: 1, span: 3, drop: 6, speed: -50 },
  { slug: 'womens-polo', caption: 'Women’s polo — left chest', col: 4, span: 3, drop: 0, speed: 30 },
  { slug: 'organic-polo', caption: 'Organic polo — left chest', col: 7, span: 2, drop: 10, speed: -70 },
  { slug: 'heavy-cotton-tee', caption: 'Heavy cotton tee — front print', col: 9, span: 2, drop: 3, speed: -20 },
  { slug: 'crew-sweatshirt', caption: 'Sweatshirt — left chest', col: 11, span: 2, drop: 8, speed: 40 },
];

export const process = [
  { title: 'Choose the kit', body: 'Pick garments, colours and sizes. Mix sizes in one order.' },
  { title: 'Add your logo', body: 'Upload at checkout or send it after. Vector or high-res PNG is best.' },
  { title: 'Approve the proof', body: 'We send a digital proof with placement, size and colours. Nothing is made until you say yes.' },
  { title: 'Wear it', body: 'Made to the approved proof and sent tracked to one UK address.' },
];

// Try-on hero: the owner's AI model shots (06-AI-Models), one per product, in
// this order. Colour and logo position come from each shot (ai-shots.json).
export const tryon = {
  eyebrow: 'Virtual fitting room',
  lines: [
    { text: 'Try the', serif: true },
    { text: 'team kit', serif: false },
    { text: 'on.', serif: false },
  ],
  sub: 'Scroll through the range on our team of models. One logo, every garment, ready for the whole team.',
  order: ['logo-hoodie', 'heavy-cotton-tee', 'organic-polo', 'womens-polo', 'mens-polo', 'ultra-cotton-tee', 'printed-polo', 'crew-sweatshirt'],
};
