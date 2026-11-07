import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { fail, ok } from '../lib/http';
import * as v from '../lib/validate';
import { requireAdmin, requireAuth } from '../lib/auth';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', requireAuth);

app.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, event_type, start_date, end_date, location, school_id
       FROM eco_events
      WHERE school_id IS NULL OR school_id = ?
      ORDER BY start_date`,
  )
    .bind(user.school_id)
    .all();

  return c.json(ok({ events: results ?? [] }));
});

app.post('/', requireAdmin, async (c) => {
  const user = c.get('user');
  const data = await v.body(c.req.raw);

  const title = v.str(data.title, 'Tadbir nomi', { min: 2, max: 200 });
  const description = v.clean(data.description, 2000) || null;
  const eventType = v.oneOf(data.eventType, ['event', 'challenge', 'eco_day'] as const, 'Turi');
  const startDate = v.dateStr(data.startDate, 'Boshlanish');
  const endDate = v.dateStr(data.endDate, 'Tugash', false);
  const location = v.clean(data.location, 200) || null;

  if (endDate && startDate && endDate < startDate) {
    fail(422, "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.");
  }

  await c.env.DB.prepare(
    `INSERT INTO eco_events (title, description, event_type, start_date, end_date, location, school_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(title, description, eventType, startDate, endDate, location, user.school_id, user.id)
    .run();

  return c.json(ok({ message: "Tadbir muvaffaqiyatli qo'shildi!" }), 201);
});

export default app;
