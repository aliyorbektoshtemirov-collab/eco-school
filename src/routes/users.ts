import { Hono } from 'hono';
import { isValidKey } from '../lib/images';
import type { Env, Variables } from '../types';
import { fail, ok, paging } from '../lib/http';
import * as v from '../lib/validate';
import { USER_FIELDS, iterations, requireAdmin, requireAuth, requireOwner } from '../lib/auth';
import { hashPassword, randomToken } from '../lib/crypto';

/**
 * Foydalanuvchilarni boshqarish.
 *
 * Qoidalar:
 *   - Owner bitta bo'ladi va adminlarni o'zi tayinlaydi.
 *   - Admin ro'yxatni ko'radi, lekin rol o'zgartira olmaydi.
 *   - Owner o'z rolini tushira olmaydi — maktab owner'siz qolmasin.
 */

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

app.put('/users/me/avatar', async (c) => {
  const user = c.get('user');
  const data = await v.body(c.req.raw);
  const key = typeof data.key === 'string' ? data.key : '';
  if (!isValidKey(key)) fail(422, 'Rasm kaliti yaroqsiz.');
  const object = await c.env.FILES?.head(key);
  if (!object || object.customMetadata?.userId !== String(user.id)) fail(403, 'Faqat o‘z rasmingizni tanlang.');
  await c.env.DB.prepare('UPDATE profiles SET avatar_key = ? WHERE id = ?').bind(key, user.id).run();
  return c.json(ok({ key }));
});


/** Ro'yxat: qidiruv, rol va sinf bo'yicha filtr. */
app.get('/users', requireAdmin, async (c) => {
  const me = c.get('user');
  const url = new URL(c.req.url);
  const { limit, offset, page } = paging(url, 50, 200);

  const search = v.clean(url.searchParams.get('q'), 40).toLowerCase();
  const role = url.searchParams.get('role');
  const klass = v.clean(url.searchParams.get('class'), 30);

  const where: string[] = ['school_id IS ?'];
  const binds: unknown[] = [me.school_id];

  if (search) {
    where.push('(lower(full_name) LIKE ? OR lower(username) LIKE ?)');
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (role === 'student' || role === 'admin' || role === 'owner') {
    where.push('role = ?');
    binds.push(role);
  }
  if (klass) {
    where.push('class_name = ?');
    binds.push(klass);
  }

  const clause = `WHERE ${where.join(' AND ')}`;

  const [rows, total] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT ${USER_FIELDS}, created_at, last_login_at,
              (telegram_chat_id IS NOT NULL) AS telegram_linked
         FROM profiles ${clause}
        ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                 points DESC, full_name
        LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profiles ${clause}`).bind(...binds),
  ]);

  const counts = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS all_users,
       SUM(role = 'student') AS students,
       SUM(role = 'admin')   AS admins
     FROM profiles WHERE school_id IS ?`,
  )
    .bind(me.school_id)
    .first<{ all_users: number; students: number; admins: number }>();

  return c.json(
    ok({
      users: rows.results ?? [],
      total: Number((total.results?.[0] as { n?: number })?.n ?? 0),
      page,
      limit,
      counts: {
        all: Number(counts?.all_users ?? 0),
        students: Number(counts?.students ?? 0),
        admins: Number(counts?.admins ?? 0),
      },
    }),
  );
});

/**
 * Yangi admin hisobini yaratish — faqat owner.
 *
 * O'qituvchining hisobi bo'lmasa, uni ro'yxatdan o'tishga majburlamasdan
 * shu yerda tayinlanadi. Parol owner kiritadi yoki tizim o'zi beradi;
 * qaytgan parol bir marta ko'rsatiladi va hech qayerda saqlanmaydi.
 */
