// Creates (or reports an existing) store staff login. Run ONCE by the owner on their own
// machine. The password is typed at a hidden prompt, hashed inside Postgres (bcrypt) and
// never written to disk or printed. Staff cannot be created through the website.
//   npm run db:create-staff            create a login
//   npm run db:create-staff -- --reset  set a NEW password for an existing login (also re-activates it)
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { ownerClient } from './lib/db-owner.mjs';

// Hidden input: the prompt is printed, then everything the terminal echoes back is swallowed.
const ask = (q, hidden = false) =>
  new Promise((resolve) => {
    let muted = false;
    const output = new Writable({
      write(chunk, enc, cb) {
        if (!muted) process.stdout.write(chunk, enc);
        cb();
      },
    });
    const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
    rl.question(q, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = hidden; // question() has already written the prompt synchronously
  });

const email = (await ask('Owner email: ')).toLowerCase();
const password = await ask('Password (min 12 characters, hidden): ', true);
const again = await ask('Repeat password: ', true);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That does not look like an email address.');
if (password.length < 12) throw new Error('Use at least 12 characters.');
if (password !== again) throw new Error('The passwords did not match.');

const client = await ownerClient();
try {
  const reset = process.argv.includes('--reset');
  const { rows } = await client.query(
    `insert into emblara.staff (email, password_hash) values ($1, public.crypt($2, public.gen_salt('bf', 12)))
     on conflict (email) ${reset ? 'do update set password_hash = excluded.password_hash, active = true' : 'do nothing'} returning id`,
    [email, password],
  );
  console.log(rows.length ? `${reset ? 'Saved' : 'Created'} staff login for ${email}.` : `${email} is already staff; nothing changed. Use --reset to set a new password.`);
} finally {
  await client.end();
}
