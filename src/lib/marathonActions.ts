import type { Env } from '../types';
import { appButton, clearButtons, esc, sendMessage } from './telegram';
import { checkin } from '../routes/marathons';
import { notifyCheckin } from './marathonBot';
import { dayNumber, todayLocal } from './marathon';

/**
 * Botdagi marafon tugmalari.
 *
 * Saytdagi bilan bir xil qoidalar ishlaydi — `checkin()` ikkalasida ham
 * bitta funksiya, shuning uchun ballar va cheklovlar farq qilmaydi.
 */

/** Telegram hisobidan profilni topish. */
async function studentOf(env: Env, chatId: string) {
  return env.DB.prepare(
    `SELECT id, full_name FROM profiles WHERE telegram_chat_id = ?`,
  )
    .bind(chatId)
    .first<{ id: number; full_name: string }>();
}

export async function handleMarathonCallback(
  env: Env,
  chatId: string,
  messageId: number | undefined,
  data: string,
): Promise<void> {
  const student = await studentOf(env, chatId);
  const site = env.SITE_URL || '';

  if (!student) {
    await sendMessage(env, chatId, 'Avval hisobingizni ulang — /start bosing.');
    return;
  }

  // ------------------------------------------------------------ qo'shilish
  if (data.startsWith('mjoin:')) {
    const id = Number(data.slice(6));
    if (!Number.isFinite(id)) return;

    const m = await env.DB.prepare(
      `SELECT id, title, days, start_date, status, points_per_day FROM marathons WHERE id = ?`,
    )
      .bind(id)
      .first<{
        id: number;
        title: string;
        days: number;
        start_date: string;
        status: string;
        points_per_day: number;
      }>();

    if (!m) {
      await sendMessage(env, chatId, 'Marafon topilmadi.');
      return;
    }

    if (m.status !== 'active') {
      await clearButtons(env, chatId, messageId);
      await sendMessage(env, chatId, 'Bu marafon tugagan.');
      return;
    }

    await env.DB.prepare(
      `INSERT OR IGNORE INTO marathon_participants (marathon_id, student_id) VALUES (?, ?)`,
    )
      .bind(id, student.id)
      .run();

    await clearButtons(env, chatId, messageId);

    const today = await todayLocal(env);
    const day = dayNumber(m, today);

    await sendMessage(
      env,
      chatId,
      `🏃 <b>${esc(m.title)}</b> marafoniga qo‘shildingiz!\n\n` +
        (day < 1
          ? `Marafon ${esc(m.start_date)} kuni boshlanadi — o‘sha kuni eslatib turaman.`
          : `Hozir ${day}/${m.days}-kun. Har kuni vazifani shu yerda yuboraman, ` +
            `bajarsangiz tugmani bosasiz.`),
      { buttons: appButton(site, '📋 Marafon', '/marafon') },
    );
    return;
  }

  // -------------------------------------------------------------- bajardim
  if (data.startsWith('mdone:')) {
    const [, rawId, rawDay] = data.split(':');
    const id = Number(rawId);
    const day = Number(rawDay);
    if (!Number.isFinite(id) || !Number.isFinite(day)) return;

    try {
      const result = await checkin(env, id, student.id, day, null, null, 'bot');
      await clearButtons(env, chatId, messageId);
      await sendMessage(env, chatId, notifyCheckin(result));
    } catch (err) {
      // checkin() HTTPException otadi — foydalanuvchiga tushunarli matn chiqaramiz
      const text =
        err && typeof err === 'object' && 'message' in err && (err as { message: string }).message
          ? String((err as { message: string }).message)
          : 'Belgilab bo‘lmadi. Keyinroq urinib ko‘ring.';
      await sendMessage(env, chatId, text);
    }
    return;
  }
}
