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
export const gallery = [
  { slug: 'logo-hoodie', colour: 'White', view: 'model-back', position: 'Back', caption: 'Hoodie — back print', col: 1, span: 3, drop: 6, speed: -50 },
  { slug: 'womens-polo', colour: 'French Navy', view: 'model-front', position: 'Left chest', caption: 'Women’s polo — left chest', col: 4, span: 3, drop: 0, speed: 30 },
  { slug: 'mens-polo', colour: 'Black', view: 'model-front', position: 'Left chest', caption: 'Men’s polo — left chest', col: 7, span: 2, drop: 10, speed: -70 },
  { slug: 'printed-polo', colour: 'White', view: 'model-back', position: 'Back', caption: 'Printed polo — back', col: 9, span: 2, drop: 3, speed: -20 },
  { slug: 'crew-sweatshirt', colour: 'Sport Grey', view: 'model-front', position: 'Left chest', caption: 'Sweatshirt — left chest', col: 11, span: 2, drop: 8, speed: 40 },
];

export const process = [
  { title: 'Choose the kit', body: 'Pick garments, colours and sizes. Mix sizes in one order.' },
  { title: 'Add your logo', body: 'Upload at checkout or send it after. Vector or high-res PNG is best.' },
  { title: 'Approve the proof', body: 'We send a digital proof with placement, size and colours. Nothing is made until you say yes.' },
  { title: 'Wear it', body: 'Made to the approved proof and sent tracked to one UK address.' },
];

// Try-on hero. Gelato "man2" previews: the pose is identical within each
// garment type, so colour changes look like the garment sliding on. The logo
// is drawn on live (EMBLARA or the visitor's own) at `position`.
const look = (slug, colour, hex, label) => ({ slug, colour, hex, label, position: 'Left chest' });

// Only colours the range actually offers: Navy, Sport Grey, Black, White.
export const tryon = {
  eyebrow: 'Virtual fitting room',
  lines: [
    { text: 'Try the', serif: true },
    { text: 'team kit', serif: false },
    { text: 'on.', serif: false },
  ],
  sub: 'Scroll to put the next garment on. One logo, every colour, ready for the whole team.',
  looks: [
    look('heavy-cotton-tee', 'Navy', '#1d2840', 'Heavy cotton tee'),
    look('heavy-cotton-tee', 'Sport Grey', '#9a9ea3', 'Heavy cotton tee'),
    look('heavy-cotton-tee', 'White', '#f5f5f2', 'Heavy cotton tee'),
    look('logo-hoodie', 'Black', '#121214', 'Logo hoodie'),
    look('logo-hoodie', 'Navy', '#1d2840', 'Logo hoodie'),
    look('logo-hoodie', 'White', '#f5f5f2', 'Logo hoodie'),
    look('crew-sweatshirt', 'Sport Grey', '#9a9ea3', 'Crew sweatshirt'),
    look('crew-sweatshirt', 'Navy', '#1d2840', 'Crew sweatshirt'),
    look('crew-sweatshirt', 'Black', '#121214', 'Crew sweatshirt'),
  ],
};
