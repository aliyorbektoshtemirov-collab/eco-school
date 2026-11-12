import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth, requireAdmin } from '../lib/auth';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { appButton, esc, notifyUser } from '../lib/telegram';
import { limit } from '../lib/ratelimit';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

type Submission = { student_id: number; school_id: number | null; title: string };
async function submission(env: Env, kind: string, id: number): Promise<Submission> {
  let row: Submission | null;
  if (kind === 'challenge') {
    row = await env.DB.prepare(
      'SELECT s.student_id, p.school_id, c.title FROM challenge_submissions s JOIN profiles p ON p.id = s.student_id JOIN challenges c ON c.id = s.challenge_id WHERE s.id = ?'
    ).bind(id).first<Submission>();
  } else if (kind === 'recycling') {
    row = await env.DB.prepare(
      "SELECT student_id, school_id, CASE material WHEN 'paper' THEN 'Qog‘oz topshirish' ELSE 'Plastik topshirish' END AS title FROM recycling_submissions WHERE id = ?"
    ).bind(id).first<Submission>();
  } else {
    fail(404, 'Topshiriq turi topilmadi.');
  }
  if (!row) fail(404, 'Topshiriq topilmadi.');
  return row;
}

app.get('/notifications', async (c) => {
  const user = c.get('user');
  const before = Number(c.req.query('before')) || Number.MAX_SAFE_INTEGER;
  const [items, count] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM submission_notifications WHERE recipient_id = ? AND id < ? ORDER BY id DESC LIMIT 50').bind(user.id, before),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM submission_notifications WHERE recipient_id = ? AND read_at IS NULL').bind(user.id),
  ]);
  return c.json(ok({ items: items.results ?? [], unread: Number((count.results?.[0] as { n: number })?.n ?? 0) }));
});

app.post('/notifications/:id/read', async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const result = await c.env.DB.prepare("UPDATE submission_notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND recipient_id = ?")
    .bind(id, c.get('user').id).run();
  if (!result.meta.changes) fail(404, 'Bildirishnoma topilmadi.');
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM submission_notifications WHERE recipient_id = ? AND read_at IS NULL').bind(c.get('user').id).first<{ n: number }>();
  return c.json(ok({ unread: count?.n ?? 0 }));
});

app.get('/feedback/:kind/:id', async (c) => {
  const user = c.get('user');
  const kind = c.req.param('kind');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const row = await submission(c.env, kind, id);
  const admin = user.role === 'admin' || user.role === 'owner';
  if (row.student_id !== user.id && !(admin && row.school_id === user.school_id)) fail(403, 'Bu javoblarni ko‘rishga ruxsat yo‘q.');
  const { results } = await c.env.DB.prepare(
    'SELECT id, sender_name, message, created_at FROM submission_notifications WHERE submission_type = ? AND submission_id = ? AND recipient_id = ? ORDER BY id'
  ).bind(kind, id, row.student_id).all();
  return c.json(ok({ title: row.title, items: results ?? [] }));
});

app.post('/feedback/:kind/:id', requireAdmin, async (c) => {
  const admin = c.get('user');
  const kind = c.req.param('kind');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const row = await submission(c.env, kind, id);
  if (row.school_id !== admin.school_id) fail(403, 'Bu topshiriq boshqa maktabniki.');
  const data = await v.body(c.req.raw);
  if (typeof data.message === 'string' && data.message.trim().length > 2000) fail(422, 'Javob 2000 belgidan oshmasin.');
  const message = v.str(data.message, 'Javob', { min: 1, max: 2000 });
  await limit(c.env, `feedback:${admin.id}`, 60, 3600, 'Bir soatda juda ko‘p javob yubordingiz.');
  const name = admin.full_name || admin.username;
  await c.env.DB.prepare(
    'INSERT INTO submission_notifications(recipient_id, sender_id, sender_name, submission_type, submission_id, title, message) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(row.student_id, admin.id, name, kind, id, row.title, message).run();
  const excerpt = Array.from(message).length > 350 ? Array.from(message).slice(0, 350).join('') + '… (to‘liq javob bildirishnomalarda)' : message;
  c.executionCtx.waitUntil(notifyUser(c.env, row.student_id,
    `💬 <b>Admin javobi</b>

<b>Topshiriq:</b> ${esc(row.title)}
<b>Admin:</b> ${esc(name)}

${esc(excerpt)}

Sayt yoki ilovadagi «Bildirishnomalar» bo‘limida ham ko‘rinadi.`
    , { buttons: appButton(c.env.SITE_URL || new URL(c.req.url).origin, '🔔 Javobni ochish', '/notifications') }
  ));
  return c.json(ok({ message: 'Javob yuborildi.' }), 201);
});

export default app;
