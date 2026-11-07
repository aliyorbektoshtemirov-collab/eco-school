import type { Env } from '../types';
import { type Button, botEnabled, sendMessage } from './telegram';

/**
 * Telegram kanaliga joylash.
 *
 * Shaxsiy xabardan farqi: kanal postida Mini App tugmasi ishlamaydi
 * (Telegram ruxsat bermaydi), shuning uchun oddiy havola tugmasi
 * qo'yiladi — botga yoki saytga.
 *
 * Kanal sozlanmagan bo'lsa hamma narsa avvalgidek ishlayveradi.
 */

export function channelEnabled(env: Env): boolean {
  return botEnabled(env) && Boolean((env.TELEGRAM_CHANNEL ?? '').trim());
}

/** Kanal posti uchun tugma: botni ochadi, bo'lmasa saytni. */
export function channelButton(env: Env, text = '✅ Bajarish'): Button[][] {
  const bot = (env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '').trim();
  if (bot) return [[{ text, url: `https://t.me/${bot}` }]];

  const site = (env.SITE_URL ?? '').trim();
  if (site.startsWith('https://')) return [[{ text, url: site }]];

  return [];
}

export async function postToChannel(
  env: Env,
  text: string,
  buttons?: Button[][],
): Promise<boolean> {
  if (!channelEnabled(env)) return false;

  const channel = (env.TELEGRAM_CHANNEL ?? '').trim();

  try {
    await sendMessage(env, channel, text, buttons && buttons.length ? { buttons } : {});
    return true;
  } catch (err) {
    console.error('postToChannel failed:', err);
    return false;
  }
}

/**
 * Bir marta joylash.
 *
 * Cron qo'lda qayta ishga tushirilsa yoki ikki marta chaqirilsa,
 * kanalda bir xil post ikki marta chiqmasin. Belgisi `settings`
 * jadvalida saqlanadi.
 */
export async function postOnce(
  env: Env,
  key: string,
  text: string,
  buttons?: Button[][],
): Promise<boolean> {
  if (!channelEnabled(env)) return false;

  try {
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO settings (key, value, updated_at)
       VALUES (?1, '1', datetime('now'))`,
    )
      .bind(`posted:${key}`)
      .run();

    // Yozuv qo'shilmadi — demak allaqachon joylangan
    if (!res.meta.changes) return false;
  } catch (err) {
    console.error('postOnce bookkeeping failed:', err);
    return false;
  }

  const sent = await postToChannel(env, text, buttons);

  // Yuborilmasa belgini olib tashlaymiz — keyingi safar qayta urinsin
  if (!sent) {
    await env.DB.prepare(`DELETE FROM settings WHERE key = ?`)
      .bind(`posted:${key}`)
      .run()
      .catch(() => undefined);
  }

  return sent;
}
