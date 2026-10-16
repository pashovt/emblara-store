// Small helpers over Node's req/res, so the same handler runs under the Vite
// dev server and as a Vercel function.

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.statusCode = status;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (isBuf) return res.end(body);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

// Raw body (the Stripe webhook is verified against the exact bytes).
export async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit) {
  const raw = await readBody(req, limit);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

export const clientIp = (req) => (req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').toString().split(',')[0].trim();

export function origin(req, cfg) {
  if (cfg.siteUrl) return cfg.siteUrl;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const proto = req.headers['x-forwarded-proto'] ?? (cfg.onVercel ? 'https' : 'http');
  return `${proto}://${host}`;
}

// State-changing browser requests must come from this site.
export function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    return new URL(o).host === (req.headers['x-forwarded-host'] ?? req.headers.host);
  } catch {
    return false;
  }
}
