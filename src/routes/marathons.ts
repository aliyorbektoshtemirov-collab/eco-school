import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { addPoints, requireAdmin, requireAuth } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { dayNumber, streak, todayLocal } from '../lib/marathon';
import { announceMarathon, notifyCheckin } from '../lib/marathonBot';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

/* ============================================================ o'quvchi */

/** Faol marafonlar: qo'shilganmi, bugun nechanchi kun, qaysi kunlar bajarilgan. */
app.get('/marathons', async (c) => {
  const user = c.get('user');
  const today = await todayLocal(c.env);

  const { results: rows } = await c.env.DB.prepare(
    `SELECT m.*,
            (SELECT COUNT(*) FROM marathon_participants p WHERE p.marathon_id = m.id)
              AS participants,
            EXISTS (SELECT 1 FROM marathon_participants p
                     WHERE p.marathon_id = m.id AND p.student_id = ?1) AS joined
       FROM marathons m
      WHERE (m.school_id IS NULL OR m.school_id = ?2)
      ORDER BY m.status, m.start_date DESC, m.id DESC
      LIMIT 20`,
  )
    .bind(user.id, user.school_id)
    .all<Record<string, number | string | null>>();

  const marathons = [];

  for (const row of rows ?? []) {
    const m = row as unknown as {
      id: number;
      title: string;
      description: string;
      days: number;
      points_per_day: number;
      bonus_points: number;
      start_date: string;
      status: string;
      participants: number;
      joined: number;
    };

    const { results: checkins } = await c.env.DB.prepare(
      `SELECT day_number, created_at FROM marathon_checkins
        WHERE marathon_id = ? AND student_id = ? ORDER BY day_number`,
    )
      .bind(m.id, user.id)
      .all<{ day_number: number; created_at: string }>();

    const { results: days } = await c.env.DB.prepare(
      `SELECT day_number, title FROM marathon_days
        WHERE marathon_id = ? ORDER BY day_number`,
    )
      .bind(m.id)
      .all<{ day_number: number; title: string }>();

    marathons.push({
      ...m,
      joined: Boolean(m.joined),
      today: dayNumber(m, today),
      checkins: (checkins ?? []).map((row2) => row2.day_number),
      dayTasks: days ?? [],
    });
  }

  return c.json(ok({ marathons, today }));
});

/** Qo'shilish. */
app.post('/marathons/:id/join', async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  const m = await c.env.DB.prepare(
    `SELECT id, title, status, school_id FROM marathons WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; title: string; status: string; school_id: number | null }>();

  if (!m) fail(404, 'Marafon topilmadi.');
  if (m.status !== 'active') fail(409, 'Bu marafon tugagan.');
  if (m.school_id !== null && m.school_id !== user.school_id) {
    fail(403, 'Bu marafon boshqa maktabniki.');
  }

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO marathon_participants (marathon_id, student_id) VALUES (?, ?)`,
  )
    .bind(id, user.id)
    .run();

  return c.json(ok({ message: `«${m.title}» marafoniga qo‘shildingiz!` }));
});

/** Chiqish — belgilangan kunlar va ballar saqlanib qoladi. */
app.post('/marathons/:id/leave', async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  await c.env.DB.prepare(
    `DELETE FROM marathon_participants WHERE marathon_id = ? AND student_id = ?`,
  )
    .bind(id, user.id)
    .run();

  return c.json(ok({ message: 'Marafondan chiqdingiz.' }));
});

/**
 * Kunni belgilash.
 *
 * Tasdiqlash so'ralmaydi: 30 kun × yuzlab o'quvchi — hech bir Eco Team
 * buni ko'rib chiqa olmaydi. Ball darhol beriladi, admin esa panelda
 * kim nima qilganini ko'rib turadi.
 */
app.post('/marathons/:id/checkin', async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  await limit(c.env, `mcheck:${user.id}`, 40, 3600, "Juda ko'p urinish. Birozdan keyin qayting.");

  const data = await v.body(c.req.raw);
  const note = v.str(data.note, 'Izoh', { min: 0, max: 500, required: false });
  const photo = v.clean(data.photo, 120) || null;

  const result = await checkin(c.env, id, user.id, Number(data.day), note || null, photo, 'web');
  return c.json(ok(result));
});

/**
 * Belgilashning umumiy mantig'i — sayt ham, bot ham shuni ishlatadi.
 * Shuning uchun qoidalar bitta joyda turadi.
 */
