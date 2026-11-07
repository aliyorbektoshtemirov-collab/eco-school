import { fail } from './http';

/** Boshqaruv belgilarini olib tashlab, bo'shliqlarni tartibga soladi. */
export function clean(value: unknown, max = 2000): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function str(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number; required?: boolean } = {},
): string {
  const { min = 0, max = 2000, required = true } = opts;
  const v = clean(value, max);
  if (!v && !required) return '';
  if (v.length < min || !v) {
    fail(422, `"${field}" kamida ${min} ta belgidan iborat bo'lishi kerak.`);
  }
  return v;
}

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_.]{1,22})[a-z0-9]$/;

/** Login — email o'rniga (ko'p o'quvchida email yo'q). */
export function username(value: unknown): string {
  const raw = clean(value, 30).toLowerCase().replace(/\s+/g, '');
  if (!USERNAME_RE.test(raw)) {
    fail(
      422,
      "Login 3–24 ta belgidan iborat bo'lishi, faqat lotin harflari, raqam, _ va . belgilaridan tashkil topishi kerak.",
    );
  }
  const reserved = ['admin', 'owner', 'root', 'system', 'api', 'null', 'undefined'];
  if (reserved.includes(raw)) fail(422, 'Bu login band qilingan, boshqasini tanlang.');
  return raw;
}

export function password(value: unknown, field = 'Parol'): string {
  const v = typeof value === 'string' ? value : '';
  if (v.length < 8) fail(422, `${field} kamida 8 ta belgidan iborat bo'lishi kerak.`);
  if (v.length > 128) fail(422, `${field} juda uzun.`);
  return v;
}

export function num(value: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  const n = Number(value);
  if (!Number.isFinite(n)) fail(422, `"${field}" son bo'lishi kerak.`);
  if (opts.min !== undefined && n < opts.min) fail(422, `"${field}" ${opts.min} dan kichik bo'lmasligi kerak.`);
  if (opts.max !== undefined && n > opts.max) fail(422, `"${field}" ${opts.max} dan katta bo'lmasligi kerak.`);
  return n;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const v = clean(value, 50);
  if (!allowed.includes(v as T)) fail(422, `"${field}" uchun noto'g'ri qiymat.`);
  return v as T;
}

export function dateStr(value: unknown, field: string, required = true): string | null {
  const v = clean(value, 10);
  if (!v) {
    if (required) fail(422, `"${field}" sanasini kiriting.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) fail(422, `"${field}" sana YYYY-MM-DD ko'rinishida bo'lishi kerak.`);
  return v;
}

/** JSON body'ni xavfsiz o'qish. */
export async function body(req: Request): Promise<Record<string, unknown>> {
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    fail(400, "Faqat JSON so'rovlar qabul qilinadi.");
  }
  try {
    const data = await req.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, "Noto'g'ri so'rov.");
    return data as Record<string, unknown>;
  } catch {
    fail(400, "So'rov ma'lumotlarini o'qib bo'lmadi.");
  }
}
