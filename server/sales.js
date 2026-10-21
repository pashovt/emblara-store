import { db } from './db.js';
import { HttpError } from './http.js';
import { encryptLink, newToken } from './link-crypto.js';
import { salesPdf } from './pdf.js';

export const overview = async () => ({
  requests: (await db().salesRequests()).slice(0, 100),
  invoices: (await db().salesInvoices()).slice(0, 100),
  clients: (await db().salesClients()).slice(0, 100),
});

export async function createClient(input) {
  if (!input || typeof input !== 'object') throw new HttpError(422, 'Enter client details.');
  return { id: await db().createSalesClient(input) };
}
export async function createInvoice(input) {
  const clientId = String(input?.client_id ?? '');
  const deposit = input?.deposit_percent === '' || input?.deposit_percent === undefined ? null : Number(input.deposit_percent);
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || (deposit !== null && (!Number.isFinite(deposit) || deposit <= 0 || deposit > 100))) throw new HttpError(422, 'Choose a client and a valid deposit percentage.');
  return { id: await db().createInvoice(clientId, deposit) };
}
export async function addInvoiceLine(invoiceId, input) {
  const quantity = Number(input?.quantity); const unit = Number(input?.unit_price_pence); const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(String(invoiceId)) || !description || description.length > 500 || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unit) || unit < 0) throw new HttpError(422, 'Enter a valid invoice line.');
  await db().addInvoiceLine(invoiceId, { description, quantity, unit_price_pence: unit }); return { ok: true };
}
export async function transitionInvoice(invoiceId, input) {
  const status = String(input?.status ?? ''); const reason = typeof input?.reason === 'string' ? input.reason.trim() : null;
  if (!/^[0-9a-f-]{36}$/i.test(String(invoiceId)) || !['draft', 'sent', 'paid', 'cancelled'].includes(status) || (['draft', 'cancelled'].includes(status) && !reason)) throw new HttpError(422, 'Enter a valid invoice status and reason where required.');
  return { invoice: await db().transitionInvoice(invoiceId, status, reason) };
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
export async function invoicePdf(invoiceId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(invoiceId))) throw new HttpError(404, 'Invoice not found.');
  const invoice = await db().invoicePdfData(invoiceId); if (!invoice) throw new HttpError(404, 'Invoice not found.');
  const lines = await db().invoiceLines(invoiceId);
  const recipient = [invoice.organisation_name, invoice.contact_name, invoice.address_line1, invoice.address_line2, invoice.city, invoice.postcode, invoice.country].filter(Boolean).join('\n');
  const pdf = await salesPdf({ title: 'Invoice', number: invoice.number, recipient, lines, totalPence: invoice.total_pence, note: invoice.delivery_estimate });
  await db().storeInvoicePdf(invoiceId, pdf);
  return { pdf, filename: `${invoice.number}.pdf` };
}
