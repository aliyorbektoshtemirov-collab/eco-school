import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, Role, SessionUser, Variables } from '../types';
import { hmac, randomToken, safeEqual, sha256 } from './crypto';
import { fail } from './http';

export const COOKIE_NAME = 'eco_session';

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

export const USER_FIELDS =
  'id, username, full_name, class_name, school_id, school_code, role, points';

function ttlDays(env: Env): number {
  const n = Number(env.SESSION_TTL_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function iterations(env: Env): number {
  const n = Number(env.PBKDF2_ITERATIONS);
  return Number.isFinite(n) && n >= 10000 ? n : 100000;
}

/**
 * Sessiya tokeni: <tasodifiy>.<imzo>. Bazada faqat sha256(token) saqlanadi,
 * ya'ni baza o'g'irlansa ham tokenlar bilan kirib bo'lmaydi.
 */
export async function createSession(c: Ctx, userId: number): Promise<string> {
  const raw = randomToken(32);
  const sig = (await hmac(c.env.SESSION_SECRET, raw)).slice(0, 32);
  const token = `${raw}.${sig}`;
  const maxAge = ttlDays(c.env) * 24 * 60 * 60;

  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(await sha256(token), userId, new Date(Date.now() + maxAge * 1000).toISOString())
    .run();

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge,
  });

  // Mobil ilova cookie o'rniga shu tokenni sarlavhada yuboradi
  return token;
}

export async function destroySession(c: Ctx): Promise<void> {
  const token = sessionToken(c);
  if (token) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(await sha256(token)).run();
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

export async function destroyAllSessions(env: Env, userId: number): Promise<void> {
  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
}

/**
 * Sessiya tokeni qayerdan olinadi.
 *
 * Brauzer — cookie'da (HttpOnly, JS o'qiy olmaydi).
 * Mobil ilova — `Authorization: Bearer <token>` sarlavhasida: telefonda
 * cookie saqlash ishonchsiz va CSRF xavfi ham yo'q.
 */
export function bearerToken(c: Ctx): string | null {
  const header = c.req.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 && token.length <= 200 ? token : null;
}

export function sessionToken(c: Ctx): string | null {
  return bearerToken(c) ?? getCookie(c, COOKIE_NAME) ?? null;
}

/** Foydalanuvchini aniqlaydi. Topilmasa null. */
export async function currentUser(c: Ctx): Promise<SessionUser | null> {
  const token = sessionToken(c);
  if (!token || token.length > 200) return null;

  const [raw, sig] = token.split('.');
  if (!raw || !sig) return null;

  const expected = (await hmac(c.env.SESSION_SECRET, raw)).slice(0, 32);
  if (!safeEqual(sig, expected)) return null;

  const id = await sha256(token);
  const row = await c.env.DB.prepare(
    `SELECT p.id, p.username, p.full_name, p.class_name, p.school_id,
            p.school_code, p.role, p.points, s.expires_at
       FROM sessions s JOIN profiles p ON p.id = s.user_id
      WHERE s.id = ? LIMIT 1`,
  )
    .bind(id)
    .first<SessionUser & { expires_at: string }>();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
    return null;
  }

  const { expires_at: _drop, ...user } = row;
  return user as SessionUser;
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next,
) => {
  const user = await currentUser(c as Ctx);
  if (!user) fail(401, 'Davom etish uchun tizimga kiring.', 'unauthenticated');
  c.set('user', user);
  await next();
};

export function requireRole(
  ...roles: Role[]
): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) fail(401, 'Davom etish uchun tizimga kiring.', 'unauthenticated');
    if (!roles.includes(user.role)) fail(403, 'Bu sahifaga faqat admin kira oladi.', 'forbidden');
    await next();
  };
}

export const requireAdmin = requireRole('admin', 'owner');
export const requireOwner = requireRole('owner');

/**
 * CSRF himoyasi: o'zgartiruvchi so'rovlarda Origin sayt domeni bilan
 * mos kelishi va maxsus header yuborilishi shart.
 */
export const csrfGuard: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next,
) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method.toUpperCase())) return next();

  // Mobil ilova cookie ishlatmaydi — CSRF hujumi ham bo'lishi mumkin emas,
  // chunki tokenni boshqa sayt o'qiy olmaydi va o'zi qo'sha olmaydi.
  if (bearerToken(c as Ctx)) return next();

  const host = new URL(c.req.url).host;
  const source = c.req.header('origin') || c.req.header('referer');
  if (!source) fail(403, "So'rov manbasi aniqlanmadi.", 'csrf');

  let sourceHost: string | null = null;
  try {
    sourceHost = new URL(source).host;
  } catch {
    sourceHost = null;
  }
  if (!sourceHost) fail(403, "So'rov manbasi noto'g'ri.", 'csrf');
  if (sourceHost !== host) fail(403, "So'rov boshqa saytdan yuborilgan.", 'csrf');
  if (c.req.header('x-eco-client') !== 'web') fail(403, "So'rov sarlavhasi to'liq emas.", 'csrf');

  await next();
};

export async function loadUser(env: Env, id: number): Promise<SessionUser | null> {
  return env.DB.prepare(`SELECT ${USER_FIELDS} FROM profiles WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<SessionUser>();
}

/** Ball qo'shilganda profil yangilanadi. */
export async function addPoints(env: Env, userId: number, points: number): Promise<void> {
  if (!points) return;
  await env.DB.prepare(`UPDATE profiles SET points = points + ? WHERE id = ?`)
    .bind(points, userId)
    .run();
}
