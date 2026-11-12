import type { Env } from '../types';

/**
 * Telegram Bot API bilan ishlash.
 *
 * Token Cloudflare secret'ida (`TELEGRAM_BOT_TOKEN`) saqlanadi —
 * kodda ham, git'da ham yo'q.
 */

const API = 'https://api.telegram.org/bot';

/** Sinov uchun boshqa manzilga yo'naltirish mumkin; ishlab chiqarishda o'zgarmaydi. */
function apiBase(env: Env): string {
  return env.TELEGRAM_API_BASE || API;
}

export function botEnabled(env: Env): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN);
}

/**
 * Telegram API chaqiruvi.
 *
 * Hech qachon xato otmaydi: Telegram o'chib qolsa yoki tarmoq uzilsa ham
 * ball berish, tasdiqlash kabi asosiy amallar buzilmasligi kerak.
 * Muvaffaqiyatsizlik log'ga yoziladi va `null` qaytadi.
 */
async function call(env: Env, method: string, payload: unknown): Promise<unknown> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;

  try {
    const res = await fetch(`${apiBase(env)}${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error('Telegram API error:', method, res.status, await res.text().catch(() => ''));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Telegram request failed:', method, err);
    return null;
  }
}

/** HTML belgilarini xavfsizlash — o'quvchi ismi xabarni buzmasin. */
export function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Inline tugma. Uch xil bo'ladi:
 *   url          — oddiy havola, brauzerda ochiladi
 *   callback_data — bosilganda botga qaytadi
 *   web_app      — saytni Telegram ichida ochadi (Mini App)
 */
export type Button = {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
};

/**
 * Mini App tugmasi — faqat https manzil bilan ishlaydi.
 * `path` berilsa, ilova o'sha sahifada ochiladi.
 */
export function appButton(
  site: string,
  text = '🌱 ECO SCHOOL’ni ochish',
  path = '',
): Button[][] {
  if (!site.startsWith('https://')) return [];
  return [[{ text, web_app: { url: `${site.replace(/\/+$/, '')}${path}` } }]];
}

/**
 * Chatdagi pastki menyu tugmasi — yozishma ostida doim turadi,
 * bola uni istalgan payt bosib saytni ochadi.
 */
export async function setMenuButton(env: Env, site: string): Promise<boolean> {
  if (!site.startsWith('https://')) return false;
  const res = await call(env, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'ECO SCHOOL',
      web_app: { url: site },
    },
  });
  return Boolean(res);
}

export async function sendMessage(
  env: Env,
  chatId: string | number,
  text: string,
  opts: { buttons?: Button[][] } = {},
): Promise<void> {
  await call(env, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(opts.buttons ? { reply_markup: { inline_keyboard: opts.buttons } } : {}),
  });
}

/** Rasm bilan xabar. Rasm manzili ochiq bo'lishi kerak — Telegram o'zi yuklab oladi. */
export async function sendPhoto(
  env: Env,
  chatId: string | number,
  photoUrl: string,
  caption: string,
): Promise<boolean> {
  const res = await call(env, 'sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
  });
  return Boolean(res);
}

/** Botning «/» menyusi — buyruqlar ro'yxati. */
export async function setCommands(env: Env): Promise<void> {
  await call(env, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'Boshlash' },
      { command: 'tavsiya', description: 'Timo: bugungi eko tavsiya' },
      { command: 'ball', description: 'Ballarim' },
      { command: 'challenge', description: 'Ochiq vazifalar' },
      { command: 'marafon', description: 'Marafon' },
      { command: 'mentorlar', description: 'Mentorlar' },
      { command: 'chiqish', description: 'Hisobdan chiqish' },
    ],
  });
}

/**
 * Yozishmadan xabarni o'chirish.
 *
 * Parol yozilgan xabar chatda qolib ketmasligi uchun kerak: bot shaxsiy
 * yozishmada kelgan xabarni o'chira oladi. O'chirilmasa ham asosiy amal
 * buzilmaydi — shunchaki `false` qaytadi.
 */
export async function deleteMessage(
  env: Env,
  chatId: string | number,
  messageId: number | undefined,
): Promise<boolean> {
  if (!messageId) return false;
  const res = await call(env, 'deleteMessage', { chat_id: chatId, message_id: messageId });
  return Boolean(res);
}

/** Tugma bosilganda Telegram kutib turadi — javob bermasak, soat aylanaveradi. */
export async function answerCallback(
  env: Env,
  callbackId: string,
  text?: string,
): Promise<void> {
  await call(env, 'answerCallbackQuery', {
    callback_query_id: callbackId,
    ...(text ? { text } : {}),
  });
}

/** Xabar ostidagi tugmalarni olib tashlash — bosilgandan keyin takror bosilmasin. */
export async function clearButtons(
  env: Env,
  chatId: string | number,
  messageId: number | undefined,
): Promise<void> {
  if (!messageId) return;
  await call(env, 'editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

/**
 * Bitta o'quvchiga xabar — hisobi bog'lanmagan bo'lsa, jimgina o'tkazib yuboradi.
 * Bildirishnoma yuborilmagani uchun asosiy amal buzilmasligi kerak.
 */
export async function notifyUser(env: Env, userId: number, text: string): Promise<void> {
  if (!botEnabled(env)) return;

  try {
    const row = await env.DB.prepare(
      `SELECT telegram_chat_id FROM profiles WHERE id = ? AND telegram_chat_id IS NOT NULL`,
    )
      .bind(userId)
      .first<{ telegram_chat_id: string }>();

    if (row?.telegram_chat_id) {
      await sendMessage(env, row.telegram_chat_id, text);
    }
  } catch (err) {
    console.error('notifyUser failed:', err);
  }
}

/** Webhook'ni ro'yxatdan o'tkazish (bir marta, /api/telegram/setup orqali). */
export async function setWebhook(env: Env, url: string, secret: string): Promise<unknown> {
  return call(env, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(env: Env): Promise<unknown> {
  return call(env, 'deleteWebhook', { drop_pending_updates: true });
}

export async function getWebhookInfo(env: Env): Promise<unknown> {
  return call(env, 'getWebhookInfo', {});
}
