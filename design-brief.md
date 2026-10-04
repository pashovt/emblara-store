# Design brief — EMBLARA store demo (WeavesOfHeaven range)

## Job of the site
A demo storefront for EMBLARA selling the branded-workwear range sourced from the candidate production partner (WeavesOfHeaven catalogue, see `01-Market-Research/Supplier-WeavesOfHeaven/`). Visitors browse the range, configure a product (colour, size, logo position, quantity), add to bag and reach a checkout. Checkout is present but does not take payment.

## Reference (Level 2 / 7)
**landonorris.com** (Awwwards SOTY). What we take, not clone:
- Mixed typography: heavy uppercase grotesk + an elegant serif for single accent words in the accent colour.
- A light hero that hands over to deep dark sections, then a mid-tone section — the background colour changes as you scroll.
- A faint line-drawing texture across the background (their track contours). Ours: **stitched thread lines** — the material of the product.
- An animated hand-drawn stroke over large type (their signature). Ours: a **running stitch that sews across the marquee** as you scroll.
- Two big marquee rows moving in opposite directions.
- A long statement paragraph that lights up word by word on scroll.
- A scattered editorial gallery with small mono captions and parallax.
- Pill-shaped accent CTAs, a "Bag" pill pinned top right.

Avoid: their lime, their fonts (Brier), the helmet/3D portrait, any of their copy.

## Tokens (Level 3)
- Colour: ink `#0d1526` (dark sections), navy `#16233d`, bone `#eeece6` (light sections), stone `#a9a69d` (gallery), copper `#c8743a` (brand), copper-lit `#e8945a` (pills, accents on dark).
- Type: Mona Sans Variable (display uppercase 800, body 400–500, width axis for condensed caps), Instrument Serif (accent words, italic), JetBrains Mono (captions, specs, prices).
- Scale: display clamp(3rem, 9vw, 9.5rem); h2 clamp(2.2rem, 5vw, 5rem); body 1rem–1.125rem.
- Radius: pills 999px; cards 18px; small 8px.
- Motion: ease `cubic-bezier(0.65, 0.05, 0, 1)`, 0.75s default. Lenis smooth scroll, GSAP ScrollTrigger scrub for the hero garment sequence, stitch draw, statement reveal and gallery parallax. All disabled for reduced motion.

## Conversion structure (Level 6, from the Stage 4 teardown)
Hero (one logo, whole team kit) → marquee (what we do) → statement (promise) → shop grid with filters → editorial gallery → how ordering works (proof before production) → mock-up CTA → footer.
Every product page: all-in price, quantity tiers, colour/size/position options, logo upload, specs, proof promise.

## Media (Level 4)
Temporary: Gelato catalogue previews with the EMBLARA mark (`04-Website-Demo/gelato-demo-images/`). 9 products have no image (long-sleeve polo, rugby, tunics, towels, robes) and show a labelled placeholder. Replace with partner photos (with permission) or sample photography.

## Open points
- Prices are demo prices. Confirm after wholesale terms.
- Partner name is not shown on the site until a written agreement exists (`site.partner.name` in `src/data/site.js`).
