// GET /api/week?date=YYYY-MM-DD   the week containing date, plus the backlog
// PUT /api/week                   { date, focus }   the week's focus line
import { maybeSyncFrame } from '@/lib/actions';
import { getWeek, setWeekFocus } from '@/lib/daybook';
import { frameEvents } from '@/lib/frame';
import { body, json, route } from '@/lib/http';
import { today } from '@/lib/time';

// Meetings come from Frame Dashboard's calendars when it's connected.
export const GET = route(async (req) => {
  const date = new URL(req.url).searchParams.get('date') || undefined;
  const [week, events] = await Promise.all([getWeek(date), frameEvents(date)]);
  return json({ ...week, events });
});

export const PUT = route(async (req) => {
  const b = await body<{ date?: string; focus?: string | null }>(req);
  const date = b.date || today();
  await setWeekFocus(date, b.focus ?? null);
  const warnings = await maybeSyncFrame(date);
  return json({ ...(await getWeek(date)), warnings });
});
