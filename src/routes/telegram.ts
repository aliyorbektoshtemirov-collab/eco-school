import { Hono } from 'hono';
import { dailyTip } from '../lib/tips';
import type { Env, Variables } from '../types';
import { clientIp, fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { createSession, loadUser, requireAuth, requireOwner } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { verifyInitData } from '../lib/webapp';
import { challengeCard } from '../lib/reminders';
import { channelButton, postToChannel } from '../lib/channel';
import { dayNumber, todayLocal } from '../lib/marathon';
import { appButton, botEnabled, deleteWebhook, esc, getWebhookInfo, setMenuButton, sendMessage, sendPhoto, setWebhook } from '../lib/telegram';
import { MENTORS_INTRO, listMentors } from './mentors';
import {
  START_BUTTONS,
  askLogout,
  clearState,
  handleCallback,
  handleStateMessage,
  startLogin,
  startRegister,
} from '../lib/botflow';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function siteUrl(c: { env: Env; req: { url: string } }): string {
  return c.env.SITE_URL || new URL(c.req.url).origin;
}

/* ================================================================== holat */
app.get('/telegram/status', requireAuth, async (c) => {
  const user = c.get('user');
  const row = await c.env.DB.prepare(
    `SELECT telegram_chat_id, telegram_linked_at FROM profiles WHERE id = ?`,
  )
    .bind(user.id)
    .first<{ telegram_chat_id: string | null; telegram_linked_at: string | null }>();

  return c.json(
    ok({
      enabled: botEnabled(c.env),
      linked: Boolean(row?.telegram_chat_id),
      linkedAt: row?.telegram_linked_at ?? null,
      botUsername: (c.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '') || null,
    }),
  );
});

/**
 * Ulash kodi. O'quvchi profil sahifasida kod oladi va uni botga yuboradi.
 * Kod 15 daqiqa amal qiladi.
 */
app.post('/telegram/link-code', requireAuth, async (c) => {
  const user = c.get('user');
  if (!botEnabled(c.env)) fail(503, 'Telegram bot hozircha sozlanmagan.');

  await limit(c.env, `tglink:${user.id}`, 10, 3600);

  // Chalkashmaydigan belgilar: 0/O va 1/I yo'q
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');

  await c.env.DB.prepare(
    `UPDATE profiles
        SET telegram_link_code = ?,
            telegram_code_expires = datetime('now', '+15 minutes')
      WHERE id = ?`,
  )
    .bind(code, user.id)
    .run();

  return c.json(ok({ code, expiresInMinutes: 15 }));
});

/** Hisobni uzish. */
app.post('/telegram/unlink', requireAuth, async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare(
    `UPDATE profiles
        SET telegram_chat_id = NULL, telegram_link_code = NULL,
            telegram_code_expires = NULL, telegram_linked_at = NULL
      WHERE id = ?`,
  )
    .bind(user.id)
    .run();

  return c.json(ok({ message: 'Telegram hisobi uzildi.' }));
});

/* ============================================================== Mini App */
/**
 * Bot ichida ochilgan saytga avtomatik kirish.
 *
 * Telegram bergan imzolangan `initData` tekshiriladi; imzo to'g'ri bo'lsa,
 * o'sha Telegram hisobiga bog'langan profil topiladi va oddiy sessiya
 * ochiladi. Parol so'ralmaydi — imzoni faqat Telegram yarata oladi.
 */
