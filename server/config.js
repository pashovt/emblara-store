// Runtime configuration, read from the environment on every call so the dev
// server picks up changes. See .env.example.
//
// Two modes, chosen by which variables exist:
//   data:     Neon Postgres + Neon Object Storage when EMBLARA_APP_DATABASE_URL and
//             EMBLARA_PUBLIC_DATABASE_URL are set, otherwise a local JSON file
//             (.data/store.json) for the offline demo.
//   payments: Stripe when STRIPE_SECRET_KEY is set, otherwise a built-in demo
//             payment page that sends the SAME signed webhook event Stripe would.

const env = (k) => (process.env[k] ?? '').trim();

export function config() {
  const stripeKey = env('STRIPE_SECRET_KEY');
  const appUrl = env('EMBLARA_APP_DATABASE_URL');
  const publicUrl = env('EMBLARA_PUBLIC_DATABASE_URL');
  return {
    onVercel: !!env('VERCEL'),
    // The runtime roles, not the owner: emblara_app (the store server) and emblara_public
    // (read-only, published AND available products). Product photos live in a public-read
    // Neon Object Storage bucket; AWS_* are the standard variables `neon env pull` writes.
    neon: appUrl && publicUrl
      ? { appUrl, publicUrl, bucket: env('NEON_BUCKET') || 'emblara-products', endpoint: env('AWS_ENDPOINT_URL_S3').replace(/\/$/, ''), region: env('AWS_REGION') || 'eu-central-1' }
      : null,
    stripeKey,
    // Real Stripe signing secret, or the demo secret used by the demo payment page.
    webhookSecret: env('STRIPE_WEBHOOK_SECRET') || env('DEMO_WEBHOOK_SECRET'),
    demoPayments: !stripeKey,
    siteUrl: env('SITE_URL').replace(/\/$/, ''),
    sessionSecret: env('ADMIN_SESSION_SECRET'),
    demoStaff: { email: env('DEMO_STAFF_EMAIL').toLowerCase(), password: env('DEMO_STAFF_PASSWORD') },
  };
}

// A public deployment must never run on the local file store or fake payments.
export function assertSafe(cfg, { needPayments = false } = {}) {
  if (cfg.onVercel && !cfg.neon) return 'The store database is not configured.';
  if (needPayments && cfg.onVercel && cfg.demoPayments) return 'Payments are not configured.';
  return null;
}
