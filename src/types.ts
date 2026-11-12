export type Role = 'student' | 'admin' | 'owner';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Dalil rasmlari shu yerda saqlanadi. Sozlanmagan bo'lsa yuklash o'chadi. */
  FILES?: R2Bucket;
  SESSION_SECRET: string;
  /** Birinchi owner hisobini yaratish uchun bir martalik kalit. */
  SETUP_KEY: string;
  APP_NAME: string;
  SESSION_TTL_DAYS: string;
  PBKDF2_ITERATIONS: string;
  MAX_UPLOAD_BYTES?: string;
  /** Recycling: 1 kg uchun necha ball. */
  POINTS_PER_KG: string;

  /** Telegram bot. Sozlanmagan bo'lsa bot butunlay o'chadi. */
  TELEGRAM_BOT_TOKEN?: string;
  /** Webhook'ni Telegram'dan kelganini tekshirish uchun. */
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** Bot nomi (@ belgisisiz), profil sahifasida havola ko'rsatish uchun. */
  TELEGRAM_BOT_USERNAME?: string;
  /** Xabarlardagi havolalar uchun sayt manzili, masalan https://eco.bugunbor.uz */
  SITE_URL?: string;
  /** Faqat sinov uchun: Telegram API manzilini almashtirish. */
  TELEGRAM_API_BASE?: string;
  /** Kanal: @nomi yoki -100... raqami. Bot kanalga admin bo'lishi kerak. */
  TELEGRAM_CHANNEL?: string;
  /** Android ilovasi: paket nomi va imzo barmoq izi (assetlinks uchun). */
  ANDROID_PACKAGE?: string;
  ANDROID_FINGERPRINT?: string;
}

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  class_name: string | null;
  school_id: number | null;
  school_code: string | null;
  role: Role;
  points: number;
  avatar_key?: string | null;
}

export type Variables = {
  user: SessionUser;
};