app.post('/telegram/webapp-auth', async (c) => {
  if (!botEnabled(c.env)) fail(503, 'Telegram bot sozlanmagan.');

  const ip = clientIp(c.req.raw.headers);
  await limit(c.env, `webapp:${ip}`, 30, 900);

  const body = await v.body(c.req.raw);
  const initData = typeof body.initData === 'string' ? body.initData : '';

  const tgUser = await verifyInitData(c.env, initData);
  if (!tgUser) fail(401, 'Telegram imzosi tasdiqlanmadi.');

  const row = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE telegram_chat_id = ?`,
  )
    .bind(String(tgUser.id))
    .first<{ id: number }>();

  // Hisob hali ulanmagan — botda ro'yxatdan o'tishni taklif qilamiz
  if (!row) fail(404, 'Hisobingiz ulanmagan. Botda /start bosib ro‘yxatdan o‘ting.', 'not_linked');

  await createSession(c, row.id);
  return c.json(ok({ user: await loadUser(c.env, row.id) }));
});

/**
 * Kanalni tekshirish — owner bir marta bosib ko'radi.
 * Bot kanalga admin qilinmagan bo'lsa, xato shu yerda ko'rinadi.
 */
app.post('/telegram/channel-test', requireAuth, requireOwner, async (c) => {
  if (!botEnabled(c.env)) fail(503, 'Telegram bot sozlanmagan.');

  const channel = (c.env.TELEGRAM_CHANNEL ?? '').trim();
  if (!channel) {
    fail(422, 'TELEGRAM_CHANNEL sozlanmagan. wrangler.toml ga qo‘shib, deploy qiling.');
  }

  const sent = await postToChannel(
    c.env,
    '✅ <b>Sinov xabari</b>\n\nECO SCHOOL boti kanalga ulandi.',
    channelButton(c.env, '🌱 Botni ochish'),
  );

  if (!sent) {
    fail(
      503,
      'Kanalga yuborilmadi. Bot kanalga admin qilinganini va nomi to‘g‘ri yozilganini tekshiring.',
    );
  }

  return c.json(ok({ channel, message: 'Kanalga sinov xabari yuborildi.' }));
});

/* ================================================================== webhook */
/**
 * Telegram shu manzilga yangiliklarni yuboradi.
 *
 * CSRF guard bu yo'lni o'tkazib yuboradi (index.ts da), chunki so'rov
 * brauzerdan emas, Telegram serveridan keladi. O'rniga maxfiy sarlavha
 * tekshiriladi — uni faqat Telegram biladi.
 */
app.post('/telegram/webhook', async (c) => {
  if (!botEnabled(c.env)) return c.json({ ok: true });

  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || c.req.header('x-telegram-bot-api-secret-token') !== secret) {
    // Telegram'ga 200 qaytaramiz, aks holda u qayta-qayta urinadi
    return c.json({ ok: true });
  }

  let update: any;
  try {
    update = await c.req.json();
  } catch {
    return c.json({ ok: true });
  }

  // Tugma bosilgan
  const cb = update?.callback_query;
  if (cb?.id && cb?.message?.chat?.id) {
    c.executionCtx.waitUntil(
      handleCallback(
        c.env,
        String(cb.message.chat.id),
        cb.message.message_id,
        String(cb.data ?? ''),
        String(cb.id),
      ).catch((err) => console.error('Telegram handleCallback failed:', err)),
    );
    return c.json({ ok: true });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = String(message?.text ?? '').trim();

  if (!chatId || !text) return c.json({ ok: true });

  // Javobni fon rejimida yuboramiz — Telegram tez javob kutadi.
  // Xato bo'lsa log'ga tushadi, Telegram'ga esa 200 qaytadi (qayta urinmasin).
  c.executionCtx.waitUntil(
    handleMessage(c.env, siteUrl(c), String(chatId), text, message?.message_id).catch((err) =>
      console.error('Telegram handleMessage failed:', err),
    ),
  );

  return c.json({ ok: true });
});

/* ================================================================== buyruqlar */
async function handleMessage(
  env: Env,
  site: string,
  chatId: string,
  text: string,
  messageId?: number,
): Promise<void> {
  const command = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');

  // Ro'yxatdan o'tish yoki kirish suhbati davom etayotgan bo'lsa, o'sha yerda hal bo'ladi
  if (await handleStateMessage(env, chatId, text, messageId)) return;

  const linked = await env.DB.prepare(
    `SELECT id, full_name, username, class_name, points, school_id
       FROM profiles WHERE telegram_chat_id = ?`,
  )
    .bind(chatId)
    .first<{
      id: number;
      full_name: string;
      username: string;
      class_name: string | null;
      points: number;
      school_id: number | null;
    }>();

  if (command === '/tavsiya' || command === '/tip') {
    const tip = dailyTip();
    await sendMessage(env, chatId, `🐢 <b>Timo tavsiya qiladi</b>

<b>${esc(tip.title)}</b>
${esc(tip.text)}`, { buttons: appButton(site, tip.action, tip.path) });
    return;
  }

  // ---------------------------------------------------------------- /start
  if (command === '/start') {
    const tip = dailyTip();
    await sendMessage(env, chatId, `🌱 <b>Bugungi tavsiya: ${esc(tip.title)}</b>
${esc(tip.text)}

/tavsiya — kunlik eko tavsiya`);
    if (linked) {
      await sendMessage(
        env,
        chatId,
        `Salom, ${esc(linked.full_name)}! 🐢\n\n` +
          `Saytni shu yerning o‘zida ochsangiz bo‘ladi — pastdagi tugma yoki ` +
          `yozishma ostidagi «ECO SCHOOL».\n\n` +
          `/ball — ballaringiz\n` +
          `/challenge — ochiq vazifalar\n` +
          `/mentorlar — mentorlarimiz`,
        {
          buttons: [
            ...appButton(site),
            [{ text: '🚪 Hisobdan chiqish', callback_data: 'logout' }],
          ],
        },
      );
      return;
    }

    await clearState(env, chatId);
    await sendMessage(
      env,
      chatId,
      `Salom! Men <b>Timo</b> 🐢 — ECO SCHOOL yordamchisiman.\n\n` +
        `Ochiq vazifalar haqida eslatib turaman va topshirig‘ingiz ` +
        `tasdiqlanganda darhol xabar beraman.\n\n` +
        `Saytda hisobingiz bo‘lmasa — shu yerda ro‘yxatdan o‘tasiz, ` +
        `email kerak emas. Hisobingiz bo‘lsa, login va parol bilan kirasiz.`,
      { buttons: START_BUTTONS },
    );
    return;
  }

  // -------------------------------------------------- /royxat va /kirish
  if (command === '/royxat' || command === '/register') {
    if (linked) {
      await sendMessage(env, chatId, 'Hisobingiz allaqachon ulangan.');
      return;
    }
    await startRegister(env, chatId);
    return;
  }

  if (command === '/kirish' || command === '/login') {
    if (linked) {
      await sendMessage(env, chatId, 'Hisobingiz allaqachon ulangan.');
      return;
    }
    await startLogin(env, chatId);
    return;
  }

  if (command === '/bekor') {
    await clearState(env, chatId);
    await sendMessage(env, chatId, 'Bekor qilindi. /start bosib qaytadan boshlang.');
    return;
  }

  // ---------------------------------------------------------------- /stop
  if (command === '/stop' || command === '/chiqish') {
    if (!linked) {
      await sendMessage(env, chatId, 'Hisobingiz ulanmagan.');
      return;
    }
    await askLogout(env, chatId);
    return;
  }

  // ---------------------------------------------------------------- ulanmagan
  if (!linked) {
    // 6 belgili kod yuborilgan bo'lishi mumkin
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (code.length === 6) {
      const profile = await env.DB.prepare(
        `SELECT id, full_name FROM profiles
          WHERE telegram_link_code = ?
            AND telegram_code_expires > datetime('now')
            AND telegram_chat_id IS NULL`,
      )
        .bind(code)
        .first<{ id: number; full_name: string }>();

      if (!profile) {
        await sendMessage(
          env,
          chatId,
          'Kod topilmadi yoki muddati tugagan. Profil sahifasidan yangi kod oling.',
        );
        return;
      }

      // Bu Telegram hisobi boshqa profilga ulanmaganini tekshiramiz
      const taken = await env.DB.prepare(
        `SELECT id FROM profiles WHERE telegram_chat_id = ?`,
      )
        .bind(chatId)
        .first();

      if (taken) {
        await sendMessage(env, chatId, 'Bu Telegram hisobi allaqachon boshqa profilga ulangan.');
        return;
      }

      await env.DB.prepare(
        `UPDATE profiles
            SET telegram_chat_id = ?, telegram_link_code = NULL,
                telegram_code_expires = NULL, telegram_linked_at = datetime('now')
          WHERE id = ?`,
      )
        .bind(chatId, profile.id)
        .run();

      await sendMessage(
        env,
        chatId,
        `Tayyor, ${esc(profile.full_name)}! ✅\n\n` +
          `Endi men sizga eslatib turaman.\n\n` +
          `/ball — ballaringiz\n/challenge — ochiq vazifalar`,
      );
      return;
    }

    await sendMessage(
      env,
      chatId,
      'Avval hisobingizni ulaylik. Quyidagidan birini tanlang:',
      { buttons: START_BUTTONS },
    );
    return;
  }

  // ---------------------------------------------------------------- /ball
  const pageCommands: Record<string, [string, string]> = {
    '/home': ['/', '🏠 Home'],
    '/profil': ['/profile', '👤 Profil'],
    '/reyting': ['/leaderboard', '🏆 Reyting'],
    '/natijalar': ['/impact', '🌿 Natijalar'],
    '/research': ['/research', '🔬 Eco Research'],
    '/taqvim': ['/calendar', '📅 Taqvim'],
    '/recycling': ['/recycling', '♻️ Recycling'],
    '/sinflar': ['/class-leaderboard', '🏅 Sinflar reytingi'],
  };
  if (pageCommands[command]) {
    const [path, title] = pageCommands[command];
    await sendMessage(env, chatId, title, { buttons: appButton(site, title, path) });
    return;
  }
  // -------------------------------------------------------------- /marafon
  if (command === '/marafon' || command === '/marathon') {
    const today = await todayLocal(env);

    const { results } = await env.DB.prepare(
      `SELECT m.id, m.title, m.days, m.points_per_day, m.start_date, m.status,
              EXISTS (SELECT 1 FROM marathon_participants p
                       WHERE p.marathon_id = m.id AND p.student_id = ?1) AS joined,
              (SELECT COUNT(*) FROM marathon_checkins k
                WHERE k.marathon_id = m.id AND k.student_id = ?1) AS done
         FROM marathons m
        WHERE m.status = 'active' AND (m.school_id IS NULL OR m.school_id IS ?2)
        ORDER BY m.start_date DESC LIMIT 5`,
    )
      .bind(linked.id, linked.school_id)
      .all<{
        id: number;
        title: string;
        days: number;
        points_per_day: number;
        start_date: string;
        joined: number;
        done: number;
      }>();

    if (!results || results.length === 0) {
      await sendMessage(env, chatId, 'Hozir faol marafon yo‘q. Yangisi chiqsa xabar beraman.');
      return;
    }

    for (const m of results) {
      const day = dayNumber(m, today);
      const joined = Boolean(m.joined);

      const status = !joined
        ? 'Siz hali qo‘shilmagansiz.'
        : day < 1
          ? `Boshlanishiga oz qoldi — ${esc(m.start_date)}.`
          : `Bajardingiz: <b>${m.done}/${m.days}</b> kun. Bugun — ${Math.min(day, m.days)}-kun.`;

      await sendMessage(
        env,
        chatId,
        `🏁 <b>${esc(m.title)}</b>\n${m.days} kun · kuniga +${m.points_per_day} ball\n\n${status}`,
        {
          buttons: joined
            ? appButton(site, '📋 Ochish', '/marafon')
            : [
                [{ text: '🏃 Qo‘shilaman', callback_data: `mjoin:${m.id}` }],
                ...appButton(site, '📋 Batafsil', '/marafon'),
              ],
        },
      );
    }
    return;
  }

  // ------------------------------------------------------------- /mentorlar
  if (command === '/mentorlar' || command === '/mentors') {
    const mentors = await listMentors(env);

    if (mentors.length === 0) {
      await sendMessage(env, chatId, 'Mentorlar ro‘yxati hali qo‘shilmagan.');
      return;
    }

    await sendMessage(env, chatId, `👩‍🏫 <b>Mentorlarimiz</b>\n\n${esc(MENTORS_INTRO)}`, {
      buttons: appButton(site, '👩‍🏫 Mentorlar sahifasi', '/mentors'),
    });

    for (const m of mentors) {
      const caption =
        `<b>${esc(m.full_name)}</b>` +
        (m.title ? `\n${esc(m.title)}` : '') +
        (m.bio ? `\n\n${esc(m.bio)}` : '');
      const photo = m.photo_key && site.startsWith('https://')
        ? `${site.replace(/\/+$/, '')}/api/mentors/files/${m.id}`
        : null;

      // Rasm yuborilmasa (manzil ochilmasa), matnning o'zi yuboriladi
      const sent = photo ? await sendPhoto(env, chatId, photo, caption.slice(0, 1000)) : false;
      if (!sent) await sendMessage(env, chatId, caption);
    }
    return;
  }

  if (command === '/ball') {
    const rank = await env.DB.prepare(
      `SELECT COUNT(*) + 1 AS rank FROM profiles
        WHERE role = 'student' AND school_id = (SELECT school_id FROM profiles WHERE id = ?1)
          AND points > (SELECT points FROM profiles WHERE id = ?1)`,
    )
      .bind(linked.id)
      .first<{ rank: number }>();

    await sendMessage(
      env,
      chatId,
      `<b>${esc(linked.full_name)}</b>\n` +
        `${linked.class_name ? esc(linked.class_name) + '\n' : ''}` +
        `\n⭐ Ball: <b>${linked.points}</b>\n` +
        `🏆 O‘rin: <b>#${rank?.rank ?? '—'}</b>`,
      { buttons: appButton(site, '🏆 Reytingni ko‘rish') },
    );
    return;
  }

  // ---------------------------------------------------------------- /challenge
  if (command === '/challenge') {
    const open = await openChallenges(env, linked.id);

    if (open.length === 0) {
      await sendMessage(
        env,
        chatId,
        'Barakalla! Barcha ochiq vazifalarni bajargansiz. 🎉',
        { buttons: appButton(site) },
      );
      return;
    }

    // Yozishmani to'ldirib yubormaslik uchun bir martada beshtasi
    const shown = open.slice(0, 5);

    await sendMessage(
      env,
      chatId,
      open.length > shown.length
        ? `Sizda <b>${open.length} ta</b> bajarilmagan vazifa bor. Eng ko‘p balllilari:`
        : `Sizda <b>${open.length} ta</b> bajarilmagan vazifa bor:`,
    );

    // Har bir vazifa alohida xabar — ichida o'zining «Bajarish» tugmasi
    for (const ch of shown) {
      const card = challengeCard(ch, site);
      await sendMessage(env, chatId, card.text, { buttons: card.buttons });
    }

    if (open.length > shown.length) {
      await sendMessage(
        env,
        chatId,
        `Yana <b>${open.length - shown.length} ta</b> vazifa bor — hammasini ilovada ko‘rasiz.`,
        { buttons: appButton(site, '📋 Hammasini ko‘rish', '/challenges') },
      );
    }
    return;
  }

  // ---------------------------------------------------------------- boshqa
  await sendMessage(
    env,
    chatId,
    'Tushunmadim. Mavjud buyruqlar:\n/ball — ballaringiz\n/challenge — ochiq vazifalar\n/mentorlar — mentorlar\n/chiqish — hisobni uzish',
  );
}

