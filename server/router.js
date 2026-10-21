// One entry point for every /api/* request (Vite dev middleware and the Vercel
// function both call handle()).

import { config, assertSafe } from './config.js';
import { db } from './db.js';
import { HttpError, clientIp, origin, readBody, readJson, sameOrigin, send } from './http.js';
import { clearCookie, login, requireStaff, sessionCookie } from './auth.js';
import { demoPay, demoSession, orderStatus, processWebhook, startCheckout } from './payments.js';
import * as admin from './admin.js';
import * as sales from './sales.js';
import * as portal from './portal.js';
import * as artwork from './artwork.js';
import { withContext } from './context.js';
import * as etsy from './etsy-oauth.js';

// price_pence is the column name; the shop page reads it (services have a fixed price, garments are null).
const PUBLIC_FIELDS = ({ id, slug, name, category, kind, blurb, material, fabric, price_pence, config: c, images, available, sort }) => ({ id, slug, name, category, kind, blurb, material, fabric, price_pence, config: c, images, available, sort });

let seeded = false;

export async function handle(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const route = `${req.method} ${url.pathname.replace(/^\/api/, '').replace(/\/$/, '')}`;
    const cfg = config();
    const secure = origin(req, cfg).startsWith('https');

    // The Stripe webhook is the only unauthenticated write and the only route that needs the raw body.
    if (route === 'POST /stripe-webhook') {
      const raw = await readBody(req);
      const out = await withContext({ flow: 'webhook' }, () => processWebhook(raw, req.headers['stripe-signature']));
      return send(res, 200, out);
    }

    // Cross-site redirect from Etsy: it validates a signed, short-lived PKCE cookie.
    if (route === 'GET /etsy/oauth/callback') return await withContext({ flow: 'etsy_oauth' }, () => etsy.callback(req, res, url, secure));

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
      const body = await readJson(req, 100_000);
      const out = await withContext({ flow: 'checkout' }, () => startCheckout(body, origin(req, cfg)));
      return send(res, 200, out);
    }
    if (route === 'POST /artwork/presign') return send(res, 201, await withContext({ flow: 'checkout' }, async () => artwork.prepareUpload(await readJson(req, 2_000))));
    if (url.pathname.startsWith('/api/portal/')) {
      const token = req.headers['x-token']?.toString() ?? '';
      return await withContext({ flow: 'portal' }, async () => {
        if (route === 'POST /portal/requests') return send(res, 201, { request: await portal.submitRequest(await readJson(req, 20_000)) }, { 'Referrer-Policy': 'no-referrer' });
        if (route === 'POST /portal/quote') return send(res, 200, { quote: await portal.quote(token) }, { 'Referrer-Policy': 'no-referrer' });
        if (route === 'POST /portal/quote/respond') return send(res, 200, { quote: await portal.respond(token, await readJson(req, 5_000)) }, { 'Referrer-Policy': 'no-referrer' });
        throw new HttpError(404, 'Not found.');
      });
    }
    if (route === 'GET /order-status') return send(res, 200, await withContext({ flow: 'status' }, () => orderStatus(url.searchParams.get('session'))));
    if (req.method === 'GET' && url.pathname.startsWith('/api/uploads/') && !cfg.neon) {
      const { buf, type } = await admin.readUpload(url.pathname.slice('/api/uploads/'.length));
      return send(res, 200, buf, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' });
    }

    // ------------------------------------------------------- demo payment
    if (route.startsWith('GET /demo/') || route.startsWith('POST /demo/')) {
      if (!cfg.demoPayments || cfg.onVercel) throw new HttpError(404, 'Not found.');
      if (route === 'GET /demo/session') return send(res, 200, await withContext({ flow: 'status' }, () => demoSession(url.searchParams.get('id'))));
      if (route === 'POST /demo/pay') {
        const body = await readJson(req, 20_000);
        return send(res, 200, await withContext({ flow: 'webhook' }, () => demoPay(String(body.session ?? ''), body, origin(req, cfg))));
      }
    }

    // ---------------------------------------------------------- dashboard
    if (route === 'POST /admin/login') {
      const body = await readJson(req, 5_000);
      const who = await login(body.email, body.password, clientIp(req));
      return send(res, 200, { email: who.email }, { 'Set-Cookie': sessionCookie(who, secure) });
    }
    if (route === 'POST /admin/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(secure) });
    if (route === 'GET /admin/etsy/oauth/start') {
      await requireStaff(req);
      return etsy.start(req, res, secure);
    }

    if (url.pathname.startsWith('/api/admin/')) {
      const staff = await requireStaff(req);
      const id = url.searchParams.get('id');
      return await withContext({ staffId: staff.sub }, async () => {
        switch (route) {
          case 'GET /admin/me': return send(res, 200, { email: staff.email });
          case 'GET /admin/products': return send(res, 200, await admin.listProducts());
          case 'GET /admin/catalogue': return send(res, 200, await admin.listCatalogue());
          case 'GET /admin/sales': return send(res, 200, await sales.overview());
          case 'POST /admin/sales/clients': return send(res, 201, await sales.createClient(await readJson(req, 10_000)));
          case 'POST /admin/sales/invoices': return send(res, 201, await sales.createInvoice(await readJson(req, 2_000)));
          case 'POST /admin/sales/invoices/lines': return send(res, 200, await sales.addInvoiceLine(id, await readJson(req, 5_000)));
          case 'POST /admin/sales/invoices/status': return send(res, 200, await sales.transitionInvoice(id, await readJson(req, 2_000)));
          case 'POST /admin/sales/quotes': return send(res, 201, await sales.createQuote((await readJson(req, 2_000)).request_id));
          case 'POST /admin/sales/quotes/lines': return send(res, 200, await sales.addQuoteLine(id, await readJson(req, 5_000)));
          case 'POST /admin/sales/quotes/issue': return send(res, 200, await sales.issueQuote(id, origin(req, cfg)));
          case 'GET /admin/sales/invoice-pdf': { const document = await sales.invoicePdf(id); return send(res, 200, document.pdf, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${document.filename}"` }); }
          case 'GET /admin/artwork': { const file = await artwork.download(id); return send(res, 200, file.bytes, { 'Content-Type': file.content_type, 'Content-Disposition': `attachment; filename="${file.file_name.replaceAll('"', '')}"`, 'Content-Security-Policy': 'sandbox' }); }
          case 'POST /admin/catalogue/link': return send(res, 200, await admin.linkCatalogueProduct(await readJson(req, 5_000)));
          case 'POST /admin/catalogue/stock': return send(res, 200, await admin.recordStockMovement(await readJson(req, 5_000)));
          case 'GET /admin/settings': return send(res, 200, await admin.getBusinessProfile());
          case 'POST /admin/settings': return send(res, 200, await admin.saveBusinessProfile(await readJson(req, 20_000)));
          case 'POST /admin/products': return send(res, 201, await admin.saveProduct(await readJson(req, 100_000)));
          case 'PUT /admin/products': return send(res, 200, await admin.saveProduct(await readJson(req, 100_000), id));
          case 'POST /admin/upload': return send(res, 201, await admin.uploadImage(await readBody(req, 4_000_000)));
          case 'GET /admin/orders': return send(res, 200, id ? await admin.getOrder(id) : await admin.listOrders(url.searchParams.get('status')));
          case 'POST /admin/orders/status': return send(res, 200, await admin.advanceOrder(id, (await readJson(req, 2_000)).status));
          case 'POST /admin/orders/artwork-status': return send(res, 200, await admin.setArtworkStatus(id, await readJson(req, 2_000)));
          default: throw new HttpError(404, 'Not found.');
        }
      });
    }

    throw new HttpError(404, 'Not found.');
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...err.extra });
    console.error('[api]', err);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}

export default handle;
