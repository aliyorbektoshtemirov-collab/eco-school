import type { Env } from '../types';

/**
 * Telegram Mini App — `initData` imzosini tekshirish.
 *
 * Telegram bot ichida saytni ochganda unga imzolangan ma'lumot beradi.
 * Imzo bot tokeni bilan qo'yilgan, ya'ni uni faqat Telegram yarata oladi.
 * Shuning uchun imzo to'g'ri chiqsa, foydalanuvchi haqiqatan o'sha Telegram
 * hisobining egasi — parol so'rash shart emas.
 *
 * Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const enc = new TextEncoder();

/** 24 soatdan eski initData qabul qilinmaydi. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

async function hmacRaw(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Vaqt bo'yicha farqni oshkor qilmaydigan taqqoslash. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface WebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/**
 * Imzoni tekshiradi. To'g'ri bo'lsa Telegram foydalanuvchisini qaytaradi,
 * aks holda `null` — sabab aytilmaydi, chunki bu tashqaridan keladigan ma'lumot.
 */
export async function verifyInitData(env: Env, initData: string): Promise<WebAppUser | null> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData || initData.length > 4096) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  // Telegram "signature" maydonini tekshiruvga qo'shmaydi
  params.delete('signature');

  const checkString = [...params.entries()]
    .map(([k, value]) => [k, value] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, value]) => `${k}=${value}`)
    .join('\n');

  const secret = await hmacRaw(enc.encode('WebAppData'), token);
  const expected = toHex(await hmacRaw(secret, checkString));

  if (!safeEqual(expected, hash.toLowerCase())) return null;

  // Eski ma'lumot qayta ishlatilmasin
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  if (Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as WebAppUser | null;
    if (!user || typeof user.id !== 'number') return null;
    return user;
  } catch {
    return null;
  }
}
