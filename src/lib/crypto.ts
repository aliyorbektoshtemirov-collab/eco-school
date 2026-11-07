/**
 * Parol va token bilan ishlovchi kriptografik yordamchilar.
 * Hammasi WebCrypto ustida — Workers runtime'da native tezlikda ishlaydi.
 */

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

/** Vaqt bo'yicha barqaror solishtirish (timing attack'ga qarshi). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** PBKDF2-SHA256 bilan parol hash'i. */
export async function hashPassword(
  password: string,
  iterations: number,
  saltHex?: string,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = saltHex ?? randomToken(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return { hash: toHex(bits), salt, iterations };
}

export async function verifyPassword(
  password: string,
  stored: { hash: string; salt: string; iterations: number },
): Promise<boolean> {
  const { hash } = await hashPassword(password, stored.iterations, stored.salt);
  return safeEqual(hash, stored.hash);
}

/** Sessiya tokenini imzolash uchun HMAC-SHA256. */
export async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Tasodifiy, o'qish oson vaqtinchalik parol (admin parolni tiklaganda). */
export function tempPassword(): string {
  const words = ['eko', 'yashil', 'daraxt', 'suv', 'quyosh', 'barg', 'gul', 'shamol'];
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);
  const word = words[arr[0] % words.length];
  const num = 1000 + (arr[1] % 9000);
  return `${word}${num}`;
}
