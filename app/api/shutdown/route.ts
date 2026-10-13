// POST   /api/shutdown              { date?, note?, carry?: { [taskId]: "tomorrow" | "backlog" | "keep" } }
// DELETE /api/shutdown?date=YYYY-MM-DD  reopen the day (tasks already moved stay where they went)
import { maybeSyncFrame } from '@/lib/actions';
import { type Carry, reopenDay, shutdown } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

export const POST = route(async (req) => {
  const b = await body<{ date?: string; note?: string; carry?: Record<string, Carry> }>(req);
  const result = await shutdown(b.date, { note: b.note, carry: b.carry });
  return json({ ...result, warnings: await maybeSyncFrame(result.date) });
});

export const DELETE = route(async (req) => {
  const day = await reopenDay(new URL(req.url).searchParams.get('date') || undefined);
  return json({ day, warnings: await maybeSyncFrame(day.date) });
});