export async function checkin(
  env: Env,
  marathonId: number,
  studentId: number,
  day: number,
  note: string | null,
  photo: string | null,
  source: 'web' | 'bot',
): Promise<{ message: string; points: number; day: number; streak: number; finished: boolean }> {
  const m = await env.DB.prepare(
    `SELECT id, title, days, points_per_day, bonus_points, start_date, status
       FROM marathons WHERE id = ?`,
  )
    .bind(marathonId)
    .first<{
      id: number;
      title: string;
      days: number;
      points_per_day: number;
      bonus_points: number;
      start_date: string;
      status: string;
    }>();

  if (!m) fail(404, 'Marafon topilmadi.');

  const joined = await env.DB.prepare(
    `SELECT id FROM marathon_participants WHERE marathon_id = ? AND student_id = ?`,
  )
    .bind(marathonId, studentId)
    .first();

  if (!joined) fail(409, 'Avval marafonga qo‘shiling.');

  const today = await todayLocal(env);
  const current = dayNumber(m, today);

  if (current < 1) fail(409, 'Marafon hali boshlanmagan.');

  // Faqat bugungi yoki kechagi kunni belgilash mumkin — orqaga qarab
  // hammasini birdan to'ldirib qo'yishning oldini oladi.
  const target = Number.isFinite(day) && day > 0 ? Math.round(day) : Math.min(current, m.days);

  if (target > m.days) fail(409, 'Marafon tugagan.');
  if (target > current) fail(409, 'Bu kun hali kelmadi.');
  if (current - target > 1) fail(409, 'Faqat bugungi yoki kechagi kunni belgilash mumkin.');

  const already = await env.DB.prepare(
    `SELECT id FROM marathon_checkins
      WHERE marathon_id = ? AND student_id = ? AND day_number = ?`,
  )
    .bind(marathonId, studentId, target)
    .first();

  if (already) fail(409, 'Bu kun allaqachon belgilangan.');

  let points = m.points_per_day;

  await env.DB.prepare(
    `INSERT INTO marathon_checkins
       (marathon_id, student_id, day_number, note, photo, awarded_points, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(marathonId, studentId, target, note, photo, points, source)
    .run();

  // Hamma kun bajarilganmi — bonus
  const done = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM marathon_checkins WHERE marathon_id = ? AND student_id = ?`,
  )
    .bind(marathonId, studentId)
    .first<{ n: number }>();

  const finished = Number(done?.n ?? 0) >= m.days;

  if (finished && m.bonus_points > 0) {
    points += m.bonus_points;
    await env.DB.prepare(
      `UPDATE marathon_checkins SET awarded_points = ?
        WHERE marathon_id = ? AND student_id = ? AND day_number = ?`,
    )
      .bind(points, marathonId, studentId, target)
      .run();
  }

  await addPoints(env, studentId, points);

  const row = await streak(env, marathonId, studentId, target);

  return {
    message: finished
      ? `Marafon tugadi! Barcha ${m.days} kun bajarildi. +${points} ball`
      : `${target}-kun belgilandi. +${points} ball`,
    points,
    day: target,
    streak: row,
    finished,
  };
}

/* ============================================================== admin */

