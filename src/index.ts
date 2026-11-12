import { Hono } from 'hono';
import { dailyTip } from './lib/tips';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { Env, Variables } from './types';
import { csrfGuard } from './lib/auth';
import { sweep } from './lib/ratelimit';
import { sendWeeklyReminders } from './lib/reminders';
import { ensureWebhook } from './lib/webhook';
import { sweepStates } from './lib/botflow';
import authRoutes from './routes/auth';
import statsRoutes from './routes/stats';
import challengeRoutes from './routes/challenges';
import recyclingRoutes from './routes/recycling';
import researchRoutes from './routes/research';
import eventRoutes from './routes/events';
import uploadRoutes from './routes/uploads';
import telegramRoutes from './routes/telegram';
import userRoutes from './routes/users';
import mentorRoutes from './routes/mentors';
import marathonRoutes from './routes/marathons';
import announcementRoutes from './routes/announcements';
import { sendDailyMarathonReminders } from './lib/marathonBot';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// --------------------------------------------------------------- xavfsizlik
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      // telegram.org — Mini App kutubxonasi (bot ichida ochilganda)
      scriptSrc: ["'self'", 'https://telegram.org'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      // Telegram Web saytni iframe ichida ochadi; boshqa hech kimga ruxsat yo'q
      frameAncestors: ["'self'", 'https://telegram.org', 'https://*.telegram.org'],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    // X-Frame-Options qo'yilmaydi — u faqat «hamma yoki hech kim» deya oladi
    // va Telegram Web'da ilovani bloklab qo'yardi. O'rniga CSP frame-ancestors.
    xContentTypeOptions: 'nosniff',
    crossOriginOpenerPolicy: 'same-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  }),
);

// --------------------------------------------------------------- API
const api = new Hono<{ Bindings: Env; Variables: Variables }>();

// Telegram webhook brauzerdan emas, Telegram serveridan keladi —
// uni CSRF tekshiruvidan chiqaramiz (o'rniga maxfiy sarlavha tekshiriladi).
api.use('*', async (c, next) => {
  if (new URL(c.req.url).pathname === '/api/telegram/webhook') return next();
  return csrfGuard(c, next);
});
api.use('*', async (c, next) => {
  await next();
  // Rasmlar o'z sarlavhasi bilan keladi, qolgani shaxsiy ma'lumot
  if (!new URL(c.req.url).pathname.includes('/files/')) {
    c.header('Cache-Control', 'no-store');
  }
});

/**
 * Telegram webhook'i o'zi ulanadi: birinchi so'rovda tekshiriladi va
 * kerak bo'lsa o'rnatiladi. Javobni kutib turmaydi, 6 soatda bir marta
 * bajariladi — qo'lda `/api/telegram/setup` chaqirish shart emas.
 */
api.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path !== '/api/telegram/webhook') {
    c.executionCtx.waitUntil(ensureWebhook(c.env, new URL(c.req.url).origin));
  }
  return next();
});

api.get('/health', (c) => c.json({ ok: true, service: c.env.APP_NAME ?? 'ECO SCHOOL' }));
api.get('/tips', (c) => c.json({ ok: true, tip: dailyTip() }));
api.route('/auth', authRoutes);
api.route('/stats', statsRoutes);
api.route('/challenges', challengeRoutes);
api.route('/recycling', recyclingRoutes);
api.route('/research', researchRoutes);
api.route('/events', eventRoutes);
api.route('/', uploadRoutes);
api.route('/', telegramRoutes);
api.route('/', mentorRoutes); // ochiq o'qish — userRoutes'dan oldin bo'lishi shart
api.route('/', userRoutes);
api.route('/', marathonRoutes);
api.route('/', announcementRoutes);

app.route('/api', api);

// --------------------------------------------------------------- xatoliklar
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const res = err.getResponse();
    if (res.headers.get('content-type')?.includes('application/json')) return res;
    return c.json({ ok: false, error: err.message || 'Xatolik yuz berdi.' }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ ok: false, error: 'Serverda kutilmagan xatolik yuz berdi.' }, 500);
});

/**
 * Android ilovasi uchun tasdiqnoma.
 *
 * Trusted Web Activity ochilganda Chrome shu faylni so'raydi: ilovaning
 * imzosi shu yerda ko'rsatilgan bo'lsa, sayt ilovaga tegishli deb
 * hisoblanadi va tepadagi manzil qatori ko'rsatilmaydi.
 *
 * Barmoq izi `ANDROID_FINGERPRINT` o'zgaruvchisidan olinadi — kalit
 * almashsa, saytni qaytadan yig'ish shart emas.
 */
app.get('/.well-known/assetlinks.json', (c) => {
  const fingerprint = (c.env.ANDROID_FINGERPRINT ?? '').trim();
  if (!fingerprint) return c.json([], 200);

  return c.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: c.env.ANDROID_PACKAGE || 'uz.ecoschool.app',
        sha256_cert_fingerprints: fingerprint.split(',').map((f) => f.trim()).filter(Boolean),
      },
    },
  ]);
});

// --------------------------------------------------------------- statik fayllar
app.all('*', async (c) => {
  const path = new URL(c.req.url).pathname;

  if (path === '/api' || path.startsWith('/api/')) {
    return c.json({ ok: false, error: 'Bunday API manzili mavjud emas.' }, 404);
  }

  const asset = await c.env.ASSETS.fetch(c.req.raw);
  // ASSETS javobining sarlavhalari o'zgarmas — nusxasini qaytaramiz
  return new Response(asset.body, {
    status: asset.status,
    statusText: asset.statusText,
    headers: new Headers(asset.headers),
  });
});

export default {
  fetch: app.fetch,

  /**
   * Ikki jadval:
   *   0 3 * * *  — har kuni eskirgan sessiya va hisoblagichlarni tozalash
   *   0 4 * * 1  — dushanba ertalab (Toshkent 09:00) challenge eslatmasi
   */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === '0 11 * * *') {
      // Har kuni 16:00 (Toshkent) — marafon eslatmasi
      ctx.waitUntil(
        sendDailyMarathonReminders(env).catch((err) =>
          console.error('Marathon reminders failed:', err),
        ),
      );
    } else if (event.cron === '0 4 * * 1') {
      ctx.waitUntil(
        sendWeeklyReminders(env).catch((err) => console.error('Weekly reminders failed:', err)),
      );
    } else {
      ctx.waitUntil(sweep(env).catch((err) => console.error('Sweep failed:', err)));
      ctx.waitUntil(
        sweepStates(env).catch((err) => console.error('Bot state sweep failed:', err)),
      );
    }
  },
} satisfies ExportedHandler<Env>;
