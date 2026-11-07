import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { ok } from '../lib/http';
import { requireAuth } from '../lib/auth';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Asl saytda bu ko'rsatkichlar faqat tizimga kirgan a'zolarga ochiq edi.
app.use('*', requireAuth);

/** get_school_overall_impact o'rniga. */
app.get('/impact', async (c) => {
  const user = c.get('user');
  const schoolId = user.school_id;

  const [recycling, challenges, research, students] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN material = 'paper'   THEN COALESCE(verified_amount_kg, amount_kg) END), 0) AS paper_kg,
         COALESCE(SUM(CASE WHEN material = 'plastic' THEN COALESCE(verified_amount_kg, amount_kg) END), 0) AS plastic_kg,
         COALESCE(SUM(COALESCE(verified_amount_kg, amount_kg)), 0) AS recycling_kg,
         COALESCE(SUM(awarded_points), 0) AS recycling_points
       FROM recycling_submissions
      WHERE status = 'approved' AND school_id = ?`,
    ).bind(schoolId),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS approved_challenges,
              COALESCE(SUM(cs.awarded_points), 0) AS challenge_points
         FROM challenge_submissions cs
         JOIN profiles p ON p.id = cs.student_id
        WHERE cs.status = 'approved' AND p.school_id = ?`,
    ).bind(schoolId),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(r.awarded_points), 0) AS research_points
         FROM eco_research r
         JOIN profiles p ON p.id = r.student_id
        WHERE r.status = 'published' AND p.school_id = ?`,
    ).bind(schoolId),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS active_students, COALESCE(SUM(points), 0) AS total_points
         FROM profiles WHERE school_id = ?`,
    ).bind(schoolId),
  ]);

  const r = (recycling.results ?? [])[0] as Record<string, number> | undefined;
  const ch = (challenges.results ?? [])[0] as Record<string, number> | undefined;
  const re = (research.results ?? [])[0] as Record<string, number> | undefined;
  const st = (students.results ?? [])[0] as Record<string, number> | undefined;

  return c.json(
    ok({
      impact: {
        paper_kg: Number(r?.paper_kg ?? 0),
        plastic_kg: Number(r?.plastic_kg ?? 0),
        recycling_kg: Number(r?.recycling_kg ?? 0),
        recycling_points: Number(r?.recycling_points ?? 0),
        approved_challenges: Number(ch?.approved_challenges ?? 0),
        challenge_points: Number(ch?.challenge_points ?? 0),
        research_points: Number(re?.research_points ?? 0),
        total_points: Number(st?.total_points ?? 0),
        active_students: Number(st?.active_students ?? 0),
      },
    }),
  );
});

/**
 * Profil sahifasi uchun: o'rin, ketma-ketlik va o'z topshiriqlari hisobi.
 * Reytingning 200 qatorini yuklamaslik uchun alohida ajratildi.
 */
