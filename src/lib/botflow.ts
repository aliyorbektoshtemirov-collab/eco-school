import type { Env } from '../types';
import { hashPassword, verifyPassword } from './crypto';
import { handleMarathonCallback } from './marathonActions';
import { iterations } from './auth';
import {
  type Button,
  answerCallback,
  appButton,
  clearButtons,
  deleteMessage,
  esc,
  sendMessage,
} from './telegram';

/**
 * Botning o'zida ro'yxatdan o'tish va kirish.
 *
 * Kichik o'quvchilarda email yo'q va saytga kirib kod olish ham qiyin,
 * shuning uchun hamma narsa botning ichida bajariladi.
 *
 * Parol haqida: u Telegram yozishmasida qolib ketmasligi uchun bot
 * parol yozilgan xabarni darhol o'chiradi. Bazada esa, saytdagidek,
 * faqat PBKDF2 hash saqlanadi.
 */

const USERNAME_RE = /^[a-z0-9._]{3,24}$/;
const RESERVED = ['admin', 'owner', 'root', 'system', 'api', 'null', 'undefined'];

/* ============================================================ holat */

type Step =
  | 'reg_name'
  | 'reg_class'
  | 'reg_username'
  | 'reg_password'
  | 'login_username'
  | 'login_password';

interface State {
  step: Step;
  data: { fullName?: string; className?: string; username?: string; tries?: number };
}

export async function getState(env: Env, chatId: string): Promise<State | null> {
  const row = await env.DB.prepare(
    `SELECT step, data FROM telegram_states
      WHERE chat_id = ? AND updated_at > datetime('now', '-30 minutes')`,
  )
    .bind(chatId)
    .first<{ step: Step; data: string }>();

  if (!row) return null;
  try {
    return { step: row.step, data: JSON.parse(row.data) };
  } catch {
    return { step: row.step, data: {} };
  }
}

async function setState(env: Env, chatId: string, step: Step, data: State['data']): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO telegram_states (chat_id, step, data, updated_at)
     VALUES (?1, ?2, ?3, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE
        SET step = ?2, data = ?3, updated_at = datetime('now')`,
  )
    .bind(chatId, step, JSON.stringify(data))
    .run();
}

export async function clearState(env: Env, chatId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM telegram_states WHERE chat_id = ?`).bind(chatId).run();
}

/** Eskirgan suhbatlarni tozalash — kunlik cron chaqiradi. */
export async function sweepStates(env: Env): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM telegram_states WHERE updated_at < datetime('now', '-1 day')`,
  ).run();
}

/* ============================================================ boshlash */

export const START_BUTTONS: Button[][] = [
  [{ text: '📝 Ro‘yxatdan o‘tish', callback_data: 'reg' }],
  [{ text: '🔑 Hisobim bor', callback_data: 'login' }],
];

export async function startRegister(env: Env, chatId: string): Promise<void> {
  await setState(env, chatId, 'reg_name', {});
  await sendMessage(
    env,
    chatId,
    'Ismingiz va familiyangizni yozing.\n\n' +
      '<i>Masalan: Alisher Valiyev</i>\n\n' +
      'Bekor qilish uchun /bekor',
  );
}

/** Chiqish tugmasi — har ehtimolga qarshi tasdiq so'raladi. */
export async function askLogout(env: Env, chatId: string): Promise<void> {
  await sendMessage(
    env,
    chatId,
    'Hisobdan chiqasizmi?\n\n' +
      '<i>Hisobingiz o‘chmaydi — shunchaki Telegramdan uziladi. ' +
      'Saytdagi login va parolingiz o‘zgarishsiz qoladi va istalgan payt ' +
      'qaytib ulanasiz.</i>',
    {
      buttons: [
        [{ text: '🚪 Ha, chiqaman', callback_data: 'logout_yes' }],
        [{ text: 'Yo‘q, qolaman', callback_data: 'logout_no' }],
      ],
    },
  );
}

export async function doLogout(env: Env, chatId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT id, username FROM profiles WHERE telegram_chat_id = ?`,
  )
    .bind(chatId)
    .first<{ id: number; username: string }>();

  if (!row) {
    await sendMessage(env, chatId, 'Hisobingiz ulanmagan.');
    return;
  }

  await env.DB.prepare(
    `UPDATE profiles SET telegram_chat_id = NULL, telegram_linked_at = NULL WHERE id = ?`,
  )
    .bind(row.id)
    .run();

  await clearState(env, chatId);
  await sendMessage(
    env,
    chatId,
    `Chiqdingiz. 👋\n\nLoginingiz — <b>${esc(row.username)}</b>, u o‘zgarmadi.\n\n` +
      'Qaytib ulanish uchun /start bosing.',
  );
}

