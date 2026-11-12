import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { addPoints, requireAdmin, requireAuth } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { esc, notifyUser } from '../lib/telegram';
import { announceChallenge } from '../lib/reminders';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
// Guest preview contains shared tasks only; signed-in Home uses the school-scoped list.
app.get('/preview', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, description, category, points, end_date FROM challenges WHERE school_id IS NULL AND archived_at IS NULL ORDER BY created_at, id LIMIT 3'
  ).all();
  return c.json(ok({ challenges: results ?? [] }));
});
app.use('*', requireAuth);

/** Challenge'lar va joriy o'quvchining topshiriqlari. */
app.get('/', async (c) => {
  const user = c.get('user');

  const [challenges, submissions] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, title, description, category, points, end_date
         FROM challenges
        WHERE (school_id IS NULL OR school_id = ?) AND archived_at IS NULL
        ORDER BY created_at, id`,
    ).bind(user.school_id),
    c.env.DB.prepare(
      `SELECT id, challenge_id, proof_text, status
         FROM challenge_submissions WHERE student_id = ?`,
    ).bind(user.id),
  ]);

  return c.json(
    ok({ challenges: challenges.results ?? [], submissions: submissions.results ?? [] }),
  );
});

/** Topshiriq yuborish. */
app.post('/:id/submit', async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  await limit(c.env, `submit:${user.id}`, 20, 3600, "Bir soatda juda ko'p hisobot yubordingiz.");

  const challenge = await c.env.DB.prepare(`SELECT id FROM challenges WHERE id = ? AND archived_at IS NULL`)
    .bind(id)
    .first();
  if (!challenge) fail(404, 'Challenge topilmadi.');

  const already = await c.env.DB.prepare(
    `SELECT id FROM challenge_submissions WHERE student_id = ? AND challenge_id = ?`,
  )
    .bind(user.id, id)
    .first();
  if (already) fail(409, "Bu challenge bo'yicha topshiriq allaqachon yuborilgan.");

  const data = await v.body(c.req.raw);
  const proofText = v.str(data.proofText, 'Izoh', { min: 0, max: 2000, required: false });
  const proofUrl = v.clean(data.proofUrl, 120) || null;

  if (!proofText && !proofUrl) fail(422, "Iltimos, izoh yoki rasm qo'shing.");

  await c.env.DB.prepare(
    `INSERT INTO challenge_submissions (challenge_id, student_id, proof_text, proof_url)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(id, user.id, proofText || null, proofUrl)
    .run();

  return c.json(ok({ message: "Topshirig'ingiz yuborildi! Tekshiruvdan so'ng natija chiqadi." }), 201);
});

// ====================================================== vazifalarni boshqarish

/** Admin uchun to'liq ro'yxat: nechta topshiriq kelganini ham ko'rsatadi. */
app.get('/admin/challenges', requireAdmin, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.title, c.description, c.category, c.points, c.end_date,
            c.school_id, c.created_at,
            (SELECT COUNT(*) FROM challenge_submissions s WHERE s.challenge_id = c.id)
              AS submissions
       FROM challenges c
      WHERE (c.school_id IS NULL OR c.school_id = ?) AND c.archived_at IS NULL
      ORDER BY c.created_at DESC, c.id DESC`,
  )
    .bind(user.school_id)
    .all();

  return c.json(ok({ challenges: results ?? [] }));
});

function challengeInput(data: Record<string, unknown>) {
  const title = v.str(data.title, 'Sarlavha', { min: 3, max: 120 });
  const description = v.str(data.description, 'Tavsif', { min: 0, max: 1000, required: false });
  const category = (v.clean(data.category, 30) || 'UMUMIY').toUpperCase();
  const points = v.num(data.points, 'Ball', { min: 1, max: 500 });

  // Sana ixtiyoriy, lekin berilsa YYYY-MM-DD ko'rinishida bo'lsin
  const endDate = v.clean(data.endDate, 10) || null;
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    fail(422, 'Tugash sanasi YYYY-MM-DD ko‘rinishida bo‘lsin.');
  }

  return { title, description: description || '', category, points: Math.round(points), endDate };
}

/** Yangi vazifa. Qo'shilgach, botga ulangan o'quvchilarga xabar ketadi. */
app.post('/admin/challenges', requireAdmin, async (c) => {
  const user = c.get('user');
  const data = await v.body(c.req.raw);
  const input = challengeInput(data);

  const res = await c.env.DB.prepare(
    `INSERT INTO challenges (title, description, category, points, end_date, school_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(input.title, input.description, input.category, input.points, input.endDate, user.school_id)
    .run();

  const id = Number(res.meta.last_row_id);

  // Xabar yuborish javobni kutib turmaydi
  c.executionCtx.waitUntil(
    announceChallenge(c.env, {
      id,
      title: input.title,
      description: input.description,
      category: input.category,
      points: input.points,
      end_date: input.endDate,
      school_id: user.school_id,
    }).catch((err) => console.error('announceChallenge failed:', err)),
  );

  return c.json(ok({ id, message: 'Vazifa qo‘shildi va o‘quvchilarga xabar berildi.' }), 201);
});

