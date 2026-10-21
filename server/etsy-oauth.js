// Etsy OAuth is deliberately server-only. PKCE verifier/state live in a short-lived,
// signed HttpOnly cookie; tokens are AES-GCM encrypted before reaching Neon.

import { createCipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError, origin, redirect, send } from './http.js';

const COOKIE = 'emblara_etsy_oauth';
// The cookie is issued from /api/admin/... and consumed at /api/etsy/... .
// Cookie paths must match the issuing response URL, so /api is the narrowest
// valid shared scope for the short-lived OAuth hand-off.
const COOKIE_PATH = '/api';
const TTL = 10 * 60;
const SCOPES = ['shops_r', 'listings_r', 'listings_w'];
const b64 = (v) => Buffer.from(v).toString('base64url');
const hmac = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

function settings() {
  const cfg = config();
  if (!cfg.neon) throw new HttpError(503, 'Etsy OAuth needs the production database.');
  if (!cfg.etsy.keystring || !cfg.etsy.sharedSecret) throw new HttpError(503, 'Etsy OAuth is not configured.');
  if (cfg.sessionSecret.length < 32) throw new HttpError(503, 'Etsy OAuth is not configured.');
  const key = Buffer.from(cfg.etsy.tokenEncryptionKey, 'base64');
  if (key.length !== 32) throw new HttpError(503, 'Etsy token encryption is not configured.');
  return { cfg, key };
}

function cookie(req) {
  return /(?:^|;\s*)emblara_etsy_oauth=([^;]+)/.exec(req.headers.cookie ?? '')?.[1] ?? null;
}

function same(a, b) {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function decode(value, secret) {
  const [body, signature] = String(value ?? '').split('.');
  if (!body || !signature || !same(signature, hmac(body, secret))) throw new HttpError(400, 'Invalid or expired Etsy authorisation. Start again.');
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed.state || !parsed.verifier || parsed.exp < Date.now() / 1000) throw new Error('expired');
    return parsed;
  } catch {
    throw new HttpError(400, 'Invalid or expired Etsy authorisation. Start again.');
  }
}

const clear = (secure) => `${COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
const encrypt = (value, key) => {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
};

export function start(req, res, secure) {
  const { cfg } = settings();
  const verifier = randomBytes(48).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const body = b64(JSON.stringify({ verifier, state, exp: Math.floor(Date.now() / 1000) + TTL }));
  const cookieValue = `${body}.${hmac(body, cfg.sessionSecret)}`;
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const callback = `${origin(req, cfg)}/api/etsy/oauth/callback`;
  const params = new URLSearchParams({ response_type: 'code', client_id: cfg.etsy.keystring, redirect_uri: callback, scope: SCOPES.join(' '), state, code_challenge: challenge, code_challenge_method: 'S256' });
  return redirect(res, `https://www.etsy.com/oauth/connect?${params}`, { 'Set-Cookie': `${COOKIE}=${cookieValue}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${TTL}${secure ? '; Secure' : ''}` });
}

export async function callback(req, res, url, secure) {
  const { cfg, key } = settings();
  const pending = decode(cookie(req), cfg.sessionSecret);
  const code = url.searchParams.get('code');
  if (!code || !same(url.searchParams.get('state'), pending.state)) throw new HttpError(400, 'Invalid or expired Etsy authorisation. Start again.');
  const callbackUrl = `${origin(req, cfg)}/api/etsy/oauth/callback`;
  const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: cfg.etsy.keystring, redirect_uri: callbackUrl, code, code_verifier: pending.verifier }),
  });
  if (!response.ok) throw new HttpError(502, 'Etsy did not accept the authorisation. Start again.');
  const token = await response.json();
  if (!token.access_token || !token.refresh_token) throw new HttpError(502, 'Etsy returned an incomplete authorisation. Start again.');
  await db().saveEtsyOAuthCredential(encrypt(JSON.stringify({ access_token: token.access_token, refresh_token: token.refresh_token, expires_in: token.expires_in, connected_at: new Date().toISOString() }), key), String(token.scope ?? SCOPES.join(' ')));
  return send(res, 200, { connected: true, scopes: String(token.scope ?? SCOPES.join(' ')) }, { 'Set-Cookie': clear(secure) });
}
