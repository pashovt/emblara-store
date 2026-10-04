# EMBLARA store demo — try-on hero version

Copy of `../emblara-store` with a new "virtual fitting room" hero, inspired by the Instagram screen recording (a Shopify "jacket collection" template). Everything below the hero is the same store.

## Try-on hero (`src/components/TryOnHero.jsx`)
- A model stands centre stage; flat garments ride a 3D ring around him.
- Scrolling (desktop, pinned) turns the ring. As the next garment reaches the centre, a copper scan line wipes the model into it.
- Within one garment type the photo is pixel-identical apart from the clothing, so the change reads as the garment sliding on. Between types (tee → hoodie → sweatshirt) the model changes, because Gelato uses a different model per garment.
- Arrows, colour dots, keyboard arrows and swipe also work. Phones: no pinning, auto-advances while visible. Reduced motion: instant switches, no scan line.
- Images: `public/tryon/` (Gelato "man2" previews with the EMBLARA logo added; originals and source URLs in `public/tryon/original/`). Regenerate with `node scripts-fetch-tryon.mjs` then `node scripts-logo-tryon.cjs`. Looks are listed in `tryon` in `src/data/site.js`.
- For the real thing: shoot one model in every garment from a fixed camera and pose, then drop the photos into `tryon.looks`.

---

# EMBLARA store demo (WeavesOfHeaven range)

Cinematic demo storefront for EMBLARA, built around the workwear range researched from the candidate production partner WeavesOfHeaven. Browse, configure, add to bag and check out. **The checkout is a demo: no payment is taken and nothing is sent.**

Design reference: landonorris.com (Awwwards Site of the Year), adapted rather than copied. See `design-brief.md`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
npm run preview
```

Deploy anywhere static (Vercel preset: Vite, output `dist`). Routing uses `#/` hashes, so no rewrites are needed.

## What's in it

- **Home:** pinned hero that swaps five garments under one logo as you scroll; a copper running stitch sews across a two-row marquee; a statement that lights up word by word; featured products; parallax gallery; how it works; mock-up call to action.
- **Shop** (`#/shop`, `#/shop/<category>`): 19 products across polos, tees & sweats, jackets & layers, sector uniforms, spa & hospitality, headwear.
- **Product pages** (`#/product/<slug>`): colour, size, style, logo position (with priced extras), quantity, logo file (stays on device), team-pricing table, specs, proof and returns info, related products.
- **Bag drawer:** quantities, team discounts across mixed sizes (10+ 10%, 25+ 15%, 50+ 20%), free delivery threshold. Persists in localStorage.
- **Checkout** (`#/checkout`): contact, UK address with validation, delivery options, logo handling, disabled payment block, order summary, demo confirmation.
- Smooth scroll (Lenis) + GSAP ScrollTrigger. Reduced motion: no smooth scroll, pinning or animation.

## Edit

| What | Where |
|---|---|
| Products, prices, options, descriptions | `src/data/products.js` |
| Copy, hero sequence, gallery, tiers, delivery, partner credit | `src/data/site.js` |
| Colours, fonts, spacing | top of `src/styles/global.css` |
| Images | `public/products/` |
| Payment hook | `placeOrder()` in `src/pages/Checkout.jsx` |

## Before anything goes live

- **Images** are Gelato catalogue previews with the EMBLARA logo added digitally (`04-Website-Demo/gelato-demo-images/`), marked "illustrative". Nine products show "Photo coming soon". Replace with WeavesOfHeaven photos **with written permission**, or real sample photos.
- **Partner name:** `site.partner.name` is empty on purpose. Add "WeavesOfHeaven" only once there is a written agreement; the footer then reads "Made in collaboration with …".
- **Prices** are demo prices. Set real ones after wholesale terms, then confirm tiers, delivery prices and VAT.
- No customer reviews are shown. Add your own once you have them (or partner reviews with permission and credit).
- Connect a real payment provider, order emails, logo upload storage, privacy policy and terms; add Clarity + UTM capture; remove `noindex`.