app.get('/admin/marathons', requireAdmin, async (c) => {
  const user = c.get('user');
  const today = await todayLocal(c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT m.*,
            (SELECT COUNT(*) FROM marathon_participants p WHERE p.marathon_id = m.id)
              AS participants,
            (SELECT COUNT(*) FROM marathon_checkins k WHERE k.marathon_id = m.id)
              AS checkins
       FROM marathons m
      WHERE m.school_id IS NULL OR m.school_id = ?
      ORDER BY m.status, m.start_date DESC, m.id DESC`,
  )
    .bind(user.school_id)
    .all<Record<string, never>>();

  const marathons = (results ?? []).map((row) => {
    const m = row as unknown as { start_date: string; days: number };
    return { ...row, today: dayNumber(m, today) };
  });

  return c.json(ok({ marathons, today }));
});

function marathonInput(data: Record<string, unknown>) {
  const title = v.str(data.title, 'Sarlavha', { min: 3, max: 120 });
  const description = v.str(data.description, 'Tavsif', { min: 0, max: 1000, required: false });
  const days = v.num(data.days, 'Kunlar soni', { min: 2, max: 100 });
  const pointsPerDay = v.num(data.pointsPerDay, 'Kunlik ball', { min: 1, max: 100 });
  const bonus = Math.max(0, Math.min(1000, Math.round(Number(data.bonusPoints) || 0)));

  const startDate = v.clean(data.startDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    fail(422, 'Boshlanish sanasi YYYY-MM-DD ko‘rinishida bo‘lsin.');
  }

  // Har kunning vazifasi: har qatorda bitta
  const raw = typeof data.dayTasks === 'string' ? data.dayTasks : '';
  const dayTasks = raw
    .split('\n')
    .map((line) => line.trim().slice(0, 200))
    .filter(Boolean);

  return {
    title,
    description: description || '',
    days: Math.round(days),
    pointsPerDay: Math.round(pointsPerDay),
    bonus,
    startDate,
    dayTasks,
  };
}

async function replaceDays(env: Env, marathonId: number, tasks: string[]) {
  await env.DB.prepare(`DELETE FROM marathon_days WHERE marathon_id = ?`).bind(marathonId).run();
  if (tasks.length === 0) return;

  const statements = tasks.map((title, index) =>
    env.DB.prepare(
      `INSERT INTO marathon_days (marathon_id, day_number, title) VALUES (?, ?, ?)`,
    ).bind(marathonId, index + 1, title),
  );

  // D1 bir martada 100 tagacha amalni bemalol ko'taradi
  for (let i = 0; i < statements.length; i += 50) {
    await env.DB.batch(statements.slice(i, i + 50));
  }
}

app.post('/admin/marathons', requireAdmin, async (c) => {
  const user = c.get('user');
  const data = await v.body(c.req.raw);
  const input = marathonInput(data);

  const res = await c.env.DB.prepare(
    `INSERT INTO marathons
       (school_id, title, description, days, points_per_day, bonus_points,
        start_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      user.school_id,
      input.title,
      input.description,
      input.days,
      input.pointsPerDay,
      input.bonus,
      input.startDate,
      user.id,
    )
    .run();

  const id = Number(res.meta.last_row_id);
  await replaceDays(c.env, id, input.dayTasks);

  c.executionCtx.waitUntil(
    announceMarathon(c.env, id).catch((err) => console.error('announceMarathon failed:', err)),
  );

  return c.json(
    ok({ id, message: 'Marafon e’lon qilindi va o‘quvchilarga xabar berildi.' }),
    201,
  );
});

app.put('/admin/marathons/:id', requireAdmin, async (c) => {
  const user = c.get('user');
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const input = marathonInput(data);

  const row = await c.env.DB.prepare(`SELECT id, school_id FROM marathons WHERE id = ?`)
    .bind(id)
    .first<{ id: number; school_id: number | null }>();

  if (!row) fail(404, 'Marafon topilmadi.');
  if (row.school_id !== null && row.school_id !== user.school_id) fail(403, 'Ruxsat yo‘q.');

  await c.env.DB.prepare(
    `UPDATE marathons
        SET title = ?, description = ?, days = ?, points_per_day = ?,
            bonus_points = ?, start_date = ?
      WHERE id = ?`,
  )
    .bind(
      input.title,
      input.description,
      input.days,
      input.pointsPerDay,
      input.bonus,
      input.startDate,
      id,
    )
    .run();

  await replaceDays(c.env, id, input.dayTasks);

  return c.json(ok({ message: 'Marafon yangilandi.' }));
});

/** Kunlar matnini tahrirlash uchun qaytarish. */
app.get('/admin/marathons/:id', requireAdmin, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  const m = await c.env.DB.prepare(`SELECT * FROM marathons WHERE id = ?`).bind(id).first();
  if (!m) fail(404, 'Marafon topilmadi.');

  const { results: days } = await c.env.DB.prepare(
    `SELECT day_number, title FROM marathon_days WHERE marathon_id = ? ORDER BY day_number`,
  )
    .bind(id)
    .all<{ day_number: number; title: string }>();

  const { results: top } = await c.env.DB.prepare(
    `SELECT p.full_name, p.class_name, COUNT(k.id) AS done
       FROM marathon_participants mp
       JOIN profiles p ON p.id = mp.student_id
       LEFT JOIN marathon_checkins k
              ON k.marathon_id = mp.marathon_id AND k.student_id = mp.student_id
      WHERE mp.marathon_id = ?
      GROUP BY mp.student_id
      ORDER BY done DESC, p.full_name
      LIMIT 50`,
  )
    .bind(id)
    .all();

  return c.json(ok({ marathon: m, days: days ?? [], participants: top ?? [] }));
});

app.post('/admin/marathons/:id/finish', requireAdmin, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  await c.env.DB.prepare(`UPDATE marathons SET status = 'finished' WHERE id = ?`).bind(id).run();
  return c.json(ok({ message: 'Marafon yakunlandi.' }));
});

app.delete('/admin/marathons/:id', requireAdmin, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });

  const row = await c.env.DB.prepare(
    `SELECT m.title,
            (SELECT COUNT(*) FROM marathon_checkins k WHERE k.marathon_id = m.id) AS n
       FROM marathons m WHERE m.id = ?`,
  )
    .bind(id)
    .first<{ title: string; n: number }>();

  if (!row) fail(404, 'Marafon topilmadi.');
  if (row.n > 0) {
    fail(409, `Bu marafonda ${row.n} ta belgilangan kun bor — o‘chirib bo‘lmaydi. Yakunlang.`);
  }

  await c.env.DB.prepare(`DELETE FROM marathons WHERE id = ?`).bind(id).run();
  return c.json(ok({ message: `«${row.title}» o‘chirildi.` }));
});

export { notifyCheckin };
export default app;
