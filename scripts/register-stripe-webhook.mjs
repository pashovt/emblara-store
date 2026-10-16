// Registers the store's Stripe webhook endpoint in TEST mode and stores its signing secret in
// .env.local and (with --vercel) in Vercel Production, without printing it. Stripe shows the
// secret only when the endpoint is created. If the endpoint already exists nothing is changed.
//   npm run stripe:webhook -- https://emblara-store.vercel.app --vercel
import { spawnSync } from 'node:child_process';
import Stripe from 'stripe';
import { upsertEnv } from './lib/db-owner.mjs';

const origin = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) throw new Error('Usage: npm run stripe:webhook -- https://your-domain [--vercel]');
const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must be a TEST key (sk_test_...). For live mode, register the endpoint yourself in the dashboard.');

const url = `${origin}/api/stripe-webhook`;
const events = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'];
const stripe = new Stripe(key);

const existing = (await stripe.webhookEndpoints.list({ limit: 50 })).data.find((e) => e.url === url);
if (existing) {
  console.log(`Endpoint already exists (${existing.id}). Its secret is only shown at creation; delete it in the dashboard to recreate.`);
  process.exit(0);
}
const ep = await stripe.webhookEndpoints.create({ url, enabled_events: events, description: 'Emblara store (test)', metadata: { app: 'emblara-store' } });
console.log(`Created ${ep.id} -> ${ep.url}\nEvents: ${ep.enabled_events.join(', ')}`);
upsertEnv('.env.local', { STRIPE_WEBHOOK_SECRET: ep.secret });
console.log('STRIPE_WEBHOOK_SECRET written to .env.local');
if (process.argv.includes('--vercel')) {
  const r = spawnSync('vercel', ['env', 'add', 'STRIPE_WEBHOOK_SECRET', 'production', '--yes', '--force', '--sensitive'], { input: ep.secret, encoding: 'utf8' });
  console.log(r.status === 0 ? 'STRIPE_WEBHOOK_SECRET set in Vercel Production' : `Vercel failed: ${(r.stderr || r.stdout).slice(-200)}`);
}
