# Agency CMS Home text

The Home page can show text edited in Agency CMS. Nothing else changes: the page keeps its own code, layout, fonts, images and animation, and the CMS only supplies strings. Products, prices, stock, delivery, checkout, quotes, privacy text and staff pages are not connected.

## What is editable (25 fields)

Try-on hero (label, three headline lines, introduction), the promise sentence, "The range" (label, heading, button), the logo quote and its line, "How it works" (label, heading, four steps with a title and text each) and the closing call to action (heading, text, button). The list lives in `src/lib/agencyCms/fields.js`. Each field's default is the text the store already shows, taken from `src/data/site.js` or the page, so with the CMS off the page is exactly what it was.

Words wrapped in `*stars*` are shown in the existing emphasis style (italic serif). That is the only markup. Everything else is plain text, rendered by React, so HTML cannot be injected.

## How it works

- **Switches (build time).** `VITE_AGENCY_CMS_FEED=true` reads published text from the CMS. `VITE_AGENCY_CMS_PREVIEW=true` turns on the owner's draft preview bridge for an isolated build. `VITE_AGENCY_CMS_ORIGIN` is the CMS address (default `https://app.ukaibuilds.com`). With all three unset, the page makes no CMS request.
- **Feed.** `GET <origin>/api/site-content/emblara-store`, no cookies, no redirects, plain JSON. Each field is checked on its own; a missing or invalid one keeps its default. If the feed is slow, down or malformed, the store's own text stays.
- **No flash for returning visitors.** The last published copy is kept in the browser (`agency-cms:emblara-store:home`) and used on the first paint.
- **Animation.** Only text strings change. The promise sentence is animated word by word, so that animation is rebuilt only when the number of words changes; the rest of the page's animation code is untouched. Click-to-edit markers and tab stops appear only while the CMS editor has framed the page and sent a valid draft, so a normal visitor never gets them, even in a build with the preview switch on (checked: 0 markers when not framed).
- **Content map.** `docs/agency-cms-home-manifest.json` is generated from the field list (`node scripts/agency-cms-manifest.mjs`) and a test keeps it in sync. Paste it into the CMS's Prepare editor, Prepare from source fields.

## Checks done on 25 November 2026

- With every switch off, a production build of this branch renders Home markup identical to production `main` (47,708 characters, same hash, 21 statement words, 10 reveal elements, no extra tab stops).
- With the feed on against a local CMS, the published edits appeared, the statement grew from 21 to 24 words, and all 24 animated (dimmed at the top, partway mid-scroll, lit at the end). No console errors.
- 40 unit tests cover field limits, the exact original statement and emphasis markup, feed parsing and fallback, the cache, and the draft preview's origin and field checks.

- The draft preview handshake was checked with a stand-in editor page: the store announced itself, accepted a draft with the one-time code, confirmed it, showed the draft text, and a real click on the intro reported `tryon-sub` with the same code.

Not yet checked: the draft preview inside the real CMS editor on HTTPS, and the production domain. A Preview deployment sits behind Vercel sign-in, so the editor cannot frame it; test the editor on the production domain once the code is merged with the switches off. Do these on a Preview deployment before switching the live store's feed on. Rolling back a text edit is a CMS restore; rolling back the code is the usual Vercel rollback.
