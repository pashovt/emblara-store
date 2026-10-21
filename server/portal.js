// Customer-link routes use the dedicated role. Tokens arrive only in a body or header.
import { db } from './db.js';
import { HttpError } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, limit) => typeof value === 'string' && value.trim().length <= limit ? value.trim() : '';

export async function submitRequest(input) {
  if (!input || !UUID.test(String(input.submission_key)) || !text(input.contact_name, 120) || !text(input.organisation, 200) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(input.email)) || !Array.isArray(input.garments) || !input.garments.length || !text(input.colours, 300) || !text(input.needed_by, 10) || !text(input.delivery_postcode, 16) || !text(input.privacy_notice_version, 40)) throw new HttpError(422, 'Complete the required request details.');
  return db().portal((client) => client.query('select quoting.submit_request($1::jsonb) as request', [JSON.stringify(input)]).then((result) => result.rows[0].request));
}

export async function quote(token) {
  if (!token || token.length > 200) throw new HttpError(404, 'Quote not available.');
  const value = await db().portal((client) => client.query('select quoting.get_quote_by_token($1) as quote', [token]).then((result) => result.rows[0]?.quote ?? null));
  if (!value) throw new HttpError(404, 'Quote not available.');
  return value;
}

export async function respond(token, input) {
  if (!token || token.length > 200 || !['accepted', 'declined'].includes(input?.decision) || text(input.message ?? '', 2000) !== (input.message ?? '').trim()) throw new HttpError(422, 'Quote response is invalid.');
  try {
    return await db().portal((client) => client.query('select quoting.respond_to_quote($1, $2, $3) as quote', [token, input.decision, text(input.message ?? '', 2000) || null]).then((result) => result.rows[0].quote));
  } catch { throw new HttpError(404, 'Quote not available.'); }
}
