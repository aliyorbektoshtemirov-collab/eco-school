import type { Env } from '../types';
import { type Button, appButton, botEnabled, esc, sendMessage } from './telegram';
import { channelButton, postOnce } from './channel';

/**
 * E'lonni botga ulangan o'quvchilarga yuborish.
 *
 * Nechtasiga yetgani bazaga yoziladi — owner panelda ko'rib turadi.
 */
export async function broadcastAnnouncement(env: Env, id: number): Promise<void> {
  if (!botEnabled(env)) return;

  const a = await env.DB.prepare(
    `SELECT id, school_id, title, body, link FROM announcements WHERE id = ?`,
  )
    .bind(id)
    .first<{
      id: number;
      school_id: number | null;
      title: string;
      body: string;
      link: string | null;
    }>();

  if (!a) return;

  const site = env.SITE_URL || '';
  const text = `📣 <b>${esc(a.title)}</b>` + (a.body ? `\n\n${esc(a.body)}` : '');

  const buttons: Button[][] = [];
  if (a.link) buttons.push([{ text: 'Batafsil', url: a.link }]);
  buttons.push(...appButton(site));

  const { results: people } = await env.DB.prepare(
    `SELECT telegram_chat_id FROM profiles
      WHERE telegram_chat_id IS NOT NULL
        AND (?1 IS NULL OR school_id IS ?1)
      LIMIT 2000`,
  )
    .bind(a.school_id ?? null)
    .all<{ telegram_chat_id: string }>();

  let sent = 0;
  for (const person of people ?? []) {
    try {
      await sendMessage(env, person.telegram_chat_id, text, { buttons });
      sent += 1;
    } catch (err) {
      console.error('announcement send failed:', err);
    }
  }

  // Kanalga ham: havola bo'lsa o'sha, bo'lmasa botga
  await postOnce(
    env,
    `announcement:${a.id}`,
    text,
    a.link ? [[{ text: 'Batafsil', url: a.link }]] : channelButton(env, '🌱 Botni ochish'),
  );

  await env.DB.prepare(`UPDATE announcements SET sent_count = ? WHERE id = ?`)
    .bind(sent, id)
    .run();
}
