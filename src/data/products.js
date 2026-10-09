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
import aiShots from './ai-shots.json';

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

export const categories = [
  { id: 'all', label: 'All' },
  { id: 'polos', label: 'Polos' },
  { id: 'tees', label: 'T-shirts' },
  { id: 'sweats', label: 'Hoodies & sweatshirts' },
  { id: 'services', label: 'Services' },
];

export const products = [
  {
    slug: 'mens-polo', name: 'Men’s polo', category: 'polos',
    ship: { first: 3.42, extra: 0.97 },
    colours: [C.black, C.white, C.pureGrey, C.royal],
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
    colours: [C.frenchNavy, C.white, C.black],
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
    colours: [C.black, C.white],
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
    colours: [C.navy, C.black, C.white, C.greyMelange],
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
    colours: [C.navy, C.sportGrey, C.white, C.black],
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
    colours: [C.sportGrey, C.white, C.navy, C.black],
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
    colours: [C.navy, C.black, C.white, C.sportGrey],
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
    colours: [C.navy, C.sportGrey, C.white, C.black],
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

// Professional logo clean-up, done with the Emblara artwork software.
// CONFIRM: price. Placeholder until the owner sets it.
products.push({
  slug: 'logo-clean-up', name: 'Professional logo clean-up', category: 'services', service: true,
  price: 15,
  colours: [],
  method: 'Service',
  blurb: 'Send us any logo, even a blurry screenshot or a photo of a sign. We redraw it into crisp, print-ready artwork for embroidery and print, and send you the files to keep.',
  specs: ['Background removed and edges cleaned', 'Embroidery-ready and print-ready versions', 'Light and dark versions for any garment colour', 'Files are yours to keep'],
});

products.forEach((p) => {
  if (p.service) return;
  // The owner's AI model shot (06-AI-Models), when there is one. The product
  // opens on that colour, finish and logo position so the first photo is it.
  p.ai = aiShots[p.slug] ?? null;
  if (p.ai) {
    p.colours = [...p.colours.filter((c) => c.name === p.ai.colour), ...p.colours.filter((c) => c.name !== p.ai.colour)];
    p.methods = [...p.methods.filter((m) => m.id === p.ai.method), ...p.methods.filter((m) => m.id !== p.ai.method)];
  }
  p.method = p.methods.map((m) => m.label).join(' or ');
  // Lowest price for one piece, for "from £x" labels.
  p.price = Math.min(...p.methods.map((m) => unitPrice(p, { method: m.id, qty: 1 })));
});

export const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));

// The logo position a product shows by default.
export const defaultPosition = (product) => product.ai?.position ?? product.methods?.[0].positions[0].label ?? '';
