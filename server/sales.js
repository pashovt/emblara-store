import { db } from './db.js';
import { HttpError } from './http.js';
import { encryptLink, newToken } from './link-crypto.js';

export const overview = async () => ({
  requests: (await db().salesRequests()).slice(0, 100),
  invoices: (await db().salesInvoices()).slice(0, 100),
  clients: (await db().salesClients()).slice(0, 100),
});

export async function createClient(input) {
  if (!input || typeof input !== 'object') throw new HttpError(422, 'Enter client details.');
  return { id: await db().createSalesClient(input) };
}
export async function createQuote(requestId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(requestId))) throw new HttpError(422, 'Choose a quote request.');
  return { id: await db().createQuote(requestId) };
}
export async function addQuoteLine(quoteId, input) {
  const quantity = Number(input?.quantity); const unit = Number(input?.unit_price_pence); const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(String(quoteId)) || !description || description.length > 500 || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unit) || unit < 0) throw new HttpError(422, 'Enter a valid quotation line.');
  await db().addQuoteLine(quoteId, { description, quantity, unit_price_pence: unit }); return { ok: true };
}
export async function issueQuote(quoteId, siteUrl) {
  if (!/^[0-9a-f-]{36}$/i.test(String(quoteId))) throw new HttpError(422, 'Choose a quotation.');
  const token = newToken(); const link = `${siteUrl}/#/q/${token}`;
  const quote = await db().issueQuote(quoteId, token, encryptLink(link));
  return { quote, link, email: { sent: false, reason: 'email workflow not set up' } };
}