export async function startLogin(env: Env, chatId: string): Promise<void> {
  await setState(env, chatId, 'login_username', {});
  await sendMessage(
    env,
    chatId,
    'Saytdagi loginingizni yozing.\n\n' +
      '<i>Masalan: a.valiyev</i>\n\n' +
      'Bekor qilish uchun /bekor',
  );
}

/* ============================================================ sinflar */

async function classKeyboard(env: Env): Promise<Button[][]> {
  const { results } = await env.DB.prepare(
    `SELECT class_name FROM school_classes
      ORDER BY CAST(substr(class_name, 1, instr(class_name, '-') - 1) AS INTEGER), class_name`,
  ).all<{ class_name: string }>();

  const rows: Button[][] = [];
  let row: Button[] = [];

  for (const item of results ?? []) {
    row.push({ text: item.class_name, callback_data: `cls:${item.class_name}` });
    // Uzun nomlar (9-A IDUM) bitta qatorni to'ldiradi
    const perRow = item.class_name.length > 6 ? 2 : 3;
    if (row.length >= perRow) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);

  return rows;
}

/* ============================================================ tugmalar */

export async function handleCallback(
  env: Env,
  chatId: string,
  messageId: number | undefined,
  data: string,
  callbackId: string,
): Promise<void> {
  await answerCallback(env, callbackId);

  // Marafon tugmalari: qo'shilish va kunni belgilash
  if (data.startsWith('mjoin:') || data.startsWith('mdone:')) {
    await handleMarathonCallback(env, chatId, messageId, data);
    return;
  }

  if (data === 'logout') {
    await askLogout(env, chatId);
    return;
  }

  if (data === 'logout_no') {
    await clearButtons(env, chatId, messageId);
    await sendMessage(env, chatId, 'Yaxshi, qoldingiz. 🌱');
    return;
  }

  if (data === 'logout_yes') {
    await clearButtons(env, chatId, messageId);
    await doLogout(env, chatId);
    return;
  }

  if (data === 'reg' || data === 'login') {
    await clearButtons(env, chatId, messageId);
    if (data === 'reg') await startRegister(env, chatId);
    else await startLogin(env, chatId);
    return;
  }

  if (data.startsWith('cls:')) {
    const state = await getState(env, chatId);
    if (!state || state.step !== 'reg_class') return;

    const className = data.slice(4);
    const klass = await env.DB.prepare(
      `SELECT class_name FROM school_classes WHERE class_name = ?`,
    )
      .bind(className)
      .first();

    if (!klass) {
      await sendMessage(env, chatId, 'Bunday sinf topilmadi. Ro‘yxatdan tanlang.');
      return;
    }

    await clearButtons(env, chatId, messageId);
    await setState(env, chatId, 'reg_username', { ...state.data, className });
    await sendMessage(
      env,
      chatId,
      `Sinf: <b>${esc(className)}</b> ✅\n\n` +
        'Endi o‘zingizga login o‘ylab toping — bu bilan saytga kirasiz.\n\n' +
        '<i>Kichik lotin harflari, raqam, nuqta va pastki chiziq. ' +
        'Masalan: a.valiyev yoki aziza2012</i>',
    );
  }
}

/* ============================================================ xabarlar */

/**
 * Suhbat davom etayotgan bo'lsa shu yerda qayta ishlanadi.
 * `true` qaytsa, xabar shu yerda tugadi — buyruqlarga o'tmaydi.
 */
