/**
 * Rasm fayllarini tekshirish.
 *
 * Fayl nomiga yoki brauzer yuborgan Content-Type'ga ISHONMAYMIZ — ikkalasini
 * ham o'zgartirish oson. Faqat faylning birinchi baytlari ("sehrli raqamlar")
 * bo'yicha turini aniqlaymiz. Shunday qilib, rasm niqobi ostida HTML yoki
 * skript yuborib bo'lmaydi.
 */

export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp';

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Fayl haqiqatan rasmmi? Ha bo'lsa — turini, yo'q bo'lsa — null qaytaradi. */
export function detectImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, PNG)) return 'image/png';
  // WebP: "RIFF" .... "WEBP"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export function extensionFor(kind: ImageKind): string {
  return kind === 'image/jpeg' ? 'jpg' : kind === 'image/png' ? 'png' : 'webp';
}

/**
 * Saqlash kaliti: YYYY/MM/<tasodifiy>.<kengaytma>
 * Oylar bo'yicha papkalarga bo'linadi — keyinchalik eskilarini topish oson.
 */
export function buildKey(kind: ImageKind, random: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${random}.${extensionFor(kind)}`;
}

/** Kalit faqat bizning formatimizga mos bo'lishi kerak (yo'lni o'zgartirishga qarshi). */
export function isValidKey(key: string): boolean {
  return /^\d{4}\/\d{2}\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(key);
}
