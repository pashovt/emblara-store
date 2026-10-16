// Merchant sign-in. Staff sign in with email + password (checked against emblara.staff in
// Postgres; DEMO_STAFF_* in the offline demo), must be an active staff row,
// and get a signed, HttpOnly, SameSite=Strict session cookie. Every dashboard
// route re-checks the cookie. There is no customer sign-in.

import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError } from './http.js';

const COOKIE = 'emblara_staff';
const TTL_S = 8 * 60 * 60;

const b64 = (b) => Buffer.from(b).toString('base64url');
const mac = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');
const same = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

function secret() {
  const s = config().sessionSecret;
  if (s.length < 32) throw new HttpError(503, 'Dashboard sign-in is not configured (ADMIN_SESSION_SECRET).');
  return s;
}

export function sessionCookie({ sub, email }, secure) {
  const body = b64(JSON.stringify({ sub, email, exp: Math.floor(Date.now() / 1000) + TTL_S }));
  const token = `${body}.${mac(body, secret())}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_S}${secure ? '; Secure' : ''}`;
}

export const clearCookie = (secure) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;

function readCookie(req) {
  const m = /(?:^|;\s*)emblara_staff=([^;]+)/.exec(req.headers.cookie ?? '');
  return m?.[1] ?? null;
}

// Throws 401 unless the request carries a valid staff session. Returns { sub, email }.
export async function requireStaff(req) {
  const token = readCookie(req);
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig || !same(sig, mac(body, secret()))) throw new HttpError(401, 'Sign in to continue.');
  let data;
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(401, 'Sign in to continue.');
  }
  if (!data.sub || !data.email || data.exp < Date.now() / 1000) throw new HttpError(401, 'Your session has expired. Sign in again.');
  // Authorisation is checked on every request, so removing someone from the
  // staff list takes effect immediately.
  if (!(await isAuthorised(data.sub))) throw new HttpError(403, 'This account is not authorised for the dashboard.');
  return { sub: data.sub, email: data.email };
}

// `sub` is the emblara.staff id (the offline demo uses the demo email).
async function isAuthorised(sub) {
  const cfg = config();
  if (!cfg.neon) return !!cfg.demoStaff.email && same(sub, cfg.demoStaff.email);
  return db().staffActive(sub);
}

// Throttle guessing: 6 failures per 10 minutes per address + IP (best effort,
// per server instance).
const fails = new Map();
function throttle(key) {
  const now = Date.now();
  const recent = (fails.get(key) ?? []).filter((t) => now - t < 600_000);
  fails.set(key, recent);
  if (recent.length >= 6) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  return () => fails.set(key, [...recent, now]);
}

// Returns { sub, email } for an authenticated AND authorised staff member, or throws.
export async function login(email, password, ip) {
  const e = String(email ?? '').trim().toLowerCase();
  const pw = String(password ?? '');
  if (!e || !pw || e.length > 254 || pw.length > 200) throw new HttpError(400, 'Enter your email and password.');
  const fail = throttle(`${ip}|${e}`);
  const deny = () => {
    fail();
    return new HttpError(401, 'Email or password not recognised.');
  };
  const cfg = config();

  if (!cfg.neon) {
    // Hash both sides first so the comparison is constant-time regardless of length.
    const h = (s) => scryptSync(s, 'emblara-demo', 32);
    const okPw = !!cfg.demoStaff.password && timingSafeEqual(h(pw), h(cfg.demoStaff.password));
    if (!cfg.demoStaff.email || e !== cfg.demoStaff.email || !okPw) throw deny();
    return { sub: e, email: e };
  }

  // The password is checked inside Postgres (emblara.staff_login); a signed-in person who is
  // not a row in emblara.staff gets nothing.
  const staffId = await db().staffLogin(e, pw);
  if (!staffId) throw deny();
  return { sub: staffId, email: e };
}
