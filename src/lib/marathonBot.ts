import type { Env } from '../types';
import { type Button, appButton, botEnabled, esc, sendMessage } from './telegram';
import { dayNumber, dayTask, todayLocal } from './marathon';
import { channelButton, postOnce } from './channel';

/**
 * Marafonning bot tomoni: e'lon, har kungi eslatma va «Bajardim» tugmasi.
 *
 * Eslatma faqat qo'shilgan va o'sha kunni hali belgilamagan o'quvchiga
 * boradi — bajargan odamni bezovta qilmaydi.
 */

interface Marathon {
  id: number;
  title: string;
  description: string;
  days: number;
  points_per_day: number;
  bonus_points: number;
  start_date: string;
  school_id: number | null;
}

/** Yangi marafon e'lon qilinganda — «Qo'shilaman» tugmasi bilan. */
export async function announceMarathon(env: Env, marathonId: number): Promise<void> {
  if (!botEnabled(env)) return;

  const m = await env.DB.prepare(`SELECT * FROM marathons WHERE id = ?`)
    .bind(marathonId)
    .first<Marathon>();

  if (!m) return;

  const site = env.SITE_URL || '';
  const text =
    `🏁 <b>${esc(m.title)}</b>\n` +
    `${m.days} kunlik marafon\n\n` +
    (m.description ? `${esc(m.description)}\n\n` : '') +
    `Har kuni bajarilgan vazifa uchun <b>+${m.points_per_day} ball</b>` +
    (m.bonus_points > 0 ? `, hammasini bajarsangiz yana <b>+${m.bonus_points}</b>` : '') +
    `.\n📅 Boshlanish: ${esc(m.start_date)}\n\n` +
    `Qo‘shilsangiz, har kuni shu yerda eslatib turaman.`;

  const buttons: Button[][] = [
    [{ text: '🏃 Qo‘shilaman', callback_data: `mjoin:${m.id}` }],
    ...appButton(site, '📋 Batafsil', '/marafon'),
  ];

  const { results: students } = await env.DB.prepare(
    `SELECT telegram_chat_id FROM profiles
      WHERE telegram_chat_id IS NOT NULL AND role = 'student'
        AND (?1 IS NULL OR school_id IS ?1)
      LIMIT 1000`,
  )
    .bind(m.school_id ?? null)
    .all<{ telegram_chat_id: string }>();

  for (const student of students ?? []) {
    try {
      await sendMessage(env, student.telegram_chat_id, text, { buttons });
    } catch (err) {
      console.error('announceMarathon send failed:', err);
    }
  }

  // Kanalga ham — qo'shilmagan bolalar ham ko'rsin
  await postOnce(
    env,
    `marathon:${m.id}:announce`,
    text,
    channelButton(env, '🏃 Qo‘shilish'),
  );
}

/** Bitta o'quvchiga bitta kunning eslatmasi. */
async function remindOne(
  env: Env,
  m: Marathon,
  chatId: string,
  day: number,
  site: string,
): Promise<void> {
  const task = await dayTask(env, m.id, day, m.description || 'Bugungi eko-qadamni bajaring.');

  await sendMessage(
    env,
    chatId,
    `🏁 <b>${esc(m.title)}</b> · ${day}/${m.days}-kun\n\n` +
      `${esc(task)}\n\n` +
      `Bajarsangiz tugmani bosing — <b>+${m.points_per_day} ball</b>.`,
    {
      buttons: [
        [{ text: '✅ Bajardim', callback_data: `mdone:${m.id}:${day}` }],
        ...appButton(site, '📋 Marafon', '/marafon'),
      ],
    },
  );
}

/**
 * Kunlik eslatma — cron chaqiradi.
 * Muddati tugagan marafonlar shu yerda yopiladi.
 */
