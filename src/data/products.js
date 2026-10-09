// Website range, 9 Oct 2026. Source: 02-Listings/Gelato/00-Product-Index.csv and
// 00-Option-Rules.csv, priced by src/lib/pricing.js (same model as
// 05-Business-Plan/Pricing/Emblara-Pricing-Matrix.xlsx, website channel).
//
// - Launch is Gelato products only. Weaves of Heaven is possible later website
//   supply, subject to a supplier agreement, so none of its products are here.
// - Outerwear, vests, fleeces and jackets are deferred. Spa products are a
//   separate range. Neither is in this store.
// - Costs are Gelato ex VAT. `base` is the garment with one decoration location
//   in the smallest size; `ship` is the first-item and additional-item delivery
//   rate. A mixed order is delivered at the rate of its most expensive garment.
// - `sizes` and `positions` hold cost deltas. Sizes and locations the sheet marks
//   unavailable are left out.
// All prices are planning figures, not final. Nothing is on sale.

import { retailAdd, unitPrice } from '../lib/pricing.js';

const C = {
  navy: { name: 'Navy', hex: '#1d2840' },
  frenchNavy: { name: 'French Navy', hex: '#222c4d' },
  black: { name: 'Black', hex: '#121214' },
  white: { name: 'White', hex: '#f5f5f2' },
  sportGrey: { name: 'Sport Grey', hex: '#9a9ea3' },
  greyMelange: { name: 'Grey Melange', hex: '#8c8f93' },
  pureGrey: { name: 'Pure Grey', hex: '#a9acaf' },
  royal: { name: 'Royal Blue', hex: '#2a4fb5' },
};

const opt = (label, cost = 0) => ({ label, cost, add: cost ? retailAdd(cost) : 0 });
const sizes = (list) => list.map(([label, cost]) => opt(label, cost));

const printPositions = (both) => [opt('Front'), opt('Back'), opt('Front + back', both)];
const chestPositions = [opt('Left chest'), opt('Centre chest'), opt('Large chest')];
const poloPositions = [opt('Left chest'), opt('Large back')];

const shots = (...names) => names.map((n) => `/${n}.webp`);

export const categories = [
  { id: 'all', label: 'All' },
  { id: 'polos', label: 'Polos' },
  { id: 'tees', label: 'T-shirts' },
  { id: 'sweats', label: 'Hoodies & sweatshirts' },
];

