// Creates (or reports an existing) store staff login. Run ONCE by the owner on their own
// machine. The password is typed at a hidden prompt, hashed inside Postgres (bcrypt) and
// never written to disk or printed. Staff cannot be created through the website.
//   npm run db:create-staff
import readline from 'node:readline';
import { ownerClient } from './lib/db-owner.mjs';

const ask = (q, hidden = false) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? s : '');
    }
    rl.question(q, (a) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(a.trim());
    });
  });

const email = (await ask('Owner email: ')).toLowerCase();
const password = await ask('Password (min 12 characters, hidden): ', true);
const again = await ask('Repeat password: ', true);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That does not look like an email address.');
if (password.length < 12) throw new Error('Use at least 12 characters.');
if (password !== again) throw new Error('The passwords did not match.');

const client = await ownerClient();
try {
  const { rows } = await client.query(
    "insert into emblara.staff (email, password_hash) values ($1, public.crypt($2, public.gen_salt('bf', 12))) on conflict (email) do nothing returning id",
    [email, password],
  );
  console.log(rows.length ? `Created staff login for ${email}.` : `${email} is already staff; nothing changed.`);
} finally {
  await client.end();
}
