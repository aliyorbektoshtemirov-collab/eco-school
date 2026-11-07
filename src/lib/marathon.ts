import type { Env } from '../types';

/**
 * Marafon — bir necha kun davom etadigan challenge.
 *
 * Sana Toshkent vaqti bo'yicha hisoblanadi (UTC+5): kun yarim kechada
 * emas, bolalarning kuni bilan birga almashsin.
 */

export const TZ_SHIFT = '+5 hours';

export interface MarathonRow {
  id: number;
  school_id: number | null;
  title: string;
  description: string;
  days: number;
  points_per_day: number;
  bonus_points: number;
  start_date: string;
  status: string;
}

/** Bugun marafonning nechanchi kuni. Boshlanmagan bo'lsa 0, tugagan bo'lsa days+1. */
export function dayNumber(marathon: { start_date: string; days: number }, today: string): number {
  const start = Date.parse(`${marathon.start_date}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 0;

  const diff = Math.round((now - start) / 86_400_000) + 1;
  if (diff < 1) return 0;
  return diff;
}

/** Toshkent vaqti bo'yicha bugungi sana, YYYY-MM-DD. */
export async function todayLocal(env: Env): Promise<string> {
  const row = await env.DB.prepare(`SELECT date('now', ?) AS d`)
    .bind(TZ_SHIFT)
    .first<{ d: string }>();
  return row?.d ?? new Date().toISOString().slice(0, 10);
}

/** Shu kunning vazifasi. Alohida yozilmagan bo'lsa, umumiy matn qaytadi. */
export async function dayTask(
  env: Env,
  marathonId: number,
  day: number,
  fallback: string,
): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT title FROM marathon_days WHERE marathon_id = ? AND day_number = ?`,
  )
    .bind(marathonId, day)
    .first<{ title: string }>();

  return row?.title || fallback;
}

/** Ketma-ket necha kun belgilangani — «streak». */
export async function streak(
  env: Env,
  marathonId: number,
  studentId: number,
  upToDay: number,
): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT day_number FROM marathon_checkins
      WHERE marathon_id = ? AND student_id = ? AND day_number <= ?
      ORDER BY day_number DESC`,
  )
    .bind(marathonId, studentId, upToDay)
    .all<{ day_number: number }>();

  let count = 0;
  let expected = upToDay;
  for (const row of results ?? []) {
    if (row.day_number !== expected) break;
    count += 1;
    expected -= 1;
  }
  return count;
}
