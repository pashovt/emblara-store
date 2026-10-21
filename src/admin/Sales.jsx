import { useState } from 'react';
import { api, useLoad } from './api.js';
import { gbp } from '../lib/utils.js';

const moneyPence = (value) => Math.round(Number(value || 0) * 100);

export default function Sales() {
  const [state, reload] = useLoad('sales');
  const [tab, setTab] = useState('requests');
  const [draftQuote, setDraftQuote] = useState(null); const [draftInvoice, setDraftInvoice] = useState(null);
  const [showClient, setShowClient] = useState(false); const [showInvoice, setShowInvoice] = useState(false); const [message, setMessage] = useState('');
  const startQuote = async (requestId) => { try { const result = await api('sales/quotes', { method: 'POST', body: { request_id: requestId } }); setDraftQuote(result.id); setMessage('Quotation draft created. Add at least one line before issuing it.'); reload(); } catch (error) { setMessage(error.message); } };
  const transition = async (id, status) => { try { await api(`sales/invoices/status?id=${encodeURIComponent(id)}`, { method: 'POST', body: { status } }); setMessage(`Invoice marked ${status}.`); reload(); } catch (error) { setMessage(error.message); } };
  if (state.error) return <p className="adm__error">{state.error}</p>;
  if (state.loading) return <p className="adm__muted">Loading sales…</p>;
  const data = state.data ?? { requests: [], invoices: [], clients: [] }; const rows = data[tab] ?? [];
  return <section><h1 className="adm__h1">Sales</h1><div className="adm__tabs" role="tablist">{[['requests', 'Requests'], ['invoices', 'Invoices'], ['clients', 'Clients']].map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>{message && <p className="adm__ok">{message}</p>}
    {tab === 'invoices' && <button type="button" className="pill pill--copper" onClick={() => setShowInvoice(!showInvoice)}>New invoice</button>}{tab === 'clients' && <button type="button" className="pill pill--copper" onClick={() => setShowClient(!showClient)}>New client</button>}
    {!rows.length ? <p className="adm__muted">No {tab} yet.</p> : <div className="adm__scroll"><table className="adm__table adm__table--cards"><tbody>
      {tab === 'requests' && rows.map((row) => <tr key={row.id}><td><strong>{row.reference}</strong><small>{row.organisation} · {row.contact_name}</small></td><td>{row.quantity_unsure ? 'Quantity to confirm' : `${row.quantity_total} garments`}</td><td><span className="adm__badge">{row.status}</span></td><td>{row.status !== 'accepted' && <button type="button" className="pill" onClick={() => startQuote(row.id)}>Create quotation</button>}</td></tr>)}
      {tab === 'invoices' && rows.map((row) => <tr key={row.id}><td><strong>{row.number}</strong><small>{row.organisation_name}</small></td><td>{gbp(row.total_pence / 100)}</td><td><span className="adm__badge">{row.status}</span></td><td><a className="pill" href={`/api/admin/sales/invoice-pdf?id=${encodeURIComponent(row.id)}`}>PDF</a>{row.status === 'draft' && <button type="button" className="pill" onClick={() => setDraftInvoice(row.id)}>Add lines</button>}{row.status === 'draft' && <button type="button" className="pill" onClick={() => transition(row.id, 'sent')}>Mark sent</button>}{row.status === 'sent' && <button type="button" className="pill" onClick={() => transition(row.id, 'paid')}>Mark paid</button>}</td></tr>)}
      {tab === 'clients' && rows.map((row) => <tr key={row.id}><td><strong>{row.organisation_name}</strong><small>{row.contact_name || row.email}</small></td><td>{row.email}</td><td>{row.archived ? 'Archived' : 'Active'}</td></tr>)}
    </tbody></table></div>}
    {showClient && <ClientForm onCreated={() => { setShowClient(false); reload(); }} />}{showInvoice && <InvoiceStart clients={data.clients} onCreated={(id) => { setDraftInvoice(id); setShowInvoice(false); reload(); }} />}{draftQuote && <QuoteComposer quoteId={draftQuote} />}{draftInvoice && <InvoiceComposer invoiceId={draftInvoice} />}
  </section>;
}

function ClientForm({ onCreated }) {
  const [form, setForm] = useState({ organisation_name: '', contact_name: '', address_line1: '', city: '', postcode: '', country: 'United Kingdom', email: '', phone: '' }); const [error, setError] = useState('');
  const save = async (event) => { event.preventDefault(); try { await api('sales/clients', { method: 'POST', body: form }); onCreated(); } catch (issue) { setError(issue.message); } };
  return <form className="adm__form adm__card" onSubmit={save}><h2>New client</h2><label>Organisation<input required value={form.organisation_name} onChange={(e) => setForm({ ...form, organisation_name: e.target.value })} /></label><label>Contact<input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></label><label>Address<input required value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></label><label>City<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><label>Postcode<input required value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><button className="pill">Save client</button>{error && <p className="adm__error">{error}</p>}</form>;
}

function InvoiceStart({ clients, onCreated }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? ''); const [deposit, setDeposit] = useState('100'); const [error, setError] = useState('');
  const create = async (event) => { event.preventDefault(); try { const result = await api('sales/invoices', { method: 'POST', body: { client_id: clientId, deposit_percent: deposit } }); onCreated(result.id); } catch (issue) { setError(issue.message); } };
  return <form className="adm__form adm__card" onSubmit={create}><h2>New invoice</h2>{clients.length ? <><label>Client<select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.filter((client) => !client.archived).map((client) => <option key={client.id} value={client.id}>{client.organisation_name}</option>)}</select></label><label>Deposit percentage<input required type="number" min="1" max="100" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></label><button className="pill">Create draft</button></> : <p className="adm__muted">Create a client first.</p>}{error && <p className="adm__error">{error}</p>}</form>;
}

