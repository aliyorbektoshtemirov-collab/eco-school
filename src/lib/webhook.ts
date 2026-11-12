import type { Env } from '../types';
import { botEnabled, getWebhookInfo, setCommands, setMenuButton, setWebhook } from './telegram';

/**
 * Webhook'ni o'zi ulaydi va buzilsa o'zi tiklaydi.
 *
 * Qo'lda `/api/telegram/setup` chaqirish shart emas: deploy'dan keyin
 * saytga birinchi kirgan odamning so'rovi shu tekshiruvni ishga tushiradi
 * (javobni kutmasdan, fon rejimida).
 *
 * Tekshiruv 6 soatda bir martadan ko'p bajarilmaydi — har so'rovda
 * Telegram'ga murojaat qilib o'tirmaymiz.
 */

const KEY = 'telegram_webhook';
const RECHECK_HOURS = 6;

/**
 * Sozlash tarkibi o'zgarganda shu raqam oshiriladi — shunda eski yozuv
 * mos kelmay qoladi va tekshiruv 6 soatni kutmasdan darhol qayta ishlaydi.
 * (v2 — yozishma ostidagi Mini App tugmasi qo'shildi; v3 — buyruqlar menyusi.)
 */
const SETUP_VERSION = 'v4';

export async function ensureWebhook(env: Env, origin: string): Promise<void> {
  if (!botEnabled(env) || !env.TELEGRAM_WEBHOOK_SECRET) return;

  const want = `${(env.SITE_URL || origin).replace(/\/+$/, '')}/api/telegram/webhook`;
  const stamp = `${want}|${SETUP_VERSION}`;

  try {
    const row = await env.DB.prepare(
      `SELECT value FROM settings
        WHERE key = ?1
          AND updated_at > datetime('now', '-${RECHECK_HOURS} hours')`,
    )
      .bind(KEY)
      .first<{ value: string }>();

    // Yaqinda tekshirilgan va o'sha manzil — qaytadan urinmaymiz
    if (row?.value === stamp) return;

    const info = (await getWebhookInfo(env)) as
      | { ok?: boolean; result?: { url?: string } }
      | null;

    const current = info?.result?.url ?? '';

    if (current !== want) {
      const res = await setWebhook(env, want, env.TELEGRAM_WEBHOOK_SECRET);
      if (!res) return; // Telegram javob bermadi — keyingi safar urinamiz
      console.log('Telegram webhook o\'rnatildi:', want);
    }

    // Yozishma ostidagi «ECO SCHOOL» tugmasi — Mini App shu yerdan ochiladi
    await setMenuButton(env, want.replace(/\/api\/telegram\/webhook$/, ''));
    await setCommands(env);

    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')`,
    )
      .bind(KEY, stamp)
      .run();
  } catch (err) {
    // Bu yordamchi vazifa — hech qachon asosiy so'rovni buzmasin
    console.error('ensureWebhook failed:', err);
  }
}