app.get('/me', async (c) => {
  const user = c.get('user');

  const [rank, challenges, recycling, research] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT COUNT(*) + 1 AS rank FROM profiles
        WHERE role = 'student' AND school_id IS ?1 AND points > ?2`,
    ).bind(user.school_id, user.points),
    c.env.DB.prepare(
      `SELECT SUM(status = 'approved') AS approved,
              SUM(status = 'pending')  AS pending
         FROM challenge_submissions WHERE student_id = ?`,
    ).bind(user.id),
    c.env.DB.prepare(
      `SELECT SUM(status = 'approved') AS approved,
              SUM(status = 'pending')  AS pending,
              COALESCE(SUM(CASE WHEN status = 'approved'
                           THEN COALESCE(verified_amount_kg, amount_kg) END), 0) AS kg
         FROM recycling_submissions WHERE student_id = ?`,
    ).bind(user.id),
    c.env.DB.prepare(
      `SELECT SUM(status = 'published') AS approved,
              SUM(status = 'pending')   AS pending
         FROM eco_research WHERE student_id = ?`,
    ).bind(user.id),
  ]);

  const pick = (res: D1Result) => (res.results?.[0] ?? {}) as Record<string, number | null>;
  const num = (value: number | null | undefined) => Number(value ?? 0);

  const ch = pick(challenges);
  const re = pick(recycling);
  const rs = pick(research);

  // Oldingi o'rinni egallash uchun qancha ball kerak
  const ahead = await c.env.DB.prepare(
    `SELECT MIN(points) AS points FROM profiles
      WHERE role = 'student' AND school_id IS ?1 AND points > ?2`,
  )
    .bind(user.school_id, user.points)
    .first<{ points: number | null }>();

  return c.json(
    ok({
      rank: Number(pick(rank).rank ?? 1),
      toNext: ahead?.points != null ? Math.max(0, ahead.points - user.points) : null,
      challenges: { approved: num(ch.approved), pending: num(ch.pending) },
      recycling: { approved: num(re.approved), pending: num(re.pending), kg: num(re.kg) },
      research: { approved: num(rs.approved), pending: num(rs.pending) },
    }),
  );
});

const MONTHS_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/**
 * Oylar bo'yicha o'sish — Eco Team tasdiqlagan arizalardan.
 * Oxirgi 6 oy, arizasi yo'q oylar ham nol bilan qaytadi,
 * shunda chiziq uzilmaydi.
 */
app.get('/monthly', async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', submitted_at) AS ym,
            material,
            COALESCE(SUM(COALESCE(verified_amount_kg, amount_kg)), 0) AS kg
       FROM recycling_submissions
      WHERE status = 'approved'
        AND school_id = ?
        AND submitted_at >= date('now', 'start of month', '-5 months')
      GROUP BY ym, material`,
  )
    .bind(user.school_id)
    .all<{ ym: string; material: string; kg: number }>();

  const found = new Map<string, { paper: number; plastic: number }>();
  for (const row of results ?? []) {
    const slot = found.get(row.ym) ?? { paper: 0, plastic: 0 };
    if (row.material === 'paper') slot.paper = Number(row.kg);
    else if (row.material === 'plastic') slot.plastic = Number(row.kg);
    found.set(row.ym, slot);
  }

  // Oxirgi 6 oyni ketma-ket tuzamiz
  const now = new Date();
  const months = [];
  for (let back = 5; back >= 0; back -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const slot = found.get(ym) ?? { paper: 0, plastic: 0 };
    months.push({
      ym,
      label: MONTHS_UZ[d.getUTCMonth()],
      paper: Math.round(slot.paper * 100) / 100,
      plastic: Math.round(slot.plastic * 100) / 100,
    });
  }

  return c.json(ok({ months }));
});

/**
 * Davr bo'yicha ball.
 *
 * `profiles.points` — umumiy yig'indi, undan «shu hafta nechta» degan
 * savolga javob chiqmaydi. Shuning uchun davriy reyting ball manbalaridan
 * qaytadan hisoblanadi: topshiriq, recycling, tadqiqot va marafon.
 *
 * Sana sifatida ish bajarilgan payt olinadi (tasdiqlangan payt emas) —
 * o'quvchi uchun tushunarliroq: «men buni o'tgan hafta qilganman».
 */
function periodStart(period: string): string | null {
  if (period === 'week') return "date('now', '+5 hours', 'weekday 1', '-7 days')";
  if (period === 'month') return "date('now', '+5 hours', 'start of month')";
  return null;
}

/** Bitta o'quvchining davr ichidagi balli — to'rtta manbadan. */
function earnedSql(since: string | null): string {
  const filter = (column: string) => (since ? `AND ${column} >= ${since}` : '');

  return `
    COALESCE((SELECT SUM(cs.awarded_points) FROM challenge_submissions cs
               WHERE cs.student_id = p.id AND cs.status = 'approved'
                 ${filter('date(cs.submitted_at)')}), 0)
  + COALESCE((SELECT SUM(rs.awarded_points) FROM recycling_submissions rs
               WHERE rs.student_id = p.id AND rs.status = 'approved'
                 ${filter('date(rs.submitted_at)')}), 0)
  + COALESCE((SELECT SUM(er.awarded_points) FROM eco_research er
               WHERE er.student_id = p.id AND er.status = 'published'
                 ${filter('date(er.submitted_at)')}), 0)
  + COALESCE((SELECT SUM(mk.awarded_points) FROM marathon_checkins mk
               WHERE mk.student_id = p.id
                 ${filter('date(mk.created_at)')}), 0)`;
}

