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
  { image: '/products/hoodie-white-back.webp', caption: 'Hoodie — back logo', slug: 'logo-hoodie', col: 1, span: 3, drop: 6, speed: -50 },
  { image: '/products/polo-womens-navy-model.webp', caption: 'Women’s polo — left chest', slug: 'womens-polo', col: 4, span: 3, drop: 0, speed: 30 },
  { image: '/products/perfect-men-black-model.webp', caption: 'Men’s polo — left chest', slug: 'mens-polo', col: 7, span: 2, drop: 10, speed: -70 },
  { image: '/products/spring-white-model.webp', caption: 'Printed polo — chest', slug: 'printed-polo', col: 9, span: 2, drop: 3, speed: -20 },
  { image: '/products/sweat-white-front.webp', caption: 'Crew sweatshirt — left chest', slug: 'crew-sweatshirt', col: 11, span: 2, drop: 8, speed: 40 },
];

export const process = [
  { title: 'Choose the kit', body: 'Pick garments, colours and sizes. Mix sizes in one order.' },
  { title: 'Add your logo', body: 'Upload at checkout or send it after. Vector or high-res PNG is best.' },
  { title: 'Approve the proof', body: 'We send a digital proof with placement, size and colours. Nothing is made until you say yes.' },
  { title: 'Wear it', body: 'Made to the approved proof and sent tracked to one UK address.' },
];

// Try-on hero. Gelato "man2" previews: the pose is identical within each
// garment type, so colour changes look like the garment sliding on.
const look = (garment, colour, hex, slug, label) => ({
  garment, colour: colour.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), hex, slug, label,
  model: `/tryon/${garment}-${colour}-model.webp`,
  flat: `/tryon/${garment}-${colour}-flat.webp`,
});

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
    look('tee', 'navy', '#1d2840', 'heavy-cotton-tee', 'Heavy cotton tee'),
    look('tee', 'sport-grey', '#9a9ea3', 'heavy-cotton-tee', 'Heavy cotton tee'),
    look('tee', 'white', '#f5f5f2', 'heavy-cotton-tee', 'Heavy cotton tee'),
    look('hoodie', 'black', '#121214', 'logo-hoodie', 'Logo hoodie'),
    look('hoodie', 'navy', '#1d2840', 'logo-hoodie', 'Logo hoodie'),
    look('hoodie', 'white', '#f5f5f2', 'logo-hoodie', 'Logo hoodie'),
    look('sweat', 'sport-grey', '#9a9ea3', 'crew-sweatshirt', 'Crew sweatshirt'),
    look('sweat', 'navy', '#1d2840', 'crew-sweatshirt', 'Crew sweatshirt'),
    look('sweat', 'black', '#121214', 'crew-sweatshirt', 'Crew sweatshirt'),
  ],
};
