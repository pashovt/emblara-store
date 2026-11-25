// Reads published Home text from Agency CMS, remembers the last good copy, and talks to the CMS editor's draft preview.
// Every path fails safe: a missing, slow, malformed or unreachable feed leaves the store's own text in place.
import { CMS_PAGE, CMS_SITE, HOME_FIELD_IDS, cleanText } from './fields.js';

export const CACHE_KEY = `agency-cms:${CMS_SITE}:${CMS_PAGE}`;
const FIELD_SET = new Set(HOME_FIELD_IDS);

// HTTPS only. The one exception is the visitor's own machine (localhost), which lets the CMS be tested locally; no real
// visitor can be pointed at a CMS that way, because "localhost" is always their own computer.
export function exactHttpsOrigin(value) {
  const url = new URL(value);
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if ((url.protocol !== 'https:' && !local) || url.origin !== value || url.username || url.password) throw new Error('CMS origin must be an HTTPS origin.');
  return url.origin;
}

/** Keeps only known fields with valid plain text. A bad or missing field falls back to its default on its own. */
export function pickKnownFields(source) {
  const out = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return out;
  for (const id of HOME_FIELD_IDS) {
    const text = cleanText(source[id]);
    if (text !== null) out[id] = text;
  }
  return out;
}

export function parseHomeFeed(value) {
  if (!value || typeof value !== 'object' || value.format !== 'agency-cms-content' || value.formatVersion !== 1 || value.site !== CMS_SITE || !Number.isSafeInteger(value.version) || value.version < 0) return null;
  const fields = value.pages?.[CMS_PAGE]?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  const raw = {};
  for (const id of HOME_FIELD_IDS) raw[id] = fields[id]?.value;
  return { version: value.version, copy: pickKnownFields(raw) };
}

/** Returns { version, copy } or null when the feed is unavailable. The caller keeps whatever it already shows on null. */
export async function loadHomeCopy(cmsOrigin, { fetcher = fetch, signal } = {}) {
  try {
    const origin = exactHttpsOrigin(cmsOrigin);
    const response = await fetcher(`${origin}/api/site-content/${CMS_SITE}`, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
    const body = await response.text();
    if (body.length > 200_000) return null;
    return parseHomeFeed(JSON.parse(body));
  } catch {
    return null;
  }
}

/** The last published copy this browser saw, so a returning visitor sees the published text on the very first paint. */
export function readCachedCopy(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(CACHE_KEY));
    if (!saved || !Number.isSafeInteger(saved.version)) return null;
    return pickKnownFields(saved.copy);
  } catch {
    return null;
  }
}

export function writeCachedCopy(feed, storage = globalThis.localStorage) {
  try { storage.setItem(CACHE_KEY, JSON.stringify({ version: feed.version, copy: feed.copy })); } catch { /* private mode or full storage */ }
}

/**
 * Owner draft preview. Text is accepted only from the exact CMS page that framed this one, only for known fields, and only after
 * the CMS sends its one-time nonce. Nothing but plain text for the Home fields is ever applied.
 */
export function connectHomePreview(cmsOrigin, onDraft, browser = window, documentRoot = document) {
  let origin;
  try { origin = exactHttpsOrigin(cmsOrigin); } catch { return () => {}; }
  if (browser.parent === browser) return () => {};
  let nonce = '';
  const receive = (event) => {
    const data = event.data;
    if (event.source !== browser.parent || event.origin !== origin || !data || typeof data !== 'object') return;
    if (data.kind !== 'agency-cms-source-preview' || data.site !== CMS_SITE || data.page !== CMS_PAGE || typeof data.nonce !== 'string' || !data.nonce || data.nonce.length > 100) return;
    const fields = data.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return;
    const entries = Object.entries(fields);
    if (!entries.length || entries.length > 100 || entries.some(([id]) => !FIELD_SET.has(id))) return;
    const clean = pickKnownFields(fields);
    nonce = data.nonce;
    onDraft(clean);
    browser.parent.postMessage({ kind: 'agency-cms-source-applied', site: CMS_SITE, page: CMS_PAGE, nonce }, origin);
  };
  const select = (event) => {
    if (!nonce || !event.target?.closest) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    const id = event.target.closest('[data-cms-field]')?.dataset.cmsField;
    if (!FIELD_SET.has(id)) return;
    event.preventDefault();
    browser.parent.postMessage({ kind: 'agency-cms-source-select', site: CMS_SITE, page: CMS_PAGE, id, nonce }, origin);
  };
  browser.addEventListener('message', receive);
  documentRoot.addEventListener('click', select);
  documentRoot.addEventListener('keydown', select);
  browser.parent.postMessage({ kind: 'agency-cms-source-ready', site: CMS_SITE, page: CMS_PAGE }, origin);
  return () => {
    browser.removeEventListener('message', receive);
    documentRoot.removeEventListener('click', select);
    documentRoot.removeEventListener('keydown', select);
  };
}