/** Tahrirlash. Xabar qayta yuborilmaydi. */
app.put('/admin/challenges/:id', requireAdmin, async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const input = challengeInput(data);

  const row = await c.env.DB.prepare(`SELECT id, school_id FROM challenges WHERE id = ?`)
    .bind(id)
    .first<{ id: number; school_id: number | null }>();

  if (!row) fail(404, 'Vazifa topilmadi.');
  if (row.school_id !== null && row.school_id !== user.school_id) {
    fail(403, 'Bu vazifa boshqa maktabniki.');
  }

  await c.env.DB.prepare(
    `UPDATE challenges
        SET title = ?, description = ?, category = ?, points = ?, end_date = ?
      WHERE id = ?`,
  )
    .bind(input.title, input.description, input.category, input.points, input.endDate, id)
    .run();

  return c.json(ok({ message: 'Vazifa yangilandi.' }));
});

/** O'chirish. Topshiriqlari bo'lsa arxivlanadi — ballar yo'qolmasin. */
app.delete('/admin/challenges/:id', requireAdmin, async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  const row = await c.env.DB.prepare(
    `SELECT c.id, c.school_id, c.title,
            (SELECT COUNT(*) FROM challenge_submissions s WHERE s.challenge_id = c.id) AS n
       FROM challenges c WHERE c.id = ?`,
  )
    .bind(id)
    .first<{ id: number; school_id: number | null; title: string; n: number }>();

  if (!row) fail(404, 'Vazifa topilmadi.');
  if (row.school_id !== null && row.school_id !== user.school_id) {
    fail(403, 'Bu vazifa boshqa maktabniki.');
  }
  // Topshiriqlari bo'lsa o'chirmaymiz, arxivlaymiz: ballar saqlanadi,
  // lekin vazifa o'quvchilar, bot va sayt ro'yxatidan yo'qoladi.
  if (row.n > 0) {
    await c.env.DB.prepare(`UPDATE challenges SET archived_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();
    return c.json(ok({ archived: true, message: `«${row.title}» ro‘yxatdan olib tashlandi.` }));
  }

  await c.env.DB.prepare(`DELETE FROM challenges WHERE id = ?`).bind(id).run();
  return c.json(ok({ message: `«${row.title}» o‘chirildi.` }));
});

// ================================================================== admin
app.get('/admin/list', requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT cs.id, cs.challenge_id, cs.student_id, cs.proof_text, cs.proof_url,
            cs.status, cs.awarded_points, cs.submitted_at,
            c.title AS challenge_title, c.points AS challenge_points,
            p.full_name, p.class_name
       FROM challenge_submissions cs
       JOIN challenges c ON c.id = cs.challenge_id
       JOIN profiles p ON p.id = cs.student_id
      WHERE p.school_id IS ?
      ORDER BY cs.submitted_at DESC
      LIMIT 200`,
  ).bind(c.get('user').school_id).all();

  return c.json(ok({ items: results ?? [] }));
});

/** Tasdiqlash yoki rad etish. Ball challenge'ning o'z ballidan olinadi. */
app.post('/admin/:id/review', requireAdmin, async (c) => {
  const admin = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const status = v.oneOf(data.status, ['approved', 'rejected'] as const, 'Holat');

  const row = await c.env.DB.prepare(
    `SELECT cs.id, cs.student_id, cs.status, c.points, c.title
       FROM challenge_submissions cs JOIN challenges c ON c.id = cs.challenge_id
       JOIN profiles student ON student.id = cs.student_id
      WHERE cs.id = ? AND student.school_id IS ?`,
  )
    .bind(id, admin.school_id)
    .first<{ id: number; student_id: number; status: string; points: number; title: string }>();

  if (!row) fail(404, 'Topshiriq topilmadi.');
  if (row.status !== 'pending') fail(409, "Topshiriq allaqachon ko'rib chiqilgan.");

  const points = status === 'approved' ? row.points : 0;

  await c.env.DB.prepare(
    `UPDATE challenge_submissions
        SET status = ?, awarded_points = ?, reviewed_by = ?
      WHERE id = ? AND status = 'pending'`,
  )
    .bind(status, points, admin.id, id)
    .run();

  await addPoints(c.env, row.student_id, points);

  // Telegram xabari — bot sozlanmagan bo'lsa jimgina o'tkazib yuboriladi
  c.executionCtx.waitUntil(
    notifyUser(
      c.env,
      row.student_id,
      status === 'approved'
        ? `✅ <b>${esc(row.title)}</b> topshirig'ingiz tasdiqlandi!\n\n+${points} ball qo'shildi.`
        : `❌ <b>${esc(row.title)}</b> topshirig'ingiz rad etildi.\n\nSaytdan sababini ko'rishingiz mumkin.`,
    ),
  );

  return c.json(
    ok({
      message:
        status === 'approved'
          ? "Topshiriq tasdiqlandi. Ballar qo'shildi."
          : 'Topshiriq rad etildi.',
    }),
  );
});

export default app;
