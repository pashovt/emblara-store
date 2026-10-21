// Per-request context for the database layer. The router sets it once, after it has
// decided what kind of request this is, and server/db.js turns it into transaction-local
// Postgres settings that the row-level-security policies check:
//   flow     'checkout' | 'webhook' | 'status' | 'portal' (a non-staff server flow)
//   staffId  set only after the dashboard session was verified
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();
export const withContext = (ctx, fn) => store.run(ctx, fn);
export const context = () => store.getStore() ?? {};
