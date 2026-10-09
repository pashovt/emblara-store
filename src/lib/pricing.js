// Order pricing, from the same model as 05-Business-Plan/Pricing/Emblara-Pricing-Matrix.xlsx
// (website channel). Costs are Gelato ex VAT, in GBP.
//
//   garments   = sum of qty x (method base + size delta + location delta)
//   shipping   = first-item rate + (pieces - 1) x additional-item rate,
//                both taken from the MOST EXPENSIVE garment in the order
//                (owner rule, 9 Oct 2026, matching how Gelato charges a mixed order)
//   digitising = one charge per distinct embroidery location
//   cost       = 1.2 (VAT is a cost, Emblara is not registered) x (garments + shipping) + digitising
//   price      = (cost + Stripe fixed fee) / (1 - target margin - Stripe %)
//
// For a single product this reproduces the matrix prices to the penny.

export const RATES = { vat: 1.2, margin: 0.2, feePct: 0.015, feeFixed: 0.2, digitisation: 4.95 };

const round2 = (n) => Math.round(n * 100) / 100;
// Customer prices round up to the next penny, as the workbook does.
const ceil2 = (n) => Math.ceil(n * 100 - 1e-9) / 100;
const priceFor = (cost) => (cost + RATES.feeFixed) / (1 - RATES.margin - RATES.feePct);

// Retail effect of a per-piece cost delta, for the "+£x" labels on options.
export const retailAdd = (cost) => round2((cost * RATES.vat) / (1 - RATES.margin - RATES.feePct));

export const methodOf = (product, id) => product.methods.find((m) => m.id === id) ?? product.methods[0];

const costOf = (list, label) => list.find((x) => x.label === label)?.cost ?? 0;

// lines: [{ product, method, size, position, qty }]
export function quote(lines) {
  const priced = lines.map((l) => {
    const m = methodOf(l.product, l.method);
    return { ...l, m, garment: m.base + costOf(m.sizes, l.size) + costOf(m.positions, l.position) };
  });
  const pieces = priced.reduce((n, l) => n + l.qty, 0);
  if (pieces === 0) return { total: 0, lines: [], pieces: 0, lead: null };

  const lead = priced.reduce((top, l) => (l.garment > top.garment ? l : top));
  const { first, extra } = lead.product.ship;
  const shipping = first + (pieces - 1) * extra;
  const garments = priced.reduce((sum, l) => sum + l.garment * l.qty, 0);
  const spots = new Set(priced.filter((l) => l.m.digitised).map((l) => l.position));
  const cost = RATES.vat * (garments + shipping) + spots.size * RATES.digitisation;
  // The workbook rounds the per-piece price up, so the order is pieces x that.
  const total = round2(ceil2(priceFor(cost) / pieces) * pieces);

  // Share the order total across lines by garment cost plus an even share of
  // delivery. The total above is the figure that counts.
  const shipPerPiece = shipping / pieces;
  const weights = priced.map((l) => (l.garment + shipPerPiece) * l.qty);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => round2((total * w) / weightSum));
  const drift = round2(total - shares.reduce((a, b) => a + b, 0));
  shares[shares.indexOf(Math.max(...shares))] += drift;

  return {
    total,
    pieces,
    lead: lead.product.slug,
    lines: priced.map((l, i) => ({ ...l, total: round2(shares[i]), unit: shares[i] / l.qty })),
  };
}

// One product on its own, as the product page shows it.
export const singleQuote = (product, { method, size, position, qty = 1 }) =>
  quote([{ product, method, size: size || methodOf(product, method).sizes[0].label, position, qty }]);

export const unitPrice = (product, opts) => {
  const q = singleQuote(product, opts);
  return q.total / q.pieces;
};
