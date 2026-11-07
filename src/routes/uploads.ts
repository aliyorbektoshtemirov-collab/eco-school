import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import { requireAuth, requireAdmin } from '../lib/auth';
import { limit } from '../lib/ratelimit';
import { randomToken } from '../lib/crypto';
import { buildKey, detectImage, isValidKey } from '../lib/images';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function maxBytes(env: Env): number {
  const n = Number(env.MAX_UPLOAD_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 5_000_000;
}

/** Rasm yuklash sozlanganmi — frontend shunga qarab maydonni ko'rsatadi. */
app.get('/uploads/status', (c) =>
  c.json(ok({ enabled: Boolean(c.env.FILES), maxBytes: maxBytes(c.env) })),
);

/**
 * Dalil rasmini yuklash. Fayl to'g'ridan-to'g'ri so'rov tanasida keladi.
 * Javobda R2 kaliti qaytadi — u hisobot bilan birga saqlanadi.
 */
app.post('/uploads', requireAuth, async (c) => {
  const user = c.get('user');
  const bucket = c.env.FILES;

  if (!bucket) {
    fail(503, 'Rasm yuklash hozircha sozlanmagan. Administratorga xabar bering.', 'uploads_disabled');
  }

  await limit(c.env, `upload:${user.id}`, 30, 3600, "Juda ko'p rasm yubordingiz.");

  const cap = maxBytes(c.env);
  const declared = Number(c.req.header('content-length'));
  if (Number.isFinite(declared) && declared > cap) {
    fail(422, `Rasm hajmi ${Math.round(cap / 1_000_000)} MB dan oshmasligi kerak.`);
  }

  const buffer = await c.req.arrayBuffer();
  if (buffer.byteLength === 0) fail(422, "Fayl bo'sh.");
  if (buffer.byteLength > cap) {
    fail(422, `Rasm hajmi ${Math.round(cap / 1_000_000)} MB dan oshmasligi kerak.`);
  }

  // Fayl nomiga emas, ichidagi baytlarga qaraymiz
  const kind = detectImage(new Uint8Array(buffer));
  if (!kind) fail(422, 'Faqat JPG, PNG yoki WEBP formatidagi rasm yuklang.');

  const key = buildKey(kind, randomToken(16));
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: kind, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { userId: String(user.id) },
  });

  return c.json(ok({ key, size: buffer.byteLength }), 201);
});

/**
 * Dalil rasmini ko'rsatish. Faqat rasm egasi va adminlar ko'ra oladi —
 * o'quvchilarning suratlari ochiq internetda yotmaydi.
 */
app.get('/files/:year/:month/:name', requireAuth, async (c) => {
  const user = c.get('user');
  const bucket = c.env.FILES;
  if (!bucket) fail(404, 'Rasm topilmadi.');

  const key = `${c.req.param('year')}/${c.req.param('month')}/${c.req.param('name')}`;
  if (!isValidKey(key)) fail(404, 'Rasm topilmadi.');

  const object = await bucket.get(key);
  if (!object) fail(404, 'Rasm topilmadi.');

  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const ownerId = Number(object.customMetadata?.userId ?? 0);
  if (!isAdmin && ownerId !== user.id) fail(403, "Bu rasmni ko'rishga ruxsatingiz yo'q.");

  if (c.req.header('if-none-match') === object.httpEtag) {
    return new Response(null, { status: 304, headers: { ETag: object.httpEtag } });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Length': String(object.size),
      'Cache-Control': 'private, max-age=600',
      ETag: object.httpEtag,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

/** Admin uchun: hamma rasm ko'rinadi (moderatsiya sahifalarida ishlatiladi). */
app.get('/admin/files/:year/:month/:name', requireAuth, requireAdmin, async (c) => {
  const bucket = c.env.FILES;
  if (!bucket) fail(404, 'Rasm topilmadi.');

  const key = `${c.req.param('year')}/${c.req.param('month')}/${c.req.param('name')}`;
  if (!isValidKey(key)) fail(404, 'Rasm topilmadi.');

  const object = await bucket.get(key);
  if (!object) fail(404, 'Rasm topilmadi.');

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=600',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

export default app;
