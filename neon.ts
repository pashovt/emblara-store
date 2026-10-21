import { defineConfig } from "@neon/config/v1";

// Emblara store: one dedicated Neon project (aws-eu-central-1, the closest region
// with Object Storage). Product photos live in a public-read bucket; only the
// server writes to it. Provision with `neon deploy`.
export default defineConfig({
  auth: false, // staff sign-in is the emblara.staff table (see docs/neon-database.md)
  buckets: {
    "emblara-products": { access: "public_read" },
    // Customer originals are never available by object URL. The server gives a
    // browser a short-lived PUT capability for one new key, then staff download
    // it through the authenticated application route.
    "emblara-artwork": { access: "private" },
  },
  branch: (branch) => {
    if (branch.isDefault) return {};
    // Dev/preview branches auto-expire.
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});
