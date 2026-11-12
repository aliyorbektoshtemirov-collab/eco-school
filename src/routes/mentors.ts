import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { requireAuth, requireOwner } from '../lib/auth';
import { isValidKey } from '../lib/images';

/**
 * Mentorlar.
 *
 * Owner mentorning rasmi va ma'lumotini yuklaydi. O'qish ochiq: sayt, telefon
 * ilovasi va Telegram bot bir xil ma'lumotni ko'rsatadi. Rasm ochiq beriladi —
 * Telegram uni o'zi yuklab olishi kerak, mentor surati esa maxfiy emas.
 */

export const MENTORS_INTRO =
  'Mentorlarimiz sizlarga 1 soatlik dars yoki ma’lumot berib, mavzuni tushuntirib beradi. ' +
  'Shundan keyin sizlar 2–3 soat ichida muammoga o‘zingiz yechim topishingiz kerak.';

export interface MentorRow {
  id: number;
  full_name: string;
  title: string | null;
  bio: string | null;
  photo_key: string | null;
}

export async function listMentors(env: Env): Promise<MentorRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, full_name, title, bio, photo_key FROM mentors
      ORDER BY sort_order, id`,
  ).all<MentorRow>();
  return results ?? [];
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Ro'yxat — kirmagan odam ham ko'ra oladi. */
app.get('/mentors', async (c) => {
  const rows = await listMentors(c.env);
  return c.json(
    ok({
      intro: MENTORS_INTRO,
      mentors: rows.map((m) => ({
        id: m.id,
        full_name: m.full_name,
        title: m.title,
        bio: m.bio,
        has_photo: Boolean(m.photo_key),
      })),
    }),
  );
});

/** Mentor rasmi. Yo'l `/files/` ni o'z ichiga oladi — kesh sarlavhasi saqlanadi. */
app.get('/mentors/files/:id', async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const row = await c.env.DB.prepare(`SELECT photo_key FROM mentors WHERE id = ?`)
    .bind(id)
    .first<{ photo_key: string | null }>();

  if (!row?.photo_key || !c.env.FILES) fail(404, 'Rasm topilmadi.');

  const object = await c.env.FILES.get(row.photo_key);
  if (!object) fail(404, 'Rasm topilmadi.');

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

async function input(c: { req: { raw: Request }; env: Env }) {
  const data = await v.body(c.req.raw);
  const fullName = v.str(data.fullName, 'Ism va familiya', { min: 3, max: 80 });
  const title = v.clean(data.title, 120) || null;
  const bio = v.str(data.bio, 'Ma’lumot', { min: 0, max: 1500, required: false }) || null;

  let photoKey: string | null = null;
  if (typeof data.photoKey === 'string' && data.photoKey) {
    if (!isValidKey(data.photoKey)) fail(422, 'Rasm noto‘g‘ri yuklangan. Qayta yuklang.');
    if (c.env.FILES && !(await c.env.FILES.head(data.photoKey))) {
      fail(422, 'Rasm topilmadi. Qayta yuklang.');
    }
    photoKey = data.photoKey;
  }

  return { fullName, title, bio, photoKey, keepPhoto: data.photoKey === undefined };
}

app.post('/admin/mentors', requireAuth, requireOwner, async (c) => {
  const m = await input(c);
  const res = await c.env.DB.prepare(
    `INSERT INTO mentors (full_name, title, bio, photo_key, sort_order)
     VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM mentors), 0))`,
  )
    .bind(m.fullName, m.title, m.bio, m.photoKey)
    .run();

  return c.json(ok({ id: Number(res.meta.last_row_id), message: 'Mentor qo‘shildi.' }), 201);
});

app.put('/admin/mentors/:id', requireAuth, requireOwner, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const m = await input(c);

  const exists = await c.env.DB.prepare(`SELECT id FROM mentors WHERE id = ?`).bind(id).first();
  if (!exists) fail(404, 'Mentor topilmadi.');

  // photoKey yuborilmasa, eski rasm o'zgarmaydi
  if (m.keepPhoto) {
    await c.env.DB.prepare(`UPDATE mentors SET full_name = ?, title = ?, bio = ? WHERE id = ?`)
      .bind(m.fullName, m.title, m.bio, id)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE mentors SET full_name = ?, title = ?, bio = ?, photo_key = ? WHERE id = ?`,
    )
      .bind(m.fullName, m.title, m.bio, m.photoKey, id)
      .run();
  }

  return c.json(ok({ message: 'Mentor yangilandi.' }));
});

app.delete('/admin/mentors/:id', requireAuth, requireOwner, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const row = await c.env.DB.prepare(`SELECT id, full_name FROM mentors WHERE id = ?`)
    .bind(id)
    .first<{ id: number; full_name: string }>();
  if (!row) fail(404, 'Mentor topilmadi.');

  await c.env.DB.prepare(`DELETE FROM mentors WHERE id = ?`).bind(id).run();
  return c.json(ok({ message: `${row.full_name} ro‘yxatdan olib tashlandi.` }));
});

export default app;
