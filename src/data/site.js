// Brand, copy and store settings. Anything marked CONFIRM depends on the
// production-partner agreement.

export const site = {
  brand: 'EMBLARA',
  tagline: 'Branded workwear for business & teams',
  demoNotice: 'Concept store demo — products, prices and images are illustrative. No orders are taken.',
  // CONFIRM: only show a partner name once there is a written agreement.
  partner: { name: '', line: 'Embroidered in the UK by our production partner.' },
  currency: 'GBP',
};

export const nav = [
  { label: 'Shop', href: '#/shop' },
  { label: 'How it works', href: '#/process' },
  { label: 'Mock-up', href: '#/mockup' },
];

// CONFIRM: quantity discount tiers.
export const tiers = [
  { min: 1, off: 0, label: '1–9' },
  { min: 10, off: 0.1, label: '10–24' },
  { min: 25, off: 0.15, label: '25–49' },
  { min: 50, off: 0.2, label: '50+' },
];

// CONFIRM: delivery options and prices.
export const delivery = [
  { id: 'standard', label: 'Standard tracked', note: 'Dispatched after proof approval', price: 4.95 },
  { id: 'express', label: 'Express tracked', note: 'Priority production slot', price: 9.95 },
];

export const freeDeliveryOver = 150;

export const hero = {
  lines: [
    { text: 'One logo.', serif: false },
    { text: 'the whole', serif: true },
    { text: 'team kit.', serif: false },
  ],
  sub: 'Polos, tees, fleeces, jackets and salon tunics with your logo embroidered or printed. Order one or fifty. See a proof before anything is made.',
  sequence: [
    { image: '/products/polo-pique-navy-model.webp', label: 'Pique polo', slug: 'pique-polo' },
    { image: '/products/fleece-mens-navy-model.webp', label: 'Zip fleece', slug: 'zip-fleece' },
    { image: '/products/parka-black-front.webp', label: 'Waterproof parka', slug: 'waterproof-parka' },
    { image: '/products/hoodie-navy-model.webp', label: 'Hoodie', slug: 'logo-hoodie' },
    { image: '/products/polo-womens-navy-model.webp', label: 'Women’s fit polo', slug: 'womens-polo' },
  ],
};

export const marquee = {
  top: ['Embroidered', 'Printed', 'Stitched', 'Delivered'],
  bottom: ['Your logo', 'Your team', 'Your colours', 'Your sizes'],
};

export const statement = [
  ['Kit', false], ['out', false], ['the', false], ['whole', false], ['team,', false],
  ['from', false], ['the', false], ['first', true], ['polo', false], ['to', false], ['the', false], ['fiftieth,', true],
  ['with', false], ['your', false], ['logo', false], ['stitched', true], ['exactly', false], ['where', false],
  ['you', false], ['approved', true], ['it.', false],
];

// Editorial row: col = start column, span = width (12-column grid),
// drop = vertical offset in rem, speed = parallax distance in px.
export const gallery = [
  { image: '/products/fleece-womens-model.webp', caption: 'Zip fleece — left chest', slug: 'zip-fleece', col: 1, span: 3, drop: 6, speed: -50 },
  { image: '/products/parka-black-back.webp', caption: 'Parka — back logo', slug: 'waterproof-parka', col: 4, span: 3, drop: 0, speed: 30 },
  { image: '/products/cap-black-flat.webp', caption: 'Cap — front panel', slug: 'logo-cap', col: 7, span: 2, drop: 10, speed: -70 },
  { image: '/products/polo-printed-back-model.webp', caption: 'Printed polo — full back', slug: 'printed-polo', col: 9, span: 2, drop: 3, speed: -20 },
  { image: '/products/bodywarmer-black-model.webp', caption: 'Bodywarmer — left chest', slug: 'bodywarmer', col: 11, span: 2, drop: 8, speed: 40 },
];

export const process = [
  { title: 'Choose the kit', body: 'Pick garments, colours and sizes. Mix sizes in one order.' },
  { title: 'Add your logo', body: 'Upload at checkout or send it after. Vector or high-res PNG is best.' },
  { title: 'Approve the proof', body: 'We send a digital proof with placement, size and thread colours. Nothing is made until you say yes.' },
  { title: 'Wear it', body: 'Made to the approved proof and sent tracked. Reorders reuse your approved logo.' },
];

// Try-on hero. Gelato "man2" previews: the pose is identical within each
// garment type, so colour changes look like the garment sliding on.
const look = (garment, colour, hex, slug, label) => ({
  garment, colour: colour.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), hex, slug, label,
  model: `/tryon/${garment}-${colour}-model.webp`,
  flat: `/tryon/${garment}-${colour}-flat.webp`,
});

export const tryon = {
  eyebrow: 'Virtual fitting room',
  lines: [
    { text: 'Try the', serif: true },
    { text: 'team kit', serif: false },
    { text: 'on.', serif: false },
  ],
  sub: 'Scroll to put the next garment on. One logo, every colour, ready for the whole team.',
  looks: [
    look('tee', 'navy', '#1d2840', 'embroidered-tee', 'Embroidered tee'),
    look('tee', 'maroon', '#6b1f2e', 'embroidered-tee', 'Embroidered tee'),
    look('tee', 'sport-grey', '#9a9ea3', 'embroidered-tee', 'Embroidered tee'),
    look('hoodie', 'black', '#121214', 'logo-hoodie', 'Logo hoodie'),
    look('hoodie', 'forest-green', '#1f4a36', 'logo-hoodie', 'Logo hoodie'),
    look('hoodie', 'navy', '#1d2840', 'logo-hoodie', 'Logo hoodie'),
    look('sweat', 'sand', '#cdb894', 'crew-sweatshirt', 'Crew sweatshirt'),
    look('sweat', 'sport-grey', '#9a9ea3', 'crew-sweatshirt', 'Crew sweatshirt'),
    look('sweat', 'navy', '#1d2840', 'crew-sweatshirt', 'Crew sweatshirt'),
  ],
};