/** O'quvchi hali topshirmagan challenge'lar. */
export async function openChallenges(
  env: Env,
  userId: number,
): Promise<
  { id: number; title: string; points: number; description: string; category: string; end_date: string | null }[]
> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.title, c.points, c.description, c.category, c.end_date
       FROM challenges c
      WHERE (c.school_id IS NULL
             OR c.school_id = (SELECT school_id FROM profiles WHERE id = ?1))
        AND c.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM challenge_submissions s
           WHERE s.challenge_id = c.id AND s.student_id = ?1
        )
      ORDER BY c.points DESC
      LIMIT 10`,
  )
    .bind(userId)
    .all<{
      id: number;
      title: string;
      points: number;
      description: string;
      category: string;
      end_date: string | null;
    }>();

  return results ?? [];
}

/* ================================================================== sozlash */
/** Webhook'ni ro'yxatdan o'tkazish. Faqat owner, bir marta. */
app.post('/telegram/setup', requireAuth, requireOwner, async (c) => {
  if (!botEnabled(c.env)) fail(503, 'TELEGRAM_BOT_TOKEN sozlanmagan.');
  if (!c.env.TELEGRAM_WEBHOOK_SECRET) fail(503, 'TELEGRAM_WEBHOOK_SECRET sozlanmagan.');

  const site = siteUrl(c);
  const url = `${site}/api/telegram/webhook`;
  const result = await setWebhook(c.env, url, c.env.TELEGRAM_WEBHOOK_SECRET);
  const menu = await setMenuButton(c.env, site);

  return c.json(ok({ webhookUrl: url, menuButton: menu, result }));
});

app.get('/telegram/info', requireAuth, requireOwner, async (c) => {
  if (!botEnabled(c.env)) fail(503, 'TELEGRAM_BOT_TOKEN sozlanmagan.');
  return c.json(ok({ info: await getWebhookInfo(c.env) }));
});

app.post('/telegram/teardown', requireAuth, requireOwner, async (c) => {
  if (!botEnabled(c.env)) fail(503, 'TELEGRAM_BOT_TOKEN sozlanmagan.');
  return c.json(ok({ result: await deleteWebhook(c.env) }));
});

export default app;
