// GET /tv/api/week?date=YYYY-MM-DD&k=<screen key>   the week as the TV draws it
// (Frame Dashboard's /api/week shape: plan, meetings and the painting of each day)
import { json, route } from '@/lib/http';
import { tvWeek } from '@/lib/tv';

export const GET = route(async (req) => json(await tvWeek(new URL(req.url).searchParams.get('date') || undefined)), { screen: true });
