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
const PRODUCT_CODES = {
  'mens-polo': 'MPO', 'womens-polo': 'WPO', 'organic-polo': 'OPO', 'printed-polo': 'PPO',
  'heavy-cotton-tee': 'HCT', 'ultra-cotton-tee': 'UCT', 'logo-hoodie': 'HDY', 'crew-sweatshirt': 'SWT',
};
const POSITION_CODES = { Front: 'F', Back: 'B', 'Front + back': 'FB', 'Left chest': 'LC', 'Centre chest': 'CC', 'Large chest': 'CH', 'Large back': 'LB' };
const SEO = {
  'mens-polo': {
    title: 'Custom Embroidered Men’s Polo Shirt, Personalised Logo Workwear Uniform',
    tags: ['custom polo shirt', 'embroidered polo', 'workwear polo', 'mens workwear', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team polo shirt', 'corporate clothing'],
    materials: ['cotton', 'pique'],
  },
  'womens-polo': {
    title: 'Custom Embroidered Women’s Polo Shirt, Personalised Company Workwear',
    tags: ['womens polo shirt', 'embroidered polo', 'womens workwear', 'workwear polo', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team polo shirt', 'corporate clothing'],
    materials: ['cotton', 'pique'],
  },
  'organic-polo': {
    title: 'Organic Cotton Embroidered Polo Shirt, Custom Logo Team Workwear',
    tags: ['organic cotton polo', 'embroidered polo', 'organic workwear', 'workwear polo', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team polo shirt', 'custom work shirt'],
    materials: ['organic cotton', 'pique'],
  },
  'printed-polo': {
    title: 'Custom Printed Polo Shirt, Personalised Business Logo Workwear',
    tags: ['printed polo shirt', 'custom polo shirt', 'workwear polo', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team polo shirt', 'printed workwear', 'custom work shirt'],
    materials: ['cotton', 'pique'],
  },
  'heavy-cotton-tee': {
    title: ({ method }) => `Custom ${method.label} Heavy Cotton T-Shirt, Personalised Logo Workwear`,
    tags: ['heavy cotton tee', 'custom work tshirt', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team workwear', 'custom work shirt', 'corporate clothing', 'personalised tshirt'],
    materials: ['cotton', 'jersey'],
  },
  'ultra-cotton-tee': {
    title: 'Custom Printed Ultra Cotton T-Shirt, Personalised Logo Workwear',
    tags: ['ultra cotton tee', 'printed tshirt', 'custom work tshirt', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team workwear', 'printed workwear', 'custom work shirt'],
    materials: ['cotton', 'jersey'],
  },
  'logo-hoodie': {
    title: ({ method }) => `Custom ${method.label} Hoodie, Personalised Logo Workwear Uniform`,
    tags: ['custom work hoodie', 'workwear hoodie', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team workwear', 'corporate clothing', 'custom logo hoodie', 'personalised hoodie'],
    materials: ['cotton', 'polyester'],
  },
  'crew-sweatshirt': {
    title: ({ method }) => `Custom ${method.label} Crewneck Sweatshirt, Personalised Workwear Logo`,
    tags: ['custom sweatshirt', 'workwear sweatshirt', 'business uniform', 'staff uniform', 'company logo shirt', 'branded workwear', 'team workwear', 'corporate clothing', 'custom logo jumper', 'personalised jumper'],
    materials: ['cotton', 'polyester'],
  },
};

const cleanMaterial = (value) => String(value ?? '').replace(/[^\p{L}\p{Nd}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const tagsFor = ({ product, method }) => ['emblara', product.slug, method.id];
const skuToken = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'NA';
const titleFor = (entry) => {
  const configured = SEO[entry.product.slug]?.title;
  return typeof configured === 'function' ? configured(entry) : configured ?? `EMBLARA ${entry.product.name} — ${entry.method.label}`;
};

function listingTags(entry) {
  const tags = [...tagsFor(entry), ...(SEO[entry.product.slug]?.tags ?? [])];
  const unique = [...new Set(tags.map((tag) => tag.trim().toLowerCase()))];
  if (unique.length !== 13 || unique.some((tag) => tag.length > 20)) throw new HttpError(409, `Etsy SEO metadata is invalid for ${entry.product.slug}.`);
  return unique;
}

function materialsFor(entry) {
  const material = SEO[entry.product.slug]?.materials ?? [cleanMaterial(entry.product.material)];
  return [...new Set(material.map(cleanMaterial).filter(Boolean))];
}

function skuFor(product, method, colour, size, position) {
  return ['EM', PRODUCT_CODES[product.slug] ?? skuToken(product.slug), method.id === 'print' ? 'P' : 'E', skuToken(colour.name), skuToken(size.label), POSITION_CODES[position.label] ?? skuToken(position.label)].join('-');
}

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
    key: `${product.slug}-${method.id}`, product, method, title: titleFor({ product, method }), tags: listingTags({ product, method }),
    };
  }));
}

export function missingDrafts(plan, listings) {
  return plan.filter((entry) => !listings.some((listing) => {
    const tags = new Set(listing.tags ?? []);
    return tagsFor(entry).every((value) => tags.has(value));
  }));
}

export function listingInventory(product, method, readinessStateId = null) {
  const products = product.colours.flatMap((colour) => method.sizes.flatMap((size) => method.positions.map((position) => {
    const price = singleQuote(product, { method: method.id, size: size.label, position: position.label, qty: 1 }).total;
    const offering = { price, quantity: 999, is_enabled: true };
    if (Number.isSafeInteger(readinessStateId) && readinessStateId > 0) offering.readiness_state_id = readinessStateId;
    return {
      sku: skuFor(product, method, colour, size, position),
      property_values: VARIATIONS.map(([property_id, property_name], index) => ({
        property_id, property_name, value_ids: [], scale_id: null,
        values: [index === 0 ? colour.name : index === 1 ? size.label : position.label],
      })),
      offerings: [offering],
    };
  })));
  // Etsy accepts a price matrix for zero, one, or every configured variation
  // property. Price is colour-independent here, but including Colour keeps the
  // three-dimensional inventory valid while preserving the matrix price.
  return { products, price_on_property: VARIATIONS.map(([propertyId]) => propertyId), quantity_on_property: [], sku_on_property: [], readiness_state_on_property: [] };
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
  const payload = await response.text();
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    throw new HttpError(502, `Etsy returned an unreadable response for ${method} ${path}.`);
  }
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

export function listingDescription({ product, method }) {
  const location = method.id === 'print' ? 'print location' : 'embroidery position';
  const decoration = method.id === 'print'
    ? 'Full-colour printing is suited to artwork with fine detail or multiple colours.'
    : 'Embroidery is best for clear, bold artwork. Very fine detail may need simplifying for a clean stitched result.';
  return [
    `Custom ${method.label.toLowerCase()} ${product.name.toLowerCase()} for uniforms and teamwear. Upload your logo, select the available options, then Etsy will show the exact price for that combination.`,
    '',
    'HOW TO ORDER',
    `1. Choose the available options, including the ${location}.`,
    '2. Upload one logo or artwork file in the personalisation field.',
    '3. Add any useful order notes.',
    '',
    'GARMENT DETAILS',
    product.blurb,
    `Fabric: ${product.fabric}.`,
    `Colours: ${product.colours.map(({ name }) => name).join(', ')}.`,
    `Sizes: ${method.sizes.map(({ label }) => label).join(', ')}.`,
    `Decoration options: ${method.positions.map(({ label }) => label).join(', ')}.`,
    '',
    'ARTWORK',
    decoration,
    'If anything about the supplied artwork needs clarification, we will contact you through Etsy messages before production.',
    'Please upload only artwork you have permission to use.',
    '',
    'Each garment is made to order. Etsy displays the delivery estimate for your location at checkout.',
  ].join('\n');
}

function personalization() {
  return {
    personalization_questions: [
      {
        question_text: 'Upload your logo',
        instructions: 'Upload one clear logo or artwork file. We will message you if we need clarification.',
        question_type: 'unlabeled_upload',
        required: true,
        max_allowed_files: 1,
      },
      {
        question_text: 'Order notes',
        instructions: 'Add any helpful placement, team or colour notes. Leave blank if not needed.',
        question_type: 'text_input',
        required: false,
        max_allowed_characters: 300,
      },
    ],
  };
}

function draftBody(entry, reference) {
  const inventory = listingInventory(entry.product, entry.method, reference.readiness_state_id ?? null);
  const params = new URLSearchParams({
    quantity: '999', title: entry.title, description: listingDescription(entry), price: String(inventory.products[0].offerings[0].price),
    who_made: reference.who_made ?? 'collective', is_supply: 'false', when_made: 'made_to_order', taxonomy_id: String(reference.taxonomy_id),
    shipping_profile_id: String(reference.shipping_profile_id), tags: entry.tags.join(','),
  });
  if (Number.isSafeInteger(reference.return_policy_id)) params.set('return_policy_id', String(reference.return_policy_id));
  const materials = materialsFor(entry);
  for (const material of materials) params.append('materials', material);
  params.append('styles', 'Workwear');
  params.append('styles', 'Business uniform');
  if (Number.isSafeInteger(reference.processing_min)) params.set('processing_min', String(reference.processing_min));
  if (Number.isSafeInteger(reference.processing_max)) params.set('processing_max', String(reference.processing_max));
  if (Number.isSafeInteger(reference.readiness_state_id)) params.set('readiness_state_id', String(reference.readiness_state_id));
  return { params, inventory, personalization: personalization() };
}

export async function createWebsiteDrafts(products) {
  const plan = buildDraftPlan(products);
  if (plan.length !== 11) throw new HttpError(409, 'The website product range changed; refresh the Etsy plan first.');
  const credentials = await setup();
  const existing = await taggedListings(credentials.shop.shop_id, credentials);
  const listings = [];
  for (const entry of plan) {
    const match = existing.find((listing) => tagsFor(entry).every((value) => (listing.tags ?? []).includes(value)));
    if (match?.state === 'active') {
      listings.push({ key: entry.key, listing_id: match.listing_id, title: match.title, status: 'already_active' });
      continue;
    }
    const { params, inventory, personalization: questions } = draftBody(entry, credentials.reference);
    const listing = match ?? await api(`/shops/${credentials.shop.shop_id}/listings`, { ...credentials, method: 'POST', body: params });
    if (match) await api(`/shops/${credentials.shop.shop_id}/listings/${listing.listing_id}`, { ...credentials, method: 'PATCH', body: params });
    await api(`/listings/${listing.listing_id}/inventory?max_variations_supported=3`, { ...credentials, method: 'PUT', body: inventory });
    await api(`/shops/${credentials.shop.shop_id}/listings/${listing.listing_id}/personalization?supports_multiple_personalization_questions=true`, { ...credentials, method: 'POST', body: questions });
    listings.push({ key: entry.key, listing_id: listing.listing_id, title: listing.title, status: match ? 'updated' : 'created' });
  }
  return { listings };
}