/** Reyting: umumiy, shu hafta yoki shu oy. */
app.get('/leaderboard', async (c) => {
  const user = c.get('user');
  const period = new URL(c.req.url).searchParams.get('period') ?? 'all';
  const since = periodStart(period);

  const sql = since
    ? `SELECT p.id AS student_id, p.full_name, p.class_name,
              ${earnedSql(since)} AS points
         FROM profiles p
        WHERE p.school_id = ? AND p.role = 'student'
        ORDER BY points DESC, p.full_name
        LIMIT 200`
    : `SELECT id AS student_id, full_name, class_name, points
         FROM profiles
        WHERE school_id = ? AND role = 'student'
        ORDER BY points DESC, full_name
        LIMIT 200`;

  const { results } = await c.env.DB.prepare(sql).bind(user.school_id).all<{ points: number }>();

  // Davriy reytingda nol ballilar ro'yxatni cho'zadi — ularni chiqarmaymiz
  const students = since ? (results ?? []).filter((row) => Number(row.points) > 0) : results ?? [];

  return c.json(ok({ students, period }));
});

/** get_school_class_leaderboard o'rniga. */
app.get('/class-leaderboard', async (c) => {
  const user = c.get('user');
  const period = new URL(c.req.url).searchParams.get('period') ?? 'all';
  const since = periodStart(period);

  if (since) {
    const { results: rows } = await c.env.DB.prepare(
      `SELECT p.class_name,
              COUNT(DISTINCT p.id) AS student_count,
              SUM(${earnedSql(since)}) AS total_points,
              COALESCE((
                SELECT SUM(COALESCE(rs.verified_amount_kg, rs.amount_kg))
                  FROM recycling_submissions rs
                  JOIN profiles rp ON rp.id = rs.student_id
                 WHERE rs.status = 'approved' AND rp.class_name = p.class_name
                   AND rp.school_id = p.school_id
                   AND date(rs.submitted_at) >= ${since}
              ), 0) AS recycling_kg,
              COALESCE((
                SELECT COUNT(*)
                  FROM challenge_submissions cs
                  JOIN profiles cp ON cp.id = cs.student_id
                 WHERE cs.status = 'approved' AND cp.class_name = p.class_name
                   AND cp.school_id = p.school_id
                   AND date(cs.submitted_at) >= ${since}
              ), 0) AS approved_challenges
         FROM profiles p
        WHERE p.school_id = ? AND p.class_name IS NOT NULL AND p.role = 'student'
        GROUP BY p.class_name
        ORDER BY total_points DESC`,
    )
      .bind(user.school_id)
      .all<{ total_points: number }>();

    return c.json(
      ok({
        classes: (rows ?? []).filter((row) => Number(row.total_points) > 0),
        period,
      }),
    );
  }

  const { results } = await c.env.DB.prepare(
    `SELECT
       p.class_name,
       COUNT(DISTINCT p.id) AS student_count,
       COALESCE(SUM(p.points), 0) AS total_points,
       COALESCE((
         SELECT SUM(COALESCE(rs.verified_amount_kg, rs.amount_kg))
           FROM recycling_submissions rs
           JOIN profiles rp ON rp.id = rs.student_id
          WHERE rs.status = 'approved' AND rp.class_name = p.class_name AND rp.school_id = p.school_id
       ), 0) AS recycling_kg,
       COALESCE((
         SELECT COUNT(*)
           FROM challenge_submissions cs
           JOIN profiles cp ON cp.id = cs.student_id
          WHERE cs.status = 'approved' AND cp.class_name = p.class_name AND cp.school_id = p.school_id
       ), 0) AS approved_challenges
     FROM profiles p
    WHERE p.school_id = ? AND p.class_name IS NOT NULL AND p.role = 'student'
    GROUP BY p.class_name
    ORDER BY total_points DESC`,
  )
    .bind(user.school_id)
    .all();

  return c.json(ok({ classes: results ?? [], period }));
});

export default app;
