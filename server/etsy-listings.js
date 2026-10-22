// Staff-only Etsy draft synchronisation. OAuth tokens are decrypted only in this
// module and never cross the API boundary; Etsy receives them in request headers.

import { createDecipheriv } from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError } from './http.js';
import { singleQuote } from '../src/lib/pricing.js';

const API = 'https://api.etsy.com/v3/application';
const REFERENCE_LISTING_ID = 4570158763;
const VARIATIONS = [[513, 'Colour'], [514, 'Size'], [516, 'Print location']];
const FINISH_LABELS = { print: 'Printed', embroidery: 'Embroidered' };

const cleanMaterial = (value) => String(value ?? '').replace(/[^\p{L}\p{Nd}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const tagsFor = ({ product, method }) => ['emblara', product.slug, method.id];
const titleFor = ({ product, method }) => `EMBLARA ${product.name} — ${method.label}`;

// Etsy OAuth access tokens are formatted as "numeric-user-id.token". Etsy's
// shop endpoint requires that numeric ID rather than a __SELF__ placeholder.
export function etsyUserId(accessToken) {
  const value = String(accessToken ?? '').split('.', 1)[0];
  if (!/^\d+$/.test(value)) return null;
  return etsyNumericId(value);
}

function etsyNumericId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function buildDraftPlan(products) {
  return products.filter((product) => !product.service).flatMap((product) => product.methods.map((storedMethod) => {
    const method = { ...storedMethod, label: storedMethod.label ?? FINISH_LABELS[storedMethod.id] };
    return {
    key: `${product.slug}-${method.id}`, product, method, title: titleFor({ product, method }), tags: tagsFor({ product, method }),
    };
  }));
}

export function missingDrafts(plan, listings) {
  return plan.filter((entry) => !listings.some((listing) => {
    const tags = new Set(listing.tags ?? []);
    return entry.tags.every((value) => tags.has(value));
  }));
}

export function listingInventory(product, method, readinessStateId = null) {
  const products = product.colours.flatMap((colour) => method.sizes.flatMap((size) => method.positions.map((position) => {
    const price = singleQuote(product, { method: method.id, size: size.label, position: position.label, qty: 1 }).total;
    const offering = { price, quantity: 999, is_enabled: true };
    if (Number.isSafeInteger(readinessStateId) && readinessStateId > 0) offering.readiness_state_id = readinessStateId;
    return {
      sku: '',
      property_values: VARIATIONS.map(([property_id, property_name], index) => ({
        property_id, property_name, value_ids: [], scale_id: null,
        values: [index === 0 ? colour.name : index === 1 ? size.label : position.label],
      })),
      offerings: [offering],
    };
  })));
  return { products, price_on_property: [514, 516], quantity_on_property: [], sku_on_property: [], readiness_state_on_property: [] };
}

function settings() {
  const cfg = config();
  if (!cfg.neon || !cfg.etsy.keystring || !cfg.etsy.sharedSecret) throw new HttpError(503, 'Etsy listing sync is not configured.');
  const key = Buffer.from(cfg.etsy.tokenEncryptionKey, 'base64');
  if (key.length !== 32) throw new HttpError(503, 'Etsy listing sync is not configured.');
  return { cfg, key };
}

function decrypt(ciphertext, key) {
  const parts = String(ciphertext ?? '').split('.').map((part) => Buffer.from(part, 'base64url'));
  if (parts.length !== 3 || parts.some((part) => !part.length)) throw new HttpError(503, 'Etsy authorisation needs reconnecting.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, parts[0]);
    decipher.setAuthTag(parts[1]);
    return JSON.parse(Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8'));
  } catch {
    throw new HttpError(503, 'Etsy authorisation needs reconnecting.');
  }
}

async function api(path, { token, cfg, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'x-api-key': `${cfg.etsy.keystring}:${cfg.etsy.sharedSecret}`,
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' } : {}),
    },
    body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401) throw new HttpError(503, 'Etsy authorisation needs reconnecting.');
    const detail = await response.text().catch(() => '');
    // Etsy's validation response is useful to the authenticated staff member,
    // but never include arbitrary upstream markup or credentials in our API.
    const safeDetail = detail
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, '')
      .slice(0, 300)
      .trim();
    throw new HttpError(502, safeDetail
      ? `Etsy rejected ${method} ${path}: ${safeDetail}`
      : `Etsy rejected ${method} ${path}.`);
  }
  return response.json();
}

