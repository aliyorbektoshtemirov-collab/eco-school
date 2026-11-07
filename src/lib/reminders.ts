import type { Env } from '../types';
import { appButton, botEnabled, esc, sendMessage } from './telegram';
import { channelButton, postOnce } from './channel';

/**
 * Haftalik eslatma: dushanba ertalab hisobini ulagan o'quvchilarga
 * hali bajarilmagan challenge'lar ro'yxati yuboriladi.
 *
 * Hammasi bajarilgan bo'lsa xabar yuborilmaydi — keraksiz bildirishnoma
 * bo'lmasin.
 */
/** Bitta challenge'ning bot ichidagi ko'rinishi: matn + «Bajarish» tugmasi. */
export function challengeCard(
  challenge: { id: number; title: string; description?: string | null; category?: string | null; points: number; end_date?: string | null },
  site: string,
) {
  const lines = [
    `🌱 <b>${esc(challenge.title)}</b>`,
    challenge.description ? `\n${esc(challenge.description)}` : '',
    `\n⭐ +${challenge.points} ball`,
    challenge.category ? ` · ${esc(challenge.category)}` : '',
    challenge.end_date ? `\n📅 ${esc(challenge.end_date)} gacha` : '',
  ];

  return {
    text: lines.filter(Boolean).join(''),
    buttons: appButton(site, '✅ Bajarish', `/challenges?open=${challenge.id}`),
  };
}

/**
 * Yangi challenge qo'shilganda hisobini ulagan o'quvchilarga xabar.
 * Har biri alohida xabar — ichida «Bajarish» tugmasi bilan.
 */
export async function announceChallenge(
  env: Env,
  challenge: { id: number; title: string; description?: string | null; category?: string | null; points: number; end_date?: string | null; school_id?: number | null },
): Promise<void> {
  if (!botEnabled(env)) return;

  const card = challengeCard(challenge, env.SITE_URL || '');

  const { results: students } = await env.DB.prepare(
    `SELECT telegram_chat_id FROM profiles
      WHERE telegram_chat_id IS NOT NULL
        AND role = 'student'
        AND (?1 IS NULL OR school_id IS ?1)
      LIMIT 1000`,
  )
    .bind(challenge.school_id ?? null)
    .all<{ telegram_chat_id: string }>();

  for (const student of students ?? []) {
    try {
      await sendMessage(env, student.telegram_chat_id, `Yangi vazifa qo‘shildi!\n\n${card.text}`, {
        buttons: card.buttons,
      });
    } catch (err) {
      console.error('announceChallenge failed for', student.telegram_chat_id, err);
    }
  }

  await postOnce(
    env,
    `challenge:${challenge.id}`,
    `Yangi vazifa qo‘shildi!\n\n${card.text}`,
    channelButton(env),
  );
}

export async function sendWeeklyReminders(env: Env): Promise<void> {
  if (!botEnabled(env)) return;

  const site = env.SITE_URL || '';

  const { results: students } = await env.DB.prepare(
    `SELECT id, full_name, telegram_chat_id, points
       FROM profiles
      WHERE telegram_chat_id IS NOT NULL AND role = 'student'
      LIMIT 500`,
  ).all<{ id: number; full_name: string; telegram_chat_id: string; points: number }>();

  for (const student of students ?? []) {
    try {
      const { results: open } = await env.DB.prepare(
        `SELECT c.title, c.points
           FROM challenges c
          WHERE (c.school_id IS NULL
                 OR c.school_id = (SELECT school_id FROM profiles WHERE id = ?1))
            AND NOT EXISTS (
              SELECT 1 FROM challenge_submissions s
               WHERE s.challenge_id = c.id AND s.student_id = ?1
            )
          ORDER BY c.points DESC
          LIMIT 5`,
      )
        .bind(student.id)
        .all<{ title: string; points: number }>();

      if (!open || open.length === 0) continue;

      const list = open.map((c) => `• <b>${esc(c.title)}</b> — +${c.points} ball`).join('\n');

      await sendMessage(
        env,
        student.telegram_chat_id,
        `Yangi hafta boshlandi! 🌱\n\n` +
          `${esc(student.full_name)}, sizda ${open.length} ta bajarilmagan vazifa bor:\n\n` +
          `${list}\n\n` +
          `Hozirgi ballingiz: <b>${student.points}</b>`,
        { buttons: appButton(site, '✅ Vazifalarni ochish') },
      );
    } catch (err) {
      // Bitta o'quvchidagi xato qolganlarni to'xtatmasin
      console.error('Reminder failed for user', student.id, err);
    }
  }
}
