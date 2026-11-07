import { Hono } from 'hono';
import type { Env, SessionUser, Variables } from '../types';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { clientIp, fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import {
  createSession, currentUser, destroySession, iterations, loadUser, requireAuth, USER_FIELDS,
} from '../lib/auth';
import { clearLimit, limit } from '../lib/ratelimit';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Maktab kodiga qarab sinflar ro'yxati.
 * Asl saytdagi "Sinflarni yuklash" tugmasi shu yerga murojaat qiladi.
 */
app.get('/classes', async (c) => {
  const code = v.clean(new URL(c.req.url).searchParams.get('code'), 20).toUpperCase();
  if (!code) fail(422, 'Avval maktab kodini kiriting.');

  const { results } = await c.env.DB.prepare(
    `SELECT sc.class_name
       FROM school_classes sc JOIN schools s ON s.id = sc.school_id
      WHERE s.code = ?
      ORDER BY
        CAST(substr(sc.class_name, 1, instr(sc.class_name, '-') - 1) AS INTEGER),
        sc.class_name`,
  )
    .bind(code)
    .all<{ class_name: string }>();

  return c.json(ok({ classes: results ?? [] }));
});

// ------------------------------------------------------------------ birinchi sozlash
app.get('/setup/status', async (c) => {
  // Faqat owner borligini tekshiramiz. Avval o'quvchi ro'yxatdan o'tgan
  // bo'lsa ham, maktab owner'siz qolmasligi kerak.
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM profiles WHERE role = 'owner'`,
  ).first<{ n: number }>();
  return c.json(ok({ needsSetup: (row?.n ?? 0) === 0 }));
});

/** Birinchi owner. Faqat bazada hech kim bo'lmaganda ishlaydi. */
app.post('/setup', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  await limit(c.env, `setup:${ip}`, 5, 3600);

  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM profiles WHERE role = 'owner'`,
  ).first<{ n: number }>();
  if ((row?.n ?? 0) > 0) fail(409, 'Owner allaqachon tayinlangan.');

  const data = await v.body(c.req.raw);
  const key = v.str(data.setupKey, 'Setup kaliti', { min: 8, max: 200 });
  if (!c.env.SETUP_KEY || key !== c.env.SETUP_KEY) fail(403, "Setup kaliti noto'g'ri.");

  const uname = v.username(data.username);
  const pass = v.password(data.password);
  const name = v.str(data.fullName, 'Ism va familiya', { min: 3, max: 80 });

  const school = await c.env.DB.prepare(`SELECT id, code FROM schools ORDER BY id LIMIT 1`)
    .first<{ id: number; code: string }>();

  const { hash, salt, iterations: iter } = await hashPassword(pass, iterations(c.env));
  const res = await c.env.DB.prepare(
    `INSERT INTO profiles (username, password_hash, password_salt, password_iter,
                           full_name, role, school_id, school_code)
     VALUES (?, ?, ?, ?, ?, 'owner', ?, ?)`,
  )
    .bind(uname, hash, salt, iter, name, school?.id ?? null, school?.code ?? null)
    .run();

  const id = Number(res.meta.last_row_id);
  await createSession(c, id);
  return c.json(ok({ user: await loadUser(c.env, id) }), 201);
});

