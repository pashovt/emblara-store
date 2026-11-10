import { tryon } from '../data/site.js';

export const CMS_SITE = 'emblara-store';
export const CMS_PAGE = 'home';
export const HOME_FIELDS = ['tryon-eyebrow', 'tryon-sub'];

export const homeFallback = Object.freeze({ eyebrow: tryon.eyebrow, sub: tryon.sub });

function exactHttpsOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) throw new Error('CMS origin must be an HTTPS origin.');
  return url.origin;
}

function boundedText(value) {
  return typeof value === 'string' && value.length <= 5000;
}

export function parseHomeFeed(value) {
  if (!value || typeof value !== 'object' || value.format !== 'agency-cms-content' || value.formatVersion !== 1 || value.site !== CMS_SITE || !Number.isSafeInteger(value.version) || value.version < 0) return null;
  const fields = value.pages?.[CMS_PAGE]?.fields;
  if (!fields || !HOME_FIELDS.every((id) => boundedText(fields[id]?.value))) return null;
  return { eyebrow: fields['tryon-eyebrow'].value, sub: fields['tryon-sub'].value };
}

export async function loadHomeCopy(cmsOrigin, { fetcher = fetch, signal } = {}) {
  try {
    const origin = exactHttpsOrigin(cmsOrigin);
    const response = await fetcher(`${origin}/api/site-content/${CMS_SITE}`, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return homeFallback;
    const body = await response.text();
    if (body.length > 64_000) return homeFallback;
    return parseHomeFeed(JSON.parse(body)) ?? homeFallback;
  } catch {
    return homeFallback;
  }
}

export function connectHomePreview(cmsOrigin, onCopy, browser = window, documentRoot = document) {
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
    if (entries.length !== HOME_FIELDS.length || entries.some(([id, value]) => !HOME_FIELDS.includes(id) || !boundedText(value))) return;
    nonce = data.nonce;
    onCopy({ eyebrow: fields['tryon-eyebrow'], sub: fields['tryon-sub'] });
    browser.parent.postMessage({ kind: 'agency-cms-source-applied', site: CMS_SITE, page: CMS_PAGE, nonce }, origin);
  };
  const select = (event) => {
    if (!nonce || !event.target?.closest) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    const id = event.target.closest('[data-cms-field]')?.dataset.cmsField;
    if (!HOME_FIELDS.includes(id)) return;
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
