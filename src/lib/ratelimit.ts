import type { Env } from '../types';
import { fail } from './http';

/**
 * D1 ustidagi oddiy, lekin ishonchli rate limiter.
 * Brute-force login va spamga qarshi birinchi himoya qatlami.
 */
export async function limit(
  env: Env,
  bucket: string,
  max: number,
  windowSeconds: number,
  message = 'Juda ko\'p urinish. Biroz kuting va qayta urinib ko\'ring.',
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSeconds;

  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, hits, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT(bucket) DO UPDATE SET
       hits = CASE WHEN rate_limits.reset_at < ?3 THEN 1 ELSE rate_limits.hits + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < ?3 THEN ?2 ELSE rate_limits.reset_at END`,
  )
    .bind(bucket, resetAt, now)
    .run();

  const row = await env.DB.prepare(`SELECT hits, reset_at FROM rate_limits WHERE bucket = ?`)
    .bind(bucket)
    .first<{ hits: number; reset_at: number }>();

  if (row && row.hits > max) {
    const wait = Math.max(1, row.reset_at - now);
    fail(429, `${message} (${wait} soniyadan so'ng)`, 'rate_limited');
  }
}

/** Muvaffaqiyatli kirishdan keyin hisoblagichni tozalash. */
export async function clearLimit(env: Env, bucket: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM rate_limits WHERE bucket = ?`).bind(bucket).run();
}

/** Eskirgan sessiya va rate-limit yozuvlarini tozalaydi. */
export async function sweep(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM rate_limits WHERE reset_at < ?`).bind(now),
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`),
  ]);
}
