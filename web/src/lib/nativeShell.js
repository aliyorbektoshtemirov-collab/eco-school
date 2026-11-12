// Presentation only: this flag must never be used for authentication.
export function detectNativeShell({ userAgent = '', telegram = false, hash = '' } = {}) {
  // Telegram also uses Android WebView, but needs the website navigation.
  if (telegram || /Telegram/i.test(userAgent) || /tgWebApp(?:Data|Platform)=/i.test(hash)) return false;
  // Explicit marker for new APKs; Android WebView fallback supports installed APKs.
  return /EcoSchoolNative\//i.test(userAgent) || (/Android/i.test(userAgent) && /; wv\)/i.test(userAgent));
}

export function inNativeShell() {
  if (typeof window === 'undefined') return false;
  return detectNativeShell({
    userAgent: window.navigator.userAgent,
    telegram: Boolean(window.Telegram?.WebApp?.initData),
    hash: window.location.hash,
  });
}
