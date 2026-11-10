# Agency CMS Home text adapter

This branch maps two Home page strings from `src/data/site.js`: `tryon.eyebrow` and `tryon.sub`. The matching CMS map is `agency-cms/examples/emblara-home/source-manifest.json`. Product names, prices, stock, checkout, quotes, customer data and staff routes stay outside the map.

The React component renders source defaults immediately. With `VITE_AGENCY_CMS_FEED=true`, it then reads the public, versioned text feed from `https://agency-cms-ashen.vercel.app/api/site-content/emblara-store`. A missing, invalid or unavailable feed leaves the defaults in place. This request sends no cookies. It does not delay the product catalogue request or checkout.

Set `VITE_AGENCY_CMS_ORIGIN` to the exact HTTPS CMS origin when it differs from the default. `VITE_AGENCY_CMS_PREVIEW=true` enables the owner draft message bridge only for an isolated test build. The bridge accepts messages only from the exact CMS parent origin and only for the two mapped Home fields. It never accepts HTML or product data. The host must separately allow the CMS origin in its frame policy for that isolated build. Do not loosen the live store's frame policy for this test.

Before connecting the existing tracked Emblara record in CMS, test an isolated deployment with a disposable site record. Check Home on desktop and phone, Shop navigation, product loading, motion and consent. Test a sandbox checkout path, a draft edit and feed publish. Reload the page, restore the prior version and check the fallback when the feed fails. Then decide whether the production store should read the CMS feed. The Emblara store repository and Vercel project remain the authority for code and rollback; the CMS must not deploy a captured HTML bundle over them.