function LineForm({ onSave, label }) {
  const [line, setLine] = useState({ description: '', quantity: 1, unit_price_pence: '' }); const [error, setError] = useState('');
  const save = async (event) => { event.preventDefault(); try { await onSave({ ...line, quantity: Number(line.quantity), unit_price_pence: moneyPence(line.unit_price_pence) }); setLine({ description: '', quantity: 1, unit_price_pence: '' }); } catch (issue) { setError(issue.message); } };
  return <form className="adm__form" onSubmit={save}><label>Description<input required value={line.description} onChange={(event) => setLine({ ...line, description: event.target.value })} /></label><label>Quantity<input required type="number" min="1" value={line.quantity} onChange={(event) => setLine({ ...line, quantity: event.target.value })} /></label><label>Unit price (£)<input required type="number" min="0" step="0.01" value={line.unit_price_pence} onChange={(event) => setLine({ ...line, unit_price_pence: event.target.value })} /></label><button className="pill">{label}</button>{error && <p className="adm__error">{error}</p>}</form>;
}

function InvoiceComposer({ invoiceId }) { return <div className="adm__card"><h2>Invoice draft</h2><LineForm label="Add invoice line" onSave={(line) => api(`sales/invoices/lines?id=${encodeURIComponent(invoiceId)}`, { method: 'POST', body: line })} /></div>; }
function QuoteComposer({ quoteId }) {
  const [busy, setBusy] = useState(false); const [link, setLink] = useState(''); const [error, setError] = useState('');
  const issue = async () => { setBusy(true); setError(''); try { const result = await api(`sales/quotes/issue?id=${encodeURIComponent(quoteId)}`, { method: 'POST', body: {} }); setLink(result.link); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  return <div className="adm__card"><h2>Quotation draft</h2>{link ? <><p>Email is not set up. Copy this private link:</p><input readOnly value={link} onFocus={(event) => event.target.select()} /></> : <><LineForm label="Add quotation line" onSave={(line) => api(`sales/quotes/lines?id=${encodeURIComponent(quoteId)}`, { method: 'POST', body: line })} /><button type="button" className="pill pill--copper" disabled={busy} onClick={issue}>Issue quotation</button></>}{error && <p className="adm__error">{error}</p>}</div>;
}
