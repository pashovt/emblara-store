// Proves the database rules hold, using the REAL runtime roles on the linked Neon branch.
// Every write happens inside a transaction that is rolled back. The only committed change
// is one throwaway staff row, removed at the end.
//   npm run db:check
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { strictSsl } from '../server/pg-url.js';
import { ownerClient } from './lib/db-owner.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
};

// Run SQL as a role inside a rolled-back transaction with the given context.
async function as(url, ctx, fn) {
  const c = new pg.Client({ connectionString: strictSsl(url) });
  await c.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('emblara.flow', $1, true), set_config('emblara.staff_id', $2, true)", [ctx.flow ?? '', ctx.staffId ?? '']);
    const ctxSet = async (flow, staffId = '') => c.query("select set_config('emblara.flow', $1, true), set_config('emblara.staff_id', $2, true)", [flow, staffId]);
    return await fn(c, ctxSet);
  } finally {
    await c.query('rollback').catch(() => {});
    await c.end();
  }
}
// -> { ok, code } so "denied" cases can be asserted without aborting the run.
const attempt = async (c, sql, params = []) => {
  await c.query('savepoint s');
  try {
    const r = await c.query(sql, params);
    await c.query('release savepoint s');
    return { ok: true, rows: r.rows, count: r.rowCount };
  } catch (e) {
    await c.query('rollback to savepoint s');
    return { ok: false, code: e.code };
  }
};
const DENIED = ['42501']; // insufficient_privilege (also raised for RLS violations)

const APP = process.env.EMBLARA_APP_DATABASE_URL;
const PUB = process.env.EMBLARA_PUBLIC_DATABASE_URL;
if (!APP || !PUB) throw new Error('Run `npm run db:migrate -- --set-passwords` first.');

const owner = await ownerClient();
const tempEmail = `rls-check-${randomBytes(4).toString('hex')}@invalid.test`;
const tempPassword = randomBytes(18).toString('base64url');
let staffId;
try {
  staffId = (await owner.query("insert into emblara.staff (email, password_hash) values ($1, public.crypt($2, public.gen_salt('bf', 8))) returning id", [tempEmail, tempPassword])).rows[0].id;
  const visible = (await owner.query('select count(*)::int n from emblara.products where published and available')).rows[0].n;
  const total = (await owner.query('select count(*)::int n from emblara.products')).rows[0].n;

  // ---- public reader
  await as(PUB, {}, async (c) => {
    const r = await attempt(c, 'select id, slug, available from emblara.products');
    check('public reads only published AND available products', r.ok && r.count === visible, `got ${r.count}, expected ${visible} of ${total}`);
    check('public cannot select the published column or *', !(await attempt(c, 'select published from emblara.products')).ok && !(await attempt(c, 'select * from emblara.products')).ok);
    for (const t of ['orders', 'order_items', 'staff']) check(`public cannot read ${t}`, DENIED.includes((await attempt(c, `select 1 from emblara.${t}`)).code));
    check('public cannot insert a product', !(await attempt(c, "insert into emblara.products (slug,name,category) values ('x-y','xy','polos')")).ok);
    check('public cannot call staff_login or is_staff', !(await attempt(c, "select emblara.staff_login('a@b.co','x')")).ok && !(await attempt(c, 'select emblara.is_staff()')).ok);
  });

  // ---- store server with no request context
  await as(APP, {}, async (c) => {
    check('server with no context sees no products', (await attempt(c, 'select 1 from emblara.products')).count === 0);
    check('server with no context sees no orders', (await attempt(c, 'select 1 from emblara.orders')).count === 0);
    check('server cannot read the staff table or password hashes', DENIED.includes((await attempt(c, 'select password_hash from emblara.staff')).code));
    check('server with no context cannot write a product', !(await attempt(c, "insert into emblara.products (slug,name,category) values ('x-y','xy','polos')")).ok);
    check('server with no context cannot create an order', !(await attempt(c, "insert into emblara.orders (number, amount_total_pence) values ('EM-T1', 100)")).ok);
  });

  // ---- order lifecycle, one rolled-back transaction
  await as(APP, { flow: 'checkout' }, async (c, ctxSet) => {
    check('checkout cannot create an already-paid order', !(await attempt(c, "insert into emblara.orders (number, amount_total_pence, payment_status) values ('EM-T2', 100, 'paid')")).ok);
    check('checkout cannot create a fulfilled order', !(await attempt(c, "insert into emblara.orders (number, amount_total_pence, fulfillment_status) values ('EM-T3', 100, 'fulfilled')")).ok);
    const made = await attempt(c, "insert into emblara.orders (number, amount_total_pence) values ('EM-T4', 100) returning id");
    check('checkout can create a pending order', made.ok && made.count === 1, made.code);
    const id = made.rows?.[0]?.id;
    check('checkout cannot change a fulfilment state', (await attempt(c, "update emblara.orders set fulfillment_status = 'processing' where id = $1", [id])).count !== 1);
    await ctxSet('webhook');
    check('webhook flow cannot create orders', !(await attempt(c, "insert into emblara.orders (number, amount_total_pence) values ('EM-T5', 100)")).ok);
    const paid = await attempt(c, "update emblara.orders set payment_status = 'paid', paid_at = now() where id = $1 and payment_status = 'pending' returning id", [id]);
    check('webhook flow can mark a pending order paid', paid.ok && paid.count === 1, paid.code);
    check('paid order cannot go back to pending', (await attempt(c, "update emblara.orders set payment_status = 'pending' where id = $1", [id])).count !== 1);
    check('webhook flow cannot fulfil an order', (await attempt(c, "update emblara.orders set fulfillment_status = 'fulfilled' where id = $1", [id])).count !== 1);
    await ctxSet('', '00000000-0000-0000-0000-000000000000');
    check('a made-up staff id is not staff', (await attempt(c, "update emblara.orders set fulfillment_status = 'processing' where id = $1", [id])).count !== 1);
    await ctxSet('', staffId);
    check('real staff can read the paid order', (await attempt(c, 'select 1 from emblara.orders where id = $1', [id])).count === 1);
    check('real staff can move it to processing', (await attempt(c, "update emblara.orders set fulfillment_status = 'processing' where id = $1 returning id", [id])).count === 1);
    check('staff can add a product', (await attempt(c, "insert into emblara.products (slug,name,category) values ('rls-check-product','RLS check','polos') returning id")).count === 1);
    check('staff cannot delete a product', !(await attempt(c, "delete from emblara.products where slug = 'rls-check-product'")).ok || (await attempt(c, "select 1 from emblara.products where slug = 'rls-check-product'")).count === 1);
    // an unpaid order can never be fulfilled, even by staff (table constraint)
    await ctxSet('checkout');
    const unpaid = (await attempt(c, "insert into emblara.orders (number, amount_total_pence) values ('EM-T6', 100) returning id")).rows?.[0]?.id;
    await ctxSet('', staffId);
    check('staff cannot fulfil an unpaid order', (await attempt(c, "update emblara.orders set fulfillment_status = 'processing' where id = $1", [unpaid])).count !== 1);
  });

  // ---- staff sign-in function
  await as(APP, {}, async (c) => {
    check('staff_login accepts the right password', (await attempt(c, 'select emblara.staff_login($1,$2) as id', [tempEmail, tempPassword])).rows?.[0]?.id === staffId);
    check('staff_login rejects a wrong password', (await attempt(c, 'select emblara.staff_login($1,$2) as id', [tempEmail, 'wrong-password'])).rows?.[0]?.id === null);
  });
} finally {
  if (staffId) await owner.query('delete from emblara.staff where id = $1', [staffId]);
  await owner.end();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
