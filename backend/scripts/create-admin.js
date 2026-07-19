/**
 * Krijon perdoruesin e pare (ose nje te ri) nga rreshti i komandes.
 *
 *   npm run create-admin
 *   npm run create-admin -- --username arben --role staff
 *
 * Fjalekalimi shkruhet ne menyre te fshehur; nuk ruhet askund ne tekst te qarte.
 */
require('dotenv').config();
const readline = require('readline');
const { Writable } = require('stream');

const pool = require('../src/config/db');
const authService = require('../src/services/authService');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Lexon nga terminali; nese `hidden`, nuk i shfaq karakteret. */
function ask(question, hidden = false) {
  const mutable = new Writable({
    write(chunk, enc, cb) {
      if (!hidden) process.stdout.write(chunk, enc);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: mutable, terminal: true });
  return new Promise((resolve) => {
    process.stdout.write(question);
    rl.question('', (answer) => {
      if (hidden) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

(async () => {
  try {
    console.log('\n=== Krijimi i një përdoruesi të ri ===\n');

    const username = arg('username') || (await ask('Emri i përdoruesit: '));
    const full_name = arg('name') || (await ask('Emri dhe mbiemri: '));
    const role = arg('role') || (await ask('Roli (admin/staff) [admin]: ')) || 'admin';

    const password = arg('password') || (await ask('Fjalëkalimi (nuk shfaqet): ', true));
    if (!arg('password')) {
      const again = await ask('Përsërisni fjalëkalimin: ', true);
      if (again !== password) {
        console.error('\n✗ Fjalëkalimet nuk përputhen.');
        process.exit(1);
      }
    }

    const user = await authService.createUser({ username, password, full_name, role });
    console.log(`\n✓ U krijua përdoruesi "${user.username}" (${user.role}) — ${user.full_name}\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n✗ ${err.message}\n`);
    process.exit(1);
  } finally {
    pool.end().catch(() => {});
  }
})();