export async function sendDailyMarathonReminders(env: Env): Promise<void> {
  if (!botEnabled(env)) return;

  const site = env.SITE_URL || '';
  const today = await todayLocal(env);

  const { results: marathons } = await env.DB.prepare(
    `SELECT * FROM marathons WHERE status = 'active' LIMIT 20`,
  ).all<Marathon>();

  for (const m of marathons ?? []) {
    const day = dayNumber(m, today);

    if (day < 1) continue; // hali boshlanmagan

    if (day > m.days) {
      await closeMarathon(env, m, site);
      continue;
    }

    const { results: pending } = await env.DB.prepare(
      `SELECT p.student_id, pr.telegram_chat_id
         FROM marathon_participants p
         JOIN profiles pr ON pr.id = p.student_id
        WHERE p.marathon_id = ?1
          AND pr.telegram_chat_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM marathon_checkins k
             WHERE k.marathon_id = ?1 AND k.student_id = p.student_id
               AND k.day_number = ?2
          )
        LIMIT 1000`,
    )
      .bind(m.id, day)
      .all<{ student_id: number; telegram_chat_id: string }>();

    // Kanalga kuniga bitta post — hamma ko'rib tursin
    const task = await dayTask(env, m.id, day, m.description || 'Bugungi eko-qadamni bajaring.');
    await postOnce(
      env,
      `marathon:${m.id}:day:${day}`,
      `🏁 <b>${esc(m.title)}</b> · ${day}/${m.days}-kun\n\n` +
        `${esc(task)}\n\n` +
        `Bajargan bo‘lsangiz botda belgilang — <b>+${m.points_per_day} ball</b>.`,
      channelButton(env, '✅ Botda belgilash'),
    );

    for (const student of pending ?? []) {
      try {
        await remindOne(env, m, student.telegram_chat_id, day, site);
      } catch (err) {
        console.error('marathon reminder failed for', student.student_id, err);
      }
    }
  }
}

/** Marafon tugadi: yakuniy xabar va holatni yopish. */
async function closeMarathon(env: Env, m: Marathon, site: string): Promise<void> {
  const { results: people } = await env.DB.prepare(
    `SELECT pr.telegram_chat_id,
            (SELECT COUNT(*) FROM marathon_checkins k
              WHERE k.marathon_id = ?1 AND k.student_id = p.student_id) AS done
       FROM marathon_participants p
       JOIN profiles pr ON pr.id = p.student_id
      WHERE p.marathon_id = ?1 AND pr.telegram_chat_id IS NOT NULL
      LIMIT 1000`,
  )
    .bind(m.id)
    .all<{ telegram_chat_id: string; done: number }>();

  for (const person of people ?? []) {
    try {
      await sendMessage(
        env,
        person.telegram_chat_id,
        `🏁 <b>${esc(m.title)}</b> tugadi!\n\n` +
          `Siz ${m.days} kundan <b>${person.done} tasini</b> bajardingiz.\n\n` +
          (person.done >= m.days
            ? 'Hammasini! Barakalla 🎉'
            : 'Keyingi marafonda yanada yaxshi chiqasiz. 🌱'),
        { buttons: appButton(site, '🏆 Reyting', '/leaderboard') },
      );
    } catch (err) {
      console.error('closeMarathon send failed:', err);
    }
  }

  await postOnce(
    env,
    `marathon:${m.id}:finish`,
    `🏁 <b>${esc(m.title)}</b> yakunlandi!\n\n` +
      `${(people ?? []).length} o‘quvchi qatnashdi. Natijalar saytda.`,
    channelButton(env, '🏆 Reyting'),
  );

  await env.DB.prepare(`UPDATE marathons SET status = 'finished' WHERE id = ?`).bind(m.id).run();
}

/** Botda belgilangandan keyingi javob matni. */
export function notifyCheckin(result: {
  message: string;
  day: number;
  streak: number;
  finished: boolean;
}): string {
  if (result.finished) return `🎉 ${result.message}`;
  const tail = result.streak > 1 ? `\n\n🔥 Ketma-ket ${result.streak} kun!` : '';
  return `✅ ${result.message}${tail}`;
}
