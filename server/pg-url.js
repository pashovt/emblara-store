// Neon connection strings say sslmode=require. node-postgres currently treats that as
// verify-full (certificate AND host name checked) but will switch to the weaker libpq meaning in
// its next major version, and warns about it meanwhile. State the strict mode explicitly so
// behaviour never changes under us and the warning goes away.
export function strictSsl(url) {
  const u = new URL(url);
  if (u.searchParams.has('sslmode') && u.searchParams.get('sslmode') !== 'disable') u.searchParams.set('sslmode', 'verify-full');
  return u.toString();
}