app.post('/users', requireOwner, async (c) => {
  const me = c.get('user');
  const data = await v.body(c.req.raw);

  const uname = v.username(data.username);
  const name = v.str(data.fullName, 'Ism va familiya', { min: 3, max: 80 });
  const role = v.oneOf(data.role ?? 'admin', ['admin', 'student'] as const, 'Rol');

  // Parol kiritilmasa, o'qib bo'ladigan vaqtinchalik parol beriladi
  const given = typeof data.password === 'string' ? data.password.trim() : '';
  const password = given ? v.password(given) : `eco${randomToken(4)}`;

  const exists = await c.env.DB.prepare(`SELECT id FROM profiles WHERE username = ?`)
    .bind(uname)
    .first();
  if (exists) fail(409, 'Bu login band. Boshqasini tanlang.');

  const className = role === 'student' ? v.clean(data.className, 30) || null : null;
  if (className) {
    const klass = await c.env.DB.prepare(
      `SELECT id FROM school_classes WHERE school_id IS ? AND class_name = ?`,
    )
      .bind(me.school_id, className)
      .first();
    if (!klass) fail(422, 'Bunday sinf topilmadi.');
  }

  const { hash, salt, iterations: iter } = await hashPassword(password, iterations(c.env));

  const res = await c.env.DB.prepare(
    `INSERT INTO profiles (username, password_hash, password_salt, password_iter,
                           full_name, class_name, role, school_id, school_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(uname, hash, salt, iter, name, className, role, me.school_id, me.school_code)
    .run();

  return c.json(
    ok({
      id: Number(res.meta.last_row_id),
      username: uname,
      password,
      generated: !given,
      message:
        role === 'admin'
          ? `${name} admin sifatida qo‘shildi.`
          : `${name} o‘quvchi sifatida qo‘shildi.`,
    }),
    201,
  );
});

/** Rolni o'zgartirish — faqat owner. */
app.post('/users/:id/role', requireOwner, async (c) => {
  const me = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const role = v.oneOf(data.role, ['student', 'admin'] as const, 'Rol');

  if (id === me.id) fail(409, "O'z rolingizni o'zgartira olmaysiz.");

  const target = await c.env.DB.prepare(
    `SELECT id, full_name, role, school_id FROM profiles WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; full_name: string; role: string; school_id: number | null }>();

  if (!target) fail(404, 'Foydalanuvchi topilmadi.');
  if (target.school_id !== me.school_id) fail(403, 'Bu foydalanuvchi boshqa maktabdan.');
  if (target.role === 'owner') fail(409, "Owner rolini bu yerdan o'zgartirib bo'lmaydi.");
  if (target.role === role) fail(409, 'Rol allaqachon shunday.');

  await c.env.DB.prepare(`UPDATE profiles SET role = ? WHERE id = ?`).bind(role, id).run();

  // Rol pasaytirilsa, ochiq sessiyalar bekor qilinadi
  if (role === 'student') {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run();
  }

  return c.json(
    ok({
      message:
        role === 'admin'
          ? `${target.full_name} endi Eco Team a'zosi.`
          : `${target.full_name} oddiy o'quvchiga qaytarildi.`,
    }),
  );
});

/**
 * Parolni tiklash — faqat owner.
 * Vaqtinchalik parol bir marta qaytariladi va boshqa hech qayerda saqlanmaydi.
 */
app.post('/users/:id/reset-password', requireOwner, async (c) => {
  const me = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  const target = await c.env.DB.prepare(
    `SELECT id, full_name, username, school_id FROM profiles WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; full_name: string; username: string; school_id: number | null }>();

  if (!target) fail(404, 'Foydalanuvchi topilmadi.');
  if (target.school_id !== me.school_id) fail(403, 'Bu foydalanuvchi boshqa maktabdan.');

  // O'qib bo'ladigan, lekin taxmin qilib bo'lmaydigan parol
  const temporary = `eco${randomToken(4)}`;
  const { hash, salt, iterations: iter } = await hashPassword(temporary, iterations(c.env));

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE profiles SET password_hash = ?, password_salt = ?, password_iter = ? WHERE id = ?`,
    ).bind(hash, salt, iter, id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
  ]);

  return c.json(
    ok({
      username: target.username,
      password: temporary,
      message: `${target.full_name} uchun vaqtinchalik parol yaratildi.`,
    }),
  );
});

/** O'chirish — faqat owner. Sinov hisoblarini tozalash uchun. */
app.delete('/users/:id', requireOwner, async (c) => {
  const me = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  if (id === me.id) fail(409, "O'z hisobingizni o'chira olmaysiz.");

  const target = await c.env.DB.prepare(
    `SELECT id, full_name, role, school_id FROM profiles WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; full_name: string; role: string; school_id: number | null }>();

  if (!target) fail(404, 'Foydalanuvchi topilmadi.');
  if (target.school_id !== me.school_id) fail(403, 'Bu foydalanuvchi boshqa maktabdan.');
  if (target.role === 'owner') fail(409, "Owner hisobini o'chirib bo'lmaydi.");

  await c.env.DB.prepare(`DELETE FROM profiles WHERE id = ?`).bind(id).run();

  return c.json(ok({ message: `${target.full_name} o'chirildi.` }));
});

/** Panel uchun qisqa holat: nechta ariza kutmoqda. */
app.get('/admin/summary', requireAdmin, async (c) => {
  const me = c.get('user');

  const [challenges, recycling, research, users, tasks, marathons, news] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM challenge_submissions cs
         JOIN profiles p ON p.id = cs.student_id
        WHERE cs.status = 'pending' AND p.school_id IS ?`,
    ).bind(me.school_id),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM recycling_submissions
        WHERE status = 'pending' AND school_id IS ?`,
    ).bind(me.school_id),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM eco_research r
         JOIN profiles p ON p.id = r.student_id
        WHERE r.status = 'pending' AND p.school_id IS ?`,
    ).bind(me.school_id),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profiles WHERE school_id IS ?`).bind(me.school_id),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM challenges WHERE (school_id IS NULL OR school_id IS ?) AND archived_at IS NULL`,
    ).bind(me.school_id),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM marathons
        WHERE status = 'active' AND (school_id IS NULL OR school_id IS ?)`,
    ).bind(me.school_id),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM announcements
        WHERE pinned = 1 AND (school_id IS NULL OR school_id IS ?)`,
    ).bind(me.school_id),
  ]);

  const n = (res: D1Result) => Number((res.results?.[0] as { n?: number })?.n ?? 0);

  return c.json(
    ok({
      pending: {
        challenges: n(challenges),
        recycling: n(recycling),
        research: n(research),
      },
      users: n(users),
      challenges: n(tasks),
      marathons: n(marathons),
      announcements: n(news),
    }),
  );
});

export default app;