export async function handleStateMessage(
  env: Env,
  chatId: string,
  text: string,
  messageId: number | undefined,
): Promise<boolean> {
  const state = await getState(env, chatId);
  if (!state) return false;

  if (text.toLowerCase() === '/bekor') {
    await clearState(env, chatId);
    await sendMessage(env, chatId, 'Bekor qilindi. Qaytadan boshlash uchun /start');
    return true;
  }

  // Boshqa buyruq kelsa, suhbatni to'xtatamiz
  if (text.startsWith('/')) {
    await clearState(env, chatId);
    return false;
  }

  switch (state.step) {
    case 'reg_name':
      return regName(env, chatId, text, state);
    case 'reg_username':
      return regUsername(env, chatId, text, state);
    case 'reg_password':
      return regPassword(env, chatId, text, state, messageId);
    case 'login_username':
      return loginUsername(env, chatId, text, state);
    case 'login_password':
      return loginPassword(env, chatId, text, state, messageId);
    case 'reg_class':
      await sendMessage(env, chatId, 'Sinfingizni yuqoridagi tugmalardan tanlang.');
      return true;
    default:
      return false;
  }
}

async function regName(env: Env, chatId: string, text: string, state: State): Promise<boolean> {
  const name = text.trim().replace(/\s+/g, ' ').slice(0, 80);

  if (name.length < 3) {
    await sendMessage(env, chatId, 'Ism juda qisqa. To‘liq ism va familiyangizni yozing.');
    return true;
  }

  await setState(env, chatId, 'reg_class', { ...state.data, fullName: name });
  await sendMessage(env, chatId, `Xush kelibsiz, ${esc(name)}!\n\nEndi sinfingizni tanlang:`, {
    buttons: await classKeyboard(env),
  });
  return true;
}

async function regUsername(env: Env, chatId: string, text: string, state: State): Promise<boolean> {
  const uname = text.trim().toLowerCase().replace(/\s+/g, '');

  if (!USERNAME_RE.test(uname) || RESERVED.includes(uname)) {
    await sendMessage(
      env,
      chatId,
      'Bu login to‘g‘ri kelmadi.\n\n' +
        '3–24 ta belgi, faqat kichik lotin harflari, raqam, nuqta va pastki chiziq.\n' +
        'Boshqa login yozing.',
    );
    return true;
  }

  const exists = await env.DB.prepare(`SELECT id FROM profiles WHERE username = ?`)
    .bind(uname)
    .first();

  if (exists) {
    await sendMessage(env, chatId, `<b>${esc(uname)}</b> band ekan. Boshqa login o‘ylab toping.`);
    return true;
  }

  await setState(env, chatId, 'reg_password', { ...state.data, username: uname });
  await sendMessage(
    env,
    chatId,
    `Login: <b>${esc(uname)}</b> ✅\n\n` +
      'Oxirgi qadam — parol o‘ylab toping va yozing. Kamida 8 ta belgi.\n\n' +
      '🔒 <i>Parolni yozganingizdan keyin men o‘sha xabarni darhol o‘chiraman, ' +
      'u yozishmada qolmaydi. Parolingizni hech kimga aytmang.</i>',
  );
  return true;
}

async function regPassword(
  env: Env,
  chatId: string,
  text: string,
  state: State,
  messageId: number | undefined,
): Promise<boolean> {
  const password = text;

  // Parol har holda yozishmada qolmasin — tekshiruvdan oldin o'chiramiz
  await deleteMessage(env, chatId, messageId);

  if (password.length < 8 || password.length > 128) {
    await sendMessage(env, chatId, 'Parol kamida 8 ta belgi bo‘lsin. Qaytadan yozing.');
    return true;
  }

  const { fullName, className, username } = state.data;
  if (!fullName || !className || !username) {
    await clearState(env, chatId);
    await sendMessage(env, chatId, 'Nimadir chalkashdi. /start bosib qaytadan boshlang.');
    return true;
  }

  // Login shu orada band bo'lib qolmaganini tekshiramiz
  const taken = await env.DB.prepare(`SELECT id FROM profiles WHERE username = ?`)
    .bind(username)
    .first();
  if (taken) {
    await setState(env, chatId, 'reg_username', state.data);
    await sendMessage(env, chatId, 'Afsus, bu login endi band. Boshqa login yozing.');
    return true;
  }

  const school = await env.DB.prepare(`SELECT id, code FROM schools ORDER BY id LIMIT 1`).first<{
    id: number;
    code: string;
  }>();

  const { hash, salt, iterations: iter } = await hashPassword(password, iterations(env));

  const res = await env.DB.prepare(
    `INSERT INTO profiles (username, password_hash, password_salt, password_iter,
                           full_name, class_name, school_id, school_code, role,
                           telegram_chat_id, telegram_linked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', ?, datetime('now'))`,
  )
    .bind(
      username,
      hash,
      salt,
      iter,
      fullName,
      className,
      school?.id ?? null,
      school?.code ?? null,
      chatId,
    )
    .run();

  await clearState(env, chatId);

  const site = env.SITE_URL || '';
  await sendMessage(
    env,
    chatId,
    `Tayyor, ${esc(fullName)}! 🎉\n\n` +
      `Sinf: <b>${esc(className)}</b>\n` +
      `Login: <b>${esc(username)}</b>\n\n` +
      'Hisobingiz Telegramga ulandi — endi vazifalar va ballaringiz haqida ' +
      'shu yerda xabar olasiz.\n\n' +
      '/ball — ballaringiz\n/challenge — ochiq vazifalar',
    { buttons: appButton(site) },
  );

  return Number(res.meta.last_row_id) > 0;
}