// ------------------------------------------------------------------ ro'yxatdan o'tish
app.post('/register', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  await limit(c.env, `register:${ip}`, 10, 3600);

  const data = await v.body(c.req.raw);
  const name = v.str(data.fullName, 'Ism va familiya', { min: 3, max: 80 });
  const uname = v.username(data.username);
  const pass = v.password(data.password);
  const code = v.clean(data.schoolCode, 20).toUpperCase();
  const className = v.clean(data.className, 20);

  if (!code) fail(422, 'Maktab kodini kiriting.');
  if (!className) fail(422, 'Iltimos, sinfingizni tanlang.');

  const school = await c.env.DB.prepare(`SELECT id, code FROM schools WHERE code = ?`)
    .bind(code)
    .first<{ id: number; code: string }>();
  if (!school) fail(422, 'Maktab kodi topilmadi.');

  const klass = await c.env.DB.prepare(
    `SELECT class_name FROM school_classes WHERE school_id = ? AND class_name = ?`,
  )
    .bind(school.id, className)
    .first();
  if (!klass) fail(422, 'Iltimos, maktab sinflarini qayta yuklang.');

  const exists = await c.env.DB.prepare(`SELECT id FROM profiles WHERE username = ?`)
    .bind(uname)
    .first();
  if (exists) fail(409, 'Bu login band. Boshqa login tanlang.');

  const { hash, salt, iterations: iter } = await hashPassword(pass, iterations(c.env));
  const res = await c.env.DB.prepare(
    `INSERT INTO profiles (username, password_hash, password_salt, password_iter,
                           full_name, class_name, school_id, school_code, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student')`,
  )
    .bind(uname, hash, salt, iter, name, className, school.id, school.code)
    .run();

  const id = Number(res.meta.last_row_id);
  await createSession(c, id);
  return c.json(ok({ user: await loadUser(c.env, id) }), 201);
});

// ------------------------------------------------------------------ kirish
app.post('/login', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const data = await v.body(c.req.raw);
  const uname = v.clean(data.username, 30).toLowerCase();
  const pass = typeof data.password === 'string' ? data.password : '';

  if (!uname || !pass) fail(422, 'Login va parolni kiriting.');

  await limit(c.env, `login:ip:${ip}`, 20, 900);
  await limit(c.env, `login:user:${uname}`, 8, 900, 'Bu login uchun urinishlar soni oshdi.');

  const row = await c.env.DB.prepare(
    `SELECT ${USER_FIELDS}, password_hash, password_salt, password_iter
       FROM profiles WHERE username = ? LIMIT 1`,
  )
    .bind(uname)
    .first<SessionUser & { password_hash: string; password_salt: string; password_iter: number }>();

  // Foydalanuvchi topilmasa ham bir xil vaqt sarflanadi
  const stored = row
    ? { hash: row.password_hash, salt: row.password_salt, iterations: row.password_iter }
    : { hash: '0'.repeat(64), salt: 'dummy', iterations: iterations(c.env) };

  const valid = await verifyPassword(pass, stored);
  if (!row || !valid) fail(401, "Login yoki parol noto'g'ri. Qayta urinib ko'ring.");

  await clearLimit(c.env, `login:user:${uname}`);
  await c.env.DB.prepare(`UPDATE profiles SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(row.id)
    .run();
  await createSession(c, row.id);

  return c.json(ok({ user: await loadUser(c.env, row.id) }));
});

app.post('/logout', async (c) => {
  await destroySession(c);
  return c.json(ok({}));
});

app.get('/me', async (c) => c.json(ok({ user: await currentUser(c) })));

// ------------------------------------------------------------------ parol
app.post('/change-password', requireAuth, async (c) => {
  const user = c.get('user');
  const data = await v.body(c.req.raw);
  const current = typeof data.currentPassword === 'string' ? data.currentPassword : '';
  const next = v.password(data.newPassword, 'Yangi parol');

  await limit(c.env, `chpass:${user.id}`, 10, 900);

  const row = await c.env.DB.prepare(
    `SELECT password_hash, password_salt, password_iter FROM profiles WHERE id = ?`,
  )
    .bind(user.id)
    .first<{ password_hash: string; password_salt: string; password_iter: number }>();
  if (!row) fail(404, 'Foydalanuvchi topilmadi.');

  const okPass = await verifyPassword(current, {
    hash: row.password_hash,
    salt: row.password_salt,
    iterations: row.password_iter,
  });
  if (!okPass) fail(401, "Joriy parol noto'g'ri.");

  const { hash, salt, iterations: iter } = await hashPassword(next, iterations(c.env));
  await c.env.DB.prepare(
    `UPDATE profiles SET password_hash = ?, password_salt = ?, password_iter = ? WHERE id = ?`,
  )
    .bind(hash, salt, iter, user.id)
    .run();

  return c.json(ok({}));
});

export default app;
