/**
 * Parolni tiklash vositasi.
 *
 *   node tools/reset-password.mjs
 *
 * Login va yangi parolni so'raydi, Worker'dagi bilan bir xil usulda
 * (PBKDF2-SHA256, 100 000 marta) hash hisoblaydi va D1 bazasiga yozadi.
 *
 * Parol hech qayerda saqlanmaydi — faqat hash bazaga tushadi.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes, pbkdf2 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ITERATIONS = 100_000;

/** wrangler.toml dan baza nomini o'qiymiz — qo'lda yozish shart emas. */
function databaseName() {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const match = toml.match(/database_name\s*=\s*"([^"]+)"/);
  if (!match) {
    console.error('wrangler.toml dan database_name topilmadi.');
    process.exit(1);
  }
  return match[1];
}

function hash(password, salt) {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, ITERATIONS, 32, 'sha256', (err, key) =>
      err ? reject(err) : resolve(key.toString('hex')),
    );
  });
}

/** SQL ichidagi qo'shtirnoqni xavfsizlash. */
const q = (s) => String(s).replace(/'/g, "''");

const rl = createInterface({ input: stdin, output: stdout });

const db = databaseName();
console.log(`Baza: ${db}\n`);

const username = (await rl.question('Login (masalan: owner1): ')).trim();
if (!username) {
  console.error('Login bo‘sh bo‘lishi mumkin emas.');
  process.exit(1);
}

const password = (await rl.question('Yangi parol (kamida 8 belgi): ')).trim();
if (password.length < 8) {
  console.error('Parol kamida 8 ta belgidan iborat bo‘lishi kerak.');
  process.exit(1);
}

const where = (await rl.question('Qaysi baza? [r] masofaviy / [l] lokal (default r): '))
  .trim()
  .toLowerCase();
rl.close();

const flag = where === 'l' ? '--local' : '--remote';

const salt = randomBytes(16).toString('hex');
const passwordHash = await hash(password, salt);

// Eski sessiyalar ham bekor qilinadi — parol o'zgarsa, hamma joydan chiqadi.
const sql = `
UPDATE profiles
   SET password_hash = '${q(passwordHash)}',
       password_salt = '${q(salt)}',
       password_iter = ${ITERATIONS}
 WHERE username = '${q(username)}';
DELETE FROM sessions
 WHERE user_id IN (SELECT id FROM profiles WHERE username = '${q(username)}');
SELECT id, username, full_name, role FROM profiles WHERE username = '${q(username)}';
`.trim();

console.log(`\n🌀 ${db} bazasiga yozilmoqda (${flag})...\n`);

try {
  const out = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', 'd1', 'execute', db, flag, '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  console.log(out);
  console.log('✅ Parol almashtirildi. Eski sessiyalar bekor qilindi.');
  console.log('   Endi shu login va yangi parol bilan kiring.');
} catch {
  console.error('\n❌ Bajarilmadi. Yuqoridagi xatoga qarang.');
  process.exit(1);
}
