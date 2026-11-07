import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { addPoints, requireAdmin, requireAuth } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { notifyUser } from '../lib/telegram';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

function pointsPerKg(env: Env): number {
  const n = Number(env.POINTS_PER_KG);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/** O'quvchining o'z topshiriqlari. */
app.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT id, material, amount_kg, verified_amount_kg, status, awarded_points,
            proof_image, submitted_at
       FROM recycling_submissions
      WHERE student_id = ?
      ORDER BY submitted_at DESC`,
  )
    .bind(user.id)
    .all();

  return c.json(ok({ submissions: results ?? [] }));
});

/** Yangi topshiruv. */
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user.school_id) fail(422, 'Profilingizga maktab biriktirilmagan.');

  await limit(c.env, `recycling:${user.id}`, 20, 3600, "Bir soatda juda ko'p topshiruv yubordingiz.");

  const data = await v.body(c.req.raw);
  const material = v.oneOf(data.material, ['paper', 'plastic'] as const, 'Chiqindi turi');
  const amount = v.num(data.amountKg, 'Vazn', { min: 0.01, max: 1000 });
  const proofImage = v.clean(data.proofImage, 120) || null;

  if (!proofImage) fail(422, 'Iltimos, tarozi rasmini yuklang.');

  await c.env.DB.prepare(
    `INSERT INTO recycling_submissions (school_id, student_id, material, amount_kg, proof_image)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(user.school_id, user.id, material, Math.round(amount * 100) / 100, proofImage)
    .run();

  return c.json(ok({ message: "Topshirig'ingiz yuborildi! Eco Team tasdiqlashini kuting." }), 201);
});

// ================================================================== Eco Team
app.get('/admin/list', requireAdmin, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT rs.id, rs.school_id, rs.student_id, rs.material, rs.amount_kg,
            rs.verified_amount_kg, rs.status, rs.awarded_points, rs.proof_image,
            rs.submitted_at, p.full_name, p.class_name
       FROM recycling_submissions rs
       JOIN profiles p ON p.id = rs.student_id
      WHERE rs.school_id = ?
      ORDER BY rs.submitted_at DESC
      LIMIT 200`,
  )
    .bind(user.school_id)
    .all();

  return c.json(ok({ items: results ?? [] }));
});

/** Tasdiqlash: ball Eco Team kiritgan haqiqiy vazn asosida hisoblanadi. */
app.post('/admin/:id/review', requireAdmin, async (c) => {
  const admin = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const status = v.oneOf(data.status, ['approved', 'rejected'] as const, 'Holat');

  const row = await c.env.DB.prepare(
    `SELECT id, student_id, status FROM recycling_submissions WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; student_id: number; status: string }>();

  if (!row) fail(404, 'Topshiruv topilmadi.');
  if (row.status !== 'pending') fail(409, "Topshiruv allaqachon ko'rib chiqilgan.");

  if (status === 'rejected') {
    await c.env.DB.prepare(
      `UPDATE recycling_submissions SET status = 'rejected', reviewed_by = ?
        WHERE id = ? AND status = 'pending'`,
    )
      .bind(admin.id, id)
      .run();

    c.executionCtx.waitUntil(
      notifyUser(c.env, row.student_id, '❌ Recycling topshirig\'ingiz rad etildi.'),
    );

    return c.json(ok({ message: 'Topshiruv rad etildi.' }));
  }

  const verified = v.num(data.verifiedAmountKg, 'Haqiqiy vazn', { min: 0.01, max: 1000 });
  const points = Math.round(verified * pointsPerKg(c.env));

  await c.env.DB.prepare(
    `UPDATE recycling_submissions
        SET status = 'approved', verified_amount_kg = ?, awarded_points = ?, reviewed_by = ?
      WHERE id = ? AND status = 'pending'`,
  )
    .bind(Math.round(verified * 100) / 100, points, admin.id, id)
    .run();

  await addPoints(c.env, row.student_id, points);

  c.executionCtx.waitUntil(
    notifyUser(
      c.env,
      row.student_id,
      `♻️ Recycling topshirig'ingiz tasdiqlandi!\n\n` +
        `Tasdiqlangan vazn: <b>${Math.round(verified * 100) / 100} kg</b>\n` +
        `+${points} ball qo'shildi.`,
    ),
  );

  return c.json(ok({ message: 'Topshiruv tasdiqlandi. Ball haqiqiy vazn asosida berildi.' }));
});

export default app;
