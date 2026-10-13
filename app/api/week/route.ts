// GET /api/week?date=YYYY-MM-DD   the week containing date, plus the backlog
// PUT /api/week                   { date, focus }   the week's focus line
import { maybeSyncFrame } from '@/lib/actions';
import { getWeek, setWeekFocus } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';
import { today } from '@/lib/time';

export const GET = route(async (req) => json(await getWeek(new URL(req.url).searchParams.get('date') || undefined)));

export const PUT = route(async (req) => {
  const b = await body<{ date?: string; focus?: string | null }>(req);
  const date = b.date || today();
  await setWeekFocus(date, b.focus ?? null);
  const warnings = await maybeSyncFrame(date);
  return json({ ...(await getWeek(date)), warnings });
});
