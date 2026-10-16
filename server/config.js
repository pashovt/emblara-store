// Runtime configuration, read from the environment on every call so the dev
// server picks up changes. See .env.example.
//
// Two modes, chosen by which variables exist:
//   data:     Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
//             otherwise a local JSON file (.data/store.json) for the demo.
//   payments: Stripe when STRIPE_SECRET_KEY is set, otherwise a built-in demo
//             payment page that sends the SAME signed webhook event Stripe would.

const env = (k) => (process.env[k] ?? '').trim();

export function config() {
  const stripeKey = env('STRIPE_SECRET_KEY');
  const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
  const supabaseKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return {
    onVercel: !!env('VERCEL'),
    // Shared project: this store's tables live in its own schema and its photos in its own bucket.
    supabase: supabaseUrl && supabaseKey ? { url: supabaseUrl, key: supabaseKey, anon: env('SUPABASE_ANON_KEY'), schema: env('SUPABASE_SCHEMA') || 'emblara', bucket: env('SUPABASE_BUCKET') || 'emblara-products' } : null,
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
  if (cfg.onVercel && !cfg.supabase) return 'The store database is not configured.';
  if (needPayments && cfg.onVercel && cfg.demoPayments) return 'Payments are not configured.';
  return null;
}
