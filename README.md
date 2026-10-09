# EMBLARA store demo (Gelato launch range)

Demo storefront for EMBLARA with a "virtual fitting room" hero. Browse, configure, add to bag and check out. **The checkout is a demo: no payment is taken and nothing is sent.**

Updated 9 October 2026 to match the current plan in `05-Business-Plan/Pricing/` and `02-Listings/Gelato/`. The folder name still says WeavesOfHeaven because it began as a mock-up of that range. It no longer contains any WoH product.

## What changed on 9 Oct 2026

| Before | Now |
|---|---|
| 19 products, mostly from the WeavesOfHeaven catalogue | **8 Gelato products**: 4 polos, 2 tees, hoodie, sweatshirt |
| Fleeces, bodywarmer, parka, tunics, towels, robes, cap, rugby shirt | Removed. Outerwear is deferred and spa/hospitality is a separate range |
| Demo prices and 10/25/50 team discount tiers | **Website prices from the pricing matrix**, calculated per order by `src/lib/pricing.js` (matches the workbook to the penny at 1, 2, 5, 10, 25 and 50) |
| Standard/express delivery plus a free-delivery threshold | **Delivery included in every price** (one UK address per order). **A mixed order ships at the rate of its most expensive garment**: that garment's first-item rate, then its additional-item rate for every other piece (owner rule, 9 Oct 2026) |
| One decoration method per product | Tees, hoodie and sweatshirt offer **printed or embroidered**, each with its own sizes, positions and prices |
| Free-text "partner" credit in the footer | Removed. No supplier is named |
| Maroon, forest green and sand try-on looks | Only colours the range sells |

Source of truth for prices: `05-Business-Plan/Pricing/Emblara-Pricing-Matrix.xlsx`, sheet **Pricing matrix**, channel **Website**. Margin target 20% after Stripe fees. No VAT is added because Emblara is not VAT registered.

Pricing model (`src/lib/pricing.js`): order cost = 1.2 × (garments + shipping) + £4.95 per distinct embroidery location; price = (cost + £0.20) ÷ (1 − 20% − 1.5%), rounded up to the penny per piece. Gelato costs and shipping rates sit in `src/data/products.js`. "Most expensive garment" means the highest garment cost in the bag, which in this range is also the highest delivery rate.

## Range

| Product | Gelato model | Finish | From (1 piece) |
|---|---|---|---|
| Men’s polo | SOL’S Perfect Men 11346 | Embroidered | £31.50 |
| Women’s polo | SOL’S Perfect Women 11347 | Embroidered | £31.50 |
| Organic cotton polo | SOL’S Planet 03566 | Embroidered | £34.45 |
| Printed polo | SOL’S Spring II 11362 | Printed (DTF) | £25.36 |
| Heavy cotton tee | Gildan 5000 | Printed or embroidered | £16.28 |
| Ultra cotton tee | Gildan 2000 | Printed | £21.22 |
| Logo hoodie | Gildan 18500 | Printed or embroidered | £33.23 |
| Crew sweatshirt | Gildan 18000 | Printed or embroidered | £28.86 |

Model names are for the team. They are not shown on the site.

Sizes and locations follow `02-Listings/Gelato/00-Option-Rules.csv`. Anything the sheet marks unavailable is left out (for example Perfect Women XL to 3XL, and embroidery on the back of a tee). Size and "front + back" surcharges are Gelato cost deltas run through the same maths.

## Things to confirm before this is more than a demo

- **Planet organic polo** is approved by the owner (9 Oct 2026).
- **Prices are planning figures.** The mixed-order shipping rule is the owner's reading of how Gelato charges; check it against a real mixed basket quote. Several delivery addresses are not modelled. One embroidery charge per distinct location is an assumption for mixed orders.
- **Reused logos:** the £4.95 digitisation is inside the embroidery price. Whether a reorder avoids it is unconfirmed, so the site makes no promise about reorders.
- **Delivery times** are not stated. The site says they are confirmed with the proof.
- **Photos.** Every colour now has a photo except Ultra cotton tee in White, Navy and Black (the page says "Preview shown in Sport Grey"). Images are Gelato catalogue previews (`scripts-fetch-tryon.mjs`, `scripts-fetch-products.mjs`, logo added digitally) or the owner’s Gelato mockups (`scripts-owner-mockups.mjs`), all labelled illustrative.
- WoH can return as website supply only after a written agreement. Do not add WoH products or a partner credit before then.
- Still to do for a real launch: payment provider, order emails, logo upload storage, privacy policy and terms, Clarity + UTM capture, and removing `noindex`.

## Try-on hero (`src/components/TryOnHero.jsx`)

- A model stands centre stage; flat garments ride a 3D ring around him.
- Scrolling (desktop, pinned) turns the ring. As the next garment reaches the centre, a copper scan line wipes the model into it.
- Within one garment type the photo is pixel-identical apart from the clothing, so the change reads as the garment sliding on. Between types (tee, hoodie, sweatshirt) the model changes, because Gelato uses a different model per garment.
- Arrows, colour dots, keyboard arrows and swipe also work. Phones: no pinning, auto-advances while visible. Reduced motion: instant switches, no scan line.
- Looks are listed in `tryon` in `src/data/site.js`. All four colours (Navy, Sport Grey, Black, White) are downloaded; nine are in the hero.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
npm run preview
```

Deploy anywhere static (Vercel preset: Vite, output `dist`). Routing uses `#/` hashes, so no rewrites are needed. This folder is the git repo behind https://emblara-store.vercel.app: pushing `main` redeploys.

## What's in it

- **Home:** try-on hero; a copper running stitch sewn across a two-row marquee; a statement that lights up word by word; featured products; parallax gallery; how it works; mock-up call to action.
- **Shop** (`#/shop`, `#/shop/<category>`): 8 products in Polos, T-shirts, and Hoodies & sweatshirts.
- **Product pages** (`#/product/<slug>`): finish (printed or embroidered), colour with its own photos, size with surcharges, logo position, quantity, logo file (stays on device), a price-by-quantity table, fabric by colour, proof and returns info.
- **Bag drawer:** quantities, whole-order pricing across items, sizes and colours, delivery-included note. Persists in localStorage (`emblara-bag-v2`).
- **Checkout** (`#/checkout`): contact, UK address with validation, delivery-included card, logo handling, disabled payment block, order summary, demo confirmation.
- Smooth scroll (Lenis) + GSAP ScrollTrigger. Reduced motion: no smooth scroll, pinning or animation.

## Edit

| What | Where |
|---|---|
| Products, Gelato costs, options, fabric, photos | `src/data/products.js` |
| Pricing rules and rates | `src/lib/pricing.js` |
| Copy, price-break labels, gallery, try-on looks | `src/data/site.js` |
| Colours, fonts, spacing | top of `src/styles/global.css` |
| Images | `public/products/`, `public/tryon/` |
| Rebuild owner-mockup images | `node scripts-owner-mockups.mjs` (reads `02-Listings/Gelato`) |
| Re-download polo previews | `node scripts-fetch-products.mjs` |
| Re-download try-on previews | `node scripts-fetch-tryon.mjs`, then `node scripts-logo-tryon.cjs` |
| Payment hook | `placeOrder()` in `src/pages/Checkout.jsx` |