export const products = [
  {
    slug: 'mens-polo', name: 'Men’s polo', category: 'polos',
    ship: { first: 3.42, extra: 0.97 },
    previewColour: 'Black',
    colours: [C.black, C.white, C.pureGrey, C.royal],
    colourImages: {
      Black: shots('products/perfect-men-black-model'),
      White: shots('products/mens-polo-white-model'),
      'Pure Grey': shots('products/mens-polo-pure-grey-model'),
      'Royal Blue': shots('products/mens-polo-royal-blue-model'),
    },
    fabric: '100% combed ringspun cotton, 180 gsm',
    blurb: 'A fitted cotton polo with your logo stitched on the left chest. A smart everyday shirt for staff and teams.',
    specs: ['Men’s fitted cut', 'Embroidered logo, left chest or large back', 'Four colours', 'Sizes S to 3XL'],
    badge: '100% cotton',
    methods: [
      {
        id: 'embroidery', label: 'Embroidered', base: 12.89, digitised: true,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.65], ['3XL', 3.18]]),
        positions: poloPositions,
      },
    ],
  },
  {
    slug: 'womens-polo', name: 'Women’s polo', category: 'polos',
    ship: { first: 3.42, extra: 0.97 },
    previewColour: 'French Navy',
    colours: [C.frenchNavy, C.white, C.black],
    colourImages: {
      'French Navy': shots('products/polo-womens-navy-model'),
      White: shots('products/womens-polo-white-model'),
      Black: shots('products/womens-polo-black-model'),
    },
    fabric: '100% combed ringspun cotton, 180 gsm',
    blurb: 'A shaped cotton polo for mixed teams, salons and front-of-house staff, with your logo embroidered on the left chest.',
    specs: ['Women’s fitted cut', 'Embroidered logo, left chest or large back', 'Three colours', 'Sizes S to L'],
    badge: '100% cotton',
    methods: [
      {
        id: 'embroidery', label: 'Embroidered', base: 12.89, digitised: true,
        sizes: sizes([['S'], ['M'], ['L']]),
        positions: poloPositions,
      },
    ],
  },
  {
    slug: 'organic-polo', name: 'Organic cotton polo', category: 'polos',
    ship: { first: 3.42, extra: 0.97 },
    previewColour: 'Black',
    colours: [C.black, C.white],
    colourImages: {
      Black: shots('products/organic-black-model'),
      White: shots('products/organic-white-model'),
    },
    fabric: '100% organically grown cotton',
    blurb: 'A polo in organically grown cotton, embroidered with your logo. For teams that want a lower-impact fabric.',
    specs: ['Men’s cut', 'Embroidered logo, left chest or large back', 'Two colours', 'Sizes S to 3XL'],
    badge: 'Organic cotton',
    methods: [
      {
        id: 'embroidery', label: 'Embroidered', base: 14.82, digitised: true,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.65], ['3XL', 3.18]]),
        positions: poloPositions,
      },
    ],
  },
  {
    slug: 'printed-polo', name: 'Printed polo', category: 'polos',
    ship: { first: 3.42, extra: 0.97 },
    previewColour: 'Navy',
    colours: [C.navy, C.black, C.white, C.greyMelange],
    colourImages: {
      Navy: shots('products/polo-pique-navy-model', 'products/polo-pique-navy-flat'),
      Black: shots('products/polo-fotl-black-model'),
      White: shots('products/spring-white-model'),
      'Grey Melange': shots('products/spring-grey-melange-model'),
    },
    fabric: '100% ringspun cotton piqué, 210 gsm',
    fabricByColour: { 'Grey Melange': '85% cotton / 15% viscose piqué, 210 gsm' },
    blurb: 'A cotton piqué polo with a full-colour print. Put the logo on the front, the back, or both.',
    specs: ['Men’s cut', 'Full-colour transfer print', 'Front, back or front + back', 'Sizes S to 5XL'],
    methods: [
      {
        id: 'print', label: 'Printed', base: 13.0,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL'], ['3XL', 4], ['4XL', 6], ['5XL', 8]]),
        positions: printPositions(4.66),
      },
    ],
  },
  {
    slug: 'heavy-cotton-tee', name: 'Heavy cotton tee', category: 'tees',
    ship: { first: 3.19, extra: 0.95 },
    previewColour: 'Navy',
    colours: [C.navy, C.sportGrey, C.white, C.black],
    colourImages: {
      Navy: shots('tryon/tee-navy-model', 'tryon/tee-navy-flat'),
      'Sport Grey': shots('tryon/tee-sport-grey-model', 'tryon/tee-sport-grey-flat'),
      White: shots('tryon/tee-white-model', 'tryon/tee-white-flat'),
      Black: shots('tryon/tee-black-model', 'tryon/tee-black-flat'),
    },
    fabric: '100% cotton (preshrunk jersey knit)',
    fabricByColour: { 'Sport Grey': '90% cotton / 10% polyester' },
    blurb: 'A sturdy unisex crew-neck tee. Print it for the lowest price, or have the logo embroidered for a finish that lasts.',
    specs: ['Unisex fit', 'Printed or embroidered', 'Sizes S to 5XL printed, S to 3XL embroidered', 'Four colours'],
    methods: [
      {
        id: 'print', label: 'Printed', base: 7.29,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.7], ['3XL', 3.3], ['4XL', 9], ['5XL', 11.2]]),
        positions: printPositions(4.6),
      },
      {
        id: 'embroidery', label: 'Embroidered', base: 11.29, digitised: true,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.6], ['3XL', 3.2]]),
        positions: chestPositions,
      },
    ],
  },
  {
    slug: 'ultra-cotton-tee', name: 'Ultra cotton tee', category: 'tees',
    ship: { first: 2.8, extra: 0.79 },
    previewColour: 'Sport Grey',
    colours: [C.sportGrey, C.white, C.navy, C.black],
    colourImages: { 'Sport Grey': shots('products/tee-sport-grey-couple') },
    fabric: '100% cotton',
    fabricByColour: { 'Sport Grey': '90% cotton / 10% polyester' },
    blurb: 'A smoother, heavier unisex tee with a printed logo on the front, the back, or both.',
    specs: ['Unisex fit', 'Printed', 'Front, back or front + back', 'Sizes S to 5XL'],
    methods: [
      {
        id: 'print', label: 'Printed', base: 10.91,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.96], ['3XL', 3.77], ['4XL', 5.57], ['5XL', 7.37]]),
        positions: printPositions(5.04),
      },
    ],
  },
  {
    slug: 'logo-hoodie', name: 'Logo hoodie', category: 'sweats',
    ship: { first: 4.39, extra: 1.19 },
    previewColour: 'Navy',
    colours: [C.navy, C.black, C.white, C.sportGrey],
    colourImages: {
      Navy: shots('tryon/hoodie-navy-model', 'tryon/hoodie-navy-flat'),
      Black: shots('tryon/hoodie-black-model', 'tryon/hoodie-black-flat'),
      White: shots('products/hoodie-white-front', 'products/hoodie-white-back'),
      'Sport Grey': shots('tryon/hoodie-sport-grey-model', 'tryon/hoodie-sport-grey-flat'),
    },
    fabric: '50% cotton / 50% polyester',
    blurb: 'A pullover hoodie for site teams, gyms and crews. Print the front, the back, or both, or embroider the chest.',
    specs: ['Unisex fit', 'Printed or embroidered', 'Sizes S to 5XL printed, S to 3XL embroidered', 'Four colours'],
    methods: [
      {
        id: 'print', label: 'Printed', base: 17.18,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.7], ['3XL', 3.27], ['4XL', 8.14], ['5XL', 9.94]]),
        positions: printPositions(4.93),
      },
      {
        id: 'embroidery', label: 'Embroidered', base: 19.0, digitised: true,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.7], ['3XL', 3.27]]),
        positions: chestPositions,
      },
    ],
  },
  {
    slug: 'crew-sweatshirt', name: 'Crew sweatshirt', category: 'sweats',
    ship: { first: 3.99, extra: 0.99 },
    previewColour: 'Navy',
    colours: [C.navy, C.sportGrey, C.white, C.black],
    colourImages: {
      Navy: shots('tryon/sweat-navy-model', 'tryon/sweat-navy-flat'),
      'Sport Grey': shots('tryon/sweat-sport-grey-model', 'tryon/sweat-sport-grey-flat'),
      White: shots('products/sweat-white-front', 'products/sweat-white-back'),
      Black: shots('tryon/sweat-black-model', 'tryon/sweat-black-flat'),
    },
    fabric: '50% cotton / 50% polyester',
    blurb: 'A smart-casual crew neck for offices and winter uniforms. Print it, or have the logo embroidered on the chest.',
    specs: ['Unisex fit', 'Printed or embroidered', 'Sizes S to 5XL printed, S to 3XL embroidered', 'Four colours'],
    methods: [
      {
        id: 'print', label: 'Printed', base: 14.72,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.7], ['3XL', 3.27], ['4XL', 7.77], ['5XL', 9.58]]),
        positions: printPositions(4.93),
      },
      {
        id: 'embroidery', label: 'Embroidered', base: 18.54, digitised: true,
        sizes: sizes([['S'], ['M'], ['L'], ['XL'], ['2XL', 1.7], ['3XL', 3.27]]),
        positions: chestPositions,
      },
    ],
  },
];

products.forEach((p) => {
  // Default shots are the preview colour's.
  p.images = p.colourImages[p.previewColour] ?? [];
  p.method = p.methods.map((m) => m.label).join(' or ');
  // Lowest price for one piece, for "from £x" labels.
  p.price = Math.min(...p.methods.map((m) => unitPrice(p, { method: m.id, qty: 1 })));
});

export const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));

// Photos for a colour; falls back to the product's default shots.
export const imagesFor = (product, colour) => product.colourImages?.[colour] ?? product.images;