async function loginUsername(
  env: Env,
  chatId: string,
  text: string,
  state: State,
): Promise<boolean> {
  const uname = text.trim().toLowerCase().replace(/\s+/g, '');

  if (!uname) {
    await sendMessage(env, chatId, 'Loginingizni yozing.');
    return true;
  }

  await setState(env, chatId, 'login_password', { ...state.data, username: uname });
  await sendMessage(
    env,
    chatId,
    'Endi parolingizni yozing.\n\n' +
      '🔒 <i>Men bu xabarni darhol o‘chiraman — parol yozishmada qolmaydi.</i>',
  );
  return true;
}

async function loginPassword(
  env: Env,
  chatId: string,
  text: string,
  state: State,
  messageId: number | undefined,
): Promise<boolean> {
  const password = text;
  await deleteMessage(env, chatId, messageId);

  const username = state.data.username ?? '';
  const tries = (state.data.tries ?? 0) + 1;

  const row = await env.DB.prepare(
    `SELECT id, full_name, password_hash, password_salt, password_iter, telegram_chat_id
       FROM profiles WHERE username = ?`,
  )
    .bind(username)
    .first<{
      id: number;
      full_name: string;
      password_hash: string;
      password_salt: string;
      password_iter: number;
      telegram_chat_id: string | null;
    }>();

  const okPass = row
    ? await verifyPassword(password, {
        hash: row.password_hash,
        salt: row.password_salt,
        iterations: row.password_iter,
      })
    : // Login topilmasa ham bir xil vaqt ketsin
      await verifyPassword(password, {
        hash: '0'.repeat(64),
        salt: 'dummy',
        iterations: 100000,
      });

  if (!row || !okPass) {
    if (tries >= 5) {
      await clearState(env, chatId);
      await sendMessage(
        env,
        chatId,
        'Juda ko‘p urinish bo‘ldi. Biroz kutib, /start bosib qaytadan urinib ko‘ring.',
      );
      return true;
    }

    await setState(env, chatId, 'login_password', { ...state.data, tries });
    await sendMessage(
      env,
      chatId,
      `Login yoki parol noto‘g‘ri. Qaytadan parolni yozing.\n\n` +
        `<i>Loginni almashtirish uchun /bekor, so‘ng /start</i>`,
    );
    return true;
  }

  if (row.telegram_chat_id && row.telegram_chat_id !== chatId) {
    await clearState(env, chatId);
    await sendMessage(
      env,
      chatId,
      'Bu hisob boshqa Telegram hisobiga ulangan. Avval u yerdan /stop yuboring.',
    );
    return true;
  }

  const other = await env.DB.prepare(
    `SELECT id FROM profiles WHERE telegram_chat_id = ? AND id != ?`,
  )
    .bind(chatId, row.id)
    .first();

  if (other) {
    await clearState(env, chatId);
    await sendMessage(
      env,
      chatId,
      'Bu Telegram hisobi allaqachon boshqa profilga ulangan. Avval /stop yuboring.',
    );
    return true;
  }

  await env.DB.prepare(
    `UPDATE profiles
        SET telegram_chat_id = ?, telegram_link_code = NULL,
            telegram_code_expires = NULL, telegram_linked_at = datetime('now')
      WHERE id = ?`,
  )
    .bind(chatId, row.id)
    .run();

  await clearState(env, chatId);
  await sendMessage(
    env,
    chatId,
    `Salom, ${esc(row.full_name)}! ✅\n\n` +
      'Hisobingiz ulandi.\n\n/ball — ballaringiz\n/challenge — ochiq vazifalar',
  );

  return true;
}
