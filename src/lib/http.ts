import { HTTPException } from 'hono/http-exception';

/** Foydalanuvchiga ko'rinadigan xato (o'zbekcha matn bilan). */
export function fail(
  status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 503,
  message: string,
  code?: string,
): never {
  throw new HTTPException(status, {
    // `message` ham beriladi: botdagi kod javobni HTTP orqali emas,
    // to'g'ridan-to'g'ri xatodan o'qiydi
    message,
    res: Response.json({ ok: false, error: message, code: code ?? null }, { status }),
  });
}

export const ok = <T>(data: T) => ({ ok: true as const, ...(data as object) });

export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** Sahifalash parametrlari. */
export function paging(url: URL, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(url.searchParams.get('limit')) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}
