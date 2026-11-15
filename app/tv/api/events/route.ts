// GET /tv/api/events?week=YYYY-MM-DD   the meetings Frame Desk last pushed for a week
// PUT /tv/api/events                   { weekOf, source?, events } replaces that week's
import { body, json, route } from '@/lib/http';
import { getTvEvents, saveTvEvents } from '@/lib/tv';
import { isYmd, mondayOf, today } from '@/lib/time';

export const GET = route(async (req) => {
  const week = new URL(req.url).searchParams.get('week') || undefined;
  return json((await getTvEvents(week)) || { weekOf: mondayOf(isYmd(week) ? week : today()), events: [] });
});

export const PUT = route(async (req) => {
  const doc = await saveTvEvents(await body(req));
  return json({ ok: true, weekOf: doc.weekOf, count: doc.events.length, syncedAt: doc.syncedAt });
});
export const POST = PUT;
