import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { addPoints, requireAdmin, requireAuth } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { esc, notifyUser } from '../lib/telegram';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

/**
 * Tadqiqotlar ro'yxati.
 * O'quvchi: nashr qilinganlar + o'zining ishlari.
 * Admin: hammasi, muallif ismi bilan.
 */
app.get('/', async (c) => {
  const user = c.get('user');
  const isAdmin = user.role === 'admin' || user.role === 'owner';

  const sql = isAdmin
    ? `SELECT r.*, p.full_name, p.class_name
         FROM eco_research r JOIN profiles p ON p.id = r.student_id
        ORDER BY r.submitted_at DESC LIMIT 200`
    : `SELECT r.id, r.student_id, r.title, r.summary, r.content, r.sources,
              r.status, r.awarded_points, r.reviewer_feedback, r.submitted_at,
              NULL AS full_name, NULL AS class_name
         FROM eco_research r
        WHERE r.status = 'published' OR r.student_id = ?1
        ORDER BY r.submitted_at DESC LIMIT 200`;

  const stmt = isAdmin ? c.env.DB.prepare(sql) : c.env.DB.prepare(sql).bind(user.id);
  const { results } = await stmt.all();

  return c.json(ok({ research: results ?? [], isAdmin }));
});

/** Yangi tadqiqot — tekshiruvga. */
app.post('/', async (c) => {
  const user = c.get('user');
  await limit(c.env, `research:${user.id}`, 5, 86400, "Kuniga 5 tadan ortiq tadqiqot yuborib bo'lmaydi.");

  const data = await v.body(c.req.raw);
  const title = v.clean(data.title, 200);
  const summary = v.clean(data.summary, 1000);
  const content = v.clean(data.content, 20000);
  const sources = v.clean(data.sources, 2000) || null;

  // Asl saytdagi aynan shu shartlar
  if (title.length < 5 || summary.length < 20 || content.length < 100) {
    fail(
      422,
      "Sarlavha kamida 5, qisqacha mazmun 20, tadqiqot matni esa 100 ta belgidan iborat bo'lishi kerak.",
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO eco_research (student_id, title, summary, content, sources)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(user.id, title, summary, content, sources)
    .run();

  return c.json(ok({ message: 'Tadqiqotingiz tekshiruvga yuborildi!' }), 201);
});

/** Baholash: 0–40 ball. */
app.post('/:id/review', requireAdmin, async (c) => {
  const admin = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const status = v.oneOf(data.status, ['published', 'rejected'] as const, 'Holat');
  const feedback = v.clean(data.feedback, 1000) || null;

  const row = await c.env.DB.prepare(
    `SELECT id, student_id, status, title FROM eco_research WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; student_id: number; status: string; title: string }>();

  if (!row) fail(404, 'Tadqiqot topilmadi.');
  if (row.status !== 'pending') fail(409, "Tadqiqot allaqachon ko'rib chiqilgan.");

  const points =
    status === 'published' ? Math.max(0, Math.min(40, Math.round(Number(data.points) || 0))) : 0;

  await c.env.DB.prepare(
    `UPDATE eco_research
        SET status = ?, awarded_points = ?, reviewer_feedback = ?, reviewed_by = ?
      WHERE id = ? AND status = 'pending'`,
  )
    .bind(status, points, feedback, admin.id, id)
    .run();

  await addPoints(c.env, row.student_id, points);

  c.executionCtx.waitUntil(
    notifyUser(
      c.env,
      row.student_id,
      status === 'published'
        ? `📚 <b>${esc(row.title)}</b> tadqiqotingiz nashr qilindi!\n\n+${points} ball qo'shildi.`
        : `❌ <b>${esc(row.title)}</b> tadqiqotingiz nashr uchun qabul qilinmadi.`,
    ),
  );

  return c.json(
    ok({
      message:
        status === 'published'
          ? 'Tadqiqot nashr qilindi va ball berildi!'
          : 'Tadqiqot rad etildi.',
    }),
  );
});

export default app;
