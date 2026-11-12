import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { requireAdmin, requireAuth } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { notifyUser } from '../lib/telegram';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

function defaultRate(env: Env): number {
  const n = Number(env.POINTS_PER_KG);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

async function schoolRates(env: Env, schoolId: number | null) {
  const row = await env.DB.prepare('SELECT paper_points_per_kg, plastic_points_per_kg FROM schools WHERE id = ?')
    .bind(schoolId).first<{ paper_points_per_kg: number | null; plastic_points_per_kg: number | null }>();
  return { paper: row?.paper_points_per_kg ?? defaultRate(env), plastic: row?.plastic_points_per_kg ?? defaultRate(env) };
}

app.get('/rates', async (c) => c.json(ok({ rates: await schoolRates(c.env, c.get('user').school_id) })));

app.put('/admin/rates', requireAdmin, async (c) => {
  const user = c.get('user');
  if (!user.school_id) fail(422, 'Hisobingizga maktab biriktirilmagan.');
  const data = await v.body(c.req.raw);
  const paper = v.num(data.paper, 'Qog‘oz uchun ball', { min: 1, max: 10000 });
  const plastic = v.num(data.plastic, 'Plastik uchun ball', { min: 1, max: 10000 });
  if (!Number.isInteger(paper) || !Number.isInteger(plastic)) fail(422, 'Ball butun son bo‘lsin.');
  await c.env.DB.prepare('UPDATE schools SET paper_points_per_kg = ?, plastic_points_per_kg = ? WHERE id = ?')
    .bind(paper, plastic, user.school_id).run();
  return c.json(ok({ rates: { paper, plastic }, message: 'Yangi ball saqlandi. Keyingi tasdiqlashlarda qo‘llanadi.' }));
});

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

  return c.json(ok({ submissions: results ?? [], rates: await schoolRates(c.env, user.school_id) }));
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
    `SELECT id, student_id, status, school_id, material FROM recycling_submissions WHERE id = ? AND school_id = ?`,
  )
    .bind(id, admin.school_id)
    .first<{ id: number; student_id: number; status: string; school_id: number; material: 'paper' | 'plastic' }>();

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
  const rates = await schoolRates(c.env, row.school_id);
  const weight = Math.round(verified * 100) / 100;
  const points = Math.round(weight * rates[row.material]);
  const [, updated] = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE profiles SET points = points + ? WHERE id = ? AND EXISTS (SELECT 1 FROM recycling_submissions WHERE id = ? AND status = 'pending')"
    ).bind(points, row.student_id, id),
    c.env.DB.prepare(
      "UPDATE recycling_submissions SET status = 'approved', verified_amount_kg = ?, awarded_points = ?, reviewed_by = ? WHERE id = ? AND status = 'pending'"
    ).bind(weight, points, admin.id, id),
  ]);
  if (updated.meta.changes !== 1) fail(409, 'Topshiruv allaqachon ko‘rib chiqilgan.');

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
