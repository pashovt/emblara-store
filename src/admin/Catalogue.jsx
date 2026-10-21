import { Fragment, useState } from 'react';
import { api, useLoad } from './api.js';

const pounds = (pence) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(pence) / 100);

function ProductLink({ item, products, reload }) {
  const [productId, setProductId] = useState(item.product_id ?? '');
  const [message, setMessage] = useState('');
  const link = async () => {
    setMessage('');
    try { await api('catalogue/link', { method: 'POST', body: { product_id: productId, catalogue_item_id: item.id } }); setMessage('Linked.'); reload(); } catch (error) { setMessage(error.message); }
  };
  return <div className="adm__form"><label>Website product<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Choose a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><button type="button" className="pill" disabled={!productId} onClick={link}>Save link</button>{message && <p className={message === 'Linked.' ? 'adm__ok' : 'adm__error'}>{message}</p>}</div>;
}

function StockMovement({ item, reload }) {
  const [form, setForm] = useState({ type: 'IN', quantity: '', note: '' }); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await api('catalogue/stock', { method: 'POST', body: { item_id: item.id, request_id: crypto.randomUUID(), ...form } }); setForm({ type: 'IN', quantity: '', note: '' }); setMessage('Stock updated.'); reload(); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <form className="adm__form" onSubmit={submit}><h3>Stock movement</h3><label>Direction<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="IN">Stock in</option><option value="OUT">Stock out</option></select></label><label>Garments<input required type="number" min="1" max="1000000" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Note {form.type === 'OUT' && '(required)'}<input required={form.type === 'OUT'} maxLength="500" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>{message && <p className={message === 'Stock updated.' ? 'adm__ok' : 'adm__error'}>{message}</p>}<button className="pill pill--copper" disabled={busy}>{busy ? 'Saving…' : 'Save movement'}</button></form>;
}

function ItemDetails({ item, products, reload }) {
  return <tr><td colSpan="4"><div className="adm__cols"><div className="adm__card"><h2>Store mapping</h2><p className="adm__muted">One website product maps to one catalogue item. This link drives the monthly garment warning.</p><ProductLink item={item} products={products} reload={reload} /><h2>Price list</h2>{item.price_tiers.length ? <ul>{item.price_tiers.map((tier) => <li key={`${tier.method}-${tier.qty_from}`}>{tier.method} · {tier.qty_from}+ garments: {pounds(tier.unit_price_pence)} each</li>)}</ul> : <p className="adm__muted">No price tiers loaded.</p>}</div>{item.track_stock && <div className="adm__card"><p><strong>{item.stock_on_hand}</strong> garments on hand{item.low_stock_threshold != null && ` · low-stock point: ${item.low_stock_threshold}`}</p><StockMovement item={item} reload={reload} /></div>}</div></td></tr>;
}

export default function Catalogue() {
  const [state, reload] = useLoad('catalogue'); const [productsState] = useLoad('products'); const [open, setOpen] = useState(null);
  if (state.error) return <p className="adm__error">{state.error}</p>;
  if (state.loading) return <p className="adm__muted">Loading catalogue…</p>;
  const items = state.data?.items ?? []; const products = productsState.data?.products ?? [];
  return <section><h1 className="adm__h1">Catalogue</h1><p className="adm__muted">The monthly limit warns at 100 garments; it does not block an order.</p>
    {!items.length ? <p className="adm__muted">No catalogue items yet. Run the owner price-list import first.</p> : <div className="adm__scroll"><table className="adm__table adm__table--cards"><thead><tr><th>Item</th><th>Stock</th><th>This month</th><th>Monthly limit</th></tr></thead><tbody>{items.map((item) => <Fragment key={item.id}><tr><td data-label="Item"><button type="button" className="link-button" onClick={() => setOpen(open === item.id ? null : item.id)}><strong>{item.name}</strong></button><small>{item.code}{item.active ? '' : ' · Inactive'}</small></td><td data-label="Stock">{item.track_stock ? `${item.stock_on_hand} on hand` : 'Not tracked'}</td><td data-label="This month">{item.ordered_this_month} garments</td><td data-label="Monthly limit">{item.monthly_order_limit ?? '100 warning'}</td></tr>{open === item.id && <ItemDetails item={item} products={products} reload={reload} />}</Fragment>)}</tbody></table></div>}
  </section>;
}
