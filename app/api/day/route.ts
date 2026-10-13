// GET /api/day?date=YYYY-MM-DD   the day: focus, tasks, workload (rolls over unfinished work into today)
// PUT /api/day                   { date, focus?, note? }
import { maybeSyncFrame } from '@/lib/actions';
import { getDay, setDay } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';
import { today } from '@/lib/time';

export const GET = route(async (req) => json(await getDay(new URL(req.url).searchParams.get('date') || undefined)));

export const PUT = route(async (req) => {
  const b = await body<{ date?: string; focus?: string | null; note?: string | null }>(req);
  const date = b.date || today();
  await setDay(date, { focus: b.focus, note: b.note });
  const warnings = await maybeSyncFrame(date);
  return json({ ...(await getDay(date)), warnings });
});
