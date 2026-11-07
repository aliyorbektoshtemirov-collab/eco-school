import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { requireAdmin, requireAuth, requireOwner } from '../lib/auth';
import { broadcastAnnouncement } from '../lib/announce';

/**
 * E'lonlar.
 *
 * Yozish — owner qo'lida: hamma o'quvchiga birdan xabar ketadigan narsa
 * tasodifan yuborilmasligi kerak. Adminlar ro'yxatni ko'radi.
 */

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

/** Saytdagi banner uchun — oxirgi qadab qo'yilganlari. */
app.get('/announcements', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, body, link, created_at
       FROM announcements
      WHERE (school_id IS NULL OR school_id = ?) AND pinned = 1
      ORDER BY created_at DESC, id DESC
      LIMIT 3`,
  )
    .bind(user.school_id)
    .all();

  return c.json(ok({ announcements: results ?? [] }));
});

/** Admin ro'yxati — qadalmaganlari bilan birga. */
app.get('/admin/announcements', requireAdmin, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.title, a.body, a.link, a.pinned, a.sent_count, a.created_at,
            p.full_name AS author
       FROM announcements a
       LEFT JOIN profiles p ON p.id = a.created_by
      WHERE a.school_id IS NULL OR a.school_id = ?
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 50`,
  )
    .bind(user.school_id)
    .all();

  return c.json(ok({ announcements: results ?? [] }));
});

app.post('/admin/announcements', requireOwner, async (c) => {
  const user = c.get('user');
  const data = await v.body(c.req.raw);

  const title = v.str(data.title, 'Sarlavha', { min: 3, max: 120 });
  const body = v.str(data.body, 'Matn', { min: 0, max: 2000, required: false });
  const link = v.clean(data.link, 300) || null;
  const pinned = data.pinned === false ? 0 : 1;
  const toBot = data.toBot !== false;

  if (link && !/^https?:\/\//.test(link)) {
    fail(422, 'Havola https:// bilan boshlanishi kerak.');
  }

  const res = await c.env.DB.prepare(
    `INSERT INTO announcements (school_id, title, body, link, pinned, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(user.school_id, title, body || '', link, pinned, user.id)
    .run();

  const id = Number(res.meta.last_row_id);

  if (toBot) {
    c.executionCtx.waitUntil(
      broadcastAnnouncement(c.env, id).catch((err) =>
        console.error('broadcastAnnouncement failed:', err),
      ),
    );
  }

  return c.json(
    ok({
      id,
      message: toBot
        ? 'E’lon saqlandi va botga yuborilmoqda.'
        : 'E’lon saqlandi (faqat saytda).',
    }),
    201,
  );
});

/** Bannerdan olib tashlash yoki qaytarish. */
app.post('/admin/announcements/:id/pin', requireOwner, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  const data = await v.body(c.req.raw);
  const pinned = data.pinned === false ? 0 : 1;

  await c.env.DB.prepare(`UPDATE announcements SET pinned = ? WHERE id = ?`)
    .bind(pinned, id)
    .run();

  return c.json(ok({ message: pinned ? 'Bannerga qaytarildi.' : 'Bannerdan olindi.' }));
});

app.delete('/admin/announcements/:id', requireOwner, async (c) => {
  const id = v.num(c.req.param('id'), 'ID', { min: 1 });
  await c.env.DB.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
  return c.json(ok({ message: 'E’lon o‘chirildi.' }));
});

export default app;
