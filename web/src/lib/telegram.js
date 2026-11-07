/**
 * Telegram Mini App bilan ishlash.
 *
 * Sayt bot ichida ochilganda Telegram `window.Telegram.WebApp` ni beradi.
 * Oddiy brauzerda bu bo'lmaydi va hamma narsa avvalgidek ishlayveradi —
 * shuning uchun har bir funksiya avval mavjudligini tekshiradi.
 */

export function tg() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

/** Sayt Telegram ichida ochilganmi? */
export function inTelegram() {
  const app = tg();
  return Boolean(app?.initData);
}

/**
 * Telegram'ga «tayyorman» deyish va oynani to'liq ochish.
 * Chaqirilmasa, ilova yuklanmagandek ko'rinib turadi.
 */
export function initTelegram() {
  const app = tg();
  if (!app) return;

  try {
    app.ready();
    app.expand();

    // Telegram mavzusiga moslash — oq fonli saytimizga mos rang
    app.setHeaderColor?.('#f3f5ef');
    app.setBackgroundColor?.('#f3f5ef');

    // Telegram ichida ekanini CSS uchun belgilab qo'yamiz
    document.documentElement.dataset.telegram = '1';
  } catch {
    // Telegram'ning eski versiyasi — bezaksiz ishlayveradi
  }
}

/** Imzolangan ma'lumot — serverda tekshiriladi. */
export function initData() {
  return tg()?.initData || '';
}

/** Telefondagi yengil tebranish — tasdiqlangan amallarda. */
export function haptic(type = 'success') {
  try {
    tg()?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    /* muhim emas */
  }
}
