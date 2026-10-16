// One entry point for every /api/* request (Vite dev middleware and the Vercel
// function both call handle()).

import { config, assertSafe } from './config.js';
import { db } from './db.js';
import { HttpError, clientIp, origin, readBody, readJson, sameOrigin, send } from './http.js';
import { clearCookie, login, requireStaff, sessionCookie } from './auth.js';
import { demoPay, demoSession, orderStatus, processWebhook, startCheckout } from './payments.js';
import * as admin from './admin.js';

const PUBLIC_FIELDS = ({ id, slug, name, category, kind, blurb, material, fabric, price, config: c, images, available, sort }) => ({ id, slug, name, category, kind, blurb, material, fabric, price, config: c, images, available, sort });

let seeded = false;

export async function handle(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const route = `${req.method} ${url.pathname.replace(/^\/api/, '').replace(/\/$/, '')}`;
    const cfg = config();
    const secure = origin(req, cfg).startsWith('https');

    // The Stripe webhook is the only unauthenticated write and the only route that needs the raw body.
    if (route === 'POST /stripe-webhook') {
      const out = await processWebhook(await readBody(req), req.headers['stripe-signature']);
      return send(res, 200, out);
    }

    const unsafe = assertSafe(cfg, { needPayments: route === 'POST /checkout' });
    if (unsafe) throw new HttpError(503, unsafe);
    if (req.method !== 'GET' && !sameOrigin(req)) throw new HttpError(403, 'Cross-site request refused.');

    // ------------------------------------------------------------ public
    if (route === 'GET /products') {
      if (!seeded) {
        await db().seedIfEmpty();
        seeded = true;
      }
      const rows = await db().listProducts({ publicOnly: true });
      return send(res, 200, { products: rows.map(PUBLIC_FIELDS) }, { 'Cache-Control': 'public, max-age=0, s-maxage=15' });
    }
    if (route === 'POST /checkout') {
      const out = await startCheckout(await readJson(req, 100_000), origin(req, cfg));
      return send(res, 200, out);
    }
    if (route === 'GET /order-status') return send(res, 200, await orderStatus(url.searchParams.get('session')));
    if (req.method === 'GET' && url.pathname.startsWith('/api/uploads/') && !cfg.supabase) {
      const { buf, type } = await admin.readUpload(url.pathname.slice('/api/uploads/'.length));
      return send(res, 200, buf, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' });
    }

    // ------------------------------------------------------- demo payment
    if (route.startsWith('GET /demo/') || route.startsWith('POST /demo/')) {
      if (!cfg.demoPayments || cfg.onVercel) throw new HttpError(404, 'Not found.');
      if (route === 'GET /demo/session') return send(res, 200, await demoSession(url.searchParams.get('id')));
      if (route === 'POST /demo/pay') {
        const body = await readJson(req, 20_000);
        return send(res, 200, await demoPay(String(body.session ?? ''), body, origin(req, cfg)));
      }
    }

    // ---------------------------------------------------------- dashboard
    if (route === 'POST /admin/login') {
      const body = await readJson(req, 5_000);
      const who = await login(body.email, body.password, clientIp(req));
      return send(res, 200, { email: who.email }, { 'Set-Cookie': sessionCookie(who, secure) });
    }
    if (route === 'POST /admin/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(secure) });

    if (url.pathname.startsWith('/api/admin/')) {
      const { email } = await requireStaff(req);
      const id = url.searchParams.get('id');
      switch (route) {
        case 'GET /admin/me': return send(res, 200, { email });
        case 'GET /admin/products': return send(res, 200, await admin.listProducts());
        case 'POST /admin/products': return send(res, 201, await admin.saveProduct(await readJson(req, 100_000)));
        case 'PUT /admin/products': return send(res, 200, await admin.saveProduct(await readJson(req, 100_000), id));
        case 'POST /admin/upload': return send(res, 201, await admin.uploadImage(await readBody(req, 4_000_000)));
        case 'GET /admin/orders': return send(res, 200, id ? await admin.getOrder(id) : await admin.listOrders(url.searchParams.get('status')));
        case 'POST /admin/orders/status': return send(res, 200, await admin.advanceOrder(id, (await readJson(req, 2_000)).status));
        default: break;
      }
    }

    throw new HttpError(404, 'Not found.');
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...err.extra });
    console.error('[api]', err);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}

export default handle;