const results = (response) => response.results ?? [];

async function setup() {
  const { cfg, key } = settings();
  const credential = await db().getEtsyOAuthCredential();
  const token = decrypt(credential?.token_ciphertext, key).access_token;
  const userId = etsyUserId(token);
  if (!token || !userId) throw new HttpError(503, 'Etsy authorisation needs reconnecting.');
  const reference = await api(`/listings/${REFERENCE_LISTING_ID}`, { token, cfg });
  const shopId = etsyNumericId(reference.shop_id);
  if (!shopId || !Number.isSafeInteger(reference.taxonomy_id) || !Number.isSafeInteger(reference.shipping_profile_id)) throw new HttpError(502, 'The Etsy reference listing is incomplete.');
  return { cfg, token, shop: { shop_id: shopId }, reference };
}

async function taggedListings(shopId, credentials) {
  const [drafts, active] = await Promise.all([
    api(`/shops/${shopId}/listings?state=draft&limit=100`, credentials),
    api(`/shops/${shopId}/listings?state=active&limit=100`, credentials),
  ]);
  return [...results(drafts), ...results(active)];
}

function description({ product, method }) {
  return [product.blurb, '', `Finish: ${method.label}.`, `Choose your colour, size and ${method.id === 'print' ? 'print location' : 'embroidery position'} from the options.`, `Fabric: ${product.fabric}.`].join('\n');
}

function draftBody(entry, reference) {
  const inventory = listingInventory(entry.product, entry.method, reference.readiness_state_id ?? null);
  const params = new URLSearchParams({
    quantity: '999', title: entry.title, description: description(entry), price: String(inventory.products[0].offerings[0].price),
    who_made: reference.who_made ?? 'collective', when_made: 'made_to_order', taxonomy_id: String(reference.taxonomy_id),
    shipping_profile_id: String(reference.shipping_profile_id), tags: entry.tags.join(','),
  });
  if (Number.isSafeInteger(reference.return_policy_id)) params.set('return_policy_id', String(reference.return_policy_id));
  const material = cleanMaterial(entry.product.material);
  if (material) params.set('materials', material);
  if (Number.isSafeInteger(reference.processing_min)) params.set('processing_min', String(reference.processing_min));
  if (Number.isSafeInteger(reference.processing_max)) params.set('processing_max', String(reference.processing_max));
  if (Number.isSafeInteger(reference.readiness_state_id)) params.set('readiness_state_id', String(reference.readiness_state_id));
  return { params, inventory };
}

export async function createWebsiteDrafts(products) {
  const plan = buildDraftPlan(products);
  if (plan.length !== 11) throw new HttpError(409, 'The website product range changed; refresh the Etsy plan first.');
  const credentials = await setup();
  const existing = await taggedListings(credentials.shop.shop_id, credentials);
  const listings = [];
  for (const entry of plan) {
    const match = existing.find((listing) => entry.tags.every((value) => (listing.tags ?? []).includes(value)));
    if (match?.state === 'active') {
      listings.push({ key: entry.key, listing_id: match.listing_id, title: match.title, status: 'already_active' });
      continue;
    }
    const { params, inventory } = draftBody(entry, credentials.reference);
    const listing = match ?? await api(`/shops/${credentials.shop.shop_id}/listings`, { ...credentials, method: 'POST', body: params });
    await api(`/listings/${listing.listing_id}/inventory?max_variations_supported=3`, { ...credentials, method: 'PUT', body: inventory });
    listings.push({ key: entry.key, listing_id: listing.listing_id, title: listing.title, status: match ? 'updated' : 'created' });
  }
  return { listings };
}
