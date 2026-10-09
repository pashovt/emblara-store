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

## Your logo on every garment (added 9 Oct 2026)

- Visitors click **Add your logo** (header, hero, or the product page) and pick a PNG, SVG, JPG or WebP. Every garment on the site, from the hero to the bag, is then drawn with their logo. **EMBLARA logo** and **Your logo** stay as two options in the panel, so they can switch back.
- In-browser clean-up (`src/lib/logo-clean.js`): removes a flat background from opaque files, trims empty space, and makes a light version for dark garments (and a dark one for light garments when the logo is very pale). Nothing is uploaded.
- The logo is remembered in the visitor's browser storage (`localStorage`, key `emblara-logo-v1`), so it is still there on the next visit. Cookies hold only about 4 KB, which is too small for an image, so browser storage does the same job here. Clearing site data removes it.
- Harder files point to the paid **Professional logo clean-up** item (`#/product/logo-clean-up`). **The £15 price is a placeholder: set the real one in `src/data/products.js`.**
- Bag lines carry the logo file name, so the order shows which logo the customer previewed.

## Photos and logo positions

- **Photos:** `public/garments/<product>/<colour>-<view>.webp`, clean Gelato catalogue previews with **no logo baked in**, padded to 1000 × 1000. Views: `model-front`, `model-back`, `flat-front`, `flat-back`. Sources in `public/garments/sources.csv`. Re-download with `node scripts/fetch-garments.mjs`.
- Gildan 2000 has no public Gelato preview; it reuses the Gildan 5000 photos, as the owner instructed for the shared front/back references.
- **Logo positions:** `src/data/placements.js`. Each photo has four anchors (centre line, collar, armpit line, chest width). Each placement (left chest, large back, front print, etc.) is a box placed relative to those anchors, using the proportions of the owner's Gelato placement screenshots in `02-Listings/Gelato/01-Products/*/02-Print-Locations`. The women's polo left chest now sits level with the bottom of the placket, as Gelato places it.
- Choosing a back position on a product page switches the gallery to the back view.
- The owner's own Gelato mockups (with the Emblara logo baked in) stay in `02-Listings/Gelato` as references. The site no longer uses them, because a baked-in logo can't be swapped.

## Theme

Light, Dark or System (default: follows the browser). Switch in the header (desktop) or the footer. The choice is remembered in the browser (`emblara-theme`). The page declares `color-scheme: light dark`, so Chrome's forced dark mode no longer darkens it. The fitting-room hero and the gallery stay a lit studio in both themes, because their photos are blended onto the background.

## AI model photos (updated 9 Oct 2026)

- All garment photos on model come from the owner's AI models (`06-AI-Models`): 41 **blank** shots (no logo) from `06-AI-Models/Product-Mockups/2026-10-09-Website-Expansion`. Every colour has a front shot, each product has a back shot in its main colour, and the unisex garments (tees, hoodie, sweatshirt) also have the second model.
- Import with `node scripts/import-ai-mockups.mjs`. It writes `public/garments/<product>/<colour>-ai-front.webp`, `-ai-front-alt.webp`, `-ai-back.webp` and `src/data/ai-shots.json` (do not edit by hand).
- The logo is always drawn on top: the EMBLARA lockup (copper mark + wordmark, navy on light garments, cream on dark) or the visitor's own logo. Logo positions per photo are `aiAnchors` in `src/data/placements.js`, read off a grid on each shot and checked on all 41.
- Product pages show: AI front, second model (if any), AI back (Gelato back for colours without an AI back), then the Gelato flats. Each product opens on the colour, finish and position of its original mockup.
- AI photos lead the shop cards, product pages, fitting-room hero and home gallery.
- **Backgrounds removed:** every photo (AI and Gelato) is cut out on this Mac with Apple Vision (`scripts/cutout.swift`, run automatically by both image scripts), so models and garments sit straight on the page in light and dark themes.

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
- **Photos** are Gelato catalogue previews, labelled illustrative. Replace them with sample photography when available (keep the four views and update the anchors in `placements.js`).
- WoH can return as website supply only after a written agreement. Do not add WoH products or a partner credit before then.
- Still to do for a real launch: payment provider, order emails, logo storage with the order (today it stays in the visitor's browser), privacy policy and terms, Clarity + UTM capture, and removing `noindex`.

## Try-on hero (`src/components/TryOnHero.jsx`)

- A model stands centre stage; flat garments ride a 3D ring around him.
- Scrolling (desktop, pinned) turns the ring. As the next garment reaches the centre, a copper scan line wipes the model into it.
- Within one garment type the photo is pixel-identical apart from the clothing, so the change reads as the garment sliding on. Between types (tee, hoodie, sweatshirt) the model changes, because Gelato uses a different model per garment.
- Arrows, colour dots, keyboard arrows and swipe also work. Phones: no pinning, auto-advances while visible. Reduced motion: instant switches, no scan line.
- Looks are listed in `tryon` in `src/data/site.js` (nine looks, logo at left chest). The logo is drawn live, so the hero shows the visitor's logo too.

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
- **Shop** (`#/shop`, `#/shop/<category>`): 8 garments in Polos, T-shirts, and Hoodies & sweatshirts, plus the logo clean-up service.
- **Product pages** (`#/product/<slug>`): four views in a gallery with a thumbnail strip inside the image box; finish (printed or embroidered), colour, size with surcharges, logo position (moves the logo on the photos), your-logo control, quantity, a price-by-quantity table, fabric by colour, proof and returns info.
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
| Garment photos | `public/garments/` (re-download: `node scripts/fetch-garments.mjs`) |
| Logo positions | `src/data/placements.js` |
| Logo upload, clean-up, storage | `src/store/logo.jsx`, `src/lib/logo-clean.js`, panel in `src/components/Chrome.jsx` |
| Theme colours | "Themes" block at the end of `src/styles/global.css` |
| Payment hook | `placeOrder()` in `src/pages/Checkout.jsx` |
